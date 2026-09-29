/**
 * Tasks — materialization from templates, status cascade, CRUD.
 *
 * Tasks belong to a PRO (org_id) or a PROJECT (project_id) via
 * entity_type + entity_id. Subtasks point at parent_task_id. Audit rows are
 * written against the parent record so they show on its Audit tab.
 */

var Tasks = (function () {

  function forEntity(entityType, entityId) {
    return Db.where('Tasks', function (t) {
      return t.entity_type === entityType && String(t.entity_id) === String(entityId);
    }).sort(bySort);
  }

  function bySort(a, b) {
    return (a.sort_order || 0) - (b.sort_order || 0);
  }

  /** Map a template's default role to the person holding it on the record. */
  function roleAssignee(role, entityType, rec, pro) {
    if (!role) return '';
    if (entityType === 'PRO') {
      switch (role) {
        case 'ADVISOR': return rec.assigned_advisor_email || '';
        case 'OS': return rec.assigned_os_email || '';
        case 'BK': case 'BK_LEAD': case 'BK_TEAM_LEAD': return rec.bk_lead_email || '';
        default: return '';
      }
    }
    switch (role) {
      case 'ADVISOR': return rec.tax_advisor_email || '';
      case 'PREPARER': return rec.tax_preparer_email || '';
      case 'PEER_REVIEWER': return rec.peer_reviewer_email || '';
      case 'OS': return rec.os_email || (pro && pro.assigned_os_email) || '';
      case 'BK': case 'BK_LEAD': case 'BK_TEAM_LEAD': return (pro && pro.bk_lead_email) || '';
      default: return '';
    }
  }

  function anchorDate(anchor, entityType, rec) {
    switch (anchor) {
      case 'CLAIMED_AT': return rec.onboarding_claimed_at ? String(rec.onboarding_claimed_at).slice(0, 10) : todayIso_();
      case 'PROJECT_START': return rec.project_start_date || (rec.created_at ? String(rec.created_at).slice(0, 10) : todayIso_());
      case 'FILING_DEADLINE': return rec.filing_deadline || '';
      case 'EFILE_DATE': return rec.efile_date || '';
      default: return '';
    }
  }

  function computeDue(anchor, offset, entityType, rec) {
    var base = anchorDate(anchor, entityType, rec);
    return base ? addDays_(base, offset || 0) : '';
  }

  /**
   * Create tasks on a record from the active templates for its scope.
   * Idempotent: templates already materialized on this record are skipped.
   * `opts.completeBeforeStage` marks sections whose stage precedes it DONE
   * (used when migrating in-flight projects).
   */
  function materialize(entityType, rec, opts) {
    opts = opts || {};
    var scope = entityType;
    var entityId = entityType === 'PRO' ? rec.org_id : rec.project_id;
    var pro = entityType === 'PROJECT' ? Db.get('Pros', rec.org_id) : rec;
    var existing = forEntity(entityType, entityId);
    var have = {};
    existing.forEach(function (t) { if (t.template_id) have[t.template_id] = t.task_id; });
    var version = Templates.currentVersion(scope);
    var templates = Templates.active(scope).filter(function (tp) {
      if (entityType !== 'PROJECT' || !tp.filing_types) return true;
      return String(tp.filing_types).split(/[,\s]+/).indexOf(rec.filing_type) >= 0;
    });
    var stageIdx = opts.completeBeforeStage ? ENUMS.PIPELINE_SEQUENCE.indexOf(opts.completeBeforeStage) : -1;
    var base = existing.length ? Math.max.apply(null, existing.map(function (t) { return t.sort_order || 0; })) + 1 : 0;
    var idFor = {};
    var rows = [];
    templates.forEach(function (tp, i) {
      if (have[tp.template_id]) { idFor[tp.template_id] = have[tp.template_id]; return; }
      idFor[tp.template_id] = uid_('T');
    });
    templates.forEach(function (tp, i) {
      if (have[tp.template_id]) return;
      var secStage = SECTION_STAGE[tp.section];
      var preDone = stageIdx >= 0 && secStage && ENUMS.PIPELINE_SEQUENCE.indexOf(secStage) >= 0 &&
        ENUMS.PIPELINE_SEQUENCE.indexOf(secStage) < stageIdx;
      if (opts.completeBeforeStage === 'COMPLETE') preDone = true;
      var checklist = null;
      if (tp.checklist && tp.checklist.length) {
        checklist = tp.checklist.map(function (label, j) {
          return { id: 'c' + (j + 1), label: typeof label === 'string' ? label : label.label, checked: !!preDone };
        });
      }
      rows.push({
        task_id: idFor[tp.template_id],
        entity_type: entityType,
        entity_id: entityId,
        parent_task_id: tp.parent_template_id ? (idFor[tp.parent_template_id] || '') : '',
        section: tp.section,
        title: tp.title,
        assignee_email: roleAssignee(tp.default_role, entityType, rec, pro),
        assignee_role: tp.default_role || '',
        due_date: computeDue(tp.due_anchor, tp.offset_days, entityType, rec),
        due_anchor: tp.due_anchor || '',
        offset_days: tp.offset_days || 0,
        status: preDone ? 'DONE' : 'NOT_STARTED',
        sort_order: base + i,
        blocked_by: String(tp.blocked_by_template_ids || '').split(/[,\s]+/).filter(Boolean)
          .map(function (id) { return idFor[id]; }).filter(Boolean).join(','),
        checklist: checklist,
        template_id: tp.template_id,
        template_version: version,
        completed_at: preDone ? nowIso_() : '',
        completed_by: preDone ? Identity.currentEmail() : '',
      });
    });
    var created = Db.insertMany('Tasks', rows);
    if (created.length) {
      Audit.log(entityType, entityId, 'Materialized tasks', 'tasks', '',
        created.length + ' from ' + (scope === 'PRO' ? 'Pro' : 'Project') + ' templates v' + version);
    }
    return created;
  }

  /** Recompute due dates anchored to a changed field (e.g. efile_date set later). */
  function reanchor(entityType, rec, anchors) {
    var entityId = entityType === 'PRO' ? rec.org_id : rec.project_id;
    var changed = [];
    forEntity(entityType, entityId).forEach(function (t) {
      if (t.status === 'DONE' || anchors.indexOf(t.due_anchor) < 0) return;
      var due = computeDue(t.due_anchor, t.offset_days, entityType, rec);
      if (due !== (t.due_date || '')) changed.push(Db.update('Tasks', t.task_id, { due_date: due }));
    });
    return changed;
  }

  /** Fill unassigned open tasks whose role now has a person on the record. */
  function fillRoleAssignees(entityType, rec) {
    var entityId = entityType === 'PRO' ? rec.org_id : rec.project_id;
    var pro = entityType === 'PROJECT' ? Db.get('Pros', rec.org_id) : rec;
    var changed = [];
    forEntity(entityType, entityId).forEach(function (t) {
      if (t.status === 'DONE' || t.assignee_email || !t.assignee_role) return;
      var who = roleAssignee(t.assignee_role, entityType, rec, pro);
      if (who) changed.push(Db.update('Tasks', t.task_id, { assignee_email: who }));
    });
    return changed;
  }

  function setStatusRaw(t, status) {
    if (t.status === status) return null;
    var done = status === 'DONE';
    return Db.update('Tasks', t.task_id, {
      status: status,
      completed_at: done ? nowIso_() : '',
      completed_by: done ? Identity.currentEmail() : '',
    });
  }

  /**
   * Set a task's status with cascade rules:
   *  - marking a parent DONE marks all its children DONE;
   *  - when every child of a parent is DONE, the parent auto-completes;
   *  - un-checking a child re-opens a DONE parent (IN_PROGRESS).
   * Returns every task row that changed.
   */
  function setStatus(taskId, status, expectedVersion) {
    if (ENUMS.TASK_STATUS.indexOf(status) < 0) throw new AppError('Unknown task status ' + status);
    var t = Db.get('Tasks', taskId);
    if (!t) throw new AppError('That task no longer exists.', 'NOT_FOUND');
    if (expectedVersion != null && Number(expectedVersion) !== Number(t.row_version)) throw conflict_('This task');
    var changed = [];
    var r = setStatusRaw(t, status);
    if (r) changed.push(r);
    var all = forEntity(t.entity_type, t.entity_id);
    if (status === 'DONE') {
      all.filter(function (c) { return c.parent_task_id === t.task_id && c.status !== 'DONE'; })
        .forEach(function (c) { var x = setStatusRaw(c, 'DONE'); if (x) changed.push(x); });
    }
    if (t.parent_task_id) {
      var parent = Db.get('Tasks', t.parent_task_id);
      if (parent) {
        var siblings = forEntity(t.entity_type, t.entity_id).filter(function (c) { return c.parent_task_id === parent.task_id; });
        var allDone = siblings.every(function (c) { return c.status === 'DONE'; });
        if (allDone && parent.status !== 'DONE') { var p = setStatusRaw(parent, 'DONE'); if (p) changed.push(p); }
        if (!allDone && parent.status === 'DONE') { var q = setStatusRaw(parent, 'IN_PROGRESS'); if (q) changed.push(q); }
      }
    }
    Audit.log(t.entity_type, t.entity_id, status === 'DONE' ? 'Completed task' : 'Reopened task', 'task', '', t.title);
    return changed;
  }

  /** opts (server-side callers only): role → assignee_role, checklist → array of labels. */
  function create(p, opts) {
    opts = opts || {};
    if (!p.title || !String(p.title).trim()) throw new AppError('Task needs a title.');
    if (p.entity_type !== 'PRO' && p.entity_type !== 'PROJECT') throw new AppError('Bad entity type.');
    var rec = p.entity_type === 'PRO' ? Db.get('Pros', p.entity_id) : Db.get('Projects', p.entity_id);
    if (!rec) throw new AppError('Record not found.', 'NOT_FOUND');
    var siblings = forEntity(p.entity_type, p.entity_id);
    var inSection = siblings.filter(function (t) { return t.section === p.section; });
    var order = inSection.length
      ? Math.max.apply(null, inSection.map(function (t) { return t.sort_order || 0; })) + 0.5
      : siblings.length;
    var row = Db.insert('Tasks', {
      task_id: p.task_id || uid_('T'),
      entity_type: p.entity_type,
      entity_id: p.entity_id,
      parent_task_id: p.parent_task_id || '',
      section: p.section || 'GENERAL',
      title: String(p.title).trim(),
      assignee_email: p.assignee_email || '',
      assignee_role: opts.role || '',
      due_date: p.due_date || '',
      status: 'NOT_STARTED',
      sort_order: order,
      checklist: opts.checklist ? opts.checklist.map(function (label, j) { return { id: 'c' + (j + 1), label: label, checked: false }; }) : null,
    });
    Audit.log(p.entity_type, p.entity_id, 'Created task', 'task', '', row.title);
    return row;
  }

  var EDITABLE = ['title', 'assignee_email', 'due_date', 'section', 'blocked_by', 'sort_order', 'parent_task_id'];

  function update(taskId, patch, expectedVersion) {
    var t = Db.get('Tasks', taskId);
    if (!t) throw new AppError('That task no longer exists.', 'NOT_FOUND');
    var clean = {};
    EDITABLE.forEach(function (k) { if (k in patch) clean[k] = patch[k]; });
    if ('due_date' in clean) clean.due_anchor = ''; // a manual date detaches from its anchor
    var next = Db.update('Tasks', taskId, clean, expectedVersion);
    Audit.diff(t.entity_type, t.entity_id, t, next, Object.keys(clean).filter(function (k) { return k !== 'sort_order'; }));
    return next;
  }

  function remove(taskId) {
    var t = Db.get('Tasks', taskId);
    if (!t) return { removed: [] };
    var ids = [taskId];
    forEntity(t.entity_type, t.entity_id).forEach(function (c) { if (c.parent_task_id === taskId) ids.push(c.task_id); });
    ids.forEach(function (id) { Db.remove('Tasks', id); });
    Audit.log(t.entity_type, t.entity_id, 'Deleted task', 'task', t.title, '');
    return { removed: ids };
  }

  function toggleChecklist(taskId, itemId, checked) {
    var t = Db.get('Tasks', taskId);
    if (!t) throw new AppError('That task no longer exists.', 'NOT_FOUND');
    var list = (t.checklist || []).map(function (c) {
      return c.id === itemId ? { id: c.id, label: c.label, checked: !!checked } : c;
    });
    var next = Db.update('Tasks', taskId, { checklist: list });
    return next;
  }

  /** Progress % per entity id, from top-level + sub tasks (SKIPPED excluded). */
  function progressIndex(entityType) {
    var agg = {};
    Db.list('Tasks').forEach(function (t) {
      if (t.entity_type !== entityType || t.status === 'SKIPPED') return;
      var a = agg[t.entity_id] || (agg[t.entity_id] = { done: 0, total: 0 });
      a.total++;
      if (t.status === 'DONE') a.done++;
    });
    return agg;
  }

  return {
    forEntity: forEntity, materialize: materialize, reanchor: reanchor, fillRoleAssignees: fillRoleAssignees,
    setStatus: setStatus, create: create, update: update, remove: remove, toggleChecklist: toggleChecklist,
    progressIndex: progressIndex, computeDue: computeDue,
  };
})();
