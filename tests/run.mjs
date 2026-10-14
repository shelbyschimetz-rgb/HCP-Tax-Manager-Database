/**
 * Server test suite — runs the real src/server/*.js under Node against the
 * in-memory Apps Script fakes. `npm test`.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createGas } from './gas-fake.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ADMIN = 'morgan.admin@housecallpro.com';
const ADV_A = 'ashley.advisor@housecallpro.com';
const ADV_B = 'tara.advisor@housecallpro.com';
const OS = 'cherrie.groves@housecallpro.com';
const PREP = 'jordan.preparer@housecallpro.com';
const PEER = 'casey.peer@housecallpro.com';
const BK = 'devon.bk@housecallpro.com';

const YR = new Date().getFullYear();
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

/** Fresh app: setup() as admin + a roster. */
function fresh() {
  const gas = createGas({ user: ADMIN });
  gas.ctx.setup();
  const idSheet = gas.spreadsheet().getSheetByName('Identity');
  const header = idSheet.data[0];
  const add = (name, email, roles, extra = {}) => {
    const row = header.map(h => ({ name, email, active: 'TRUE', roles, accepting_new: 'TRUE', color: '', ...extra })[h] ?? '');
    idSheet.data.push(row);
  };
  add('Ashley Advisor', ADV_A, 'ADVISOR,PREPARER');
  add('Tara Advisor', ADV_B, 'ADVISOR');
  add('Cherrie Groves', OS, 'OS');
  add('Jordan Preparer', PREP, 'PREPARER');
  add('Casey Peer', PEER, 'PEER_REVIEWER');
  add('Devon Bk', BK, 'BK_LEAD');
  gas.ctx.Db.clearCache();
  return gas;
}

function sfdcSheet(gas, rows) {
  const header = ['Account Name', 'Case Owner', 'Org ID', 'Case Number', 'Service Time (Days)', 'Sub-Status Notes', 'Created Date', 'Case Record Type', 'Date/Time Closed'];
  const id = gas.addSpreadsheet('SFDC feed', [{ name: 'Report', data: [header, ...rows] }]);
  gas.call('saveSettings', { settings: { sfdc_sheet_id: id } });
  return id;
}

/* ------------------------------------------------------------------ */

test('setup creates every tab, seeds templates, installs triggers, adds admin', () => {
  const gas = fresh();
  const ss = gas.spreadsheet();
  for (const t of ['Pros', 'Projects', 'Tasks', 'TaskTemplates', 'TemplateVersions', 'AuditLog', 'Notes', 'TimeEntries',
    'ProjectStageHistory', 'OutstandingItems', 'Identity', 'SfdcIntakeQueue', 'IntakeAnswers']) {
    assert.ok(ss.getSheetByName(t), 'missing tab ' + t);
  }
  assert.equal(ss.getSheetByName('Sheet1'), null);
  const tpl = gas.call('getTemplates', { scope: 'PROJECT' });
  assert.equal(tpl.templates.length, 25);
  assert.equal(tpl.versions[0].version, 1);
  assert.deepEqual(gas.state.triggers.sort(), ['churnTrigger', 'dailyExportTrigger', 'digestTrigger', 'feedbackEmailTrigger', 'sfdcSyncTrigger', 'timerAutoStopTrigger']);
  // re-running is idempotent
  gas.ctx.setup();
  assert.equal(gas.call('getTemplates', { scope: 'PROJECT' }).templates.length, 25);
  assert.equal(gas.state.triggers.length, 6);
});

test('non-roster user is refused with a readable message', () => {
  const gas = fresh();
  const res = gas.raw('bootstrap', {}, 'stranger@housecallpro.com');
  assert.equal(res.ok, false);
  assert.equal(res.code, 'NO_ACCESS');
  assert.match(res.error, /not on the Tax Manager team roster/);
  const html = (gas.setUser('stranger@housecallpro.com'), gas.ctx.doGet({}).getContent());
  const b64 = html.match(/var b = "([A-Za-z0-9_=-]+)"/)[1];
  assert.equal(JSON.parse(Buffer.from(b64, 'base64').toString('utf8')).code, 'NO_ACCESS');
});

test('doGet inlines the boot payload safely', () => {
  const gas = fresh();
  gas.call('createPro', { fields: { org_id: '1', business_name: 'Evil </script><script>alert(1)</script> LLC' } });
  const html = gas.ctx.doGet({}).getContent();
  assert.ok(!html.includes('</script><script>alert'), 'payload must not break out of the script tag');
  const b64 = html.match(/var b = "([A-Za-z0-9_=-]+)"/)[1];
  const boot = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  assert.equal(boot.ok, true);
  assert.equal(boot.data.pros[0].business_name, 'Evil </script><script>alert(1)</script> LLC');
});

test('case owner resolver: first.last, drops middle names, blank when not on roster', () => {
  const gas = fresh();
  const I = gas.ctx.Identity;
  assert.equal(I.emailFromName('Angel Julia Marcos'), 'angel.marcos@housecallpro.com');
  assert.equal(I.emailFromName('Cherrie Groves'), 'cherrie.groves@housecallpro.com');
  assert.equal(I.resolveCaseOwner('Cherrie Groves'), OS);
  assert.equal(I.resolveCaseOwner('Angel Julia Marcos'), '');
  assert.equal(I.resolveCaseOwner('Cher'), '');
});

test('SFDC sync: creates pros per new Org ID, dedups, filters record type, seeds notes, flags unknown OS', () => {
  const gas = fresh();
  sfdcSheet(gas, [
    ['Cedar Creek Plumbing', 'Cherrie Groves', '322284', '2258751', 1.01, 'Pre-intro email sent', `${YR}-01-08`, 'Tax Onboarding', ''],
    ['Atrium Air', 'Angel Julia Marcos', '485748', '2256937', 1.87, '', `${YR}-02-11`, 'Tax Onboarding', ''],
    ['Some Payroll Co', 'Cherrie Groves', '999001', '2250000', 2, '', `${YR}-02-11`, 'Payroll Onboarding', ''],
    ['Cedar Creek Plumbing (dup)', 'Cherrie Groves', '322284', '2258752', 1, '', `${YR}-01-08`, 'Tax Onboarding', ''],
  ]);
  const s1 = gas.call('runSfdcSync', {});
  assert.equal(s1.created, 2);
  assert.equal(s1.skipped_type, 1);
  assert.equal(s1.existing, 1);
  assert.equal(s1.flagged_os, 1);
  const boot = gas.call('bootstrap', {});
  const cedar = boot.pros.find(p => p.org_id === '322284');
  assert.equal(cedar.assigned_os_email, OS);
  assert.equal(cedar.lifecycle_status, 'CLOSED_WON');
  assert.ok(cedar.assigned_advisor_email, 'load balancer assigned an advisor');
  const atrium = boot.pros.find(p => p.org_id === '485748');
  assert.ok(!atrium.assigned_os_email);
  assert.equal(atrium.needs_os_assignment, true);
  assert.equal(boot.inbox.length, 2);
  const detail = gas.call('getProDetail', { org_id: '322284' });
  assert.equal(detail.notes[0].body, 'Pre-intro email sent');
  assert.equal(detail.notes[0].author_email, 'salesforce');
  // second run is a no-op
  const s2 = gas.call('runSfdcSync', {});
  assert.equal(s2.created, 0);
  assert.equal(s2.existing, 3);
});

test('load balancer: fewest active pros, round-robin tiebreak, archived excluded', () => {
  const gas = fresh();
  const a = gas.call('createPro', { fields: { org_id: '10', business_name: 'A' } });
  const b = gas.call('createPro', { fields: { org_id: '11', business_name: 'B' } });
  assert.notEqual(a.assigned_advisor_email, b.assigned_advisor_email, 'ties alternate');
  const c = gas.call('createPro', { fields: { org_id: '12', business_name: 'C' } });
  assert.equal(c.assigned_advisor_email, a.assigned_advisor_email, 'round-robin: least-recently-assigned wins');
  // Archive two of one advisor's pros → they become least loaded
  gas.call('archivePro', { org_id: '10', reason: 'test' });
  gas.call('archivePro', { org_id: '12', reason: 'test' });
  const d = gas.call('createPro', { fields: { org_id: '13', business_name: 'D' } });
  assert.equal(d.assigned_advisor_email, a.assigned_advisor_email);
  // Not accepting → skipped
  const idSheet = gas.spreadsheet().getSheetByName('Identity');
  const h = idSheet.data[0];
  const row = idSheet.data.find(r => r[h.indexOf('email')] === a.assigned_advisor_email);
  row[h.indexOf('accepting_new')] = 'FALSE';
  gas.ctx.Db.clearCache();
  const e = gas.call('createPro', { fields: { org_id: '14', business_name: 'E' } });
  assert.notEqual(e.assigned_advisor_email, a.assigned_advisor_email);
});

