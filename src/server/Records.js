/**
 * Records — Pros and Projects: create, edit, archive, stage transitions.
 */

function proEditable_() {
  return SCHEMA.Pros.cols.filter(function (c) {
  return ['org_id', 'row_version', 'created_at', 'created_by', 'updated_at', 'updated_by',
    'archived', 'archived_at', 'archived_by', 'archive_reason', 'intake_state',
    // system-managed: set only by Drive provisioning, inbox claim, and the load balancer
    'drive_folder_id', 'drive_folder_url', 'onboarding_claimed_by', 'onboarding_claimed_at', 'advisor_assigned_at'].indexOf(c) < 0;
  });
}
function projectEditable_() {
  return SCHEMA.Projects.cols.filter(function (c) {
  return ['project_id', 'org_id', 'row_version', 'created_at', 'created_by', 'updated_at', 'updated_by',
    'archived', 'archived_at', 'archived_by', 'archive_reason', 'stage_changed_at'].indexOf(c) < 0;
  });
}

function checkEnum_(field, value, list) {
  if (value == null || value === '') return;
  if (list.indexOf(value) < 0) throw new AppError('"' + value + '" is not a valid ' + field.replace(/_/g, ' ') + '.');
}

var Pros = {
  create: function (p) {
    var orgId = String(p.org_id || '').trim();
    if (!/^\d+$/.test(orgId)) throw new AppError('Org ID must be numeric.');
    if (Db.get('Pros', orgId)) throw new AppError('Pro ' + orgId + ' already exists.', 'DUPLICATE');
    if (!p.business_name) throw new AppError('Business name is required.');
    var row = { org_id: orgId, lifecycle_status: 'CLOSED_WON', doc_collection_status: 'WAITING', archived: false };
    proEditable_().forEach(function (k) { if (k in p && p[k] !== '') row[k] = p[k]; });
    checkEnum_('lifecycle_status', row.lifecycle_status, ENUMS.LIFECYCLE_STATUS);
    checkEnum_('entity_type', row.entity_type, ENUMS.ENTITY_TYPE);
    if (!row.assigned_advisor_email && p.auto_assign !== false) {
      var pick = Assign.nextAdvisor();
      if (pick) { row.assigned_advisor_email = pick; row.advisor_assigned_at = nowIso_(); }
    } else if (row.assigned_advisor_email) {
      row.advisor_assigned_at = nowIso_();
    }
    var created = Db.insert('Pros', row);
    Audit.log('PRO', orgId, 'Created pro', 'pro', '', created.business_name);
    if (created.assigned_advisor_email) {
      Audit.log('PRO', orgId, 'Assigned advisor', 'assigned_advisor_email', '', created.assigned_advisor_email);
    }
    return created;
  },

  update: function (orgId, patch, version) {
    var before = Db.get('Pros', orgId);
    if (!before) throw new AppError('Pro ' + orgId + ' not found.', 'NOT_FOUND');
    var clean = {};
    proEditable_().forEach(function (k) { if (k in patch) clean[k] = patch[k]; });
    checkEnum_('lifecycle_status', clean.lifecycle_status, ENUMS.LIFECYCLE_STATUS);
    checkEnum_('entity_type', clean.entity_type, ENUMS.ENTITY_TYPE);
    checkEnum_('doc_collection_status', clean.doc_collection_status, ENUMS.DOC_COLLECTION_STATUS);
    if ('assigned_advisor_email' in clean && clean.assigned_advisor_email !== before.assigned_advisor_email) {
      clean.advisor_assigned_at = nowIso_();
    }
    if ('assigned_os_email' in clean && clean.assigned_os_email) clean.needs_os_assignment = false;
    if (clean.at_risk === false) clean.at_risk_reason = '';
    var next = Db.update('Pros', orgId, clean, version);
    Audit.diff('PRO', orgId, before, next, Object.keys(clean).filter(function (k) { return k !== 'advisor_assigned_at'; }));
    var tasks = [];
    if (['assigned_advisor_email', 'assigned_os_email', 'bk_lead_email'].some(function (k) { return k in clean; })) {
      tasks = Tasks.fillRoleAssignees('PRO', next);
    }
    return { pro: next, tasks: tasks };
  },

  archive: function (orgId, reason) {
    var p = Db.get('Pros', orgId);
    if (!p) throw new AppError('Pro not found.', 'NOT_FOUND');
    var next = Db.update('Pros', orgId, {
      archived: true, archived_at: nowIso_(), archived_by: Identity.currentEmail(), archive_reason: reason || '',
    });
    Audit.log('PRO', orgId, 'Archived pro', 'archived', 'FALSE', reason || 'TRUE');
    return next;
  },

  restore: function (orgId) {
    var next = Db.update('Pros', orgId, { archived: false, archived_at: '', archived_by: '', archive_reason: '' });
    Audit.log('PRO', orgId, 'Restored pro', 'archived', 'TRUE', 'FALSE');
    return next;
  },
};

