/* Home, My Tasks, Templates, Archive, Inbox. */
import React from 'react';
import { Icon, Avatar, Pill, SavedTick, MoreMenu, Modal, Empty, Person, confirmDialog, askText } from './ui.jsx';
import { useStore, toggleTask, claimInbox, dismissInbox, restoreRecord, api, toast, flash, mutate } from './store.js';
import { navigate } from './router.js';
import { openRecord } from './nav.js';
import { dueClass, fmtDue, daysFromToday, greeting, today, sectionLabel, label, ROLE_LABELS, ANCHOR_LABELS, relTime, fmtTsShort, initialsOf, cx } from './util.js';

/* ---------------- Home ---------------- */

export function Home() {
  const user = useStore((s) => s.user);
  const pros = useStore((s) => s.pros);
  const projects = useStore((s) => s.projects);
  const myTasks = useStore((s) => s.myTasks);
  const inbox = useStore((s) => s.inbox);
  const prefs = useStore((s) => s.prefs);
  const open = myTasks.filter((t) => t.status !== 'DONE');
  const overdue = open.filter((t) => dueClass(t.due_date) === 'overdue');
  const dueToday = open.filter((t) => dueClass(t.due_date) === 'today');
  const myProjects = projects.filter((p) => !p.archived && p.pipeline_status !== 'COMPLETE' && [p.tax_advisor_email, p.tax_preparer_email, p.peer_reviewer_email, p.os_email].includes(user.email));
  const newThisWeek = myProjects.filter((p) => p.created_at && daysFromToday(String(p.created_at).slice(0, 10)) >= -7).length;
  const myPros = pros.filter((p) => !p.archived && [p.assigned_advisor_email, p.assigned_os_email, p.bk_lead_email].includes(user.email));
  const visited = ((prefs.recently_visited || {}).pros || []).map((id) => pros.find((p) => p.org_id === id)).filter(Boolean);
  const side = myPros.length ? { title: 'My pros', list: myPros.slice(0, 5) } : { title: 'Recently visited', list: visited.slice(0, 5) };
  const next = open.slice().sort((a, b) => (a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1).slice(0, 6);
  const d = new Date(today() + 'T12:00:00');

  return (
    <div data-screen-label="Home">
      <div className="home-greet">{greeting()}, {user.name.split(' ')[0]}.</div>
      <p className="home-sub">
        It's {d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}. {overdue.length} task{overdue.length === 1 ? '' : 's'} overdue · {dueToday.length} due today.
      </p>
      <div className="home-stat-grid">
        <div className="home-stat tm-click" onClick={() => navigate({ view: 'my-tasks' })}>
          <div className="label">My tasks today</div><div className="val">{dueToday.length}</div>
          <div className={'delta ' + (overdue.length ? 'down' : 'muted')}>{overdue.length} overdue</div>
        </div>
        <div className="home-stat tm-click" onClick={() => navigate({ view: 'projects', savedView: 'my' })}>
          <div className="label">Open projects assigned</div><div className="val">{myProjects.length}</div>
          <div className={'delta ' + (newThisWeek ? 'up' : 'muted')}>{newThisWeek ? '+' + newThisWeek + ' this week' : 'none new this week'}</div>
        </div>
        <div className="home-stat tm-click" onClick={() => navigate({ view: 'pros', savedView: 'risk' })}>
          <div className="label">Pros at risk</div><div className="val">{pros.filter((p) => p.at_risk && !p.archived).length}</div>
          <div className="delta muted">across team</div>
        </div>
        <div className="home-stat tm-click" onClick={() => navigate({ view: 'inbox' })}>
          <div className="label">Inbox · new cases</div><div className="val">{inbox.length}</div>
          <div className={'delta ' + (inbox.length ? 'up' : 'muted')}>awaiting claim</div>
        </div>
      </div>
      <div className="home-grid">
        <div className="home-card">
          <div className="home-card-head">
            <div className="title">My tasks · next up</div>
            <button className="btn subtle sm" onClick={() => navigate({ view: 'my-tasks' })}>View all <Icon name="chevron-right" size={12} /></button>
          </div>
          <table className="tbl">
            <colgroup><col style={{ width: 36 }} /><col /><col style={{ width: 180 }} /><col style={{ width: 120 }} /></colgroup>
            <tbody>
              {next.map((t) => (
                <tr key={t.task_id} onClick={() => openTaskParent(t)}>
                  <td><span className="cell"><button className={'tk-check' + (t.status === 'DONE' ? ' done' : '')} onClick={(e) => { e.stopPropagation(); toggleTask(t); }}>{t.status === 'DONE' && <Icon name="check" size={11} />}</button></span></td>
                  <td><span className="cell"><span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontWeight: 500 }}>{t.title} <SavedTick savedKey={'task:' + t.task_id} /></span>
                    <span className="muted small">{t.biz} · {sectionLabel(t.section)}</span>
                  </span></span></td>
                  <td><span className="cell muted small">{t.context}</span></td>
                  <td><span className={'cell mono ' + dueClass(t.due_date)}>{fmtDue(t.due_date) || '—'}</span></td>
                </tr>
              ))}
              {!next.length && <tr><td colSpan="4"><div className="muted" style={{ padding: 24, textAlign: 'center' }}>🎉 Nothing assigned to you right now.</div></td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="home-card">
            <div className="home-card-head"><div className="title">{side.title}</div></div>
            <div style={{ padding: 8 }}>
              {side.list.map((p) => (
                <a key={p.org_id} className="sb-item" onClick={() => openRecord('pro', p.org_id)} style={{ height: 'auto', padding: '8px 10px' }}>
                  <span className="av" style={{ background: 'var(--primary-main)', color: '#fff' }}>{initialsOf(p.business_name)}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.business_name}</span>
                    <span className="muted small">{[p.state, p.vertical].filter(Boolean).join(' · ') || 'Org ' + p.org_id}</span>
                  </span>
                  <Pill kind="lifecycle" value={p.lifecycle_status} />
                </a>
              ))}
              {!side.list.length && <div className="muted small" style={{ padding: 12 }}>Pros you open show up here.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function openTaskParent(t) {
  if (t.entity_type === 'PROJECT') openRecord('project', t.entity_id);
  else openRecord('pro', t.entity_id);
}

/* ---------------- My Tasks ---------------- */

export function MyTasks() {
  const tasks = useStore((s) => s.myTasks);
  const [sortBy, setSortBy] = React.useState('due');
  const [q, setQ] = React.useState('');
  const filtered = tasks.filter((t) => !q || (t.title + ' ' + t.biz).toLowerCase().includes(q.toLowerCase()));
  const sorter = sortBy === 'due'
    ? (a, b) => ((a.due_date || '9999') < (b.due_date || '9999') ? -1 : (a.due_date || '9999') > (b.due_date || '9999') ? 1 : 0)
    : (a, b) => String(a.biz).localeCompare(String(b.biz));
  const buckets = [
    { key: 'overdue', name: 'Overdue', cls: 'overdue', filter: (t) => t.status !== 'DONE' && dueClass(t.due_date) === 'overdue' },
    { key: 'today', name: 'Today', cls: 'today', filter: (t) => t.status !== 'DONE' && dueClass(t.due_date) === 'today' },
    { key: 'week', name: 'This week', cls: '', filter: (t) => { const d = daysFromToday(t.due_date); return t.status !== 'DONE' && d != null && d > 0 && d <= 7; } },
    { key: 'later', name: 'Later', cls: '', filter: (t) => { const d = daysFromToday(t.due_date); return t.status !== 'DONE' && (d == null || d > 7); } },
    { key: 'done', name: 'Completed (last 14 days)', cls: '', filter: (t) => t.status === 'DONE' },
  ];
  const openCount = tasks.filter((t) => t.status !== 'DONE').length;
  return (
    <div data-screen-label="My Tasks">
      <div className="ph">
        <div>
          <div className="ph-title"><Icon name="check-circle" size={22} /> My Tasks</div>
          <div className="ph-meta">All open tasks assigned to you across pros and projects. {openCount} open.</div>
        </div>
        <div className="ph-actions">
          <span className="tb-search" style={{ width: 240 }}><Icon name="search" size={14} /><input placeholder="Filter tasks…" value={q} onChange={(e) => setQ(e.target.value)} /></span>
          <button className="btn" onClick={() => setSortBy(sortBy === 'due' ? 'pro' : 'due')}><Icon name="sort" size={14} /> Sort: {sortBy === 'due' ? 'due date' : 'pro'}</button>
        </div>
      </div>
      <div className="view-tabs">
        <button className="view-tab active"><Icon name="list" size={14} /> List</button>
        <button className="view-tab" disabled><Icon name="calendar" size={14} /> Calendar <span className="badge">soon</span></button>
        <button className="view-tab" disabled><Icon name="kanban" size={14} /> Board <span className="badge">soon</span></button>
      </div>
      {buckets.map((b) => {
        const items = filtered.filter(b.filter).sort(sorter);
        if (items.length === 0 && b.key !== 'today') return null;
        return <Bucket key={b.key} name={b.name} cls={b.cls} items={items} defaultOpen={b.key !== 'done' && b.key !== 'later'} />;
      })}
    </div>
  );
}

function Bucket({ name, cls, items, defaultOpen }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="bucket">
      <div className="bucket-head" onClick={() => setOpen(!open)}>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
        <span className={'name ' + cls}>{name}</span>
        <span className="count">{items.length}</span>
      </div>
      {open && items.length > 0 && items.map((t) => (
        <div key={t.task_id} className={'tk-row' + (t.status === 'DONE' ? ' done' : '')}
          style={{ gridTemplateColumns: '18px minmax(0, 1fr) minmax(140px, 260px) 90px 28px', gap: '10px' }}
          onClick={() => openTaskParent(t)}>
          <span className="expand" />
          <span className="tk-title">
            <button className={'tk-check' + (t.status === 'DONE' ? ' done' : '')} onClick={(e) => { e.stopPropagation(); toggleTask(t); }}>
              {t.status === 'DONE' && <Icon name="check" size={11} />}
            </button>
            <span className="text">{t.title}</span>
            <SavedTick savedKey={'task:' + t.task_id} />
            {t.blocked_count > 0 && <span className="badge-blocked">blocked by {t.blocked_count}</span>}
          </span>
          <span style={{ fontSize: 12, color: 'var(--fg-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.biz} <span className="muted">· {t.entity_type === 'PROJECT' ? t.context + ' · ' : ''}{sectionLabel(t.section)}</span>
          </span>
          <span className={'tk-due ' + (t.status !== 'DONE' ? dueClass(t.due_date) : '')}>{fmtDue(t.due_date) || '—'}</span>
          <span />
        </div>
      ))}
      {open && items.length === 0 && <div style={{ padding: '20px 16px', color: 'var(--fg-secondary)', fontSize: 13, textAlign: 'center' }}>🎉 Nothing scheduled for {name.toLowerCase()}.</div>}
    </div>
  );
}

/* ---------------- Templates ---------------- */

const SECTIONS_BY_SCOPE = {
  PRO: ['ONBOARDING_SETUP', 'RETURN_PREP_KICKOFF', 'ADVISORY_WORK'],
  PROJECT: ['DOC_GATHERING', 'EXTENSION', 'PREP', 'INTERNAL_REVIEW_QC', 'CLIENT_REVIEW', 'FILING_DELIVERY'],
};

export function Templates() {
  const admin = useStore((s) => s.user.admin);
  const [scope, setScope] = React.useState('PROJECT');
  const [data, setData] = React.useState(null);
  const [counts, setCounts] = React.useState({});
  const [section, setSection] = React.useState(null);
  const [editing, setEditing] = React.useState(null);
  const [showVersions, setShowVersions] = React.useState(false);
  const [preview, setPreview] = React.useState(null);
  const [err, setErr] = React.useState('');

  const load = React.useCallback(async () => {
    setErr('');
    try {
      const d = await api('getTemplates', { scope });
      setData(d); setCounts(d.counts);
    } catch (e) { setErr(e.message); }
  }, [scope]);
  React.useEffect(() => { setData(null); load(); }, [load]);

  const templates = data ? data.templates : [];
  const sections = [...new Set([...SECTIONS_BY_SCOPE[scope], ...templates.map((t) => t.section)])];
  const top = templates.filter((t) => !t.parent_template_id);
  const childrenOf = (id) => templates.filter((t) => t.parent_template_id === id);

  async function save(t) {
    try {
      const row = await mutate({ label: 'template', what: t.title, action: 'saveTemplate', payload: { template: { ...t, scope } } });
      setData((d) => ({ ...d, templates: t.template_id ? d.templates.map((x) => (x.template_id === row.template_id ? row : x)) : [...d.templates, row].sort((a, b) => a.sort_order - b.sort_order) }));
      setEditing(null);
    } catch (e) { /* toast */ }
  }
  async function remove(t) {
    if (!(await confirmDialog('Delete template task "' + t.title + '"?', { message: 'Existing pros/projects keep their tasks. New ones won\'t get it.', ok: 'Delete', danger: true }))) return;
    try {
      await mutate({ label: 'template', what: t.title, action: 'deleteTemplate', payload: { template_id: t.template_id } });
      setData((d) => ({ ...d, templates: d.templates.filter((x) => x.template_id !== t.template_id) }));
    } catch (e) { /* toast */ }
  }
  async function publish() {
    const note = await askText('Publish a new template version', { message: 'Snapshots the current active tasks. New pros/projects record which version they came from.', placeholder: 'What changed? (optional)', ok: 'Publish' });
    if (note === null) return;
    try {
      const res = await mutate({ label: 'template version', what: 'version', action: 'publishTemplates', payload: { scope, note } });
      setData((d) => ({ ...d, versions: res.versions }));
      toast('success', 'Published v' + res.version);
    } catch (e) { /* toast */ }
  }
  async function showPreview() {
    try { setPreview(await api('previewTemplates', { scope, filing_type: 'F1040_SCHC' })); } catch (e) { toast('error', e.message); }
  }
  const [dragId, setDragId] = React.useState(null);
  async function dropOn(target) {
    const moving = templates.find((t) => t.template_id === dragId);
    setDragId(null);
    if (!moving || moving.template_id === target.template_id) return;
    const ids = templates.map((t) => t.template_id).filter((id) => id !== moving.template_id);
    ids.splice(ids.indexOf(target.template_id), 0, moving.template_id);
    const reordered = ids.map((id, i) => ({ ...templates.find((t) => t.template_id === id), sort_order: i, section: id === moving.template_id ? target.section : templates.find((t) => t.template_id === id).section }));
    const prev = templates;
    setData((d) => ({ ...d, templates: reordered }));
    try {
      if (moving.section !== target.section) await api('saveTemplate', { template: { ...moving, section: target.section, scope } });
      await mutate({ label: 'template order', what: 'order', action: 'reorderTemplates', payload: { scope, ids } });
    } catch (e) { setData((d) => ({ ...d, templates: prev })); }
  }

  const current = data && data.versions[0];
  return (
    <div data-screen-label="Templates">
      <div className="ph">
        <div>
          <div className="ph-title"><Icon name="template" size={22} /> Task templates</div>
          <div className="ph-meta">Master task lists that materialize onto every new pro and project. Edit here — applies on next creation.{!admin && ' (View only — EXEC / ADMIN can edit.)'}</div>
        </div>
        <div className="ph-actions">
          <button className="btn" onClick={() => setShowVersions(true)}><Icon name="history" size={14} /> Version history</button>
          <button className="btn" onClick={showPreview}><Icon name="eye" size={14} /> Preview materialization</button>
          {admin && <button className="btn" onClick={publish}><Icon name="check-circle" size={14} /> Publish version</button>}
          {admin && <button className="btn primary" onClick={() => setEditing({ section: section || sections[0], title: '', default_role: scope === 'PRO' ? 'OS' : 'PREPARER', due_anchor: scope === 'PRO' ? 'CLAIMED_AT' : 'PROJECT_START', offset_days: 0, active: true })}><Icon name="plus" size={14} /> Add task</button>}
        </div>
      </div>
      <div className="view-tabs">
        <button className={'view-tab' + (scope === 'PRO' ? ' active' : '')} onClick={() => { setScope('PRO'); setSection(null); }}><Icon name="users" size={14} /> Pro templates <span className="badge">{counts.PRO ?? '…'}</span></button>
        <button className={'view-tab' + (scope === 'PROJECT' ? ' active' : '')} onClick={() => { setScope('PROJECT'); setSection(null); }}><Icon name="briefcase" size={14} /> Project templates <span className="badge">{counts.PROJECT ?? '…'}</span></button>
      </div>
      {err && <div className="flash error"><Icon name="alert" size={14} /> {err}</div>}
      <div className="tmpl-shell">
        <div className="tmpl-side">
          <div className="grp-title">Sections</div>
          {sections.map((s) => (
            <div key={s} className={'item' + (section === s ? ' active' : '')} onClick={() => setSection(section === s ? null : s)}>
              <Icon name="folder" size={14} /><span>{sectionLabel(s)}</span><span className="cnt">{templates.filter((t) => t.section === s).length}</span>
            </div>
          ))}
          <div style={{ height: 8 }} />
          <div className="grp-title">Versioning</div>
          {(data ? data.versions : []).slice(0, 4).map((v, i) => (
            <div key={v.version_id} className={'item' + (i ? ' muted' : '')} title={v.note || ''}>
              {i === 0 ? <Icon name="circle" size={10} style={{ color: 'var(--success-main)' }} /> : <Icon name="history" size={14} />}
              <span>v{v.version}{i === 0 ? ' · current' : ' (' + new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) + ')'}</span>
            </div>
          ))}
        </div>
        <div className="tmpl-main">
          {!data && !err && <div className="muted" style={{ padding: 24 }}>Loading templates…</div>}
          {data && (
            <table className="tmpl-tbl">
              <thead><tr><th style={{ width: 26 }} /><th>Title</th><th style={{ width: 130 }}>Default role</th><th style={{ width: 170 }}>Due anchor</th><th style={{ width: 80 }}>Offset</th><th style={{ width: 80 }}>Active</th><th style={{ width: 32 }} /></tr></thead>
              <tbody>
                {sections.filter((s) => !section || s === section).map((s) => (
                  <React.Fragment key={s}>
                    <tr className="section-row" onDragOver={(e) => dragId && e.preventDefault()}>
                      <td colSpan="7"><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="chevron-down" size={11} /> {sectionLabel(s)}
                        <span className="cnt" style={{ background: '#fff', color: 'var(--fg-secondary)', fontSize: 11, padding: '1px 7px', borderRadius: 999 }}>{templates.filter((t) => t.section === s).length}</span></span></td>
                    </tr>
                    {top.filter((t) => t.section === s).map((t) => (
                      <React.Fragment key={t.template_id}>
                        <TemplateRow t={t} admin={admin} onEdit={setEditing} onDelete={remove} onToggle={() => save({ ...t, active: !t.active })}
                          drag={{ start: () => setDragId(t.template_id), over: (e) => dragId && e.preventDefault(), drop: () => dropOn(t) }} />
                        {childrenOf(t.template_id).map((c) => <TemplateRow key={c.template_id} t={c} child admin={admin} onEdit={setEditing} onDelete={remove} onToggle={() => save({ ...c, active: !c.active })} drag={{}} />)}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {editing && <TemplateEditor scope={scope} t={editing} sections={sections} templates={templates} onClose={() => setEditing(null)} onSave={save} />}
      {showVersions && (
        <Modal title={'Version history — ' + (scope === 'PRO' ? 'Pro' : 'Project') + ' templates'} onClose={() => setShowVersions(false)}>
          <table className="tmpl-tbl">
            <thead><tr><th>Version</th><th>Published</th><th>By</th><th>Tasks</th><th>Note</th></tr></thead>
            <tbody>
              {(data ? data.versions : []).map((v) => (
                <tr key={v.version_id}><td className="mono">v{v.version}</td><td className="mono small">{fmtTsShort(v.created_at)}</td><td><Avatar email={v.created_by} /></td><td className="mono">{v.task_count}</td><td className="muted small">{v.note}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">Current: v{current ? current.version : 0}. Edits since the last publish apply immediately to new records; publishing records a snapshot.</p>
        </Modal>
      )}
      {preview && (
        <Modal title={'Preview — tasks a new ' + (scope === 'PRO' ? 'pro' : 'project') + ' gets'} onClose={() => setPreview(null)} width={640}>
          <table className="tmpl-tbl">
            <thead><tr><th>Section</th><th>Task</th><th>Role</th><th>Due</th></tr></thead>
            <tbody>
              {preview.map((t) => (
                <tr key={t.template_id}><td className="muted small">{sectionLabel(t.section)}</td><td>{t.parent_template_id ? '↳ ' : ''}{t.title}</td><td>{ROLE_LABELS[t.default_role] || t.default_role}</td><td className="muted small">{ANCHOR_LABELS[t.due_anchor] || t.due_anchor} {t.offset_days >= 0 ? '+' : ''}{t.offset_days}d</td></tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}

function TemplateRow({ t, child, admin, onEdit, onDelete, onToggle, drag }) {
  return (
    <tr draggable={admin && !child} onDragStart={drag.start} onDragOver={drag.over} onDrop={drag.drop} className={t.active ? '' : 'inactive'}>
      <td>{!child && <Icon name="drag" size={14} style={{ color: 'var(--grey-400)', cursor: admin ? 'grab' : 'default' }} />}</td>
      <td onClick={() => admin && onEdit(t)} style={{ cursor: admin ? 'pointer' : 'default' }}>
        <div style={{ fontWeight: 500, paddingLeft: child ? 20 : 0 }}>{child ? '↳ ' : ''}{t.title}</div>
        {t.checklist && t.checklist.length > 0 && <div className="muted small" style={{ marginTop: 2 }}><span className="badge-checklist" style={{ background: 'var(--ai-light)', color: 'var(--ai-dark)', padding: '1px 6px', borderRadius: 4, fontSize: 10.5, fontWeight: 600 }}>checklist · {t.checklist.length} items</span></div>}
        {t.filing_types && <div className="muted small">only: {String(t.filing_types).split(/[,\s]+/).map((f) => label('FILING_TYPE', f)).join(', ')}</div>}
      </td>
      <td><span className="pill" style={{ background: 'var(--grey-100)' }}>{ROLE_LABELS[t.default_role] || t.default_role || '—'}</span></td>
      <td className="muted small">{ANCHOR_LABELS[t.due_anchor] || String(t.due_anchor || '').replace(/_/g, ' ').toLowerCase()}</td>
      <td className="mono">{t.offset_days >= 0 ? '+' : ''}{t.offset_days || 0}d</td>
      <td>
        <button className="tm-toggle-btn" disabled={!admin} onClick={onToggle}>
          {t.active ? <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12, color: 'var(--success-dark)' }}><Icon name="check" size={12} /> active</span> : <span className="muted small">off</span>}
        </button>
      </td>
      <td>{admin && <MoreMenu btnClass="tb-icon-btn" items={[{ label: 'Edit', icon: 'edit', onClick: () => onEdit(t) }, { label: 'Delete', icon: 'trash', danger: true, onClick: () => onDelete(t) }]} />}</td>
    </tr>
  );
}

function TemplateEditor({ scope, t, sections, templates, onClose, onSave }) {
  const [f, setF] = React.useState({ ...t, checklistText: (t.checklist || []).map((c) => (typeof c === 'string' ? c : c.label)).join('\n') });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const anchors = scope === 'PRO' ? ['CLAIMED_AT', 'NONE'] : ['PROJECT_START', 'FILING_DEADLINE', 'EFILE_DATE', 'NONE'];
  const roles = scope === 'PRO' ? ['OS', 'ADVISOR', 'BK_LEAD'] : ['PREPARER', 'ADVISOR', 'PEER_REVIEWER', 'OS', 'BK'];
  const parents = templates.filter((x) => !x.parent_template_id && x.template_id !== t.template_id && x.section === f.section);
  function submit() {
    const out = {
      template_id: f.template_id, section: f.section, title: f.title.trim(), default_role: f.default_role, due_anchor: f.due_anchor,
      offset_days: Number(f.offset_days) || 0, active: !!f.active, filing_types: f.filing_types || '', parent_template_id: f.parent_template_id || '',
      checklist: f.checklistText.split('\n').map((s) => s.trim()).filter(Boolean),
    };
    if (!out.checklist.length) out.checklist = null;
    onSave(out);
  }
  return (
    <Modal title={t.template_id ? 'Edit template task' : 'New template task'} onClose={onClose} width={600}
      footer={<><button className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!f.title.trim()} onClick={submit}>Save</button></>}>
      <div className="wiz-field"><label className="lbl">Title</label><input className="tm-input" autoFocus value={f.title} onChange={set('title')} /></div>
      <div className="wiz-row">
        <div className="wiz-field"><label className="lbl">Section</label>
          <select className="tm-input" value={f.section} onChange={set('section')}>{sections.map((s) => <option key={s} value={s}>{sectionLabel(s)}</option>)}</select>
        </div>
        <div className="wiz-field"><label className="lbl">Default role</label>
          <select className="tm-input" value={f.default_role || ''} onChange={set('default_role')}><option value="">None</option>{roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
        </div>
      </div>
      <div className="wiz-row">
        <div className="wiz-field"><label className="lbl">Due anchor</label>
          <select className="tm-input" value={f.due_anchor || 'NONE'} onChange={set('due_anchor')}>{anchors.map((a) => <option key={a} value={a}>{ANCHOR_LABELS[a]}</option>)}</select>
        </div>
        <div className="wiz-field"><label className="lbl">Offset (days)</label><input className="tm-input mono" type="number" value={f.offset_days} onChange={set('offset_days')} /><span className="hint">Negative = before the anchor.</span></div>
      </div>
      <div className="wiz-row">
        <div className="wiz-field"><label className="lbl">Subtask of</label>
          <select className="tm-input" value={f.parent_template_id || ''} onChange={set('parent_template_id')}><option value="">— top-level task —</option>{parents.map((p) => <option key={p.template_id} value={p.template_id}>{p.title}</option>)}</select>
        </div>
        {scope === 'PROJECT' && (
          <div className="wiz-field"><label className="lbl">Only for filing types</label><input className="tm-input" value={f.filing_types || ''} onChange={set('filing_types')} placeholder="blank = all (e.g. S_CORP, PARTNERSHIP)" /></div>
        )}
      </div>
      <div className="wiz-field"><label className="lbl">Checklist items (one per line — optional)</label><textarea className="tm-input" rows={4} value={f.checklistText} onChange={set('checklistText')} /></div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={!!f.active} onChange={set('active')} /> Active (materializes on new records)</label>
    </Modal>
  );
}

/* ---------------- Archive ---------------- */

export function Archive() {
  const allPros = useStore((s) => s.pros);
  const allProjects = useStore((s) => s.projects);
  const pros = React.useMemo(() => allPros.filter((p) => p.archived), [allPros]);
  const projects = React.useMemo(() => allProjects.filter((p) => p.archived), [allProjects]);
  const [scope, setScope] = React.useState('pros');
  return (
    <div data-screen-label="Archive">
      <div className="ph">
        <div>
          <div className="ph-title"><Icon name="archive" size={22} /> Archive</div>
          <div className="ph-meta">Soft-archived pros and projects. Restore brings them back to active views.</div>
        </div>
      </div>
      <div className="view-tabs">
        <button className={'view-tab' + (scope === 'pros' ? ' active' : '')} onClick={() => setScope('pros')}><Icon name="users" size={14} /> Pros <span className="badge">{pros.length}</span></button>
        <button className={'view-tab' + (scope === 'projects' ? ' active' : '')} onClick={() => setScope('projects')}><Icon name="briefcase" size={14} /> Projects <span className="badge">{projects.length}</span></button>
      </div>
      {scope === 'pros' && (pros.length ? (
        <div className="table-wrap">
          <table className="tbl">
            <colgroup><col style={{ width: 100 }} /><col style={{ width: 260 }} /><col style={{ width: 170 }} /><col style={{ width: 130 }} /><col style={{ width: 70 }} /><col /><col style={{ width: 110 }} /></colgroup>
            <thead><tr><th>Org ID</th><th>Business</th><th>Last status</th><th>Archived</th><th>By</th><th>Reason</th><th /></tr></thead>
            <tbody>
              {pros.map((p) => (
                <tr key={p.org_id} className="archived" onClick={() => openRecord('pro', p.org_id)}>
                  <td><span className="cell cell-id">{p.org_id}</span></td>
                  <td><span className="cell">{p.business_name}</span></td>
                  <td><span className="cell"><Pill kind="lifecycle" value={p.lifecycle_status} /></span></td>
                  <td><span className="cell mono">{String(p.archived_at || '').slice(0, 10)}</span></td>
                  <td><span className="cell"><Avatar email={p.archived_by} /></span></td>
                  <td><span className="cell muted">{p.archive_reason}</span></td>
                  <td><span className="cell"><button className="btn sm" onClick={(e) => { e.stopPropagation(); restoreRecord('pro', p).then(() => toast('success', 'Restored ' + p.business_name)).catch(() => {}); }}>Restore</button></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="tm-empty-card"><Empty icon="archive" title="No archived pros">Archive a pro from its detail page (… menu) and it shows up here.</Empty></div>)}
      {scope === 'projects' && (projects.length ? (
        <div className="table-wrap">
          <table className="tbl">
            <colgroup><col style={{ width: 280 }} /><col style={{ width: 170 }} /><col style={{ width: 130 }} /><col style={{ width: 70 }} /><col /><col style={{ width: 110 }} /></colgroup>
            <thead><tr><th>Project</th><th>Last stage</th><th>Archived</th><th>By</th><th>Reason</th><th /></tr></thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.project_id} className="archived" onClick={() => openRecord('project', p.project_id)}>
                  <td><span className="cell"><span style={{ display: 'flex', flexDirection: 'column' }}><span>{p.business_name}</span><span className="cell-id">{p.project_id}</span></span></span></td>
                  <td><span className="cell"><Pill kind="pipeline" value={p.pipeline_status} /></span></td>
                  <td><span className="cell mono">{String(p.archived_at || '').slice(0, 10)}</span></td>
                  <td><span className="cell"><Avatar email={p.archived_by} /></span></td>
                  <td><span className="cell muted">{p.archive_reason}</span></td>
                  <td><span className="cell"><button className="btn sm" onClick={(e) => { e.stopPropagation(); restoreRecord('project', p).then(() => toast('success', 'Restored ' + p.project_id)).catch(() => {}); }}>Restore</button></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="tm-empty-card"><Empty icon="archive" title="No archived projects yet">When you archive a project from its detail page, it'll show up here.</Empty></div>)}
    </div>
  );
}

/* ---------------- Inbox ---------------- */

export function Inbox() {
  const inbox = useStore((s) => s.inbox);
  const pros = useStore((s) => s.pros);
  const lastSync = useStore((s) => s.config.sfdc_last_sync);
  const [claiming, setClaiming] = React.useState(null);
  const [recent, setRecent] = React.useState(null);

  async function claim(o) {
    setClaiming(o.sfdc_opportunity_id);
    try {
      await claimInbox(o);
      flash('success', `Claimed ${o.business_name} (case ${o.sfdc_opportunity_id}) — onboarding tasks created, wizard ready.`);
      navigate({ view: 'intake', id: o.org_id });
    } catch (e) {
      setClaiming(null);
    }
  }
  async function showRecent() {
    try { setRecent(await api('recentlyClaimed')); } catch (e) { toast('error', e.message); }
  }

  return (
    <div data-screen-label="Inbox">
      <div className="ph">
        <div>
          <div className="ph-title">
            <Icon name="inbox" size={22} /> Inbox
            <span className="pill" style={{ background: 'var(--primary-50)', color: 'var(--primary-dark)' }}>{inbox.length} new case{inbox.length === 1 ? '' : 's'}</span>
          </div>
          <div className="ph-meta">New tax onboarding cases from Salesforce created in {new Date().getFullYear()} or later (syncs every 4h). A Pro record is auto-created per new Org ID; claim one to run onboarding.</div>
        </div>
        <div className="ph-actions">
          <span className="sync-pill" title="Salesforce sheet feed"><span className="dot" /> {lastSync ? 'Synced ' + relTime(lastSync) : 'Not synced yet'}</span>
          <button className="btn" onClick={showRecent}><Icon name="history" size={14} /> Recently claimed</button>
        </div>
      </div>
      {inbox.length === 0 && (
        <div className="tm-empty-card"><Empty icon="inbox" title="Inbox zero">No unclaimed onboarding cases. New Salesforce cases appear here after the next sync.</Empty></div>
      )}
      {inbox.map((o) => {
        const pro = pros.find((p) => p.org_id === o.org_id);
        return (
          <div key={o.sfdc_opportunity_id} className="inbox-card">
            <div style={{ minWidth: 0 }}>
              <div className="biz">{o.business_name}</div>
              <div className="meta">
                <span className="mono">Org {o.org_id}</span><span>·</span>
                <span><Icon name="briefcase" size={11} /> Case {o.sfdc_opportunity_id}</span><span>·</span>
                <span><Icon name="users" size={11} /> Owner: {o.case_owner || '—'}</span>
                {o.created_date && <><span>·</span><span className="mono">Created {o.created_date}</span></>}
                {o.service_days != null && <><span>·</span><span><Icon name="clock" size={11} /> {o.service_days}d in onboarding</span></>}
              </div>
              {o.sub_status_notes && <div className="muted small" style={{ marginTop: 6, maxWidth: 640, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.sub_status_notes}><Icon name="file-text" size={11} /> {o.sub_status_notes}</div>}
              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="pill" style={{ background: 'var(--success-light)', color: 'var(--success-dark)' }}><Icon name="check" size={11} /> Pro record created</span>
                {o.resolved_os_email ? <span className="muted small" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>OS: <Person email={o.resolved_os_email} /></span>
                  : <span className="pill pp-WFP" title="Case owner didn't match first.last@ on the roster"><Icon name="flag" size={11} /> OS needs manual assignment</span>}
                {pro && pro.assigned_advisor_email && <span className="muted small" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>Advisor (balanced): <Person email={pro.assigned_advisor_email} /></span>}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <button className="btn primary" disabled={!!claiming} onClick={() => claim(o)}>
                <Icon name="wand" size={14} /> {claiming === o.sfdc_opportunity_id ? 'Claiming…' : 'Claim & start onboarding'}
              </button>
              <span style={{ display: 'flex', gap: 6 }}>
                <button className="btn subtle sm" onClick={() => openRecord('pro', o.org_id)}>View pro</button>
                <button className="btn subtle sm" onClick={async () => { if (await confirmDialog('Dismiss ' + o.business_name + '?', { message: 'The pro record stays; it just leaves the Inbox.', ok: 'Dismiss' })) dismissInbox(o); }}>Dismiss</button>
              </span>
            </div>
          </div>
        );
      })}
      {recent && (
        <Modal title="Recently claimed" onClose={() => setRecent(null)} width={640}>
          <table className="tmpl-tbl">
            <thead><tr><th>Business</th><th>Case</th><th>Claimed by</th><th>When</th></tr></thead>
            <tbody>
              {recent.map((q) => (
                <tr key={q.sfdc_opportunity_id} style={{ cursor: 'pointer' }} onClick={() => { setRecent(null); navigate({ view: 'intake', id: q.org_id }); }}>
                  <td>{q.business_name}</td><td className="mono">{q.sfdc_opportunity_id}</td><td><Person email={q.claimed_by} /></td><td className="muted small">{relTime(q.claimed_at)}</td>
                </tr>
              ))}
              {!recent.length && <tr><td colSpan="4" className="muted">Nothing claimed yet.</td></tr>}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}
