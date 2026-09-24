/**
 * api(action, payload) → Promise<data>
 *
 * In Apps Script this is google.script.run.api(...) — an async call that
 * never reloads the page (the reliable form of the handoff's hidden-iframe
 * POST: doPost responses are served from a different sandbox origin, so a
 * target=__ghost form can't postMessage back to this frame). In local dev it
 * POSTs to the dev server, which runs the same server code in Node.
 */

const inAppsScript = typeof google !== 'undefined' && google.script && google.script.run;

export function api(action, payload) {
  return new Promise((resolve, reject) => {
    const done = (res) => {
      if (res && res.ok) resolve(res.data);
      else {
        const err = new Error((res && res.error) || 'Unknown server error');
        err.code = res && res.code;
        reject(err);
      }
    };
    if (inAppsScript) {
      google.script.run
        .withSuccessHandler(done)
        .withFailureHandler((e) => {
          const err = new Error((e && e.message) || String(e) || 'Network error — check your connection.');
          err.code = 'NETWORK';
          reject(err);
        })
        .api(action, payload || {});
    } else {
      fetch('/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload: payload || {}, user: window.__DEV_USER__ }),
      })
        .then((r) => r.json())
        .then(done)
        .catch((e) => { const err = new Error('Network error — ' + e.message); err.code = 'NETWORK'; reject(err); });
    }
  });
}

export const isAppsScript = !!inAppsScript;