function defaultDeadline_(filingType, taxYear) {
  var mmdd = DEADLINE_MMDD[filingType];
  if (!mmdd || !taxYear) return '';
  return (Number(taxYear) + 1) + '-' + mmdd;
}

function nextProjectId_(orgId, taxYear, filingType) {
  var base = 'PRJ-' + orgId + '-' + taxYear + '-' + (FILING_CODE[filingType] || 'OTHER');
  if (!Db.get('Projects', base)) return base;
  for (var i = 2; i < 100; i++) if (!Db.get('Projects', base + '-' + i)) return base + '-' + i;
  return base + '-' + uid_();
}

var Projects = {
  create: function (p, opts) {
    opts = opts || {};
    var pro = Db.get('Pros', p.org_id);
    if (!pro) throw new AppError('Pro ' + p.org_id + ' not found.', 'NOT_FOUND');
    checkEnum_('filing_type', p.filing_type, ENUMS.FILING_TYPE);
    var ty = Number(p.tax_year);
    if (!ty || ty < 2000 || ty > 2100) throw new AppError('Tax year looks wrong.');
    var row = {
      project_id: p.project_id || nextProjectId_(pro.org_id, ty, p.filing_type),
      org_id: pro.org_id,
      filing_type: p.filing_type,
      tax_year: ty,
      pipeline_status: p.pipeline_status || 'IN_QUEUE',
      filing_deadline: p.filing_deadline || defaultDeadline_(p.filing_type, ty),
      project_start_date: p.project_start_date || todayIso_(),
      tax_advisor_email: pro.assigned_advisor_email || '',
      os_email: pro.assigned_os_email || '',
      complexity: 'MED',
      states_covered: pro.state || '',
      extension_needed: false,
      extension_filed: false,
      archived: false,
      stage_changed_at: nowIso_(),
    };
    projectEditable_().forEach(function (k) { if (k in p && p[k] !== '' && p[k] != null) row[k] = p[k]; });
    checkEnum_('pipeline_status', row.pipeline_status, ENUMS.PIPELINE_STATUS);
    var created = Db.insert('Projects', row);
    Stages.record(created, null, created.pipeline_status);
    Audit.log('PROJECT', created.project_id, 'Created project', 'project', '', created.project_id);
    Audit.log('PRO', pro.org_id, 'Created project', 'project', '', created.project_id);
    var tasks = opts.materialize === false ? [] : Tasks.materialize('PROJECT', created, { completeBeforeStage: opts.completeBeforeStage });
    var proAfter = pro;
    if (['CLOSED_WON', 'ONBOARDING_SCHEDULED', 'ONBOARDED'].indexOf(pro.lifecycle_status) >= 0 && opts.bumpLifecycle !== false) {
      proAfter = Db.update('Pros', pro.org_id, { lifecycle_status: 'ACTIVE_PROJECT' });
      Audit.log('PRO', pro.org_id, 'Transitioned lifecycle', 'lifecycle_status', pro.lifecycle_status, 'ACTIVE_PROJECT');
    }
    return { project: created, tasks: tasks, pro: proAfter };
  },

  update: function (projectId, patch, version) {
    var before = Db.get('Projects', projectId);
    if (!before) throw new AppError('Project ' + projectId + ' not found.', 'NOT_FOUND');
    var clean = {};
    projectEditable_().forEach(function (k) { if (k in patch) clean[k] = patch[k]; });
    checkEnum_('pipeline_status', clean.pipeline_status, ENUMS.PIPELINE_STATUS);
    checkEnum_('filing_type', clean.filing_type, ENUMS.FILING_TYPE);
    checkEnum_('complexity', clean.complexity, ENUMS.COMPLEXITY);
    var stageChanged = 'pipeline_status' in clean && clean.pipeline_status !== before.pipeline_status;
    if (stageChanged) {
      if (clean.pipeline_status === 'BLOCKED' && !(clean.blocker_reason || before.blocker_reason)) {
        throw new AppError('Add a blocker reason before moving a project to Blocked.', 'VALIDATION');
      }
      if (before.pipeline_status === 'BLOCKED' && clean.pipeline_status !== 'BLOCKED' && !('blocker_reason' in clean)) {
        clean.blocker_reason = '';
      }
      clean.stage_changed_at = nowIso_();
    }
    var next = Db.update('Projects', projectId, clean, version);
    Audit.diff('PROJECT', projectId, before, next, Object.keys(clean).filter(function (k) { return k !== 'stage_changed_at'; }));
    if (stageChanged) Stages.record(next, before.pipeline_status, next.pipeline_status, before);
    var tasks = [];
    var anchors = [];
    if ('efile_date' in clean) anchors.push('EFILE_DATE');
    if ('filing_deadline' in clean) anchors.push('FILING_DEADLINE');
    if ('project_start_date' in clean) anchors.push('PROJECT_START');
    if (anchors.length) tasks = tasks.concat(Tasks.reanchor('PROJECT', next, anchors));
    if (['tax_advisor_email', 'tax_preparer_email', 'peer_reviewer_email', 'os_email'].some(function (k) { return k in clean; })) {
      tasks = tasks.concat(Tasks.fillRoleAssignees('PROJECT', next));
    }
    return { project: next, tasks: tasks };
  },

  archive: function (projectId, reason) {
    var next = Db.update('Projects', projectId, {
      archived: true, archived_at: nowIso_(), archived_by: Identity.currentEmail(), archive_reason: reason || '',
    });
    Audit.log('PROJECT', projectId, 'Archived project', 'archived', 'FALSE', reason || 'TRUE');
    return next;
  },

  restore: function (projectId) {
    var next = Db.update('Projects', projectId, { archived: false, archived_at: '', archived_by: '', archive_reason: '' });
    Audit.log('PROJECT', projectId, 'Restored project', 'archived', 'TRUE', 'FALSE');
    return next;
  },
};

