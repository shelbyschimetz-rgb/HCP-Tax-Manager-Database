/**
 * Salesforce "New Tax Onboarding Cases" feed → Pros + Inbox.
 *
 * Source sheet (refreshed every 4h by the SFDC export) columns, by header:
 *   Account Name | Case Owner | Org ID | Case Number | Service Time (Days) |
 *   Sub-Status Notes | Created Date | Case Record Type | Date/Time Closed
 *
 * Every row with Case Record Type = "Tax Onboarding", a Created Date in the
 * current calendar year or later, and an Org ID we have not seen creates a Pro
 * (deduped on Org ID) plus an Inbox queue row. The OS then claims it from the
 * Inbox to start onboarding — auto-create never starts it. Older cases are
 * history, not new work, so they are skipped (the cutoff rolls every Jan 1).
 */

var SFDC_HEADERS = {
  business_name: ['account name', 'account'],
  case_owner: ['case owner', 'owner'],
  org_id: ['org id', 'orgid', 'organization id'],
  case_number: ['case number', 'case #', 'case'],
  service_days: ['service time (days)', 'service time', 'service days'],
  notes: ['sub-status notes', 'sub status notes', 'notes'],
  created_date: ['created date', 'created'],
  record_type: ['case record type', 'record type'],
  date_closed: ['date/time closed', 'date closed', 'closed'],
};

function headerIndex_(headerRow, spec) {
  var norm = headerRow.map(function (h) { return String(h).trim().toLowerCase(); });
  var idx = {};
  Object.keys(spec).forEach(function (field) {
    for (var i = 0; i < spec[field].length; i++) {
      var at = norm.indexOf(spec[field][i]);
      if (at >= 0) { idx[field] = at; return; }
    }
  });
  return idx;
}

function pad2_(n) { return ('0' + n).slice(-2); }

/** Salesforce date cell → YYYY-MM-DD, or '' if it isn't a recognizable date. */
function caseDate_(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var s = String(v).trim();
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + pad2_(m[2]) + '-' + pad2_(m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?!\d)/);
  if (m) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + pad2_(m[1]) + '-' + pad2_(m[2]);
  return '';
}

/** Calendar year of a case date (any format caseDate_ reads, or a bare 4-digit year), else null. */
function caseYear_(v) {
  var d = caseDate_(v);
  if (d) return Number(d.slice(0, 4));
  var m = String(v == null ? '' : v).match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : null;
}

function cellStr_(v) {
  if (v == null) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v).trim();
}

