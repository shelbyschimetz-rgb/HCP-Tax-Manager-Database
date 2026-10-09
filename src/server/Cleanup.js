/**
 * Task fresh start: move open tasks created before this week out of the
 * active Tasks tab into TasksArchive. Nothing is deleted — an admin can copy
 * a row back — but the tasks leave every list, My Tasks, and progress math,
 * and the Tasks tab every save reads gets smaller.
 */

var TaskCleanup = (function () {
  var OPEN = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED'];

  /** Monday of the current week (script time zone), YYYY-MM-DD. */
  function weekStart() {
    var today = todayIso_();
    var dow = new Date(today + 'T12:00:00Z').getUTCDay(); // 0 = Sunday
    return addDays_(today, -((dow + 6) % 7));
  }

  function localDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  /** scope: 'ADVISOR' (tasks for advisors) or 'ALL'. */
  function plan(scope) {
    var before = weekStart();
    var advisors = {};
    Identity.roster().forEach(function (m) { if (m.roles.indexOf('ADVISOR') >= 0) advisors[m.email] = true; });
    var keep = {}; // tasks an open peer review still needs
    Db.where('PeerReviews', function (r) { return ['SUBMITTED', 'IN_REVIEW', 'REWORK'].indexOf(r.status) >= 0; })
      .forEach(function (r) { if (r.review_task_id) keep[r.review_task_id] = true; if (r.rework_task_id) keep[r.rework_task_id] = true; });
    var tasks = Db.list('Tasks');
    var picked = {};
    tasks.forEach(function (t) {
      if (OPEN.indexOf(t.status) < 0 || keep[t.task_id]) return;
      if (localDate(t.created_at) >= before) return;
      if (scope !== 'ALL' && !(advisors[t.assignee_email] || (!t.assignee_email && t.assignee_role === 'ADVISOR'))) return;
      picked[t.task_id] = true;
    });
    // A cleared task takes its subtasks with it, so nothing is left orphaned.
    var grew = true;
    while (grew) {
      grew = false;
      tasks.forEach(function (t) {
        if (!picked[t.task_id] && t.parent_task_id && picked[t.parent_task_id] && !keep[t.task_id]) { picked[t.task_id] = true; grew = true; }
      });
    }
    var rows = tasks.filter(function (t) { return picked[t.task_id]; });
    var by = {};
    rows.forEach(function (t) { var k = t.assignee_email || ''; by[k] = (by[k] || 0) + 1; });
    return {
      before: before, scope: scope === 'ALL' ? 'ALL' : 'ADVISOR', count: rows.length,
      by_person: Object.keys(by).map(function (k) { return { email: k, count: by[k] }; }).sort(function (a, b) { return b.count - a.count; }),
      ids: rows.map(function (t) { return t.task_id; }),
    };
  }

  function run(scope) {
    var p = plan(scope);
    if (!p.count) return { before: p.before, scope: p.scope, cleared: 0, by_person: [] };
    var me = Identity.currentEmail();
    var now = nowIso_();
    var ids = {};
    p.ids.forEach(function (id) { ids[id] = true; });
    var rows = Db.where('Tasks', function (t) { return ids[t.task_id]; });
    var reason = 'Fresh start: open before ' + p.before + (p.scope === 'ALL' ? '' : ' (advisor tasks)');
    Db.append('TasksArchive', rows.map(function (t) {
      var o = {};
      for (var k in t) o[k] = t[k];
      o.cleared_at = now; o.cleared_by = me; o.cleared_reason = reason;
      return o;
    }));
    Db.removeMany('Tasks', p.ids);
    var per = {};
    rows.forEach(function (t) { var k = t.entity_type + '|' + t.entity_id; per[k] = (per[k] || 0) + 1; });
    Db.append('AuditLog', Object.keys(per).map(function (k) {
      var parts = k.split('|');
      return {
        audit_id: uid_('A'), ts: now, actor_email: me, entity_type: parts[0], entity_id: parts[1],
        action: 'Cleared old open tasks', field: 'tasks', from_value: String(per[k]), to_value: 'TasksArchive',
      };
    }));
    return { before: p.before, scope: p.scope, cleared: rows.length, by_person: p.by_person };
  }

  return { weekStart: weekStart, plan: plan, run: run };
})();
