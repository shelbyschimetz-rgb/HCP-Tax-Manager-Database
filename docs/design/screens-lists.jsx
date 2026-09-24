/* List views — Pros, Projects (table), Projects (kanban). Asana-style toolbar. */

/* ---- Shared list toolbar ---- */
function ListToolbar({ savedViews, activeView, onView, filters, onFilter, sort, onSort, group, onGroup, hidden, onHide, columns, total }) {
  const [openMenu, setOpenMenu] = React.useState(null);
  const close = () => setOpenMenu(null);

  return (
    <>
      <div className="saved-views">
        {savedViews.map(v => (
          <button key={v.id} className={'saved-view' + (activeView === v.id ? ' active' : '')} onClick={() => onView(v.id)}>
            {v.label}
          </button>
        ))}
        <button className="saved-view add" title="Save current view as new tab">
          <Icon name="plus" size={12} /> Save view
        </button>
      </div>

      <div className="toolbar">
        <div className="popover-host">
          <button className={'tool-chip' + (filters.length ? ' active' : '')} onClick={() => setOpenMenu(openMenu === 'f' ? null : 'f')}>
            <Icon name="filter" size={13} /> Filter
            {filters.length > 0 && <span className="dot" />}
          </button>
          {openMenu === 'f' && <FilterPop filters={filters} onChange={onFilter} columns={columns} onClose={close} />}
        </div>
        <div className="popover-host">
          <button className={'tool-chip' + (sort ? ' active' : '')} onClick={() => setOpenMenu(openMenu === 's' ? null : 's')}>
            <Icon name="sort" size={13} /> Sort
            {sort && <span className="dot" />}
          </button>
          {openMenu === 's' && <SortPop sort={sort} onChange={onSort} columns={columns} onClose={close} />}
        </div>
        <div className="popover-host">
          <button className={'tool-chip' + (group ? ' active' : '')} onClick={() => setOpenMenu(openMenu === 'g' ? null : 'g')}>
            <Icon name="group" size={13} /> Group
            {group && <span className="dot" />}
          </button>
          {openMenu === 'g' && <GroupPop group={group} onChange={onGroup} columns={columns} onClose={close} />}
        </div>
        <div className="popover-host">
          <button className={'tool-chip' + (hidden.length ? ' active' : '')} onClick={() => setOpenMenu(openMenu === 'h' ? null : 'h')}>
            <Icon name="columns" size={13} /> Hide
            {hidden.length > 0 && <span className="dot" />}
          </button>
          {openMenu === 'h' && <HidePop hidden={hidden} onChange={onHide} columns={columns} onClose={close} />}
        </div>
        <div className="tool-divider"></div>
        <span className="muted small">{total} record{total === 1 ? '' : 's'}</span>
        <div className="spacer"></div>
        <button className="tool-chip"><Icon name="eye" size={13} /> Saved views</button>
      </div>

      {openMenu && <div className="scrim" onClick={close} />}
    </>
  );
}