test('claim from inbox: lifecycle → onboarding scheduled, pro tasks materialized with role assignees + due dates', () => {
  const gas = fresh();
  sfdcSheet(gas, [['Cedar Creek Plumbing', 'Cherrie Groves', '322284', '2258751', 1, '', `${YR}-01-08`, 'Tax Onboarding', '']]);
  gas.call('runSfdcSync', {});
  const res = gas.call('claimInbox', { id: '2258751' }, OS);
  assert.equal(res.pro.lifecycle_status, 'ONBOARDING_SCHEDULED');
  assert.equal(res.tasks.length, 10);
  const drive = res.tasks.find(t => t.title === 'Provision Drive folder');
  assert.equal(drive.assignee_email, OS);
  assert.match(drive.due_date, /^\d{4}-\d{2}-\d{2}$/);
  const bk = res.tasks.find(t => t.title === 'Confirm books status with BK lead');
  assert.equal(bk.assignee_email, '');
  assert.equal(bk.assignee_role, 'BK_LEAD');
  // filling BK lead later assigns the open role task
  const upd = gas.call('updatePro', { org_id: '322284', patch: { bk_lead_email: BK } });
  assert.ok(upd.tasks.some(t => t.task_id === bk.task_id && t.assignee_email === BK));
  // cannot claim twice
  assert.throws(() => gas.call('claimInbox', { id: '2258751' }), /Already claimed/);
  assert.equal(gas.call('bootstrap', {}).inbox.length, 0);
});

test('project create: id, deadline, stage history, lifecycle bump, template tasks with subtasks/blocked-by/checklist', () => {
  const gas = fresh();
  gas.call('createPro', { fields: { org_id: '749297', business_name: 'Hundred Year Plumbing', lifecycle_status: 'ONBOARDED', bk_lead_email: BK } });
  const res = gas.call('createProject', { fields: { org_id: '749297', filing_type: 'S_CORP', tax_year: 2025, tax_preparer_email: PREP, project_start_date: '2026-01-05' } });
  const p = res.project;
  assert.equal(p.project_id, 'PRJ-749297-2025-SCORP');
  assert.equal(p.filing_deadline, '2026-03-15');
  assert.equal(res.pro.lifecycle_status, 'ACTIVE_PROJECT');
  assert.equal(res.tasks.length, 25);
  const parent = res.tasks.find(t => t.title === 'Complete Income/Deduction Info');
  const subs = res.tasks.filter(t => t.parent_task_id === parent.task_id);
  assert.equal(subs.length, 3);
  const file = res.tasks.find(t => t.title === 'File extension');
  const det = res.tasks.find(t => t.title === 'Determine if extension is needed');
  assert.equal(file.blocked_by, det.task_id);
  assert.equal(file.due_date, '2026-03-01', 'FILING_DEADLINE -14');
  const peer = res.tasks.find(t => t.title === 'Peer Review Verification');
  assert.equal(peer.checklist.length, 10);
  assert.equal(peer.assignee_email, '');
  const efile = res.tasks.find(t => t.title === 'E-file return');
  assert.equal(efile.due_date, '', 'no e-file date yet');
  assert.equal(res.tasks.find(t => t.title === 'Review status of INHA books').assignee_email, BK);
  // second project same year/type gets suffixed id
  const again = gas.call('createProject', { fields: { org_id: '749297', filing_type: 'S_CORP', tax_year: 2025 } });
  assert.equal(again.project.project_id, 'PRJ-749297-2025-SCORP-2');
  const detail = gas.call('getProjectDetail', { project_id: p.project_id });
  assert.equal(detail.history.length, 1);
  assert.equal(detail.history[0].to_stage, 'IN_QUEUE');
  // setting e-file date re-anchors filing tasks; assigning peer fills role
  const up = gas.call('updateProject', { project_id: p.project_id, patch: { efile_date: '2026-03-01', peer_reviewer_email: PEER }, row_version: p.row_version });
  const efile2 = up.tasks.find(t => t.task_id === efile.task_id);
  assert.equal(efile2.due_date, '2026-03-01');
  assert.ok(up.tasks.some(t => t.task_id === peer.task_id && t.assignee_email === PEER));
});

test('task cascade: parent done → children done; last child done → parent done; reopen child → parent reopens', () => {
  const gas = fresh();
  gas.call('createPro', { fields: { org_id: '1', business_name: 'X' } });
  const { tasks } = gas.call('createProject', { fields: { org_id: '1', filing_type: 'F1040_SCHC', tax_year: 2025 } });
  const parent = tasks.find(t => t.title === 'Complete Income/Deduction Info');
  const subs = tasks.filter(t => t.parent_task_id === parent.task_id);
  let r = gas.call('setTaskStatus', { task_id: parent.task_id, status: 'DONE' });
  assert.equal(r.tasks.length, 4);
  assert.ok(r.tasks.every(t => t.status === 'DONE'));
  r = gas.call('setTaskStatus', { task_id: subs[0].task_id, status: 'IN_PROGRESS' });
  assert.equal(r.tasks.find(t => t.task_id === parent.task_id).status, 'IN_PROGRESS');
  r = gas.call('setTaskStatus', { task_id: subs[0].task_id, status: 'DONE' });
  assert.equal(r.tasks.find(t => t.task_id === parent.task_id).status, 'DONE');
  assert.ok(r.tasks.find(t => t.task_id === parent.task_id).completed_by);
});

test('optimistic concurrency: stale row_version is rejected with CONFLICT', () => {
  const gas = fresh();
  const pro = gas.call('createPro', { fields: { org_id: '5', business_name: 'Five' } });
  const a = gas.call('updatePro', { org_id: '5', patch: { vertical: 'HVAC' }, row_version: pro.row_version });
  assert.equal(a.pro.row_version, pro.row_version + 1);
  const res = gas.raw('updatePro', { org_id: '5', patch: { vertical: 'Plumbing' }, row_version: pro.row_version });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'CONFLICT');
  const audit = gas.call('getProDetail', { org_id: '5' }).audit;
  assert.ok(audit.some(x => x.field === 'vertical' && x.to_value === 'HVAC'));
});

test('stage transitions: history with days in prev stage, blocked needs reason, leaving blocked clears it', () => {
  const gas = fresh();
  gas.call('createPro', { fields: { org_id: '2', business_name: 'Two' } });
  let p = gas.call('createProject', { fields: { org_id: '2', filing_type: 'PARTNERSHIP', tax_year: 2025 } }).project;
  assert.throws(() => gas.call('updateProject', { project_id: p.project_id, patch: { pipeline_status: 'BLOCKED' } }), /blocker reason/);
  p = gas.call('updateProject', { project_id: p.project_id, patch: { pipeline_status: 'BLOCKED', blocker_reason: 'Waiting on CPA' } }).project;
  assert.equal(p.blocker_reason, 'Waiting on CPA');
  p = gas.call('updateProject', { project_id: p.project_id, patch: { pipeline_status: 'PREP' } }).project;
  assert.equal(p.blocker_reason, '');
  const h = gas.call('getProjectDetail', { project_id: p.project_id }).history;
  assert.deepEqual(h.map(x => x.to_stage), ['IN_QUEUE', 'BLOCKED', 'PREP']);
  assert.equal(h[1].from_stage, 'IN_QUEUE');
  assert.equal(typeof h[1].days_in_prev_stage, 'number');
  assert.equal(h[0].days_in_prev_stage, null);
  assert.throws(() => gas.call('updateProject', { project_id: p.project_id, patch: { pipeline_status: 'NOPE' } }), /not a valid/);
});

test('timer: one per user, conflict prompt, force switch, auto-stop after max hours', () => {
  const gas = fresh();
  gas.call('createPro', { fields: { org_id: '3', business_name: 'Three' } });
  const p1 = gas.call('createProject', { fields: { org_id: '3', filing_type: 'S_CORP', tax_year: 2024 } }).project;
  const p2 = gas.call('createProject', { fields: { org_id: '3', filing_type: 'S_CORP', tax_year: 2025 } }).project;
  const s1 = gas.call('startTimer', { project_id: p1.project_id }, PREP);
  assert.ok(s1.entry.entry_id);
  const again = gas.call('startTimer', { project_id: p1.project_id }, PREP);
  assert.equal(again.entry.entry_id, s1.entry.entry_id, 'same project → same running timer');
  const c = gas.call('startTimer', { project_id: p2.project_id }, PREP);
  assert.ok(c.conflict);
  assert.match(c.conflict.label, /Three · TY2024/);
  // someone else can time the same project concurrently
  assert.ok(gas.call('startTimer', { project_id: p2.project_id }, ADV_A).entry);
  const f = gas.call('startTimer', { project_id: p2.project_id, force: true }, PREP);
  assert.equal(f.stopped.entry_id, s1.entry.entry_id);
  assert.ok(f.stopped.stopped_at);
  assert.throws(() => gas.call('stopTimer', { entry_id: f.entry.entry_id }, ADV_A), /someone else/);
  // forgot to stop: make it 9h old then run the hourly trigger
  const sh = gas.spreadsheet().getSheetByName('TimeEntries');
  const hdr = sh.data[0];
  const row = sh.data.find(r => r[hdr.indexOf('entry_id')] === f.entry.entry_id);
  row[hdr.indexOf('started_at')] = new Date(Date.now() - 9 * 3600e3).toISOString();
  gas.ctx.Db.clearCache();
  gas.ctx.timerAutoStopTrigger();
  const t = gas.call('getProjectDetail', { project_id: p2.project_id }).time.find(x => x.entry_id === f.entry.entry_id);
  assert.equal(t.auto_stopped, true);
  assert.equal(t.duration_min, 480);
  assert.equal(gas.call('bootstrap', {}, PREP).timer, null);
});

