/* Mock data — names sourced from the team's actual Asana portfolio.
 * Realistic enough that screen-reading feels like the real product.
 */

const TEAM = [
  { email: 'ashley.laudermilk@housecallpro.com', name: 'Ashley Laudermilk', initials: 'AL', color: '#9E9E9E', roles: ['ADVISOR', 'PREPARER'] },
  { email: 'alyssa.joyce@housecallpro.com',       name: 'Alyssa Joyce',     initials: 'AJ', color: '#F4C842', roles: ['OS'] },
  { email: 'morgan.knox@housecallpro.com',        name: 'Morgan Knox',      initials: 'MK', color: '#0E6FBE', roles: ['EXEC'] },
  { email: 'casey.flores@housecallpro.com',       name: 'Casey Flores',     initials: 'CF', color: '#00A344', roles: ['PEER_REVIEWER'] },
  { email: 'aria.morgan@housecallpro.com',        name: 'Aria Morgan',      initials: 'AM', color: '#F49AC2', roles: ['OS'] },
  { email: 'amelia.brooks@housecallpro.com',      name: 'Amelia Brooks',    initials: 'AB', color: '#F4C842', roles: ['BK', 'BK_LEAD'] },
  { email: 'jordan.green@housecallpro.com',       name: 'Jordan Green',     initials: 'JG', color: '#623CC9', roles: ['PREPARER'] },
  { email: 'devon.hayes@housecallpro.com',        name: 'Devon Hayes',      initials: 'DH', color: '#D81B60', roles: ['BK_TEAM_LEAD'] },
  { email: 'tara.lim@housecallpro.com',           name: 'Tara Lim',         initials: 'TL', color: '#0D47A1', roles: ['ADVISOR'] },
];
const teamByEmail = Object.fromEntries(TEAM.map(t => [t.email, t]));
function memberByInitials(i) { return TEAM.find(t => t.initials === i); }

const ME_EMAIL = 'morgan.knox@housecallpro.com';
const ME = teamByEmail[ME_EMAIL];

