/* Pros list, Projects list (table + Kanban), list toolbar, create/import dialogs. */
import React from 'react';
import { Icon, Avatar, AvatarStack, Pill, ProgressBar, Popover, Modal, askText, enumOptions, Person } from './ui.jsx';
import { useStore, savePrefs, createPro, createProject, updateProject, toast, refreshAll, api } from './store.js';
import { useRoute, patchRoute } from './router.js';
import { label, dueClass, fmtDue, today, readFileText, cx } from './util.js';
import { useOpenRecord, setListOrder } from './nav.js';
import { applyListOps } from './listops.js';

/* ---------------- list state (URL-hash backed) ---------------- */

function useListState(defaults) {
  const route = useRoute();
  let parsed = {};
  try { parsed = route.list ? JSON.parse(route.list) : {}; } catch (e) { parsed = {}; }
  const st = { filters: [], sort: defaults.sort, group: defaults.group || null, hidden: [], ...parsed };
  const set = (patch) => {
    const next = { ...st, ...patch };
    const compact = {};
    if (next.filters.length) compact.filters = next.filters;
    if (JSON.stringify(next.sort) !== JSON.stringify(defaults.sort)) compact.sort = next.sort;
    if ((next.group || null) !== (defaults.group || null)) compact.group = next.group;
    if (next.hidden.length) compact.hidden = next.hidden;
    patchRoute({ list: Object.keys(compact).length ? JSON.stringify(compact) : '' }, { replace: true });
  };
  return [st, set, route];
}

/* ---------------- toolbar + popovers ---------------- */

