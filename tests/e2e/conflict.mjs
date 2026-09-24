/* Two people edit the same pro: the second save is rejected, rolled back, and explained. */
import fs from 'node:fs';
import { chromium } from 'playwright'; // npm i --no-save playwright
const OUT = process.env.OUT || '/tmp';
const BASE = process.env.BASE || 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: process.env.CHROME || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE + '#/pros?drawer=pro:700103&dtab=overview', { waitUntil: 'networkidle' });
await page.locator('.drawer .det-main .field', { hasText: 'Vertical' }).waitFor();
// Someone else edits the same pro behind our back
await fetch(BASE + 'api', { method: 'POST', body: JSON.stringify({ action: 'updatePro', payload: { org_id: '700103', patch: { vertical: 'Window Washing' } }, user: 'riley.advisor@housecallpro.com' }) });
await page.locator('.drawer .det-main .field', { hasText: 'Vertical' }).locator('.val').click();
await page.locator('.drawer .tm-inline-input').fill('Pressure Washing');
await page.keyboard.press('Enter');
await page.waitForTimeout(1200);
const toast = await page.locator('.tm-toasts').textContent();
const val = await page.locator('.drawer .det-main .field', { hasText: 'Vertical' }).locator('.val').textContent();
const pill = await page.locator('.sync-pill').first().textContent();
await page.screenshot({ path: OUT + '/conflict.png' });
console.log(JSON.stringify({ toast, val, pill }));
await browser.close();
