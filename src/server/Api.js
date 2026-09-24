/**
 * Api — the single entry point the client calls via google.script.run.api().
 *
 *   google.script.run.withSuccessHandler(cb).api('setTaskStatus', { task_id, status })
 *
 * Every response is { ok: true, data } or { ok: false, error, code } so the
 * client can roll back optimistic updates with a readable message. Mutating
 * actions run under the script lock.
 */

function api(action, payload) {
  var started = Date.now();
  try {
    var def = API_ACTIONS[action];
    if (!def) throw new AppError('Unknown action "' + action + '".');
    var me = Identity.current();
    if (def.admin) Identity.requireAdmin(me);
    payload = payload || {};
    var data = def.mutate
      ? Locks.withLock(function () { return def.fn(payload, me); })
      : def.fn(payload, me);
    return { ok: true, data: data, ms: Date.now() - started };
  } catch (e) {
    var code = e && e.code ? e.code : 'ERROR';
    if (code === 'ERROR') console.error(action + ' failed: ' + (e && e.stack ? e.stack : e));
    return { ok: false, error: (e && e.message) || String(e), code: code };
  }
}

function R(fn) { return { fn: fn }; }
function M(fn) { return { fn: fn, mutate: true }; }
function ADMIN_M(fn) { return { fn: fn, mutate: true, admin: true }; }
function ADMIN_R(fn) { return { fn: fn, admin: true }; }

var API_ACTIONS = {
  /* ---- reads ---- */
  bootstrap: R(function (p, me) { return Boot.payload(me); }),
  refresh: R(function (p, me) { return Boot.payload(me); }),
  getProDetail: R(function (p) { return Boot.proDetail(p.org_id); }),
  getProjectDetail: R(function (p) { return Boot.projectDetail(p.project_id); }),
  getTemplates: R(function (p) {
    return { templates: Templates.all(p.scope), versions: Templates.versions(p.scope), counts: { PRO: Templates.all('PRO').length, PROJECT: Templates.all('PROJECT').length } };
  }),
  getVersion: R(function (p) { return Db.get('TemplateVersions', p.version_id); }),
  previewTemplates: R(function (p) { return Templates.preview(p.scope, p.filing_type); }),
  getReports: R(function () { return Reports.all(); }),
  getIntake: R(function (p) { return Boot.intake(p.org_id); }),
  recentlyClaimed: R(function () { return Sfdc.recentlyClaimed(); }),
  getSettings: ADMIN_R(function () { return Boot.settings(); }),
  importPreview: ADMIN_R(function (p) { return Migration.preview(p.kind, p.csv); }),

  /* ---- pros ---- */
  createPro: M(function (p) { return Pros.create(p.fields || {}); }),
  updatePro: M(function (p) { return Pros.update(p.org_id, p.patch || {}, p.row_version); }),
  archivePro: M(function (p) { return Pros.archive(p.org_id, p.reason); }),
  restorePro: M(function (p) { return Pros.restore(p.org_id); }),
  provisionDrive: M(function (p) { return Folders.provisionFolder(p.org_id); }),

  /* ---- projects ---- */
  createProject: M(function (p) { return Projects.create(p.fields || {}); }),
  updateProject: M(function (p) { return Projects.update(p.project_id, p.patch || {}, p.row_version); }),
  archiveProject: M(function (p) { return Projects.archive(p.project_id, p.reason); }),
  restoreProject: M(function (p) { return Projects.restore(p.project_id); }),

  /* ---- tasks ---- */
  setTaskStatus: M(function (p) { return { tasks: Tasks.setStatus(p.task_id, p.status, p.row_version) }; }),
  createTask: M(function (p) { return Tasks.create(p); }),
  updateTask: M(function (p) { return Tasks.update(p.task_id, p.patch || {}, p.row_version); }),
  deleteTask: M(function (p) { return Tasks.remove(p.task_id); }),
  toggleChecklist: M(function (p) { return Tasks.toggleChecklist(p.task_id, p.item_id, p.checked); }),

  /* ---- notes / outstanding / timer ---- */
  addNote: M(function (p) { return Notes.add(p.entity_type, p.entity_id, p.body); }),
  editNote: M(function (p) { return Notes.edit(p.note_id, p.body); }),
  deleteNote: M(function (p) { return Notes.remove(p.note_id); }),
  addOutstanding: M(function (p) { return Outstanding.add(p); }),
  resolveOutstanding: M(function (p) { return Outstanding.setResolved(p.item_id, p.resolved); }),
  deleteOutstanding: M(function (p) { return Outstanding.remove(p.item_id); }),
  startTimer: M(function (p) { return Timer.start(p.project_id, p.force); }),
  stopTimer: M(function (p) { return Timer.stop(p.entry_id); }),

  /* ---- inbox + intake ---- */
  claimInbox: M(function (p) { return Sfdc.claim(p.id); }),
  dismissInbox: M(function (p) { return Sfdc.dismiss(p.id); }),
  uploadWorkbook: M(function (p) { return Intake.upload(p.org_id, p.filename, p.base64, p.entity_tab); }),
  reextractWorkbook: R(function (p) {
    var pro = Db.get('Pros', p.org_id);
    return Intake.extract(p.tabs, { roster: Identity.roster(), entityType: pro && pro.entity_type, entityTab: p.entity_tab });
  }),
  applyWorkbook: M(function (p) { return Intake.apply(p.org_id, p.rows || [], { filename: p.filename }); }),
  saveAnswer: M(function (p) { return Intake.saveAnswer(p.org_id, p.branch, p.question, p.answer, p.notes, 'WIZARD'); }),
  saveIntakeProgress: M(function (p) { return Intake.saveProgress(p.org_id, p.state || {}); }),

  /* ---- templates (admin) ---- */
  saveTemplate: ADMIN_M(function (p) { return Templates.save(p.template || {}); }),
  deleteTemplate: ADMIN_M(function (p) { return Templates.remove(p.template_id); }),
  reorderTemplates: ADMIN_M(function (p) { return Templates.reorder(p.scope, p.ids || []); }),
  publishTemplates: ADMIN_M(function (p) { return { version: Templates.publish(p.scope, p.note), versions: Templates.versions(p.scope) }; }),

  /* ---- preferences ---- */
  savePrefs: R(function (p, me) { return Prefs.save(me.email, p.prefs || {}); }),

  /* ---- admin ---- */
  saveSettings: ADMIN_M(function (p) { return Boot.saveSettings(p.settings || {}); }),
  runSfdcSync: ADMIN_M(function () { return Sfdc.sync(); }),
  importApply: ADMIN_M(function (p) { return Migration.apply(p.kind, p.csv, p.options || {}); }),
};