const PROS = [
  { org_id: '749297', business_name: '100 Year Plumbing & Sewer',          dba: '100Yr Plumbing',       vertical: 'Plumbing',    state: 'MO', time_zone: 'America/Chicago',  year_started: 2014, scope_start_date: '2024-01-01', entity_type: 'S_CORP',            lifecycle_status: 'ACTIVE_PROJECT', assigned_advisor_email: 'ashley.laudermilk@housecallpro.com', assigned_os_email: 'amelia.brooks@housecallpro.com',   bk_lead_email: 'devon.hayes@housecallpro.com', payroll_servicer: 'Gusto',         owner1_name: 'Reid Halsey',     owner1_pct: 100,  doc_collection_status: 'PARTIAL',  books_with_hcp: true,  prior_books_status: 'Current Q4', at_risk: false, last_advisor_touchpoint: '2026-05-05', last_filing_year: 2024, projects: 1 },
  { org_id: '811150', business_name: '180 Water Dickinson',                dba: null,                  vertical: 'Plumbing',    state: 'ND', time_zone: 'America/Chicago',  year_started: 2019, scope_start_date: '2024-04-01', entity_type: 'SOLE_PROP_SCHED_C', lifecycle_status: 'ACTIVE_PROJECT', assigned_advisor_email: 'ashley.laudermilk@housecallpro.com', assigned_os_email: 'aria.morgan@housecallpro.com',     bk_lead_email: 'devon.hayes@housecallpro.com', payroll_servicer: 'Quickbooks',     owner1_name: 'Cole Dickinson',  owner1_pct: 100,  doc_collection_status: 'RECEIVED', books_with_hcp: true,  prior_books_status: 'Caught up',   at_risk: false, last_advisor_touchpoint: '2026-04-21', last_filing_year: 2024, projects: 1 },
  { org_id: '133040', business_name: '2 Roots Cooling and Heating LLC',    dba: null,                  vertical: 'HVAC',        state: 'NC', time_zone: 'America/New_York', year_started: 2018, scope_start_date: '2025-07-01', entity_type: 'S_CORP',            lifecycle_status: 'ONBOARDED',      assigned_advisor_email: 'ashley.laudermilk@housecallpro.com', assigned_os_email: 'aria.morgan@housecallpro.com',     bk_lead_email: 'devon.hayes@housecallpro.com', payroll_servicer: 'ADP',           owner1_name: 'Maria Salazar',   owner1_pct: 60,   doc_collection_status: 'WAITING',  books_with_hcp: false, prior_books_status: 'Self-managed', at_risk: true,  at_risk_reason: 'Multi-state nexus unresolved', last_advisor_touchpoint: '2026-05-02', last_filing_year: 2023, projects: 1 },
  { org_id: '355892', business_name: 'Primary Heating and Cooling LLC',    dba: 'Primary HVAC',        vertical: 'HVAC',        state: 'CO', time_zone: 'America/Denver',   year_started: 2010, scope_start_date: '2023-01-01', entity_type: 'S_CORP',            lifecycle_status: 'ACTIVE_PROJECT', assigned_advisor_email: 'tara.lim@housecallpro.com',          assigned_os_email: 'amelia.brooks@housecallpro.com',   bk_lead_email: 'devon.hayes@housecallpro.com', payroll_servicer: 'Gusto',         owner1_name: 'Devon McAllister',owner1_pct: 60, owner2_name: 'Robin McAllister', owner2_pct: 40, doc_collection_status: 'RECEIVED', books_with_hcp: true,  prior_books_status: 'Current Q1', at_risk: false, last_advisor_touchpoint: '2026-05-08', last_filing_year: 2024, projects: 2 },
  { org_id: '152452', business_name: '2 Source 1 Roofing',                 dba: 'Source1 Roofing',     vertical: 'Roofing',     state: 'NV', time_zone: 'America/Los_Angeles', year_started: 2017, scope_start_date: '2023-04-01', entity_type: 'S_CORP',            lifecycle_status: 'ACTIVE_PROJECT', assigned_advisor_email: 'tara.lim@housecallpro.com',          assigned_os_email: 'aria.morgan@housecallpro.com',     bk_lead_email: 'devon.hayes@housecallpro.com', payroll_servicer: 'Quickbooks',     owner1_name: 'Jenna Beltran',   owner1_pct: 100,  doc_collection_status: 'PARTIAL',  books_with_hcp: true,  prior_books_status: 'Current Q4', at_risk: false, last_advisor_touchpoint: '2026-05-01', last_filing_year: 2024, projects: 2 },
  { org_id: '405783', business_name: 'Apex Tree and Crane Service',        dba: null,                  vertical: 'Tree Care',   state: 'CO', time_zone: 'America/Denver',   year_started: 2008, scope_start_date: '2024-01-01', entity_type: 'PARTNERSHIP',       lifecycle_status: 'ACTIVE_PROJECT', assigned_advisor_email: 'tara.lim@housecallpro.com',          assigned_os_email: 'amelia.brooks@housecallpro.com',   bk_lead_email: 'devon.hayes@housecallpro.com', payroll_servicer: 'Gusto',         owner1_name: 'Ben Wozniak',     owner1_pct: 50, owner2_name: 'Carla Wozniak',     owner2_pct: 50, doc_collection_status: 'PARTIAL',  books_with_hcp: true,  prior_books_status: 'Current Q3', at_risk: false, last_advisor_touchpoint: '2026-05-09', last_filing_year: 2024, projects: 1 },
  { org_id: '442827', business_name: 'Davis Plumbing and Drain Cleaning',  dba: 'Davis Plumbing',      vertical: 'Plumbing',    state: 'CO', time_zone: 'America/Denver',   year_started: 2020, scope_start_date: '2024-06-01', entity_type: 'SOLE_PROP_SCHED_C', lifecycle_status: 'ACTIVE_PROJECT', assigned_advisor_email: 'ashley.laudermilk@housecallpro.com', assigned_os_email: 'amelia.brooks@housecallpro.com',   bk_lead_email: 'devon.hayes@housecallpro.com', payroll_servicer: 'Square Payroll', owner1_name: 'Mac Davis',       owner1_pct: 100,  doc_collection_status: 'WAITING',  books_with_hcp: false, prior_books_status: 'Self-managed', at_risk: false, last_advisor_touchpoint: '2026-04-11', last_filing_year: 2024, projects: 1 },
  { org_id: '351598', business_name: 'James Hornoff',                      dba: null,                  vertical: 'Handyman',    state: 'CO', time_zone: 'America/Denver',   year_started: 2022, scope_start_date: '2024-01-01', entity_type: 'SOLE_PROP_SCHED_C', lifecycle_status: 'ACTIVE_PROJECT', assigned_advisor_email: 'tara.lim@housecallpro.com',          assigned_os_email: 'amelia.brooks@housecallpro.com',   bk_lead_email: null,                            payroll_servicer: null,             owner1_name: 'James Hornoff',   owner1_pct: 100,  doc_collection_status: 'RECEIVED', books_with_hcp: false, prior_books_status: 'N/A',         at_risk: false, last_advisor_touchpoint: '2026-04-30', last_filing_year: 2024, projects: 1 },
  { org_id: '182021', business_name: 'KC Plumbing and Rooter LLC',         dba: null,                  vertical: 'Plumbing',    state: 'OH', time_zone: 'America/New_York', year_started: 2015, scope_start_date: '2024-01-01', entity_type: 'S_CORP',            lifecycle_status: 'ACTIVE_PROJECT', assigned_advisor_email: 'ashley.laudermilk@housecallpro.com', assigned_os_email: 'amelia.brooks@housecallpro.com',   bk_lead_email: 'devon.hayes@housecallpro.com', payroll_servicer: 'Gusto',         owner1_name: 'Kerry Cole',      owner1_pct: 70, owner2_name: 'Tom Cole',         owner2_pct: 30, doc_collection_status: 'PARTIAL',  books_with_hcp: true,  prior_books_status: 'Current Q4', at_risk: false, last_advisor_touchpoint: '2026-05-06', last_filing_year: 2024, projects: 1 },
  { org_id: '155818', business_name: 'Perfect Temp',                       dba: null,                  vertical: 'HVAC',        state: 'IL', time_zone: 'America/Chicago',  year_started: 2016, scope_start_date: '2024-01-01', entity_type: 'S_CORP',            lifecycle_status: 'ACTIVE_PROJECT', assigned_advisor_email: 'ashley.laudermilk@housecallpro.com', assigned_os_email: 'aria.morgan@housecallpro.com',     bk_lead_email: 'devon.hayes@housecallpro.com', payroll_servicer: 'ADP',           owner1_name: 'Pat Geraldi',     owner1_pct: 100,  doc_collection_status: 'RECEIVED', books_with_hcp: true,  prior_books_status: 'Current Q4', at_risk: false, last_advisor_touchpoint: '2026-05-04', last_filing_year: 2024, projects: 1 },
  { org_id: '284718', business_name: 'SpotFree Window Cleaning',           dba: 'SpotFree',            vertical: 'Cleaning',    state: 'CA', time_zone: 'America/Los_Angeles', year_started: 2021, scope_start_date: '2024-01-01', entity_type: 'SOLE_PROP_SCHED_C', lifecycle_status: 'ACTIVE_PROJECT', assigned_advisor_email: 'ashley.laudermilk@housecallpro.com', assigned_os_email: 'amelia.brooks@housecallpro.com',   bk_lead_email: null,                            payroll_servicer: null,             owner1_name: 'Maya Pham',       owner1_pct: 100,  doc_collection_status: 'WAITING',  books_with_hcp: false, prior_books_status: 'N/A',         at_risk: false, last_advisor_touchpoint: '2026-04-25', last_filing_year: 2024, projects: 1 },
  { org_id: '476407', business_name: 'We Plumb LLC',                       dba: null,                  vertical: 'Plumbing',    state: 'TX', time_zone: 'America/Chicago',  year_started: 2012, scope_start_date: '2024-01-01', entity_type: 'PARTNERSHIP',       lifecycle_status: 'ACTIVE_PROJECT', assigned_advisor_email: 'ashley.laudermilk@housecallpro.com', assigned_os_email: 'amelia.brooks@housecallpro.com',   bk_lead_email: 'devon.hayes@housecallpro.com', payroll_servicer: 'Gusto',         owner1_name: 'Steve Vargas',    owner1_pct: 50, owner2_name: 'Eliza Vargas',     owner2_pct: 50, doc_collection_status: 'RECEIVED', books_with_hcp: true,  prior_books_status: 'Current Q4', at_risk: false, last_advisor_touchpoint: '2026-05-07', last_filing_year: 2024, projects: 1 },
  { org_id: '713050', business_name: '297 Solutions, LLC',                 dba: null,                  vertical: 'Handyman',    state: 'NC', time_zone: 'America/New_York', year_started: 2019, scope_start_date: '2025-01-01', entity_type: 'S_CORP',            lifecycle_status: 'ACTIVE_PROJECT', assigned_advisor_email: 'ashley.laudermilk@housecallpro.com', assigned_os_email: 'amelia.brooks@housecallpro.com',   bk_lead_email: 'devon.hayes@housecallpro.com', payroll_servicer: 'Quickbooks',     owner1_name: 'Sam Lawrence',    owner1_pct: 100,  doc_collection_status: 'RECEIVED', books_with_hcp: true,  prior_books_status: 'Current Q1', at_risk: false, last_advisor_touchpoint: '2026-05-08', last_filing_year: 2024, projects: 1 },
  { org_id: '724634', business_name: '3 DOGS PLUMBING',                    dba: '3 Dogs',              vertical: 'Plumbing',    state: 'OR', time_zone: 'America/Los_Angeles', year_started: 2011, scope_start_date: '2025-01-01', entity_type: 'S_CORP',            lifecycle_status: 'ONBOARDED',      assigned_advisor_email: 'tara.lim@housecallpro.com',          assigned_os_email: 'aria.morgan@housecallpro.com',     bk_lead_email: 'devon.hayes@housecallpro.com', payroll_servicer: 'Gusto',         owner1_name: 'Beth Olcott',     owner1_pct: 100,  doc_collection_status: 'WAITING',  books_with_hcp: true,  prior_books_status: 'Current Q4', at_risk: true,  at_risk_reason: 'Pro unresponsive 30+ days', last_advisor_touchpoint: '2026-04-10', last_filing_year: 2023, projects: 1 },
  { org_id: '464221', business_name: '3N1 HVAC',                           dba: null,                  vertical: 'HVAC',        state: 'NC', time_zone: 'America/New_York', year_started: 2017, scope_start_date: '2025-01-01', entity_type: 'S_CORP',            lifecycle_status: 'ACTIVE_PROJECT', assigned_advisor_email: 'ashley.laudermilk@housecallpro.com', assigned_os_email: 'aria.morgan@housecallpro.com',     bk_lead_email: 'devon.hayes@housecallpro.com', payroll_servicer: 'ADP',           owner1_name: 'Nate Hines',      owner1_pct: 100,  doc_collection_status: 'PARTIAL',  books_with_hcp: true,  prior_books_status: 'Current Q1', at_risk: false, last_advisor_touchpoint: '2026-05-03', last_filing_year: 2024, projects: 1 },
  { org_id: '822459', business_name: '3R HANDY PRO LLC',                   dba: null,                  vertical: 'Handyman',    state: 'TX', time_zone: 'America/Chicago',  year_started: 2023, scope_start_date: '2026-01-01', entity_type: 'S_CORP',            lifecycle_status: 'ACTIVE_PROJECT', assigned_advisor_email: 'tara.lim@housecallpro.com',          assigned_os_email: 'aria.morgan@housecallpro.com',     bk_lead_email: 'devon.hayes@housecallpro.com', payroll_servicer: 'Gusto',         owner1_name: 'Raul Robles',     owner1_pct: 100,  doc_collection_status: 'RECEIVED', books_with_hcp: true,  prior_books_status: 'Current Q1', at_risk: false, last_advisor_touchpoint: '2026-05-09', last_filing_year: 2024, projects: 1 },
  { org_id: '241749', business_name: '5 Star In Home Services',            dba: null,                  vertical: 'Cleaning',    state: 'OR', time_zone: 'America/Los_Angeles', year_started: 2018, scope_start_date: '2025-01-01', entity_type: 'S_CORP',            lifecycle_status: 'ACTIVE_PROJECT', assigned_advisor_email: 'ashley.laudermilk@housecallpro.com', assigned_os_email: 'aria.morgan@housecallpro.com',     bk_lead_email: 'devon.hayes@housecallpro.com', payroll_servicer: 'Quickbooks',     owner1_name: 'Linda Hopper',    owner1_pct: 100,  doc_collection_status: 'RECEIVED', books_with_hcp: true,  prior_books_status: 'Current Q1', at_risk: false, last_advisor_touchpoint: '2026-05-10', last_filing_year: 2024, projects: 1 },
  { org_id: '119006', business_name: 'A & A Mechanical, Inc.',             dba: null,                  vertical: 'HVAC',        state: 'CO', time_zone: 'America/Denver',   year_started: 2009, scope_start_date: '2024-01-01', entity_type: 'S_CORP',            lifecycle_status: 'ACTIVE_PROJECT', assigned_advisor_email: 'ashley.laudermilk@housecallpro.com', assigned_os_email: 'amelia.brooks@housecallpro.com',   bk_lead_email: 'devon.hayes@housecallpro.com', payroll_servicer: 'Gusto',         owner1_name: 'Alfred Acosta',   owner1_pct: 80, owner2_name: 'Adeline Acosta',   owner2_pct: 20, doc_collection_status: 'RECEIVED', books_with_hcp: true,  prior_books_status: 'Current Q1', at_risk: false, last_advisor_touchpoint: '2026-05-11', last_filing_year: 2024, projects: 1 },
  { org_id: '903412', business_name: 'Ridgeline Electric Co.',             dba: null,                  vertical: 'Electrical',  state: 'CO', time_zone: 'America/Denver',   year_started: 2019, scope_start_date: '2026-01-01', entity_type: 'S_CORP',            lifecycle_status: 'ONBOARDING_SCHEDULED', assigned_advisor_email: 'tara.lim@housecallpro.com',    assigned_os_email: 'aria.morgan@housecallpro.com',     bk_lead_email: 'devon.hayes@housecallpro.com', payroll_servicer: null,             owner1_name: 'Jamie Reyes',     owner1_pct: 100,  doc_collection_status: 'WAITING',  books_with_hcp: false, prior_books_status: 'N/A',         at_risk: false, last_advisor_touchpoint: null,           last_filing_year: null, projects: 0 },
  { org_id: '912088', business_name: 'Bayside Garage Doors',               dba: null,                  vertical: 'Garage Doors',state: 'CA', time_zone: 'America/Los_Angeles', year_started: 2015, scope_start_date: null,         entity_type: 'PARTNERSHIP',       lifecycle_status: 'CLOSED_WON',         assigned_advisor_email: 'tara.lim@housecallpro.com',    assigned_os_email: 'amelia.brooks@housecallpro.com',   bk_lead_email: null,                            payroll_servicer: null,             owner1_name: 'Bay Vu',          owner1_pct: 50, owner2_name: 'Lyn Vu',           owner2_pct: 50, doc_collection_status: 'WAITING',  books_with_hcp: false, prior_books_status: 'Unknown',     at_risk: false, last_advisor_touchpoint: null,           last_filing_year: null, projects: 0 },
  { org_id: '887211', business_name: 'Greene Pest Control',                dba: null,                  vertical: 'Pest Control',state: 'GA', time_zone: 'America/New_York', year_started: 2013, scope_start_date: '2024-01-01', entity_type: 'SOLE_PROP_SCHED_C', lifecycle_status: 'ADVISORY_ONLY',     assigned_advisor_email: 'ashley.laudermilk@housecallpro.com', assigned_os_email: 'aria.morgan@housecallpro.com',     bk_lead_email: null,                            payroll_servicer: null,             owner1_name: 'Cole Greene',     owner1_pct: 100,  doc_collection_status: 'RECEIVED', books_with_hcp: false, prior_books_status: 'Self-managed', at_risk: false, last_advisor_touchpoint: '2026-04-15', last_filing_year: 2024, projects: 0 },
  { org_id: '442001', business_name: 'McAllister & Sons Roofing',          dba: 'McAllister Roofing',  vertical: 'Roofing',     state: 'WA', time_zone: 'America/Los_Angeles', year_started: 2007, scope_start_date: '2024-01-01', entity_type: 'S_CORP',            lifecycle_status: 'ACTIVE_PROJECT', assigned_advisor_email: 'ashley.laudermilk@housecallpro.com', assigned_os_email: 'amelia.brooks@housecallpro.com',   bk_lead_email: 'devon.hayes@housecallpro.com', payroll_servicer: 'Gusto',         owner1_name: 'Bruce McAllister',owner1_pct: 60, owner2_name: 'Riley McAllister', owner2_pct: 40, doc_collection_status: 'PARTIAL',  books_with_hcp: true,  prior_books_status: 'Current Q3', at_risk: true,  at_risk_reason: 'Missing prior-year return', last_advisor_touchpoint: '2026-04-29', last_filing_year: 2024, projects: 1 },
];

