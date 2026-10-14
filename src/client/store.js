/**
 * Client store: one global state object, a SyncBus for the topbar pill,
 * toasts, and every action the UI can take. Mutations are optimistic: the UI
 * updates immediately, the server call runs in the background, and failures
 * roll back with a "Couldn't save … — try again" toast.
 */
import { useSyncExternalStore } from 'react';
import { api } from './api.js';
import { initConfig } from './util.js';

let state = {
  ready: false,
  bootError: null,
  user: null,
  prefs: {},
  team: [],
  teamBy: {},
  pros: [],
  projects: [],
  myTasks: [],
  inbox: [],
  reviews: [],
  timer: null,
  config: {},
  details: { pro: {}, project: {} },
  sync: { phase: 'idle', label: '', ts: Date.now(), retry: null },
  toasts: [],
  flash: null,
  justSaved: {},
  loading: {},
};
const listeners = new Set();

export function getState() { return state; }

export function setState(patch) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(l) { listeners.add(l); return () => listeners.delete(l); }

export function useStore(selector) {
  return useSyncExternalStore(subscribe, () => selector(state));
}

/* ---------------- boot ---------------- */

export function applyBoot(data) {
  initConfig(data.config || {});
  const teamBy = {};
  (data.team || []).forEach((m) => { teamBy[m.email] = m; });
  setState({
    ready: true,
    bootError: null,
    user: data.user,
    prefs: data.prefs || {},
    team: data.team || [],
    teamBy,
    pros: data.pros || [],
    projects: data.projects || [],
    myTasks: data.myTasks || [],
    inbox: data.inbox || [],
    reviews: data.reviews || [],
    timer: data.timer || null,
    config: data.config || {},
    details: { pro: {}, project: {} },
  });
}

export async function refreshAll() {
  syncStart('latest data');
  try {
    const data = await api('refresh');
    const keep = state.details;
    applyBoot(data);
    setState({ details: keep });
    syncDone();
    // re-fetch any open drawers quietly
    Object.keys(keep.pro).forEach((id) => loadPro(id, true));
    Object.keys(keep.project).forEach((id) => loadProject(id, true));
  } catch (e) {
    syncFail('refresh', () => refreshAll());
    toast('error', 'Couldn\'t refresh — ' + e.message);
  }
}

/* ---------------- sync bus ---------------- */

let inflight = 0;
export function syncStart(label) {
  inflight++;
  setState({ sync: { phase: 'saving', label, ts: Date.now(), retry: null } });
}
export function syncDone() {
  inflight = Math.max(0, inflight - 1);
  if (inflight === 0) setState({ sync: { phase: 'idle', label: '', ts: Date.now(), retry: null } });
}
export function syncFail(label, retry) {
  inflight = Math.max(0, inflight - 1);
  setState({ sync: { phase: 'error', label, ts: Date.now(), retry } });
}

/* ---------------- toasts / flash ---------------- */

let toastId = 0;
export function toast(kind, msg, action) {
  const id = ++toastId;
  setState((s) => ({ toasts: [...s.toasts, { id, kind, msg, action }] }));
  setTimeout(() => dismissToast(id), kind === 'error' ? 9000 : 4000);
  return id;
}
export function dismissToast(id) {
  setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}
export function flash(kind, msg) {
  if ((state.prefs.feedback || 'inline') === 'toast') { toast(kind, msg); return; }
  setState({ flash: { kind, msg, at: Date.now() } });
}
export function clearFlash() { setState({ flash: null }); }

function markSaved(key) {
  setState((s) => ({ justSaved: { ...s.justSaved, [key]: Date.now() } }));
  setTimeout(() => setState((s) => { const j = { ...s.justSaved }; delete j[key]; return { justSaved: j }; }), 1500);
}

/**
 * Run a mutation with optimistic update + rollback.
 *   optimistic(): applies the local change and returns an undo function
 *   apply(data): merges the server's response
 */
/**
 * The server saves one change at a time. When it answers BUSY (another save
 * held the lock past the wait), try again quietly before bothering anyone.
 */
