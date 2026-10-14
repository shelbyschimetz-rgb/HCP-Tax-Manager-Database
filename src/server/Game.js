/**
 * Game — contest points, computed live from the real work (nothing is
 * stored, so there's nothing to game or keep in sync). Every skin shows the
 * same points under its own names.
 *
 *   Task done on time (by its due date)      +10   (done, no due date or late: +5)
 *   Return moved forward a stage             +20   (to whoever moved it)
 *   Return filed (reached Complete)          +50   each to its preparer and advisor
 *     … filed by its deadline (+ extension)  +50   bonus to both
 *   Peer review completed                    +30   to the reviewer
 *   Return passed peer review first try      +25   to the person who submitted it
 *   Each full hour of logged timer time       +5
 *
 * Only events inside the contest window count. Overdue work never takes
 * points away; the game rewards on-time, accurate work over raw volume.
 */

var Game = (function () {
  var P = { TASK_ON_TIME: 10, TASK_DONE: 5, STAGE: 20, FILED: 50, ON_TIME: 50, REVIEW: 30, FIRST_PASS: 25, HOUR: 5 };
  var SEQ = ['IN_QUEUE', 'DOC_GATHERING', 'PREP', 'WFP', 'QA', 'CLIENT_REVIEW', 'FILING_DELIVERY', 'COMPLETE'];
  var BADGES = {
    ontime: { metric: 'tasks_on_time', need: 10 },
    filer: { metric: 'returns_filed', need: 5 },
    early: { metric: 'returns_early', need: 3 },
    firstpass: { metric: 'first_pass', need: 3 },
    reviewer: { metric: 'reviews_done', need: 5 },
    clean: { metric: 'clean', need: 1 },
  };

  function settings() {
    var today = todayIso_();
    return {
      enabled: getProp_(PROP.GAME_ENABLED, 'true') !== 'false',
      start: getProp_(PROP.GAME_START) || today.slice(0, 8) + '01',
      end: getProp_(PROP.GAME_END) || '',
      goal: Number(getProp_(PROP.GAME_GOAL, '10000')) || 10000,
      prize: getProp_(PROP.GAME_PRIZE) || '',
    };
  }

  /** Identity "team" column: A / B (or Aliens / Auditors, 1 / 2). Blank: advisors are A, everyone else B. */
  function teamOf(m) {
    var t = String(m.team || '').trim().toLowerCase();
    if (/^(a|1|aliens?|team a)$/.test(t)) return 'A';
    if (/^(b|2|auditors?|team b)$/.test(t)) return 'B';
    return m.roles.indexOf('ADVISOR') >= 0 ? 'A' : 'B';
  }

  function localDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  function scores() {
    var cfg = settings();
    if (!cfg.enabled) return { enabled: false };
    var inWindow = function (iso) { var d = localDate(iso); return d && d >= cfg.start && (!cfg.end || d <= cfg.end); };
    var roster = Identity.roster().filter(function (m) { return m.active; });
    var people = {};
    roster.forEach(function (m) {
      people[m.email] = {
        email: m.email, name: m.name, team: teamOf(m), points: 0,
        breakdown: { tasks: 0, stages: 0, filed: 0, reviews: 0, time: 0 },
        stats: { tasks_on_time: 0, returns_filed: 0, returns_early: 0, first_pass: 0, reviews_done: 0, overdue_open: 0 },
      };
    });
    var add = function (email, bucket, pts, stat) {
      var p = people[email];
      if (!p) return;
      p.points += pts;
      p.breakdown[bucket] += pts;
      if (stat) p.stats[stat]++;
    };
    var today = todayIso_();
    var projects = {};
    Db.list('Projects').forEach(function (p) { projects[p.project_id] = p; });

    Db.list('Tasks').forEach(function (t) {
      var rec = t.entity_type === 'PROJECT' ? projects[t.entity_id] : null;
      if (t.status === 'DONE' && t.completed_by && inWindow(t.completed_at)) {
        var onTime = t.due_date && localDate(t.completed_at) <= t.due_date;
        add(t.completed_by, 'tasks', onTime ? P.TASK_ON_TIME : P.TASK_DONE, onTime ? 'tasks_on_time' : null);
      }
      if (['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED'].indexOf(t.status) >= 0 && t.due_date && t.due_date < today && people[t.assignee_email] && !(rec && rec.archived)) {
        people[t.assignee_email].stats.overdue_open++;
      }
    });

    Db.list('ProjectStageHistory').forEach(function (h) {
      if (!inWindow(h.changed_at)) return;
      var p = projects[h.project_id];
      if (h.to_stage === 'COMPLETE') {
        if (!p) return;
        var deadline = p.filing_deadline ? (p.extension_filed ? addDays_(p.filing_deadline, 183) : p.filing_deadline) : '';
        var filed = p.efile_date || localDate(h.changed_at);
        var onTime = deadline && filed <= deadline;
        var early = deadline && filed <= addDays_(deadline, -14);
        var credited = {};
        [p.tax_preparer_email, p.tax_advisor_email].forEach(function (e) {
          if (!e || credited[e]) return;
          credited[e] = true;
          add(e, 'filed', P.FILED + (onTime ? P.ON_TIME : 0), 'returns_filed');
          if (early && people[e]) people[e].stats.returns_early++;
        });
        return;
      }
      var a = SEQ.indexOf(h.from_stage), b = SEQ.indexOf(h.to_stage);
      if (h.from_stage && a >= 0 && b > a) add(h.changed_by, 'stages', P.STAGE);
    });

    Db.list('PeerReviews').forEach(function (r) {
      if (r.status !== 'COMPLETE' || !inWindow(r.completed_at)) return;
      add(r.reviewer_email || r.completed_by, 'reviews', P.REVIEW, 'reviews_done');
      if (!r.rework_count) add(r.submitted_by, 'reviews', P.FIRST_PASS, 'first_pass');
    });

    var minutes = {};
    Db.list('TimeEntries').forEach(function (e) {
      if (!e.stopped_at || !inWindow(e.started_at)) return;
      minutes[e.user_email] = (minutes[e.user_email] || 0) + (e.duration_min || 0);
    });
    Object.keys(minutes).forEach(function (email) { add(email, 'time', Math.floor(minutes[email] / 60) * P.HOUR); });

    var list = Object.keys(people).map(function (k) {
      var p = people[k];
      p.stats.clean = p.stats.overdue_open === 0 && (p.stats.tasks_on_time > 0 || p.points > 0) ? 1 : 0;
      p.badges = Object.keys(BADGES).map(function (id) {
        var b = BADGES[id];
        var have = p.stats[b.metric] || 0;
        return { id: id, have: Math.min(have, b.need), need: b.need, earned: have >= b.need };
      });
      return p;
    }).sort(function (a, b) { return b.points - a.points || (a.name < b.name ? -1 : 1); });
    var teams = { A: 0, B: 0 };
    list.forEach(function (p) { teams[p.team === 'B' ? 'B' : 'A'] += p.points; });
    return {
      enabled: true, start: cfg.start, end: cfg.end, goal: cfg.goal, prize: cfg.prize,
      total: list.reduce(function (n, p) { return n + p.points; }, 0), teams: teams, people: list,
      rules: [
        ['Task done on time', P.TASK_ON_TIME], ['Task done (late or no due date)', P.TASK_DONE], ['Move a return forward a stage', P.STAGE],
        ['Return filed (to preparer and advisor)', P.FILED], ['…filed by its deadline', P.ON_TIME], ['Peer review completed', P.REVIEW],
        ['Your return passes peer review first try', P.FIRST_PASS], ['Each hour of logged time', P.HOUR],
      ],
    };
  }

  return { scores: scores, settings: settings, POINTS: P };
})();