var Sfdc = {
  /** Cases created before Jan 1 of this year are skipped by the sync. */
  firstYear: function () { return Number(todayIso_().slice(0, 4)); },

  /** Parse source rows (2D array incl. header) into normalized case objects. */
  parse: function (values) {
    if (!values || values.length < 2) return [];
    var idx = headerIndex_(values[0], SFDC_HEADERS);
    if (idx.org_id == null) throw new AppError('SFDC source sheet has no "Org ID" column.');
    if (idx.created_date == null) {
      throw new AppError('SFDC source sheet has no "Created Date" column. Tax Manager needs it to skip cases from before ' + Sfdc.firstYear() + '.');
    }
    var out = [];
    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      var get = function (f) { return idx[f] == null ? '' : cellStr_(row[idx[f]]); };
      var orgId = get('org_id').replace(/\.0+$/, '');
      if (!orgId) continue;
      out.push({
        org_id: orgId,
        business_name: get('business_name'),
        case_owner: get('case_owner'),
        case_number: get('case_number').replace(/\.0+$/, ''),
        service_days: Number(get('service_days')) || null,
        notes: get('notes'),
        created_date: caseDate_(get('created_date')) || get('created_date'),
        record_type: get('record_type'),
        date_closed: get('date_closed'),
      });
    }
    return out;
  },

  /** Apply parsed cases. Returns a summary; safe to run repeatedly. */
  apply: function (cases) {
    var minYear = Sfdc.firstYear();
    var summary = {
      scanned: cases.length, skipped_type: 0, skipped_old: 0, existing: 0, created: 0, flagged_os: 0,
      created_ids: [], errors: [], deferred: 0, cutoff: minYear + '-01-01',
    };
    var t0 = Date.now();
    var BUDGET_MS = 240000; // leave headroom under the 6-minute limit; the rest go next run
    cases.forEach(function (c) {
      if (c.record_type && !/tax onboarding/i.test(c.record_type)) { summary.skipped_type++; return; }
      var yr = caseYear_(c.created_date);
      if (yr && yr < minYear) { summary.skipped_old++; return; }
      if (Db.get('Pros', c.org_id)) { summary.existing++; return; }
      if (Date.now() - t0 > BUDGET_MS) { summary.deferred++; return; }
      try {
        Sfdc.createFromCase(c, summary);
      } catch (e) {
        summary.errors.push('Org ' + c.org_id + ' (' + (c.business_name || 'no name') + '): ' + (e.message || e));
      }
    });
    return summary;
  },

  /** Create one pro + inbox row from a Salesforce case (throws on bad data; apply() catches). */
  createFromCase: function (c, summary) {
    var os = Identity.resolveCaseOwner(c.case_owner);
    var pro = Pros.create({
      org_id: c.org_id,
      business_name: c.business_name || ('Org ' + c.org_id),
      assigned_os_email: os,
      needs_os_assignment: !os,
      sfdc_case_number: c.case_number,
      lifecycle_status: 'CLOSED_WON',
    });
    if (!os) summary.flagged_os++;
    if (c.notes) Notes.add('PRO', pro.org_id, c.notes, 'salesforce');
    var qid = c.case_number || ('ORG-' + c.org_id);
    if (!Db.get('SfdcIntakeQueue', qid)) {
      Db.insert('SfdcIntakeQueue', {
        sfdc_opportunity_id: qid, org_id: c.org_id, business_name: pro.business_name, case_owner: c.case_owner,
        resolved_os_email: os, service_days: c.service_days, sub_status_notes: c.notes, created_date: c.created_date,
        date_closed: c.date_closed, case_record_type: c.record_type, state: 'NEW', imported_at: nowIso_(),
      });
    }
    try { Folders.provisionFolder(pro.org_id); } catch (e) { /* Drive not configured yet — OS can provision in the wizard */ }
    summary.created++;
    summary.created_ids.push(c.org_id);
  },

  /** Entry point for the 4-hour trigger and the "Sync now" button. */
  sync: function () {
    var id = getProp_(PROP.SFDC_SHEET_ID);
    if (!id) throw new AppError('Set the Salesforce source sheet in Settings first.', 'NOT_CONFIGURED');
    var ss = SpreadsheetApp.openById(id);
    var tab = getProp_(PROP.SFDC_TAB);
    var sh = tab ? ss.getSheetByName(tab) : ss.getSheets()[0];
    if (!sh) throw new AppError('Tab "' + tab + '" not found in the Salesforce source sheet.');
    var summary = Sfdc.apply(Sfdc.parse(sh.getDataRange().getValues()));
    setProp_(PROP.LAST_SFDC_SYNC, nowIso_());
    setProp_(PROP.LAST_SFDC_RESULT, JSON.stringify(summary));
    return summary;
  },

  inbox: function () {
    return Db.where('SfdcIntakeQueue', function (q) { return q.state === 'NEW'; })
      .sort(function (a, b) { return (a.imported_at || '') < (b.imported_at || '') ? 1 : -1; });
  },

  recentlyClaimed: function () {
    return Db.where('SfdcIntakeQueue', function (q) { return q.state === 'CLAIMED'; })
      .sort(function (a, b) { return (a.claimed_at || '') < (b.claimed_at || '') ? 1 : -1; })
      .slice(0, 25);
  },

  /** OS claims a case: queue → CLAIMED, pro → ONBOARDING_SCHEDULED, pro tasks materialized. */
  claim: function (qid) {
    var q = Db.get('SfdcIntakeQueue', qid);
    if (!q) throw new AppError('That inbox item no longer exists.', 'NOT_FOUND');
    if (q.state === 'CLAIMED') throw new AppError('Already claimed by ' + q.claimed_by + '.', 'CONFLICT');
    var me = Identity.currentEmail();
    var pro = Db.get('Pros', q.org_id);
    if (!pro) throw new AppError('Pro ' + q.org_id + ' is missing — was it deleted?', 'NOT_FOUND');
    Db.update('SfdcIntakeQueue', qid, { state: 'CLAIMED', claimed_by: me, claimed_at: nowIso_() });
    var patch = { onboarding_claimed_by: me, onboarding_claimed_at: nowIso_() };
    if (pro.lifecycle_status === 'CLOSED_WON') patch.lifecycle_status = 'ONBOARDING_SCHEDULED';
    if (!pro.assigned_os_email) { patch.assigned_os_email = me; patch.needs_os_assignment = false; }
    pro = Db.update('Pros', q.org_id, patch);
    Audit.log('PRO', pro.org_id, 'Claimed from inbox', 'onboarding_claimed_by', '', me);
    if (patch.lifecycle_status) Audit.log('PRO', pro.org_id, 'Transitioned lifecycle', 'lifecycle_status', 'CLOSED_WON', patch.lifecycle_status);
    var tasks = Tasks.materialize('PRO', pro);
    return { pro: pro, tasks: tasks };
  },

  /**
   * Unclaimed Inbox cases created before this year (pulled in before the
   * sync skipped them). Pros nobody has touched are removed with their empty
   * Drive folder; pros with any real work stay and just leave the Inbox.
   */
  cleanupPlan: function () {
    var minYear = Sfdc.firstYear();
    var old = Db.where('SfdcIntakeQueue', function (q) {
      var y = caseYear_(q.created_date);
      return q.state === 'NEW' && y && y < minYear;
    });
    var has = { project: {}, task: {}, note: {}, answer: {} };
    Db.list('Projects').forEach(function (p) { has.project[p.org_id] = true; });
    Db.list('Tasks').forEach(function (t) { if (t.entity_type === 'PRO') has.task[t.entity_id] = true; });
    Db.list('Notes').forEach(function (n) { if (n.entity_type === 'PRO' && !n.deleted && n.author_email !== 'salesforce') has.note[n.entity_id] = true; });
    Db.list('IntakeAnswers').forEach(function (a) { has.answer[a.org_id] = true; });
    var remove = [], keep = [];
    old.forEach(function (q) {
      var p = Db.get('Pros', q.org_id);
      var why = !p ? ''
        : p.source_ref ? 'imported from Asana'
        : has.project[p.org_id] ? 'has a tax return'
        : has.task[p.org_id] ? 'has tasks'
        : has.note[p.org_id] ? 'has notes'
        : has.answer[p.org_id] ? 'has intake answers'
        : p.onboarding_claimed_by ? 'onboarding was started'
        : Number(p.row_version || 1) > 1 ? 'edited in Tax Manager'
        : '';
      var row = {
        id: q.sfdc_opportunity_id, org_id: q.org_id, business_name: q.business_name, created_date: q.created_date,
        has_pro: !!p, folder_id: p ? p.drive_folder_id || '' : '', reason: why,
      };
      (why ? keep : remove).push(row);
    });
    return { before: minYear + '-01-01', remove: remove, keep: keep };
  },

  cleanupOld: function () {
    var plan = Sfdc.cleanupPlan();
    var t0 = Date.now();
    var BUDGET_MS = 200000; // Drive calls are the slow part; the rest go on the next click
    var removed = [], deferred = 0, trashed = 0;
    var keep = plan.keep.slice();
    plan.remove.forEach(function (r) {
      if (Date.now() - t0 > BUDGET_MS) { deferred++; return; }
      if (r.folder_id) {
        try {
          var f = DriveApp.getFolderById(r.folder_id);
          if (f.getFiles().hasNext() || f.getFolders().hasNext()) {
            keep.push({ id: r.id, org_id: r.org_id, business_name: r.business_name, reason: 'Drive folder has files' });
            return;
          }
          f.setTrashed(true);
          trashed++;
        } catch (e) { /* folder already gone or not shared with the deployer */ }
      }
      removed.push(r);
    });
    var orgs = {};
    removed.forEach(function (r) { if (r.has_pro) orgs[r.org_id] = true; });
    var noteIds = Db.where('Notes', function (n) { return n.entity_type === 'PRO' && n.author_email === 'salesforce' && orgs[n.entity_id]; })
      .map(function (n) { return n.note_id; });
    Db.removeMany('Notes', noteIds);
    var prosRemoved = Db.removeMany('Pros', Object.keys(orgs));
    Db.removeMany('SfdcIntakeQueue', removed.map(function (r) { return r.id; }));
    var me = Identity.currentEmail();
    keep.forEach(function (k) {
      if (Db.get('SfdcIntakeQueue', k.id)) Db.update('SfdcIntakeQueue', k.id, { state: 'DISMISSED', dismissed_by: me, dismissed_at: nowIso_() });
    });
    Audit.log('SYSTEM', 'sfdc', 'Removed Salesforce cases created before ' + plan.before, 'inbox', '',
      removed.length + ' removed, ' + keep.length + ' dismissed');
    return {
      before: plan.before, removed: removed.length, pros_removed: prosRemoved, folders_trashed: trashed,
      dismissed: keep.length, kept: keep, deferred: deferred,
    };
  },

  dismiss: function (qid) {
    var q = Db.get('SfdcIntakeQueue', qid);
    if (!q) return null;
    Audit.log('PRO', q.org_id, 'Dismissed from inbox', 'inbox', 'NEW', 'DISMISSED');
    return Db.update('SfdcIntakeQueue', qid, { state: 'DISMISSED', dismissed_by: Identity.currentEmail(), dismissed_at: nowIso_() });
  },
};

