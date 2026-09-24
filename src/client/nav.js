/* Opening records: side drawer (default) or full page, plus prev/next order. */
import { getState, noteVisited } from './store.js';
import { navigate, patchRoute, getRoute } from './router.js';

const listOrder = { pro: [], project: [] };

export function setListOrder(kind, ids) { listOrder[kind] = ids; }

export function getListOrder(kind) {
  if (listOrder[kind] && listOrder[kind].length) return listOrder[kind];
  const s = getState();
  return kind === 'pro' ? s.pros.filter((p) => !p.archived).map((p) => p.org_id) : s.projects.filter((p) => !p.archived).map((p) => p.project_id);
}

export function openRecord(kind, id, opts = {}) {
  noteVisited(kind, id);
  const layout = getState().prefs.detail_layout || 'drawer';
  if (opts.page || layout === 'page') {
    navigate({ view: kind, id, tab: opts.tab || '' });
    return;
  }
  const r = getRoute();
  // Opening from a full-page detail or the wizard: swap to the other record's drawer over its list.
  if (r.view === 'pro' || r.view === 'project' || r.view === 'intake') {
    navigate({ view: kind === 'pro' ? 'pros' : 'projects', drawer: { kind, id, tab: opts.tab || '' } });
    return;
  }
  patchRoute({ drawer: { kind, id, tab: opts.tab || '' } }, { replace: !!r.drawer });
}

export function useOpenRecord() { return openRecord; }

export function closeDrawer() { patchRoute({ drawer: null }); }
