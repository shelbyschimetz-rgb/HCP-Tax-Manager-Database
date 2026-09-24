/* Click-through smoke test against the dev server (npm run dev). Screenshots to $OUT. */
import fs from 'node:fs';
import { chromium } from 'playwright'; // npm i --no-save playwright
const OUT = process.env.OUT || '/tmp';
const BASE = process.env.BASE || 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: process.env.CHROME || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/ERR_CERT|404/.test(m.text())) errors.push(m.type() + ': ' + m.text()); });
const shot = async (n) => { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/f-${n}.png` }); };
const step = async (name, fn) => { try { await fn(); console.log('ok   ' + name); } catch (e) { console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); await shot('fail-' + name.replace(/\W+/g, '_')); } };

await page.goto(BASE + '#/pros', { waitUntil: 'networkidle' });
await step('open pro drawer', async () => {
  await page.getByText('Summit Peak Plumbing').first().click();
  await page.locator('.drawer').waitFor();
  await page.locator('.drawer .tk-row').first().waitFor({ timeout: 5000 }).catch(() => {});
  await shot('pro-drawer');
});
await step('pro overview inline edit', async () => {
  await page.locator('.drawer .view-tab', { hasText: 'Overview' }).click();
  await page.locator('.drawer .det-main .field', { hasText: 'Vertical' }).locator('.val').click();
  await page.locator('.drawer .tm-inline-input').fill('Plumbing & Drain');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  await shot('pro-overview');
});
await step('notes tab add note', async () => {
  await page.locator('.drawer .view-tab', { hasText: 'Notes' }).click();
  await page.locator('.drawer textarea.note-input').fill('Test note from e2e');
  await page.getByRole('button', { name: 'Add note' }).click();
  await page.getByText('Test note from e2e').waitFor();
});
await step('next record J/K', async () => {
  const before = await page.locator('.drawer .where .here').textContent();
  await page.locator('.drawer .drawer-head .icon-btn').first().click();
  await page.waitForTimeout(500);
  const after = await page.locator('.drawer .where .here').textContent();
  if (before === after) throw new Error('prev did not change record');
});
await step('close drawer esc', async () => {
  await page.keyboard.press('Escape');
  await page.locator('.drawer').waitFor({ state: 'detached', timeout: 3000 });
});
await page.goto(BASE + '#/projects', { waitUntil: 'networkidle' });
await step('open project drawer + toggle task', async () => {
  await page.locator('tbody tr', { hasText: 'Summit Peak Plumbing' }).first().click();
  await page.locator('.drawer .tk-row').first().waitFor();
  const firstOpen = page.locator('.drawer .tk-row:not(.done) .tk-check').first();
  await firstOpen.click();
  await page.waitForTimeout(200);
  await shot('project-saving');
  await page.waitForTimeout(900);
  await shot('project-drawer');
});
await step('compose task', async () => {
  await page.getByRole('button', { name: 'Add task' }).click();
  await page.locator('.tk-compose .title-input').fill('E2E added task');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  await page.keyboard.press('Escape');
  await page.locator('.drawer .tk-row', { hasText: 'E2E added task' }).waitFor();
});
await step('checklist expand', async () => {
  await page.locator('.drawer .tk-row', { hasText: 'Peer Review Verification' }).click();
  await page.locator('.tk-checklist input').first().check();
  await page.waitForTimeout(600);
  await shot('checklist');
});
await step('timer start', async () => {
  await page.getByRole('button', { name: 'Start timer' }).click();
  await page.waitForTimeout(1500);
  await shot('timer');
});
await step('time & stages tab', async () => {
  await page.locator('.drawer .view-tab', { hasText: 'Time & stages' }).click();
  await shot('stages');
});
await step('outstanding tab', async () => {
  await page.locator('.drawer .view-tab', { hasText: 'Outstanding' }).click();
  await shot('outstanding');
});
await step('full page', async () => {
  await page.locator('.drawer-head .icon-btn[title="Open as full page"]').click();
  await page.waitForTimeout(700);
  await shot('project-page');
});
await page.goto(BASE + '#/projects?tab=board', { waitUntil: 'networkidle' });
await step('kanban drag', async () => {
  const card = page.locator('.kb-card', { hasText: 'Lakeside Handyman' });
  const target = page.locator('.kb-col').nth(1);
  await card.dragTo(target);
  await page.waitForTimeout(1200);
  await shot('kanban-after');
});
for (const [n, h] of [['my-tasks', '#/my-tasks'], ['inbox', '#/inbox'], ['templates', '#/templates'], ['reports', '#/reports'], ['archive', '#/archive'], ['settings', '#/settings']]) {
  await step('view ' + n, async () => { await page.goto(BASE + h, { waitUntil: 'networkidle' }); await shot(n); });
}
await step('claim from inbox → wizard', async () => {
  await page.goto(BASE + '#/inbox', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Claim & start onboarding/ }).first().click();
  await page.locator('.wiz-shell').waitFor({ timeout: 5000 });
  await shot('wizard');
});
await step('wizard assignment step', async () => {
  await page.locator('.wiz-step', { hasText: 'Assignments' }).click();
  await shot('wizard-assign');
});
await step('reports balance', async () => {
  await page.goto(BASE + '#/reports', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Advisor load balance' }).click();
  await shot('report-balance');
});
await step('prefs dark mode', async () => {
  await page.goto(BASE + '#/projects', { waitUntil: 'networkidle' });
  await page.locator('button[title="Preferences"]').click();
  await page.locator('.tm-pref-row', { hasText: 'Dark mode' }).getByRole('button', { name: 'On' }).click();
  await page.keyboard.press('Escape');
  await shot('dark');
  await page.locator('button[title="Preferences"]').click();
  await page.locator('.tm-pref-row', { hasText: 'Dark mode' }).getByRole('button', { name: 'Off' }).click();
});
console.log(errors.length ? 'CONSOLE:\n' + [...new Set(errors)].join('\n') : 'no console errors');
await browser.close();