/* ---------------- Drive folders ---------------- */

var Folders = {
  folderName: function (pro) {
    return pro.business_name + ' (' + pro.org_id + ')-TAX';
  },

  /** Idempotent: re-running with the folder present is a no-op. */
  provisionFolder: function (orgId) {
    var pro = Db.get('Pros', orgId);
    if (!pro) throw new AppError('Pro not found.', 'NOT_FOUND');
    if (pro.drive_folder_id) {
      try {
        var f = DriveApp.getFolderById(pro.drive_folder_id);
        if (f && !f.isTrashed()) return { pro: pro, created: false, url: pro.drive_folder_url };
      } catch (e) { /* fall through and recreate */ }
    }
    var parentId = getProp_(PROP.DRIVE_PARENT);
    if (!parentId) throw new AppError('Set the parent Drive folder (HCP Tax Shared Drive / client data) in Settings first.', 'NOT_CONFIGURED');
    var parent = DriveApp.getFolderById(parentId);
    var name = Folders.folderName(pro);
    var existing = parent.getFoldersByName(name);
    var folder = existing.hasNext() ? existing.next() : parent.createFolder(name);
    var next = Db.update('Pros', orgId, { drive_folder_id: folder.getId(), drive_folder_url: folder.getUrl() }, null, { system: true });
    Audit.log('PRO', orgId, 'Provisioned Drive folder', 'drive_folder_id', '', folder.getId());
    return { pro: next, created: true, url: folder.getUrl() };
  },

  /** Save a base64 file into the pro's folder (creating it if needed). */
  saveFile: function (orgId, filename, mimeType, base64) {
    var res = Folders.provisionFolder(orgId);
    var folder = DriveApp.getFolderById(res.pro.drive_folder_id);
    var blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, filename);
    return folder.createFile(blob);
  },
};
