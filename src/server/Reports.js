/**
 * Reports — computed on demand from live records. The client renders them
 * and exports CSV. Durations are raw (no SLA targets in this build).
 */

function median_(nums) {
  if (!nums.length) return null;
  var s = nums.slice().sort(function (a, b) { return a - b; });
  var m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 10) / 10;
}
function avg_(nums) {
  if (!nums.length) return null;
  return Math.round((nums.reduce(function (a, b) { return a + b; }, 0) / nums.length) * 10) / 10;
}

var Reports = {
  all: function () {
    var today = todayIso_();
    var year = today.slice(0, 4);
    var pros = Db.list('Pros');
    var projects = Db.list('Projects').filter(function (p) { return !p.archived; });
    var history = Db.list('ProjectStageHistory');
    var entries = Db.list('TimeEntries').filter(function (e) { return e.stopped_at; });
    var proBy = {};
    pros.forEach(function (p) { proBy[p.org_id] = p; });
    var projBy = {};
    projects.forEach(function (p) { projBy[p.project_id] = p; });

    // 1. Pipeline snapshot
    var stages = ['IN_QUEUE', 'IN_QUEUE_ESCALATED', 'DOC_GATHERING', 'PREP', 'WFP', 'QA', 'CLIENT_REVIEW', 'FILING_DELIVERY', 'BLOCKED'];
    var pipeline = stages.map(function (s) {
      var rows = projects.filter(function (p) { return p.pipeline_status === s; });
      return {
        stage: s, count: rows.length,
        overdue: rows.filter(function (p) { return p.filing_deadline && p.filing_deadline < today && !p.efile_date; }).length,
      };
    });

    // 2. Stage cycle time (days spent in from_stage), overall + per advisor
    var byStage = {};
    var advisorSet = {};
    history.forEach(function (h) {
      if (h.days_in_prev_stage == null || !h.from_stage) return;
      var s = byStage[h.from_stage] || (byStage[h.from_stage] = { all: [], adv: {} });
      s.all.push(h.days_in_prev_stage);
      if (h.advisor_email) {
        advisorSet[h.advisor_email] = true;
        (s.adv[h.advisor_email] = s.adv[h.advisor_email] || []).push(h.days_in_prev_stage);
      }
    });
    var cycleAdvisors = Object.keys(advisorSet).sort();
    var cycle = ENUMS.PIPELINE_STATUS.filter(function (s) { return byStage[s]; }).map(function (s) {
      var row = { stage: s, avg_days: avg_(byStage[s].all), median_days: median_(byStage[s].all), count: byStage[s].all.length, by_advisor: {} };
      cycleAdvisors.forEach(function (a) { row.by_advisor[a] = byStage[s].adv[a] ? avg_(byStage[s].adv[a]) : null; });
      return row;
    });

    // Per-project completion facts from history
    var completedAt = {};
    var startedAt = {};
    history.forEach(function (h) {
      if (!startedAt[h.project_id] || h.changed_at < startedAt[h.project_id]) startedAt[h.project_id] = h.changed_at;
      if (h.to_stage === 'COMPLETE') completedAt[h.project_id] = h.changed_at;
    });

    // 3. Per-advisor summary
    var minutesByProject = {};
    entries.forEach(function (e) { minutesByProject[e.project_id] = (minutesByProject[e.project_id] || 0) + (e.duration_min || 0); });
    var advisors = Identity.roster().filter(function (m) { return m.roles.indexOf('ADVISOR') >= 0; }).map(function (m) { return m.email; });
    projects.forEach(function (p) { if (p.tax_advisor_email && advisors.indexOf(p.tax_advisor_email) < 0) advisors.push(p.tax_advisor_email); });
    var advisorRows = advisors.map(function (email) {
      var mine = projects.filter(function (p) { return p.tax_advisor_email === email; });
      var open = mine.filter(function (p) { return p.pipeline_status !== 'COMPLETE'; });
      var done = mine.filter(function (p) {
        if (p.pipeline_status !== 'COMPLETE') return false;
        var at = completedAt[p.project_id] || p.efile_date || '';
        return String(at).slice(0, 4) === year;
      });
      var cycles = [];
      var onTime = 0, judged = 0;
      done.forEach(function (p) {
        var end = completedAt[p.project_id] || p.efile_date;
        var start = startedAt[p.project_id] || p.created_at;
        var d = daysBetween_(start, end);
        if (d != null) cycles.push(d);
        var filed = (p.efile_date || String(end || '')).slice(0, 10);
        if (p.filing_deadline && filed) {
          judged++;
          var deadline = p.extension_filed ? addDays_(p.filing_deadline, 183) : p.filing_deadline;
          if (filed <= deadline) onTime++;
        }
      });
      var minutes = mine.reduce(function (s, p) { return s + (minutesByProject[p.project_id] || 0); }, 0);
      return {
        advisor_email: email, open_projects: open.length, completed_ytd: done.length,
        avg_cycle_days: avg_(cycles), on_time_pct: judged ? Math.round((onTime / judged) * 100) : null,
        actual_hrs: Math.round((minutes / 60) * 10) / 10,
      };
    });

    // 4. Logged time
    var time = entries.map(function (e) {
      var p = projBy[e.project_id] || Db.get('Projects', e.project_id) || {};
      var pro = proBy[p.org_id] || {};
      return {
        entry_id: e.entry_id, project_id: e.project_id, business_name: pro.business_name || '', filing_type: p.filing_type || '',
        tax_year: p.tax_year || '', user_email: e.user_email, advisor_email: p.tax_advisor_email || '',
        started_at: e.started_at, stopped_at: e.stopped_at, duration_min: e.duration_min || 0, auto_stopped: e.auto_stopped,
      };
    }).sort(function (a, b) { return a.started_at < b.started_at ? 1 : -1; });
    var byType = {};
    time.forEach(function (t) { byType[t.filing_type || 'UNKNOWN'] = (byType[t.filing_type || 'UNKNOWN'] || 0) + t.duration_min; });

    // 5. At-risk pros
    var risk = pros.filter(function (p) { return p.at_risk && !p.archived; }).map(function (p) {
      return {
        org_id: p.org_id, business_name: p.business_name, at_risk_reason: p.at_risk_reason,
        assigned_advisor_email: p.assigned_advisor_email, last_advisor_touchpoint: p.last_advisor_touchpoint,
      };
    });

    var loads = Assign.loads();
    return {
      generated_at: nowIso_(),
      pipeline: pipeline,
      cycle: { advisors: cycleAdvisors, rows: cycle },
      advisor: advisorRows,
      time: time,
      time_by_type: Object.keys(byType).map(function (k) { return { filing_type: k, minutes: byType[k] }; }),
      risk: risk,
      balance: { loads: loads, next: Assign.nextAdvisor(loads) },
    };
  },
};
