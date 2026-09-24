/**
 * Templates — master task lists that materialize onto new pros / projects.
 *
 * Edits apply to the next materialization. "Publish version" snapshots the
 * current set into TemplateVersions so the team has a change history; each
 * materialized task records the version it came from.
 */

var Templates = (function () {

  function all(scope) {
    return Db.where('TaskTemplates', function (t) { return !scope || t.scope === scope; })
      .sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
  }

  function active(scope) {
    return all(scope).filter(function (t) { return t.active; });
  }

  function versions(scope) {
    return Db.where('TemplateVersions', function (v) { return v.scope === scope; })
      .sort(function (a, b) { return b.version - a.version; })
      .map(function (v) {
        return { version_id: v.version_id, version: v.version, note: v.note, task_count: v.task_count, created_at: v.created_at, created_by: v.created_by };
      });
  }

  function currentVersion(scope) {
    var v = versions(scope);
    return v.length ? v[0].version : 0;
  }

  function publish(scope, note) {
    var rows = active(scope);
    var version = currentVersion(scope) + 1;
    Db.insert('TemplateVersions', {
      version_id: uid_('V'), scope: scope, version: version, note: note || '',
      task_count: rows.length, created_at: nowIso_(), created_by: Identity.currentEmail(),
      snapshot: rows.map(function (r) {
        return { template_id: r.template_id, section: r.section, title: r.title, default_role: r.default_role, due_anchor: r.due_anchor, offset_days: r.offset_days };
      }),
    });
    Audit.log('TEMPLATE', scope, 'Published template version', 'version', version - 1, version);
    return version;
  }

  var FIELDS = ['section', 'title', 'default_role', 'due_anchor', 'offset_days', 'active', 'sort_order', 'checklist', 'filing_types', 'parent_template_id', 'blocked_by_template_ids'];

  function save(t) {
    if (t.scope !== 'PRO' && t.scope !== 'PROJECT') throw new AppError('Template scope must be PRO or PROJECT.');
    if (!t.title || !String(t.title).trim()) throw new AppError('Template task needs a title.');
    var clean = {};
    FIELDS.forEach(function (k) { if (k in t) clean[k] = t[k]; });
    if (typeof clean.checklist === 'string') {
      clean.checklist = clean.checklist.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    }
    if (t.template_id && Db.get('TaskTemplates', t.template_id)) {
      var before = Db.get('TaskTemplates', t.template_id);
      var next = Db.update('TaskTemplates', t.template_id, clean);
      Audit.diff('TEMPLATE', t.template_id, before, next, ['title', 'section', 'default_role', 'due_anchor', 'offset_days', 'active']);
      return next;
    }
    var peers = all(t.scope);
    clean.template_id = uid_('TT');
    clean.scope = t.scope;
    if (clean.active == null) clean.active = true;
    if (clean.sort_order == null) {
      var inSec = peers.filter(function (p) { return p.section === clean.section; });
      clean.sort_order = inSec.length ? inSec[inSec.length - 1].sort_order + 0.5 : peers.length;
    }
    var row = Db.insert('TaskTemplates', clean);
    Audit.log('TEMPLATE', row.template_id, 'Created template task', 'title', '', row.title);
    return row;
  }

  function remove(id) {
    var t = Db.get('TaskTemplates', id);
    if (!t) return false;
    Db.remove('TaskTemplates', id);
    Audit.log('TEMPLATE', id, 'Deleted template task', 'title', t.title, '');
    return true;
  }

  /** Persist a new order: ids in display order. */
  function reorder(scope, ids) {
    ids.forEach(function (id, i) {
      var t = Db.get('TaskTemplates', id);
      if (t && t.scope === scope && t.sort_order !== i) Db.update('TaskTemplates', id, { sort_order: i });
    });
    return all(scope);
  }

  /** What would be created on a record right now (no writes). */
  function preview(scope, filingType) {
    return active(scope).filter(function (tp) {
      return scope !== 'PROJECT' || !tp.filing_types || String(tp.filing_types).split(/[,\s]+/).indexOf(filingType) >= 0;
    });
  }

  /* ---------------- seed data (first run) ---------------- */

  var PEER_REVIEW_CHECKLIST = [
    'Taxpayer name + SSN verified', 'Spouse name + SSN verified', 'DOB(s) match prior year',
    'Address matches IRS records', 'Fees recorded correctly', 'Engagement letter signed + on file',
    'E-file diagnostics resolved', 'State filings included where required', 'Estimated payments accounted for',
    'Return PDF previewed for legibility',
  ];

  var SEED = {
    PRO: [
      ['ONBOARDING_SETUP', 'Provision Drive folder', 'OS', 'CLAIMED_AT', 0],
      ['ONBOARDING_SETUP', 'Send welcome email', 'OS', 'CLAIMED_AT', 1],
      ['ONBOARDING_SETUP', 'Schedule IAC call', 'OS', 'CLAIMED_AT', 3],
      ['ONBOARDING_SETUP', 'Send organizer to pro', 'OS', 'CLAIMED_AT', 5],
      ['ONBOARDING_SETUP', 'Collect 8821 IRS authorization', 'OS', 'CLAIMED_AT', 7],
      ['RETURN_PREP_KICKOFF', 'Confirm prior-year return on file', 'ADVISOR', 'CLAIMED_AT', 9],
      ['RETURN_PREP_KICKOFF', 'Confirm books status with BK lead', 'BK_LEAD', 'CLAIMED_AT', 9],
      ['RETURN_PREP_KICKOFF', 'Confirm state nexus + multi-state flagging', 'ADVISOR', 'CLAIMED_AT', 11],
      ['ADVISORY_WORK', 'Estimated tax payment review', 'ADVISOR', 'CLAIMED_AT', 30],
      ['ADVISORY_WORK', 'Bookkeeping touchpoint', 'BK_LEAD', 'CLAIMED_AT', 21],
    ],
    PROJECT: [
      ['DOC_GATHERING', 'Review status of INHA books', 'BK', 'PROJECT_START', 0, { key: 'inha' }],
      ['DOC_GATHERING', 'Check Doc Request to see if complete', 'BK', 'PROJECT_START', 1, { key: 'docreq' }],
      ['DOC_GATHERING', 'Cross-reference signed engagement letter', 'BK', 'PROJECT_START', 1, { parent: 'docreq' }],
      ['DOC_GATHERING', 'Have doc collection call', 'BK', 'PROJECT_START', 1],
      ['DOC_GATHERING', 'Review documents for quality and completeness', 'PREPARER', 'PROJECT_START', 5],
      ['DOC_GATHERING', 'Send email to pro thanking for documents', 'BK', 'PROJECT_START', 6],
      ['EXTENSION', 'Determine if extension is needed', 'ADVISOR', 'PROJECT_START', 7, { key: 'extq' }],
      ['EXTENSION', 'File extension', 'ADVISOR', 'FILING_DEADLINE', -14, { key: 'extfile', blockedBy: ['extq'] }],
      ['EXTENSION', 'Verify extension transmission acceptance', 'ADVISOR', 'FILING_DEADLINE', -13, { blockedBy: ['extfile'] }],
      ['PREP', 'Confirm state filing requirements + Profile Section', 'PREPARER', 'PROJECT_START', 28],
      ['PREP', 'Complete return Client info', 'PREPARER', 'PROJECT_START', 29],
      ['PREP', 'Complete Income/Deduction Info', 'PREPARER', 'PROJECT_START', 31, { key: 'incded' }],
      ['PREP', 'Enter Schedule C income', 'PREPARER', 'PROJECT_START', 31, { parent: 'incded' }],
      ['PREP', 'Enter 1099-NEC payer summary', 'PREPARER', 'PROJECT_START', 31, { parent: 'incded' }],
      ['PREP', 'Apply meal/vehicle deductions', 'PREPARER', 'PROJECT_START', 31, { parent: 'incded' }],
      ['PREP', 'Enter/Confirm fixed assets + depreciation schedule', 'PREPARER', 'PROJECT_START', 33],
      ['PREP', 'Self-review and submit for peer review', 'PREPARER', 'PROJECT_START', 35],
      ['INTERNAL_REVIEW_QC', 'Peer Review Verification', 'PEER_REVIEWER', 'PROJECT_START', 40, { key: 'peer', checklist: PEER_REVIEW_CHECKLIST }],
      ['INTERNAL_REVIEW_QC', 'Apply peer-review changes', 'PREPARER', 'PROJECT_START', 42, { blockedBy: ['peer'] }],
      ['CLIENT_REVIEW', 'Send draft return to pro for review', 'ADVISOR', 'PROJECT_START', 45],
      ['CLIENT_REVIEW', 'Host client review call', 'ADVISOR', 'PROJECT_START', 47],
      ['CLIENT_REVIEW', 'Collect signed 8879 (e-file auth)', 'BK', 'PROJECT_START', 50],
      ['FILING_DELIVERY', 'E-file return', 'PREPARER', 'EFILE_DATE', 0],
      ['FILING_DELIVERY', 'Confirm IRS acceptance', 'PREPARER', 'EFILE_DATE', 1],
      ['FILING_DELIVERY', 'Deliver signed copies to Drive folder', 'BK', 'EFILE_DATE', 2],
    ],
  };

  function seedIfEmpty() {
    var created = 0;
    ['PRO', 'PROJECT'].forEach(function (scope) {
      if (all(scope).length) return;
      var keyToId = {};
      var rows = SEED[scope].map(function (s, i) {
        var o = s[5] || {};
        var id = uid_('TT');
        if (o.key) keyToId[o.key] = id;
        return { s: s, o: o, id: id, i: i };
      }).map(function (x) {
        return {
          template_id: x.id, scope: scope, section: x.s[0], title: x.s[1], default_role: x.s[2],
          due_anchor: x.s[3], offset_days: x.s[4], active: true, sort_order: x.i,
          checklist: x.o.checklist || null, filing_types: '',
          parent_template_id: x.o.parent ? keyToId[x.o.parent] : '',
          blocked_by_template_ids: (x.o.blockedBy || []).map(function (k) { return keyToId[k]; }).join(','),
        };
      });
      Db.insertMany('TaskTemplates', rows);
      created += rows.length;
      publish(scope, 'Initial templates');
    });
    return created;
  }

  return {
    all: all, active: active, versions: versions, currentVersion: currentVersion, publish: publish,
    save: save, remove: remove, reorder: reorder, preview: preview, seedIfEmpty: seedIfEmpty,
  };
})();