function FilterPop({ filters, onChange, columns, onClose }) {
  const setRow = (i, patch) => {
    const next = filters.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const add = () => onChange([...filters, { col: columns[0].key, op: 'contains', val: '' }]);
  const rm  = i => onChange(filters.filter((_, j) => j !== i));
  return (
    <div className="popover">
      <h6>Filter rows</h6>
      {filters.length === 0 && <p className="muted small" style={{ margin: '4px 0 8px' }}>No filters yet.</p>}
      {filters.map((f, i) => (
        <div className="po-row" key={i}>
          <select value={f.col} onChange={e => setRow(i, { col: e.target.value })}>
            {columns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <select value={f.op} onChange={e => setRow(i, { op: e.target.value })}>
            <option value="contains">contains</option>
            <option value="equals">equals</option>
            <option value="empty">is empty</option>
            <option value="not_empty">has value</option>
          </select>
          <button className="tb-icon-btn" onClick={() => rm(i)} style={{ width: 24, height: 24 }}><Icon name="x" size={14} /></button>
          {(f.op === 'contains' || f.op === 'equals') && (
            <input style={{ gridColumn: '1 / -1' }} placeholder="value" value={f.val} onChange={e => setRow(i, { val: e.target.value })} />
          )}
        </div>
      ))}
      <button className="po-add" onClick={add}><Icon name="plus" size={12} /> Add filter</button>
    </div>
  );
}
function SortPop({ sort, onChange, columns, onClose }) {
  return (
    <div className="popover">
      <h6>Sort by</h6>
      <div className="po-row" style={{ gridTemplateColumns: '1fr 1fr 28px' }}>
        <select value={sort?.col || ''} onChange={e => onChange(e.target.value ? { col: e.target.value, dir: sort?.dir || 'asc' } : null)}>
          <option value="">(none)</option>
          {columns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select value={sort?.dir || 'asc'} onChange={e => onChange({ ...(sort || { col: columns[0].key }), dir: e.target.value })}>
          <option value="asc">ascending ↑</option>
          <option value="desc">descending ↓</option>
        </select>
        <button className="tb-icon-btn" onClick={() => onChange(null)} style={{ width: 24, height: 24 }}><Icon name="x" size={14} /></button>
      </div>
    </div>
  );
}
function GroupPop({ group, onChange, columns, onClose }) {
  return (
    <div className="popover">
      <h6>Group by</h6>
      <div className="po-row" style={{ gridTemplateColumns: '1fr' }}>
        <select value={group || ''} onChange={e => onChange(e.target.value || null)}>
          <option value="">No grouping</option>
          {columns.filter(c => c.groupable).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>
    </div>
  );
}
function HidePop({ hidden, onChange, columns, onClose }) {
  const toggle = (key) => {
    if (hidden.includes(key)) onChange(hidden.filter(k => k !== key));
    else onChange([...hidden, key]);
  };
  return (
    <div className="popover" style={{ minWidth: 220 }}>
      <h6>Show / hide columns</h6>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {columns.map(c => (
          <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 0' }}>
            <input type="checkbox" checked={!hidden.includes(c.key)} onChange={() => toggle(c.key)} disabled={c.pinned} />
            <span>{c.label}</span>
            {c.pinned && <span className="muted small">(pinned)</span>}
          </label>
        ))}
      </div>
    </div>
  );
}

/* ---- Sortable table ---- */
function applyListOps(rows, { filters, sort, group, hidden, columns }) {
  let out = rows.slice();
  filters.forEach(f => {
    if (!f.col) return;
    out = out.filter(r => {
      const v = (r[f.col] == null ? '' : String(r[f.col])).toLowerCase();
      if (f.op === 'contains') return v.includes(String(f.val || '').toLowerCase());
      if (f.op === 'equals') return v === String(f.val || '').toLowerCase();
      if (f.op === 'empty') return !v;
      if (f.op === 'not_empty') return !!v;
      return true;
    });
  });
  if (sort) {
    out.sort((a, b) => {
      const A = (a[sort.col] == null ? '' : a[sort.col]);
      const B = (b[sort.col] == null ? '' : b[sort.col]);
      if (A < B) return sort.dir === 'asc' ? -1 : 1;
      if (A > B) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }
  if (group) {
    const map = {};
    out.forEach(r => {
      const k = r[group] == null ? '(empty)' : String(r[group]);
      (map[k] = map[k] || []).push(r);
    });
    return { grouped: true, groups: Object.entries(map).map(([k, v]) => ({ key: k, rows: v })) };
  }
  return { grouped: false, rows: out };
}

/* ---- Pros list ---- */
const PRO_COLUMNS = [
  { key: 'org_id',         label: 'Org ID',        pinned: true, width: 90, render: (r) => <span className="cell-id">{r.org_id}</span>, groupable: false },
  { key: 'business_name',  label: 'Business',      pinned: true, width: 240, render: (r) => <a className="cell-link">{r.business_name}</a>, groupable: false },
  { key: 'dba',            label: 'DBA',           width: 140, render: (r) => r.dba ? <span>{r.dba}</span> : <span className="muted">—</span>, groupable: false },
  { key: 'lifecycle_status', label: 'Lifecycle',  width: 170, render: (r) => <Pill kind="lifecycle" value={r.lifecycle_status} />, groupable: true },
  { key: 'entity_type',    label: 'Entity',        width: 160, render: (r) => <span>{ENUM_LABELS.ENTITY_TYPE[r.entity_type]}</span>, groupable: true },
  { key: 'state',          label: 'State',         width: 70,  render: (r) => <span>{r.state}</span>, groupable: true },
  { key: 'vertical',       label: 'Vertical',      width: 130, render: (r) => <span>{r.vertical}</span>, groupable: true },
  { key: 'assigned_advisor_email', label: 'Advisor',  width: 70, render: (r) => <Avatar email={r.assigned_advisor_email} />, groupable: true },
  { key: 'assigned_os_email',      label: 'OS',       width: 60, render: (r) => <Avatar email={r.assigned_os_email} />, groupable: true },
  { key: 'bk_lead_email',  label: 'BK lead',       width: 70,  render: (r) => <Avatar email={r.bk_lead_email} empty={!r.bk_lead_email} />, groupable: true },
  { key: 'owner1_name',    label: 'Primary owner', width: 160, render: (r) => r.owner1_name ? <span>{r.owner1_name}{r.owner2_name ? <span className="muted small"> +{r.owner2_name ? 1 : 0}</span> : ''}</span> : <span className="muted">—</span>, groupable: false },
  { key: 'doc_collection_status',  label: 'Docs',     width: 110, render: (r) => <span className={r.doc_collection_status === 'WAITING' ? 'pill pp-IN_QUEUE' : r.doc_collection_status === 'PARTIAL' ? 'pill pp-WFP' : r.doc_collection_status === 'RECEIVED' ? 'pill pp-COMPLETE' : 'pill'}>{ENUM_LABELS.DOC_COLLECTION_STATUS[r.doc_collection_status]}</span>, groupable: true },
  { key: 'books_with_hcp', label: 'Books w/ HCP',  width: 110, render: (r) => r.books_with_hcp ? <span style={{ display:'inline-flex', alignItems:'center', gap: 4, color: 'var(--success-dark)' }}><Icon name="check" size={12} /> Yes</span> : <span className="muted">No</span>, groupable: true },
  { key: 'prior_books_status', label: 'Prior books', width: 140, render: (r) => <span className="muted small">{r.prior_books_status || '—'}</span>, groupable: false },
  { key: 'payroll_servicer', label: 'Payroll',     width: 130, render: (r) => r.payroll_servicer ? <span>{r.payroll_servicer}</span> : <span className="muted">—</span>, groupable: true },
  { key: 'year_started',   label: 'Year started',  width: 100, render: (r) => <span className="mono">{r.year_started || '—'}</span>, groupable: true },
  { key: 'scope_start_date', label: 'Scope start', width: 120, render: (r) => <span className="mono small">{r.scope_start_date || '—'}</span>, groupable: false },
  { key: 'time_zone',      label: 'Time zone',     width: 150, render: (r) => <span className="muted small">{r.time_zone || '—'}</span>, groupable: true },
  { key: 'last_advisor_touchpoint', label: 'Last touch', width: 110, render: (r) => r.last_advisor_touchpoint ? <span className="mono small">{r.last_advisor_touchpoint}</span> : <span className="muted">—</span>, groupable: false },
  { key: 'last_filing_year', label: 'Last filed',  width: 100, render: (r) => <span className="mono">{r.last_filing_year || '—'}</span>, groupable: true },
  { key: 'at_risk',        label: 'At risk',       width: 100, render: (r) => r.at_risk ? <span title={r.at_risk_reason} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--warning-dark)' }}><Icon name="alert" size={14} /> Yes</span> : <span className="muted">—</span>, groupable: true },
  { key: 'projects',       label: 'Projects',      width: 90,  render: (r) => <span className="mono">{r.projects}</span>, groupable: false },
];

function ProsList({ initialSavedView, onNav }) {
  const [savedView, setSavedView] = React.useState(initialSavedView || 'all');
  const [filters, setFilters] = React.useState([]);
  const [sort, setSort] = React.useState({ col: 'business_name', dir: 'asc' });
  const [group, setGroup] = React.useState(null);
  const [hidden, setHidden] = React.useState([]);
  const [collapsed, setCollapsed] = React.useState({});

  const all = PROS;
  const filtered = React.useMemo(() => {
    let rows = all;
    if (savedView === 'my')   rows = rows.filter(r => r.assigned_advisor_email === ME_EMAIL);
    if (savedView === 'risk') rows = rows.filter(r => r.at_risk);
    if (savedView === 'onb')  rows = rows.filter(r => ['CLOSED_WON', 'ONBOARDING_SCHEDULED'].includes(r.lifecycle_status));
    return rows;
  }, [savedView, all]);

  const result = applyListOps(filtered, { filters, sort, group, hidden, columns: PRO_COLUMNS });
  const visibleCols = PRO_COLUMNS.filter(c => !hidden.includes(c.key));

  return (
    <div>
      <div className="ph">
        <div>
          <div className="ph-title">
            <Icon name="users" size={22} />
            Pros
          </div>
          <div className="ph-meta">Business clients HCP does tax work for.</div>
        </div>
        <div className="ph-actions">
          <button className="btn"><Icon name="paperclip" size={14} /> Import</button>
          <button className="btn primary"><Icon name="plus" size={14} /> New pro</button>
        </div>
      </div>

      <div className="view-tabs">
        <button className="view-tab active"><Icon name="list" size={14} /> List</button>
        <button className="view-tab"><Icon name="table" size={14} /> Board <span className="badge">soon</span></button>
        <button className="view-tab"><Icon name="calendar" size={14} /> Calendar <span className="badge">soon</span></button>
      </div>

      <ListToolbar
        savedViews={SAVED_VIEWS_PROS}
        activeView={savedView}
        onView={setSavedView}
        filters={filters} onFilter={setFilters}
        sort={sort} onSort={setSort}
        group={group} onGroup={setGroup}
        hidden={hidden} onHide={setHidden}
        columns={PRO_COLUMNS}
        total={result.grouped ? result.groups.reduce((s, g) => s + g.rows.length, 0) : result.rows.length}
      />

      <div className="table-wrap">
        <table className="tbl" style={{ minWidth: visibleCols.reduce((s, c) => s + c.width, 0) }}>
          <colgroup>
            {visibleCols.map(c => <col key={c.key} style={{ width: c.width }} />)}
          </colgroup>
          <thead>
            <tr>
              {visibleCols.map(c => (
                <th key={c.key} className={(c.pinned ? 'pinned ' : '') + (sort && sort.col === c.key ? 'sorted' : '')}
                    onClick={() => setSort({ col: c.key, dir: sort && sort.col === c.key && sort.dir === 'asc' ? 'desc' : 'asc' })}>
                  <span className="col-head">
                    <span>{c.label}</span>
                    {sort && sort.col === c.key && <Icon name={sort.dir === 'asc' ? 'arrow-up' : 'arrow-down'} size={11} className="sort" />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.grouped ? result.groups.map(g => {
              const key = String(g.key);
              const isCollapsed = collapsed[key];
              return (
                <React.Fragment key={key}>
                  <tr className="group-header" onClick={() => setCollapsed({ ...collapsed, [key]: !isCollapsed })}>
                    <td colSpan={visibleCols.length}>
                      <div className="cell">
                        <Icon name={isCollapsed ? 'chevron-right' : 'chevron-down'} size={13} />
                        <span>{group === 'lifecycle_status' ? ENUM_LABELS.LIFECYCLE_STATUS[key] || key : group === 'entity_type' ? ENUM_LABELS.ENTITY_TYPE[key] || key : key}</span>
                        <span className="cnt">{g.rows.length}</span>
                      </div>
                    </td>
                  </tr>
                  {!isCollapsed && g.rows.map(r => <ProRow key={r.org_id} r={r} cols={visibleCols} onNav={onNav} />)}
                </React.Fragment>
              );
            }) : result.rows.map(r => <ProRow key={r.org_id} r={r} cols={visibleCols} onNav={onNav} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProRow({ r, cols, onNav }) {
  return (
    <tr onClick={() => onNav('pro-detail', { orgId: r.org_id })}>
      {cols.map(c => (
        <td key={c.key} className={c.pinned ? 'pinned' : ''}>
          <span className="cell">{c.render(r)}</span>
        </td>
      ))}
    </tr>
  );
}

/* ---- Projects list ---- */
const PROJ_COLUMNS = [
  { key: 'project_id',     label: 'Project',       pinned: true, width: 240, render: (r) => <a className="cell-link">{r.business_name}</a>, groupable: false },
  { key: 'org_id',         label: 'Org ID',        width: 90,  render: (r) => <span className="cell-id">{r.org_id}</span>, groupable: false },
  { key: 'filing_type',    label: 'Filing type',   width: 140, render: (r) => <span>{ENUM_LABELS.FILING_TYPE[r.filing_type]}</span>, groupable: true },
  { key: 'pipeline_status',label: 'Stage',         width: 170, render: (r) => <Pill kind="pipeline" value={r.pipeline_status} />, groupable: true },
  { key: 'blocker_reason', label: 'Blocker',       width: 200, render: (r) => r.blocker_reason ? <span className="small" style={{ color: 'var(--error-main)', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.blocker_reason}><Icon name="alert" size={11} /> {r.blocker_reason}</span> : <span className="muted">—</span>, groupable: false },
  { key: 'tax_year',       label: 'Tax year',      width: 90,  render: (r) => <span className="mono">{r.tax_year}</span>, groupable: true },
  { key: 'filing_deadline', label: 'Deadline',     width: 110, render: (r) => <span className={'mono ' + dueClass(r.filing_deadline)}>{fmtDue(r.filing_deadline, true)}</span>, groupable: false },
  { key: 'efile_date',     label: 'E-filed',       width: 110, render: (r) => r.efile_date ? <span className="mono">{r.efile_date}</span> : <span className="muted">—</span>, groupable: false },
  { key: 'progress',       label: 'Progress',      width: 130, render: (r) => <ProgressBar pct={r.progress} />, groupable: false },
  { key: 'extension_needed', label: 'Ext needed',  width: 100, render: (r) => r.extension_needed ? <span className="pill pp-WFP">Yes</span> : <span className="muted">No</span>, groupable: true },
  { key: 'extension_filed', label: 'Ext filed',    width: 100, render: (r) => r.extension_filed ? <span className="pill pp-COMPLETE">Yes</span> : <span className="muted">—</span>, groupable: true },
  { key: 'tax_advisor_email',  label: 'Advisor',   width: 80,  render: (r) => <Avatar email={r.tax_advisor_email} />, groupable: true },
  { key: 'tax_preparer_email', label: 'Preparer',  width: 80,  render: (r) => <Avatar email={r.tax_preparer_email} />, groupable: true },
  { key: 'peer_reviewer_email',label: 'Peer review',width: 90, render: (r) => <Avatar email={r.peer_reviewer_email} empty={!r.peer_reviewer_email} />, groupable: true },
  { key: 'os_email',       label: 'OS',            width: 70,  render: (r) => <Avatar email={r.os_email} empty={!r.os_email} />, groupable: true },
  { key: 'complexity',     label: 'Complexity',    width: 110, render: (r) => <span className={r.complexity === 'HIGH' ? 'pill pp-IN_QUEUE_ESCALATED' : r.complexity === 'MED' ? 'pill pp-PREP' : 'pill'}>{r.complexity}</span>, groupable: true },
  { key: 'states_covered', label: 'States',        width: 110, render: (r) => <span className="muted">{r.states_covered}</span>, groupable: true },
  { key: 'tax_risk_level', label: 'Tax risk',      width: 110, render: (r) => { const level = r.complexity === 'HIGH' ? 'High' : r.complexity === 'MED' ? 'Medium' : 'Low'; return <span className={level === 'High' ? 'pill pp-BLOCKED' : level === 'Medium' ? 'pill pp-WFP' : 'pill pp-COMPLETE'}>{level}</span>; }, groupable: true },
  { key: 'books_status', label: 'Books for scope', width: 140, render: (r) => { const status = r.pipeline_status === 'DOC_GATHERING' ? 'In progress' : 'Delivered'; return <span className={'small ' + (status === 'Delivered' ? '' : 'muted')}>{status}</span>; }, groupable: true },
  { key: 'billing_kind',   label: 'Billing',       width: 130, render: () => <span className="muted small">Subscription credit</span>, groupable: true },
];

function ProgressBar({ pct }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%' }}>
      <span style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--grey-200)', overflow: 'hidden' }}>
        <span style={{
          display: 'block', height: '100%',
          width: `${pct}%`,
          background: pct >= 100 ? 'var(--success-main)' : pct >= 50 ? 'var(--success-main)' : 'var(--primary-main)',
        }} />
      </span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-secondary)', minWidth: 30, textAlign: 'right' }}>{pct}%</span>
    </span>
  );
}

function ProjectsList({ initialSavedView, onNav }) {
  const [savedView, setSavedView] = React.useState(initialSavedView || 'all');
  const [filters, setFilters] = React.useState([]);
  const [sort, setSort] = React.useState({ col: 'filing_deadline', dir: 'asc' });
  const [group, setGroup] = React.useState('pipeline_status');
  const [hidden, setHidden] = React.useState([]);
  const [collapsed, setCollapsed] = React.useState({});
  const [view, setView] = React.useState('list'); // list / board

  const all = PROJECTS;
  const filtered = React.useMemo(() => {
    let rows = all;
    if (savedView === 'my')      rows = rows.filter(r => r.tax_advisor_email === ME_EMAIL || r.tax_preparer_email === ME_EMAIL);
    if (savedView === 'sched-c') rows = rows.filter(r => r.filing_type === 'F1040_SCHC');
    if (savedView === 'open')    rows = rows.filter(r => r.pipeline_status !== 'COMPLETE');
    if (savedView === 'qa')      rows = rows.filter(r => r.pipeline_status === 'QA');
    return rows;
  }, [savedView, all]);

  if (view === 'board') {
    return (
      <ProjectsKanban
        rows={filtered}
        onListView={() => setView('list')}
        savedView={savedView} setSavedView={setSavedView}
        onNav={onNav}
      />
    );
  }

  const result = applyListOps(filtered, { filters, sort, group, hidden, columns: PROJ_COLUMNS });
  const visibleCols = PROJ_COLUMNS.filter(c => !hidden.includes(c.key));

  return (
    <div>
      <div className="ph">
        <div>
          <div className="ph-title">
            <Icon name="briefcase" size={22} />
            Projects
          </div>
          <div className="ph-meta">Individual tax returns. Each pro can have multiple per year.</div>
        </div>
        <div className="ph-actions">
          <button className="btn primary"><Icon name="plus" size={14} /> New project</button>
        </div>
      </div>

      <div className="view-tabs">
        <button className={'view-tab' + (view === 'list' ? ' active' : '')} onClick={() => setView('list')}><Icon name="list" size={14} /> List</button>
        <button className={'view-tab' + (view === 'board' ? ' active' : '')} onClick={() => setView('board')}><Icon name="kanban" size={14} /> Board</button>
        <button className="view-tab"><Icon name="calendar" size={14} /> Calendar <span className="badge">soon</span></button>
      </div>

      <ListToolbar
        savedViews={SAVED_VIEWS_PROJ}
        activeView={savedView}
        onView={setSavedView}
        filters={filters} onFilter={setFilters}
        sort={sort} onSort={setSort}
        group={group} onGroup={setGroup}
        hidden={hidden} onHide={setHidden}
        columns={PROJ_COLUMNS}
        total={result.grouped ? result.groups.reduce((s, g) => s + g.rows.length, 0) : result.rows.length}
      />

      <div className="table-wrap">
        <table className="tbl" style={{ minWidth: visibleCols.reduce((s, c) => s + c.width, 0) }}>
          <colgroup>
            {visibleCols.map(c => <col key={c.key} style={{ width: c.width }} />)}
          </colgroup>
          <thead>
            <tr>
              {visibleCols.map(c => (
                <th key={c.key} className={(c.pinned ? 'pinned ' : '') + (sort && sort.col === c.key ? 'sorted' : '')}
                    onClick={() => setSort({ col: c.key, dir: sort && sort.col === c.key && sort.dir === 'asc' ? 'desc' : 'asc' })}>
                  <span className="col-head">
                    <span>{c.label}</span>
                    {sort && sort.col === c.key && <Icon name={sort.dir === 'asc' ? 'arrow-up' : 'arrow-down'} size={11} className="sort" />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.grouped ? result.groups.map(g => {
              const key = String(g.key);
              const isCollapsed = collapsed[key];
              const label = group === 'pipeline_status' ? ENUM_LABELS.PIPELINE_STATUS[key] || key
                          : group === 'filing_type' ? ENUM_LABELS.FILING_TYPE[key] || key
                          : key;
              return (
                <React.Fragment key={key}>
                  <tr className="group-header" onClick={() => setCollapsed({ ...collapsed, [key]: !isCollapsed })}>
                    <td colSpan={visibleCols.length}>
                      <div className="cell">
                        <Icon name={isCollapsed ? 'chevron-right' : 'chevron-down'} size={13} />
                        {group === 'pipeline_status' && <Pill kind="pipeline" value={key} />}
                        {group !== 'pipeline_status' && <span>{label}</span>}
                        <span className="cnt">{g.rows.length}</span>
                      </div>
                    </td>
                  </tr>
                  {!isCollapsed && g.rows.map(r => <ProjRow key={r.project_id} r={r} cols={visibleCols} onNav={onNav} />)}
                </React.Fragment>
              );
            }) : result.rows.map(r => <ProjRow key={r.project_id} r={r} cols={visibleCols} onNav={onNav} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjRow({ r, cols, onNav }) {
  return (
    <tr onClick={() => onNav('project-detail', { projectId: r.project_id })}>
      {cols.map(c => (
        <td key={c.key} className={c.pinned ? 'pinned' : ''}>
          <span className="cell">
            {c.key === 'project_id' && (
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.business_name}</span>
                <span className="cell-id" style={{ fontSize: 11 }}>{ENUM_LABELS.FILING_TYPE[r.filing_type]} · TY{r.tax_year} · {r.org_id}</span>
              </span>
            )}
            {c.key !== 'project_id' && c.render(r)}
          </span>
        </td>
      ))}
    </tr>
  );
}

/* ---- Projects Kanban (M5) ---- */
const PIPELINE_ORDER = ['IN_QUEUE', 'DOC_GATHERING', 'PREP', 'WFP', 'QA', 'CLIENT_REVIEW', 'FILING_DELIVERY', 'COMPLETE', 'BLOCKED'];

function ProjectsKanban({ rows, onListView, savedView, setSavedView, onNav }) {
  const grouped = {};
  PIPELINE_ORDER.forEach(k => grouped[k] = []);
  rows.forEach(r => { (grouped[r.pipeline_status] = grouped[r.pipeline_status] || []).push(r); });

  return (
    <div>
      <div className="ph">
        <div>
          <div className="ph-title">
            <Icon name="briefcase" size={22} />
            Projects
          </div>
          <div className="ph-meta">Pipeline board — drag a card to change stage.</div>
        </div>
        <div className="ph-actions">
          <button className="btn primary"><Icon name="plus" size={14} /> New project</button>
        </div>
      </div>

      <div className="view-tabs">
        <button className="view-tab" onClick={onListView}><Icon name="list" size={14} /> List</button>
        <button className="view-tab active"><Icon name="kanban" size={14} /> Board</button>
        <button className="view-tab"><Icon name="calendar" size={14} /> Calendar <span className="badge">soon</span></button>
      </div>

      <div className="saved-views">
        {SAVED_VIEWS_PROJ.map(v => (
          <button key={v.id} className={'saved-view' + (savedView === v.id ? ' active' : '')} onClick={() => setSavedView(v.id)}>
            {v.label}
          </button>
        ))}
      </div>

      <div className="kb-wrap">
        {PIPELINE_ORDER.map(k => (
          <div key={k} className="kb-col">
            <div className="kb-col-head">
              <Pill kind="pipeline" value={k} />
              <span className="count">{grouped[k].length}</span>
              <div className="spacer"></div>
              <button className="tb-icon-btn" style={{ width: 24, height: 24 }}><Icon name="more" size={14} /></button>
            </div>
            <div className="kb-cards">
              {grouped[k].map(r => (
                <div key={r.project_id} className={'kb-card t-' + r.complexity} onClick={() => onNav('project-detail', { projectId: r.project_id })}>
                  <div className="title">{r.business_name}</div>
                  <div className="org">{ENUM_LABELS.FILING_TYPE[r.filing_type]} · TY{r.tax_year}</div>
                  <div className="meta-row">
                    <AvatarStack emails={[r.tax_advisor_email, r.tax_preparer_email, r.peer_reviewer_email]} />
                    <span className={'deadline ' + dueClass(r.filing_deadline)}>{fmtDue(r.filing_deadline, true)}</span>
                  </div>
                  {r.blocker_reason && <div style={{ marginTop: 4, fontSize: 11, color: 'var(--error-main)' }}><Icon name="alert" size={11} /> {r.blocker_reason}</div>}
                </div>
              ))}
              <button className="tk-add" style={{ padding: 8, color: 'var(--fg-secondary)', borderBottom: 0, justifyContent: 'center' }}>
                <Icon name="plus" size={12} /> Add card
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { ProsList, ProjectsList });