const ARCHIVED_PROS = [
  { org_id: '339991', business_name: 'Sunset Tree Removal',     vertical: 'Tree Care', state: 'AZ', entity_type: 'SOLE_PROP_SCHED_C', lifecycle_status: 'ADVISORY_ONLY',  archived: true, archived_at: '2025-09-12', archived_by: 'morgan.knox@housecallpro.com', archive_reason: 'Churned — no longer using HCP' },
  { org_id: '441230', business_name: 'NorthStar Pressure Wash', vertical: 'Cleaning',  state: 'MN', entity_type: 'SOLE_PROP_SCHED_C', lifecycle_status: 'PASS_BACK',     archived: true, archived_at: '2025-11-02', archived_by: 'amelia.brooks@housecallpro.com', archive_reason: 'Duplicate org' },
];

const PROJECTS = [
  { project_id: 'PRJ-749297-2024-1040', org_id: '749297', business_name: '100 Year Plumbing & Sewer',         filing_type: 'F1040_SCHC',  tax_year: 2024, pipeline_status: 'DOC_GATHERING',   filing_deadline: '2025-04-15', tax_advisor_email: 'ashley.laudermilk@housecallpro.com', tax_preparer_email: 'ashley.laudermilk@housecallpro.com', peer_reviewer_email: null,                                  os_email: 'amelia.brooks@housecallpro.com',   complexity: 'MED',  states_covered: 'MO',          extension_needed: false, progress: 6 },
  { project_id: 'PRJ-811150-2024-1040', org_id: '811150', business_name: '180 Water Dickinson',               filing_type: 'F1040_SCHC',  tax_year: 2024, pipeline_status: 'COMPLETE',        filing_deadline: '2025-04-15', tax_advisor_email: 'ashley.laudermilk@housecallpro.com', tax_preparer_email: 'ashley.laudermilk@housecallpro.com', peer_reviewer_email: null,                                  os_email: 'aria.morgan@housecallpro.com',     complexity: 'LOW',  states_covered: 'ND',          extension_needed: false, progress: 100, efile_date: '2025-03-10' },
  { project_id: 'PRJ-133040-2025-SCORP',org_id: '133040', business_name: '2 Roots Cooling and Heating LLC',   filing_type: 'S_CORP',      tax_year: 2025, pipeline_status: 'DOC_GATHERING',   filing_deadline: '2026-03-15', tax_advisor_email: 'ashley.laudermilk@housecallpro.com', tax_preparer_email: 'ashley.laudermilk@housecallpro.com', peer_reviewer_email: null,                                  os_email: 'aria.morgan@housecallpro.com',     complexity: 'HIGH', states_covered: 'NC, SC',      extension_needed: true,  progress: 0 },
  { project_id: 'PRJ-355892-2023-1040', org_id: '355892', business_name: 'Primary Heating and Cooling LLC',   filing_type: 'F1040_SCHC',  tax_year: 2023, pipeline_status: 'DOC_GATHERING',   filing_deadline: '2024-04-15', tax_advisor_email: 'tara.lim@housecallpro.com',          tax_preparer_email: 'tara.lim@housecallpro.com',          peer_reviewer_email: null,                                  os_email: 'amelia.brooks@housecallpro.com',   complexity: 'MED',  states_covered: 'CO',          extension_needed: false, progress: 6 },
  { project_id: 'PRJ-152452-2023-SCORP',org_id: '152452', business_name: '2 Source 1 Roofing',                filing_type: 'S_CORP',      tax_year: 2023, pipeline_status: 'DOC_GATHERING',   filing_deadline: '2024-03-15', tax_advisor_email: 'tara.lim@housecallpro.com',          tax_preparer_email: 'tara.lim@housecallpro.com',          peer_reviewer_email: 'casey.flores@housecallpro.com',       os_email: 'aria.morgan@housecallpro.com',     complexity: 'MED',  states_covered: 'NV',          extension_needed: false, progress: 0 },
  { project_id: 'PRJ-405783-2024-PSHIP',org_id: '405783', business_name: 'Apex Tree and Crane Service',       filing_type: 'PARTNERSHIP', tax_year: 2024, pipeline_status: 'DOC_GATHERING',   filing_deadline: '2025-03-15', tax_advisor_email: 'tara.lim@housecallpro.com',          tax_preparer_email: 'tara.lim@housecallpro.com',          peer_reviewer_email: null,                                  os_email: 'amelia.brooks@housecallpro.com',   complexity: 'HIGH', states_covered: 'CO, WY',      extension_needed: false, progress: 12 },
  { project_id: 'PRJ-442827-2024-1040', org_id: '442827', business_name: 'Davis Plumbing and Drain Cleaning', filing_type: 'F1040_SCHC',  tax_year: 2024, pipeline_status: 'IN_QUEUE',        filing_deadline: '2025-04-15', tax_advisor_email: 'ashley.laudermilk@housecallpro.com', tax_preparer_email: 'jordan.green@housecallpro.com',      peer_reviewer_email: null,                                  os_email: 'amelia.brooks@housecallpro.com',   complexity: 'MED',  states_covered: 'CO',          extension_needed: false, progress: 18 },
  { project_id: 'PRJ-351598-2024-1040', org_id: '351598', business_name: 'James Hornoff',                     filing_type: 'F1040_SCHC',  tax_year: 2024, pipeline_status: 'COMPLETE',        filing_deadline: '2025-04-15', tax_advisor_email: 'tara.lim@housecallpro.com',          tax_preparer_email: 'tara.lim@housecallpro.com',          peer_reviewer_email: 'casey.flores@housecallpro.com',       os_email: 'amelia.brooks@housecallpro.com',   complexity: 'LOW',  states_covered: 'CO',          extension_needed: false, progress: 100, efile_date: '2025-03-22' },
  { project_id: 'PRJ-182021-2024-SCORP',org_id: '182021', business_name: 'KC Plumbing and Rooter LLC',        filing_type: 'S_CORP',      tax_year: 2024, pipeline_status: 'WFP',             filing_deadline: '2025-03-15', tax_advisor_email: 'ashley.laudermilk@housecallpro.com', tax_preparer_email: 'ashley.laudermilk@housecallpro.com', peer_reviewer_email: 'casey.flores@housecallpro.com',       os_email: 'amelia.brooks@housecallpro.com',   complexity: 'MED',  states_covered: 'OH',          extension_needed: true,  extension_filed: true,  progress: 14 },
  { project_id: 'PRJ-155818-2024-1040', org_id: '155818', business_name: 'Perfect Temp',                      filing_type: 'F1040_SCHC',  tax_year: 2024, pipeline_status: 'COMPLETE',        filing_deadline: '2025-04-15', tax_advisor_email: 'ashley.laudermilk@housecallpro.com', tax_preparer_email: 'ashley.laudermilk@housecallpro.com', peer_reviewer_email: null,                                  os_email: 'aria.morgan@housecallpro.com',     complexity: 'LOW',  states_covered: 'IL',          extension_needed: false, progress: 100, efile_date: '2025-03-30' },
  { project_id: 'PRJ-355892-2024-1040', org_id: '355892', business_name: 'Primary Heating and Cooling LLC',   filing_type: 'F1040_SCHC',  tax_year: 2024, pipeline_status: 'DOC_GATHERING',   filing_deadline: '2025-04-15', tax_advisor_email: 'tara.lim@housecallpro.com',          tax_preparer_email: 'tara.lim@housecallpro.com',          peer_reviewer_email: null,                                  os_email: 'amelia.brooks@housecallpro.com',   complexity: 'MED',  states_covered: 'CO',          extension_needed: false, progress: 9 },
  { project_id: 'PRJ-152452-2024-SCORP',org_id: '152452', business_name: '2 Source 1 Roofing',                filing_type: 'S_CORP',      tax_year: 2024, pipeline_status: 'WFP',             filing_deadline: '2025-03-15', tax_advisor_email: 'tara.lim@housecallpro.com',          tax_preparer_email: 'tara.lim@housecallpro.com',          peer_reviewer_email: 'casey.flores@housecallpro.com',       os_email: 'aria.morgan@housecallpro.com',     complexity: 'MED',  states_covered: 'NV',          extension_needed: false, progress: 25 },
  { project_id: 'PRJ-284718-2024-1040', org_id: '284718', business_name: 'SpotFree Window Cleaning',          filing_type: 'F1040_SCHC',  tax_year: 2024, pipeline_status: 'WFP',             filing_deadline: '2025-04-15', tax_advisor_email: 'ashley.laudermilk@housecallpro.com', tax_preparer_email: 'ashley.laudermilk@housecallpro.com', peer_reviewer_email: null,                                  os_email: 'amelia.brooks@housecallpro.com',   complexity: 'LOW',  states_covered: 'CA',          extension_needed: false, progress: 37 },
  { project_id: 'PRJ-476407-2024-PSHIP',org_id: '476407', business_name: 'We Plumb LLC',                      filing_type: 'PARTNERSHIP', tax_year: 2024, pipeline_status: 'WFP',             filing_deadline: '2025-03-15', tax_advisor_email: 'ashley.laudermilk@housecallpro.com', tax_preparer_email: 'jordan.green@housecallpro.com',      peer_reviewer_email: null,                                  os_email: 'amelia.brooks@housecallpro.com',   complexity: 'HIGH', states_covered: 'TX, NM',      extension_needed: false, progress: 13 },
  { project_id: 'PRJ-713050-2025-SCORP',org_id: '713050', business_name: '297 Solutions, LLC',                filing_type: 'S_CORP',      tax_year: 2025, pipeline_status: 'COMPLETE',        filing_deadline: '2026-03-15', tax_advisor_email: 'ashley.laudermilk@housecallpro.com', tax_preparer_email: 'ashley.laudermilk@housecallpro.com', peer_reviewer_email: 'casey.flores@housecallpro.com',       os_email: 'amelia.brooks@housecallpro.com',   complexity: 'MED',  states_covered: 'NC',          extension_needed: false, progress: 100, efile_date: '2026-02-18' },
  { project_id: 'PRJ-724634-2025-SCORP',org_id: '724634', business_name: '3 DOGS PLUMBING',                   filing_type: 'S_CORP',      tax_year: 2025, pipeline_status: 'DOC_GATHERING',   filing_deadline: '2026-03-15', tax_advisor_email: 'tara.lim@housecallpro.com',          tax_preparer_email: 'tara.lim@housecallpro.com',          peer_reviewer_email: null,                                  os_email: 'aria.morgan@housecallpro.com',     complexity: 'MED',  states_covered: 'OR',          extension_needed: false, progress: 0 },
  { project_id: 'PRJ-464221-2025-SCORP',org_id: '464221', business_name: '3N1 HVAC',                          filing_type: 'S_CORP',      tax_year: 2025, pipeline_status: 'DOC_GATHERING',   filing_deadline: '2026-03-15', tax_advisor_email: 'ashley.laudermilk@housecallpro.com', tax_preparer_email: 'ashley.laudermilk@housecallpro.com', peer_reviewer_email: null,                                  os_email: 'aria.morgan@housecallpro.com',     complexity: 'MED',  states_covered: 'NC',          extension_needed: false, progress: 0 },
  { project_id: 'PRJ-822459-2026-SCORP',org_id: '822459', business_name: '3R HANDY PRO LLC',                  filing_type: 'S_CORP',      tax_year: 2026, pipeline_status: 'IN_QUEUE',        filing_deadline: '2027-03-15', tax_advisor_email: 'tara.lim@housecallpro.com',          tax_preparer_email: 'tara.lim@housecallpro.com',          peer_reviewer_email: null,                                  os_email: 'aria.morgan@housecallpro.com',     complexity: 'MED',  states_covered: 'TX',          extension_needed: false, progress: 0 },
  { project_id: 'PRJ-241749-2025-SCORP',org_id: '241749', business_name: '5 Star In Home Services',           filing_type: 'S_CORP',      tax_year: 2025, pipeline_status: 'PREP',            filing_deadline: '2026-03-15', tax_advisor_email: 'ashley.laudermilk@housecallpro.com', tax_preparer_email: 'jordan.green@housecallpro.com',      peer_reviewer_email: null,                                  os_email: 'aria.morgan@housecallpro.com',     complexity: 'MED',  states_covered: 'OR, WA',      extension_needed: false, progress: 42 },
  { project_id: 'PRJ-119006-2025-SCORP',org_id: '119006', business_name: 'A & A Mechanical, Inc.',            filing_type: 'S_CORP',      tax_year: 2025, pipeline_status: 'QA',              filing_deadline: '2026-03-15', tax_advisor_email: 'ashley.laudermilk@housecallpro.com', tax_preparer_email: 'ashley.laudermilk@housecallpro.com', peer_reviewer_email: 'casey.flores@housecallpro.com',       os_email: 'amelia.brooks@housecallpro.com',   complexity: 'MED',  states_covered: 'CO',          extension_needed: false, progress: 78 },
  { project_id: 'PRJ-442001-2024-SCORP',org_id: '442001', business_name: 'McAllister & Sons Roofing',         filing_type: 'S_CORP',      tax_year: 2024, pipeline_status: 'BLOCKED',         blocker_reason: 'Awaiting prior-year return from CPA', filing_deadline: '2025-03-15', tax_advisor_email: 'ashley.laudermilk@housecallpro.com', tax_preparer_email: 'jordan.green@housecallpro.com', peer_reviewer_email: null, os_email: 'amelia.brooks@housecallpro.com',   complexity: 'HIGH', states_covered: 'WA',          extension_needed: true,  progress: 8 },
  { project_id: 'PRJ-119006-2024-SCORP',org_id: '119006', business_name: 'A & A Mechanical, Inc.',            filing_type: 'S_CORP',      tax_year: 2024, pipeline_status: 'CLIENT_REVIEW',   filing_deadline: '2025-03-15', tax_advisor_email: 'ashley.laudermilk@housecallpro.com', tax_preparer_email: 'ashley.laudermilk@housecallpro.com', peer_reviewer_email: 'casey.flores@housecallpro.com',       os_email: 'amelia.brooks@housecallpro.com',   complexity: 'MED',  states_covered: 'CO',          extension_needed: false, progress: 92 },
  { project_id: 'PRJ-749297-2024-SCORP',org_id: '749297', business_name: '100 Year Plumbing & Sewer',         filing_type: 'S_CORP',      tax_year: 2024, pipeline_status: 'FILING_DELIVERY', filing_deadline: '2025-03-15', tax_advisor_email: 'ashley.laudermilk@housecallpro.com', tax_preparer_email: 'ashley.laudermilk@housecallpro.com', peer_reviewer_email: 'casey.flores@housecallpro.com',       os_email: 'amelia.brooks@housecallpro.com',   complexity: 'MED',  states_covered: 'MO',          extension_needed: false, progress: 96 },
];

