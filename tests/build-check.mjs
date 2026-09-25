/*
 * Checks the built page the way Apps Script will serve it: runs the real
 * doGet() + appBundle() (in the Node fakes) against dist/index.html.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createGas } from './gas-fake.mjs';

const file = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const scriptsOf = (h) => [...h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => ({ tag: m[0].slice(0, m[0].indexOf('>') + 1), body: m[1] }));

assert.ok(/<\/html>\s*$/.test(file), 'file ends with </html>');
assert.equal(file.split('"__TM_BOOT__"').length, 2, 'exactly one boot placeholder');
assert.ok(Math.max(...file.split('\n').map((l) => l.length)) < 5000, 'no giant lines (paste-safe)');

const gas = createGas({ user: 'checker@housecallpro.com', indexHtml: file });
gas.ctx.setup();
const served = gas.ctx.doGet({}).getContent();
const scripts = scriptsOf(served).filter((s) => s.tag === '<script>');
assert.ok(!served.includes('x-tm-bundle'), 'bundle block is stripped from the served page');
scripts.forEach((s, i) => {
  new Function(s.body); // parses
  assert.ok(!s.body.includes('//'), `served inline script ${i} contains "//" (HtmlService mangles these)`);
});
assert.ok(served.length < 150 * 1024, 'served page is small: ' + Math.round(served.length / 1024) + ' KB');
const bootB64 = served.match(/var b = "([A-Za-z0-9_=-]+)"/)[1];
assert.equal(JSON.parse(Buffer.from(bootB64, 'base64').toString('utf8')).ok, true, 'boot payload decodes');

const bundle = gas.ctx.appBundle();
assert.ok(/^[A-Za-z0-9_=\s-]+$/.test(bundle), 'bundle is pure web-safe base64');
const js = Buffer.from(bundle.replace(/\s+/g, ''), 'base64').toString('utf8');
new Function(js); // decoded bundle parses
const diag = gas.ctx.doGet({ parameter: { diag: '1' } }).getContent();
assert.ok(!/FAIL {2}(index|App bundle)/.test(diag), diag);
console.log(`build check passed (served page ${Math.round(served.length / 1024)} KB, ${scripts.length} inline scripts; bundle ${Math.round(bundle.length / 1024)} KB)`);