export const BUSY_RETRY_MS = [1500, 4000, 8000];
// Safe to resend after a dropped connection (common right after the tab sat in
// the background): the server ignores a duplicate start/stop.
const NETWORK_SAFE = new Set(['startTimer', 'stopTimer', 'getTimer', 'refresh', 'bootstrap', 'setTaskStatus']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function apiRetry(action, payload) {
  for (let i = 0; ; i++) {
    try {
      return await api(action, payload);
    } catch (e) {
      const retryable = e.code === 'BUSY' || (e.code === 'NETWORK' && NETWORK_SAFE.has(action));
      if (!retryable || i >= BUSY_RETRY_MS.length) throw e;
      await sleep(BUSY_RETRY_MS[i]);
    }
  }
}

export async function mutate({ label, what, action, payload, optimistic, apply, savedKey, quiet }) {
  const undo = optimistic ? optimistic() : null;
  syncStart(label);
  try {
    const data = await apiRetry(action, payload);
    if (apply) apply(data);
    syncDone();
    if (savedKey) markSaved(savedKey);
    return data;
  } catch (e) {
    if (undo) undo();
    const retry = () => mutate({ label, what, action, payload, optimistic, apply, savedKey, quiet });
    syncFail(label, retry);
    if (!quiet) {
      const msg = e.code === 'CONFLICT' || e.code === 'VALIDATION' || e.code === 'FORBIDDEN' || !what
        ? e.message
        : `Couldn't save "${what}" — ${e.message}`;
      toast('error', msg, e.code === 'CONFLICT' ? { label: 'Refresh', fn: refreshAll } : { label: 'Retry', fn: retry });
    }
    const err = new Error(e.message);
    err.code = e.code;
    err.handled = true;
    throw err;
  }
}

/* ---------------- record merging ---------------- */

function decorateMyTask(t) {
  const s = state;
  const out = { ...t };
  if (t.entity_type === 'PROJECT') {
    const p = s.projects.find((x) => x.project_id === t.entity_id);
    out.project_id = t.entity_id;
    out.org_id = p ? p.org_id : '';
    out.biz = p ? p.business_name : t.entity_id;
    out.context = p ? `${(s.config.labels.FILING_TYPE || {})[p.filing_type] || p.filing_type} · TY${p.tax_year}` : '';
  } else {
    const pro = s.pros.find((x) => x.org_id === t.entity_id);
    out.org_id = t.entity_id;
    out.biz = pro ? pro.business_name : t.entity_id;
    out.context = 'Pro';
  }
  const prev = s.myTasks.find((x) => x.task_id === t.task_id);
  out.blocked_count = prev ? prev.blocked_count : 0;
  return out;
}

export function mergeTasks(tasks) {
  if (!tasks || !tasks.length) return;
  setState((s) => {
    const details = { pro: { ...s.details.pro }, project: { ...s.details.project } };
    const touchedProjects = new Set();
    tasks.forEach((t) => {
      const bucket = t.entity_type === 'PRO' ? details.pro : details.project;
      const d = bucket[t.entity_id];
      if (d) {
        const i = d.tasks.findIndex((x) => x.task_id === t.task_id);
        const list = d.tasks.slice();
        if (i >= 0) list[i] = { ...list[i], ...t }; else list.push(t);
        bucket[t.entity_id] = { ...d, tasks: list };
      }
      if (t.entity_type === 'PROJECT') touchedProjects.add(t.entity_id);
    });
    const me = s.user && s.user.email;
    let myTasks = s.myTasks.slice();
    tasks.forEach((t) => {
      const i = myTasks.findIndex((x) => x.task_id === t.task_id);
      if (t.assignee_email === me) {
        const dec = decorateMyTask(t);
        if (i >= 0) myTasks[i] = { ...myTasks[i], ...dec, blocked_count: myTasks[i].blocked_count };
        else myTasks.push(dec);
      } else if (i >= 0) {
        myTasks.splice(i, 1);
      }
    });
    // unblock counts for tasks that were blocked by one of these
    const doneIds = new Set(tasks.filter((t) => t.status === 'DONE').map((t) => t.task_id));
    myTasks = myTasks.map((t) => {
      if (!t.blocked_by) return t;
      const ids = String(t.blocked_by).split(',').filter(Boolean);
      const allTasks = [];
      Object.values(details.project).forEach((d) => allTasks.push(...d.tasks));
      Object.values(details.pro).forEach((d) => allTasks.push(...d.tasks));
      const known = ids.map((id) => allTasks.find((x) => x.task_id === id)).filter(Boolean);
      if (!known.length && !ids.some((id) => doneIds.has(id))) return t;
      const open = ids.filter((id) => {
        if (doneIds.has(id)) return false;
        const k = allTasks.find((x) => x.task_id === id);
        return k ? k.status !== 'DONE' : true;
      }).length;
      return { ...t, blocked_count: open };
    });
    let projects = s.projects;
    if (touchedProjects.size) {
      projects = s.projects.map((p) => {
        if (!touchedProjects.has(p.project_id) || !details.project[p.project_id]) return p;
        const list = details.project[p.project_id].tasks.filter((t) => t.status !== 'SKIPPED');
        const pct = p.pipeline_status === 'COMPLETE' ? 100 : list.length ? Math.round((list.filter((t) => t.status === 'DONE').length / list.length) * 100) : 0;
        return pct === p.progress ? p : { ...p, progress: pct };
      });
    }
    return { details, myTasks, projects };
  });
}

export function removeTasks(ids) {
  const set = new Set(ids);
  setState((s) => {
    const details = { pro: { ...s.details.pro }, project: { ...s.details.project } };
    ['pro', 'project'].forEach((k) => {
      Object.keys(details[k]).forEach((id) => {
        const d = details[k][id];
        if (d.tasks.some((t) => set.has(t.task_id))) details[k][id] = { ...d, tasks: d.tasks.filter((t) => !set.has(t.task_id)) };
      });
    });
    return { details, myTasks: s.myTasks.filter((t) => !set.has(t.task_id)) };
  });
}

/** A rollback or a stale payload must never move a record's version backwards. */
function maxVersion(cur, incoming) {
  return Math.max(Number((cur && cur.row_version) || 0), Number((incoming && incoming.row_version) || 0)) || undefined;
}

export function mergePro(pro) {
  if (!pro) return;
  setState((s) => {
    const i = s.pros.findIndex((p) => p.org_id === pro.org_id);
    const pros = s.pros.slice();
    if (i >= 0) pros[i] = { ...pros[i], ...pro, projects: pros[i].projects, row_version: maxVersion(pros[i], pro) };
    else pros.push({ projects: 0, ...pro });
    const details = { ...s.details, pro: { ...s.details.pro } };
    if (details.pro[pro.org_id]) details.pro[pro.org_id] = { ...details.pro[pro.org_id], pro: { ...details.pro[pro.org_id].pro, ...pro } };
    const projects = s.projects.map((p) => (p.org_id === pro.org_id && p.business_name !== pro.business_name ? { ...p, business_name: pro.business_name } : p));
    return { pros, details, projects };
  });
}

export function mergeProject(project) {
  if (!project) return;
  setState((s) => {
    const pro = s.pros.find((p) => p.org_id === project.org_id);
    const i = s.projects.findIndex((p) => p.project_id === project.project_id);
    const projects = s.projects.slice();
    const merged = { progress: 0, ...(i >= 0 ? projects[i] : {}), ...project, business_name: pro ? pro.business_name : project.org_id, row_version: maxVersion(i >= 0 ? projects[i] : null, project) };
    if (merged.pipeline_status === 'COMPLETE') merged.progress = 100;
    if (i >= 0) projects[i] = merged; else projects.push(merged);
    const details = { pro: { ...s.details.pro }, project: { ...s.details.project } };
    if (details.project[project.project_id]) {
      details.project[project.project_id] = { ...details.project[project.project_id], project: { ...details.project[project.project_id].project, ...merged } };
    }
    const pd = details.pro[project.org_id];
    if (pd) {
      const j = pd.projects.findIndex((p) => p.project_id === project.project_id);
      const list = pd.projects.slice();
      if (j >= 0) list[j] = { ...list[j], ...merged }; else list.push(merged);
      details.pro[project.org_id] = { ...pd, projects: list };
    }
    const pros = s.pros.map((p) => (p.org_id === project.org_id
      ? { ...p, projects: projects.filter((x) => x.org_id === p.org_id && !x.archived).length }
      : p));
    return { projects, details, pros };
  });
}

function patchDetail(kind, id, fn) {
  setState((s) => {
    const d = s.details[kind][id];
    if (!d) return {};
    return { details: { ...s.details, [kind]: { ...s.details[kind], [id]: fn(d) } } };
  });
}

/* ---------------- detail loading ---------------- */

export async function loadPro(orgId, force) {
  if (!force && state.details.pro[orgId]) return state.details.pro[orgId];
  setState((s) => ({ loading: { ...s.loading, ['pro:' + orgId]: true } }));
  try {
    const d = await api('getProDetail', { org_id: orgId });
    setState((s) => ({ details: { ...s.details, pro: { ...s.details.pro, [orgId]: d } }, loading: { ...s.loading, ['pro:' + orgId]: false } }));
    mergePro(d.pro);
    return d;
  } catch (e) {
    setState((s) => ({ loading: { ...s.loading, ['pro:' + orgId]: e.message || 'error' } }));
    return null;
  }
}

export async function loadProject(projectId, force) {
  if (!force && state.details.project[projectId]) return state.details.project[projectId];
  setState((s) => ({ loading: { ...s.loading, ['project:' + projectId]: true } }));
  try {
    const d = await api('getProjectDetail', { project_id: projectId });
    setState((s) => ({ details: { ...s.details, project: { ...s.details.project, [projectId]: d } }, loading: { ...s.loading, ['project:' + projectId]: false } }));
    mergeProject(d.project);
    return d;
  } catch (e) {
    setState((s) => ({ loading: { ...s.loading, ['project:' + projectId]: e.message || 'error' } }));
    return null;
  }
}

/* ---------------- prefs ---------------- */

let prefTimer = null;
let prefPending = {};
export function savePrefs(patch) {
  setState((s) => ({ prefs: { ...s.prefs, ...patch } }));
  prefPending = { ...prefPending, ...patch };
  clearTimeout(prefTimer);
  prefTimer = setTimeout(() => {
    const p = prefPending;
    prefPending = {};
    api('savePrefs', { prefs: p }).catch(() => { /* prefs are best-effort */ });
  }, 600);
}

export function noteVisited(kind, id) {
  const rv = state.prefs.recently_visited || { pros: [], projects: [] };
  const key = kind === 'pro' ? 'pros' : 'projects';
  const list = [id, ...(rv[key] || []).filter((x) => x !== id)].slice(0, 10);
  if ((rv[key] || [])[0] === id) return;
  savePrefs({ recently_visited: { ...rv, [key]: list } });
}

export function toggleStar(kind, id) {
  const st = state.prefs.starred || { pros: [], projects: [] };
  const key = kind === 'pro' ? 'pros' : 'projects';
  const cur = st[key] || [];
  savePrefs({ starred: { ...st, [key]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] } });
}