test('notes: append thread, only author can edit/delete', () => {
  const gas = fresh();
  gas.call('createPro', { fields: { org_id: '4', business_name: 'Four' } });
  const n = gas.call('addNote', { entity_type: 'PRO', entity_id: '4', body: 'IAC scheduled' }, OS);
  assert.throws(() => gas.call('editNote', { note_id: n.note_id, body: 'x' }, ADV_A), /your own notes/);
  const e = gas.call('editNote', { note_id: n.note_id, body: 'IAC scheduled 5/12' }, OS);
  assert.ok(e.edited_at);
  gas.call('addNote', { entity_type: 'PRO', entity_id: '4', body: 'Second' }, ADV_A);
  const notes = gas.call('getProDetail', { org_id: '4' }).notes;
  assert.deepEqual(notes.map(x => x.body), ['IAC scheduled 5/12', 'Second']);
  gas.call('deleteNote', { note_id: n.note_id }, OS);
  assert.equal(gas.call('getProDetail', { org_id: '4' }).notes.length, 1);
});

test('outstanding items: add, resolve, delete', () => {
  const gas = fresh();
  gas.call('createPro', { fields: { org_id: '6', business_name: 'Six' } });
  const p = gas.call('createProject', { fields: { org_id: '6', filing_type: 'C_CORP', tax_year: 2025 } }).project;
  const i = gas.call('addOutstanding', { project_id: p.project_id, item: '1099-NEC summary', owner_email: OS, due_date: '2026-10-01' });
  gas.call('resolveOutstanding', { item_id: i.item_id, resolved: true });
  assert.equal(gas.call('getProjectDetail', { project_id: p.project_id }).outstanding[0].resolved, true);
  gas.call('deleteOutstanding', { item_id: i.item_id });
  assert.equal(gas.call('getProjectDetail', { project_id: p.project_id }).outstanding.length, 0);
});

test('my tasks + progress in bootstrap', () => {
  const gas = fresh();
  gas.call('createPro', { fields: { org_id: '7', business_name: 'Seven', assigned_advisor_email: ADV_A } });
  const { tasks, project } = gas.call('createProject', { fields: { org_id: '7', filing_type: 'S_CORP', tax_year: 2025, tax_preparer_email: PREP } });
  const mine = tasks.filter(t => t.assignee_email === PREP);
  gas.call('setTaskStatus', { task_id: mine[0].task_id, status: 'DONE' }, PREP);
  const boot = gas.call('bootstrap', {}, PREP);
  assert.equal(boot.myTasks.length, mine.length);
  assert.ok(boot.myTasks.every(t => t.biz === 'Seven' && t.project_id === project.project_id));
  const proj = boot.projects.find(p => p.project_id === project.project_id);
  assert.equal(proj.progress, Math.round(100 / 25));
  assert.equal(proj.business_name, 'Seven');
  assert.equal(boot.pros.find(p => p.org_id === '7').projects, 1);
  const apply = boot.myTasks.find(t => t.title === 'Apply peer-review changes');
  assert.equal(apply.blocked_count, 1);
});

test('permissions: templates + settings are admin-only', () => {
  const gas = fresh();
  const r = gas.raw('saveTemplate', { template: { scope: 'PRO', title: 'x', section: 'ADVISORY_WORK' } }, OS);
  assert.equal(r.code, 'FORBIDDEN');
  const t = gas.call('saveTemplate', { template: { scope: 'PRO', title: 'Quarterly check-in', section: 'ADVISORY_WORK', default_role: 'ADVISOR', due_anchor: 'CLAIMED_AT', offset_days: 90 } });
  assert.ok(t.template_id);
  const v = gas.call('publishTemplates', { scope: 'PRO', note: 'add check-in' });
  assert.equal(v.version, 2);
  assert.equal(v.versions.length, 2);
});

test('prefs are per user even though the app runs as the deployer', () => {
  const gas = fresh();
  gas.call('savePrefs', { prefs: { density: 'compact', dark: true } }, OS);
  assert.equal(gas.call('bootstrap', {}, OS).prefs.density, 'compact');
  assert.equal(gas.call('bootstrap', {}, ADV_A).prefs.density, 'cozy');
});

/* ---------------- workbook extraction ---------------- */

function filledWorkbook() {
  const tabs = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'workbook-template.json'), 'utf8'));
  const set = (tab, a1, v) => {
    const t = tabs.find(x => x.name === tab);
    const m = a1.match(/^([A-Z]+)(\d+)$/);
    const c = m[1].split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
    const r = Number(m[2]) - 1;
    while (t.values.length <= r) t.values.push([]);
    t.values[r][c] = v;
  };
  const G = 'General Information';
  set(G, 'C8', '322284'); set(G, 'E8', 'Cedar Creek Plumbing'); set(G, 'H9', 'S - Corp'); set(G, 'I9', '2024');
  set(G, 'J9', 2019); set(G, 'K9', 'Plumbing'); set(G, 'C9', '1/1/2025'); set(G, 'E9', 'Cedar Creek Plumbing & Rooter');
  set(G, 'K11', 'OR'); set(G, 'K14', 'Pacific');
  set(G, 'C11', 'Shane Kessler'); set(G, 'C13', 'shane@cedarcreek.com'); set(G, 'C14', 0.6);
  set(G, 'F11', 'Dana Kessler'); set(G, 'F14', '40%');
  set(G, 'C16', 'Yes'); set(G, 'F16', 'Self-managed in QBO'); set(G, 'C17', 'Devon Bk'); set(G, 'F17', 'Gusto');
  set(G, 'C18', 'Owner prefers email');
  set(G, 'F22', 'Yes — OR + WA'); set(G, 'G22', 'service revenue'); set(G, 'F23', '2 W-2, 5 1099');
  set('SCorp  CCorp  Partnerships', 'F4', 'Yes — 2020');
  set('Sole Prop', 'F4', 'Yes');
  return tabs;
}

test('workbook extraction keys off labels (template layout)', () => {
  const gas = fresh();
  const roster = gas.ctx.Identity.roster();
  const out = gas.ctx.Intake.extract(filledWorkbook(), { roster });
  const f = Object.fromEntries(out.rows.filter(r => r.kind === 'field').map(r => [r.field, r.value]));
  assert.equal(f.org_id, '322284');
  assert.equal(f.business_name, 'Cedar Creek Plumbing');
  assert.equal(f.dba, 'Cedar Creek Plumbing & Rooter');
  assert.equal(f.entity_type, 'S_CORP');
  assert.equal(f.last_filing_year, 2024);
  assert.equal(f.year_started, 2019);
  assert.equal(f.vertical, 'Plumbing');
  assert.equal(f.state, 'OR');
  assert.equal(f.time_zone, 'America/Los_Angeles');
  assert.equal(f.scope_start_date, '2025-01-01');
  assert.equal(f.books_with_hcp, true);
  assert.equal(f.bk_lead_email, BK);
  assert.equal(f.payroll_servicer, 'Gusto');
  const owners = out.rows.filter(r => r.kind === 'owner');
  assert.equal(owners.length, 2);
  assert.equal(owners[0].value.pct, 60);
  assert.equal(owners[0].value.email, 'shane@cedarcreek.com');
  assert.equal(out.warnings.length, 0, out.warnings.join('; '));
  assert.equal(out.entityTab, 'Entity');
  const answers = out.rows.filter(r => r.kind === 'answer');
  assert.ok(answers.some(a => a.branch === 'GENERAL' && a.value === 'Yes — OR + WA' && a.notes === 'service revenue'));
  assert.ok(answers.some(a => a.branch === 'ENTITY' && a.value === 'Yes — 2020'));
  assert.ok(!answers.some(a => a.branch === 'SCHED_C'), 'sole prop tab not read for an S-Corp');
  assert.ok(out.rows.some(r => r.kind === 'note' && r.value === 'Owner prefers email'));
});

test('workbook extraction survives inserted rows / moved labels', () => {
  const gas = fresh();
  const tabs = filledWorkbook();
  const g = tabs[0];
  g.values.splice(6, 0, ['', 'An inserted row the rep added']);
  g.values.splice(19, 0, []);
  g.merges = g.merges.map(m => [m[0] >= 19 ? m[0] + 2 : m[0] >= 6 ? m[0] + 1 : m[0], m[1], m[2], m[3]]);
  const out = gas.ctx.Intake.extract(tabs, { roster: gas.ctx.Identity.roster() });
  const f = Object.fromEntries(out.rows.filter(r => r.kind === 'field').map(r => [r.field, r.value]));
  assert.equal(f.business_name, 'Cedar Creek Plumbing');
  assert.equal(f.entity_type, 'S_CORP');
  assert.equal(f.payroll_servicer, 'Gusto');
  assert.ok(out.rows.some(r => r.kind === 'answer' && r.value === '2 W-2, 5 1099'));
});

