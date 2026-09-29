/**
 * Demo data for local dev + browser tests. All names are fictional.
 * Built through the real API so the data is exactly what production creates.
 */
export const DEV_USER = 'dana.lead@housecallpro.com';

const TEAM = [
  ['Dana Lead', DEV_USER, 'EXEC,ADMIN,ADVISOR,PREPARER', 'TRUE'],
  ['Riley Advisor', 'riley.advisor@housecallpro.com', 'ADVISOR,PREPARER', 'TRUE'],
  ['Sam Advisor', 'sam.advisor@housecallpro.com', 'ADVISOR', 'TRUE'],
  ['Jordan Prep', 'jordan.prep@housecallpro.com', 'PREPARER', 'TRUE'],
  ['Casey Review', 'casey.review@housecallpro.com', 'PEER_REVIEWER', 'TRUE'],
  ['Cherrie Groves', 'cherrie.groves@housecallpro.com', 'OS', 'TRUE'],
  ['Alex Onboard', 'alex.onboard@housecallpro.com', 'OS', 'TRUE'],
  ['Morgan Books', 'morgan.books@housecallpro.com', 'BK_LEAD,BK', 'TRUE'],
];

const PROS = [
  ['700101', 'Summit Peak Plumbing', 'Plumbing', 'CO', 'S_CORP', 'ACTIVE_PROJECT', { dba: 'Summit Plumbing', owner1_name: 'Lee Carter', owner1_pct: 100, books_with_hcp: true, doc_collection_status: 'PARTIAL', payroll_servicer: 'Gusto', year_started: 2014, last_filing_year: 2024 }],
  ['700102', 'Blue Ridge HVAC Co', 'HVAC', 'NC', 'S_CORP', 'ACTIVE_PROJECT', { owner1_name: 'Pat Moreno', owner1_pct: 60, owner2_name: 'Jess Moreno', owner2_pct: 40, doc_collection_status: 'WAITING', at_risk: true, at_risk_reason: 'Multi-state nexus unresolved', year_started: 2018 }],
  ['700103', 'Clearwater Window Cleaning', 'Cleaning', 'CA', 'SOLE_PROP_SCHED_C', 'ACTIVE_PROJECT', { owner1_name: 'Maya Ortiz', owner1_pct: 100, doc_collection_status: 'RECEIVED', year_started: 2021 }],
  ['700104', 'Ironwood Tree Service', 'Tree Care', 'CO', 'PARTNERSHIP', 'ACTIVE_PROJECT', { owner1_name: 'Ben Hale', owner1_pct: 50, owner2_name: 'Carla Hale', owner2_pct: 50, books_with_hcp: true, doc_collection_status: 'PARTIAL' }],
  ['700105', 'Northstar Electric', 'Electrical', 'MN', 'S_CORP', 'ONBOARDED', { owner1_name: 'Ravi Shah', owner1_pct: 100, doc_collection_status: 'WAITING', at_risk: true, at_risk_reason: 'Pro unresponsive 30+ days' }],
  ['700106', 'Harbor Garage Doors', 'Garage Doors', 'WA', 'PARTNERSHIP', 'ACTIVE_PROJECT', { owner1_name: 'Kim Vu', owner1_pct: 50, owner2_name: 'Lyn Vu', owner2_pct: 50, books_with_hcp: true }],
  ['700107', 'Greenline Pest Control', 'Pest Control', 'GA', 'SOLE_PROP_SCHED_C', 'ADVISORY_ONLY', { owner1_name: 'Cole Greene', owner1_pct: 100 }],
  ['700108', 'Redrock Roofing LLC', 'Roofing', 'NV', 'S_CORP', 'ACTIVE_PROJECT', { owner1_name: 'Jenna Park', owner1_pct: 100, books_with_hcp: true, payroll_servicer: 'QuickBooks' }],
  ['700109', 'Lakeside Handyman', 'Handyman', 'TX', 'SOLE_PROP_SCHED_C', 'ACTIVE_PROJECT', { owner1_name: 'Raul Diaz', owner1_pct: 100 }],
  ['700110', 'Pinecrest Mechanical', 'HVAC', 'OR', 'C_CORP', 'ACTIVE_PROJECT', { owner1_name: 'Alfred Ames', owner1_pct: 80, owner2_name: 'Ada Ames', owner2_pct: 20, books_with_hcp: true }],
];

const PROJECTS = [
  ['700101', 'S_CORP', 2025, 'PREP', {}],
  ['700101', 'S_CORP', 2024, 'COMPLETE', { efile_date: '2025-03-10' }],
  ['700102', 'S_CORP', 2025, 'DOC_GATHERING', { extension_needed: true, complexity: 'HIGH', states_covered: 'NC, SC' }],
  ['700103', 'F1040_SCHC', 2025, 'WFP', { complexity: 'LOW' }],
  ['700104', 'PARTNERSHIP', 2025, 'QA', { complexity: 'HIGH', states_covered: 'CO, WY' }],
  ['700106', 'PARTNERSHIP', 2025, 'CLIENT_REVIEW', {}],
  ['700108', 'S_CORP', 2025, 'BLOCKED', { blocker_reason: 'Awaiting prior-year return from CPA', complexity: 'HIGH' }],
  ['700109', 'F1040_SCHC', 2025, 'IN_QUEUE', {}],
  ['700110', 'C_CORP', 2025, 'FILING_DELIVERY', {}],
  ['700103', 'F1040_SCHC', 2024, 'COMPLETE', { efile_date: '2025-04-01' }],
];