/* ---------------- task actions ---------------- */

function findTask(taskId) {
  for (const k of ['pro', 'project']) {
    for (const d of Object.values(state.details[k])) {
      const t = d.tasks.find((x) => x.task_id === taskId);
      if (t) return t;
    }
  }
  return state.myTasks.find((x) => x.task_id === taskId) || null;
}

/** Local mirror of the server cascade so the optimistic view matches. */
function cascadeLocal(task, status) {
  const d = task.entity_type === 'PRO' ? state.details.pro[task.entity_id] : state.details.project[task.entity_id];
  const changes = [{ ...task, status }];
  if (!d) return changes;
  if (status === 'DONE') d.tasks.filter((c) => c.parent_task_id === task.task_id && c.status !== 'DONE').forEach((c) => changes.push({ ...c, status: 'DONE' }));
  if (task.parent_task_id) {
    const parent = d.tasks.find((x) => x.task_id === task.parent_task_id);
    if (parent) {
      const sibs = d.tasks.filter((c) => c.parent_task_id === parent.task_id).map((c) => (c.task_id === task.task_id ? { ...c, status } : c));
      const allDone = sibs.every((c) => c.status === 'DONE');
      if (allDone && parent.status !== 'DONE') changes.push({ ...parent, status: 'DONE' });
      if (!allDone && parent.status === 'DONE') changes.push({ ...parent, status: 'IN_PROGRESS' });
    }
  }
  return changes;
}