test('workbook warnings: owner % and entity mismatch; apply writes pro, answers (is_current), notes', () => {
  const gas = fresh();
  const tabs = filledWorkbook();
  tabs[0].values[13][5] = '30%';
  gas.call('createPro', { fields: { org_id: '322284', business_name: 'Cedar', entity_type: 'SOLE_PROP_SCHED_C' } });
  const out = gas.ctx.Intake.extract(tabs, { roster: gas.ctx.Identity.roster(), entityType: 'SOLE_PROP_SCHED_C' });
  assert.ok(out.warnings.some(w => /sums to 90/.test(w)));
  assert.ok(out.warnings.some(w => /Workbook says S-Corp/.test(w)));
  const res = gas.call('applyWorkbook', { org_id: '322284', rows: out.rows, filename: 'Tax Notes.xlsx' });
  assert.equal(res.pro.entity_type, 'S_CORP');
  assert.equal(res.pro.owner1_name, 'Shane Kessler');
  assert.equal(res.pro.owner2_pct, 30);
  assert.equal(res.pro.bk_lead_email, BK);
  // re-apply with a changed answer keeps history
  const again = out.rows.map(r => r.value === 'Yes — OR + WA' ? { ...r, value: 'Yes — OR only' } : r);
  gas.call('applyWorkbook', { org_id: '322284', rows: again });
  const all = gas.ctx.Db.list('IntakeAnswers').filter(a => a.question.startsWith('Did you do work'));
  assert.equal(all.length, 2);
  assert.equal(all.filter(a => a.is_current).length, 1);
  assert.equal(all.find(a => a.is_current).answer, 'Yes — OR only');
  assert.ok(gas.call('getProDetail', { org_id: '322284' }).notes.some(n => /Owner prefers email/.test(n.body)));
});

/* ---------------- migration ---------------- */

test('Asana CSV import: pros then projects, enum/people matching, tasks pre-completed by stage', () => {
  const gas = fresh();
  const pros = [
    'Name,Org ID,Entity Type,State,Advisor,OS,Section/Column,At Risk,Notes',
    '"Apex Tree, and Crane",405783,Partnership,co,Tara Advisor,cherrie.groves@housecallpro.com,Active project,No,"Long-time pro"',
    'Davis Plumbing,442827,Sole Prop,CO,Ashley Advisor,,Onboarded,yes,',
    'No id row,,S-Corp,CO,,,,,',
  ].join('\n');
  const prev = gas.call('importPreview', { kind: 'pros', csv: pros });
  assert.equal(prev.creates, 2);
  assert.equal(prev.error_count, 1);
  const res = gas.call('importApply', { kind: 'pros', csv: pros });
  assert.equal(res.created, 2);
  const apex = gas.call('getProDetail', { org_id: '405783' }).pro;
  assert.equal(apex.business_name, 'Apex Tree, and Crane');
  assert.equal(apex.entity_type, 'PARTNERSHIP');
  assert.equal(apex.state, 'CO');
  assert.equal(apex.assigned_advisor_email, ADV_B);
  assert.equal(apex.assigned_os_email, OS);
  assert.equal(apex.lifecycle_status, 'ACTIVE_PROJECT');
  const projects = [
    'Task Name,Org ID,Filing Type,Tax Year,Return Stage,Due Date,Extension Needed?,Assignee Email',
    'Apex Tree 2024,405783,1065,2024,Waiting for Pro,03/15/2025,Yes,jordan.preparer@housecallpro.com',
    'Davis Plumbing,,1040 + Sched C,2024,Complete,04/15/2025,No,',
  ].join('\n');
  const pr = gas.call('importApply', { kind: 'projects', csv: projects });
  assert.equal(pr.created, 2, pr.errors.join('; '));
  const boot = gas.call('bootstrap', {});
  const apexP = boot.projects.find(p => p.org_id === '405783');
  assert.equal(apexP.pipeline_status, 'WFP');
  assert.equal(apexP.filing_type, 'PARTNERSHIP');
  assert.equal(apexP.filing_deadline, '2025-03-15');
  assert.equal(apexP.extension_needed, true);
  assert.equal(apexP.tax_preparer_email, PREP);
  const tasks = gas.call('getProjectDetail', { project_id: apexP.project_id }).tasks;
  assert.ok(tasks.filter(t => t.section === 'DOC_GATHERING' || t.section === 'PREP').every(t => t.status === 'DONE'));
  assert.ok(tasks.filter(t => t.section === 'CLIENT_REVIEW').every(t => t.status === 'NOT_STARTED'));
  const davis = boot.projects.find(p => p.org_id === '442827');
  assert.equal(davis.pipeline_status, 'COMPLETE');
  assert.equal(davis.progress, 100);
  // re-import updates instead of duplicating
  const again = gas.call('importApply', { kind: 'projects', csv: projects });
  assert.equal(again.updated, 2);
  assert.equal(gas.call('bootstrap', {}).projects.length, 2);
});

/* ---------------- reports ---------------- */

test('reports compute from live data', () => {
  const gas = fresh();
  gas.call('createPro', { fields: { org_id: '8', business_name: 'Eight', assigned_advisor_email: ADV_A, at_risk: true, at_risk_reason: 'Unresponsive' } });
  const p = gas.call('createProject', { fields: { org_id: '8', filing_type: 'S_CORP', tax_year: 2024, filing_deadline: '2025-03-15' } }).project;
  gas.call('updateProject', { project_id: p.project_id, patch: { pipeline_status: 'PREP' } });
  const r = gas.call('getReports', {});
  assert.equal(r.pipeline.find(x => x.stage === 'PREP').count, 1);
  assert.equal(r.pipeline.find(x => x.stage === 'PREP').overdue, 1);
  assert.equal(r.cycle.rows.find(x => x.stage === 'IN_QUEUE').count, 1);
  assert.equal(r.risk.length, 1);
  assert.ok(r.advisor.find(a => a.advisor_email === ADV_A).open_projects >= 1);
  assert.ok(r.balance.next);
});

/* ---------------- regressions from code review ---------------- */

test('writes keep working past the sheet\'s initial 1,000-row grid', () => {
  const gas = fresh();
  gas.call('createPro', { fields: { org_id: '9', business_name: 'Nine' } });
  for (let i = 0; i < 1050; i++) gas.call('addNote', { entity_type: 'PRO', entity_id: '9', body: 'n' + i });
  assert.ok(gas.spreadsheet().getSheetByName('Notes').data.length > 1000);
  assert.equal(gas.call('getProDetail', { org_id: '9' }).notes.length, 1050);
});

test('wizard progress + Drive link are system writes: they never invalidate a user edit', () => {
  const gas = fresh();
  const folder = gas.addFolder('client data');
  gas.call('saveSettings', { settings: { drive_parent_id: folder } });
  const pro = gas.call('createPro', { fields: { org_id: '11', business_name: 'Eleven' } });
  gas.call('saveIntakeProgress', { org_id: '11', state: { step: 'A2', completed: ['A0', 'A1'] } });
  gas.call('provisionDrive', { org_id: '11' });
  const r = gas.call('updatePro', { org_id: '11', patch: { lifecycle_status: 'ONBOARDED' }, row_version: pro.row_version });
  assert.equal(r.pro.lifecycle_status, 'ONBOARDED');
  assert.equal(gas.call('getIntake', { org_id: '11' }).pro.intake_state.step, 'A2');
});

test('SFDC sync: a bad row is reported and skipped, the rest still import', () => {
  const gas = fresh();
  sfdcSheet(gas, [
    ['Broken Row Co', 'Cherrie Groves', 'N/A', '1', 1, '', '2026-01-01', 'Tax Onboarding', ''],
    ['Good Row Co', 'Cherrie Groves', '222', '2', 1, '', '2026-01-01', 'Tax Onboarding', ''],
  ]);
  const s = gas.call('runSfdcSync', {});
  assert.equal(s.created, 1);
  assert.equal(s.errors.length, 1);
  assert.match(s.errors[0], /N\/A/);
  assert.ok(gas.call('getProDetail', { org_id: '222' }).pro);
  assert.ok(gas.state.props.LAST_SFDC_SYNC, 'sync timestamp still recorded');
});

test('claim of an inbox item whose pro is gone leaves the item claimable', () => {
  const gas = fresh();
  sfdcSheet(gas, [['Gone Co', 'Cherrie Groves', '333', '3', 1, '', '2026-01-01', 'Tax Onboarding', '']]);
  gas.call('runSfdcSync', {});
  const pros = gas.spreadsheet().getSheetByName('Pros');
  pros.data = pros.data.filter((r, i) => i === 0 || r[pros.data[0].indexOf('org_id')] !== '333');
  gas.ctx.Db.clearCache();
  assert.throws(() => gas.call('claimInbox', { id: '3' }), /missing/);
  assert.equal(gas.ctx.Db.get('SfdcIntakeQueue', '3').state, 'NEW');
});

test('workbook upload with date cells returns serializable data', () => {
  const gas = fresh();
  gas.call('createPro', { fields: { org_id: '322284', business_name: 'Cedar' } });
  const tabs = filledWorkbook();
  tabs[0].values[8][2] = new Date('2025-01-01T07:00:00Z'); // Scope Start as a real Date
  tabs[0].values[3][3] = new Date('2026-09-01T06:00:00Z'); // Onboarding Date
  gas.state.nextConvertedId = gas.addSpreadsheet('converted', tabs.map((t) => ({ name: t.name, data: t.values })));
  const res = gas.raw('uploadWorkbook', { org_id: '322284', filename: 'Tax Notes.xlsx', base64: Buffer.from('x').toString('base64') });
  assert.equal(res.ok, true, res.error);
  const f = Object.fromEntries(res.data.rows.filter((r) => r.kind === 'field').map((r) => [r.field, r.value]));
  assert.equal(f.scope_start_date, '2025-01-01');
  assert.ok(!JSON.stringify(res.data.tabs).includes('"$date'), 'no Date objects in payload');
  assert.ok(res.data.tabs[0].values.flat().every((v) => !(v instanceof Date)));
});

