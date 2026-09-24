/**
 * Intake — onboarding workbook import + wizard persistence.
 *
 * Workbook flow: Upload → Extract → Review → Apply. The upload is converted to
 * a Google Sheet, read cell-by-cell, and the temp copy is trashed; the original
 * .xlsx is kept in the pro's Drive folder as the source of record.
 *
 * Extraction keys off LABEL TEXT, never fixed cell addresses: reps insert and
 * rename rows, so we find "Org ID", "Business Name", "Owner 1" … wherever they
 * are and read the value cell next to (or under) the label.
 */

function normLabel_(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();
}

function a1_(r, c) {
  var s = '';
  c += 1;
  while (c > 0) { var m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); }
  return s + (r + 1);
}

/** Wrap a tab {name, values, merges} with label lookup helpers. */
function tabReader_(tab) {
  var values = tab.values || [];
  var merges = tab.merges || [];
  function cell(r, c) {
    var row = values[r];
    if (!row) return '';
    var v = row[c];
    return v == null ? '' : v;
  }
  function mergeAt(r, c) {
    for (var i = 0; i < merges.length; i++) {
      var m = merges[i];
      if (r >= m[0] && r < m[0] + m[2] && c >= m[1] && c < m[1] + m[3]) return m;
    }
    return [r, c, 1, 1];
  }
  function findAll(label) {
    var want = normLabel_(label);
    var hits = [];
    for (var r = 0; r < values.length; r++) {
      for (var c = 0; c < (values[r] || []).length; c++) {
        if (normLabel_(values[r][c]) === want) hits.push([r, c]);
      }
    }
    return hits;
  }
  /** Value cell for a label: right of the label's merged block, or directly below it. */
  function valueFor(hit, dir) {
    var m = mergeAt(hit[0], hit[1]);
    var r = dir === 'below' ? m[0] + m[2] : m[0];
    var c = dir === 'below' ? m[1] : m[1] + m[3];
    return { value: cell(r, c), ref: a1_(r, c), r: r, c: c };
  }
  return { name: tab.name, values: values, cell: cell, mergeAt: mergeAt, findAll: findAll, valueFor: valueFor };
}

function toStr_(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

var ENTITY_ALIASES = [
  [/sole|sched/i, 'SOLE_PROP_SCHED_C'], [/partner/i, 'PARTNERSHIP'], [/s\s*-?\s*corp/i, 'S_CORP'], [/c\s*-?\s*corp/i, 'C_CORP'],
];
var TZ_ALIASES = [
  [/pacific|pst|pdt|los.?angeles|\bpt\b/i, 'America/Los_Angeles'], [/mountain|mst|mdt|denver|\bmt\b/i, 'America/Denver'],
  [/arizona|phoenix/i, 'America/Phoenix'], [/central|cst|cdt|chicago|\bct\b/i, 'America/Chicago'],
  [/eastern|est|edt|new.?york|\bet\b/i, 'America/New_York'], [/alaska/i, 'America/Anchorage'], [/hawaii/i, 'Pacific/Honolulu'],
];

function normEntity_(v) {
  var s = toStr_(v);
  for (var i = 0; i < ENTITY_ALIASES.length; i++) if (ENTITY_ALIASES[i][0].test(s)) return ENTITY_ALIASES[i][1];
  return '';
}
function normTz_(v) {
  var s = toStr_(v);
  if (/^[A-Za-z]+\/[A-Za-z_]+$/.test(s)) return s;
  for (var i = 0; i < TZ_ALIASES.length; i++) if (TZ_ALIASES[i][0].test(s)) return TZ_ALIASES[i][1];
  return s;
}
function normYesNo_(v) {
  var s = toStr_(v).toLowerCase();
  if (/^(y|yes|true|1)/.test(s)) return true;
  if (/^(n|no|false|0)/.test(s)) return false;
  return null;
}
function normYear_(v) {
  var m = toStr_(v).match(/(19|20)\d\d/);
  return m ? Number(m[0]) : null;
}
function normDate_(v) {
  var s = toStr_(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    var y = m[3].length === 2 ? '20' + m[3] : m[3];
    return y + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2);
  }
  var y2 = normYear_(s);
  return y2 ? y2 + '-01-01' : '';
}
function normPct_(v) {
  var n = parseFloat(toStr_(v).replace('%', ''));
  if (isNaN(n)) return null;
  return n > 0 && n <= 1 ? Math.round(n * 1000) / 10 : n;
}