export function toggleTask(taskOrId) {
  const task = typeof taskOrId === 'string' ? findTask(taskOrId) : taskOrId;
  if (!task) return Promise.resolve();
  const status = task.status === 'DONE' ? 'IN_PROGRESS' : 'DONE';
  const before = cascadeLocal(task, status).map((c) => findTask(c.task_id) || c);
  return mutate({
    label: 'task', what: task.title, action: 'setTaskStatus', payload: { task_id: task.task_id, status },
    savedKey: 'task:' + task.task_id,
    optimistic: () => { mergeTasks(cascadeLocal(task, status)); return () => mergeTasks(before); },
    apply: (d) => mergeTasks(d.tasks),
  }).catch(() => {});
}

export function createTask(fields) {
  const tempId = 'tmp-' + Math.random().toString(36).slice(2);
  const temp = { task_id: tempId, status: 'NOT_STARTED', sort_order: 9999, checklist: null, blocked_by: '', ...fields };
  return mutate({
    label: 'task', what: fields.title, action: 'createTask', payload: fields,
    optimistic: () => { mergeTasks([temp]); return () => removeTasks([tempId]); },
    apply: (t) => { removeTasks([tempId]); mergeTasks([t]); },
  }).catch(() => {});
}

export function updateTask(task, patch) {
  const before = { ...task };
  return mutate({
    label: 'task', what: task.title, action: 'updateTask', payload: { task_id: task.task_id, patch },
    savedKey: 'task:' + task.task_id,
    optimistic: () => { mergeTasks([{ ...task, ...patch }]); return () => mergeTasks([before]); },
    apply: (t) => mergeTasks([t]),
  }).catch(() => {});
}

