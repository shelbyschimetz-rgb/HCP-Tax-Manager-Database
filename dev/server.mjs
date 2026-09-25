/**
 * Local dev server: runs the real server code (src/server/*.js) under Node
 * with in-memory Apps Script fakes, and serves the dev build. State persists
 * to .dev/state.json; delete it to re-seed.
 *
 *   npm run dev            → http://localhost:5173
 *   http://localhost:5173/?as=someone@housecallpro.com   (view as another user)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGas } from '../tests/gas-fake.mjs';
import { seed, DEV_USER } from './seed.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE = path.join(ROOT, '.dev', 'state.json');
const PORT = Number(process.env.PORT || 5173);

// GAS_SHIM=1: serve dist/index.html through the real doGet() and fake google.script.* in the
// browser (run/url/history), so the production loading path is exercised exactly.
const SHIM = !!process.env.GAS_SHIM;
const indexHtml = SHIM ? () => fs.readFileSync(path.join(ROOT, 'dist', 'index.html'), 'utf8') : undefined;
let gas;
if (fs.existsSync(STATE) && !process.argv.includes('--reseed')) {
  gas = createGas({ state: JSON.parse(fs.readFileSync(STATE, 'utf8')), user: DEV_USER, indexHtml });
} else {
  gas = createGas({ user: DEV_USER, indexHtml });
  seed(gas);
  save();
}

function save() {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(gas.snapshot()));
}

const GOOGLE_SHIM = (user) => `<script>
(function () {
  var USER = ${JSON.stringify(user)};
  function runner(ok, fail) {
    return new Proxy({}, { get: function (_, k) {
      if (k === 'withSuccessHandler') return function (h) { return runner(h, fail); };
      if (k === 'withFailureHandler') return function (h) { return runner(ok, h); };
      return function () {
        var args = Array.prototype.slice.call(arguments);
        fetch('/rpc', { method: 'POST', body: JSON.stringify({ fn: k, args: args, user: USER }) })
          .then(function (r) { return r.json(); })
          .then(function (r) { if (r.error) { if (fail) fail(new Error(r.error)); } else if (ok) ok(r.result); })
          .catch(function (e) { if (fail) fail(e); });
      };
    } });
  }
  var hash = function () { return location.hash.replace(/^#/, ''); };
  window.google = { script: {
    run: runner(null, null),
    url: { getLocation: function (cb) { setTimeout(function () { cb({ hash: hash(), parameter: {} }); }, 5); } },
    history: {
      push: function (s, p, h) { history.pushState(s, '', '#' + h); },
      replace: function (s, p, h) { history.replaceState(s, '', '#' + h); },
      setChangeHandler: function (fn) { addEventListener('popstate', function () { fn({ state: null, location: { hash: hash() } }); }); },
    },
  } };
})();
</script>`;

function page(user) {
  if (SHIM) {
    gas.setUser(user);
    gas.ctx.Db.clearCache();
    return gas.ctx.doGet({}).getContent().replace('<head>', '<head>' + GOOGLE_SHIM(user));
  }
  const html = fs.readFileSync(process.env.HTML ? path.resolve(ROOT, process.env.HTML) : path.join(ROOT, '.dev', 'index.html'), 'utf8');
  gas.setUser(user);
  gas.ctx.Db.clearCache();
  let boot;
  try {
    boot = { ok: true, data: gas.ctx.Boot.payload(gas.ctx.Identity.current()) };
  } catch (e) {
    boot = { ok: false, error: e.message, code: e.code || 'ERROR', email: user };
  }
  const b64 = Buffer.from(JSON.stringify(boot), 'utf8').toString('base64');
  return html
    .replace('"__TM_BOOT__"', () => '"' + b64 + '"')
    .replace('<div id="root"></div>', `<div id="root"></div><script>window.__DEV_USER__ = ${JSON.stringify(user)};</script>`);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname === '/api') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const { action, payload, user } = JSON.parse(body || '{}');
      gas.ctx.Db.clearCache();
      const out = gas.raw(action, payload, user || DEV_USER);
      if (out.ok && !/^(get|bootstrap|refresh|preview|recently|import(Preview)|reextract)/.test(action)) save();
      const delay = Number(process.env.LATENCY || 350);
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(out));
      }, delay);
    });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/rpc') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const { fn, args, user } = JSON.parse(body || '{}');
      gas.setUser(user || DEV_USER);
      gas.ctx.Db.clearCache();
      let out;
      try { out = { result: JSON.parse(JSON.stringify(gas.ctx[fn](...(args || [])) ?? null)) }; } catch (e) { out = { error: e.message }; }
      if (fn === 'api' && out.result && out.result.ok) save();
      setTimeout(() => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out)); }, Number(process.env.LATENCY || 350));
    });
    return;
  }
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page(url.searchParams.get('as') || DEV_USER));
    return;
  }
  res.writeHead(404); res.end('not found');
});

server.listen(PORT, () => console.log(`Tax Manager dev server → http://localhost:${PORT}  (as ${DEV_USER}; add ?as=email to switch)`));
