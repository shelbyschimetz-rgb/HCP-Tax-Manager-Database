/* Remaining screens: Home, My Tasks, Templates, Archive, Intake Wizard, SFDC Inbox. */

/* ---- Home / role-based landing ---- */
function Home({ onNav }) {
  const myProjects = PROJECTS.filter(p => p.tax_advisor_email === ME_EMAIL || p.tax_preparer_email === ME_EMAIL);
  let myPros = PROS.filter(p => p.assigned_advisor_email === ME_EMAIL);
  const sidebarLabel = myPros.length > 0 ? 'My pros' : 'Recently visited';
  if (myPros.length === 0) myPros = PROS.slice(0, 5);
  const myTasks    = MY_TASKS;
  const overdue    = myTasks.filter(t => dueClass(t.due) === 'overdue');
  const today      = myTasks.filter(t => dueClass(t.due) === 'today');

  return (
    <div data-screen-label="Home">
      <div className="home-greet">Good afternoon, {ME.name.split(' ')[0]}.</div>
      <p className="home-sub">It's Wednesday, May 13. {overdue.length} task{overdue.length === 1 ? '' : 's'} overdue · {today.length} due today.</p>

      <div className="home-stat-grid">
        <div className="home-stat">
          <div className="label">My tasks today</div>
          <div className="val">{today.length}</div>
          <div className="delta down">{overdue.length} overdue</div>
        </div>
        <div className="home-stat">
          <div className="label">Open projects assigned</div>
          <div className="val">{myProjects.filter(p => p.pipeline_status !== 'COMPLETE').length}</div>
          <div className="delta up">+2 this week</div>
        </div>
        <div className="home-stat">
          <div className="label">Pros at risk</div>
          <div className="val">{PROS.filter(p => p.at_risk).length}</div>
          <div className="delta muted">across team</div>
        </div>
        <div className="home-stat">
          <div className="label">Inbox · closed-won</div>
          <div className="val">{SFDC_INBOX.length}</div>
          <div className="delta up">awaiting claim</div>
        </div>
      </div>

      <div className="home-grid">
        <div className="home-card">
          <div className="home-card-head">
            <div className="title">My tasks · next up</div>
            <button className="btn subtle sm" onClick={() => onNav('my-tasks')}>View all <Icon name="chevron-right" size={12} /></button>
          </div>
          <table className="tbl">
            <colgroup><col style={{ width: 24 }} /><col /><col style={{ width: 200 }} /><col style={{ width: 100 }} /></colgroup>
            <tbody>
              {myTasks.slice(0, 6).map(t => (
                <tr key={t.id}>
                  <td><span className="cell"><button className="tk-check"></button></span></td>
                  <td><span className="cell"><span style={{ display:'flex', flexDirection:'column', minWidth: 0 }}>
                    <span style={{ fontWeight: 500 }}>{t.title}</span>
                    <span className="muted small">{t.biz} · {t.section}</span>
                  </span></span></td>
                  <td><span className="cell muted small">{t.section}</span></td>
                  <td><span className={'cell mono ' + dueClass(t.due)}>{fmtDue(t.due)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="home-card">
            <div className="home-card-head"><div className="title">{sidebarLabel}</div></div>
            <div style={{ padding: 8 }}>
              {myPros.slice(0, 5).map(p => (
                <a key={p.org_id} className="sb-item" onClick={() => onNav('pro-detail', { orgId: p.org_id })} style={{ height: 'auto', padding: '8px 10px' }}>
                  <span className="av" style={{ background: 'var(--primary-main)', color: '#fff' }}>{p.business_name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.business_name}</span>
                    <span className="muted small">{p.state} · {p.vertical}</span>
                  </span>
                  <Pill kind="lifecycle" value={p.lifecycle_status} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- My Tasks — Asana style buckets ---- */
function MyTasks({ onNav }) {
  const [tasks, setTasks] = React.useState(MY_TASKS);
  const toggle = (id) => {
    SyncBus.start('task');
    setTasks(ts => ts.map(t => t.id === id ? { ...t, status: t.status === 'DONE' ? 'NOT_STARTED' : 'DONE', _justSaved: Date.now() } : t));
  };

  const buckets = [
    { key: 'overdue', name: 'Overdue',    cls: 'overdue', filter: t => dueClass(t.due) === 'overdue' && t.status !== 'DONE' },
    { key: 'today',   name: 'Today',      cls: 'today',   filter: t => dueClass(t.due) === 'today' && t.status !== 'DONE' },
    { key: 'week',    name: 'This week',  cls: '',        filter: t => {
        const d = new Date(t.due);
        const now = new Date('2026-05-13');
        const diff = (d - now) / 86400000;
        return diff > 0 && diff <= 7 && dueClass(t.due) !== 'today' && t.status !== 'DONE';
      } },
    { key: 'later',   name: 'Later',      cls: '',        filter: t => {
        const d = new Date(t.due);
        const now = new Date('2026-05-13');
        return ((d - now) / 86400000) > 7 && t.status !== 'DONE';
      } },
    { key: 'done',    name: 'Completed',  cls: '',        filter: t => t.status === 'DONE' },
  ];

  return (
    <div data-screen-label="My Tasks">
      <div className="ph">
        <div>
          <div className="ph-title">
            <Icon name="check-circle" size={22} />
            My Tasks
          </div>
          <div className="ph-meta">All open tasks across pros and projects. {tasks.filter(t => t.status !== 'DONE').length} open.</div>
        </div>
        <div className="ph-actions">
          <button className="btn"><Icon name="filter" size={14} /> Filter</button>
          <button className="btn"><Icon name="sort" size={14} /> Sort: due date</button>
        </div>
      </div>

      <div className="view-tabs">
        <button className="view-tab active"><Icon name="list" size={14} /> List</button>
        <button className="view-tab"><Icon name="calendar" size={14} /> Calendar</button>
        <button className="view-tab"><Icon name="kanban" size={14} /> Board</button>
      </div>

      {buckets.map(b => {
        const items = tasks.filter(b.filter);
        if (items.length === 0 && b.key !== 'today') return null;
        return (
          <MyTaskBucket key={b.key} name={b.name} cls={b.cls} items={items} onToggle={toggle} onNav={onNav} defaultOpen={b.key !== 'done' && b.key !== 'later'} />
        );
      })}
    </div>
  );
}

function MyTaskBucket({ name, cls, items, onToggle, onNav, defaultOpen = true }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="bucket">
      <div className="bucket-head" onClick={() => setOpen(!open)}>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
        <span className={'name ' + cls}>{name}</span>
        <span className="count">{items.length}</span>
      </div>
      {open && items.length > 0 && (
        <div>
          {items.map(t => (
            <div key={t.id} className={'tk-row' + (t.status === 'DONE' ? ' done' : '')}
                 style={{ gridTemplateColumns: '18px minmax(0, 1fr) minmax(140px, 240px) 90px 28px', gap: '10px' }}
                 onClick={() => onNav(t.proj ? 'project-detail' : 'pro-detail', t.proj ? { projectId: t.proj } : { orgId: t.org_id })}>
              <span className="expand"></span>
              <span className="tk-title">
                <button className={'tk-check' + (t.status === 'DONE' ? ' done' : '')} onClick={e => { e.stopPropagation(); onToggle(t.id); }}>
                  {t.status === 'DONE' && <Icon name="check" size={11} />}
                </button>
                <span className="text">{t.title}</span>
                {t._justSaved && (Date.now() - t._justSaved) < 1500 && (
                  <span className="row-saved"><Icon name="check" size={9} /> saved</span>
                )}
                {t.blockedBy && <span className="badge-blocked">blocked by {t.blockedBy}</span>}
              </span>
              <span style={{ fontSize: 12, color: 'var(--fg-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.biz} <span className="muted">· {t.section}</span>
              </span>
              <span className={'tk-due ' + dueClass(t.due)}>{fmtDue(t.due)}</span>
              <button className="more"><Icon name="more" size={14} /></button>
            </div>
          ))}
        </div>
      )}
      {open && items.length === 0 && (
        <div style={{ padding: '20px 16px', color: 'var(--fg-secondary)', fontSize: 13, textAlign: 'center' }}>
          🎉 Nothing scheduled for {name.toLowerCase()}.
        </div>
      )}
    </div>
  );
}

/* ---- Template editor ---- */
function Templates({ onNav }) {
  const [scope, setScope] = React.useState('project'); // pro | project
  const [section, setSection] = React.useState('DOC_GATHERING');

  return (
    <div data-screen-label="Templates">
      <div className="ph">
        <div>
          <div className="ph-title">
            <Icon name="template" size={22} />
            Task templates
          </div>
          <div className="ph-meta">Master task lists that materialize onto every new pro and project. Edit here, applies on next creation.</div>
        </div>
        <div className="ph-actions">
          <button className="btn"><Icon name="history" size={14} /> Version history</button>
          <button className="btn"><Icon name="eye" size={14} /> Preview materialization</button>
          <button className="btn primary"><Icon name="plus" size={14} /> Add task</button>
        </div>
      </div>

      <div className="view-tabs">
        <button className={'view-tab' + (scope === 'pro' ? ' active' : '')} onClick={() => setScope('pro')}>
          <Icon name="users" size={14} /> Pro templates <span className="badge">35</span>
        </button>
        <button className={'view-tab' + (scope === 'project' ? ' active' : '')} onClick={() => setScope('project')}>
          <Icon name="briefcase" size={14} /> Project templates <span className="badge">{PROJ_TEMPLATES.length}</span>
        </button>
      </div>

      <div className="tmpl-shell">
        <div className="tmpl-side">
          <div className="grp-title">Sections</div>
          {PROJ_TEMPLATE_SECTIONS.map(s => (
            <div key={s.section} className={'item' + (section === s.section ? ' active' : '')} onClick={() => setSection(s.section)}>
              <Icon name="folder" size={14} />
              <span>{s.label}</span>
              <span className="cnt">{PROJ_TEMPLATES.filter(t => t.section === s.section).length}</span>
            </div>
          ))}
          <div style={{ height: 8 }}></div>
          <div className="grp-title">Versioning</div>
          <div className="item">
            <Icon name="circle" size={10} style={{ color: 'var(--success-main)' }} /> <span>v3 · current</span>
          </div>
          <div className="item muted">
            <Icon name="history" size={14} /> <span>v2 (Feb 2026)</span>
          </div>
          <div className="item muted">
            <Icon name="history" size={14} /> <span>v1 (Jan 2026)</span>
          </div>
        </div>

        <div className="tmpl-main">
          <table className="tmpl-tbl">
            <thead>
              <tr>
                <th style={{ width: 26 }}></th>
                <th>Title</th>
                <th style={{ width: 130 }}>Default role</th>
                <th style={{ width: 170 }}>Due anchor</th>
                <th style={{ width: 80 }}>Offset</th>
                <th style={{ width: 80 }}>Active</th>
                <th style={{ width: 32 }}></th>
              </tr>
            </thead>
            <tbody>
              {PROJ_TEMPLATE_SECTIONS.map(s => (
                <React.Fragment key={s.section}>
                  <tr className="section-row" onClick={() => setSection(s.section)} style={{ cursor: 'pointer' }}>
                    <td colSpan="7">
                      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <Icon name="chevron-down" size={11} /> {s.label}
                        <span className="cnt" style={{ background: '#fff', color: 'var(--fg-secondary)', fontSize: 11, padding: '1px 7px', borderRadius: 999 }}>{PROJ_TEMPLATES.filter(t => t.section === s.section).length}</span>
                      </span>
                    </td>
                  </tr>
                  {PROJ_TEMPLATES.filter(t => t.section === s.section).map((t, i) => (
                    <tr key={s.section + i}>
                      <td><Icon name="drag" size={14} style={{ color: 'var(--grey-400)' }} /></td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{t.title}</div>
                        {t.isChecklist && <div className="muted small" style={{ marginTop: 2 }}>
                          <span className="badge-checklist" style={{ background: 'var(--ai-light)', color: 'var(--ai-dark)', padding: '1px 6px', borderRadius: 4, fontSize: 10.5, fontWeight: 600 }}>checklist · {t.checklistCount} items</span>
                        </div>}
                      </td>
                      <td><span className="pill" style={{ background: 'var(--grey-100)' }}>{ENUM_LABELS.ROLE[t.role]}</span></td>
                      <td className="muted small">{t.anchor.replace(/_/g, ' ').toLowerCase()}</td>
                      <td className="mono">{t.offset >= 0 ? '+' : ''}{t.offset}d</td>
                      <td><span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12, color: 'var(--success-dark)' }}><Icon name="check" size={12} /> active</span></td>
                      <td><button className="tb-icon-btn" style={{ width: 24, height: 24 }}><Icon name="more" size={14} /></button></td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---- Archive ---- */
function Archive({ onNav }) {
  const [scope, setScope] = React.useState('pros');

  return (
    <div data-screen-label="Archive">
      <div className="ph">
        <div>
          <div className="ph-title">
            <Icon name="archive" size={22} />
            Archive
          </div>
          <div className="ph-meta">Soft-archived pros and projects. Restore brings them back to active views.</div>
        </div>
      </div>
      <div className="view-tabs">
        <button className={'view-tab' + (scope === 'pros' ? ' active' : '')} onClick={() => setScope('pros')}><Icon name="users" size={14} /> Pros <span className="badge">{ARCHIVED_PROS.length}</span></button>
        <button className={'view-tab' + (scope === 'projects' ? ' active' : '')} onClick={() => setScope('projects')}><Icon name="briefcase" size={14} /> Projects <span className="badge">0</span></button>
      </div>

      {scope === 'pros' && (
        <div className="table-wrap">
          <table className="tbl">
            <colgroup><col style={{ width: 100 }} /><col style={{ width: 260 }} /><col style={{ width: 130 }} /><col style={{ width: 130 }} /><col style={{ width: 130 }} /><col /><col style={{ width: 100 }} /></colgroup>
            <thead>
              <tr><th>Org ID</th><th>Business</th><th>Last status</th><th>Archived</th><th>By</th><th>Reason</th><th></th></tr>
            </thead>
            <tbody>
              {ARCHIVED_PROS.map(p => (
                <tr key={p.org_id} className="archived">
                  <td><span className="cell cell-id">{p.org_id}</span></td>
                  <td><span className="cell">{p.business_name}</span></td>
                  <td><span className="cell"><Pill kind="lifecycle" value={p.lifecycle_status} /></span></td>
                  <td><span className="cell mono">{p.archived_at}</span></td>
                  <td><span className="cell"><Avatar email={p.archived_by} /></span></td>
                  <td><span className="cell muted">{p.archive_reason}</span></td>
                  <td><span className="cell"><button className="btn sm" onClick={e => e.stopPropagation()}>Restore</button></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {scope === 'projects' && (
        <div className="empty" style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: 10 }}>
          <div className="icon-bg"><Icon name="archive" size={26} /></div>
          <h3>No archived projects yet</h3>
          <p>When you archive a project from its detail page, it'll show up here.</p>
        </div>
      )}
    </div>
  );
}

/* ---- SFDC Inbox ---- */
function Inbox({ onNav }) {
  return (
    <div data-screen-label="Inbox">
      <div className="ph">
        <div>
          <div className="ph-title">
            <Icon name="inbox" size={22} />
            Inbox
            <span className="pill" style={{ background: 'var(--primary-50)', color: 'var(--primary-dark)' }}>{SFDC_INBOX.length} new cases</span>
          </div>
          <div className="ph-meta">New tax onboarding cases from Salesforce (syncs every 4h). A Pro record is auto-created per new Org ID; claim one to run onboarding.</div>
        </div>
        <div className="ph-actions">
          <span className="sync-pill" title="Salesforce sheet feed"><span className="dot" /> Synced 12m ago</span>
          <button className="btn"><Icon name="history" size={14} /> Recently claimed</button>
        </div>
      </div>

      {SFDC_INBOX.map(o => (
        <div key={o.case_number} className="inbox-card">
          <div>
            <div className="biz">{o.business_name}</div>
            <div className="meta">
              <span className="mono">Org {o.org_id}</span>
              <span>·</span>
              <span><Icon name="briefcase" size={11} /> Case {o.case_number}</span>
              <span>·</span>
              <span><Icon name="users" size={11} /> Owner: {o.case_owner}</span>
              <span>·</span>
              <span className="mono">Created {o.created_date}</span>
              <span>·</span>
              <span><Icon name="clock" size={11} /> {o.service_days}d in onboarding</span>
            </div>
            {o.notes && <div className="muted small" style={{ marginTop: 6, maxWidth: 640, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.notes}>
              <Icon name="file-text" size={11} /> {o.notes}
            </div>}
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="pill" style={{ background: 'var(--success-light)', color: 'var(--success-dark)' }}><Icon name="check" size={11} /> Pro record created</span>
              <span className="muted small">Advisor assigned on claim (load-balanced)</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <button className="btn primary" onClick={() => onNav('intake', { sfdcId: o.case_number })}>
              <Icon name="wand" size={14} /> Claim &amp; start onboarding
            </button>
            <button className="btn subtle sm">Dismiss</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- Onboarding intake wizard (M4) ---- */
const INTAKE_STAGES = [
  { id: 'A', label: 'Pre-IAC setup', steps: [
    { id: 'A0', label: 'Upload workbook',          est: '30 sec' },
    { id: 'A1', label: 'Business profile',         est: '2 min' },
    { id: 'A2', label: 'Owners',                   est: '1 min' },
    { id: 'A3', label: 'Assignments',              est: '1 min' },
    { id: 'A4', label: 'INHA bookkeeping context', est: '2 min' },
    { id: 'A5', label: 'Provision Drive folder',   est: '15 sec' },
  ]},
  { id: 'B', label: 'IAC capture', steps: [
    { id: 'B1', label: 'General intake',           est: '8 min' },
    { id: 'B2', label: 'Entity questionnaire',     est: '6 min' },
    { id: 'B3', label: 'Complexity & risk',        est: '2 min' },
  ]},
  { id: 'C', label: 'Post-IAC handoff', steps: [
    { id: 'C1', label: 'Create return project(s)', est: '3 min' },
    { id: 'C2', label: 'Confirm preparer + peer',  est: '1 min' },
    { id: 'C3', label: 'Send organizer (task)',    est: 'tracked' },
    { id: 'C4', label: '8821 IRS auth (task)',     est: 'tracked' },
  ]},
];

/* Extracted-field mapping the workbook produces, mirroring the real template's cells. */
const WORKBOOK_EXTRACT = {
  profile: [
    { label: 'Business name', field: 'business_name', tab: 'General', cell: 'D8', value: 'Cedar Creek Plumbing' },
    { label: 'DBA', field: 'dba', tab: 'General', cell: 'D9', value: 'Cedar Creek Plumbing & Rooter' },
    { label: 'Entity type', field: 'entity_type', tab: 'General', cell: 'H8', value: 'S-Corp' },
    { label: 'Last filing year', field: 'last_filing_year', tab: 'General', cell: 'I8', value: '2024' },
    { label: 'Year started', field: 'year_started', tab: 'General', cell: 'J8', value: '2019' },
    { label: 'Vertical', field: 'vertical', tab: 'General', cell: 'K8', value: 'Plumbing' },
    { label: 'State', field: 'state', tab: 'General', cell: 'K10', value: 'OR' },
    { label: 'Time zone', field: 'time_zone', tab: 'General', cell: 'K13', value: 'America/Los_Angeles' },
    { label: 'Scope start', field: 'scope_start_date', tab: 'General', cell: 'B9', value: '2025-01-01' },
  ],
  owners: [
    { label: 'Owner 1', field: 'owner1', tab: 'General', cell: 'B11:B14', value: 'Shane Kessler · shane@cedarcreek.com · 60%' },
    { label: 'Owner 2', field: 'owner2', tab: 'General', cell: 'E11:E14', value: 'Dana Kessler · dana@cedarcreek.com · 40%' },
  ],
  books: [
    { label: 'Books with HCP', field: 'books_with_hcp', tab: 'General', cell: 'B16', value: 'Yes' },
    { label: 'Prior books', field: 'prior_books_status', tab: 'General', cell: 'E16', value: 'Self-managed in QBO' },
    { label: 'BK lead', field: 'bk_lead_email', tab: 'General', cell: 'B17', value: 'Soraya Volcy' },
    { label: 'Payroll servicer', field: 'payroll_servicer', tab: 'General', cell: 'E17', value: 'Gusto' },
  ],
  intake: [
    { label: 'Multi-state work?', branch: 'GENERAL', tab: 'General', cell: 'F22', value: 'Yes — OR + WA, service revenue' },
    { label: '# Employees / contractors', branch: 'GENERAL', tab: 'General', cell: 'F23', value: '2 W-2, 5 1099' },
    { label: 'Estimated tax payments?', branch: 'GENERAL', tab: 'General', cell: 'F25', value: 'Q1–Q2 paid' },
    { label: 'Vehicles for business?', branch: 'GENERAL', tab: 'General', cell: 'F33', value: 'Yes — 2 trucks, mileage tracked' },
    { label: '2553 election approved?', branch: 'ENTITY', tab: 'SCorp', cell: 'F4', value: 'Yes — 2020' },
    { label: 'Shareholders / %', branch: 'ENTITY', tab: 'SCorp', cell: 'F7', value: 'Shane 60 / Dana 40' },
    { label: 'Reasonable comp / payroll?', branch: 'ENTITY', tab: 'SCorp', cell: 'F14', value: 'Yes — $72k/yr' },
    { label: 'Distributions taken?', branch: 'ENTITY', tab: 'SCorp', cell: 'F18', value: '$31,000' },
    { label: 'Prior 1120S filed?', branch: 'ENTITY', tab: 'SCorp', cell: 'F27', value: 'Yes' },
    { label: 'IRS / state notices?', branch: 'ENTITY', tab: 'SCorp', cell: 'F28', value: 'No' },
  ],
};

function WorkbookUploadStep({ opp, onDone }) {
  const [phase, setPhase] = React.useState('drop'); // drop | extracting | review | applied
  const [entityTab, setEntityTab] = React.useState('SCorp');

  function simulateUpload() {
    setPhase('extracting');
    SyncBus.start('workbook');
    setTimeout(() => setPhase('review'), 1300);
  }
  function apply() {
    SyncBus.start('mapped fields');
    setPhase('applied');
  }

  const rows = [
    ...WORKBOOK_EXTRACT.profile.map(r => ({ ...r, group: 'Pro profile' })),
    ...WORKBOOK_EXTRACT.owners.map(r => ({ ...r, group: 'Owners' })),
    ...WORKBOOK_EXTRACT.books.map(r => ({ ...r, group: 'Bookkeeping' })),
    ...WORKBOOK_EXTRACT.intake.map(r => ({ ...r, group: 'Intake answers → ' + (r.branch === 'ENTITY' ? 'Entity' : 'General') })),
  ];
  const groups = [...new Set(rows.map(r => r.group))];

  if (phase === 'drop' || phase === 'extracting') {
    return (
      <div className="wb-drop-wrap">
        <div className={'wb-drop' + (phase === 'extracting' ? ' busy' : '')} onClick={phase === 'drop' ? simulateUpload : undefined}>
          {phase === 'drop' ? (
            <>
              <div className="wb-drop-icon"><Icon name="file-text" size={30} /></div>
              <div className="wb-drop-title">Drop the onboarding workbook here</div>
              <div className="wb-drop-sub">or click to browse · .xlsx from the "Make A Copy Tax Notes" template</div>
              <button className="btn primary" style={{ marginTop: 14 }}><Icon name="paperclip" size={14} /> Choose file</button>
            </>
          ) : (
            <>
              <div className="wb-drop-icon spin"><Icon name="settings" size={30} /></div>
              <div className="wb-drop-title">Reading workbook…</div>
              <div className="wb-drop-sub">Parsing General, Sole Prop, and Entity tabs · matching labels to fields</div>
            </>
          )}
        </div>
        <div className="wb-note">
          <Icon name="alert" size={13} /> The original file is saved to the pro's Drive folder as the source of record. Nothing is written to the record until you review and confirm.
        </div>
      </div>
    );
  }

  if (phase === 'applied') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'var(--success-light)', borderRadius: 8 }}>
          <Icon name="check-circle" size={22} style={{ color: 'var(--success-dark)' }} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--success-dark)' }}>{rows.length} fields applied</div>
            <div style={{ fontSize: 12.5, color: 'var(--success-dark)', marginTop: 2 }}>Pro profile, owners, and bookkeeping filled · {WORKBOOK_EXTRACT.intake.length} intake answers written to IntakeAnswers · workbook saved to Drive.</div>
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button className="btn primary" onClick={onDone}>Continue to Business profile <Icon name="chevron-right" size={13} /></button>
          <button className="btn" onClick={() => setPhase('review')}>Back to review</button>
        </div>
      </div>
    );
  }

  // review
  return (
    <div>
      <div className="wb-review-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="pill" style={{ background: 'var(--success-light)', color: 'var(--success-dark)' }}><Icon name="check" size={11} /> Parsed</span>
          <span className="muted small">Make A Copy Tax Notes.xlsx · {rows.length} values found across 3 tabs</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="muted small">Entity tab used:</span>
          <select value={entityTab} onChange={e => setEntityTab(e.target.value)} style={{ height: 30, borderRadius: 6, border: '1px solid var(--border-light)', padding: '0 8px', font: 'inherit', fontSize: 12.5 }}>
            <option value="SoleProp">Sole Prop</option>
            <option value="SCorp">S-Corp / C-Corp / Partnership</option>
          </select>
        </div>
      </div>
      <div className="wb-review">
        {groups.map(g => (
          <div key={g} className="wb-group">
            <div className="wb-group-title">{g}</div>
            {rows.filter(r => r.group === g).map((r, i) => (
              <div key={i} className="wb-map-row">
                <label className="wb-check"><input type="checkbox" defaultChecked /></label>
                <span className="wb-src">
                  <span className="wb-src-val">{r.value}</span>
                  <span className="wb-src-cell mono">{r.tab}!{r.cell}</span>
                </span>
                <Icon name="chevron-right" size={13} className="muted" />
                <span className="wb-target">{r.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="wb-warn">
        <Icon name="alert" size={13} /> 1 check to confirm: workbook entity type is <strong>S-Corp</strong> — matches. Owner % sums to 100. Uncheck any row you don't want applied.
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button className="btn primary" onClick={apply}><Icon name="check" size={14} /> Apply {rows.length} fields</button>
        <button className="btn" onClick={() => setPhase('drop')}>Replace file</button>
      </div>
    </div>
  );
}

function IntakeWizard({ sfdcId, onNav }) {
  const opp = SFDC_INBOX.find(o => o.case_number === sfdcId) || SFDC_INBOX[0];
  const [step, setStep] = React.useState('A0');
  const complete = ['A0', 'A1', 'A2'];
  const stageOf = (id) => INTAKE_STAGES.find(s => s.steps.find(t => t.id === id));
  const currentStep = INTAKE_STAGES.flatMap(s => s.steps).find(t => t.id === step);

  return (
    <div data-screen-label="Intake wizard">
      <div className="ph">
        <div>
          <div className="ph-title">
            <Icon name="wand" size={22} />
            Onboarding · {opp.business_name}
          </div>
          <div className="ph-meta">
            <span className="mono">Case {opp.case_number}</span> · Org <span className="mono">{opp.org_id}</span> · Owner: {opp.case_owner}
          </div>
        </div>
        <div className="ph-actions">
          <button className="btn"><Icon name="check-circle" size={14} /> Save & exit</button>
        </div>
      </div>

      <div className="wiz-shell">
        <aside className="wiz-side">
          {INTAKE_STAGES.map(stage => (
            <div key={stage.id} className="wiz-stage">
              <div className="wiz-stage-title">{stage.id} · {stage.label}</div>
              {stage.steps.map(s => {
                const isDone = complete.includes(s.id);
                const isActive = step === s.id;
                return (
                  <div key={s.id} className={'wiz-step' + (isActive ? ' active' : '') + (isDone ? ' complete' : '')} onClick={() => setStep(s.id)}>
                    <span className="dot">{isDone ? <Icon name="check" size={11} /> : s.id.slice(1)}</span>
                    <span className="lab">{s.label}</span>
                    <span className="est">{s.est}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </aside>

        <div className="wiz-main">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--fg-secondary)', fontSize: 12, marginBottom: 4 }}>
            <span>Stage {stageOf(step).id}</span> <Icon name="chevron-right" size={11} /> <span>{stageOf(step).label}</span>
          </div>
          <h1>{currentStep.label}</h1>
          {step === 'A0' && <p className="lead">Attach the OS onboarding workbook. We'll read the General, Sole Prop, and Entity tabs and map the values into the right fields — you review before anything is applied.</p>}
          {step === 'A1' && <p className="lead">Confirm what came in from Salesforce. Fields below are editable.</p>}
          {step === 'A2' && <p className="lead">Add the legal owners. Ownership % must sum to 100 for S-Corp or Partnership.</p>}
          {step === 'A3' && <p className="lead">Pick the advisor, OS, and BK lead for this pro. These drive task assignment when we materialize templates.</p>}
          {step === 'A4' && <p className="lead">Capture how the books look today before the IAC call.</p>}
          {step === 'A5' && <p className="lead">Create the per-org folder under HCP Tax Shared Drive. Safe to re-run.</p>}
          {step.startsWith('B') && <p className="lead">Answers persist on blur. Earlier answers are preserved via the <span className="mono">is_current</span> flag.</p>}
          {step.startsWith('C') && <p className="lead">Wrap up the onboarding by creating this pro's tax return projects.</p>}

          <div className="wiz-form">
            {step === 'A0' && <WorkbookUploadStep opp={opp} onDone={() => setStep('A1')} />}
            {step === 'A1' && <>
              <div className="wiz-row">
                <div className="wiz-field"><label className="lbl">Org ID</label><input className="mono" defaultValue={opp.org_id} /><span className="hint">Auto from SFDC. Edit only if SFDC sent a wrong ID.</span></div>
                <div className="wiz-field"><label className="lbl">Business name</label><input defaultValue={opp.business_name} /></div>
              </div>
              <div className="wiz-row">
                <div className="wiz-field"><label className="lbl">DBA (optional)</label><input placeholder="—" /></div>
                <div className="wiz-field"><label className="lbl">Year started</label><input type="number" placeholder="e.g. 2018" /></div>
              </div>
              <div className="wiz-row">
                <div className="wiz-field"><label className="lbl">Vertical</label><input placeholder="e.g. Plumbing" /><span className="hint">Not in the SFDC feed — capture during intake.</span></div>
                <div className="wiz-field"><label className="lbl">State</label><input placeholder="e.g. CO" style={{ width: 90 }} /></div>
              </div>
              <div className="wiz-row">
                <div className="wiz-field"><label className="lbl">Entity type</label>
                  <select defaultValue="">
                    <option value="">Select…</option>
                    <option value="SOLE_PROP_SCHED_C">Sole prop / Sched C</option>
                    <option value="PARTNERSHIP">Partnership</option>
                    <option value="S_CORP">S-Corp</option>
                    <option value="C_CORP">C-Corp</option>
                  </select>
                </div>
                <div className="wiz-field"><label className="lbl">Last filing year</label><input type="number" placeholder="e.g. 2023" /></div>
              </div>
              <div className="wiz-row">
                <div className="wiz-field"><label className="lbl">Scope start</label><input type="date" defaultValue="2026-01-01" /></div>
                <div className="wiz-field"><label className="lbl">Time zone</label>
                  <select><option>America/Denver</option><option>America/New_York</option><option>America/Chicago</option><option>America/Los_Angeles</option></select>
                </div>
              </div>
            </>}
            {step === 'A3' && <AssignmentStep opp={opp} />}
            {step === 'A5' && <>
              <div className="wiz-field">
                <label className="lbl">Target folder</label>
                <div style={{ background: 'var(--grey-50)', border: '1px solid var(--border-light)', borderRadius: 8, padding: 14, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5 }}>
                  HCP Tax Shared Drive / client data / <strong>{opp.business_name} ({opp.org_id})-TAX</strong>
                </div>
                <span className="hint">Idempotent — clicking again with the folder already present is a no-op.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'var(--success-light)', borderRadius: 8 }}>
                <Icon name="check-circle" size={20} style={{ color: 'var(--success-dark)' }} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--success-dark)' }}>Folder created</div>
                  <div style={{ fontSize: 12.5, color: 'var(--success-dark)', marginTop: 2 }}>Link saved to pro record · materialize tasks?</div>
                </div>
              </div>
              <button className="btn primary" style={{ width: 'max-content' }}><Icon name="wand" size={13} /> Materialize 23 onboarding tasks</button>
            </>}
            {step === 'B1' && <>
              <IntakeQuestion q="Operates in more than one state?" yes={['Yes, includes CA + NV', 'CA only']} />
              <IntakeQuestion q="Employees (W-2)?" yes={['3 employees']} hint="Used for payroll task generation." />
              <IntakeQuestion q="Contractors (1099-NEC)?" yes={['Yes, 12 contractors']} />
              <IntakeQuestion q="Estimated tax payments made for current year?" yes={['Q1 yes, Q2 pending']} />
              <IntakeQuestion q="Crypto or digital asset transactions?" yes={['No']} />
              <IntakeQuestion q="Foreign accounts?" yes={['No']} />
              <IntakeQuestion q="Inventory on hand at year-end?" yes={['No']} />
              <IntakeQuestion q="Vehicles used for business?" yes={['2 — service truck + work van']} />
              <IntakeQuestion q="Real property / rentals?" yes={['No']} />
            </>}
          </div>

          <div className="wiz-foot">
            <div className="l">
              <Icon name="check-circle" size={14} style={{ color: 'var(--success-main)' }} />
              <span>All edits auto-saved · last save 3s ago</span>
            </div>
            <div className="r">
              <button className="btn">Save draft</button>
              <button className="btn primary">Next step <Icon name="chevron-right" size={13} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssignmentStep({ opp }) {
  const loads = advisorLoads();
  const suggested = nextAdvisor();
  const [advisor, setAdvisor] = React.useState(suggested || (loads[0] && loads[0].email) || '');
  const overridden = advisor !== suggested;
  const maxCount = Math.max(...loads.map(l => l.count), 1);
  return (
    <>
      <div className="wiz-field">
        <label className="lbl">Tax advisor</label>
        <div className="lb-suggest">
          <Icon name="sparkles" size={13} />
          <span>Balanced pick: <strong>{teamByEmail[suggested]?.name}</strong> — fewest active pros</span>
        </div>
        <div className="lb-list">
          {loads.slice().sort((a, b) => a.count - b.count).map(l => {
            const isPick = l.email === advisor;
            return (
              <button key={l.email} type="button" className={'lb-row' + (isPick ? ' picked' : '') + (!l.accepting ? ' off' : '')}
                onClick={() => l.accepting && setAdvisor(l.email)}>
                <span className="lb-radio">{isPick && <Icon name="check" size={12} />}</span>
                <Avatar email={l.email} />
                <span className="lb-name">{l.name}{l.email === suggested && <span className="lb-tag">next up</span>}{!l.accepting && <span className="lb-tag off">not accepting</span>}</span>
                <span className="lb-bar-track"><span className="lb-bar" style={{ width: (l.count / maxCount * 100) + '%' }} /></span>
                <span className="lb-count mono">{l.count}</span>
              </button>
            );
          })}
        </div>
        <span className="hint">{overridden ? 'Overriding the balanced pick — still counts toward this advisor’s load.' : 'Auto-selected the least-loaded advisor. Change it if this pro needs a specialist.'}</span>
      </div>
      <div className="wiz-row">
        <div className="wiz-field"><label className="lbl">Onboarding specialist</label>
          <select defaultValue="amelia.brooks@housecallpro.com">{TEAM.filter(t => t.roles.includes('OS')).map(t => <option key={t.email} value={t.email}>{t.name}</option>)}</select>
        </div>
        <div className="wiz-field"><label className="lbl">BK lead</label>
          <select defaultValue="devon.hayes@housecallpro.com">{TEAM.filter(t => t.roles.includes('BK_LEAD') || t.roles.includes('BK_TEAM_LEAD')).map(t => <option key={t.email} value={t.email}>{t.name}</option>)}</select>
        </div>
      </div>
    </>
  );
}

function IntakeQuestion({ q, yes = [], hint }) {
  return (
    <div className="wiz-field">
      <label className="lbl">{q}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select style={{ width: 110 }} defaultValue={yes.length ? 'yes' : 'no'}>
          <option value="yes">Yes</option><option value="no">No</option><option value="">Skip</option>
        </select>
        <input style={{ flex: 1 }} placeholder="Detail" defaultValue={yes[0] || ''} />
      </div>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

/* ---- Reports (CSV export for management) ---- */
function Reports({ onNav }) {
  const [report, setReport] = React.useState('pipeline');

  const REPORTS = [
    { id: 'pipeline', label: 'Pipeline snapshot', icon: 'briefcase' },
    { id: 'cycle',    label: 'Stage cycle time', icon: 'timer' },
    { id: 'advisor',  label: 'Per-advisor summary', icon: 'users' },
    { id: 'balance',  label: 'Advisor load balance', icon: 'users' },
    { id: 'time',     label: 'Logged time', icon: 'clock' },
    { id: 'risk',     label: 'At-risk pros', icon: 'alert' },
  ];

  // Pipeline snapshot: count of open projects per stage
  const pipelineRows = PIPELINE_SEQUENCE.filter(s => s !== 'COMPLETE').map(stage => {
    const rows = PROJECTS.filter(p => p.pipeline_status === stage);
    return { stage, label: ENUM_LABELS.PIPELINE_STATUS[stage], count: rows.length,
      overdue: rows.filter(p => dueClass(p.filing_deadline) === 'overdue').length };
  });

  return (
    <div data-screen-label="Reports">
      <div className="ph">
        <div>
          <div className="ph-title"><Icon name="chart" size={22} /> Reports</div>
          <div className="ph-meta">Management views across the whole book. Every report exports to CSV.</div>
        </div>
      </div>

      <div className="rep-tabs">
        {REPORTS.map(r => (
          <button key={r.id} className={'saved-view' + (report === r.id ? ' active' : '')} onClick={() => setReport(r.id)}>
            <Icon name={r.icon} size={13} /> {r.label}
          </button>
        ))}
      </div>

      {report === 'pipeline' && (
        <div className="det-card">
          <div className="det-card-head">
            <div className="title">Pipeline snapshot — open projects by stage</div>
            <button className="btn sm" onClick={() => downloadCSV('pipeline-snapshot.csv', toCSV(pipelineRows, [
              { key: 'label', label: 'Stage' }, { key: 'count', label: 'Open projects' }, { key: 'overdue', label: 'Past deadline' },
            ]))}><Icon name="download" size={12} /> Export CSV</button>
          </div>
          <table className="tmpl-tbl">
            <thead><tr><th>Stage</th><th style={{ width: 320 }}>Volume</th><th style={{ width: 120 }}>Open</th><th style={{ width: 130 }}>Past deadline</th></tr></thead>
            <tbody>
              {pipelineRows.map(r => {
                const max = Math.max(...pipelineRows.map(x => x.count), 1);
                return (
                  <tr key={r.stage}>
                    <td><Pill kind="pipeline" value={r.stage} /></td>
                    <td><span className="rep-bar-track" style={{ display: 'inline-block', width: 260 }}><span className="rep-bar" style={{ display: 'block', width: (r.count / max * 100) + '%' }} /></span></td>
                    <td className="mono">{r.count}</td>
                    <td>{r.overdue > 0 ? <span style={{ color: 'var(--error-main)', fontWeight: 600 }}>{r.overdue}</span> : <span className="muted">0</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {report === 'cycle' && (
        <div className="det-card">
          <div className="det-card-head">
            <div className="title">Average days in each stage — with per-advisor breakout</div>
            <button className="btn sm" onClick={() => downloadCSV('stage-cycle-time.csv', toCSV(STAGE_CYCLE_REPORT, [
              { key: 'stage', label: 'Stage', value: r => ENUM_LABELS.PIPELINE_STATUS[r.stage] },
              { key: 'avg_days', label: 'Avg days' }, { key: 'median_days', label: 'Median days' }, { key: 'count', label: 'Sample size' },
              { key: 'ashley', label: 'Ashley Laudermilk (days)' }, { key: 'tara', label: 'Tara Lim (days)' },
            ]))}><Icon name="download" size={12} /> Export CSV</button>
          </div>
          <table className="tmpl-tbl">
            <thead><tr><th>Stage</th><th style={{ width: 100 }}>Avg days</th><th style={{ width: 100 }}>Median</th><th style={{ width: 90 }}>Sample</th><th style={{ width: 150 }}>Ashley L.</th><th style={{ width: 150 }}>Tara L.</th></tr></thead>
            <tbody>
              {STAGE_CYCLE_REPORT.map(r => (
                <tr key={r.stage}>
                  <td><Pill kind="pipeline" value={r.stage} /></td>
                  <td className="mono" style={{ fontWeight: 600 }}>{r.avg_days}</td>
                  <td className="mono muted">{r.median_days}</td>
                  <td className="mono muted">{r.count}</td>
                  <td className="mono">{r.ashley}</td>
                  <td className="mono">{r.tara}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '10px 16px' }} className="muted small">Durations are raw averages from stage-change timestamps (ProjectStageHistory). No SLA targets applied.</div>
        </div>
      )}

      {report === 'advisor' && (
        <div className="det-card">
          <div className="det-card-head">
            <div className="title">Per-advisor summary — YTD</div>
            <button className="btn sm" onClick={() => downloadCSV('advisor-summary.csv', toCSV(ADVISOR_REPORT, [
              { key: 'advisor_email', label: 'Advisor', value: r => teamByEmail[r.advisor_email]?.name || r.advisor_email },
              { key: 'open_projects', label: 'Open projects' }, { key: 'completed_ytd', label: 'Completed YTD' },
              { key: 'avg_cycle_days', label: 'Avg cycle days' }, { key: 'on_time_pct', label: 'On-time %' }, { key: 'actual_hrs', label: 'Actual hrs logged' },
            ]))}><Icon name="download" size={12} /> Export CSV</button>
          </div>
          <table className="tmpl-tbl">
            <thead><tr><th>Advisor</th><th style={{ width: 110 }}>Open</th><th style={{ width: 130 }}>Completed YTD</th><th style={{ width: 130 }}>Avg cycle</th><th style={{ width: 110 }}>On-time</th><th style={{ width: 130 }}>Hrs logged</th></tr></thead>
            <tbody>
              {ADVISOR_REPORT.map(r => (
                <tr key={r.advisor_email}>
                  <td><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Avatar email={r.advisor_email} /> {teamByEmail[r.advisor_email]?.name}</span></td>
                  <td className="mono">{r.open_projects}</td>
                  <td className="mono">{r.completed_ytd}</td>
                  <td className="mono">{r.avg_cycle_days} days</td>
                  <td><span className={r.on_time_pct >= 90 ? 'pill pp-COMPLETE' : 'pill pp-WFP'}>{r.on_time_pct}%</span></td>
                  <td className="mono">{r.actual_hrs}h</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '10px 16px' }} className="muted small">Actual hours come from the work-timer log (TimeEntries). Can be fed to the Tax Advisor Performance app.</div>
        </div>
      )}

      {report === 'time' && (
        <div className="det-card">
          <div className="det-card-head">
            <div className="title">Logged time — all projects</div>
            <button className="btn sm" onClick={() => downloadCSV('time-entries.csv', toCSV(TIME_ENTRIES, [
              { key: 'project_id', label: 'Project' }, { key: 'user_email', label: 'User' },
              { key: 'started_at', label: 'Started' }, { key: 'stopped_at', label: 'Stopped' }, { key: 'duration_min', label: 'Minutes' },
            ]))}><Icon name="download" size={12} /> Export CSV</button>
          </div>
          <table className="tmpl-tbl">
            <thead><tr><th>Project</th><th>Who</th><th>Started</th><th>Stopped</th><th style={{ width: 90 }}>Duration</th></tr></thead>
            <tbody>
              {TIME_ENTRIES.map((e, i) => {
                const proj = PROJECTS.find(p => p.project_id === e.project_id);
                return (
                  <tr key={i}>
                    <td>{proj ? proj.business_name : e.project_id}</td>
                    <td><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Avatar email={e.user_email} /> {teamByEmail[e.user_email]?.name}</span></td>
                    <td className="mono small">{e.started_at}</td>
                    <td className="mono small">{e.stopped_at}</td>
                    <td className="mono">{Math.floor(e.duration_min / 60)}h {e.duration_min % 60}m</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {report === 'balance' && (() => {
        const loads = advisorLoads().slice().sort((a, b) => a.count - b.count);
        const suggested = nextAdvisor();
        const maxCount = Math.max(...loads.map(l => l.count), 1);
        const total = loads.reduce((s, l) => s + l.count, 0);
        return (
          <div className="det-card">
            <div className="det-card-head">
              <div className="title">Active pros per advisor — next assignment highlighted</div>
              <button className="btn sm" onClick={() => downloadCSV('advisor-load-balance.csv', toCSV(loads, [
                { key: 'name', label: 'Advisor' }, { key: 'count', label: 'Active pros' },
                { key: 'accepting', label: 'Accepting new' }, { key: 'email', label: 'Email' },
              ]))}><Icon name="download" size={12} /> Export CSV</button>
            </div>
            <table className="tmpl-tbl">
              <thead><tr><th>Advisor</th><th style={{ width: 340 }}>Load</th><th style={{ width: 110 }}>Active pros</th><th style={{ width: 130 }}>Status</th></tr></thead>
              <tbody>
                {loads.map(l => (
                  <tr key={l.email} style={l.email === suggested ? { background: 'var(--primary-50)' } : null}>
                    <td><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Avatar email={l.email} /> {l.name}{l.email === suggested && <span className="lb-tag">next up</span>}</span></td>
                    <td><span className="rep-bar-track" style={{ display: 'inline-block', width: 280 }}><span className="rep-bar" style={{ display: 'block', width: (l.count / maxCount * 100) + '%' }} /></span></td>
                    <td className="mono" style={{ fontWeight: 600 }}>{l.count}</td>
                    <td>{l.accepting ? <span className="pill pp-COMPLETE">Accepting</span> : <span className="pill">Paused</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '10px 16px' }} className="muted small">
              {total} active pros across {loads.length} advisors (avg {(total / loads.length).toFixed(1)}). New onboardings auto-assign to the least-loaded accepting advisor; ties break round-robin. OS can override in the intake wizard.
            </div>
          </div>
        );
      })()}

      {report === 'risk' && (
        <div className="det-card">
          <div className="det-card-head">
            <div className="title">At-risk pros</div>
            <button className="btn sm" onClick={() => downloadCSV('at-risk-pros.csv', toCSV(PROS.filter(p => p.at_risk), [
              { key: 'org_id', label: 'Org ID' }, { key: 'business_name', label: 'Business' },
              { key: 'at_risk_reason', label: 'Reason' }, { key: 'assigned_advisor_email', label: 'Advisor' },
              { key: 'last_advisor_touchpoint', label: 'Last touch' },
            ]))}><Icon name="download" size={12} /> Export CSV</button>
          </div>
          <table className="tmpl-tbl">
            <thead><tr><th style={{ width: 90 }}>Org ID</th><th>Business</th><th>Reason</th><th style={{ width: 150 }}>Advisor</th><th style={{ width: 120 }}>Last touch</th></tr></thead>
            <tbody>
              {PROS.filter(p => p.at_risk).map(p => (
                <tr key={p.org_id} onClick={() => onNav('pro-detail', { orgId: p.org_id })}>
                  <td className="cell-id">{p.org_id}</td>
                  <td>{p.business_name}</td>
                  <td style={{ color: 'var(--warning-dark)' }}><Icon name="alert" size={12} /> {p.at_risk_reason}</td>
                  <td><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Avatar email={p.assigned_advisor_email} /> {teamByEmail[p.assigned_advisor_email]?.name}</span></td>
                  <td className="mono small">{p.last_advisor_touchpoint || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Home, MyTasks, Templates, Archive, Inbox, IntakeWizard, Reports });