// Salesforce "New Tax Onboarding Cases" feed (refreshes every 4h). Columns mirror the source sheet:
// Account Name, Case Owner, Org ID, Case Number, Service Time (Days), Sub-Status Notes, Created Date.
// Auto-create rule: every new row → new Pro, deduped on Org ID. OS manually claims from the Inbox to
// kick off task-template materialization + the intake wizard. Advisor assigned by the load-balancer on claim.
const SFDC_INBOX = [
  { case_number: '2258751', business_name: 'Cedar Creek Plumbing',        org_id: '322284', case_owner: 'Rechel Tagalog',      service_days: 1.01,  created_date: '2021-06-08', notes: 'DW 9/23 · Churned last 8/28, completed tax onboarding 03/6. Tax Advisor: Ashley Lauderman. 9/23 pre-intro email sent, left vm + sms.' },
  { case_number: '2258736', business_name: 'Sleep Tight Plumbing',        org_id: '503122', case_owner: 'Rechel Tagalog',      service_days: 1.01,  created_date: '2023-09-27', notes: 'Multi-Product Onboarding Accounting + Tax + Payroll. DW 9/8. BKA Soraya Volcy · TA Dashonnon Heffker. Pro confirmed meeting tomorrow.' },
  { case_number: '2256937', business_name: 'Atrium Air',                  org_id: '485748', case_owner: 'Arianne Aguilar',      service_days: 1.87,  created_date: '2023-07-30', notes: '' },
  { case_number: '2254093', business_name: 'Call Of Dooty LLC',           org_id: '355190', case_owner: 'Cy Bernal',           service_days: 2.94,  created_date: '2022-02-19', notes: '9/23 Pro missed the meeting. Waited 20 mins. Called again — no answer. Sent email + text; no response. 9/22 pre-intro email sent.' },
  { case_number: '2256216', business_name: 'Unrivaled Heating and Cooling LLC', org_id: '575814', case_owner: 'Cath Matuguina', service_days: 2.02, created_date: '2024-05-08', notes: 'Multi-Product Onboarding Payroll-Accounting-Tax. DW 9/18. Promos: PR bundle 30% until 10/10.' },
  { case_number: '2252770', business_name: 'Resolve Electrical Services', org_id: '450002', case_owner: 'Cath Matuguina',      service_days: 3.21,  created_date: '2023-03-28', notes: 'Multi-Product Onboarding Accounting-Tax. DW 9/18. TA Dashonnon Heffker · BKA Caleb Wireman. 9/21 Pro had an emergency, rescheduling.' },
  { case_number: '2254736', business_name: 'Tetris Cleaning Services',    org_id: '2799',   case_owner: 'Cath Matuguina',      service_days: 2.81,  created_date: '2015-06-30', notes: 'Multi-Product Onboarding Payroll-Accounting-Tax. TA Dashonnon Heffker · BKA Soraya Volcy. BK account activated, OB completed since Aug 21.' },
  { case_number: '2222106', business_name: 'CT Mold Pros',                org_id: '636578', case_owner: 'Angel Julia Marcos',   service_days: 21.1,  created_date: '2024-10-03', notes: '' },
  { case_number: '2229424', business_name: 'A&E Backflow Testing LLC',    org_id: '802389', case_owner: 'Angel Julia Marcos',   service_days: 15.96, created_date: '2026-02-04', notes: '' },
];