/* ---------------- per-user preferences ----------------
 * The web app runs as the deployer, so UserProperties would be shared by
 * everyone. Prefs are stored in script properties keyed by email instead.
 */
var Prefs = {
  DEFAULTS: {
    sidebar_collapsed: false, accent: 'blue', density: 'cozy', dark: false, pill: 'filled', nav: 'sidebar',
    detail_layout: 'drawer', feedback: 'inline', saved_views: { pros: [], projects: [] },
    recently_visited: { pros: [], projects: [] }, starred: { pros: [], projects: [] },
  },
  get: function (email) {
    var raw = PropertiesService.getScriptProperties().getProperty('prefs:' + email);
    var p = {};
    try { p = raw ? JSON.parse(raw) : {}; } catch (e) { p = {}; }
    var out = {};
    Object.keys(Prefs.DEFAULTS).forEach(function (k) { out[k] = k in p ? p[k] : Prefs.DEFAULTS[k]; });
    return out;
  },
  save: function (email, patch) {
    var cur = Prefs.get(email);
    Object.keys(patch).forEach(function (k) { if (k in Prefs.DEFAULTS) cur[k] = patch[k]; });
    var s = JSON.stringify(cur);
    if (s.length > 8000) throw new AppError('Preferences are too large — remove some saved views.');
    PropertiesService.getScriptProperties().setProperty('prefs:' + email, s);
    return cur;
  },
};

/* ---------------- payload builders ---------------- */

