/**
 * Advisor load balancing + the work timer.
 */

var Assign = {
  /**
   * Active (non-archived) pros per eligible advisor. Eligible = ADVISOR role,
   * active, accepting new clients. `lastAssigned` is the most recent
   * advisor_assigned_at across their pros (round-robin tiebreak).
   */
  loads: function () {
    var pros = Db.list('Pros').filter(function (p) { return !p.archived; });
    return Identity.roster().filter(function (m) {
      return m.active && m.roles.indexOf('ADVISOR') >= 0;
    }).map(function (m) {
      var mine = pros.filter(function (p) { return p.assigned_advisor_email === m.email; });
      var last = '';
      mine.forEach(function (p) { if (p.advisor_assigned_at && p.advisor_assigned_at > last) last = p.advisor_assigned_at; });
      return { email: m.email, name: m.name, count: mine.length, accepting: m.accepting_new, lastAssigned: last };
    });
  },

  /** Fewest active pros wins; ties go to the least-recently-assigned; then email for determinism. */
  nextAdvisor: function (loads) {
    var eligible = (loads || Assign.loads()).filter(function (a) { return a.accepting; });
    if (!eligible.length) return '';
    eligible.sort(function (a, b) {
      if (a.count !== b.count) return a.count - b.count;
      if (a.lastAssigned !== b.lastAssigned) return a.lastAssigned < b.lastAssigned ? -1 : 1;
      return a.email < b.email ? -1 : 1;
    });
    return eligible[0].email;
  },
};

var Timer = {
  maxMinutes: function () {
    return Number(getProp_(PROP.TIMER_MAX_HOURS, DEFAULTS.TIMER_MAX_HOURS)) * 60;
  },

  running: function (email) {
    email = email || Identity.currentEmail();
    var open = Db.where('TimeEntries', function (e) { return e.user_email === email && !e.stopped_at; });
    return open.length ? open[0] : null;
  },

  forProject: function (projectId) {
    return Db.where('TimeEntries', function (e) { return e.project_id === projectId; })
      .sort(function (a, b) { return a.started_at < b.started_at ? -1 : 1; });
  },

  /**
   * Start a timer on a project. A user may only run one timer at a time: if
   * another is running we return { conflict } unless force=true, in which case
   * the other one is stopped first ("Stop that & start here").
   */
  start: function (projectId, force) {
    var project = Db.get('Projects', projectId);
    if (!project) throw new AppError('Project not found.', 'NOT_FOUND');
    var me = Identity.currentEmail();
    var cur = Timer.running(me);
    var stopped = null;
    if (cur) {
      if (cur.project_id === projectId) return { entry: cur, stopped: null };
      if (!force) {
        var other = Db.get('Projects', cur.project_id);
        var otherPro = other ? Db.get('Pros', other.org_id) : null;
        return {
          conflict: {
            entry_id: cur.entry_id, project_id: cur.project_id,
            label: (otherPro ? otherPro.business_name : cur.project_id) + (other ? ' · TY' + other.tax_year : ''),
          },
        };
      }
      stopped = Timer.stopEntry(cur, false);
    }
    var entry = Db.insert('TimeEntries', {
      entry_id: uid_('TE'), project_id: projectId, user_email: me, started_at: nowIso_(),
      stopped_at: '', duration_min: null, auto_stopped: false, note: '',
    });
    return { entry: entry, stopped: stopped };
  },

  /** atMs: when the person clicked Stop (sent by the browser), so a slow or retried save doesn't add time. */
  stopEntry: function (entry, auto, atMs) {
    var max = Timer.maxMinutes();
    var startMs = new Date(entry.started_at).getTime();
    var nowMs = Date.now();
    if (atMs && atMs >= startMs && atMs <= nowMs + 60000) nowMs = Math.min(atMs, nowMs);
    var elapsed = nowMs - startMs;
    // Round to the minute, but never log a real session as 0 minutes.
    var minutes = elapsed <= 0 ? 0 : Math.max(1, Math.round(elapsed / 60000));
    var autoStopped = !!auto || minutes > max;
    if (minutes > max) minutes = max;
    var stoppedAt = autoStopped ? new Date(startMs + minutes * 60000).toISOString() : new Date(nowMs).toISOString();
    return Db.update('TimeEntries', entry.entry_id, {
      stopped_at: stoppedAt, duration_min: minutes, auto_stopped: autoStopped,
      note: autoStopped ? 'Auto-stopped after ' + (max / 60) + 'h — please check the logged time.' : entry.note,
    });
  },

  stop: function (entryId, at) {
    var e = Db.get('TimeEntries', entryId);
    if (!e) throw new AppError('Timer entry not found.', 'NOT_FOUND');
    if (e.user_email !== Identity.currentEmail()) throw new AppError('That timer belongs to someone else.', 'FORBIDDEN');
    if (e.stopped_at) return e; // already stopped (another tab, a retry, or auto-stop): nothing to add
    var atMs = at ? new Date(at).getTime() : null;
    return Timer.stopEntry(e, false, isNaN(atMs) ? null : atMs);
  },

  /** The person's running timer with a display label, or null. */
  current: function (email) {
    var t = Timer.running(email);
    if (!t) return null;
    var p = Db.get('Projects', t.project_id);
    var pro = p ? Db.get('Pros', p.org_id) : null;
    t.label = p ? (pro ? pro.business_name : p.org_id) + ' · TY' + p.tax_year : t.project_id;
    return t;
  },

  /** Time-driven (hourly): stop any timer that has run past the max duration. */
  autoStopStale: function () {
    var max = Timer.maxMinutes();
    var n = 0;
    Db.where('TimeEntries', function (e) { return !e.stopped_at; }).forEach(function (e) {
      if ((Date.now() - new Date(e.started_at).getTime()) / 60000 >= max) { Timer.stopEntry(e, true); n++; }
    });
    return n;
  },
};
