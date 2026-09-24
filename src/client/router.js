/**
 * Hash router. Inside Apps Script the app runs in a sandboxed iframe, so the
 * top-level URL hash is read/written through google.script.url /
 * google.script.history; locally we use window.location.hash.
 *
 * Hash shape:  #/pros?v=risk&drawer=pro:749297&list=<json>
 *              #/project/PRJ-749297-2024-1040   (full page)
 *              #/intake/322284
 */
import { useSyncExternalStore } from 'react';

const gs = typeof google !== 'undefined' && google.script ? google.script : null;
const listeners = new Set();
let current = parse('');

export function parse(hash) {
  const h = String(hash || '').replace(/^#/, '');
  const [pathPart, queryPart] = h.split('?');
  const parts = (pathPart || '').split('/').filter(Boolean).map(decodeURIComponent);
  const params = {};
  (queryPart || '').split('&').filter(Boolean).forEach((kv) => {
    const i = kv.indexOf('=');
    const k = i < 0 ? kv : kv.slice(0, i);
    params[decodeURIComponent(k)] = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1));
  });
  const view = parts[0] || 'home';
  let drawer = null;
  if (params.drawer) {
    const [kind, ...rest] = params.drawer.split(':');
    if ((kind === 'pro' || kind === 'project') && rest.length) drawer = { kind, id: rest.join(':'), tab: params.dtab || '' };
  }
  return { view, id: parts[1] || '', tab: params.tab || '', savedView: params.v || '', list: params.list || '', drawer };
}

export function format(route) {
  let h = '/' + (route.view || 'home') + (route.id ? '/' + encodeURIComponent(route.id) : '');
  const q = [];
  if (route.tab) q.push('tab=' + encodeURIComponent(route.tab));
  if (route.savedView) q.push('v=' + encodeURIComponent(route.savedView));
  if (route.list) q.push('list=' + encodeURIComponent(route.list));
  if (route.drawer) {
    q.push('drawer=' + route.drawer.kind + ':' + encodeURIComponent(route.drawer.id));
    if (route.drawer.tab) q.push('dtab=' + encodeURIComponent(route.drawer.tab));
  }
  return h + (q.length ? '?' + q.join('&') : '');
}

function emit() { listeners.forEach((l) => l()); }

export function getRoute() { return current; }

export function navigate(next, { replace } = {}) {
  current = { view: 'home', id: '', tab: '', savedView: '', list: '', drawer: null, ...next };
  const hash = format(current);
  if (gs && gs.history) {
    try {
      if (replace) gs.history.replace(current, {}, hash);
      else gs.history.push(current, {}, hash);
    } catch (e) { /* history unavailable in some embeds */ }
  } else if (typeof window !== 'undefined') {
    const url = '#' + hash;
    if (replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
  }
  emit();
}

/** Patch the current route (e.g. open a drawer, change list state) — replaces history for list-state tweaks. */
export function patchRoute(patch, opts) {
  navigate({ ...current, ...patch }, opts);
}

export function initRouter() {
  return new Promise((resolve) => {
    if (gs && gs.url) {
      gs.history.setChangeHandler((e) => {
        current = parse(e.location && e.location.hash);
        emit();
      });
      gs.url.getLocation((loc) => {
        current = parse(loc.hash);
        emit();
        resolve(current);
      });
    } else {
      window.addEventListener('popstate', () => { current = parse(window.location.hash); emit(); });
      window.addEventListener('hashchange', () => { current = parse(window.location.hash); emit(); });
      current = parse(window.location.hash);
      resolve(current);
    }
  });
}

export function useRoute() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => current);
}

/** Full URL to a route, for "copy link" / new tab. */
export function routeUrl(route, baseUrl) {
  return (baseUrl || '') + '#' + format(route);
}