test('daily export writes friendly Pros / Tax Returns / report tabs and appends pipeline history once per day', () => {
  const gas = fresh();
  gas.call('createPro', { fields: { org_id: '21', business_name: 'Export Co', assigned_advisor_email: ADV_A, entity_type: 'S_CORP' } });
  const p = gas.call('createProject', { fields: { org_id: '21', filing_type: 'S_CORP', tax_year: 2025, filing_deadline: '2020-03-15' } }).project;
  const r1 = gas.call('runExport', {});
  const ss = gas.spreadsheet(gas.state.props.EXPORT_SHEET_ID);
  const tab = (n) => ss.getSheetByName(n).data;
  const pros = tab('Pros');
  assert.equal(pros[1][pros[0].indexOf('Business')], 'Export Co');
  assert.equal(pros[1][pros[0].indexOf('Entity type')], 'S-Corp');
  assert.equal(pros[1][pros[0].indexOf('Tax advisor')], 'Ashley Advisor');
  const ret = tab('Tax Returns');
  assert.equal(ret[1][ret[0].indexOf('Project ID')], p.project_id);
  assert.equal(ret[1][ret[0].indexOf('Stage')], 'In queue');
  assert.equal(ret[1][ret[0].indexOf('Past deadline')], 'Yes');
  for (const n of ['About', 'Pipeline snapshot', 'Stage cycle time', 'Per-advisor summary', 'Advisor load balance', 'Logged time', 'At-risk pros', 'Pipeline history']) assert.ok(ss.getSheetByName(n), n);
  const h1 = tab('Pipeline history').length;
  gas.call('runExport', {});
  assert.equal(tab('Pipeline history').length, h1, 're-running the same day replaces, not duplicates');
  assert.equal(r1.counts.Pros, 1);
  assert.equal(gas.call('getSettings', {}).export.last.counts['Tax Returns'], 1);
  assert.equal(gas.raw('runExport', {}, OS).code, 'FORBIDDEN');
});


test('SFDC sync only takes cases created this calendar year or later', () => {
  const gas = fresh();
  sfdcSheet(gas, [
    ['Old ISO Co', 'Cherrie Groves', '801', 'C801', 1, '', '2022-05-01', 'Tax Onboarding', ''],
    ['Old US Co', 'Cherrie Groves', '802', 'C802', 1, '', `12/31/${YR - 1} 5:00 PM`, 'Tax Onboarding', ''],
    ['New US Co', 'Cherrie Groves', '803', 'C803', 1, '', `1/2/${YR} 9:15 AM`, 'Tax Onboarding', ''],
    ['New Date Co', 'Cherrie Groves', '804', 'C804', 1, '', new Date(YR, 2, 5), 'Tax Onboarding', ''],
    ['No Date Co', 'Cherrie Groves', '805', 'C805', 1, '', '', 'Tax Onboarding', ''],
  ]);
  const s = gas.call('runSfdcSync', {});
  assert.equal(s.skipped_old, 2);
  assert.equal(s.created, 3);
  assert.equal(s.cutoff, YR + '-01-01');
  const boot = gas.call('bootstrap', {});
  assert.deepEqual(boot.inbox.map(q => q.org_id).sort(), ['803', '804', '805']);
  assert.equal(boot.inbox.find(q => q.org_id === '803').created_date, YR + '-01-02');
  assert.ok(!boot.pros.find(p => p.org_id === '801'));
});

test('SFDC sync refuses a sheet without a Created Date column', () => {
  const gas = fresh();
  const id = gas.addSpreadsheet('SFDC feed', [{ name: 'Report', data: [['Account Name', 'Org ID', 'Case Record Type'], ['X', '1', 'Tax Onboarding']] }]);
  gas.call('saveSettings', { settings: { sfdc_sheet_id: id } });
  assert.match(gas.raw('runSfdcSync', {}).error, /Created Date/);
});

test('cleanup removes untouched pre-year Inbox cases, keeps worked ones, trashes empty folders', () => {
  const gas = fresh();
  const parent = gas.addFolder('Client data');
  gas.call('saveSettings', { settings: { drive_parent_id: parent } });
  const make = (org, name, date) => gas.ctx.Locks.withLock(() => gas.ctx.Sfdc.createFromCase(
    { org_id: org, business_name: name, case_owner: 'Cherrie Groves', case_number: 'K' + org, notes: 'SF note', created_date: date, record_type: 'Tax Onboarding' },
    { created: 0, created_ids: [], flagged_os: 0 }));
  make('901', 'Stale One', '2022-01-10');
  make('902', 'Stale Worked', '2023-04-02');
  make('903', 'Stale With Files', '2024-08-15');
  make('904', 'Current Co', YR + '-02-01');
  gas.call('createProject', { fields: { org_id: '902', filing_type: 'F1040_SCHC', tax_year: 2023 } });
  const withFiles = gas.call('getProDetail', { org_id: '903' }).pro.drive_folder_id;
  gas.state.folders[withFiles].files = 2;
  const staleFolder = gas.call('getProDetail', { org_id: '901' }).pro.drive_folder_id;
  const loadBefore = gas.ctx.Assign.loads().reduce((n, l) => n + l.count, 0);

  const plan = gas.call('sfdcCleanupPreview', {});
  assert.deepEqual(plan.remove.map(r => r.org_id).sort(), ['901', '903']);
  assert.deepEqual(plan.keep.map(r => [r.org_id, r.reason]), [['902', 'has a tax return']]);
  assert.equal(gas.raw('sfdcCleanup', {}, OS).code, 'FORBIDDEN');

  const res = gas.call('sfdcCleanup', {});
  assert.equal(res.removed, 1);
  assert.equal(res.pros_removed, 1);
  assert.equal(res.folders_trashed, 1);
  assert.equal(res.dismissed, 2);
  assert.ok(gas.state.folders[staleFolder].trashed);
  assert.ok(!gas.state.folders[withFiles].trashed);
  const boot = gas.call('bootstrap', {});
  assert.deepEqual(boot.inbox.map(q => q.org_id), ['904']);
  assert.ok(!boot.pros.find(p => p.org_id === '901'), 'untouched stale pro removed');
  assert.ok(boot.pros.find(p => p.org_id === '902') && boot.pros.find(p => p.org_id === '903'), 'worked pros kept');
  assert.equal(gas.ctx.Assign.loads().reduce((n, l) => n + l.count, 0), loadBefore - 1, 'advisor load drops');
  assert.equal(gas.ctx.Db.where('Notes', n => n.entity_id === '901').length, 0);
  assert.equal(gas.call('sfdcCleanupPreview', {}).remove.length, 0, 'second run has nothing left');
});

function reviewProject(gas, org, extra = {}) {
  gas.call('createPro', { fields: { org_id: org, business_name: 'Review Co ' + org, assigned_advisor_email: ADV_A } });
  return gas.call('createProject', { fields: { org_id: org, filing_type: 'F1040_SCHC', tax_year: 2025, tax_preparer_email: PREP, pipeline_status: 'PREP', ...extra } }).project;
}
const reviewTasks = (gas, pid) => gas.call('getProjectDetail', { project_id: pid }).tasks;
const taskNamed = (tasks, re) => tasks.find(t => re.test(t.title));

test('peer review: submit validates, moves to QA, closes self-review, opens the reviewer task', () => {
  const gas = fresh();
  const p = reviewProject(gas, '601');
  const base = { project_id: p.project_id, safe_harbor_amount: '$1,250', add_ons: ['Schedule C'], comments: 'Pro used transcript; no K-1.' };
  assert.equal(gas.raw('submitPeerReview', { ...base, add_ons: [] }, PREP).code, 'VALIDATION');
  assert.equal(gas.raw('submitPeerReview', { ...base, add_ons: ['No add-ons', 'Schedule C'] }, PREP).code, 'VALIDATION');
  assert.equal(gas.raw('submitPeerReview', { ...base, safe_harbor_amount: 'lots' }, PREP).code, 'VALIDATION');
  const res = gas.call('submitPeerReview', base, PREP);
  assert.equal(res.review.status, 'SUBMITTED');
  assert.equal(res.review.safe_harbor_amount, '1250.00');
  assert.equal(res.review.submitted_by, PREP);
  assert.equal(res.review.advisor_email, ADV_A);
  assert.equal(res.review.business_name, 'Review Co 601');
  assert.equal(res.project.pipeline_status, 'QA');
  assert.equal(res.project.add_ons, 'Schedule C');
  const tasks = reviewTasks(gas, p.project_id);
  assert.equal(taskNamed(tasks, /submit for peer review/i).status, 'DONE');
  const rt = taskNamed(tasks, /peer review verification/i);
  assert.equal(rt.task_id, res.review.review_task_id);
  assert.equal(rt.assignee_email, '');
  assert.ok(rt.due_date, 'review task gets a due date');
  assert.equal(gas.raw('submitPeerReview', base, PREP).code, 'CONFLICT', 'one open review per return');
  const d = gas.call('getProjectDetail', { project_id: p.project_id });
  assert.match(d.notes[d.notes.length - 1].body, /Submitted for peer review.*Schedule C.*\$1,250\.00/s);
  assert.equal(d.reviews.length, 1);
  assert.equal(gas.call('bootstrap', {}, PEER).reviews.length, 1);
});

