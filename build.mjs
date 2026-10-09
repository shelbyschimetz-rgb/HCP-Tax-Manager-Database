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
  loader: { '.html': 'text' }, // docs/frontline-sop.html → the in-app Guide
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
// Apps Script's HtmlService alters inline script text on the way to the
// browser (pages died with "SyntaxError: Invalid or unexpected token"). So the
// production page carries only tiny scripts with no "//" in them; the app
// bundle rides in a non-executing <script type="text/x-tm-bundle"> block as
// web-safe base64 (A-Z a-z 0-9 - _ =). doGet strips that block before serving
// and the loader fetches the same text through google.script.run.appBundle().
function base64Lines(text) {
  const b64 = Buffer.from(text, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  const lines = [];
  for (let i = 0; i < b64.length; i += 200) lines.push(b64.slice(i, i + 200));
  return lines.join('\n');
}
const BUNDLE_LOADER = String.raw`(function () {
  function fail(m) { if (window.__TM_FAIL__) window.__TM_FAIL__(m); }
  function run(text) {
    try {
      var b64 = String(text).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
      var bin = atob(b64), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var code = new TextDecoder('utf-8').decode(bytes);
      try { new Function(code); } catch (pe) {
        if (pe && pe.name === 'SyntaxError') {
          fail('App code failed to parse: ' + pe.message + ' (received ' + String(text).length + ' chars, decoded ' + code.length + '; ends with: ' + code.slice(-60) + ')');
          return;
        }
      }
      var s = document.createElement('script');
      s.text = code;
      document.body.appendChild(s);
    } catch (e) { fail('Could not decode the app code: ' + (e && e.message || e) + ' (received ' + String(text).length + ' chars)'); }
  }
  var el = document.getElementById('tm-bundle');
  if (el && el.textContent.length > 1000) { run(el.textContent); return; }
  if (window.google && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(run)
      .withFailureHandler(function (e) { fail('Could not load the app code from the server: ' + (e && e.message || e)); })
      .appBundle();
  } else { fail('The app code is missing from the page.'); }
})();`;
const css = ['hcp-tokens.css', 'styles.css', 'extras.css']
  .map((f) => `/* ${f} */\n` + fs.readFileSync(path.join(ROOT, 'src/client/styles', f), 'utf8').replace(/^@import url\([^)]*\);\s*$/m, ''))
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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&amp;display=swap">
<style>
${css}
</style>
</head>
<body>
<div id="root"><div id="tm-loading" style="font:14px 'Open Sans',Arial,sans-serif;color:#616161;padding:48px;text-align:center">Loading Tax Manager…</div></div>
<script>
(function () {
  var b = "__TM_BOOT__";
  window.__TM_BOOT__ = null;
  if (b.charAt(0) === '_') return;
  try {
    var bin = atob(b.replace(/-/g, '+').replace(/_/g, '/')), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    window.__TM_BOOT__ = JSON.parse(new TextDecoder('utf-8').decode(u));
  } catch (e) { window.__TM_BOOT_ERR__ = String(e && e.message || e); }
})();
</script>
<script>
${STARTUP_GUARD}
</script>
${dev ? '<script>\n' + js + '\n</script>' : '<script type="text/x-tm-bundle" id="tm-bundle">\n' + base64Lines(js) + '\n</script>\n<script>\n' + BUNDLE_LOADER + '\n</script>'}
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
