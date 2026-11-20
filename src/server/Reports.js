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
  /**
   * One row per finished stay in a stage, built from ProjectStageHistory:
   * the stay starts when the return entered the stage and ends when it left.
   *   partial — the clock didn't start when the return really entered the stage:
   *             it was created (e.g. imported from Asana) already partway through
   *             the pipeline, so the time before Tax Manager is missing and the
   *             stay only counts from the import date.
   *   quick   — under an hour: usually catch-up clicks moving a return through
   *             several stages at once, not real time in the stage.
   * advisor_email is the advisor on the return when it left the stage;
   * moved_by is who moved it.
   */
  intervals: function (history, projBy) {
    var byProject = {};
    history.forEach(function (h) { (byProject[h.project_id] = byProject[h.project_id] || []).push(h); });
    var out = [];
    Object.keys(byProject).forEach(function (pid) {
      var list = byProject[pid].sort(function (a, b) { return a.changed_at < b.changed_at ? -1 : 1; });
      var p = projBy[pid];
      if (!p) return; // archived or removed
      list.forEach(function (h, i) {
        if (!h.from_stage) return;
        var prev = i > 0 ? list[i - 1] : null;
        var start = prev ? prev.changed_at : (p.created_at || '');
        var days = daysBetween_(start, h.changed_at);
        if (days == null) days = h.days_in_prev_stage;
        if (days == null) return;
        var startedMidway = !prev || (!prev.from_stage && ['IN_QUEUE', 'IN_QUEUE_ESCALATED'].indexOf(prev.to_stage) < 0 && i === 1);
        out.push({
          project_id: pid, stage: h.from_stage, to_stage: h.to_stage, started_at: start, ended_at: h.changed_at,
          days: days, advisor_email: h.advisor_email || '', moved_by: h.changed_by || '',
          partial: !!startedMidway, quick: days < 1 / 24,
        });
      });
    });
    return out;
  },

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
        // the extended deadline applies once an extension is filed
        overdue: rows.filter(function (p) {
          var d = p.filing_deadline && (p.extension_filed ? addDays_(p.filing_deadline, 183) : p.filing_deadline);
          return d && d < today && !p.efile_date;
        }).length,
      };
    });

    // 2. Stage cycle time (days spent in from_stage), overall + per advisor.
    // Only clean stays count: see Reports.intervals for what's left out and why.
    var intervals = Reports.intervals(history, projBy);
    var byStage = {};
    var advisorSet = {};
    intervals.forEach(function (iv) {
      if (iv.partial || iv.quick || iv.stage === 'COMPLETE') return;
      var s = byStage[iv.stage] || (byStage[iv.stage] = { all: [], adv: {} });
      s.all.push(iv.days);
      if (iv.advisor_email) {
        advisorSet[iv.advisor_email] = true;
        (s.adv[iv.advisor_email] = s.adv[iv.advisor_email] || []).push(iv.days);
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
      intervals: intervals,
      advisor: advisorRows,
      time: time,
      time_by_type: Object.keys(byType).map(function (k) { return { filing_type: k, minutes: byType[k] }; }),
      risk: risk,
      balance: { loads: loads, next: Assign.nextAdvisor(loads) },
      peer: PeerReviews.report(),
    };
  },
};
