/**
 * Migration — import existing records from an Asana (or any) CSV export.
 *
 * Headers are matched to fields by name/alias (case-insensitive), so a raw
 * Asana export with custom-field columns ("Org ID", "Filing Type", "Return
 * Stage", "Extension Needed?" …) works without editing. Enum values are
 * matched by key or label. Rows upsert: existing records are updated, new
 * ones created. Projects can materialize template tasks, with sections before
 * the project's current stage pre-marked done.
 */

/*
 * Column aliases (case-insensitive). Keys starting with "__" are handled
 * specially in plan(); "__note:<Label>" columns each become a line in the
 * record's notes thread. Tuned for the HCP Tax Asana exports ("HCP Tax Pros"
 * and "HCP Tax Returns" project lists) but works for any similar CSV.
 */
var IMPORT_ALIASES = {
  pros: {
    org_id: ['org id', 'orgid', 'organization id'],
    business_name: ['business name', 'business', 'account name', 'name', 'task name', 'pro'],
    dba: ['dba', 'doing business as'],
    vertical: ['vertical', 'industry', 'trade'],
    state: ['state'],
    time_zone: ['time zone', 'timezone', 'tz'],
    year_started: ['year started', 'year business started'],
    scope_start_date: ['scope start', 'scope start date'],
    __scope_years: ['tax year scope'],
    entity_type: ['entity type', 'entity'],
    lifecycle_status: ['pro status', 'lifecycle', 'lifecycle status', 'section/column', 'section'],
    assigned_advisor_email: ['tax advisor', 'advisor', 'assigned advisor'],
    assigned_os_email: ['ob/dc assigned', 'onboarding specialist', 'os', 'case owner'],
    bk_lead_email: ['bk lead', 'bookkeeper', 'bookkeeping advisor'],
    payroll_servicer: ['payroll', 'payroll servicer', 'payroll provider'],
    owner1_name: ['pro name', 'owner 1', 'primary owner', 'owner 1 name'],
    owner1_email: ['email address', 'email', 'owner 1 email'],
    owner1_pct: ['owner 1 %', 'owner 1 pct', 'owner %'],
    owner2_name: ['owner 2', 'owner 2 name'],
    owner2_pct: ['owner 2 %', 'owner 2 pct'],
    doc_collection_status: ['pro doc status', 'docs', 'doc collection', 'doc collection status'],
    __inha: ['inha books'],
    books_with_hcp: ['books with hcp', 'inha', 'books w/ hcp'],
    prior_books_status: ['prior books', 'prior books status'],
    at_risk: ['at risk', 'at risk?'],
    at_risk_reason: ['at risk reason', 'risk reason'],
    last_advisor_touchpoint: ['date of last tax advisory', 'last touch', 'last advisor touchpoint', 'last touchpoint'],
    last_filing_year: ['last filed', 'last filing year', 'last tax filing year'],
    sfdc_case_number: ['case number', 'sfdc case'],
    source_ref: ['url', 'asana url', 'link'],
    '__note:Add-ons': ['add-ons', 'add ons'],
    '__note:Reachout notes': ['reachout notes'],
    '__note:Description': ['description'],
    '__note:Notes': ['notes', 'misc notes', 'miscellaneous notes'],
  },
  projects: {
    project_id: ['project id'],
    org_id: ['org id', 'orgid'],
    __business_name: ['business name', 'business', 'account name', 'name', 'task name', 'pro'],
    filing_type: ['filing type', 'return type', 'form'],
    tax_year: ['year (tax)', 'tax year', 'ty', 'year'],
    __year_end: ['filing year end'],
    pipeline_status: ['return stage', 'stage', 'pipeline status', 'pipeline', 'section/column', 'section'],
    blocker_reason: ['blocker', 'blocker reason', 'blocked reason'],
    filing_deadline: ['filing deadline', 'deadline', 'due date', 'due'],
    project_start_date: ['start date', 'project start'],
    efile_date: ['date filed', 'e-file date', 'efile date', 'e-filed', 'efiled', 'filed date'],
    extension_needed: ['extension needed?', 'extension needed', 'ext needed'],
    extension_filed: ['extension filed', 'extension filed?', 'ext filed', 'federal extension'],
    tax_advisor_email: ['tax advisor', 'advisor'],
    tax_preparer_email: ['tax preparer', 'preparer', 'assignee email', 'assignee'],
    peer_reviewer_email: ['peer reviewer', 'peer review', 'reviewer'],
    os_email: ['ob/dc assigned', 'onboarding specialist', 'os'],
    complexity: ['complexity'],
    states_covered: ['state(s)', 'states', 'states covered'],
    tax_risk_level: ['tax risk level', 'tax risk', 'risk'],
    billing_kind: ['billing status', 'billing', 'billing kind'],
    books_status: ['inha books', 'books for scope', 'books status'],
    source_ref: ['url', 'asana url', 'link'],
    __outstanding: ['outstanding request', 'outstanding requests', 'outstanding items'],
    __pro_email: ['email address', 'email'],
    __pro_first_name: ['pro first name', 'pro name'],
    '__note:Status notes': ['status notes'],
    '__note:Description': ['description'],
    '__note:Notes': ['notes'],
  },
};