test('peer review: claim → rework → resubmit → complete drives tasks, stage, notes and the report', () => {
  const gas = fresh();
  const p = reviewProject(gas, '602');
  const id = gas.call('submitPeerReview', { project_id: p.project_id, add_ons: ['Schedule C', 'Additional State(s)'], comments: 'CO + UT' }, PREP).review.review_id;
  assert.equal(gas.raw('claimPeerReview', { review_id: id }, PREP).code, 'FORBIDDEN', 'submitter can\'t claim');
  assert.equal(gas.raw('claimPeerReview', { review_id: id }, ADV_B).code, 'FORBIDDEN', 'needs PEER_REVIEWER role');
  const c = gas.call('claimPeerReview', { review_id: id }, PEER);
  assert.equal(c.review.status, 'IN_REVIEW');
  assert.equal(c.project.peer_reviewer_email, PEER);
  const rt = taskNamed(c.tasks, /peer review verification/i);
  assert.equal(rt.assignee_email, PEER);
  assert.equal(rt.status, 'IN_PROGRESS');
  assert.ok(gas.call('bootstrap', {}, PEER).myTasks.some(t => t.task_id === rt.task_id), 'shows in the reviewer\'s My Tasks');
  assert.equal(gas.raw('claimPeerReview', { review_id: id }, ADMIN).code, 'CONFLICT', 'already claimed');

  assert.equal(gas.raw('reworkPeerReview', { review_id: id, notes: 'x' }, ADV_A).code, 'FORBIDDEN');
  assert.equal(gas.raw('reworkPeerReview', { review_id: id, notes: ' ' }, PEER).code, 'VALIDATION');
  const w = gas.call('reworkPeerReview', { review_id: id, notes: 'UT apportionment missing' }, PEER);
  assert.equal(w.review.status, 'REWORK');
  assert.equal(w.review.rework_count, 1);
  const at = taskNamed(w.tasks, /apply peer-review changes/i);
  assert.equal(at.assignee_email, PREP);
  assert.equal(at.blocked_by, '');
  assert.ok(gas.call('bootstrap', {}, PREP).myTasks.some(t => t.task_id === at.task_id), 'rework shows in the preparer\'s My Tasks');

  assert.equal(gas.raw('resubmitPeerReview', { review_id: id }, ADV_B).code, 'FORBIDDEN');
  const s = gas.call('resubmitPeerReview', { review_id: id, note: 'Added UT TC-65' }, PREP);
  assert.equal(s.review.status, 'IN_REVIEW');
  assert.equal(s.review.round, 2);
  assert.equal(taskNamed(s.tasks, /apply peer-review changes/i).status, 'DONE');

  const done = gas.call('completePeerReview', { review_id: id, notes: 'Looks good', advance: true }, PEER);
  assert.equal(done.review.status, 'COMPLETE');
  assert.equal(done.review.completed_by, PEER);
  assert.equal(done.project.pipeline_status, 'CLIENT_REVIEW');
  assert.equal(taskNamed(reviewTasks(gas, p.project_id), /peer review verification/i).status, 'DONE');
  const d = gas.call('getProjectDetail', { project_id: p.project_id });
  const bodies = d.notes.map(n => n.body).join('\n');
  assert.match(bodies, /needs rework \(round 1\)[\s\S]*UT apportionment missing/);
  assert.match(bodies, /Resubmitted for peer review \(round 2\)/);
  assert.match(bodies, /Peer review complete after 2 rounds/);
  assert.deepEqual(d.reviews[0].events.map(e => e.action), ['SUBMITTED', 'CLAIMED', 'REWORK', 'RESUBMITTED', 'COMPLETED']);
  assert.equal(gas.call('bootstrap', {}).reviews.length, 0, 'closed reviews leave the open queue');
  assert.equal(gas.call('getPeerReviews', { closed: true }).length, 1);

  const rep = gas.call('getReports', {}).peer;
  assert.equal(rep.queue.completed, 1);
  assert.deepEqual(pickR(rep.reviewers[0]), { reviewer_email: PEER, completed: 1, sent_back: 1, rework_rate: 100 });
  assert.equal(rep.submitters[0].submitted_by, PREP);
  assert.equal(rep.submitters[0].reworked, 1);
  assert.equal(rep.log[0].rounds, 2);
  assert.ok(rep.log[0].hours_to_claim != null);

  gas.call('runExport', {});
  const ex = gas.spreadsheet(gas.state.props.EXPORT_SHEET_ID);
  const rows = ex.getSheetByName('Peer reviews').data;
  assert.equal(rows[1][rows[0].indexOf('Status')], 'Review complete');
  assert.equal(rows[1][rows[0].indexOf('Reviewer')], 'Casey Peer');
  assert.ok(ex.getSheetByName('Peer review summary'));
});
function pickR(r) { return { reviewer_email: r.reviewer_email, completed: r.completed, sent_back: r.sent_back, rework_rate: r.rework_rate }; }

test('peer review: designated reviewer gets the task at submit; release and cancel', () => {
  const gas = fresh();
  const p = reviewProject(gas, '603', { peer_reviewer_email: PEER });
  const sub = gas.call('submitPeerReview', { project_id: p.project_id, add_ons: ['No add-ons'] }, PREP);
  assert.equal(sub.review.reviewer_email, PEER);
  assert.ok(!sub.project.add_ons, '"No add-ons" leaves the project field empty');
  assert.equal(taskNamed(sub.tasks, /peer review verification/i).assignee_email, PEER);
  const id = sub.review.review_id;
  gas.call('claimPeerReview', { review_id: id }, PEER);
  const rel = gas.call('releasePeerReview', { review_id: id }, PEER);
  assert.equal(rel.review.status, 'SUBMITTED');
  assert.equal(rel.review.reviewer_email, '');
  assert.equal(taskNamed(rel.tasks, /peer review verification/i).assignee_email, '');
  assert.equal(gas.raw('cancelPeerReview', { review_id: id, reason: 'dup' }, ADV_B).code, 'FORBIDDEN');
  assert.equal(gas.raw('cancelPeerReview', { review_id: id, reason: '' }, PREP).code, 'VALIDATION');
  assert.equal(gas.call('cancelPeerReview', { review_id: id, reason: 'Sent too early' }, PREP).review.status, 'CANCELLED');
  // a fresh review can follow a cancelled one, and the reviewer's checklist starts over
  const again = gas.call('submitPeerReview', { project_id: p.project_id, add_ons: ['Schedule C'] }, PREP);
  assert.equal(again.review.status, 'SUBMITTED');
  assert.ok(taskNamed(again.tasks, /peer review verification/i).checklist.every(c => !c.checked));
  assert.equal(gas.raw('submitPeerReview', { project_id: p.project_id, add_ons: ['Schedule C'], reviewer_email: PREP }, PREP).code, 'CONFLICT');
});

test('new tabs and columns appear after a code update without re-running setup', () => {
  const gas = fresh();
  const ss = gas.spreadsheet();
  ss.deleteSheet(ss.getSheetByName('PeerReviews'));
  delete gas.state.props.SCHEMA_SIG;
  gas.ctx.Db.clearCache();
  gas.call('bootstrap', {});
  assert.ok(ss.getSheetByName('PeerReviews'), 'tab recreated on first use');
  assert.ok(gas.state.props.SCHEMA_SIG);
});


test('SFDC: reads the Tax OB Cases layout (UPPER_SNAKE headers) and picks the tab from a #gid link', () => {
  const gas = fresh();
  const header = ['ACCOUNT_NAME', 'CASE_OWNER', 'ORG_ID', 'CASE_NUMBER', 'SERVICE_TIME_DAYS', 'SUB_STATUS_NOTES', 'CREATED_DATE', 'CASE_RECORD_TYPE', 'DATE_TIME_CLOSED'];
  const id = gas.addSpreadsheet('Tax ACE SF Reports Refresh', [
    { name: 'Emails', data: [['x']], sheetId: 0 },
    { name: 'Tax OB Cases', sheetId: 98552997, data: [header,
      ['Breathe Easy HVAC', 'Cherrie Groves', '952000', '2266806', '0.16', 'Multi-Product Onboarding', `9/18/${YR} 2:54 PM`, 'Tax Onboarding', `9/28/${YR} 2:17 PM`],
      ['Old Co', 'Cherrie Groves', '111', '1', '1', '', '3/1/2024 9:00 AM', 'Tax Onboarding', ''],
    ] },
  ]);
  gas.call('saveSettings', { settings: { sfdc_sheet_id: `https://docs.google.com/spreadsheets/d/${id}/edit?gid=98552997#gid=98552997`, sfdc_tab: '' } });
  assert.equal(gas.state.props.SFDC_SOURCE_TAB, 'Tax OB Cases');
  const s = gas.call('runSfdcSync', {});
  assert.equal(s.tab, 'Tax OB Cases');
  assert.equal(s.created, 1);
  assert.equal(s.skipped_old, 1);
  const q = gas.call('bootstrap', {}).inbox[0];
  assert.equal(q.business_name, 'Breathe Easy HVAC');
  assert.equal(q.created_date, YR + '-09-18');
  assert.equal(q.resolved_os_email, OS);
  assert.equal(gas.raw('saveSettings', { settings: { sfdc_sheet_id: `https://docs.google.com/spreadsheets/d/${id}/edit#gid=42` } }).code, 'VALIDATION');
});

