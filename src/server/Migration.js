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

var IMPORT_ALIASES = {
  pros: {
    org_id: ['org id', 'orgid', 'org', 'organization id'],
    business_name: ['business name', 'business', 'account name', 'name', 'task name', 'pro'],
    dba: ['dba', 'doing business as'],
    vertical: ['vertical', 'industry', 'trade'],
    state: ['state'],
    time_zone: ['time zone', 'timezone', 'tz'],
    year_started: ['year started', 'year business started'],
    scope_start_date: ['scope start', 'scope start date'],
    entity_type: ['entity type', 'entity'],
    lifecycle_status: ['lifecycle', 'lifecycle status', 'status', 'section/column', 'section'],
    assigned_advisor_email: ['advisor', 'tax advisor', 'assigned advisor'],
    assigned_os_email: ['os', 'onboarding specialist', 'case owner'],
    bk_lead_email: ['bk lead', 'bookkeeper', 'bk'],
    payroll_servicer: ['payroll', 'payroll servicer', 'payroll provider'],
    owner1_name: ['owner 1', 'owner', 'primary owner', 'owner 1 name'],
    owner1_pct: ['owner 1 %', 'owner 1 pct', 'owner %'],
    owner2_name: ['owner 2', 'owner 2 name'],
    owner2_pct: ['owner 2 %', 'owner 2 pct'],
    doc_collection_status: ['docs', 'doc collection', 'doc collection status'],
    books_with_hcp: ['books with hcp', 'inha', 'books w/ hcp'],
    prior_books_status: ['prior books', 'prior books status'],
    at_risk: ['at risk', 'at risk?'],
    at_risk_reason: ['at risk reason', 'risk reason'],
    last_advisor_touchpoint: ['last touch', 'last advisor touchpoint', 'last touchpoint'],
    last_filing_year: ['last filed', 'last filing year', 'last tax filing year'],
    sfdc_case_number: ['case number', 'sfdc case'],
    __notes: ['notes', 'misc notes', 'miscellaneous notes', 'description'],
  },
  projects: {
    project_id: ['project id'],
    org_id: ['org id', 'orgid', 'org'],
    __business_name: ['business name', 'business', 'account name', 'name', 'task name', 'pro'],
    filing_type: ['filing type', 'return type', 'form'],
    tax_year: ['tax year', 'ty', 'year'],
    pipeline_status: ['return stage', 'stage', 'pipeline status', 'pipeline', 'section/column', 'section', 'status'],
    blocker_reason: ['blocker', 'blocker reason', 'blocked reason'],
    filing_deadline: ['deadline', 'filing deadline', 'due date', 'due'],
    project_start_date: ['start date', 'project start'],
    efile_date: ['e-file date', 'efile date', 'e-filed', 'efiled', 'filed date', 'completed at'],
    extension_needed: ['extension needed?', 'extension needed', 'ext needed'],
    extension_filed: ['extension filed?', 'extension filed', 'ext filed', 'federal extension'],
    tax_advisor_email: ['advisor', 'tax advisor'],
    tax_preparer_email: ['preparer', 'tax preparer', 'assignee email', 'assignee'],
    peer_reviewer_email: ['peer reviewer', 'peer review', 'reviewer'],
    os_email: ['os', 'onboarding specialist'],
    complexity: ['complexity'],
    states_covered: ['states', 'states covered'],
    tax_risk_level: ['tax risk', 'tax risk level', 'risk'],
    billing_kind: ['billing', 'billing kind'],
    __notes: ['notes', 'description'],
  },
};

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
  [/1040|sched(ule)?\s*c|sole/i, 'F1040_SCHC'], [/1120\s*-?\s*s\b|s\s*-?\s*corp/i, 'S_CORP'], [/1065|partner/i, 'PARTNERSHIP'],
  [/1120|c\s*-?\s*corp/i, 'C_CORP'], [/amend/i, 'AMENDMENT'],
];
var STAGE_EXTRA = [
  [/escalat/i, 'IN_QUEUE_ESCALATED'], [/waiting.*pro|\bwfp\b/i, 'WFP'], [/peer|qa|quality/i, 'QA'], [/doc/i, 'DOC_GATHERING'],
  [/prep/i, 'PREP'], [/client review/i, 'CLIENT_REVIEW'], [/filing|deliver|e-?file/i, 'FILING_DELIVERY'],
  [/complete|done|filed|accepted/i, 'COMPLETE'], [/block/i, 'BLOCKED'], [/queue|not started/i, 'IN_QUEUE'],
];
var LIFECYCLE_EXTRA = [
  [/closed.?won/i, 'CLOSED_WON'], [/schedul/i, 'ONBOARDING_SCHEDULED'], [/pass.?back/i, 'PASS_BACK'],
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
      case 'entity_type': return normEntity_(v) || null;
      case 'filing_type': return matchEnum_(v, ENUMS.FILING_TYPE, LABELS.FILING_TYPE, FILING_EXTRA) || null;
      case 'pipeline_status': return matchEnum_(v, ENUMS.PIPELINE_STATUS, LABELS.PIPELINE_STATUS, STAGE_EXTRA) || null;
      case 'lifecycle_status': return matchEnum_(v, ENUMS.LIFECYCLE_STATUS, LABELS.LIFECYCLE_STATUS, LIFECYCLE_EXTRA) || null;
      case 'doc_collection_status': return matchEnum_(v, ENUMS.DOC_COLLECTION_STATUS, LABELS.DOC_COLLECTION_STATUS) || null;
      case 'complexity': return /high/i.test(v) ? 'HIGH' : /med/i.test(v) ? 'MED' : /low/i.test(v) ? 'LOW' : null;
      case 'books_with_hcp': case 'at_risk': case 'extension_needed': case 'extension_filed': {
        var b = normYesNo_(v);
        return b == null ? (/(filed|accepted|complete)/i.test(v) ? true : null) : b;
      }
      case 'year_started': case 'last_filing_year': case 'tax_year': return normYear_(v);
      case 'owner1_pct': case 'owner2_pct': return normPct_(v);
      case 'scope_start_date': case 'last_advisor_touchpoint': case 'filing_deadline':
      case 'project_start_date': case 'efile_date': return normDate_(v) || null;
      case 'state': return v.toUpperCase().slice(0, 2);
      case 'time_zone': return normTz_(v);
      case 'org_id': return v.replace(/\.0+$/, '');
      default: return v;
    }
  },

  /** Build normalized records + a per-row plan. No writes. */
  plan: function (kind, csv) {
    var rows = parseCsv_(csv);
    if (rows.length < 2) throw new AppError('That CSV has no data rows.', 'VALIDATION');
    var header = rows[0];
    var map = Migration.mapHeaders(kind, header);
    var roster = Identity.roster();
    var prosByName = {};
    Db.list('Pros').forEach(function (p) { prosByName[normLabel_(p.business_name)] = p.org_id; });
    var records = [];
    var errors = [];
    for (var r = 1; r < rows.length; r++) {
      var rec = {};
      Object.keys(map).forEach(function (field) {
        var val = Migration.normalize(kind, field, rows[r][map[field]], roster);
        if (val != null && val !== '') rec[field] = val;
      });
      var action;
      if (kind === 'pros') {
        if (!rec.org_id) { errors.push('Row ' + (r + 1) + ': no Org ID'); continue; }
        action = Db.get('Pros', rec.org_id) ? 'update' : 'create';
        if (action === 'create' && !rec.business_name) { errors.push('Row ' + (r + 1) + ': no business name for new pro ' + rec.org_id); continue; }
      } else {
        if (!rec.org_id && rec.__business_name) rec.org_id = prosByName[normLabel_(rec.__business_name)];
        if (!rec.org_id) { errors.push('Row ' + (r + 1) + ': no Org ID (and business name didn\'t match a pro)'); continue; }
        if (!Db.get('Pros', rec.org_id)) { errors.push('Row ' + (r + 1) + ': pro ' + rec.org_id + ' does not exist — import pros first'); continue; }
        if (!rec.project_id) {
          var match = Db.where('Projects', function (p) {
            return p.org_id === rec.org_id && Number(p.tax_year) === Number(rec.tax_year) && p.filing_type === (rec.filing_type || p.filing_type);
          })[0];
          if (match) rec.project_id = match.project_id;
        }
        action = rec.project_id && Db.get('Projects', rec.project_id) ? 'update' : 'create';
        if (action === 'create' && (!rec.tax_year || !rec.filing_type)) {
          errors.push('Row ' + (r + 1) + ': new project for ' + rec.org_id + ' needs a tax year and filing type'); continue;
        }
      }
      records.push({ row: r + 1, action: action, record: rec });
    }
    var mapped = Object.keys(map).map(function (f) { return { field: f.replace(/^__/, ''), column: header[map[f]] }; });
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

  /** Apply in batches; returns counts. Call repeatedly with offset for very large files. */
  apply: function (kind, csv, opts) {
    opts = opts || {};
    var p = Migration.plan(kind, csv);
    var start = opts.offset || 0;
    var budgetMs = 240000; // stay under the 6-minute execution limit
    var t0 = Date.now();
    var done = { created: 0, updated: 0, tasks: 0, errors: p.errors.slice(), next_offset: null };
    for (var i = start; i < p.records.length; i++) {
      if (Date.now() - t0 > budgetMs) { done.next_offset = i; break; }
      var item = p.records[i];
      var rec = item.record;
      var notes = rec.__notes;
      delete rec.__notes;
      delete rec.__business_name;
      try {
        if (kind === 'pros') {
          if (item.action === 'create') { Pros.create(Object.assign({ auto_assign: !rec.assigned_advisor_email && opts.autoAssign !== false }, rec)); done.created++; }
          else { Pros.update(rec.org_id, rec); done.updated++; }
          if (notes) Notes.add('PRO', rec.org_id, notes, 'asana-import');
        } else {
          if (item.action === 'create') {
            var res = Projects.create(rec, {
              materialize: opts.materialize !== false,
              completeBeforeStage: rec.pipeline_status || 'IN_QUEUE',
              bumpLifecycle: true,
            });
            done.created++;
            done.tasks += res.tasks.length;
            if (notes) Notes.add('PROJECT', res.project.project_id, notes, 'asana-import');
          } else {
            Projects.update(rec.project_id, rec);
            done.updated++;
            if (notes) Notes.add('PROJECT', rec.project_id, notes, 'asana-import');
          }
        }
      } catch (e) {
        done.errors.push('Row ' + item.row + ': ' + (e.message || e));
      }
    }
    Audit.log('IMPORT', kind, 'Imported CSV', 'rows', '', done.created + ' created, ' + done.updated + ' updated');
    return done;
  },
};
