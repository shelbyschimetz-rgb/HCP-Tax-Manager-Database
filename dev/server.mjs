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

let gas;
if (fs.existsSync(STATE) && !process.argv.includes('--reseed')) {
  gas = createGas({ state: JSON.parse(fs.readFileSync(STATE, 'utf8')), user: DEV_USER });
} else {
  gas = createGas({ user: DEV_USER });
  seed(gas);
  save();
}

function save() {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(gas.snapshot()));
}

function page(user) {
  const html = fs.readFileSync(process.env.HTML ? path.resolve(ROOT, process.env.HTML) : path.join(ROOT, '.dev', 'index.html'), 'utf8');
  gas.setUser(user);
  gas.ctx.Db.clearCache();
  let boot;
  try {
    boot = { ok: true, data: gas.ctx.Boot.payload(gas.ctx.Identity.current()) };
  } catch (e) {
    boot = { ok: false, error: e.message, code: e.code || 'ERROR', email: user };
  }
  const json = JSON.stringify(JSON.parse(JSON.stringify(boot))).replace(/</g, '\\u003c');
  return html
    .replace('"__TM_BOOT__"', () => json)
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
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page(url.searchParams.get('as') || DEV_USER));
    return;
  }
  res.writeHead(404); res.end('not found');
});

server.listen(PORT, () => console.log(`Tax Manager dev server → http://localhost:${PORT}  (as ${DEV_USER}; add ?as=email to switch)`));