export function deleteTask(task) {
  const d = task.entity_type === 'PRO' ? state.details.pro[task.entity_id] : state.details.project[task.entity_id];
  const removed = d ? d.tasks.filter((t) => t.task_id === task.task_id || t.parent_task_id === task.task_id) : [task];
  return mutate({
    label: 'task', what: task.title, action: 'deleteTask', payload: { task_id: task.task_id },
    optimistic: () => { removeTasks(removed.map((t) => t.task_id)); return () => mergeTasks(removed); },
  }).catch(() => {});
}

export function toggleChecklistItem(task, itemId, checked) {
  const list = (task.checklist || []).map((c) => (c.id === itemId ? { ...c, checked } : c));
  return mutate({
    label: 'checklist', what: task.title, action: 'toggleChecklist', payload: { task_id: task.task_id, item_id: itemId, checked },
    optimistic: () => { mergeTasks([{ ...task, checklist: list }]); return () => mergeTasks([task]); },
    apply: (t) => mergeTasks([t]),
  }).catch(() => {});
}

/* ---------------- record actions ---------------- */

/*
 * Edits to one record run one at a time, and each reads the latest row_version
 * when it's sent — so two quick edits don't collide with each other. The
 * optimistic change shows immediately; a failure rolls back only the fields
 * that edit touched.
 */
const recordQueues = {};
function enqueue(key, fn) {
  const prev = recordQueues[key] || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  recordQueues[key] = next.catch(() => {});
  return next;
}
function pick(obj, keys) {
  const out = {};
  keys.forEach((k) => { out[k] = obj[k] == null ? null : obj[k]; });
  return out;
}

export function updatePro(pro, patch, what) {
  const id = pro.org_id;
  const before = state.pros.find((p) => p.org_id === id) || pro;
  const undoFields = { org_id: id, ...pick(before, Object.keys(patch)) };
  mergePro({ org_id: id, ...patch });
  return enqueue('pro:' + id, () => {
    const cur = state.pros.find((p) => p.org_id === id) || before;
    return mutate({
      label: 'field', what: what || 'pro', action: 'updatePro',
      payload: { org_id: id, patch, row_version: cur.row_version },
      savedKey: 'pro:' + id,
      optimistic: () => () => mergePro(undoFields),
      apply: (d) => { mergePro(d.pro); mergeTasks(d.tasks); (d.projects || []).forEach(mergeProject); },
    });
  });
}