/* ---------------- Stage history ---------------- */

var Stages = {
  record: function (project, fromStage, toStage, before) {
    var hist = Stages.forProject(project.project_id);
    var last = hist.length ? hist[hist.length - 1] : null;
    var prevAt = last ? last.changed_at : (before && before.stage_changed_at) || project.created_at;
    var now = nowIso_();
    return Db.insert('ProjectStageHistory', {
      history_id: uid_('H'),
      project_id: project.project_id,
      from_stage: fromStage || '',
      to_stage: toStage,
      changed_at: now,
      changed_by: Identity.currentEmail(),
      advisor_email: project.tax_advisor_email || '',
      days_in_prev_stage: fromStage ? daysBetween_(prevAt, now) : null,
    });
  },
  forProject: function (projectId) {
    return Db.where('ProjectStageHistory', function (h) { return h.project_id === projectId; })
      .sort(function (a, b) { return a.changed_at < b.changed_at ? -1 : 1; });
  },
};

/* ---------------- Notes thread ---------------- */

var Notes = {
  forEntity: function (type, id) {
    return Db.where('Notes', function (n) { return n.entity_type === type && String(n.entity_id) === String(id) && !n.deleted; })
      .sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; });
  },
  add: function (type, id, body, author) {
    if (!body || !String(body).trim()) throw new AppError('Note is empty.');
    if (type !== 'PRO' && type !== 'PROJECT') throw new AppError('Bad entity type.');
    var n = Db.insert('Notes', {
      note_id: uid_('N'), entity_type: type, entity_id: id, author_email: author || Identity.currentEmail(),
      body: String(body).trim(), created_at: nowIso_(), edited_at: '', deleted: false,
    });
    return n;
  },
  edit: function (noteId, body) {
    var n = Db.get('Notes', noteId);
    if (!n) throw new AppError('Note not found.', 'NOT_FOUND');
    if (n.author_email !== Identity.currentEmail()) throw new AppError('You can only edit your own notes.', 'FORBIDDEN');
    if (!body || !String(body).trim()) throw new AppError('Note is empty.');
    return Db.update('Notes', noteId, { body: String(body).trim(), edited_at: nowIso_() });
  },
  remove: function (noteId) {
    var n = Db.get('Notes', noteId);
    if (!n) return null;
    if (n.author_email !== Identity.currentEmail()) throw new AppError('You can only delete your own notes.', 'FORBIDDEN');
    return Db.update('Notes', noteId, { deleted: true });
  },
};

/* ---------------- Outstanding items (project) ---------------- */

var Outstanding = {
  forProject: function (projectId) {
    return Db.where('OutstandingItems', function (i) { return i.project_id === projectId; })
      .sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; });
  },
  add: function (p) {
    if (!p.item || !String(p.item).trim()) throw new AppError('Describe the outstanding item.');
    if (!Db.get('Projects', p.project_id)) throw new AppError('Project not found.', 'NOT_FOUND');
    var row = Db.insert('OutstandingItems', {
      item_id: uid_('OI'), project_id: p.project_id, item: String(p.item).trim(), owner_email: p.owner_email || '',
      due_date: p.due_date || '', created_at: nowIso_(), created_by: Identity.currentEmail(), resolved: false, resolved_at: '',
    });
    Audit.log('PROJECT', p.project_id, 'Added outstanding item', 'outstanding', '', row.item);
    return row;
  },
  setResolved: function (itemId, resolved) {
    return Db.update('OutstandingItems', itemId, { resolved: !!resolved, resolved_at: resolved ? nowIso_() : '' });
  },
  remove: function (itemId) {
    var i = Db.get('OutstandingItems', itemId);
    if (!i) return false;
    Db.remove('OutstandingItems', itemId);
    Audit.log('PROJECT', i.project_id, 'Removed outstanding item', 'outstanding', i.item, '');
    return true;
  },
};