var Boot = {
  payload: function (me) {
    var today = todayIso_();
    var pros = Db.list('Pros');
    var projects = Db.list('Projects');
    var tasks = Db.list('Tasks');
    var proBy = {};
    pros.forEach(function (p) { proBy[p.org_id] = p; });
    var projBy = {};
    projects.forEach(function (p) { projBy[p.project_id] = p; });
    var taskBy = {};
    tasks.forEach(function (t) { taskBy[t.task_id] = t; });

    var prog = {};
    var projCount = {};
    tasks.forEach(function (t) {
      if (t.entity_type !== 'PROJECT' || t.status === 'SKIPPED') return;
      var a = prog[t.entity_id] || (prog[t.entity_id] = { d: 0, n: 0 });
      a.n++;
      if (t.status === 'DONE') a.d++;
    });
    projects.forEach(function (p) {
      var a = prog[p.project_id];
      p.progress = p.pipeline_status === 'COMPLETE' ? 100 : a && a.n ? Math.round((a.d / a.n) * 100) : 0;
      var pro = proBy[p.org_id];
      p.business_name = pro ? pro.business_name : p.org_id;
      if (!p.archived) projCount[p.org_id] = (projCount[p.org_id] || 0) + 1;
    });
    pros.forEach(function (p) {
      p.projects = projCount[p.org_id] || 0;
      delete p.intake_state;
    });

    var cutoff = addDays_(today, -14);
    var myTasks = tasks.filter(function (t) {
      if (t.assignee_email !== me.email) return false;
      if (t.status === 'DONE') return String(t.completed_at || '').slice(0, 10) >= cutoff;
      if (t.status === 'SKIPPED') return false;
      var rec = t.entity_type === 'PRO' ? proBy[t.entity_id] : projBy[t.entity_id];
      return rec && !rec.archived;
    }).map(function (t) { return Boot.decorateTask(t, proBy, projBy, taskBy); });

    var timer = Timer.running(me.email);
    if (timer) {
      var tp = projBy[timer.project_id];
      timer.label = tp ? (proBy[tp.org_id] ? proBy[tp.org_id].business_name : tp.org_id) + ' · TY' + tp.tax_year : timer.project_id;
    }

    return {
      user: { email: me.email, name: me.name, initials: me.initials, color: me.color, roles: me.roles, admin: Identity.hasRole(me, ['EXEC', 'ADMIN']) },
      prefs: Prefs.get(me.email),
      team: Identity.roster(),
      pros: pros,
      projects: projects,
      myTasks: myTasks,
      inbox: Sfdc.inbox(),
      timer: timer,
      config: {
        today: today,
        labels: LABELS,
        enums: ENUMS,
        timer_max_hours: Number(getProp_(PROP.TIMER_MAX_HOURS, DEFAULTS.TIMER_MAX_HOURS)),
        sfdc_last_sync: getProp_(PROP.LAST_SFDC_SYNC),
        url: Boot.url(),
      },
      server_time: nowIso_(),
    };
  },

  url: function () {
    try { return ScriptApp.getService().getUrl(); } catch (e) { return ''; }
  },

  decorateTask: function (t, proBy, projBy, taskBy) {
    var out = {};
    for (var k in t) out[k] = t[k];
    if (t.entity_type === 'PROJECT') {
      var p = projBy[t.entity_id];
      out.project_id = t.entity_id;
      out.org_id = p ? p.org_id : '';
      out.biz = p && proBy[p.org_id] ? proBy[p.org_id].business_name : t.entity_id;
      out.context = p ? (LABELS.FILING_TYPE[p.filing_type] || p.filing_type) + ' · TY' + p.tax_year : '';
    } else {
      out.org_id = t.entity_id;
      out.biz = proBy[t.entity_id] ? proBy[t.entity_id].business_name : t.entity_id;
      out.context = 'Pro';
    }
    out.blocked_count = String(t.blocked_by || '').split(',').filter(function (id) {
      return id && taskBy[id] && taskBy[id].status !== 'DONE';
    }).length;
    return out;
  },

  proDetail: function (orgId) {
    var pro = Db.get('Pros', orgId);
    if (!pro) throw new AppError('Pro ' + orgId + ' not found.', 'NOT_FOUND');
    var projects = Db.where('Projects', function (p) { return p.org_id === orgId; });
    projects.forEach(function (p) { p.business_name = pro.business_name; });
    return {
      pro: pro,
      projects: projects,
      tasks: Tasks.forEntity('PRO', orgId),
      notes: Notes.forEntity('PRO', orgId),
      audit: Audit.forEntity('PRO', orgId, 100),
      answers: Intake.answers(orgId),
      queue: Db.where('SfdcIntakeQueue', function (q) { return q.org_id === orgId; })[0] || null,
    };
  },

  projectDetail: function (projectId) {
    var project = Db.get('Projects', projectId);
    if (!project) throw new AppError('Project ' + projectId + ' not found.', 'NOT_FOUND');
    var pro = Db.get('Pros', project.org_id);
    project.business_name = pro ? pro.business_name : project.org_id;
    return {
      project: project,
      pro: pro,
      tasks: Tasks.forEntity('PROJECT', projectId),
      notes: Notes.forEntity('PROJECT', projectId),
      audit: Audit.forEntity('PROJECT', projectId, 100),
      history: Stages.forProject(projectId),
      time: Timer.forProject(projectId),
      outstanding: Outstanding.forProject(projectId),
    };
  },

  intake: function (orgId) {
    var d = Boot.proDetail(orgId);
    var loads = Assign.loads();
    // The balanced pick ignores this pro's own current assignment, so the
    // advisor it was auto-assigned to isn't penalized for holding it.
    var cur = d.pro.assigned_advisor_email;
    var without = loads.map(function (l) {
      return l.email === cur && !d.pro.archived ? { email: l.email, name: l.name, count: l.count - 1, accepting: l.accepting, lastAssigned: l.lastAssigned } : l;
    });
    return {
      pro: d.pro,
      projects: d.projects,
      tasks: d.tasks,
      answers: d.answers,
      queue: d.queue,
      loads: loads,
      suggested_advisor: Assign.nextAdvisor(without),
      questions: INTAKE_QUESTIONS,
      drive_configured: !!getProp_(PROP.DRIVE_PARENT),
      drive_parent_name: Boot.driveParentName(),
    };
  },

  driveParentName: function () {
    var id = getProp_(PROP.DRIVE_PARENT);
    if (!id) return '';
    try { return DriveApp.getFolderById(id).getName(); } catch (e) { return '(folder not accessible)'; }
  },

  settings: function () {
    var last = getProp_(PROP.LAST_SFDC_RESULT);
    return {
      db_url: Db.spreadsheet().getUrl(),
      sfdc_sheet_id: getProp_(PROP.SFDC_SHEET_ID),
      sfdc_tab: getProp_(PROP.SFDC_TAB),
      drive_parent_id: getProp_(PROP.DRIVE_PARENT),
      drive_parent_name: Boot.driveParentName(),
      email_domain: getProp_(PROP.EMAIL_DOMAIN, DEFAULTS.EMAIL_DOMAIN),
      timer_max_hours: Number(getProp_(PROP.TIMER_MAX_HOURS, DEFAULTS.TIMER_MAX_HOURS)),
      sfdc_last_sync: getProp_(PROP.LAST_SFDC_SYNC),
      sfdc_last_result: last ? JSON.parse(last) : null,
      triggers: ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); }),
      url: Boot.url(),
    };
  },

  saveSettings: function (s) {
    function idFrom(v) {
      var m = String(v || '').match(/[-\w]{25,}/);
      return m ? m[0] : String(v || '').trim();
    }
    if ('sfdc_sheet_id' in s) setProp_(PROP.SFDC_SHEET_ID, idFrom(s.sfdc_sheet_id));
    if ('sfdc_tab' in s) setProp_(PROP.SFDC_TAB, String(s.sfdc_tab || '').trim());
    if ('drive_parent_id' in s) setProp_(PROP.DRIVE_PARENT, idFrom(s.drive_parent_id));
    if ('email_domain' in s) setProp_(PROP.EMAIL_DOMAIN, String(s.email_domain || '').replace(/^@/, '').trim());
    if ('timer_max_hours' in s) {
      var h = Number(s.timer_max_hours);
      if (!(h > 0 && h <= 24)) throw new AppError('Timer max must be between 1 and 24 hours.');
      setProp_(PROP.TIMER_MAX_HOURS, h);
    }
    Setup.installTriggers();
    return Boot.settings();
  },
};