export function updateProject(project, patch, what) {
  const id = project.project_id;
  const before = state.projects.find((p) => p.project_id === id) || project;
  const undoFields = { project_id: id, org_id: before.org_id, ...pick(before, Object.keys(patch)) };
  const stage = 'pipeline_status' in patch;
  mergeProject({ project_id: id, org_id: before.org_id, ...patch });
  return enqueue('project:' + id, () => {
    const cur = state.projects.find((p) => p.project_id === id) || before;
    return mutate({
      label: stage ? 'stage' : 'field', what: what || (before.business_name + ' · TY' + before.tax_year), action: 'updateProject',
      payload: { project_id: id, patch, row_version: cur.row_version },
      savedKey: 'project:' + id,
      optimistic: () => () => mergeProject(undoFields),
      apply: (d) => {
        mergeProject(d.project);
        mergeTasks(d.tasks);
        if (stage && state.details.project[id]) loadProject(id, true);
      },
    });
  });
}

export async function createPro(fields) {
  const pro = await mutate({ label: 'pro', what: fields.business_name, action: 'createPro', payload: { fields } });
  mergePro({ ...pro, projects: 0 });
  return pro;
}

export async function createProject(fields) {
  const res = await mutate({ label: 'project', what: 'new project', action: 'createProject', payload: { fields } });
  mergeProject(res.project);
  if (res.pro) mergePro(res.pro);
  if (state.details.pro[res.project.org_id]) loadPro(res.project.org_id, true);
  return res.project;
}

export async function archiveRecord(kind, rec, reason) {
  if (kind === 'pro') {
    const p = await mutate({ label: 'archive', what: rec.business_name, action: 'archivePro', payload: { org_id: rec.org_id, reason } });
    mergePro(p);
  } else {
    const p = await mutate({ label: 'archive', what: rec.project_id, action: 'archiveProject', payload: { project_id: rec.project_id, reason } });
    mergeProject(p);
  }
}

export async function restoreRecord(kind, rec) {
  if (kind === 'pro') {
    const p = await mutate({ label: 'restore', what: rec.business_name, action: 'restorePro', payload: { org_id: rec.org_id }, savedKey: 'restore:' + rec.org_id });
    mergePro(p);
  } else {
    const p = await mutate({ label: 'restore', what: rec.project_id, action: 'restoreProject', payload: { project_id: rec.project_id }, savedKey: 'restore:' + rec.project_id });
    mergeProject(p);
  }
}

/* ---------------- notes / outstanding ---------------- */

function detailKind(entityType) { return entityType === 'PRO' ? 'pro' : 'project'; }

export function addNote(entityType, entityId, body) {
  const tempId = 'tmp-' + Date.now();
  const temp = { note_id: tempId, entity_type: entityType, entity_id: entityId, author_email: state.user.email, body, created_at: new Date().toISOString() };
  const kind = detailKind(entityType);
  return mutate({
    label: 'note', what: 'note', action: 'addNote', payload: { entity_type: entityType, entity_id: entityId, body },
    optimistic: () => {
      patchDetail(kind, entityId, (d) => ({ ...d, notes: [...d.notes, temp] }));
      return () => patchDetail(kind, entityId, (d) => ({ ...d, notes: d.notes.filter((n) => n.note_id !== tempId) }));
    },
    apply: (n) => patchDetail(kind, entityId, (d) => ({ ...d, notes: d.notes.map((x) => (x.note_id === tempId ? n : x)) })),
  }).catch(() => {});
}

export function editNote(note, body) {
  const kind = detailKind(note.entity_type);
  const swap = (n) => patchDetail(kind, note.entity_id, (d) => ({ ...d, notes: d.notes.map((x) => (x.note_id === note.note_id ? n : x)) }));
  return mutate({
    label: 'note', what: 'note', action: 'editNote', payload: { note_id: note.note_id, body },
    optimistic: () => { swap({ ...note, body, edited_at: new Date().toISOString() }); return () => swap(note); },
    apply: swap,
  }).catch(() => {});
}

export function deleteNote(note) {
  const kind = detailKind(note.entity_type);
  return mutate({
    label: 'note', what: 'note', action: 'deleteNote', payload: { note_id: note.note_id },
    optimistic: () => {
      patchDetail(kind, note.entity_id, (d) => ({ ...d, notes: d.notes.filter((x) => x.note_id !== note.note_id) }));
      return () => patchDetail(kind, note.entity_id, (d) => ({ ...d, notes: [...d.notes, note].sort((a, b) => (a.created_at < b.created_at ? -1 : 1)) }));
    },
  }).catch(() => {});
}