// Running notes threads — one per record. Timestamped, editable, appended over time.
function makeProNotes() {
  return [
    { id: 'n1', author: 'aria.morgan@housecallpro.com',   at: '2026-05-06 09:58', body: 'IAC call scheduled for 5/12. Owner prefers email over phone.', edited: false },
    { id: 'n2', author: 'ashley.laudermilk@housecallpro.com', at: '2026-05-08 14:20', body: 'Confirmed S-Corp election on file since 2018. Reasonable comp looks low ($64k) — flag for review during prep.', edited: false },
    { id: 'n3', author: 'amelia.brooks@housecallpro.com', at: '2026-05-11 10:05', body: 'Books current through April. May bank statements still outstanding — chasing.', edited: true },
  ];
}
function makeProjectNotes() {
  return [
    { id: 'pn1', author: 'amelia.brooks@housecallpro.com', at: '2026-05-09 11:12', body: 'Doc collection call done. Missing 1099-NEC summary + vehicle mileage log.', edited: false },
    { id: 'pn2', author: 'jordan.green@housecallpro.com', at: '2026-05-13 08:40', body: 'Started prep. Schedule C income entered; waiting on fixed-asset detail before depreciation.', edited: false },
  ];
}

// Tasks for the focal Pro/Project — keyed by section. Built to look realistic per the original Asana exports.
function makeProTasks() {
  return [
    { section: 'ONBOARDING_SETUP', items: [
      { id: 'T1', title: 'Provision Drive folder',          assignee: 'aria.morgan@housecallpro.com',     due: '2026-05-08', status: 'DONE' },
      { id: 'T2', title: 'Send welcome email',              assignee: 'aria.morgan@housecallpro.com',     due: '2026-05-09', status: 'DONE' },
      { id: 'T3', title: 'Schedule IAC call',               assignee: 'aria.morgan@housecallpro.com',     due: '2026-05-12', status: 'DONE' },
      { id: 'T4', title: 'Send organizer to pro',           assignee: 'aria.morgan@housecallpro.com',     due: '2026-05-14', status: 'IN_PROGRESS' },
      { id: 'T5', title: 'Collect 8821 IRS authorization',  assignee: 'aria.morgan@housecallpro.com',     due: '2026-05-16', status: 'NOT_STARTED' },
    ]},
    { section: 'RETURN_PREP_KICKOFF', items: [
      { id: 'T6',  title: 'Confirm prior-year return on file',          assignee: 'tara.lim@housecallpro.com',           due: '2026-05-18', status: 'NOT_STARTED' },
      { id: 'T7',  title: 'Confirm books status with BK lead',          assignee: 'amelia.brooks@housecallpro.com',      due: '2026-05-18', status: 'NOT_STARTED' },
      { id: 'T8',  title: 'Confirm state nexus + multi-state flagging', assignee: 'tara.lim@housecallpro.com',           due: '2026-05-20', status: 'NOT_STARTED' },
    ]},
    { section: 'ADVISORY_WORK', items: [
      { id: 'T9',  title: 'Estimated tax payment review (Q2)',          assignee: null,                                  assigneeRole: 'ADVISOR', due: '2026-06-10', status: 'NOT_STARTED' },
      { id: 'T10', title: 'Bookkeeping touchpoint — May',               assignee: 'amelia.brooks@housecallpro.com',      due: '2026-05-30', status: 'NOT_STARTED' },
    ]},
  ];
}

