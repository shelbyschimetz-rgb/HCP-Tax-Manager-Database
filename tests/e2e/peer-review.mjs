/* Peer review click-through against the dev server (freshly seeded). Screenshots to $OUT. */
import fs from 'node:fs';
import { chromium } from 'playwright'; // npm i --no-save playwright
const OUT = process.env.OUT || '/tmp';
const BASE = process.env.BASE || 'http://localhost:5173/';
const REVIEWER = 'casey.review@housecallpro.com';
const PREP = 'jordan.prep@housecallpro.com';
const browser = await chromium.launch({ executablePath: process.env.CHROME || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined) });
const errors = [];
let failed = 0;
async function as(user) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => errors.push(user + ' pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CERT|404/.test(m.text())) errors.push(user + ' ' + m.text()); });
  page.base = BASE.replace(/\/?$/, '/') + '?as=' + encodeURIComponent(user);
  return page;
}
const shot = async (page, n) => { await page.waitForTimeout(600); await page.screenshot({ path: `${OUT}/pr-${n}.png` }); };
const step = async (page, name, fn) => {
  try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); await shot(page, 'fail-' + name.replace(/\W+/g, '_')); }
};

// Reviewer: queue → claim → project tab → checklist → rework
const rv = await as(REVIEWER);
await rv.goto(rv.base + '#/peer-review', { waitUntil: 'networkidle' });
let biz = '';
await step(rv, 'queue lists the waiting review', async () => {
  await rv.locator('tbody tr').first().waitFor();
  biz = (await rv.locator('tbody tr').first().locator('td').first().locator('span[style*="font-weight"]').textContent()).trim();
  await shot(rv, 'queue');
});
await step(rv, 'claim from the queue', async () => {
  await rv.locator('tbody tr', { hasText: biz }).getByRole('button', { name: 'Claim' }).click();
  await rv.getByText('Claimed ' + biz).waitFor();
  await rv.locator('.view-tab', { hasText: 'In review' }).click();
  await rv.locator('tbody tr', { hasText: biz }).waitFor();
});
await step(rv, 'open project on the Peer review tab', async () => {
  await rv.locator('tbody tr', { hasText: biz }).click();
  await rv.locator('.drawer .pr-grid').waitFor();
  await rv.locator('.drawer .pr-checklist input').first().check();
  await rv.locator('.drawer', { hasText: '1/10 verified' }).waitFor();
  await shot(rv, 'in-review');
});
await step(rv, 'send back for rework', async () => {
  await rv.locator('.drawer').getByRole('button', { name: 'Needs rework' }).click();
  await rv.locator('.tm-modal textarea').fill('UT TC-65 missing; apportionment off.');
  await rv.locator('.tm-modal').getByRole('button', { name: 'Send back' }).click();
  await rv.locator('.drawer .pr-banner', { hasText: 'UT TC-65 missing' }).waitFor();
  await shot(rv, 'rework');
});

// Preparer: sees the rework task, resubmits; then submits a new return from the modal
const pp = await as(PREP);
await pp.goto(pp.base + '#/my-tasks', { waitUntil: 'networkidle' });
await step(pp, 'rework task in My Tasks', async () => {
  await pp.locator('.tk-row', { hasText: 'Apply peer-review changes' }).first().waitFor();
});
await step(pp, 'resubmit from the project', async () => {
  await pp.goto(pp.base + '#/peer-review', { waitUntil: 'networkidle' });
  await pp.locator('.view-tab', { hasText: 'Needs rework' }).click();
  await pp.locator('tbody tr', { hasText: biz }).click();
  await pp.locator('.drawer').getByRole('button', { name: 'Resubmit' }).click();
  await pp.locator('.tm-modal textarea').first().fill('Added TC-65, fixed apportionment.');
  await shot(pp, 'resubmit-modal');
  await pp.locator('.tm-modal').getByRole('button', { name: 'Resubmit' }).click();
  await pp.locator('.drawer .pill', { hasText: 'In review' }).first().waitFor();
});
await step(pp, 'submit a new return with the form', async () => {
  await pp.goto(pp.base + '#/projects', { waitUntil: 'networkidle' });
  const rows = pp.locator('tbody tr:has(.pp-PREP)');
  const n = await rows.count();
  let opened = false;
  for (let i = 0; i < n && !opened; i++) {
    await rows.nth(i).click();
    await pp.locator('.drawer .view-tab', { hasText: 'Peer review' }).click();
    await pp.locator('.drawer .tm-empty-card, .drawer .pr-grid').first().waitFor();
    const btn = pp.locator('.drawer').getByRole('button', { name: 'Submit for peer review' });
    if (await btn.count()) { await btn.click(); opened = true; } else { await pp.keyboard.press('Escape'); }
  }
  if (!opened) throw new Error('no PREP project without a review');
  await pp.locator('.tm-modal').getByRole('button', { name: 'Submit for review' }).click();
  await pp.locator('.tm-modal .tm-field-error', { hasText: 'add-ons' }).waitFor();
  await pp.locator('#pr-safe').fill('$2,400');
  await pp.locator('.pr-addon', { hasText: 'Schedule C' }).click();
  await pp.locator('.pr-addon', { hasText: 'Form 8959/8960' }).click();
  await pp.locator('.tm-modal textarea').last().fill('Pro used transcript for 2025 — no K-1 received.');
  await shot(pp, 'submit-modal');
  await pp.locator('.tm-modal').getByRole('button', { name: 'Submit for review' }).click();
  await pp.locator('.drawer .pill', { hasText: 'Waiting for reviewer' }).first().waitFor();
  await pp.locator('.drawer .pill.pp-QA').first().waitFor();
  await shot(pp, 'submitted');
});

// Reviewer completes the resubmitted one and moves it on (the queue refetches on open)
await rv.goto(rv.base + '#/home', { waitUntil: 'networkidle' });
await rv.locator('.sb-item', { hasText: /^Peer Review/ }).click();
await step(rv, 'complete the review', async () => {
  await rv.locator('.view-tab', { hasText: 'In review' }).click();
  await rv.locator('tbody tr', { hasText: biz }).click();
  await rv.locator('.drawer').getByRole('button', { name: 'Review complete' }).click();
  await rv.locator('.tm-modal').getByRole('button', { name: 'Review complete' }).click();
  await rv.locator('.drawer .pr-banner.ok').waitFor();
  await shot(rv, 'complete');
});
await step(rv, 'report shows the reviewer', async () => {
  await rv.goto(rv.base + '#/reports', { waitUntil: 'networkidle' });
  await rv.getByRole('button', { name: 'Peer review' }).click();
  await rv.locator('.det-card', { hasText: 'By reviewer' }).locator('tbody tr', { hasText: 'Casey Review' }).waitFor();
  await shot(rv, 'report');
});

await browser.close();
if (errors.length) { console.log('console errors:\n  ' + errors.join('\n  ')); failed++; }
console.log(failed ? `\n${failed} problem(s)` : '\npeer review e2e passed');
process.exit(failed ? 1 : 0);