export function addOutstanding(projectId, item) {
  const tempId = 'tmp-' + Date.now();
  const temp = { item_id: tempId, project_id: projectId, resolved: false, created_at: new Date().toISOString(), ...item };
  return mutate({
    label: 'outstanding item', what: item.item, action: 'addOutstanding', payload: { project_id: projectId, ...item },
    optimistic: () => {
      patchDetail('project', projectId, (d) => ({ ...d, outstanding: [...d.outstanding, temp] }));
      return () => patchDetail('project', projectId, (d) => ({ ...d, outstanding: d.outstanding.filter((x) => x.item_id !== tempId) }));
    },
    apply: (row) => patchDetail('project', projectId, (d) => ({ ...d, outstanding: d.outstanding.map((x) => (x.item_id === tempId ? row : x)) })),
  }).catch(() => {});
}

export function resolveOutstanding(it, resolved) {
  const swap = (row) => patchDetail('project', it.project_id, (d) => ({ ...d, outstanding: d.outstanding.map((x) => (x.item_id === it.item_id ? row : x)) }));
  return mutate({
    label: 'outstanding item', what: it.item, action: 'resolveOutstanding', payload: { item_id: it.item_id, resolved },
    optimistic: () => { swap({ ...it, resolved }); return () => swap(it); },
    apply: swap,
  }).catch(() => {});
}

export function deleteOutstanding(it) {
  return mutate({
    label: 'outstanding item', what: it.item, action: 'deleteOutstanding', payload: { item_id: it.item_id },
    optimistic: () => {
      patchDetail('project', it.project_id, (d) => ({ ...d, outstanding: d.outstanding.filter((x) => x.item_id !== it.item_id) }));
      return () => patchDetail('project', it.project_id, (d) => ({ ...d, outstanding: [...d.outstanding, it] }));
    },
  }).catch(() => {});
}

/* ---------------- timer ---------------- */

export async function startTimer(project, force) {
  const res = await mutate({ label: 'timer start', what: 'timer', action: 'startTimer', payload: { project_id: project.project_id, force: !!force } });
  if (res.conflict) return res;
  const label = project.business_name + ' · TY' + project.tax_year;
  setState({ timer: { ...res.entry, label } });
  patchDetail('project', project.project_id, (d) => ({ ...d, time: [...d.time.filter((e) => e.entry_id !== res.entry.entry_id), res.entry] }));
  if (res.stopped) {
    patchDetail('project', res.stopped.project_id, (d) => ({ ...d, time: d.time.map((e) => (e.entry_id === res.stopped.entry_id ? res.stopped : e)) }));
    toast('success', 'Stopped the other timer and logged ' + Math.round(res.stopped.duration_min || 0) + ' min.');
  }
  return res;
}

const PENDING_STOP = 'tm-pending-stop';
function savePendingStop(v) {
  try { if (v) localStorage.setItem(PENDING_STOP, JSON.stringify(v)); else localStorage.removeItem(PENDING_STOP); } catch (e) { /* storage blocked */ }
}
function readPendingStop() {
  try { return JSON.parse(localStorage.getItem(PENDING_STOP) || 'null'); } catch (e) { return null; }
}

/**
 * Stop and log. The click time is sent with the request and kept until the
 * server confirms, so a failed or retried save (even after a reload) logs the
 * time the person actually clicked Stop.
 */
export async function stopTimer() {
  const t = state.timer;
  if (!t) return;
  const at = t.stopAt || new Date().toISOString();
  savePendingStop({ entry_id: t.entry_id, at, label: t.label });
  setState({ timer: null });
  try {
    const e = await mutate({ label: 'time entry', what: 'time entry', action: 'stopTimer', payload: { entry_id: t.entry_id, at } });
    savePendingStop(null);
    patchDetail('project', e.project_id, (d) => ({ ...d, time: d.time.map((x) => (x.entry_id === e.entry_id ? e : x)) }));
    toast(e.auto_stopped ? 'error' : 'success',
      e.auto_stopped ? e.note : 'Logged ' + Math.floor(e.duration_min / 60) + 'h ' + (e.duration_min % 60) + 'm on ' + t.label);
  } catch (err) {
    setState({ timer: { ...t, stopAt: at } }); // chip comes back; clicking it retries with the same stop time
  }
}