var US_STATES = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE',
  'district of columbia': 'DC', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
  pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
  vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'puerto rico': 'PR',
};

/** "Texas, New Mexico" → "TX, NM"; unknown tokens are kept as typed. */
function normStates_(v) {
  return String(v).split(/[,;\/&]+|\band\b/i).map(function (t) {
    var k = t.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!k) return '';
    if (/^[a-z]{2}$/i.test(k)) return k.toUpperCase();
    return US_STATES[k] || t.trim();
  }).filter(Boolean).join(', ');
}

/** Asana project names carry the Org ID: "Atrium Air (485748)", "Monte Watson - 704324", "Legacy Flow_767459". */
function splitNameOrg_(name) {
  var s = String(name || '').replace(/\s+/g, ' ').trim();
  var m = s.match(/^(.*?)[\s_-]*\((\d{3,})[^)]*\)?\s*$/) || s.match(/^(.*?)\s*[-_–]\s*(\d{3,})\s*$/);
  if (m && m[1].trim()) return { name: m[1].trim(), org: m[2] };
  return { name: s, org: '' };
}

var PEOPLE_FIELDS = ['assigned_advisor_email', 'assigned_os_email', 'bk_lead_email', 'tax_advisor_email', 'tax_preparer_email', 'peer_reviewer_email', 'os_email'];

function parseCsv_(text) {
  var rows = [], row = [], field = '', q = false;
  text = String(text || '').replace(/^﻿/, '');
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(function (c) { return c !== ''; })) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some(function (c) { return c !== ''; })) rows.push(row);
  return rows;
}

function matchEnum_(value, keys, labels, extra) {
  var v = normLabel_(value).replace(/\s+/g, '');
  if (!v) return '';
  var i;
  for (i = 0; i < (extra || []).length; i++) if (extra[i][0].test(String(value))) return extra[i][1];
  for (i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (normLabel_(k).replace(/\s+/g, '') === v || normLabel_(labels[k] || '').replace(/\s+/g, '') === v) return k;
  }
  for (i = 0; i < keys.length; i++) {
    var lab = normLabel_(labels[keys[i]] || '').replace(/\s+/g, '');
    if (lab && (v.indexOf(lab) >= 0 || lab.indexOf(v) >= 0)) return keys[i];
  }
  return '';
}

var FILING_EXTRA = [
  [/1040\s*only|^1040$|individual/i, 'F1040'],
  [/1040|sched(ule)?\s*c|sch\s*c|sole/i, 'F1040_SCHC'], [/1120\s*-?\s*s\b|s\s*-?\s*corp/i, 'S_CORP'], [/1065|partner/i, 'PARTNERSHIP'],
  [/1120|c\s*-?\s*corp/i, 'C_CORP'], [/amend/i, 'AMENDMENT'],
];
var STAGE_EXTRA = [
  [/escalat/i, 'IN_QUEUE_ESCALATED'], [/waiting.*pro|\bwfp\b/i, 'WFP'], [/peer|qa|quality/i, 'QA'], [/doc/i, 'DOC_GATHERING'],
  [/prep/i, 'PREP'], [/client review/i, 'CLIENT_REVIEW'], [/filing|deliver|e-?file/i, 'FILING_DELIVERY'],
  [/complete|done|filed|accepted/i, 'COMPLETE'], [/block/i, 'BLOCKED'], [/queue|not started/i, 'IN_QUEUE'],
];
var LIFECYCLE_EXTRA = [
  [/closed.?won/i, 'CLOSED_WON'], [/schedul/i, 'ONBOARDING_SCHEDULED'], [/active return/i, 'ACTIVE_PROJECT'], [/pass.?back/i, 'PASS_BACK'],
  [/advisory/i, 'ADVISORY_ONLY'], [/active|in progress/i, 'ACTIVE_PROJECT'], [/onboarded|complete/i, 'ONBOARDED'],
];

