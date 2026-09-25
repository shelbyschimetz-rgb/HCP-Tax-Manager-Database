/**
 * Build: bundles the React client into one self-contained index.html (Apps
 * Script's HtmlService serves a single file; CSS/JS are inlined) and copies
 * the server .js files + manifest into dist/ — the folder `clasp push` uploads.
 *
 *   node build.mjs          production build → dist/
 *   node build.mjs --dev    unminified build → .dev/index.html (for `npm run dev`)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const dev = process.argv.includes('--dev');
const OUT = path.join(ROOT, dev ? '.dev' : 'dist');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const result = await esbuild.build({
  entryPoints: [path.join(ROOT, 'src/client/main.jsx')],
  bundle: true,
  format: 'iife',
  target: ['chrome100', 'safari15', 'firefox100'],
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': JSON.stringify(dev ? 'development' : 'production') },
  write: false,
  logLevel: 'warning',
  legalComments: 'none',
  lineLimit: 400, // short lines: survives copy-paste into the Apps Script editor
  charset: 'ascii',
});
let js = result.outputFiles[0].text;
// Never let a literal "</script" inside the bundle terminate the inline script tag.
js = js.replace(/<\/script/gi, '<\\/script');
// Apps Script's HtmlService alters some inline script text on the way to the
// browser (the page then dies with "SyntaxError: Invalid or unexpected token").
// Ship the bundle as base64 — letters, digits, + / = only — in short lines,
// and decode it in the browser. Dev builds stay plain for debugging.
function base64Lines(text) {
  const b64 = Buffer.from(text, 'utf8').toString('base64');
  const lines = [];
  for (let i = 0; i < b64.length; i += 200) lines.push('"' + b64.slice(i, i + 200) + '"');
  return '[\n' + lines.join(',\n') + '\n].join("")';
}
const appScript = dev ? js : `(function () {
  var b64 = ${base64Lines(js)};
  var bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  var s = document.createElement('script');
  s.text = new TextDecoder('utf-8').decode(bytes);
  document.body.appendChild(s);
})();`;

const css = ['hcp-tokens.css', 'styles.css', 'extras.css']
  .map((f) => `/* ${f} */\n` + fs.readFileSync(path.join(ROOT, 'src/client/styles', f), 'utf8'))
  .join('\n');

// Never fail silently: any startup error is written onto the page (plain ES5, no build step).
const STARTUP_GUARD = String.raw`(function () {
  function show(msg) {
    if (window.__TM_STARTED__) return;
    var r = document.getElementById('root');
    if (!r) return;
    r.innerHTML = '<div style="font:14px Arial,sans-serif;max-width:720px;margin:48px auto;padding:24px;border:1px solid #F8BBD0;background:#FFF5F8;border-radius:12px;color:#880E4F">'
      + '<b>Tax Manager could not start.</b><br><br>Send this message to whoever set up the app:'
      + '<pre style="white-space:pre-wrap;font:12px monospace;color:#212121;background:#fff;padding:12px;border-radius:8px;margin-top:10px">'
      + String(msg).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre></div>';
  }
  window.__TM_FAIL__ = show;
  window.addEventListener('error', function (e) {
    show((e.message || 'Script error') + (e.filename ? '\n' + e.filename + ':' + e.lineno : '') + (e.error && e.error.stack ? '\n' + e.error.stack : ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    show('Unhandled: ' + ((e.reason && (e.reason.stack || e.reason.message)) || e.reason));
  });
  setTimeout(function () {
    if (!window.__TM_STARTED__) show('The app did not finish loading within 20 seconds. If index.html was pasted by hand, the paste may be incomplete: the file must end with the closing html tag.');
  }, 20000);
})();`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<base target="_top">
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tax Manager</title>
<style>
${css}
</style>
</head>
<body>
<div id="root"><div id="tm-loading" style="font:14px 'Open Sans',Arial,sans-serif;color:#616161;padding:48px;text-align:center">Loading Tax Manager…</div></div>
<script>
(function () {
  // The server replaces the placeholder with the startup data as base64 (UTF-8 JSON).
  var b = "__TM_BOOT__";
  window.__TM_BOOT__ = null;
  if (b.charAt(0) === '_') return;
  try {
    var bin = atob(b), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    window.__TM_BOOT__ = JSON.parse(new TextDecoder('utf-8').decode(u));
  } catch (e) { window.__TM_BOOT_ERR__ = String(e && e.message || e); }
})();
</script>
<script>
${STARTUP_GUARD}
</script>
<script>
${appScript}
</script>
<script>window.__TM_BUNDLE_LOADED__ = true;</script>
</body>
</html>
`;
fs.writeFileSync(path.join(OUT, 'index.html'), html);

if (!dev) {
  const serverDir = path.join(ROOT, 'src/server');
  for (const f of fs.readdirSync(serverDir)) {
    if (f.endsWith('.js')) fs.copyFileSync(path.join(serverDir, f), path.join(OUT, f));
  }
  fs.copyFileSync(path.join(ROOT, 'appsscript.json'), path.join(OUT, 'appsscript.json'));
}

const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log(`Built ${path.relative(ROOT, OUT)}/index.html (${kb(Buffer.byteLength(html))}; js ${kb(js.length)}, css ${kb(css.length)})${dev ? '' : ' + server files'}`);