/**
 * The server owns the timer. Re-read it when the tab comes back into view
 * (and every few minutes while it's open), so another tab, an auto-stop, or a
 * sleeping laptop never leaves a stale timer on screen. Also finishes any stop
 * that didn't save before the page was closed.
 */
let lastTimerSync = 0;
export async function syncTimer(reason) {
  if (Date.now() - lastTimerSync < 5000 && reason !== 'boot') return;
  lastTimerSync = Date.now();
  const pending = readPendingStop();
  try {
    const server = await apiRetry('getTimer', {});
    if (pending && server && server.entry_id === pending.entry_id) {
      setState({ timer: { ...server, stopAt: pending.at } });
      return stopTimer();
    }
    if (pending) savePendingStop(null);
    const local = state.timer;
    if (local && local.stopAt) return; // a stop is waiting on a retry click
    if (!server && local) {
      setState({ timer: null });
      toast('success', 'Your timer on ' + local.label + ' was stopped (in another tab, or by the 8-hour auto-stop). Time & stages has the entry.');
    } else if (server && (!local || local.entry_id !== server.entry_id)) {
      setState({ timer: server });
    }
    const running = state.timer;
    if (running && reason === 'visible') {
      const h = (Date.now() - new Date(running.started_at).getTime()) / 3600000;
      if (h >= 3) toast('success', 'Your timer on ' + running.label + ' has been running ' + Math.floor(h) + 'h. Still working?', { label: 'Stop & log', fn: stopTimer });
    }
  } catch (e) { /* offline: try again next time */ }
}

export function startTimerSync() {
  if (typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncTimer('visible'); });
  window.addEventListener('focus', () => syncTimer('visible'));
  setInterval(() => { if (document.visibilityState === 'visible') syncTimer('interval'); }, 3 * 60 * 1000);
  syncTimer('boot');
}

/* ---------------- inbox ---------------- */

export async function claimInbox(item) {
  const res = await mutate({
    label: 'claim', what: item.business_name, action: 'claimInbox', payload: { id: item.sfdc_opportunity_id },
    optimistic: () => {
      const prev = state.inbox;
      setState({ inbox: prev.filter((q) => q.sfdc_opportunity_id !== item.sfdc_opportunity_id) });
      return () => setState({ inbox: prev });
    },
  });
  mergePro(res.pro);
  mergeTasks(res.tasks);
  setState((s) => ({ myTasks: s.myTasks }));
  return res;
}

export function dismissInbox(item) {
  return mutate({
    label: 'inbox', what: item.business_name, action: 'dismissInbox', payload: { id: item.sfdc_opportunity_id },
    optimistic: () => {
      const prev = state.inbox;
      setState({ inbox: prev.filter((q) => q.sfdc_opportunity_id !== item.sfdc_opportunity_id) });
      return () => setState({ inbox: prev });
    },
  }).catch(() => {});
}

/* ---------------- peer review ---------------- */

export const OPEN_REVIEW = ['SUBMITTED', 'IN_REVIEW', 'REWORK'];

export function mergeReview(r) {
  if (!r) return;
  setState((s) => {
    const reviews = s.reviews.filter((x) => x.review_id !== r.review_id);
    if (OPEN_REVIEW.includes(r.status)) reviews.unshift(r);
    const d = s.details.project[r.project_id];
    if (!d) return { reviews };
    const list = (d.reviews || []).filter((x) => x.review_id !== r.review_id);
    return { reviews, details: { ...s.details, project: { ...s.details.project, [r.project_id]: { ...d, reviews: [r, ...list] } } } };
  });
}

/** Pull the open queue fresh (teammates claim and resubmit from their own screens). */
export async function refreshReviews() {
  try { setState({ reviews: await api('getPeerReviews', {}) }); } catch (e) { /* keep what we have */ }
}

/** Every review step returns { review, project, tasks }; the project detail reloads to pick up notes + stage history. */
export async function peerReviewAction(action, payload, what) {
  const res = await mutate({ label: 'peer review', what, action, payload });
  mergeReview(res.review);
  if (res.project) mergeProject(res.project);
  mergeTasks(res.tasks);
  if (res.review && state.details.project[res.review.project_id]) loadProject(res.review.project_id, true);
  return res;
}

export { api };