var WB_FIELDS = [
  // [field, label, direction, group, normalizer]
  ['org_id', 'Org ID', 'right', 'Pro profile', function (v) { return toStr_(v).replace(/\.0+$/, ''); }],
  ['business_name', 'Business Name', 'right', 'Pro profile', toStr_],
  ['dba', 'DBA', 'right', 'Pro profile', toStr_],
  ['entity_type', 'Entity Type', 'below', 'Pro profile', normEntity_],
  ['last_filing_year', 'Last Tax Filing Year', 'below', 'Pro profile', normYear_],
  ['year_started', 'Year Business Started', 'below', 'Pro profile', normYear_],
  ['vertical', 'Vertical', 'below', 'Pro profile', toStr_],
  ['state', 'State', 'below', 'Pro profile', function (v) { return toStr_(v).toUpperCase().slice(0, 2); }],
  ['time_zone', 'Time Zone', 'below', 'Pro profile', normTz_],
  ['scope_start_date', 'Scope Start', 'right', 'Pro profile', normDate_],
  ['books_with_hcp', 'Books with HCP', 'right', 'Bookkeeping', normYesNo_],
  ['prior_books_status', 'Prior Books', 'right', 'Bookkeeping', toStr_],
  ['bk_lead_email', 'BK Lead', 'right', 'Bookkeeping', null],
  ['payroll_servicer', 'Payroll Servicer', 'right', 'Bookkeeping', toStr_],
  ['books_access', 'Access', 'below', 'Bookkeeping', toStr_],
  ['inha_remarks', 'Remarks', 'below', 'Bookkeeping', toStr_],
];