const SFDC_ROWS = [
  ['Cedar Creek Plumbing', 'Cherrie Groves', '322284', '2258751', 1.01, 'Pre-intro email sent, left vm + sms.', '2026-09-20', 'Tax Onboarding', ''],
  ['Sleepwell Plumbing', 'Alex Onboard', '503122', '2258736', 1.01, 'Multi-product onboarding (Accounting + Tax). Pro confirmed meeting tomorrow.', '2026-09-21', 'Tax Onboarding', ''],
  ['Atrium Air', 'Angel Julia Marcos', '485748', '2256937', 1.87, '', '2026-09-22', 'Tax Onboarding', ''],
  ['Bright Payroll Co', 'Alex Onboard', '599001', '2256000', 2, '', '2026-09-22', 'Payroll Onboarding', ''],
  ['Old Case Plumbing', 'Alex Onboard', '599002', '2201000', 800, 'From 2023, should be skipped', '2023-03-14', 'Tax Onboarding', ''],
];

export function seed(gas) {
  const as = (u) => (a, p) => gas.call(a, p, u);
  const me = as(DEV_USER);
  gas.ctx.setup();
  const idSheet = gas.spreadsheet().getSheetByName('Identity');
  const h = idSheet.data[0];
  idSheet.data = [h, ...TEAM.map(([name, email, roles, active]) => h.map((c) => ({ name, email, roles, active, accepting_new: 'TRUE', color: '' })[c] ?? ''))];
  gas.ctx.Db.clearCache();

  const folder = gas.addFolder('HCP Tax Shared Drive / client data');
  const feed = gas.addSpreadsheet('New Tax Onboarding Cases', [{ name: 'Report', data: [
    ['Account Name', 'Case Owner', 'Org ID', 'Case Number', 'Service Time (Days)', 'Sub-Status Notes', 'Created Date', 'Case Record Type', 'Date/Time Closed'],
    ...SFDC_ROWS,
  ] }]);
  me('saveSettings', { settings: { drive_parent_id: folder, sfdc_sheet_id: feed } });

  const advisors = [DEV_USER, 'riley.advisor@housecallpro.com', 'sam.advisor@housecallpro.com'];
  const oses = ['cherrie.groves@housecallpro.com', 'alex.onboard@housecallpro.com'];
  PROS.forEach(([org, name, vertical, state, entity, lifecycle, extra], i) => {
    me('createPro', { fields: {
      org_id: org, business_name: name, vertical, state, entity_type: entity, lifecycle_status: lifecycle,
      assigned_advisor_email: advisors[i % 3], assigned_os_email: oses[i % 2], bk_lead_email: 'morgan.books@housecallpro.com',
      scope_start_date: '2025-01-01', time_zone: 'America/Denver', last_advisor_touchpoint: '2026-09-1' + (i % 9), ...extra,
    } });
  });
  // Pro onboarding tasks on a couple of pros
  ['700105', '700102'].forEach((org) => gas.ctx.Locks.withLock(() => gas.ctx.Tasks.materialize('PRO', gas.ctx.Db.get('Pros', org))));

  const preparers = ['jordan.prep@housecallpro.com', DEV_USER, 'riley.advisor@housecallpro.com'];
  PROJECTS.forEach(([org, type, ty, stage, extra], i) => {
    const res = me('createProject', { fields: {
      org_id: org, filing_type: type, tax_year: ty, tax_preparer_email: preparers[i % 3],
      peer_reviewer_email: i % 2 ? 'casey.review@housecallpro.com' : '', project_start_date: '2026-08-' + String(10 + i).padStart(2, '0'),
    } });
    const pid = res.project.project_id;
    const seq = ['IN_QUEUE', 'DOC_GATHERING', 'PREP', 'WFP', 'QA', 'CLIENT_REVIEW', 'FILING_DELIVERY', 'COMPLETE'];
    const target = stage === 'BLOCKED' ? 'PREP' : stage;
    for (let s = 1; s <= seq.indexOf(target); s++) me('updateProject', { project_id: pid, patch: { pipeline_status: seq[s], ...(seq[s] === 'COMPLETE' ? { efile_date: extra.efile_date } : {}) } });
    if (stage === 'BLOCKED') me('updateProject', { project_id: pid, patch: { pipeline_status: 'BLOCKED', blocker_reason: extra.blocker_reason } });
    const patch = { ...extra };
    delete patch.blocker_reason;
    if (Object.keys(patch).length) me('updateProject', { project_id: pid, patch });
    // Complete tasks in sections before the current stage
    const order = ['DOC_GATHERING', 'EXTENSION', 'PREP', 'INTERNAL_REVIEW_QC', 'CLIENT_REVIEW', 'FILING_DELIVERY'];
    const doneUpTo = { IN_QUEUE: 0, DOC_GATHERING: 0, PREP: 2, WFP: 2, QA: 3, CLIENT_REVIEW: 4, FILING_DELIVERY: 5, COMPLETE: 6, BLOCKED: 1 }[stage];
    res.tasks.filter((t) => !t.parent_task_id && order.indexOf(t.section) < doneUpTo).forEach((t) => me('setTaskStatus', { task_id: t.task_id, status: 'DONE' }));
    if (stage === 'DOC_GATHERING') me('setTaskStatus', { task_id: res.tasks[0].task_id, status: 'DONE' });
  });

  // Back-date stage history + add time entries so reports have shape
  const hist = gas.spreadsheet().getSheetByName('ProjectStageHistory');
  const hh = hist.data[0];
  const byProject = {};
  hist.data.slice(1).forEach((r) => { (byProject[r[hh.indexOf('project_id')]] = byProject[r[hh.indexOf('project_id')]] || []).push(r); });
  Object.values(byProject).forEach((rows, pi) => {
    let t = Date.now() - (rows.length * 7 + pi) * 864e5;
    rows.forEach((r, i) => {
      const span = [6, 8, 5, 9, 3, 6, 2, 2][i % 8] + (pi % 3);
      if (i > 0) t += span * 864e5;
      r[hh.indexOf('changed_at')] = new Date(t).toISOString();
      if (i > 0) r[hh.indexOf('days_in_prev_stage')] = String(span);
    });
  });
  const te = gas.spreadsheet().getSheetByName('TimeEntries');
  const th = te.data[0];
  const projs = gas.ctx.Db.list('Projects');
  [[0, DEV_USER, 94], [0, 'jordan.prep@housecallpro.com', 78], [2, 'riley.advisor@housecallpro.com', 45], [4, 'jordan.prep@housecallpro.com', 130], [5, DEV_USER, 60]].forEach(([pi, user, min], i) => {
    const start = Date.now() - (i + 1) * 26 * 3600e3;
    const row = { entry_id: 'TE-seed' + i, project_id: projs[pi].project_id, user_email: user, started_at: new Date(start).toISOString(), stopped_at: new Date(start + min * 60e3).toISOString(), duration_min: String(min), auto_stopped: 'FALSE', note: '' };
    te.data.push(th.map((c) => row[c] ?? ''));
  });
  gas.ctx.Db.clearCache();

  me('addNote', { entity_type: 'PRO', entity_id: '700101', body: 'IAC call done. Owner prefers email over phone.' });
  gas.call('addNote', { entity_type: 'PRO', entity_id: '700101', body: 'Reasonable comp looks low ($64k) — flag for review during prep.' }, 'riley.advisor@housecallpro.com');
  const p0 = projs[0].project_id;
  me('addOutstanding', { project_id: p0, item: '1099-NEC payer summary', owner_email: 'cherrie.groves@housecallpro.com', due_date: '2026-09-30' });
  me('addOutstanding', { project_id: p0, item: 'Vehicle mileage log', owner_email: '', due_date: '' });

  // Peer reviews in each state
  const asUser = (user, action, payload) => gas.call(action, payload, user);
  const open = gas.ctx.Db.list('Projects').filter((p) => ['PREP', 'WFP', 'DOC_GATHERING'].includes(p.pipeline_status) && !p.archived);
  const byPrep = (email) => open.find((p) => p.tax_preparer_email === email && !gas.ctx.PeerReviews.activeFor(p.project_id));
  const j = byPrep('jordan.prep@housecallpro.com');
  if (j) asUser('jordan.prep@housecallpro.com', 'submitPeerReview', { project_id: j.project_id, safe_harbor_amount: '4,200', add_ons: ['Schedule C', 'Additional State(s)'], comments: 'Multi-state: CO + UT. Pro used the 2025 transcript since no K-1 arrived.' });
  const r = byPrep('riley.advisor@housecallpro.com');
  if (r) {
    const id = asUser('riley.advisor@housecallpro.com', 'submitPeerReview', { project_id: r.project_id, safe_harbor_amount: '1250', add_ons: ['Schedule E'], comments: '' }).review.review_id;
    asUser('casey.review@housecallpro.com', 'claimPeerReview', { review_id: id });
    asUser('casey.review@housecallpro.com', 'reworkPeerReview', { review_id: id, notes: 'Depreciation on the 2023 truck is missing from the 4562. Estimated payments don\'t tie to the IRS transcript.' });
  }
  const d = byPrep(DEV_USER);
  if (d) {
    const id = me('submitPeerReview', { project_id: d.project_id, add_ons: ['No add-ons'], comments: 'Straightforward return.' }).review.review_id;
    asUser('casey.review@housecallpro.com', 'claimPeerReview', { review_id: id });
  }

  me('runSfdcSync', {});
  return gas;
}