test('case owner nicknames and double first names resolve when unambiguous', () => {
  const gas = fresh();
  const idSheet = gas.spreadsheet().getSheetByName('Identity');
  const h = idSheet.data[0];
  const add = (name, email) => idSheet.data.push(h.map(c => ({ name, email, active: 'TRUE', roles: 'OS', accepting_new: 'TRUE' })[c] ?? ''));
  add('Cyril Bernal', 'cyril.bernal@housecallpro.com');
  add('Angel Julia Marcos', 'angeljulia.marcos@housecallpro.com');
  add('Sam Smith', 'sam.smith@housecallpro.com');
  add('Samantha Smith', 'samantha.smith@housecallpro.com');
  gas.ctx.Db.clearCache();
  const r = (n) => gas.ctx.Identity.resolveCaseOwner(n);
  assert.equal(r('Cy Bernal'), 'cyril.bernal@housecallpro.com');
  assert.equal(r('Angel Julia Marcos'), 'angeljulia.marcos@housecallpro.com');
  assert.equal(r('Sam Smith'), 'sam.smith@housecallpro.com', 'exact match wins');
  assert.equal(r('Sa Smith'), '', 'ambiguous → no guess');
});

test('audit rows append without reading the whole log', () => {
  const gas = fresh();
  gas.call('createPro', { fields: { org_id: '71', business_name: 'Audit Co' } });
  const log = gas.spreadsheet().getSheetByName('AuditLog');
  const before = log.data.length;
  gas.ctx.Db.clearCache();
  gas.ctx.Locks.withLock(() => gas.ctx.Audit.log('PRO', '71', 'Test', 'f', 'a', 'b'));
  assert.equal(log.data.length, before + 1);
  assert.equal(gas.call('getProDetail', { org_id: '71' }).audit[0].action, 'Test');
});

test('task fresh start: open advisor tasks from before this week move to TasksArchive', () => {
  const gas = fresh();
  gas.call('createPro', { fields: { org_id: '81', business_name: 'Old Tasks Co', assigned_advisor_email: ADV_A } });
  const p = gas.call('createProject', { fields: { org_id: '81', filing_type: 'F1040_SCHC', tax_year: 2025, tax_preparer_email: PREP } }).project;
  const tasks = gas.ctx.Db.list('Tasks').filter(t => t.entity_id === p.project_id);
  const done = tasks.find(t => t.assignee_role === 'ADVISOR');
  gas.call('setTaskStatus', { task_id: done.task_id, status: 'DONE' });
  // age everything to two weeks ago, except one brand-new advisor task
  const sh = gas.spreadsheet().getSheetByName('Tasks');
  const col = sh.data[0].indexOf('created_at');
  const old = new Date(Date.now() - 14 * 864e5).toISOString();
  sh.data.slice(1).forEach(r => { r[col] = old; });
  gas.ctx.Db.clearCache();
  const fresh1 = gas.call('createTask', { entity_type: 'PROJECT', entity_id: p.project_id, section: 'PREP', title: 'New this week', assignee_email: ADV_A });
  const openAdv = tasks.filter(t => t.task_id !== done.task_id && t.assignee_email === ADV_A).length;
  const preview = gas.call('taskCleanupPreview', { scope: 'ADVISOR' });
  assert.equal(preview.count, openAdv);
  assert.equal(preview.by_person[0].email, ADV_A);
  assert.equal(gas.raw('taskCleanup', { scope: 'ADVISOR' }, ADV_A).code, 'FORBIDDEN');
  const res = gas.call('taskCleanup', { scope: 'ADVISOR' });
  assert.equal(res.cleared, openAdv);
  const left = gas.ctx.Db.list('Tasks').filter(t => t.entity_id === p.project_id);
  assert.ok(left.find(t => t.task_id === fresh1.task_id), 'this week\'s task stays');
  assert.ok(left.find(t => t.task_id === done.task_id), 'done tasks stay');
  assert.ok(left.some(t => t.assignee_email === PREP), 'preparer tasks stay with the advisor scope');
  assert.equal(gas.ctx.Db.list('TasksArchive').length, openAdv);
  assert.match(gas.ctx.Db.list('TasksArchive')[0].cleared_reason, /Fresh start/);
  assert.ok(!gas.call('bootstrap', {}, ADV_A).myTasks.some(t => t.status !== 'DONE' && t.task_id !== fresh1.task_id));
  // Everyone scope picks up the rest
  const all = gas.call('taskCleanup', { scope: 'ALL' });
  assert.ok(all.cleared > 0);
  assert.equal(gas.ctx.Db.list('Tasks').filter(t => t.entity_id === p.project_id && t.status !== 'DONE').map(t => t.task_id).join(), fresh1.task_id);
});

test('churn: Closed/Lost archives the pro and its open returns, keeps Complete ones, respects later Saves, acts once', () => {
  const gas = fresh();
  const mk = (org, name) => gas.call('createPro', { fields: { org_id: org, business_name: name } });
  mk('504380', 'Sanchez Electric'); mk('423392', 'Flaming Ice'); mk('322284', 'Cedar Creek'); mk('777022', 'Open Case Co');
  const open = gas.call('createProject', { fields: { org_id: '504380', filing_type: 'F1040_SCHC', tax_year: 2025 } }).project;
  const done = gas.call('createProject', { fields: { org_id: '504380', filing_type: 'F1040_SCHC', tax_year: 2024, pipeline_status: 'COMPLETE', efile_date: '2025-04-01' } }).project;
  const header = ['Cancellation Notes', 'Resolution Date/Time', 'Case Owner', 'Status', 'Sub-Status', 'Account Name', 'Org ID'];
  const rows = [
    ['', '', 'A', 'In Progress', '', 'Open Case Co', '777022'],
    ['', '', 'A', 'Closed', 'Lost', 'Sanchez Electric', '504380'],
    ['', '', 'A', 'Closed', 'Lost', 'Flaming Ice', '423392'],
    ['', '', 'A', 'Closed', 'Saved', 'Flaming Ice', '423392'],
    ['', '', 'A', 'Closed', 'Saved', 'Cedar Creek', '322284'],
    ['', '', 'A', 'Closed', 'Lost', 'Cedar Creek', '322284'],
    ['', '', 'A', 'Closed', 'Lost', 'Not Ours', '999999'],
  ];
  const id = gas.addSpreadsheet('Bizsol Retention Data - All Time', [{ name: 'Tax', data: [header, ...rows], sheetId: 482008257 }]);
  gas.call('saveSettings', { settings: { churn_sheet_id: `https://docs.google.com/spreadsheets/d/${id}/edit?gid=482008257#gid=482008257` } });
  const pv = gas.call('churnPreview', {});
  assert.deepEqual(pv.actions.map(a => a.org_id).sort(), ['322284', '504380']);
  assert.equal(pv.returns_to_archive, 1);
  assert.equal(pv.complete_returns_kept, 1);
  assert.equal(pv.not_in_tax_manager, 1);
  assert.equal(gas.ctx.churnTrigger(), null, 'daily run stays off until an admin turns it on');
  const r = gas.call('churnRun', {});
  assert.equal(r.pros_archived, 2);
  assert.equal(r.returns_archived, 1);
  assert.equal(gas.state.props.CHURN_ENABLED, 'true');
  const boot = gas.call('bootstrap', {});
  const by = (o) => boot.pros.find(p => p.org_id === o);
  assert.ok(by('504380').archived && by('322284').archived);
  assert.match(by('504380').archive_reason, /Closed \/ Lost/);
  assert.ok(!by('423392').archived, 'saved after the loss');
  assert.ok(!by('777022').archived, 'open case');
  assert.ok(boot.projects.find(p => p.project_id === open.project_id).archived);
  assert.ok(!boot.projects.find(p => p.project_id === done.project_id).archived, 'complete return kept');
  // a manual restore sticks: the same loss doesn't act again
  gas.call('restorePro', { org_id: '504380' });
  assert.equal(gas.ctx.churnTrigger().pros_archived, 0);
  // a NEW lost case does act
  gas.spreadsheet(id).getSheetByName('Tax').data.push(['', '', 'B', 'Closed', 'Lost', 'Sanchez Electric', '504380']);
  assert.equal(gas.ctx.churnTrigger().pros_archived, 1);
});