function ListToolbar({ kind, savedViews, activeView, onView, st, setSt, columns, total }) {
  const [openMenu, setOpenMenu] = React.useState(null);
  const close = () => setOpenMenu(null);
  const prefs = useStore((s) => s.prefs);
  const userViews = ((prefs.saved_views || {})[kind]) || [];

  async function saveView() {
    const name = await askText('Save current view', { placeholder: 'e.g. My S-Corps in prep', ok: 'Save view', required: true });
    if (!name) return;
    const id = 'v' + Date.now().toString(36);
    const sv = prefs.saved_views || { pros: [], projects: [] };
    savePrefs({ saved_views: { ...sv, [kind]: [...(sv[kind] || []), { id, label: name, base: activeView && !activeView.startsWith('v') ? activeView : 'all', state: { filters: st.filters, sort: st.sort, group: st.group, hidden: st.hidden } }] } });
    onView(id);
    toast('success', 'Saved view "' + name + '" — it\'s in the sidebar under Starred.');
  }
  function removeView(id) {
    const sv = prefs.saved_views || { pros: [], projects: [] };
    savePrefs({ saved_views: { ...sv, [kind]: (sv[kind] || []).filter((v) => v.id !== id) } });
    if (activeView === id) onView('all');
  }

  return (
    <>
      <div className="saved-views">
        {savedViews.map((v) => (
          <button key={v.id} className={'saved-view' + (activeView === v.id ? ' active' : '')} onClick={() => onView(v.id)}>{v.label}</button>
        ))}
        {userViews.map((v) => (
          <button key={v.id} className={'saved-view' + (activeView === v.id ? ' active' : '')} onClick={() => onView(v.id)}>
            <Icon name="star" size={11} /> {v.label}
            {activeView === v.id && <span title="Delete saved view" onClick={(e) => { e.stopPropagation(); removeView(v.id); }} style={{ marginLeft: 4, opacity: 0.7 }}><Icon name="x" size={11} /></span>}
          </button>
        ))}
        <button className="saved-view add" title="Save current view as new tab" onClick={saveView}><Icon name="plus" size={12} /> Save view</button>
      </div>
      <div className="toolbar">
        <div className="popover-host">
          <button className={'tool-chip' + (st.filters.length ? ' active' : '')} onClick={() => setOpenMenu(openMenu === 'f' ? null : 'f')}>
            <Icon name="filter" size={13} /> Filter{st.filters.length > 0 && <span className="dot" />}
          </button>
          <Popover open={openMenu === 'f'} onClose={close}><FilterPop filters={st.filters} onChange={(filters) => setSt({ filters })} columns={columns} /></Popover>
        </div>
        <div className="popover-host">
          <button className={'tool-chip' + (st.sort ? ' active' : '')} onClick={() => setOpenMenu(openMenu === 's' ? null : 's')}>
            <Icon name="sort" size={13} /> Sort{st.sort && <span className="dot" />}
          </button>
          <Popover open={openMenu === 's'} onClose={close}><SortPop sort={st.sort} onChange={(sort) => setSt({ sort })} columns={columns} /></Popover>
        </div>
        <div className="popover-host">
          <button className={'tool-chip' + (st.group ? ' active' : '')} onClick={() => setOpenMenu(openMenu === 'g' ? null : 'g')}>
            <Icon name="group" size={13} /> Group{st.group && <span className="dot" />}
          </button>
          <Popover open={openMenu === 'g'} onClose={close}>
            <h6>Group by</h6>
            <div className="po-row" style={{ gridTemplateColumns: '1fr' }}>
              <select value={st.group || ''} onChange={(e) => setSt({ group: e.target.value || null })}>
                <option value="">No grouping</option>
                {columns.filter((c) => c.groupable).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </Popover>
        </div>
        <div className="popover-host">
          <button className={'tool-chip' + (st.hidden.length ? ' active' : '')} onClick={() => setOpenMenu(openMenu === 'h' ? null : 'h')}>
            <Icon name="columns" size={13} /> Hide{st.hidden.length > 0 && <span className="dot" />}
          </button>
          <Popover open={openMenu === 'h'} onClose={close} style={{ minWidth: 220, maxHeight: 420, overflowY: 'auto' }}>
            <h6>Show / hide columns</h6>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {columns.map((c) => (
                <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 0' }}>
                  <input type="checkbox" checked={!st.hidden.includes(c.key)} disabled={c.pinned}
                    onChange={() => setSt({ hidden: st.hidden.includes(c.key) ? st.hidden.filter((k) => k !== c.key) : [...st.hidden, c.key] })} />
                  <span>{c.label}</span>{c.pinned && <span className="muted small">(pinned)</span>}
                </label>
              ))}
            </div>
          </Popover>
        </div>
        <div className="tool-divider" />
        <span className="muted small">{total} record{total === 1 ? '' : 's'}</span>
        <div className="spacer" />
        {(st.filters.length > 0 || st.group !== undefined) && (st.filters.length > 0 || st.hidden.length > 0) && (
          <button className="tool-chip" onClick={() => setSt({ filters: [], hidden: [] })}><Icon name="x" size={12} /> Clear</button>
        )}
      </div>
    </>
  );
}

function FilterPop({ filters, onChange, columns }) {
  const setRow = (i, patch) => { const next = filters.slice(); next[i] = { ...next[i], ...patch }; onChange(next); };
  return (
    <>
      <h6>Filter rows</h6>
      {filters.length === 0 && <p className="muted small" style={{ margin: '4px 0 8px' }}>No filters yet.</p>}
      {filters.map((f, i) => (
        <div className="po-row" key={i}>
          <select value={f.col} onChange={(e) => setRow(i, { col: e.target.value })}>
            {columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <select value={f.op} onChange={(e) => setRow(i, { op: e.target.value })}>
            <option value="contains">contains</option>
            <option value="equals">equals</option>
            <option value="not">is not</option>
            <option value="empty">is empty</option>
            <option value="not_empty">has value</option>
          </select>
          <button className="tb-icon-btn" onClick={() => onChange(filters.filter((_, j) => j !== i))} style={{ width: 24, height: 24 }}><Icon name="x" size={14} /></button>
          {['contains', 'equals', 'not'].includes(f.op) && (
            <input style={{ gridColumn: '1 / -1' }} placeholder="value" value={f.val} autoFocus onChange={(e) => setRow(i, { val: e.target.value })} />
          )}
        </div>
      ))}
      <button className="po-add" onClick={() => onChange([...filters, { col: columns[1] ? columns[1].key : columns[0].key, op: 'contains', val: '' }])}>
        <Icon name="plus" size={12} /> Add filter
      </button>
    </>
  );
}

function SortPop({ sort, onChange, columns }) {
  return (
    <>
      <h6>Sort by</h6>
      <div className="po-row" style={{ gridTemplateColumns: '1fr 1fr 28px' }}>
        <select value={(sort && sort.col) || ''} onChange={(e) => onChange(e.target.value ? { col: e.target.value, dir: (sort && sort.dir) || 'asc' } : null)}>
          <option value="">(none)</option>
          {columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select value={(sort && sort.dir) || 'asc'} onChange={(e) => onChange({ ...(sort || { col: columns[0].key }), dir: e.target.value })}>
          <option value="asc">ascending ↑</option>
          <option value="desc">descending ↓</option>
        </select>
        <button className="tb-icon-btn" onClick={() => onChange(null)} style={{ width: 24, height: 24 }}><Icon name="x" size={14} /></button>
      </div>
    </>
  );
}

/* ---------------- shared table ---------------- */

const ROW_CAP = 200;

function DataTable({ result, columns, st, setSt, rowKey, onRow, groupLabel }) {
  const [collapsed, setCollapsed] = React.useState({});
  const [showAll, setShowAll] = React.useState(false);
  const visible = columns.filter((c) => !st.hidden.includes(c.key));
  let budget = showAll ? Infinity : ROW_CAP;
  const take = (rows) => { const out = rows.slice(0, Math.max(0, budget)); budget -= out.length; return out; };
  const renderRow = (r) => (
    <tr key={rowKey(r)} onClick={() => onRow(r)} className={r.archived ? 'archived' : ''}>
      {visible.map((c) => <td key={c.key} className={c.pinned ? 'pinned' : ''}><span className="cell">{c.render(r)}</span></td>)}
    </tr>
  );
  return (
    <div className="table-wrap">
      <table className="tbl" style={{ minWidth: visible.reduce((s, c) => s + c.width, 0) }}>
        <colgroup>{visible.map((c) => <col key={c.key} style={{ width: c.width }} />)}</colgroup>
        <thead>
          <tr>
            {visible.map((c) => (
              <th key={c.key} className={(c.pinned ? 'pinned ' : '') + (st.sort && st.sort.col === c.key ? 'sorted' : '')}
                onClick={() => setSt({ sort: { col: c.key, dir: st.sort && st.sort.col === c.key && st.sort.dir === 'asc' ? 'desc' : 'asc' } })}>
                <span className="col-head">
                  <span>{c.label}</span>
                  {st.sort && st.sort.col === c.key && <Icon name={st.sort.dir === 'asc' ? 'arrow-up' : 'arrow-down'} size={11} className="sort" />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.grouped ? result.groups.map((g) => {
            const isCollapsed = collapsed[g.key];
            return (
              <React.Fragment key={g.key}>
                <tr className="group-header" onClick={() => setCollapsed({ ...collapsed, [g.key]: !isCollapsed })}>
                  <td colSpan={visible.length}>
                    <div className="cell">
                      <Icon name={isCollapsed ? 'chevron-right' : 'chevron-down'} size={13} />
                      {groupLabel(st.group, g.key)}
                      <span className="cnt">{g.rows.length}</span>
                    </div>
                  </td>
                </tr>
                {!isCollapsed && take(g.rows).map(renderRow)}
              </React.Fragment>
            );
          }) : take(result.rows).map(renderRow)}
          {result.count === 0 && (
            <tr><td colSpan={visible.length}><div className="muted" style={{ padding: 28, textAlign: 'center' }}>No records match this view.</div></td></tr>
          )}
        </tbody>
      </table>
      {!showAll && result.count > ROW_CAP && (
        <div style={{ padding: 12, textAlign: 'center' }}>
          <button className="btn sm" onClick={() => setShowAll(true)}>Show all {result.count} records</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Pros ---------------- */

const LIFECYCLE_ORDER = ['CLOSED_WON', 'ONBOARDING_SCHEDULED', 'ONBOARDED', 'ACTIVE_PROJECT', 'ADVISORY_ONLY', 'PASS_BACK'];
const DOC_PILL = { WAITING: 'pill pp-IN_QUEUE', PARTIAL: 'pill pp-WFP', RECEIVED: 'pill pp-COMPLETE' };

function usePersonName() {
  const teamBy = useStore((s) => s.teamBy);
  return (email) => (email ? (teamBy[email] ? teamBy[email].name : email) : '');
}

function proColumns(personName) {
  return [
    { key: 'org_id', label: 'Org ID', pinned: true, width: 90, render: (r) => <span className="cell-id">{r.org_id}</span>, sortVal: (r) => Number(r.org_id) || r.org_id },
    { key: 'business_name', label: 'Business', pinned: true, width: 240, render: (r) => <a className="cell-link">{r.business_name}</a> },
    { key: 'dba', label: 'DBA', width: 140, render: (r) => (r.dba ? <span>{r.dba}</span> : <span className="muted">—</span>) },
    { key: 'lifecycle_status', label: 'Lifecycle', width: 170, render: (r) => <Pill kind="lifecycle" value={r.lifecycle_status} />, groupable: true, text: (r) => label('LIFECYCLE_STATUS', r.lifecycle_status), groupOrder: LIFECYCLE_ORDER, sortVal: (r) => LIFECYCLE_ORDER.indexOf(r.lifecycle_status) },
    { key: 'entity_type', label: 'Entity', width: 160, render: (r) => <span>{label('ENTITY_TYPE', r.entity_type) || <span className="muted">—</span>}</span>, groupable: true, text: (r) => label('ENTITY_TYPE', r.entity_type) },
    { key: 'state', label: 'State', width: 70, render: (r) => <span>{r.state || '—'}</span>, groupable: true },
    { key: 'vertical', label: 'Vertical', width: 130, render: (r) => <span>{r.vertical || '—'}</span>, groupable: true },
    { key: 'assigned_advisor_email', label: 'Advisor', width: 70, render: (r) => <Avatar email={r.assigned_advisor_email} />, groupable: true, text: (r) => personName(r.assigned_advisor_email) },
    { key: 'assigned_os_email', label: 'OS', width: 60, render: (r) => (r.needs_os_assignment ? <span title="Case owner didn't match the roster — assign an OS" style={{ color: 'var(--warning-dark)' }}><Icon name="flag" size={14} /></span> : <Avatar email={r.assigned_os_email} />), groupable: true, text: (r) => personName(r.assigned_os_email) },
    { key: 'bk_lead_email', label: 'BK lead', width: 70, render: (r) => <Avatar email={r.bk_lead_email} empty={!r.bk_lead_email} />, groupable: true, text: (r) => personName(r.bk_lead_email) },
    { key: 'owner1_name', label: 'Primary owner', width: 160, render: (r) => (r.owner1_name ? <span>{r.owner1_name}{r.owner2_name && <span className="muted small"> +{r.owner3_name ? 2 : 1}</span>}</span> : <span className="muted">—</span>) },
    { key: 'doc_collection_status', label: 'Docs', width: 110, render: (r) => (r.doc_collection_status ? <span className={DOC_PILL[r.doc_collection_status] || 'pill'}>{label('DOC_COLLECTION_STATUS', r.doc_collection_status)}</span> : <span className="muted">—</span>), groupable: true, text: (r) => label('DOC_COLLECTION_STATUS', r.doc_collection_status) },
    { key: 'books_with_hcp', label: 'Books w/ HCP', width: 110, render: (r) => (r.books_with_hcp ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--success-dark)' }}><Icon name="check" size={12} /> Yes</span> : <span className="muted">No</span>), groupable: true, text: (r) => (r.books_with_hcp ? 'Yes' : 'No') },
    { key: 'prior_books_status', label: 'Prior books', width: 140, render: (r) => <span className="muted small">{r.prior_books_status || '—'}</span> },
    { key: 'payroll_servicer', label: 'Payroll', width: 130, render: (r) => (r.payroll_servicer ? <span>{r.payroll_servicer}</span> : <span className="muted">—</span>), groupable: true },
    { key: 'year_started', label: 'Year started', width: 100, render: (r) => <span className="mono">{r.year_started || '—'}</span>, groupable: true },
    { key: 'scope_start_date', label: 'Scope start', width: 120, render: (r) => <span className="mono small">{r.scope_start_date || '—'}</span> },
    { key: 'time_zone', label: 'Time zone', width: 150, render: (r) => <span className="muted small">{r.time_zone || '—'}</span>, groupable: true },
    { key: 'last_advisor_touchpoint', label: 'Last touch', width: 110, render: (r) => (r.last_advisor_touchpoint ? <span className="mono small">{r.last_advisor_touchpoint}</span> : <span className="muted">—</span>) },
    { key: 'last_filing_year', label: 'Last filed', width: 100, render: (r) => <span className="mono">{r.last_filing_year || '—'}</span>, groupable: true },
    { key: 'at_risk', label: 'At risk', width: 100, render: (r) => (r.at_risk ? <span title={r.at_risk_reason || ''} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--warning-dark)' }}><Icon name="alert" size={14} /> Yes</span> : <span className="muted">—</span>), groupable: true, text: (r) => (r.at_risk ? 'Yes' : 'No') },
    { key: 'projects', label: 'Projects', width: 90, render: (r) => <span className="mono">{r.projects || 0}</span> },
  ];
}

function proGroupLabel(group, key) {
  if (group === 'lifecycle_status') return key === '(empty)' ? <span>(empty)</span> : <Pill kind="lifecycle" value={key} />;
  if (group === 'entity_type') return <span>{label('ENTITY_TYPE', key) || key}</span>;
  if (group === 'doc_collection_status') return <span>{label('DOC_COLLECTION_STATUS', key) || key}</span>;
  if (/email$/.test(group)) return <Person email={key === '(empty)' ? '' : key} />;
  if (group === 'books_with_hcp' || group === 'at_risk') return <span>{key === 'true' ? 'Yes' : 'No'}</span>;
  return <span>{key}</span>;
}

export function ProsList() {
  const all = useStore((s) => s.pros);
  const me = useStore((s) => s.user.email);
  const prefs = useStore((s) => s.prefs);
  const personName = usePersonName();
  const columns = React.useMemo(() => proColumns(personName), [personName]);
  const [st, setSt, route] = useListState({ sort: { col: 'business_name', dir: 'asc' } });
  const openRecord = useOpenRecord();
  const [modal, setModal] = React.useState(null);
  const savedView = route.savedView || 'all';
  const userViews = ((prefs.saved_views || {}).pros) || [];

  const SAVED = [
    { id: 'all', label: 'All pros' },
    { id: 'my', label: 'My pros' },
    { id: 'risk', label: 'At risk' },
    { id: 'onb', label: 'Onboarding' },
  ];
  const baseFilter = (id) => {
    const uv = userViews.find((v) => v.id === id);
    const base = uv ? uv.base : id;
    return (r) => {
      if (r.archived) return false;
      if (base === 'my') return r.assigned_advisor_email === me || r.assigned_os_email === me || r.bk_lead_email === me;
      if (base === 'risk') return r.at_risk;
      if (base === 'onb') return ['CLOSED_WON', 'ONBOARDING_SCHEDULED'].includes(r.lifecycle_status);
      return true;
    };
  };
  const rows = React.useMemo(() => all.filter(baseFilter(savedView)), [all, savedView, me, userViews]);
  const result = applyListOps(rows, st, columns);
  React.useEffect(() => { setListOrder('pro', result.flat.map((r) => r.org_id)); });

  function onView(id) {
    const uv = userViews.find((v) => v.id === id);
    patchRoute({ savedView: id === 'all' ? '' : id, list: uv ? JSON.stringify(uv.state) : '' }, { replace: true });
  }

  return (
    <div>
      <div className="ph">
        <div>
          <div className="ph-title"><Icon name="users" size={22} /> Pros</div>
          <div className="ph-meta">Business clients HCP does tax work for.</div>
        </div>
        <div className="ph-actions">
          <button className="btn" onClick={() => setModal('import')}><Icon name="paperclip" size={14} /> Import</button>
          <button className="btn primary" onClick={() => setModal('new')}><Icon name="plus" size={14} /> New pro</button>
        </div>
      </div>
      <div className="view-tabs">
        <button className="view-tab active"><Icon name="list" size={14} /> List</button>
        <button className="view-tab" disabled><Icon name="table" size={14} /> Board <span className="badge">soon</span></button>
        <button className="view-tab" disabled><Icon name="calendar" size={14} /> Calendar <span className="badge">soon</span></button>
      </div>
      <ListToolbar kind="pros" savedViews={SAVED} activeView={savedView} onView={onView} st={st} setSt={setSt} columns={columns} total={result.count} />
      <DataTable result={result} columns={columns} st={st} setSt={setSt} rowKey={(r) => r.org_id} onRow={(r) => openRecord('pro', r.org_id)} groupLabel={proGroupLabel} />
      {modal === 'new' && <NewProModal onClose={() => setModal(null)} onCreated={(p) => { setModal(null); openRecord('pro', p.org_id); }} />}
      {modal === 'import' && <ImportModal defaultKind="pros" onClose={() => setModal(null)} />}
    </div>
  );
}

/* ---------------- Projects ---------------- */

const PIPELINE_ORDER = ['IN_QUEUE', 'IN_QUEUE_ESCALATED', 'DOC_GATHERING', 'PREP', 'WFP', 'QA', 'CLIENT_REVIEW', 'FILING_DELIVERY', 'COMPLETE', 'BLOCKED'];
const RISK_PILL = { High: 'pill pp-BLOCKED', Medium: 'pill pp-WFP', Low: 'pill pp-COMPLETE' };

function riskLevel(r) {
  if (r.tax_risk_level) return r.tax_risk_level;
  return r.complexity === 'HIGH' ? 'High' : r.complexity === 'MED' ? 'Medium' : r.complexity === 'LOW' ? 'Low' : '';
}

function projColumns(personName) {
  return [
    {
      key: 'project_id', label: 'Project', pinned: true, width: 240, sortVal: (r) => r.business_name, text: (r) => r.business_name + ' ' + r.project_id,
      render: (r) => (
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.business_name}</span>
          <span className="cell-id" style={{ fontSize: 11 }}>{label('FILING_TYPE', r.filing_type)} · TY{r.tax_year} · {r.org_id}</span>
        </span>
      ),
    },
    { key: 'org_id', label: 'Org ID', width: 90, render: (r) => <span className="cell-id">{r.org_id}</span> },
    { key: 'filing_type', label: 'Filing type', width: 140, render: (r) => <span>{label('FILING_TYPE', r.filing_type)}</span>, groupable: true, text: (r) => label('FILING_TYPE', r.filing_type) },
    { key: 'pipeline_status', label: 'Stage', width: 170, render: (r) => <Pill kind="pipeline" value={r.pipeline_status} />, groupable: true, text: (r) => label('PIPELINE_STATUS', r.pipeline_status), groupOrder: PIPELINE_ORDER, sortVal: (r) => PIPELINE_ORDER.indexOf(r.pipeline_status) },
    { key: 'blocker_reason', label: 'Blocker', width: 200, render: (r) => (r.blocker_reason ? <span className="small" style={{ color: 'var(--error-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.blocker_reason}><Icon name="alert" size={11} /> {r.blocker_reason}</span> : <span className="muted">—</span>) },
    { key: 'tax_year', label: 'Tax year', width: 90, render: (r) => <span className="mono">{r.tax_year}</span>, groupable: true },
    { key: 'filing_deadline', label: 'Deadline', width: 110, render: (r) => (r.filing_deadline ? <span className={'mono ' + (r.pipeline_status !== 'COMPLETE' ? dueClass(r.filing_deadline) : '')}>{fmtDue(r.filing_deadline, true)}</span> : <span className="muted">—</span>) },
    { key: 'efile_date', label: 'E-filed', width: 110, render: (r) => (r.efile_date ? <span className="mono">{r.efile_date}</span> : <span className="muted">—</span>) },
    { key: 'progress', label: 'Progress', width: 130, render: (r) => <ProgressBar pct={r.progress} /> },
    { key: 'extension_needed', label: 'Ext needed', width: 100, render: (r) => (r.extension_needed ? <span className="pill pp-WFP">Yes</span> : <span className="muted">No</span>), groupable: true, text: (r) => (r.extension_needed ? 'Yes' : 'No') },
    { key: 'extension_filed', label: 'Ext filed', width: 100, render: (r) => (r.extension_filed ? <span className="pill pp-COMPLETE">Yes</span> : <span className="muted">—</span>), groupable: true, text: (r) => (r.extension_filed ? 'Yes' : 'No') },
    { key: 'tax_advisor_email', label: 'Advisor', width: 80, render: (r) => <Avatar email={r.tax_advisor_email} empty={!r.tax_advisor_email} />, groupable: true, text: (r) => personName(r.tax_advisor_email) },
    { key: 'tax_preparer_email', label: 'Preparer', width: 80, render: (r) => <Avatar email={r.tax_preparer_email} empty={!r.tax_preparer_email} />, groupable: true, text: (r) => personName(r.tax_preparer_email) },
    { key: 'peer_reviewer_email', label: 'Peer review', width: 90, render: (r) => <Avatar email={r.peer_reviewer_email} empty={!r.peer_reviewer_email} />, groupable: true, text: (r) => personName(r.peer_reviewer_email) },
    { key: 'os_email', label: 'OS', width: 70, render: (r) => <Avatar email={r.os_email} empty={!r.os_email} />, groupable: true, text: (r) => personName(r.os_email) },
    { key: 'complexity', label: 'Complexity', width: 110, render: (r) => (r.complexity ? <span className={r.complexity === 'HIGH' ? 'pill pp-IN_QUEUE_ESCALATED' : r.complexity === 'MED' ? 'pill pp-PREP' : 'pill'}>{r.complexity}</span> : <span className="muted">—</span>), groupable: true },
    { key: 'states_covered', label: 'States', width: 110, render: (r) => <span className="muted">{r.states_covered || '—'}</span>, groupable: true },
    { key: 'tax_risk_level', label: 'Tax risk', width: 110, render: (r) => { const l = riskLevel(r); return l ? <span className={RISK_PILL[l] || 'pill'}>{l}</span> : <span className="muted">—</span>; }, groupable: true, text: riskLevel },
    { key: 'books_status', label: 'Books for scope', width: 140, render: (r) => <span className="small">{r.books_status || <span className="muted">—</span>}</span>, groupable: true },
    { key: 'billing_kind', label: 'Billing', width: 130, render: (r) => <span className="muted small">{r.billing_kind || '—'}</span>, groupable: true },
  ];
}

function projGroupLabel(group, key) {
  if (group === 'pipeline_status') return key === '(empty)' ? <span>(empty)</span> : <Pill kind="pipeline" value={key} />;
  if (group === 'filing_type') return <span>{label('FILING_TYPE', key) || key}</span>;
  if (/email$/.test(group)) return <Person email={key === '(empty)' ? '' : key} />;
  if (group === 'extension_needed' || group === 'extension_filed') return <span>{key === 'true' ? 'Yes' : 'No'}</span>;
  return <span>{key}</span>;
}

export function ProjectsList() {
  const all = useStore((s) => s.projects);
  const me = useStore((s) => s.user.email);
  const prefs = useStore((s) => s.prefs);
  const personName = usePersonName();
  const columns = React.useMemo(() => projColumns(personName), [personName]);
  const [st, setSt, route] = useListState({ sort: { col: 'filing_deadline', dir: 'asc' }, group: 'pipeline_status' });
  const openRecord = useOpenRecord();
  const [modal, setModal] = React.useState(null);
  const savedView = route.savedView || 'all';
  const board = route.tab === 'board';
  const userViews = ((prefs.saved_views || {}).projects) || [];

  const SAVED = [
    { id: 'all', label: 'All projects' },
    { id: 'my', label: 'My projects' },
    { id: 'sched-c', label: '1040 + Sched C' },
    { id: 'open', label: 'Open' },
    { id: 'qa', label: 'Pending peer review' },
  ];
  const rows = React.useMemo(() => {
    const uv = userViews.find((v) => v.id === savedView);
    const base = uv ? uv.base : savedView;
    return all.filter((r) => {
      if (r.archived) return false;
      if (base === 'my') return [r.tax_advisor_email, r.tax_preparer_email, r.peer_reviewer_email, r.os_email].includes(me);
      if (base === 'sched-c') return r.filing_type === 'F1040_SCHC';
      if (base === 'open') return r.pipeline_status !== 'COMPLETE';
      if (base === 'qa') return r.pipeline_status === 'QA';
      return true;
    });
  }, [all, savedView, me, userViews]);
  const result = applyListOps(rows, board ? { ...st, group: null } : st, columns);
  React.useEffect(() => { setListOrder('project', result.flat.map((r) => r.project_id)); });

  function onView(id) {
    const uv = userViews.find((v) => v.id === id);
    patchRoute({ savedView: id === 'all' ? '' : id, list: uv ? JSON.stringify(uv.state) : '' }, { replace: true });
  }

  return (
    <div>
      <div className="ph">
        <div>
          <div className="ph-title"><Icon name="briefcase" size={22} /> Projects</div>
          <div className="ph-meta">{board ? 'Pipeline board — drag a card to change stage.' : 'Individual tax returns. Each pro can have multiple per year.'}</div>
        </div>
        <div className="ph-actions">
          <button className="btn" onClick={() => setModal({ kind: 'import' })}><Icon name="paperclip" size={14} /> Import</button>
          <button className="btn primary" onClick={() => setModal({ kind: 'new' })}><Icon name="plus" size={14} /> New project</button>
        </div>
      </div>
      <div className="view-tabs">
        <button className={'view-tab' + (!board ? ' active' : '')} onClick={() => patchRoute({ tab: '' }, { replace: true })}><Icon name="list" size={14} /> List</button>
        <button className={'view-tab' + (board ? ' active' : '')} onClick={() => patchRoute({ tab: 'board' }, { replace: true })}><Icon name="kanban" size={14} /> Board</button>
        <button className="view-tab" disabled><Icon name="calendar" size={14} /> Calendar <span className="badge">soon</span></button>
      </div>
      <ListToolbar kind="projects" savedViews={SAVED} activeView={savedView} onView={onView} st={st} setSt={setSt} columns={columns} total={result.count} />
      {board
        ? <Kanban rows={result.flat} onOpen={(r) => openRecord('project', r.project_id)} onAdd={(stage) => setModal({ kind: 'new', stage })} />
        : <DataTable result={result} columns={columns} st={st} setSt={setSt} rowKey={(r) => r.project_id} onRow={(r) => openRecord('project', r.project_id)} groupLabel={projGroupLabel} />}
      {modal && modal.kind === 'new' && (
        <NewProjectModal stage={modal.stage} onClose={() => setModal(null)} onCreated={(p) => { setModal(null); openRecord('project', p.project_id); }} />
      )}
      {modal && modal.kind === 'import' && <ImportModal defaultKind="projects" onClose={() => setModal(null)} />}
    </div>
  );
}

const KANBAN_COLS = ['IN_QUEUE', 'DOC_GATHERING', 'PREP', 'WFP', 'QA', 'CLIENT_REVIEW', 'FILING_DELIVERY', 'COMPLETE', 'BLOCKED'];

function Kanban({ rows, onOpen, onAdd }) {
  const [dragId, setDragId] = React.useState(null);
  const [over, setOver] = React.useState(null);
  const [shake, setShake] = React.useState(null);
  const [landed, setLanded] = React.useState(null);
  const grouped = {};
  KANBAN_COLS.forEach((k) => { grouped[k] = []; });
  rows.forEach((r) => {
    const k = r.pipeline_status === 'IN_QUEUE_ESCALATED' ? 'IN_QUEUE' : r.pipeline_status;
    (grouped[k] = grouped[k] || []).push(r);
  });

  async function drop(stage) {
    const card = rows.find((r) => r.project_id === dragId);
    setDragId(null); setOver(null);
    if (!card || card.pipeline_status === stage) return;
    const patch = { pipeline_status: stage };
    if (stage === 'BLOCKED') {
      const reason = await askText('What is blocking this return?', { placeholder: 'e.g. Awaiting prior-year return from CPA', ok: 'Move to Blocked', required: true });
      if (!reason) return;
      patch.blocker_reason = reason;
    }
    try {
      await updateProject(card, patch, card.business_name + ' → ' + label('PIPELINE_STATUS', stage));
      setLanded(card.project_id);
      setTimeout(() => setLanded(null), 1400);
    } catch (e) {
      setShake(card.project_id);
      setTimeout(() => setShake(null), 600);
    }
  }

  return (
    <div className="kb-wrap">
      {KANBAN_COLS.map((k) => (
        <div key={k} className={cx('kb-col', over === k && 'drop-over')}
          onDragOver={(e) => { if (dragId) { e.preventDefault(); setOver(k); } }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver((o) => (o === k ? null : o)); }}
          onDrop={(e) => { e.preventDefault(); drop(k); }}>
          <div className="kb-col-head">
            <Pill kind="pipeline" value={k} />
            <span className="count">{grouped[k].length}</span>
            <div className="spacer" />
          </div>
          <div className="kb-cards">
            {grouped[k].map((r) => (
              <div key={r.project_id} draggable
                className={cx('kb-card', 't-' + (r.complexity || 'LOW'), dragId === r.project_id && 'lifted', shake === r.project_id && 'tm-shake')}
                onDragStart={(e) => { setDragId(r.project_id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', r.project_id); }}
                onDragEnd={() => { setDragId(null); setOver(null); }}
                onClick={() => onOpen(r)}>
                <div className="title">{r.business_name}{landed === r.project_id && <span className="row-saved" style={{ marginLeft: 6 }}><Icon name="check" size={9} /> saved</span>}</div>
                <div className="org">{label('FILING_TYPE', r.filing_type)} · TY{r.tax_year}</div>
                <div className="meta-row">
                  <AvatarStack emails={[r.tax_advisor_email, r.tax_preparer_email, r.peer_reviewer_email]} />
                  <span className={'deadline ' + (r.pipeline_status !== 'COMPLETE' ? dueClass(r.filing_deadline) : '')}>{r.filing_deadline ? fmtDue(r.filing_deadline, true) : ''}</span>
                </div>
                {r.blocker_reason && <div style={{ marginTop: 4, fontSize: 11, color: 'var(--error-main)' }}><Icon name="alert" size={11} /> {r.blocker_reason}</div>}
              </div>
            ))}
            <button className="tk-add" style={{ padding: 8, color: 'var(--fg-secondary)', borderBottom: 0, justifyContent: 'center' }} onClick={() => onAdd(k)}>
              <Icon name="plus" size={12} /> Add card
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- create dialogs ---------------- */

function PeopleSelect({ value, onChange, roles, placeholder = 'Unassigned' }) {
  const team = useStore((s) => s.team);
  const list = team.filter((m) => m.active && (!roles || m.roles.some((r) => roles.includes(r))));
  return (
    <select className="tm-input" value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {list.map((m) => <option key={m.email} value={m.email}>{m.name}</option>)}
    </select>
  );
}
export { PeopleSelect };

export function NewProModal({ onClose, onCreated }) {
  const [f, setF] = React.useState({ org_id: '', business_name: '', dba: '', vertical: '', state: '', entity_type: '', assigned_advisor_email: '', assigned_os_email: '', lifecycle_status: 'CLOSED_WON' });
  const [busy, setBusy] = React.useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e && e.target ? e.target.value : e });
  const [tried, setTried] = React.useState(false);
  const orgErr = !f.org_id.trim() ? 'Org ID is required.' : !/^\d+$/.test(f.org_id.trim()) ? 'Org ID must be numbers only (the Salesforce Org ID, e.g. 749297).' : '';
  const nameErr = f.business_name.trim() ? '' : 'Business name is required.';
  const valid = !orgErr && !nameErr;
  async function submit() {
    setTried(true);
    if (!valid) return;
    setBusy(true);
    try {
      const fields = { ...f, org_id: f.org_id.trim(), state: f.state.toUpperCase() };
      Object.keys(fields).forEach((k) => { if (fields[k] === '') delete fields[k]; });
      const p = await createPro(fields);
      toast('success', 'Created ' + p.business_name + (p.assigned_advisor_email ? '' : ''));
      onCreated(p);
    } catch (e) { setBusy(false); }
  }
  return (
    <Modal title="New pro" onClose={onClose} width={620}
      footer={<><button className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy} onClick={submit}>{busy ? 'Creating…' : 'Create pro'}</button></>}>
      <div className="wiz-row">
        <div className="wiz-field"><label className="lbl">Org ID *</label><input className={cx('tm-input mono', (tried || /\D/.test(f.org_id)) && orgErr && 'invalid')} autoFocus inputMode="numeric" value={f.org_id} onChange={set('org_id')} placeholder="e.g. 749297" />
          {(tried || /\D/.test(f.org_id)) && orgErr && <span className="tm-field-error">{orgErr}</span>}</div>
        <div className="wiz-field"><label className="lbl">Business name *</label><input className={cx('tm-input', tried && nameErr && 'invalid')} value={f.business_name} onChange={set('business_name')} />
          {tried && nameErr && <span className="tm-field-error">{nameErr}</span>}</div>
      </div>
      <div className="wiz-row">
        <div className="wiz-field"><label className="lbl">DBA</label><input className="tm-input" value={f.dba} onChange={set('dba')} /></div>
        <div className="wiz-field"><label className="lbl">Entity type</label>
          <select className="tm-input" value={f.entity_type} onChange={set('entity_type')}><option value="">Select…</option>{enumOptions('ENTITY_TYPE').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        </div>
      </div>
      <div className="wiz-row">
        <div className="wiz-field"><label className="lbl">Vertical</label><input className="tm-input" value={f.vertical} onChange={set('vertical')} placeholder="e.g. Plumbing" /></div>
        <div className="wiz-field"><label className="lbl">State</label><input className="tm-input" value={f.state} maxLength={2} onChange={set('state')} placeholder="CO" /></div>
      </div>
      <div className="wiz-row">
        <div className="wiz-field"><label className="lbl">Tax advisor</label><PeopleSelect value={f.assigned_advisor_email} onChange={set('assigned_advisor_email')} roles={['ADVISOR']} placeholder="Auto — least-loaded advisor" /></div>
        <div className="wiz-field"><label className="lbl">Onboarding specialist</label><PeopleSelect value={f.assigned_os_email} onChange={set('assigned_os_email')} roles={['OS']} /></div>
      </div>
      <div className="wiz-field"><label className="lbl">Lifecycle</label>
        <select className="tm-input" value={f.lifecycle_status} onChange={set('lifecycle_status')}>{enumOptions('LIFECYCLE_STATUS').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      </div>
    </Modal>
  );
}

const DEADLINES = { F1040_SCHC: '04-15', S_CORP: '03-15', PARTNERSHIP: '03-15', C_CORP: '04-15' };

export function NewProjectModal({ orgId, stage, onClose, onCreated }) {
  const pros = useStore((s) => s.pros);
  const pro0 = orgId ? pros.find((p) => p.org_id === orgId) : null;
  const defaultType = pro0 && pro0.entity_type === 'SOLE_PROP_SCHED_C' ? 'F1040_SCHC' : pro0 && ['S_CORP', 'PARTNERSHIP', 'C_CORP'].includes(pro0.entity_type) ? pro0.entity_type : 'F1040_SCHC';
  const [f, setF] = React.useState({
    org_id: orgId || '', filing_type: defaultType, tax_year: String(Number(today().slice(0, 4)) - 1), filing_deadline: '',
    project_start_date: today(), pipeline_status: stage || 'IN_QUEUE', tax_preparer_email: '', peer_reviewer_email: '', complexity: 'MED',
  });
  const [q, setQ] = React.useState(pro0 ? pro0.business_name : '');
  const [busy, setBusy] = React.useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e && e.target ? e.target.value : e });
  const autoDeadline = DEADLINES[f.filing_type] ? (Number(f.tax_year) + 1) + '-' + DEADLINES[f.filing_type] : '';
  const matches = !orgId && q && !f.org_id ? pros.filter((p) => !p.archived && (p.business_name.toLowerCase().includes(q.toLowerCase()) || String(p.org_id).includes(q))).slice(0, 6) : [];
  const selected = pros.find((p) => p.org_id === f.org_id);
  const valid = selected && f.filing_type && Number(f.tax_year) > 2000;
  const [tried, setTried] = React.useState(false);
  const projErr = !selected ? 'Pick the pro this return is for.' : !(Number(f.tax_year) > 2000) ? 'Enter a 4-digit tax year.' : '';
  async function submit() {
    setTried(true);
    if (!valid) return;
    setBusy(true);
    try {
      const fields = { ...f, tax_year: Number(f.tax_year), filing_deadline: f.filing_deadline || autoDeadline };
      Object.keys(fields).forEach((k) => { if (fields[k] === '') delete fields[k]; });
      const p = await createProject(fields);
      toast('success', 'Created ' + p.project_id + ' with template tasks');
      onCreated(p);
    } catch (e) { setBusy(false); }
  }
  return (
    <Modal title="New project" onClose={onClose} width={620}
      footer={<><button className="btn subtle" onClick={onClose}>Cancel</button>{tried && projErr && <span className="tm-field-error" style={{ marginRight: 'auto' }}>{projErr}</span>}<button className="btn primary" disabled={busy} onClick={submit}>{busy ? 'Creating…' : 'Create project'}</button></>}>
      <div className="wiz-field" style={{ position: 'relative' }}>
        <label className="lbl">Pro *</label>
        {orgId || selected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong>{selected ? selected.business_name : orgId}</strong><span className="mono muted small">{f.org_id}</span>
            {!orgId && <button className="btn subtle sm" onClick={() => { setF({ ...f, org_id: '' }); setQ(''); }}>Change</button>}
          </div>
        ) : (
          <>
            <input className="tm-input" autoFocus placeholder="Search business name or Org ID…" value={q} onChange={(e) => setQ(e.target.value)} />
            {matches.length > 0 && (
              <div className="tm-suggest">
                {matches.map((p) => (
                  <div key={p.org_id} className="res" onClick={() => { setF({ ...f, org_id: p.org_id, filing_type: p.entity_type === 'SOLE_PROP_SCHED_C' ? 'F1040_SCHC' : ['S_CORP', 'PARTNERSHIP', 'C_CORP'].includes(p.entity_type) ? p.entity_type : f.filing_type }); setQ(p.business_name); }}>
                    <span>{p.business_name}</span><span className="mono muted small">{p.org_id}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <div className="wiz-row">
        <div className="wiz-field"><label className="lbl">Filing type *</label>
          <select className="tm-input" value={f.filing_type} onChange={set('filing_type')}>{enumOptions('FILING_TYPE').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        </div>
        <div className="wiz-field"><label className="lbl">Tax year *</label><input className="tm-input mono" type="number" value={f.tax_year} onChange={set('tax_year')} /></div>
      </div>
      <div className="wiz-row">
        <div className="wiz-field"><label className="lbl">Filing deadline</label><input className="tm-input" type="date" value={f.filing_deadline || autoDeadline} onChange={set('filing_deadline')} /><span className="hint">Defaults from filing type + tax year.</span></div>
        <div className="wiz-field"><label className="lbl">Project start</label><input className="tm-input" type="date" value={f.project_start_date} onChange={set('project_start_date')} /><span className="hint">Anchors template due dates.</span></div>
      </div>
      <div className="wiz-row">
        <div className="wiz-field"><label className="lbl">Preparer</label><PeopleSelect value={f.tax_preparer_email} onChange={set('tax_preparer_email')} roles={['PREPARER', 'ADVISOR']} /></div>
        <div className="wiz-field"><label className="lbl">Peer reviewer</label><PeopleSelect value={f.peer_reviewer_email} onChange={set('peer_reviewer_email')} roles={['PEER_REVIEWER', 'ADVISOR']} /></div>
      </div>
      <div className="wiz-row">
        <div className="wiz-field"><label className="lbl">Stage</label>
          <select className="tm-input" value={f.pipeline_status} onChange={set('pipeline_status')}>{enumOptions('PIPELINE_STATUS').filter((o) => o.value !== 'BLOCKED').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        </div>
        <div className="wiz-field"><label className="lbl">Complexity</label>
          <select className="tm-input" value={f.complexity} onChange={set('complexity')}><option value="LOW">Low</option><option value="MED">Medium</option><option value="HIGH">High</option></select>
        </div>
      </div>
      <p className="muted small" style={{ margin: 0 }}>The advisor and OS come from the pro. Active project templates are materialized as tasks.</p>
    </Modal>
  );
}

/* ---------------- CSV import (Asana migration) ---------------- */

export function ImportModal({ defaultKind, onClose }) {
  const admin = useStore((s) => s.user.admin);
  const [kind, setKind] = React.useState(defaultKind || 'pros');
  const [csv, setCsv] = React.useState('');
  const [fileName, setFileName] = React.useState('');
  const [preview, setPreview] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState('');
  const [materialize, setMaterialize] = React.useState(true);
  const [progress, setProgress] = React.useState(null);

  async function onFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setCsv(await readFileText(file));
    setPreview(null); setResult(null);
  }
  async function doPreview() {
    setBusy(true); setError('');
    try { setPreview(await api('importPreview', { kind, csv })); } catch (e) { setError(e.message); }
    setBusy(false);
  }
  async function doApply() {
    setBusy(true); setError('');
    try {
      let total = { created: 0, updated: 0, tasks: 0, items: 0, pros_created: 0, errors: [] };
      let offset = 0;
      setProgress({ processed: 0, total: preview.creates + preview.updates });
      for (;;) {
        // Each call works for up to ~4 minutes (Apps Script's limit is 6), then we continue where it stopped.
        const r = await api('importApply', { kind, csv, options: { materialize, offset } });
        total = {
          created: total.created + r.created, updated: total.updated + r.updated, tasks: total.tasks + (r.tasks || 0),
          items: total.items + (r.items || 0), pros_created: total.pros_created + (r.pros_created || 0), errors: [...total.errors, ...r.errors],
        };
        setProgress({ processed: r.processed, total: r.total });
        if (r.next_offset == null) break;
        offset = r.next_offset;
      }
      setResult(total);
      refreshAll();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  if (!admin) {
    return (
      <Modal title="Import" onClose={onClose}>
        <p>Imports are limited to EXEC / ADMIN roles. Ask an admin to run the Asana migration.</p>
      </Modal>
    );
  }
  return (
    <Modal title="Import from CSV (Asana export)" onClose={onClose} width={720}
      footer={result
        ? <button className="btn primary" onClick={onClose}>Done</button>
        : <>
          <button className="btn subtle" onClick={onClose}>Cancel</button>
          {!preview
            ? <button className="btn primary" disabled={!csv || busy} onClick={doPreview}>{busy ? 'Reading…' : 'Preview'}</button>
            : <button className="btn primary" disabled={busy || (preview.creates + preview.updates === 0)} onClick={doApply}>{busy ? (progress ? `Importing ${progress.processed} of ${progress.total}…` : 'Importing…') : `Import ${preview.creates + preview.updates} rows`}</button>}
        </>}>
      <div className="tm-seg" style={{ marginBottom: 12 }}>
        <button className={cx(kind === 'pros' && 'on')} onClick={() => { setKind('pros'); setPreview(null); }}>Pros</button>
        <button className={cx(kind === 'projects' && 'on')} onClick={() => { setKind('projects'); setPreview(null); }}>Projects</button>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>
        Export the Asana project as CSV (… → Export → CSV) and drop it here. Columns are matched by name — e.g. <span className="mono">Org ID</span>, <span className="mono">Name</span>, <span className="mono">Filing Type</span>, <span className="mono">Return Stage</span>, <span className="mono">Extension Needed?</span>, <span className="mono">Assignee Email</span>. Rows update existing records by Org ID / project, and create the rest. Import pros before projects.
      </p>
      {!result && (
        <label className="wb-drop" style={{ padding: 20, display: 'block' }}>
          <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={onFile} />
          <div className="wb-drop-title">{fileName || 'Choose a CSV file'}</div>
          <div className="wb-drop-sub">{csv ? (csv.split('\n').length - 1) + ' rows read' : 'or click to browse'}</div>
        </label>
      )}
      {kind === 'projects' && !result && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: 13 }}>
          <input type="checkbox" checked={materialize} onChange={(e) => setMaterialize(e.target.checked)} />
          Create template tasks on new projects (sections before the current stage are marked done)
        </label>
      )}
      {busy && progress && (
        <div style={{ marginTop: 12 }}>
          <ProgressBar pct={progress.total ? Math.round((progress.processed / progress.total) * 100) : 0} />
          <div className="muted small" style={{ marginTop: 4 }}>Importing {progress.processed} of {progress.total}. Large files take several minutes; keep this tab open.</div>
        </div>
      )}
      {error && <div className="flash error" style={{ marginTop: 12 }}><Icon name="alert" size={14} /> {error}</div>}
      {preview && !result && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <span className="pill pp-COMPLETE">{preview.creates} new</span>
            <span className="pill pp-DOC_GATHERING">{preview.updates} updates</span>
            {preview.error_count > 0 && <span className="pill pp-BLOCKED">{preview.error_count} skipped</span>}
          </div>
          <div className="small"><strong>Matched columns:</strong> {preview.mapped.map((m) => `${m.column} → ${m.field}`).join(', ') || 'none'}</div>
          {preview.unmapped.length > 0 && <div className="small muted" style={{ marginTop: 4 }}><strong>Ignored:</strong> {preview.unmapped.join(', ')}</div>}
          {preview.errors.length > 0 && (
            <div className="wb-warn" style={{ marginTop: 8, display: 'block' }}>{preview.errors.slice(0, 8).map((e, i) => <div key={i}>{e}</div>)}</div>
          )}
        </div>
      )}
      {result && (
        <div className="flash success" style={{ display: 'block' }}>
          <strong>Import complete.</strong> {result.created} created · {result.updated} updated{result.pros_created ? ' · ' + result.pros_created + ' missing pros created' : ''}{result.tasks ? ' · ' + result.tasks + ' tasks' : ''}{result.items ? ' · ' + result.items + ' outstanding items' : ''}.
          {result.errors.length > 0 && <div style={{ marginTop: 6 }}>{result.errors.length} rows skipped: {result.errors.slice(0, 5).join('; ')}</div>}
        </div>
      )}
    </Modal>
  );
}
