/* Checks the built page: every inline <script> parses, the boot placeholder is intact, the file is complete. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const html = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
assert.ok(scripts.length >= 4, 'expected boot, guard, bundle, and marker scripts');
scripts.forEach((s, i) => { new Function(s); }); // throws on a syntax error
assert.equal(html.split('"__TM_BOOT__"').length, 2, 'exactly one boot placeholder');
assert.ok(/<\/html>\s*$/.test(html), 'ends with </html>');
assert.ok(Math.max(...html.split('\n').map((l) => l.length)) < 5000, 'no giant lines (paste-safe)');
console.log(`build check passed (${scripts.length} scripts, ${Math.round(html.length / 1024)} KB)`);