function makeProjectTasks() {
  return [
    { section: 'DOC_GATHERING', items: [
      { id: 'P1', title: 'Review status of INHA books',                          assignee: 'amelia.brooks@housecallpro.com', due: '2026-05-08', status: 'DONE' },
      { id: 'P2', title: 'Check Doc Request to see if complete',                 assignee: 'amelia.brooks@housecallpro.com', due: '2026-05-09', status: 'DONE',
        subtasks: [
          { id: 'P2a', title: 'Cross-reference signed engagement letter', assignee: 'amelia.brooks@housecallpro.com', due: '2026-05-09', status: 'DONE' },
        ]},
      { id: 'P3', title: 'Have doc collection call',                             assignee: 'amelia.brooks@housecallpro.com', due: '2026-05-09', status: 'DONE' },
      { id: 'P4', title: 'Review documents for quality and completeness',        assignee: null, assigneeRole: 'PREPARER', due: '2026-05-13', status: 'IN_PROGRESS' },
      { id: 'P5', title: 'Send email to pro thanking for documents',             assignee: 'amelia.brooks@housecallpro.com', due: '2026-05-14', status: 'NOT_STARTED' },
    ]},
    { section: 'EXTENSION', items: [
      { id: 'P6', title: 'Determine if extension is needed',                     assignee: 'ashley.laudermilk@housecallpro.com', due: '2026-05-15', status: 'NOT_STARTED' },
      { id: 'P7', title: 'File extension',                                       assignee: 'ashley.laudermilk@housecallpro.com', due: '2026-06-01', status: 'NOT_STARTED', blockedBy: ['P6'] },
      { id: 'P8', title: 'Verify extension transmission acceptance',             assignee: 'ashley.laudermilk@housecallpro.com', due: '2026-06-02', status: 'NOT_STARTED', blockedBy: ['P7'] },
    ]},
    { section: 'PREP', items: [
      { id: 'P9',  title: 'Confirm state filing requirements + Profile Section', assignee: 'jordan.green@housecallpro.com', due: '2026-06-12', status: 'NOT_STARTED' },
      { id: 'P10', title: 'Complete return Client info',                         assignee: 'jordan.green@housecallpro.com', due: '2026-06-13', status: 'NOT_STARTED' },
      { id: 'P11', title: 'Complete Income/Deduction Info',                      assignee: 'jordan.green@housecallpro.com', due: '2026-06-16', status: 'NOT_STARTED',
        subtasks: [
          { id: 'P11a', title: 'Enter Schedule C income',          assignee: 'jordan.green@housecallpro.com', due: '2026-06-16', status: 'NOT_STARTED' },
          { id: 'P11b', title: 'Enter 1099-NEC payer summary',     assignee: 'jordan.green@housecallpro.com', due: '2026-06-16', status: 'NOT_STARTED' },
          { id: 'P11c', title: 'Apply meal/vehicle deductions',    assignee: 'jordan.green@housecallpro.com', due: '2026-06-16', status: 'NOT_STARTED' },
        ]},
      { id: 'P12', title: 'Enter/Confirm fixed assets + depreciation schedule', assignee: 'jordan.green@housecallpro.com', due: '2026-06-18', status: 'NOT_STARTED' },
      { id: 'P13', title: 'Self-review and submit for peer review',             assignee: 'jordan.green@housecallpro.com', due: '2026-06-20', status: 'NOT_STARTED' },
    ]},
    { section: 'INTERNAL_REVIEW_QC', items: [
      { id: 'P14', title: 'Peer Review Verification',                            assignee: 'casey.flores@housecallpro.com', due: '2026-06-25', status: 'NOT_STARTED', checklist: [
        { id: 'c1', label: 'Taxpayer name + SSN verified',           checked: false },
        { id: 'c2', label: 'Spouse name + SSN verified',             checked: false },
        { id: 'c3', label: 'DOB(s) match prior year',                checked: false },
        { id: 'c4', label: 'Address matches IRS records',            checked: false },
        { id: 'c5', label: 'Fees recorded correctly',                checked: false },
        { id: 'c6', label: 'Engagement letter signed + on file',     checked: false },
        { id: 'c7', label: 'E-file diagnostics resolved',            checked: false },
        { id: 'c8', label: 'State filings included where required',  checked: false },
        { id: 'c9', label: 'Estimated payments accounted for',       checked: false },
        { id: 'c10',label: 'Return PDF previewed for legibility',    checked: false },
      ]},
      { id: 'P15', title: 'Apply peer-review changes',                           assignee: 'jordan.green@housecallpro.com', due: '2026-06-27', status: 'NOT_STARTED', blockedBy: ['P14'] },
    ]},
    { section: 'CLIENT_REVIEW', items: [
      { id: 'P16', title: 'Send draft return to pro for review',                 assignee: 'ashley.laudermilk@housecallpro.com', due: '2026-06-30', status: 'NOT_STARTED' },
      { id: 'P17', title: 'Host client review call',                             assignee: 'ashley.laudermilk@housecallpro.com', due: '2026-07-02', status: 'NOT_STARTED' },
      { id: 'P18', title: 'Collect signed 8879 (e-file auth)',                   assignee: 'amelia.brooks@housecallpro.com',    due: '2026-07-05', status: 'NOT_STARTED' },
    ]},
    { section: 'FILING_DELIVERY', items: [
      { id: 'P19', title: 'E-file return',                                       assignee: 'jordan.green@housecallpro.com', due: '2026-07-06', status: 'NOT_STARTED' },
      { id: 'P20', title: 'Confirm IRS acceptance',                              assignee: 'jordan.green@housecallpro.com', due: '2026-07-07', status: 'NOT_STARTED' },
      { id: 'P21', title: 'Deliver signed copies to Drive folder',               assignee: 'amelia.brooks@housecallpro.com', due: '2026-07-08', status: 'NOT_STARTED' },
    ]},
  ];
}

/* Tasks across records, for the My Tasks view (logged-in user = Morgan / Exec but
 * we treat them as if assigned to a mix to show realistic content) */
