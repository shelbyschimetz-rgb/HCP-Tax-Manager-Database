/**
 * Salesforce "New Tax Onboarding Cases" feed → Pros + Inbox.
 *
 * Source sheet (refreshed every 4h by the SFDC export) columns, by header:
 *   Account Name | Case Owner | Org ID | Case Number | Service Time (Days) |
 *   Sub-Status Notes | Created Date | Case Record Type | Date/Time Closed
 *
 * Every row with Case Record Type = "Tax Onboarding" and an Org ID we have not
 * seen creates a Pro (deduped on Org ID) plus an Inbox queue row. The OS then
 * claims it from the Inbox to start onboarding — auto-create never starts it.
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

function cellStr_(v) {
  if (v == null) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v).trim();
}

var Sfdc = {
  /** Parse source rows (2D array incl. header) into normalized case objects. */
  parse: function (values) {
    if (!values || values.length < 2) return [];
    var idx = headerIndex_(values[0], SFDC_HEADERS);
    if (idx.org_id == null) throw new AppError('SFDC source sheet has no "Org ID" column.');
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
        created_date: get('created_date').slice(0, 10),
        record_type: get('record_type'),
        date_closed: get('date_closed'),
      });
    }
    return out;
  },

  /** Apply parsed cases. Returns a summary; safe to run repeatedly. */
  apply: function (cases) {
    var summary = { scanned: cases.length, skipped_type: 0, existing: 0, created: 0, flagged_os: 0, created_ids: [] };
    cases.forEach(function (c) {
      if (c.record_type && !/tax onboarding/i.test(c.record_type)) { summary.skipped_type++; return; }
      if (Db.get('Pros', c.org_id)) { summary.existing++; return; }
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
    });
    return summary;
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
    Db.update('SfdcIntakeQueue', qid, { state: 'CLAIMED', claimed_by: me, claimed_at: nowIso_() });
    var pro = Db.get('Pros', q.org_id);
    if (!pro) throw new AppError('Pro ' + q.org_id + ' is missing — was it deleted?', 'NOT_FOUND');
    var patch = { onboarding_claimed_by: me, onboarding_claimed_at: nowIso_() };
    if (pro.lifecycle_status === 'CLOSED_WON') patch.lifecycle_status = 'ONBOARDING_SCHEDULED';
    if (!pro.assigned_os_email) { patch.assigned_os_email = me; patch.needs_os_assignment = false; }
    pro = Db.update('Pros', q.org_id, patch);
    Audit.log('PRO', pro.org_id, 'Claimed from inbox', 'onboarding_claimed_by', '', me);
    if (patch.lifecycle_status) Audit.log('PRO', pro.org_id, 'Transitioned lifecycle', 'lifecycle_status', 'CLOSED_WON', patch.lifecycle_status);
    var tasks = Tasks.materialize('PRO', pro);
    return { pro: pro, tasks: tasks };
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
    var next = Db.update('Pros', orgId, { drive_folder_id: folder.getId(), drive_folder_url: folder.getUrl() });
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
