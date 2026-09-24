/**
 * npm run deploy — build, push, and publish the web app.
 *
 * First run creates a deployment and saves its id to .deployment-id (commit
 * it so everyone redeploys to the same URL). Later runs update that same
 * deployment, so the /exec URL never changes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ID_FILE = path.join(ROOT, '.deployment-id');
const run = (cmd) => execSync(cmd, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });
const sh = (cmd) => execSync(cmd, { cwd: ROOT, stdio: 'inherit' });

if (!fs.existsSync(path.join(ROOT, '.clasp.json'))) {
  console.error('No .clasp.json yet. Run first:  npx clasp create-script --type standalone --title "Tax Manager" --rootDir dist');
  process.exit(1);
}

sh('node build.mjs');
sh('npx clasp push --force');

const desc = 'Tax Manager ' + new Date().toISOString().slice(0, 16).replace('T', ' ');
let id = fs.existsSync(ID_FILE) ? fs.readFileSync(ID_FILE, 'utf8').trim() : '';
let out;
if (id) {
  out = run(`npx clasp update-deployment ${id} --description "${desc}"`);
} else {
  out = run(`npx clasp create-deployment --description "${desc}"`);
  const m = out.match(/AKfy[\w-]+/);
  if (!m) { console.log(out); console.error('Could not read the deployment id from clasp output above.'); process.exit(1); }
  id = m[0];
  fs.writeFileSync(ID_FILE, id + '\n');
}
console.log(out.trim());
console.log('\nWeb app URL (Workspace domain):');
console.log(`  https://script.google.com/a/macros/housecallpro.com/s/${id}/exec`);
console.log('  (or run: npx clasp open-web-app ' + id + ')');
