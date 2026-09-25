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
  assert.deepEqual(gas.state.triggers.sort(), ['sfdcSyncTrigger', 'timerAutoStopTrigger']);
  // re-running is idempotent
  gas.ctx.setup();
  assert.equal(gas.call('getTemplates', { scope: 'PROJECT' }).templates.length, 25);
  assert.equal(gas.state.triggers.length, 2);
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
    ['Cedar Creek Plumbing', 'Cherrie Groves', '322284', '2258751', 1.01, 'Pre-intro email sent', '2021-06-08', 'Tax Onboarding', ''],
    ['Atrium Air', 'Angel Julia Marcos', '485748', '2256937', 1.87, '', '2023-07-30', 'Tax Onboarding', ''],
    ['Some Payroll Co', 'Cherrie Groves', '999001', '2250000', 2, '', '2023-07-30', 'Payroll Onboarding', ''],
    ['Cedar Creek Plumbing (dup)', 'Cherrie Groves', '322284', '2258752', 1, '', '2021-06-08', 'Tax Onboarding', ''],
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
  sfdcSheet(gas, [['Cedar Creek Plumbing', 'Cherrie Groves', '322284', '2258751', 1, '', '2021-06-08', 'Tax Onboarding', '']]);
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
