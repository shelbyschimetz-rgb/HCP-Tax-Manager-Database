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
});
let js = result.outputFiles[0].text;
// Never let a literal "</script" inside the bundle terminate the inline script tag.
js = js.replace(/<\/script/gi, '<\\/script');

const css = ['hcp-tokens.css', 'styles.css', 'extras.css']
  .map((f) => `/* ${f} */\n` + fs.readFileSync(path.join(ROOT, 'src/client/styles', f), 'utf8'))
  .join('\n');

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
<div id="root"></div>
<script>window.__TM_BOOT__ = "__TM_BOOT__";</script>
<script>
${js}
</script>
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