var Intake = {
  /**
   * Pure extraction over tabs [{name, values (2D), merges [[r,c,nrows,ncols]] (0-based)}].
   * Returns { rows, warnings, entityTab, workbookEntity }.
   */
  extract: function (tabs, opts) {
    opts = opts || {};
    var general = null, soleProp = null, entityTabR = null;
    tabs.forEach(function (t) {
      if (/general/i.test(t.name)) general = tabReader_(t);
      else if (/sole/i.test(t.name)) soleProp = tabReader_(t);
      else if (/corp|partner/i.test(t.name)) entityTabR = tabReader_(t);
    });
    if (!general) throw new AppError('Could not find the "General Information" tab in that workbook.', 'VALIDATION');
    var rows = [];
    var warnings = [];
    var roster = opts.roster || [];

    WB_FIELDS.forEach(function (f) {
      var hits = general.findAll(f[1]);
      if (!hits.length) return;
      var got = general.valueFor(hits[0], f[2]);
      var raw = toStr_(got.value);
      if (!raw) return;
      var value;
      if (f[0] === 'bk_lead_email') {
        value = Intake.matchPerson(raw, roster);
      } else {
        value = f[4](got.value);
      }
      if (value === '' || value == null) {
        warnings.push('Couldn\'t read ' + f[1] + ' ("' + raw + '") — enter it manually.');
        return;
      }
      rows.push({ kind: 'field', group: f[3], field: f[0], label: f[1], raw: raw, value: value, tab: general.name, ref: got.ref });
    });

    // Owners 1–3: find each "Owner N" header, then its Name/Phone/Email/% labels beneath.
    var pctTotal = 0, pctSeen = false;
    [1, 2, 3].forEach(function (n) {
      var hit = general.findAll('Owner ' + n)[0];
      if (!hit) return;
      var block = general.mergeAt(hit[0], hit[1]);
      var parts = { name: '', phone: '', email: '', pct: null };
      var refs = [];
      [['name', 'Name'], ['phone', 'Phone'], ['email', 'Email'], ['pct', '%Ownership']].forEach(function (pair) {
        var cand = general.findAll(pair[1]).filter(function (h) {
          return h[0] > block[0] && h[0] <= block[0] + 6 && h[1] >= block[1] && h[1] < block[1] + block[3];
        })[0];
        if (!cand) return;
        var v = general.valueFor(cand, 'right');
        if (toStr_(v.value)) { parts[pair[0]] = pair[0] === 'pct' ? normPct_(v.value) : toStr_(v.value); refs.push(v.ref); }
      });
      if (!parts.name) return;
      if (parts.pct != null) { pctTotal += parts.pct; pctSeen = true; }
      rows.push({
        kind: 'owner', group: 'Owners', field: 'owner' + n, label: 'Owner ' + n,
        raw: [parts.name, parts.email, parts.pct != null ? parts.pct + '%' : ''].filter(Boolean).join(' · '),
        value: parts, tab: general.name, ref: refs[0] + (refs.length > 1 ? ':' + refs[refs.length - 1] : ''),
      });
    });
    if (pctSeen && Math.abs(pctTotal - 100) > 0.01) warnings.push('Owner % sums to ' + pctTotal + ', not 100.');

    var misc = general.findAll('Miscellaneous Notes')[0];
    if (misc) {
      var mv = general.valueFor(misc, 'right');
      if (toStr_(mv.value)) rows.push({ kind: 'note', group: 'Notes', field: 'note', label: 'Miscellaneous notes → notes thread', raw: toStr_(mv.value), value: toStr_(mv.value), tab: general.name, ref: mv.ref });
    }

    rows = rows.concat(Intake.readQA(general, 'GENERAL', 'Intake answers → General'));

    var wbEntity = (rows.filter(function (r) { return r.field === 'entity_type'; })[0] || {}).value || opts.entityType || '';
    var useTab = opts.entityTab || (wbEntity === 'SOLE_PROP_SCHED_C' ? 'SoleProp' : wbEntity ? 'Entity' : '');
    if (!useTab) useTab = soleProp && Intake.readQA(soleProp, 'SCHED_C', '').length ? 'SoleProp' : 'Entity';
    if (useTab === 'SoleProp' && soleProp) rows = rows.concat(Intake.readQA(soleProp, 'SCHED_C', 'Intake answers → Sole prop'));
    if (useTab === 'Entity' && entityTabR) rows = rows.concat(Intake.readQA(entityTabR, 'ENTITY', 'Intake answers → Entity'));

    if (opts.entityType && wbEntity && opts.entityType !== wbEntity) {
      warnings.push('Workbook says ' + LABELS.ENTITY_TYPE[wbEntity] + ' but the pro record says ' + LABELS.ENTITY_TYPE[opts.entityType] + '.');
    }
    if (wbEntity && ((wbEntity === 'SOLE_PROP_SCHED_C') !== (useTab === 'SoleProp'))) {
      warnings.push('Entity type is ' + LABELS.ENTITY_TYPE[wbEntity] + ' but the ' + (useTab === 'SoleProp' ? 'Sole Prop' : 'S-Corp / C-Corp / Partnership') + ' tab is selected.');
    }
    return { rows: rows, warnings: warnings, entityTab: useTab, workbookEntity: wbEntity };
  },

  /** Q&A table: header row with "Questions" / "Answers" / "Notes"; one question per row below. */
  readQA: function (tab, branch, group) {
    var q = tab.findAll('Questions')[0];
    if (!q) return [];
    var hr = q[0];
    var aCol = null, nCol = null;
    (tab.values[hr] || []).forEach(function (v, c) {
      var n = normLabel_(v);
      if (n === 'answers' || n === 'answer') aCol = c;
      if (n === 'notes' || n === 'note') nCol = c;
    });
    if (aCol == null) return [];
    var out = [];
    for (var r = hr + 1; r < tab.values.length; r++) {
      var question = toStr_(tab.cell(r, q[1])).replace(/\s+/g, ' ');
      if (!question) continue;
      var ans = toStr_(tab.cell(r, aCol));
      var notes = nCol == null ? '' : toStr_(tab.cell(r, nCol));
      if (!ans && !notes) continue;
      out.push({
        kind: 'answer', group: group, branch: branch, label: question, question: question,
        raw: ans + (notes ? ' — ' + notes : ''), value: ans, notes: notes, tab: tab.name, ref: a1_(r, aCol),
      });
    }
    return out;
  },

  /** Match a free-text person name to a roster email (exact name, then first.last). */
  matchPerson: function (name, roster) {
    var n = normLabel_(name);
    if (!n) return '';
    if (/@/.test(name)) return String(name).trim().toLowerCase();
    for (var i = 0; i < roster.length; i++) if (normLabel_(roster[i].name) === n) return roster[i].email;
    var email = Identity.emailFromName(name);
    for (var j = 0; j < roster.length; j++) if (roster[j].email === email) return email;
    return '';
  },

  /** Convert an uploaded .xlsx (base64) to tabs, keep the original in Drive. */
  readUpload: function (orgId, filename, base64) {
    var bytes = Utilities.base64Decode(base64);
    var xlsxMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    var blob = Utilities.newBlob(bytes, xlsxMime, filename);
    var saved = null;
    try { saved = Folders.saveFile(orgId, filename, xlsxMime, base64); } catch (e) { saved = null; }
    var temp;
    if (typeof DriveApi_createSheetFromBlob_ === 'function') {
      temp = DriveApi_createSheetFromBlob_(blob, 'tmp-intake-' + orgId);
    } else {
      throw new AppError('Drive API is not enabled for this script.', 'NOT_CONFIGURED');
    }
    try {
      var ss = SpreadsheetApp.openById(temp);
      var tz = ss.getSpreadsheetTimeZone();
      var tabs = ss.getSheets().map(function (sh) {
        return {
          name: sh.getName(),
          // google.script.run can't return Date objects — normalize to strings.
          values: sh.getDataRange().getValues().map(function (row) {
            return row.map(function (v) { return v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : v; });
          }),
          merges: sh.getDataRange().getMergedRanges().map(function (m) {
            return [m.getRow() - 1, m.getColumn() - 1, m.getNumRows(), m.getNumColumns()];
          }),
        };
      });
      return { tabs: tabs, savedUrl: saved ? saved.getUrl() : '' };
    } finally {
      try { DriveApp.getFileById(temp).setTrashed(true); } catch (e2) { /* ignore */ }
    }
  },

  upload: function (orgId, filename, base64, entityTab) {
    var pro = Db.get('Pros', orgId);
    if (!pro) throw new AppError('Pro not found.', 'NOT_FOUND');
    var up = Intake.readUpload(orgId, filename, base64);
    var result = Intake.extract(up.tabs, { roster: Identity.roster(), entityType: pro.entity_type, entityTab: entityTab });
    result.filename = filename;
    result.savedUrl = up.savedUrl;
    result.tabs = up.tabs; // kept client-side so switching entity tab doesn't re-upload
    result.pro = Db.get('Pros', orgId); // Drive folder may have just been linked
    if (!up.savedUrl) result.warnings.push('Original file was not saved to Drive (set up the Drive folder first).');
    return result;
  },

  /** Write confirmed rows. Nothing touches the record until the OS confirms. */
  apply: function (orgId, rows, meta) {
    var pro = Db.get('Pros', orgId);
    if (!pro) throw new AppError('Pro not found.', 'NOT_FOUND');
    var patch = {};
    var answers = [];
    var notes = [];
    rows.forEach(function (r) {
      if (r.kind === 'field') {
        if (r.field === 'org_id') return; // never rewrite the primary key from a workbook
        patch[r.field] = r.value;
      } else if (r.kind === 'owner') {
        var n = r.field.slice(-1);
        patch['owner' + n + '_name'] = r.value.name || '';
        patch['owner' + n + '_phone'] = r.value.phone || '';
        patch['owner' + n + '_email'] = r.value.email || '';
        patch['owner' + n + '_pct'] = r.value.pct;
      } else if (r.kind === 'answer') {
        answers.push(r);
      } else if (r.kind === 'note') {
        notes.push(r.value);
      }
    });
    var res = Object.keys(patch).length ? Pros.update(orgId, patch) : { pro: pro, tasks: [] };
    answers.forEach(function (a) {
      Intake.saveAnswer(orgId, a.branch, a.question, a.value, a.notes, 'WORKBOOK', (meta && meta.filename ? meta.filename + ' ' : '') + a.tab + '!' + a.ref);
    });
    notes.forEach(function (n) { Notes.add('PRO', orgId, 'From onboarding workbook: ' + n); });
    Audit.log('PRO', orgId, 'Applied onboarding workbook', 'workbook', '', rows.length + ' values' + (meta && meta.filename ? ' from ' + meta.filename : ''));
    return { pro: res.pro, tasks: res.tasks, answers: Intake.answers(orgId), applied: rows.length };
  },

  /** Upsert one answer: older answers for the same question stay, flagged is_current=false. */
  saveAnswer: function (orgId, branch, question, answer, notes, source, ref) {
    var prior = Db.where('IntakeAnswers', function (a) {
      return a.org_id === orgId && a.branch === branch && a.question === question && a.is_current;
    });
    if (prior.length && prior[0].answer === (answer || '') && (prior[0].notes || '') === (notes || '')) return prior[0];
    prior.forEach(function (p) { Db.update('IntakeAnswers', p.answer_id, { is_current: false }); });
    return Db.insert('IntakeAnswers', {
      answer_id: uid_('IA'), org_id: orgId, branch: branch, question: question, answer: answer || '', notes: notes || '',
      source: source || 'WIZARD', source_ref: ref || '', answered_at: nowIso_(), answered_by: Identity.currentEmail(), is_current: true,
    });
  },

  answers: function (orgId) {
    return Db.where('IntakeAnswers', function (a) { return a.org_id === orgId && a.is_current; });
  },

  /** Persist wizard progress (current step + completed steps) on the pro. */
  saveProgress: function (orgId, state) {
    var pro = Db.get('Pros', orgId);
    if (!pro) throw new AppError('Pro not found.', 'NOT_FOUND');
    var cur = pro.intake_state || {};
    var next = {
      step: state.step || cur.step || 'A0',
      completed: state.completed || cur.completed || [],
      complexity: state.complexity != null ? state.complexity : cur.complexity,
      updated_at: nowIso_(),
    };
    return Db.update('Pros', orgId, { intake_state: next }, null, { system: true });
  },
};