test('changing a pro\'s advisor moves its open returns and open advisor tasks', () => {
  const gas = fresh();
  gas.call('createPro', { fields: { org_id: '91', business_name: 'Handoff Co', assigned_advisor_email: ADV_A } });
  const open = gas.call('createProject', { fields: { org_id: '91', filing_type: 'F1040_SCHC', tax_year: 2025 } }).project;
  const done = gas.call('createProject', { fields: { org_id: '91', filing_type: 'F1040_SCHC', tax_year: 2024, pipeline_status: 'COMPLETE', efile_date: '2025-04-01' } }).project;
  const other = gas.call('createProject', { fields: { org_id: '91', filing_type: 'S_CORP', tax_year: 2025 } }).project;
  gas.call('updateProject', { project_id: other.project_id, patch: { tax_advisor_email: ADV_B } });
  const pro = gas.call('getProDetail', { org_id: '91' }).pro;
  const res = gas.call('updatePro', { org_id: '91', patch: { assigned_advisor_email: ADV_B }, row_version: pro.row_version });
  assert.deepEqual(res.projects.map(p => p.project_id), [open.project_id]);
  const after = gas.call('bootstrap', {}).projects;
  assert.equal(after.find(p => p.project_id === open.project_id).tax_advisor_email, ADV_B);
  assert.equal(after.find(p => p.project_id === done.project_id).tax_advisor_email, ADV_A, 'completed return keeps its history');
  const advTasks = gas.call('getProjectDetail', { project_id: open.project_id }).tasks.filter(t => t.assignee_role === 'ADVISOR');
  assert.ok(advTasks.length && advTasks.every(t => t.assignee_email === ADV_B));
  // project-level change hands over that return's preparer tasks too
  gas.call('updateProject', { project_id: open.project_id, patch: { tax_preparer_email: PREP } });
  gas.call('updateProject', { project_id: open.project_id, patch: { tax_preparer_email: ADV_A } });
  const prepTasks = gas.call('getProjectDetail', { project_id: open.project_id }).tasks.filter(t => t.assignee_role === 'PREPARER' && t.status !== 'DONE');
  assert.ok(prepTasks.every(t => t.assignee_email === ADV_A));
});


test('feedback: anyone can send (with a screenshot); the weekly email sends only new items, once', () => {
  const gas = fresh();
  assert.equal(gas.raw('submitFeedback', { kind: 'BUG', message: ' ' }, PREP).code, 'VALIDATION');
  const png = Buffer.from('fake png').toString('base64');
  const f = gas.call('submitFeedback', { kind: 'BUG', message: 'Timer froze on <Summit>', page: '#/project/PRJ-1', screenshot: { mime: 'image/png', base64: png } }, PREP);
  assert.ok(f.screenshot_url);
  gas.call('submitFeedback', { kind: 'IDEA', message: 'Bulk reassign would help' }, OS);
  assert.equal(gas.raw('feedbackStatus', {}, PREP).code, 'FORBIDDEN');
  assert.equal(gas.call('feedbackStatus', {}).unsent, 2);
  gas.call('saveSettings', { settings: { feedback_email: 'shelby.lead@housecallpro.com' } });
  const r = gas.ctx.feedbackEmailTrigger();
  assert.equal(r.items, 2);
  const mail = gas.state.mail[0];
  assert.equal(mail.to, 'shelby.lead@housecallpro.com');
  assert.match(mail.subject, /2 new/);
  assert.match(mail.htmlBody, /Timer froze on &lt;Summit&gt;/, 'escaped');
  assert.match(mail.htmlBody, /Bugs \(1\)[\s\S]*Ideas \(1\)/);
  assert.match(mail.htmlBody, /Jordan Preparer/);
  assert.equal(gas.ctx.feedbackEmailTrigger().sent, false, 'nothing new → no email');
  assert.equal(gas.state.mail.length, 1);
});

test('morning digest: per-person tasks, deadlines and reviews; Slack DM or email; quiet people skipped', () => {
  const gas = fresh();
  gas.call('createPro', { fields: { org_id: '61', business_name: 'Digest Co', assigned_advisor_email: ADV_A } });
  const p = gas.call('createProject', { fields: { org_id: '61', filing_type: 'S_CORP', tax_year: 2025, tax_preparer_email: PREP, filing_deadline: gas.ctx.addDays_(gas.ctx.todayIso_(), 5) } }).project;
  const t = gas.call('createTask', { entity_type: 'PROJECT', entity_id: p.project_id, section: 'PREP', title: 'Late thing', assignee_email: PREP, due_date: gas.ctx.addDays_(gas.ctx.todayIso_(), -2) });
  gas.call('submitPeerReview', { project_id: p.project_id, add_ons: ['No add-ons'] }, PREP);
  const prev = gas.call('digestPreview', {}, PREP).text;
  assert.match(prev, /Good morning, Jordan/);
  assert.match(prev, /1 overdue/);
  assert.match(prev, /Late thing — Digest Co · TY2025/);
  assert.match(prev, /Return deadlines[\s\S]*Digest Co · TY2025 S-Corp/);
  assert.match(gas.call('digestPreview', {}, PEER).text, /1 waiting in the queue/);
  assert.equal(gas.call('digestPreview', {}, BK).text, '', 'nothing to say');
  assert.equal(gas.ctx.digestTrigger(), null, 'off by default');

  assert.equal(gas.raw('saveSettings', { settings: { slack_token: 'nope' } }).code, 'VALIDATION');
  gas.call('saveSettings', { settings: { slack_token: 'xoxb-123-abc', digest_channel: 'slack' } });
  assert.equal(gas.call('getSettings', {}).digest.slack_token_hint, '…-abc');
  assert.ok(!JSON.stringify(gas.call('getSettings', {})).includes('xoxb-123-abc'), 'token never sent to the browser');
  gas.state.fetchReply = (url) => (url.includes('lookupByEmail') ? { ok: true, user: { id: 'U' + url.length } } : { ok: true });
  const sum = gas.ctx.Digest.sendAll();
  assert.ok(sum.sent >= 2 && sum.nothing >= 1 && !sum.failed.length);
  const posts = gas.state.fetches.filter(f => f.url.endsWith('chat.postMessage'));
  assert.equal(posts.length, sum.sent);
  assert.equal(posts[0].opts.headers.Authorization, 'Bearer xoxb-123-abc');
  const lookups = gas.state.fetches.filter(f => f.url.includes('lookupByEmail')).length;
  gas.ctx.Digest.sendAll();
  assert.equal(gas.state.fetches.filter(f => f.url.includes('lookupByEmail')).length, lookups, 'Slack user IDs are cached');

  gas.state.fetchReply = (url) => (url.includes('lookupByEmail') ? { ok: false, error: 'users_not_found' } : { ok: true });
  gas.state.props.SLACK_USER_IDS = '{}';
  assert.match(gas.ctx.Digest.sendAll().failed[0], /users_not_found/);

  gas.call('saveSettings', { settings: { digest_channel: 'email' } });
  gas.state.mail = [];
  gas.call('digestTest', {}, PREP);
  assert.equal(gas.state.mail[0].to, PREP);
  assert.match(gas.state.mail[0].htmlBody, /<b>Good morning, Jordan!<\/b>/);
});


test('timer: stop uses the click time, a repeat stop adds nothing, short sessions log 1 minute, getTimer reflects the server', () => {
  const gas = fresh();
  gas.call('createPro', { fields: { org_id: '51', business_name: 'Timer Co' } });
  const p = gas.call('createProject', { fields: { org_id: '51', filing_type: 'F1040_SCHC', tax_year: 2025 } }).project;
  const e = gas.call('startTimer', { project_id: p.project_id }, PREP).entry;
  assert.equal(gas.call('getTimer', {}, PREP).entry_id, e.entry_id);
  assert.match(gas.call('getTimer', {}, PREP).label, /Timer Co · TY2025/);
  // pretend it started 50 minutes ago; the click happened 20 minutes ago (the save is late)
  const sh = gas.spreadsheet().getSheetByName('TimeEntries');
  const col = sh.data[0].indexOf('started_at');
  sh.data[1][col] = new Date(Date.now() - 50 * 60000).toISOString();
  gas.ctx.Db.clearCache();
  const stopped = gas.call('stopTimer', { entry_id: e.entry_id, at: new Date(Date.now() - 20 * 60000).toISOString() }, PREP);
  assert.equal(stopped.duration_min, 30);
  const again = gas.call('stopTimer', { entry_id: e.entry_id, at: new Date().toISOString() }, PREP);
  assert.equal(again.duration_min, 30, 'a retried stop never adds time');
  assert.equal(gas.call('getTimer', {}, PREP), null);
  const backdate = (id, sec) => { const r = sh.data.find(x => x[0] === id); r[col] = new Date(Date.now() - sec * 1000).toISOString(); gas.ctx.Db.clearCache(); };
  const quick = gas.call('startTimer', { project_id: p.project_id }, PREP).entry;
  backdate(quick.entry_id, 10);
  assert.equal(gas.call('stopTimer', { entry_id: quick.entry_id }, PREP).duration_min, 1, 'a few seconds still logs 1 minute');
  // a click time from the future or before the start is ignored
  const odd = gas.call('startTimer', { project_id: p.project_id }, PREP).entry;
  backdate(odd.entry_id, 10);
  assert.equal(gas.call('stopTimer', { entry_id: odd.entry_id, at: '1999-01-01T00:00:00Z' }, PREP).duration_min, 1);
});

/* ------------------------------------------------------------------ */

let failed = 0;
for (const t of tests) {
  try {
    await t.fn();
    console.log('  ✓ ' + t.name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + t.name + '\n    ' + (e.stack || e).toString().split('\n').slice(0, 6).join('\n    '));
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