var Migration = {
  parse: parseCsv_,

  mapHeaders: function (kind, header) {
    var aliases = IMPORT_ALIASES[kind];
    if (!aliases) throw new AppError('Unknown import type ' + kind);
    var map = {};
    var used = {};
    // exact alias match first, in alias priority order
    Object.keys(aliases).forEach(function (field) {
      for (var a = 0; a < aliases[field].length; a++) {
        for (var c = 0; c < header.length; c++) {
          if (used[c]) continue;
          if (normLabel_(header[c]) === normLabel_(aliases[field][a])) { map[field] = c; used[c] = true; return; }
        }
      }
    });
    return map;
  },

  normalize: function (kind, field, raw, roster) {
    var v = String(raw == null ? '' : raw).trim();
    if (!v) return null;
    if (PEOPLE_FIELDS.indexOf(field) >= 0) return Intake.matchPerson(v, roster) || null;
    switch (field) {
      case 'entity_type': return /multi.?member|llc.*partner/i.test(v) ? 'PARTNERSHIP' : (normEntity_(v) || null);
      case 'filing_type': return matchEnum_(v, ENUMS.FILING_TYPE, LABELS.FILING_TYPE, FILING_EXTRA) || null;
      case 'pipeline_status': return matchEnum_(v, ENUMS.PIPELINE_STATUS, LABELS.PIPELINE_STATUS, STAGE_EXTRA) || null;
      case 'lifecycle_status': return matchEnum_(v, ENUMS.LIFECYCLE_STATUS, LABELS.LIFECYCLE_STATUS, LIFECYCLE_EXTRA) || null;
      case 'doc_collection_status': return matchEnum_(v, ENUMS.DOC_COLLECTION_STATUS, LABELS.DOC_COLLECTION_STATUS) || null;
      case 'complexity': return /high/i.test(v) ? 'HIGH' : /med/i.test(v) ? 'MED' : /low/i.test(v) ? 'LOW' : null;
      case 'extension_filed': {
        // Asana stores the date the extension was filed; any date / yes means filed.
        var ef = normYesNo_(v);
        return ef != null ? ef : (/\d/.test(v) || /(filed|accepted)/i.test(v));
      }
      case 'at_risk': return /^(yes|y|true|detached)/i.test(v) ? true : /^(no|n|false)/i.test(v) ? false : null;
      case 'books_with_hcp': case 'extension_needed': {
        var b = normYesNo_(v);
        return b == null ? (/(filed|accepted|complete)/i.test(v) ? true : null) : b;
      }
      case 'year_started': case 'last_filing_year': case 'tax_year': return normYear_(v);
      case 'owner1_pct': case 'owner2_pct': return normPct_(v);
      case 'scope_start_date': case 'last_advisor_touchpoint': case 'filing_deadline':
      case 'project_start_date': case 'efile_date': return normDate_(v) || null;
      case 'state': return (US_STATES[v.toLowerCase()] || v).toUpperCase().slice(0, 2);
      case 'states_covered': return normStates_(v);
      case 'business_name': return splitNameOrg_(v).name;
      case 'time_zone': return normTz_(v);
      case 'org_id': return v.replace(/\.0+$/, '');
      default: return v;
    }
  },

  /** Build normalized records + a per-row plan. No writes. */
  plan: function (kind, csv) {
    var rows = parseCsv_(csv);
    if (rows.length < 2) throw new AppError('That CSV has no data rows.', 'VALIDATION');
    var header = rows[0].map(function (h) { return String(h).trim(); });
    var map = Migration.mapHeaders(kind, header);
    var roster = Identity.roster();
    var prosByName = {};
    Db.list('Pros').forEach(function (p) { prosByName[normLabel_(p.business_name)] = p.org_id; });
    var bySource = {};
    Db.list(kind === 'pros' ? 'Pros' : 'Projects').forEach(function (x) { if (x.source_ref) bySource[x.source_ref] = x; });
    var records = [];
    var errors = [];
    var seenOrg = {};
    for (var r = 1; r < rows.length; r++) {
      var rec = {};
      var notes = [];
      Object.keys(map).forEach(function (field) {
        var raw = rows[r][map[field]];
        var text = String(raw == null ? '' : raw).trim();
        if (!text) return;
        if (field.indexOf('__note:') === 0) { notes.push(field.slice(7) + ': ' + text); return; }
        if (field.indexOf('__') === 0) { rec[field] = text; return; }
        var val = Migration.normalize(kind, field, raw, roster);
        if (val != null && val !== '') rec[field] = val;
      });
      // Org ID + clean name from "Business (123456)" when needed
      var nameField = kind === 'pros' ? 'business_name' : '__business_name';
      var rawName = map[nameField] != null ? rows[r][map[nameField]] : '';
      var split = splitNameOrg_(rawName);
      if (kind === 'projects' && rec.__business_name) rec.__business_name = split.name;
      if (!rec.org_id && split.org) rec.org_id = split.org;
      if (rec.source_ref && !/^https?:/i.test(rec.source_ref)) delete rec.source_ref;

      var action;
      if (kind === 'pros') {
        if (rec.__inha) {
          rec.prior_books_status = rec.__inha;
          if (!('books_with_hcp' in rec)) rec.books_with_hcp = !/not with hcp/i.test(rec.__inha);
        }
        delete rec.__inha;
        if (rec.__scope_years) {
          var yrs = (rec.__scope_years.match(/(19|20)\d\d/g) || []).map(Number).sort();
          if (yrs.length && !rec.scope_start_date) rec.scope_start_date = yrs[0] + '-01-01';
          notes.push('Tax year scope: ' + rec.__scope_years);
        }
        delete rec.__scope_years;
        if (rec.at_risk && !rec.at_risk_reason) {
          var ar = map.at_risk != null ? String(rows[r][map.at_risk]).trim() : '';
          rec.at_risk_reason = /detached/i.test(ar) ? 'Detached' : 'Flagged at risk in Asana';
        }
        if (!rec.org_id) { errors.push('Row ' + (r + 1) + ' (' + (split.name || 'no name') + '): no Org ID'); continue; }
        if (!/^\d+$/.test(rec.org_id)) { errors.push('Row ' + (r + 1) + ': Org ID "' + rec.org_id + '" is not numeric'); continue; }
        if (seenOrg[rec.org_id]) { errors.push('Row ' + (r + 1) + ': Org ID ' + rec.org_id + ' appears twice in the file — kept row ' + seenOrg[rec.org_id]); continue; }
        seenOrg[rec.org_id] = r + 1;
        action = Db.get('Pros', rec.org_id) ? 'update' : 'create';
        if (action === 'create' && !rec.business_name) { errors.push('Row ' + (r + 1) + ': no business name for new pro ' + rec.org_id); continue; }
      } else {
        if (!rec.org_id && rec.__business_name) rec.org_id = prosByName[normLabel_(rec.__business_name)];
        if (!rec.org_id) { errors.push('Row ' + (r + 1) + ' (' + (split.name || 'no name') + '): no Org ID'); continue; }
        if (!rec.tax_year && rec.__year_end) rec.tax_year = normYear_(rec.__year_end);
        delete rec.__year_end;
        if (!rec.filing_type && rec.__business_name) rec.filing_type = 'UNKNOWN';
        rec.__create_pro = !Db.get('Pros', rec.org_id);
        var existing = rec.source_ref && bySource[rec.source_ref];
        if (!existing && !rec.project_id && !rec.source_ref) {
          existing = Db.where('Projects', function (p) {
            return p.org_id === rec.org_id && Number(p.tax_year) === Number(rec.tax_year) && p.filing_type === (rec.filing_type || p.filing_type);
          })[0];
        }
        if (existing) rec.project_id = existing.project_id;
        action = rec.project_id && Db.get('Projects', rec.project_id) ? 'update' : 'create';
        if (action === 'create' && (!rec.tax_year || !rec.filing_type)) {
          errors.push('Row ' + (r + 1) + ' (' + (split.name || rec.org_id) + '): needs a tax year and filing type'); continue;
        }
      }
      if (notes.length) rec.__notes = notes.join('\n');
      records.push({ row: r + 1, action: action, record: rec });
    }
    var mapped = Object.keys(map).map(function (f) { return { field: f.replace(/^__(note:)?/, ''), column: header[map[f]] }; });
    var unmapped = header.filter(function (h, i) { return Object.keys(map).every(function (f) { return map[f] !== i; }); });
    return { kind: kind, mapped: mapped, unmapped: unmapped, records: records, errors: errors };
  },

  preview: function (kind, csv) {
    var p = Migration.plan(kind, csv);
    return {
      kind: kind, mapped: p.mapped, unmapped: p.unmapped, errors: p.errors.slice(0, 50), error_count: p.errors.length,
      creates: p.records.filter(function (r) { return r.action === 'create'; }).length,
      updates: p.records.filter(function (r) { return r.action === 'update'; }).length,
      sample: p.records.slice(0, 8),
    };
  },

  /** Apply in batches; returns counts. Call repeatedly with next_offset until it is null. */
  apply: function (kind, csv, opts) {
    opts = opts || {};
    Setup.ensureTabs(Db.spreadsheet()); // add any new columns (e.g. source_ref) before writing
    Db.clearCache();
    var p = Migration.plan(kind, csv);
    var start = opts.offset || 0;
    var budgetMs = 240000; // stay under the 6-minute execution limit
    var t0 = Date.now();
    var done = { created: 0, updated: 0, tasks: 0, items: 0, pros_created: 0, errors: start ? [] : p.errors.slice(), next_offset: null, processed: start, total: p.records.length };
    for (var i = start; i < p.records.length; i++) {
      if (Date.now() - t0 > budgetMs) { done.next_offset = i; break; }
      var item = p.records[i];
      var rec = item.record;
      var notes = rec.__notes;
      var outstanding = rec.__outstanding;
      var createPro = rec.__create_pro;
      var proInfo = { name: rec.__business_name, email: rec.__pro_email, first: rec.__pro_first_name };
      Object.keys(rec).forEach(function (k) { if (k.indexOf('__') === 0) delete rec[k]; });
      try {
        if (kind === 'pros') {
          if (item.action === 'create') { Pros.create(Object.assign({ auto_assign: opts.autoAssign === true }, rec)); done.created++; }
          else { Pros.update(rec.org_id, rec); done.updated++; }
          if (notes && item.action === 'create') Notes.add('PRO', rec.org_id, notes, 'asana-import');
        } else {
          if (createPro && !Db.get('Pros', rec.org_id)) {
            Pros.create({
              org_id: rec.org_id, business_name: proInfo.name || ('Org ' + rec.org_id), lifecycle_status: 'ACTIVE_PROJECT',
              assigned_advisor_email: rec.tax_advisor_email || '', assigned_os_email: rec.os_email || '',
              owner1_name: proInfo.first || '', owner1_email: proInfo.email || '', auto_assign: false,
            });
            done.pros_created++;
          }
          var pid;
          if (item.action === 'create') {
            var complete = rec.pipeline_status === 'COMPLETE';
            var res = Projects.create(rec, {
              // finished returns don't need a task list; open ones get templates with earlier sections done
              materialize: opts.materialize !== false && !complete,
              completeBeforeStage: rec.pipeline_status || 'IN_QUEUE',
              bumpLifecycle: false,
              noDefaults: true,
            });
            pid = res.project.project_id;
            done.created++;
            done.tasks += res.tasks.length;
            if (notes) Notes.add('PROJECT', pid, notes, 'asana-import');
            if (outstanding && !complete) {
              String(outstanding).split(/\s*[,;\n]\s*/).filter(Boolean).forEach(function (it) {
                Outstanding.add({ project_id: pid, item: it, owner_email: rec.os_email || '' });
                done.items++;
              });
            }
          } else {
            Projects.update(rec.project_id, rec);
            done.updated++;
          }
        }
      } catch (e) {
        done.errors.push('Row ' + item.row + ': ' + (e.message || e));
      }
      done.processed = i + 1;
    }
    Audit.log('IMPORT', kind, 'Imported CSV', 'rows', '', done.created + ' created, ' + done.updated + ' updated (rows ' + (start + 1) + '–' + done.processed + ')');
    return done;
  },
};