const MY_TASKS = [
  { id: 'M1', title: 'Apply peer-review changes — Apex Tree S-Corp',  proj: 'PRJ-405783-2024-PSHIP', biz: 'Apex Tree and Crane Service', section: 'Internal Review / QC', due: '2026-05-09', status: 'NOT_STARTED' },
  { id: 'M2', title: 'Confirm prior-year return on file',             proj: 'PRJ-355892-2024-1040', biz: 'Primary Heating and Cooling LLC', section: 'Doc Gathering',     due: '2026-05-11', status: 'NOT_STARTED', blockedBy: 1 },
  { id: 'M3', title: 'Review documents for quality and completeness', proj: 'PRJ-749297-2024-1040', biz: '100 Year Plumbing & Sewer',  section: 'Doc Gathering',        due: '2026-05-13', status: 'IN_PROGRESS' },
  { id: 'M4', title: 'Estimated tax payment review (Q2)',             proj: null,                   biz: '5 Star In Home Services',     section: 'Advisory Work',        due: '2026-05-14', status: 'NOT_STARTED', org_id: '241749' },
  { id: 'M5', title: 'Host client review call',                       proj: 'PRJ-119006-2024-SCORP', biz: 'A & A Mechanical, Inc.',      section: 'Client Review',         due: '2026-05-15', status: 'NOT_STARTED' },
  { id: 'M6', title: 'Send draft return to pro',                      proj: 'PRJ-152452-2024-SCORP', biz: '2 Source 1 Roofing',          section: 'Client Review',         due: '2026-05-18', status: 'NOT_STARTED' },
  { id: 'M7', title: 'Self-review and submit for peer review',        proj: 'PRJ-284718-2024-1040', biz: 'SpotFree Window Cleaning',    section: 'Prep',                  due: '2026-05-20', status: 'NOT_STARTED' },
  { id: 'M8', title: 'Books touchpoint — May',                        proj: null,                   biz: 'KC Plumbing and Rooter LLC',  section: 'Advisory Work',        due: '2026-05-30', status: 'NOT_STARTED', org_id: '182021' },
  { id: 'M9', title: 'Send organizer to pro',                         proj: null,                   biz: 'Ridgeline Electric Co.',      section: 'Onboarding & Setup',   due: '2026-05-14', status: 'IN_PROGRESS', org_id: '903412' },
];

// Task template structure for the Template editor
const PROJ_TEMPLATE_SECTIONS = [
  { section: 'DOC_GATHERING',     label: 'Document Gathering',     count: 5 },
  { section: 'EXTENSION',         label: 'Extension',               count: 3 },
  { section: 'PREP',              label: 'Tax Return Preparation', count: 11 },
  { section: 'INTERNAL_REVIEW_QC',label: 'Internal Review / QC',   count: 3 },
  { section: 'CLIENT_REVIEW',     label: 'Client Review',           count: 4 },
  { section: 'FILING_DELIVERY',   label: 'Filing & Delivery',       count: 4 },
];

const PROJ_TEMPLATES = [
  { section: 'DOC_GATHERING', title: 'Review status of INHA books',              role: 'BK',        anchor: 'PROJECT_START', offset: 0,  active: true },
  { section: 'DOC_GATHERING', title: 'Check Doc Request to see if complete',     role: 'BK',        anchor: 'PROJECT_START', offset: 1,  active: true },
  { section: 'DOC_GATHERING', title: 'Have doc collection call',                 role: 'BK',        anchor: 'PROJECT_START', offset: 1,  active: true },
  { section: 'DOC_GATHERING', title: 'Review documents for quality',             role: 'PREPARER',  anchor: 'PROJECT_START', offset: 5,  active: true },
  { section: 'DOC_GATHERING', title: 'Send "thanks for docs" email',             role: 'BK',        anchor: 'PROJECT_START', offset: 6,  active: true },
  { section: 'EXTENSION',     title: 'Determine if extension is needed',         role: 'ADVISOR',   anchor: 'PROJECT_START', offset: 7,  active: true },
  { section: 'EXTENSION',     title: 'File extension',                           role: 'ADVISOR',   anchor: 'FILING_DEADLINE', offset: -14, active: true },
  { section: 'EXTENSION',     title: 'Verify extension transmission',            role: 'ADVISOR',   anchor: 'FILING_DEADLINE', offset: -13, active: true },
  { section: 'PREP',          title: 'Confirm state filing requirements',        role: 'PREPARER',  anchor: 'PROJECT_START', offset: 28, active: true },
  { section: 'PREP',          title: 'Complete return Client info',              role: 'PREPARER',  anchor: 'PROJECT_START', offset: 29, active: true },
  { section: 'PREP',          title: 'Complete Income/Deduction Info',           role: 'PREPARER',  anchor: 'PROJECT_START', offset: 31, active: true },
  { section: 'PREP',          title: 'Enter/Confirm fixed assets + depreciation', role: 'PREPARER', anchor: 'PROJECT_START', offset: 33, active: true },
  { section: 'PREP',          title: 'Self-review and submit for peer review',   role: 'PREPARER',  anchor: 'PROJECT_START', offset: 35, active: true },
  { section: 'INTERNAL_REVIEW_QC', title: 'Peer Review Verification',            role: 'PEER_REVIEWER', anchor: 'PROJECT_START', offset: 40, active: true, isChecklist: true, checklistCount: 10 },
  { section: 'INTERNAL_REVIEW_QC', title: 'Apply peer-review changes',           role: 'PREPARER',  anchor: 'PROJECT_START', offset: 42, active: true },
  { section: 'CLIENT_REVIEW',  title: 'Send draft return to pro',                role: 'ADVISOR',   anchor: 'PROJECT_START', offset: 45, active: true },
  { section: 'CLIENT_REVIEW',  title: 'Host client review call',                 role: 'ADVISOR',   anchor: 'PROJECT_START', offset: 47, active: true },
  { section: 'CLIENT_REVIEW',  title: 'Collect signed 8879 (e-file auth)',       role: 'BK',        anchor: 'PROJECT_START', offset: 50, active: true },
  { section: 'FILING_DELIVERY', title: 'E-file return',                          role: 'PREPARER',  anchor: 'EFILE_DATE',     offset: 0,  active: true },
  { section: 'FILING_DELIVERY', title: 'Confirm IRS acceptance',                 role: 'PREPARER',  anchor: 'EFILE_DATE',     offset: 1,  active: true },
  { section: 'FILING_DELIVERY', title: 'Deliver signed copies to Drive folder',  role: 'BK',        anchor: 'EFILE_DATE',     offset: 2,  active: true },
];

const ENUM_LABELS = {
  LIFECYCLE_STATUS: {
    CLOSED_WON: 'Closed-won', ONBOARDING_SCHEDULED: 'Onboarding scheduled', PASS_BACK: 'Pass back',
    ONBOARDED: 'Onboarded', ADVISORY_ONLY: 'Advisory only', ACTIVE_PROJECT: 'Active project',
  },
  PIPELINE_STATUS: {
    IN_QUEUE: 'In queue', IN_QUEUE_ESCALATED: 'In queue (escalated)', DOC_GATHERING: 'Doc gathering',
    PREP: 'Prep', WFP: 'Waiting for pro', QA: 'QA', CLIENT_REVIEW: 'Client review',
    FILING_DELIVERY: 'Filing & delivery', COMPLETE: 'Complete', BLOCKED: 'Blocked',
  },
  FILING_TYPE: {
    F1040_SCHC: '1040 + Sched C', S_CORP: 'S-Corp', PARTNERSHIP: 'Partnership',
    C_CORP: 'C-Corp', AMENDMENT: 'Amendment', S_CORP_ELECTION: 'S-Corp election',
    LLC_FORMATION: 'LLC formation', DISSOLUTION: 'Dissolution', UNKNOWN: 'Unknown',
  },
  ENTITY_TYPE: {
    SOLE_PROP_SCHED_C: 'Sole prop / Sched C', PARTNERSHIP: 'Partnership',
    S_CORP: 'S-Corp', C_CORP: 'C-Corp',
  },
  DOC_COLLECTION_STATUS: { WAITING: 'Waiting', RECEIVED: 'Received', PARTIAL: 'Partial' },
  ROLE: { ADVISOR: 'Advisor', PREPARER: 'Preparer', PEER_REVIEWER: 'Peer Reviewer', OS: 'OS', BK: 'BK', BK_LEAD: 'BK Lead', BK_TEAM_LEAD: 'BK Team Lead', EXEC: 'Exec' },
  TASK_SECTION: {
    ONBOARDING_SETUP: 'Onboarding & Setup', RETURN_PREP_KICKOFF: 'Return Prep Kickoff', ADVISORY_WORK: 'Advisory Work',
    DOC_GATHERING: 'Document Gathering', EXTENSION: 'Extension', PREP: 'Tax Return Preparation',
    INTERNAL_REVIEW_QC: 'Internal Review / QC', CLIENT_REVIEW: 'Client Review', FILING_DELIVERY: 'Filing & Delivery',
  },
  TASK_STATUS: { NOT_STARTED: 'Not started', IN_PROGRESS: 'In progress', BLOCKED: 'Blocked', DONE: 'Done', SKIPPED: 'Skipped' },
};

const SAVED_VIEWS_PROS = [
  { id: 'all', label: 'All pros', filters: { archived: false } },
  { id: 'my',  label: 'My pros', filters: { advisor: ME_EMAIL } },
  { id: 'risk',label: 'At risk', filters: { at_risk: true } },
  { id: 'onb', label: 'Onboarding', filters: { lifecycle: ['CLOSED_WON', 'ONBOARDING_SCHEDULED'] } },
];

const SAVED_VIEWS_PROJ = [
  { id: 'all',     label: 'All projects', filters: {} },
  { id: 'my',      label: 'My projects',  filters: { advisor: ME_EMAIL } },
  { id: 'sched-c', label: '1040 + Sched C', filters: { filing_type: 'F1040_SCHC' } },
  { id: 'open',    label: 'Open',           filters: { exclude_status: ['COMPLETE'] } },
  { id: 'qa',      label: 'Pending peer review', filters: { status: ['QA'] } },
];

/* ---- Stage history (one row per pipeline transition) ---- */
/* Backs stage-duration analytics. Real backend: ProjectStageHistory tab. */
const PIPELINE_SEQUENCE = ['IN_QUEUE', 'DOC_GATHERING', 'PREP', 'WFP', 'QA', 'CLIENT_REVIEW', 'FILING_DELIVERY', 'COMPLETE'];

// Per-project transition log for the focal project (shown on Project detail → Stage timeline)
function makeStageHistory(project) {
  const advisor = project.tax_advisor_email;
  // Synthesize a plausible walk up to the project's current stage
  const idx = PIPELINE_SEQUENCE.indexOf(project.pipeline_status);
  const stopAt = idx < 0 ? 1 : idx;
  const spans = [7, 9, 5, 6, 4, 8, 3, 2]; // days per stage (illustrative)
  const rows = [];
  let day = new Date('2026-01-06T09:00:00');
  for (let i = 0; i <= stopAt; i++) {
    const from = i === 0 ? null : PIPELINE_SEQUENCE[i - 1];
    const to = PIPELINE_SEQUENCE[i];
    const changed = new Date(day);
    rows.push({
      from_stage: from,
      to_stage: to,
      changed_at: changed.toISOString().slice(0, 10),
      changed_by: i % 3 === 0 ? project.os_email : advisor,
      advisor_email: advisor,
      days_in_prev_stage: from ? spans[i - 1] : null,
    });
    day.setDate(day.getDate() + spans[i]);
  }
  return rows;
}

/* ---- Aggregate stage-cycle-time report (avg days per stage, + per advisor) ---- */
const STAGE_CYCLE_REPORT = [
  { stage: 'DOC_GATHERING',   avg_days: 8.4,  median_days: 7,  count: 22, ashley: 7.9, tara: 9.1 },
  { stage: 'PREP',            avg_days: 6.2,  median_days: 6,  count: 20, ashley: 5.8, tara: 6.9 },
  { stage: 'WFP',             avg_days: 9.7,  median_days: 8,  count: 18, ashley: 8.4, tara: 11.5 },
  { stage: 'QA',              avg_days: 3.1,  median_days: 3,  count: 15, ashley: 3.0, tara: 3.3 },
  { stage: 'CLIENT_REVIEW',   avg_days: 5.5,  median_days: 5,  count: 12, ashley: 5.1, tara: 6.2 },
  { stage: 'FILING_DELIVERY', avg_days: 2.3,  median_days: 2,  count: 11, ashley: 2.1, tara: 2.6 },
];

/* ---- Per-advisor summary report ---- */
const ADVISOR_REPORT = [
  { advisor_email: 'ashley.laudermilk@housecallpro.com', open_projects: 8, completed_ytd: 14, avg_cycle_days: 28.4, on_time_pct: 93, actual_hrs: 61.5 },
  { advisor_email: 'tara.lim@housecallpro.com',          open_projects: 7, completed_ytd: 9,  avg_cycle_days: 34.7, on_time_pct: 88, actual_hrs: 48.2 },
];

/* ---- Time entries (work timer log) ---- */
const TIME_ENTRIES = [
  { project_id: 'PRJ-749297-2024-1040', user_email: 'ashley.laudermilk@housecallpro.com', started_at: '2026-09-22 09:14', stopped_at: '2026-09-22 10:48', duration_min: 94 },
  { project_id: 'PRJ-749297-2024-1040', user_email: 'jordan.green@housecallpro.com',      started_at: '2026-09-23 13:02', stopped_at: '2026-09-23 14:20', duration_min: 78 },
  { project_id: 'PRJ-749297-2024-1040', user_email: 'ashley.laudermilk@housecallpro.com', started_at: '2026-09-24 08:40', stopped_at: '2026-09-24 09:25', duration_min: 45 },
];

/* CSV helper — used by report export buttons */
function toCSV(rows, columns) {
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const head = columns.map(c => esc(c.label)).join(',');
  const body = rows.map(r => columns.map(c => esc(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(',')).join('\n');
  return head + '\n' + body;
}
function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

Object.assign(window, {
  TEAM, teamByEmail, memberByInitials, ME_EMAIL, ME,
  PROS, ARCHIVED_PROS, PROJECTS, SFDC_INBOX, MY_TASKS,
  makeProTasks, makeProjectTasks, makeProNotes, makeProjectNotes,
  PROJ_TEMPLATE_SECTIONS, PROJ_TEMPLATES,
  ENUM_LABELS,
  SAVED_VIEWS_PROS, SAVED_VIEWS_PROJ,
  PIPELINE_SEQUENCE, makeStageHistory, STAGE_CYCLE_REPORT, ADVISOR_REPORT, TIME_ENTRIES,
  toCSV, downloadCSV,
});

/* ---- Advisor load balancing (least-loaded assignment) ---- */
// Eligible advisors: active, ADVISOR role, accepting new clients.
const ADVISOR_AVAILABILITY = {
  'ashley.laudermilk@housecallpro.com': { accepting: true },
  'tara.lim@housecallpro.com':          { accepting: true },
};
function advisorLoads() {
  const advisors = TEAM.filter(t => t.roles.includes('ADVISOR'));
  return advisors.map(a => {
    const active = PROS.filter(p => p.assigned_advisor_email === a.email && !p.archived);
    return {
      email: a.email,
      name: a.name,
      count: active.length,
      accepting: (ADVISOR_AVAILABILITY[a.email] || {}).accepting !== false,
      // most recent assignment timestamp for round-robin tiebreak
      lastAssigned: active.reduce((m, p) => p.last_advisor_touchpoint && p.last_advisor_touchpoint > m ? p.last_advisor_touchpoint : m, ''),
    };
  });
}
// Returns the advisor email that should get the next Pro (least-loaded, round-robin tiebreak).
function nextAdvisor() {
  const eligible = advisorLoads().filter(a => a.accepting);
  if (!eligible.length) return null;
  eligible.sort((a, b) => a.count - b.count || (a.lastAssigned < b.lastAssigned ? -1 : 1));
  return eligible[0].email;
}

Object.assign(window, { ADVISOR_AVAILABILITY, advisorLoads, nextAdvisor });
