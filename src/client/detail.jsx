/* Pro + Project detail (drawer or full page): header, tabs, overview fields, notes, audit, time & stages. */
import React from 'react';
import {
  Icon, Avatar, Person, PersonName, Pill, ProgressBar, InlineEdit, Field, FieldGroup, MoreMenu, SavedTick,
  askText, confirmDialog, enumOptions, Popover, Empty,
} from './ui.jsx';
import {
  useStore, loadPro, loadProject, updatePro, updateProject, addNote, editNote, deleteNote, toggleStar,
  addOutstanding, resolveOutstanding, deleteOutstanding, startTimer, stopTimer, archiveRecord, restoreRecord,
  toast, mergePro, mutate, getState,
} from './store.js';
import { navigate, patchRoute, getRoute, routeUrl } from './router.js';
import { openRecord } from './nav.js';
import { TaskList } from './tasks.jsx';
import { NewProjectModal } from './lists.jsx';
import { ReviewPanel, ReviewPill, SubmitReviewModal } from './review.jsx';
import {
  label, dueClass, fmtDue, fmtTs, fmtTsShort, relTime, fmtMinutes, fmtElapsed, initialsOf, toCSV, downloadCSV, sectionLabel, cx, safeUrl,
} from './util.js';

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="view-tabs">
      {tabs.map((t) => (
        <button key={t.id} className={'view-tab' + (active === t.id ? ' active' : '')} onClick={() => onChange(t.id)}>
          <Icon name={t.icon} size={14} /> {t.label}{t.badge != null && <span className="badge">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

function useTab(inDrawer, fallback) {
  const r = getRoute();
  const cur = inDrawer ? (r.drawer && r.drawer.tab) : r.tab;
  const set = (tab) => {
    const route = getRoute();
    if (inDrawer) patchRoute({ drawer: { ...route.drawer, tab } }, { replace: true });
    else patchRoute({ tab }, { replace: true });
  };
  return [cur || fallback, set];
}

function copyLink(route) {
  const base = getState().config.url || '';
  const url = routeUrl(route, base);
  if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('success', 'Link copied'), () => toast('error', url));
  else toast('success', url);
}

function LoadState({ state, onRetry }) {
  if (state === true) return <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Loading…</div>;
  if (typeof state === 'string') {
    return (
      <div className="flash error" style={{ margin: 16 }}>
        <Icon name="alert" size={16} /> Couldn't load: {state}
        <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={onRetry}>Retry</button>
      </div>
    );
  }
  return null;
}

/* ================= PRO ================= */

export function ProDetail({ orgId, inDrawer }) {
  const pro = useStore((s) => s.pros.find((p) => p.org_id === orgId));
  const detail = useStore((s) => s.details.pro[orgId]);
  const loading = useStore((s) => s.loading['pro:' + orgId]);
  const starred = useStore((s) => ((s.prefs.starred || {}).pros || []).includes(orgId));
  const [tab, setTab] = useTab(inDrawer, 'tasks');
  const [newProject, setNewProject] = React.useState(false);
  const projects = useProjectsFor(orgId);

  React.useEffect(() => { loadPro(orgId); }, [orgId]);

  if (!pro && !detail) {
    return loading ? <LoadState state={true} /> : <Empty icon="users" title="Pro not found">Org {orgId} isn't in Tax Manager (or was removed).</Empty>;
  }
  const p = { ...(detail ? detail.pro : {}), ...(pro || {}) };
  const tasks = detail ? detail.tasks : [];
  const notes = detail ? detail.notes : [];
  const advisor = p.assigned_advisor_email;

  async function openDrive() {
    if (safeUrl(p.drive_folder_url)) { window.open(safeUrl(p.drive_folder_url), '_blank'); return; }
    try {
      const res = await mutate({ label: 'Drive folder', what: 'Drive folder', action: 'provisionDrive', payload: { org_id: orgId } });
      mergePro(res.pro);
      toast('success', 'Drive folder ready');
      if (safeUrl(res.url)) window.open(safeUrl(res.url), '_blank');
    } catch (e) { /* toast shown */ }
  }
  async function archive() {
    const reason = await askText('Archive ' + p.business_name + '?', { message: 'Archived pros leave active lists and advisor load counts. You can restore from Archive.', placeholder: 'Reason (e.g. churned, duplicate org)', ok: 'Archive', required: true });
    if (!reason) return;
    try { await archiveRecord('pro', p, reason); toast('success', 'Archived ' + p.business_name); } catch (e) { /* handled */ }
  }

  const tabs = [
    { id: 'tasks', label: 'Tasks', icon: 'check-circle', badge: tasks.length },
    { id: 'overview', label: 'Overview', icon: 'file-text' },
    { id: 'intake', label: 'Intake answers', icon: 'wand' },
    { id: 'projects', label: 'Projects', icon: 'briefcase', badge: projects.length },
    { id: 'notes', label: 'Notes', icon: 'file-text', badge: notes.length },
    { id: 'audit', label: 'Audit', icon: 'history' },
  ];

  return (
    <div data-screen-label="Pro detail">
      <div className="ph">
        <div style={{ minWidth: 0 }}>
          <div className="ph-title">
            <span className="av xl" style={{ background: 'var(--primary-main)' }}>{initialsOf(p.business_name)}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.business_name}</span>
                <button className={cx('tb-icon-btn', starred && 'starred')} style={{ width: 28, height: 28 }} title={starred ? 'Unstar' : 'Star'} onClick={() => toggleStar('pro', orgId)}>
                  <Icon name="star" size={16} fill={starred ? 'currentColor' : 'none'} />
                </button>
                <SavedTick savedKey={'pro:' + orgId} />
              </div>
              <div className="ph-meta" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="mono">Org {p.org_id}</span><span>·</span>
                <Pill kind="lifecycle" value={p.lifecycle_status} />
                {p.entity_type && <><span>·</span><span>{label('ENTITY_TYPE', p.entity_type)}</span></>}
                {(p.state || p.vertical) && <><span>·</span><span>{[p.state, p.vertical].filter(Boolean).join(' · ')}</span></>}
                {p.archived && <><span>·</span><span className="pill archived">Archived</span></>}
                {p.needs_os_assignment && <><span>·</span><span className="pill pp-WFP" title="Salesforce case owner didn't match the roster"><Icon name="flag" size={11} /> Assign OS</span></>}
              </div>
            </div>
          </div>
        </div>
        <div className="ph-actions">
          <button className="btn" onClick={openDrive}><Icon name="folder" size={14} /> {p.drive_folder_url ? 'Drive folder' : 'Create Drive folder'}</button>
          <MoreMenu btnClass="btn" items={[
            { label: 'Onboarding wizard', icon: 'wand', onClick: () => navigate({ view: 'intake', id: orgId }) },
            { label: 'Copy link', icon: 'copy', onClick: () => copyLink({ view: 'pro', id: orgId }) },
            p.archived ? { label: 'Restore pro', icon: 'refresh', onClick: () => restoreRecord('pro', p).catch(() => {}) } : { label: 'Archive pro', icon: 'archive', danger: true, onClick: archive },
          ]} />
          <button className="btn primary" onClick={() => setNewProject(true)}><Icon name="plus" size={14} /> Add project</button>
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {!detail && loading && typeof loading === 'string' && <LoadState state={loading} onRetry={() => loadPro(orgId, true)} />}

      {tab === 'tasks' && (
        <div className="det-grid">
          <div className="det-main"><TaskList entityType="PRO" entityId={orgId} tasks={tasks} loading={!detail} /></div>
          <div className="det-side"><ProSideMeta pro={p} projects={projects} /></div>
        </div>
      )}
      {tab === 'overview' && (
        <div className="det-grid">
          <div className="det-main det-card"><ProOverview pro={p} /></div>
          <div className="det-side"><ProSideMeta pro={p} projects={projects} /></div>
        </div>
      )}
      {tab === 'intake' && <IntakeAnswersTab pro={p} answers={detail ? detail.answers : null} />}
      {tab === 'projects' && <ProProjectsTab projects={projects} onNew={() => setNewProject(true)} />}
      {tab === 'notes' && (
        <div className="det-grid">
          <div className="det-main"><NotesThread entityType="PRO" entityId={orgId} notes={detail ? notes : null} /></div>
          <div className="det-side"><ProSideMeta pro={p} projects={projects} /></div>
        </div>
      )}
      {tab === 'audit' && <AuditTab events={detail ? detail.audit : null} />}
      {newProject && <NewProjectModal orgId={orgId} onClose={() => setNewProject(false)} onCreated={(proj) => { setNewProject(false); openRecord('project', proj.project_id); }} />}
    </div>
  );
}

function useProjectsFor(orgId) {
  const all = useStore((s) => s.projects);
  return React.useMemo(() => all.filter((x) => x.org_id === orgId).sort((a, b) => b.tax_year - a.tax_year), [all, orgId]);
}

function ProOverview({ pro }) {
  const save = (field, what) => (v) => updatePro(pro, { [field]: v }, what || field.replace(/_/g, ' ')).catch(() => {});
  const E = (field, opts = {}) => <InlineEdit value={pro[field]} onSave={save(field, opts.what)} {...opts} />;
  return (
    <>
      <FieldGroup title="Identity">
        <Field label="Business name">{E('business_name')}</Field>
        <Field label="DBA">{E('dba')}</Field>
        <Field label="Vertical">{E('vertical')}</Field>
        <Field label="State">{E('state')}</Field>
        <Field label="Year started">{E('year_started', { type: 'number', mono: true })}</Field>
        <Field label="Time zone">{E('time_zone', { type: 'select', options: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu'].map((v) => ({ value: v, label: v })) })}</Field>
        <Field label="Scope start">{E('scope_start_date', { type: 'date', mono: true })}</Field>
        <Field label="Lifecycle">{E('lifecycle_status', { type: 'select', options: enumOptions('LIFECYCLE_STATUS'), display: <Pill kind="lifecycle" value={pro.lifecycle_status} /> })}</Field>
      </FieldGroup>
      <FieldGroup title="Tax context">
        <Field label="Entity type">{E('entity_type', { type: 'select', options: enumOptions('ENTITY_TYPE'), display: pro.entity_type ? label('ENTITY_TYPE', pro.entity_type) : null })}</Field>
        <Field label="Last filing year">{E('last_filing_year', { type: 'number', mono: true })}</Field>
        <Field label="Doc collection">{E('doc_collection_status', { type: 'select', options: enumOptions('DOC_COLLECTION_STATUS'), display: pro.doc_collection_status ? label('DOC_COLLECTION_STATUS', pro.doc_collection_status) : null })}</Field>
        <Field label="SFDC case">{E('sfdc_case_number', { mono: true })}</Field>
      </FieldGroup>
      <FieldGroup title="Assignments">
        <Field label="Tax advisor">{E('assigned_advisor_email', { type: 'person', display: pro.assigned_advisor_email ? <Person email={pro.assigned_advisor_email} /> : null })}</Field>
        <Field label="Onboarding specialist">{E('assigned_os_email', { type: 'person', display: pro.assigned_os_email ? <Person email={pro.assigned_os_email} /> : null })}</Field>
        <Field label="BK lead">{E('bk_lead_email', { type: 'person', display: pro.bk_lead_email ? <Person email={pro.bk_lead_email} /> : null })}</Field>
      </FieldGroup>
      <FieldGroup title="Owners" defaultOpen={false}>
        {[1, 2, 3].map((n) => (
          <React.Fragment key={n}>
            <Field label={'Owner ' + n}>{E('owner' + n + '_name')}</Field>
            <Field label={'Owner ' + n + ' %'}>{E('owner' + n + '_pct', { type: 'number', mono: true })}</Field>
            <Field label={'Owner ' + n + ' email'}>{E('owner' + n + '_email')}</Field>
            <Field label={'Owner ' + n + ' phone'}>{E('owner' + n + '_phone', { mono: true })}</Field>
          </React.Fragment>
        ))}
      </FieldGroup>
      <FieldGroup title="INHA bookkeeping" defaultOpen={false}>
        <Field label="Books with HCP">{E('books_with_hcp', { type: 'bool', display: pro.books_with_hcp ? 'Yes' : 'No' })}</Field>
        <Field label="Prior books status">{E('prior_books_status')}</Field>
        <Field label="Payroll servicer">{E('payroll_servicer')}</Field>
        <Field label="Books access">{E('books_access')}</Field>
        <Field label="Remarks">{E('inha_remarks', { type: 'textarea' })}</Field>
      </FieldGroup>
      <FieldGroup title="Risk">
        <Field label="At risk">{E('at_risk', { type: 'bool', display: pro.at_risk ? <span style={{ color: 'var(--warning-dark)' }}><Icon name="alert" size={12} /> Yes</span> : 'No' })}</Field>
        <Field label="At-risk reason">{E('at_risk_reason', { disabled: !pro.at_risk })}</Field>
        <Field label="Last advisor touchpoint">{E('last_advisor_touchpoint', { type: 'date', mono: true })}</Field>
      </FieldGroup>
      <div className="muted small" style={{ padding: '10px 16px' }}>Click any value to edit — Enter or click away saves, Esc cancels. Running notes live on the Notes tab.</div>
    </>
  );
}

function ProSideMeta({ pro, projects }) {
  return (
    <div className="det-card">
      <div className="det-card-head"><div className="title">Pro details</div></div>
      <div style={{ padding: '8px 14px' }}>
        <div className="field"><span className="lbl">Status</span><span className="val"><Pill kind="lifecycle" value={pro.lifecycle_status} /></span></div>
        <div className="field"><span className="lbl">Advisor</span><span className="val"><Person email={pro.assigned_advisor_email} /></span></div>
        <div className="field"><span className="lbl">OS</span><span className="val"><Person email={pro.assigned_os_email} fallback={pro.needs_os_assignment ? 'needs assignment' : 'unassigned'} /></span></div>
        <div className="field"><span className="lbl">BK lead</span><span className="val"><Person email={pro.bk_lead_email} /></span></div>
        <div className="field"><span className="lbl">Entity</span><span className={'val' + (pro.entity_type ? '' : ' empty')}>{label('ENTITY_TYPE', pro.entity_type) || '—'}</span></div>
        <div className="field"><span className="lbl">State</span><span className={'val' + (pro.state ? '' : ' empty')}>{pro.state || '—'}</span></div>
        <div className="field"><span className="lbl">Vertical</span><span className={'val' + (pro.vertical ? '' : ' empty')}>{pro.vertical || '—'}</span></div>
        <div className="field"><span className="lbl">Docs</span><span className="val">{label('DOC_COLLECTION_STATUS', pro.doc_collection_status) || '—'}</span></div>
        <div className="field"><span className="lbl">Last filed</span><span className={'val' + (pro.last_filing_year ? '' : ' empty')}>{pro.last_filing_year || '—'}</span></div>
        <div className="field"><span className="lbl">Active projects</span><span className="val mono">{projects.filter((x) => x.pipeline_status !== 'COMPLETE' && !x.archived).length}</span></div>
        {pro.at_risk && <div className="field"><span className="lbl">At risk</span><span className="val" style={{ color: 'var(--warning-dark)' }}><Icon name="alert" size={13} /> {pro.at_risk_reason || 'Yes'}</span></div>}
        <div style={{ marginTop: 12, borderTop: '1px solid var(--grey-100)', paddingTop: 12 }}>
          <div className="muted small">Drive folder</div>
          {pro.drive_folder_url
            ? <a className="cell-link" href={safeUrl(pro.drive_folder_url)} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}><Icon name="folder" size={14} /> {pro.business_name} ({pro.org_id})-TAX</a>
            : <span className="muted small">Not created yet</span>}
        </div>
      </div>
    </div>
  );
}

function ProProjectsTab({ projects, onNew }) {
  return (
    <div className="det-card">
      <div className="det-card-head">
        <div className="title">Projects ({projects.length})</div>
        <button className="btn primary sm" onClick={onNew}><Icon name="plus" size={12} /> New project</button>
      </div>
      <table className="tbl">
        <colgroup><col style={{ width: 280 }} /><col style={{ width: 170 }} /><col style={{ width: 120 }} /><col style={{ width: 130 }} /><col style={{ width: 70 }} /></colgroup>
        <thead><tr><th>Project</th><th>Stage</th><th>Deadline</th><th>Progress</th><th>Advisor</th></tr></thead>
        <tbody>
          {projects.map((x) => (
            <tr key={x.project_id} onClick={() => openRecord('project', x.project_id)} className={x.archived ? 'archived' : ''}>
              <td><span className="cell"><span style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontWeight: 600 }}>{label('FILING_TYPE', x.filing_type)} · TY{x.tax_year}</span><span className="cell-id">{x.project_id}</span></span></span></td>
              <td><span className="cell"><Pill kind="pipeline" value={x.pipeline_status} /></span></td>
              <td><span className={'cell mono ' + (x.pipeline_status !== 'COMPLETE' ? dueClass(x.filing_deadline) : '')}>{x.filing_deadline ? fmtDue(x.filing_deadline, true) : '—'}</span></td>
              <td><span className="cell"><ProgressBar pct={x.progress} /></span></td>
              <td><span className="cell"><Avatar email={x.tax_advisor_email} /></span></td>
            </tr>
          ))}
          {projects.length === 0 && (
            <tr><td colSpan="5"><Empty icon="briefcase" title="No projects yet" action={<button className="btn primary" onClick={onNew}><Icon name="plus" size={14} /> Add project</button>}>Add a tax return project to start tracking prep work.</Empty></td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const BRANCH_LABELS = { GENERAL: 'General intake', SCHED_C: 'Sole prop questionnaire', ENTITY: 'Entity questionnaire' };

function IntakeAnswersTab({ pro, answers }) {
  const byBranch = {};
  (answers || []).forEach((a) => { (byBranch[a.branch] = byBranch[a.branch] || []).push(a); });
  const order = ['GENERAL', 'SCHED_C', 'ENTITY', ...Object.keys(byBranch).filter((b) => !['GENERAL', 'SCHED_C', 'ENTITY'].includes(b))];
  return (
    <div className="det-card" style={{ padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Intake answers</h2>
          <p className="muted small" style={{ marginTop: 4 }}>Captured during onboarding (workbook import or wizard). Earlier answers are preserved via the <span className="mono">is_current</span> flag.</p>
        </div>
        <button className="btn sm" onClick={() => navigate({ view: 'intake', id: pro.org_id })}><Icon name="wand" size={12} /> {answers && answers.length ? 'Re-run intake' : 'Run intake'}</button>
      </div>
      {!answers && <div className="muted">Loading…</div>}
      {answers && answers.length === 0 && <div className="muted" style={{ padding: 20, textAlign: 'center' }}>No intake answers yet. Upload the onboarding workbook in the wizard, or answer the questions there.</div>}
      {answers && answers.length > 0 && (
        <table className="tmpl-tbl" style={{ marginTop: 0 }}>
          <thead><tr><th style={{ width: 380 }}>Question</th><th>Answer</th><th style={{ width: 140 }}>Answered</th></tr></thead>
          <tbody>
            {order.filter((b) => byBranch[b]).map((b) => (
              <React.Fragment key={b}>
                <tr className="section-row"><td colSpan="3">{BRANCH_LABELS[b] || b}{b === 'ENTITY' && pro.entity_type ? ` (${label('ENTITY_TYPE', pro.entity_type)})` : ''}</td></tr>
                {byBranch[b].map((a) => (
                  <tr key={a.answer_id}>
                    <td>{a.question}</td>
                    <td>{a.answer || <span className="muted">—</span>}{a.notes && <div className="muted small">{a.notes}</div>}</td>
                    <td className="muted mono small" title={(a.source || '') + ' ' + (a.source_ref || '') + ' · ' + (a.answered_by || '')}>{fmtDue(String(a.answered_at).slice(0, 10), true)}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ================= NOTES + AUDIT ================= */

export function NotesThread({ entityType, entityId, notes }) {
  const me = useStore((s) => s.user.email);
  const [draft, setDraft] = React.useState('');
  const [editingId, setEditingId] = React.useState(null);
  const [editText, setEditText] = React.useState('');
  const list = notes || [];
  function post() {
    if (!draft.trim()) return;
    addNote(entityType, entityId, draft.trim());
    setDraft('');
  }
  return (
    <div className="det-card">
      <div className="det-card-head">
        <div className="title">Notes</div>
        <span className="muted small">{list.length} entr{list.length === 1 ? 'y' : 'ies'} · newest first</span>
      </div>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--grey-100)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Avatar email={me} />
          <div style={{ flex: 1 }}>
            <textarea className="note-input" placeholder="Add a note… (visible to the whole tax team, timestamped)" value={draft}
              onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) post(); }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <span className="muted small">⌘/Ctrl ↵ to post</span>
              <button className="btn primary sm" onClick={post} disabled={!draft.trim()}>Add note</button>
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding: '4px 14px 12px' }}>
        {!notes && <div className="muted" style={{ padding: 12 }}>Loading…</div>}
        {notes && list.length === 0 && <div className="muted small" style={{ padding: '14px 0' }}>No notes yet.</div>}
        {list.slice().reverse().map((n) => (
          <div key={n.note_id} className={cx('note-entry', String(n.note_id).startsWith('tmp-') && 'pending')}>
            {n.author_email === 'salesforce' || n.author_email === 'asana-import'
              ? <span className="av" style={{ background: 'var(--grey-500)', color: '#fff' }}>{n.author_email === 'salesforce' ? 'SF' : 'AS'}</span>
              : <Avatar email={n.author_email} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="note-meta">
                <strong>{n.author_email === 'salesforce' ? 'Salesforce (Sub-Status Notes)' : n.author_email === 'asana-import' ? 'Asana import' : <PersonName email={n.author_email} />}</strong>
                <span className="muted small mono">{fmtTs(n.created_at)}</span>
                {n.edited_at && <span className="muted small">· edited</span>}
                {n.author_email === me && editingId !== n.note_id && !String(n.note_id).startsWith('tmp-') && (
                  <>
                    <button className="note-edit-btn" onClick={() => { setEditingId(n.note_id); setEditText(n.body); }}>Edit</button>
                    <button className="note-edit-btn" onClick={async () => { if (await confirmDialog('Delete this note?', { ok: 'Delete', danger: true })) deleteNote(n); }}>Delete</button>
                  </>
                )}
              </div>
              {editingId === n.note_id ? (
                <div style={{ marginTop: 4 }}>
                  <textarea className="note-input" autoFocus value={editText} onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setEditingId(null); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { editNote(n, editText); setEditingId(null); } }} />
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button className="btn primary sm" disabled={!editText.trim()} onClick={() => { editNote(n, editText); setEditingId(null); }}>Save</button>
                    <button className="btn subtle sm" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : <div className="note-body">{n.body}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditTab({ events }) {
  return (
    <div className="det-card">
      <div className="det-card-head"><div className="title">Audit trail</div><span className="muted small">Last 100 events · sourced from AuditLog</span></div>
      <table className="tmpl-tbl">
        <thead><tr><th style={{ width: 170 }}>When</th><th style={{ width: 170 }}>Actor</th><th style={{ width: 220 }}>Action</th><th>From → To</th></tr></thead>
        <tbody>
          {!events && <tr><td colSpan="4" className="muted">Loading…</td></tr>}
          {events && events.length === 0 && <tr><td colSpan="4" className="muted" style={{ textAlign: 'center', padding: 20 }}>No events yet.</td></tr>}
          {(events || []).map((e) => (
            <tr key={e.audit_id}>
              <td><div>{relTime(e.ts)}</div><div className="muted mono small">{fmtTsShort(e.ts)}</div></td>
              <td><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Avatar email={e.actor_email} /> {String(e.actor_email || '').split('@')[0]}</span></td>
              <td>{e.action} {e.field && <span className="muted small">{e.field}</span>}</td>
              <td className="muted small" style={{ wordBreak: 'break-word' }}>{e.from_value && <><span className="mono">{e.from_value}</span> → </>}<span className="mono">{e.to_value}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ================= PROJECT ================= */

const SEQ = ['IN_QUEUE', 'DOC_GATHERING', 'PREP', 'WFP', 'QA', 'CLIENT_REVIEW', 'FILING_DELIVERY', 'COMPLETE'];

async function changeStage(project, stage) {
  const patch = { pipeline_status: stage };
  if (stage === 'BLOCKED') {
    const reason = await askText('What is blocking this return?', { placeholder: 'e.g. Awaiting prior-year return from CPA', ok: 'Move to Blocked', required: true });
    if (!reason) return;
    patch.blocker_reason = reason;
  }
  if (stage === 'COMPLETE' && !project.efile_date) {
    const d = await askText('E-file date', { message: 'When was the return e-filed? (YYYY-MM-DD — leave as today if unsure)', defaultValue: new Date().toISOString().slice(0, 10), ok: 'Mark complete', required: true });
    if (!d) return;
    patch.efile_date = d;
  }
  try {
    await updateProject(project, patch, project.business_name + ' → ' + label('PIPELINE_STATUS', stage));
  } catch (e) { /* toast */ }
}

function nextStage(project, history) {
  if (project.pipeline_status === 'BLOCKED') {
    const back = (history || []).slice().reverse().find((h) => h.to_stage === 'BLOCKED');
    return back && back.from_stage && back.from_stage !== 'BLOCKED' ? back.from_stage : 'DOC_GATHERING';
  }
  if (project.pipeline_status === 'IN_QUEUE_ESCALATED') return 'DOC_GATHERING';
  const i = SEQ.indexOf(project.pipeline_status);
  return i >= 0 && i < SEQ.length - 1 ? SEQ[i + 1] : null;
}

function WorkTimerButton({ project }) {
  const timer = useStore((s) => s.timer);
  const [conflict, setConflict] = React.useState(null);
  const [, tick] = React.useState(0);
  const running = timer && timer.project_id === project.project_id;
  React.useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  async function start(force) {
    try {
      const res = await startTimer(project, force);
      if (res && res.conflict) setConflict(res.conflict); else setConflict(null);
    } catch (e) { /* toast */ }
  }
  const elapsed = running ? Math.max(0, Math.floor((Date.now() - new Date(timer.started_at).getTime()) / 1000)) : 0;
  return (
    <div className="popover-host">
      {running ? (
        <button className="btn timer-running" onClick={stopTimer} title="Stop timer & log time">
          <span className="timer-dot" /> <span className="mono">{fmtElapsed(elapsed)}</span> <Icon name="stop" size={13} />
        </button>
      ) : (
        <button className="btn" onClick={() => start(false)} title="Start work timer"><Icon name="play" size={13} /> Start timer</button>
      )}
      <Popover open={!!conflict} onClose={() => setConflict(null)} align="right" style={{ minWidth: 300, top: 'calc(100% + 6px)' }}>
        <h6>Timer already running</h6>
        <p className="small" style={{ margin: '0 0 10px', color: 'var(--fg-secondary)' }}>
          You have a timer running on <strong>{conflict && conflict.label}</strong>. Stop it before starting a new one.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn sm subtle" onClick={() => setConflict(null)}>Cancel</button>
          <button className="btn sm primary" onClick={() => start(true)}>Stop that &amp; start here</button>
        </div>
      </Popover>
    </div>
  );
}

export function ProjectDetail({ projectId, inDrawer }) {
  const project = useStore((s) => s.projects.find((p) => p.project_id === projectId));
  const detail = useStore((s) => s.details.project[projectId]);
  const loading = useStore((s) => s.loading['project:' + projectId]);
  const pro = useStore((s) => (project ? s.pros.find((p) => p.org_id === project.org_id) : null));
  const [tab, setTab] = useTab(inDrawer, 'tasks');
  const [submitting, setSubmitting] = React.useState(false);
  React.useEffect(() => { loadProject(projectId); }, [projectId]);

  if (!project && !detail) {
    return loading ? <LoadState state={true} /> : <Empty icon="briefcase" title="Project not found">{projectId} isn't in Tax Manager.</Empty>;
  }
  const p = { ...(detail ? detail.project : {}), ...(project || {}) };
  const tasks = detail ? detail.tasks : [];
  const next = nextStage(p, detail && detail.history);

  async function archive() {
    const reason = await askText('Archive ' + p.project_id + '?', { placeholder: 'Reason (e.g. duplicate, pro churned)', ok: 'Archive', required: true });
    if (!reason) return;
    try { await archiveRecord('project', p, reason); toast('success', 'Archived ' + p.project_id); } catch (e) { /* handled */ }
  }

  const openItems = detail ? detail.outstanding.filter((i) => !i.resolved).length : null;
  const activeReview = detail ? (detail.reviews || []).find((r) => ['SUBMITTED', 'IN_REVIEW', 'REWORK'].includes(r.status)) : null;
  const tabs = [
    { id: 'tasks', label: 'Tasks', icon: 'check-circle', badge: tasks.length },
    { id: 'overview', label: 'Overview', icon: 'file-text' },
    { id: 'stages', label: 'Time & stages', icon: 'timer' },
    { id: 'outstanding', label: 'Outstanding items', icon: 'flag', badge: openItems || null },
    { id: 'review', label: 'Peer review', icon: 'eye' },
    { id: 'notes', label: 'Notes', icon: 'file-text', badge: detail ? detail.notes.length : null },
    { id: 'audit', label: 'Audit', icon: 'history' },
  ];

  return (
    <div data-screen-label="Project detail">
      <div className="ph">
        <div style={{ minWidth: 0 }}>
          <div className="ph-title">
            <span className="av xl" style={{ background: 'var(--primary-main)' }}><Icon name="briefcase" size={18} /></span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.business_name}</span>
                <span className="muted small">· TY{p.tax_year} {label('FILING_TYPE', p.filing_type)}</span>
                <SavedTick savedKey={'project:' + projectId} />
              </div>
              <div className="ph-meta" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="mono">{p.project_id}</span><span>·</span>
                <InlineEdit value={p.pipeline_status} type="select" options={enumOptions('PIPELINE_STATUS')} display={<Pill kind="pipeline" value={p.pipeline_status} />}
                  onSave={(v) => v && changeStage(p, v)} />
                {p.filing_deadline && <><span>·</span>
                  <span className={'mono ' + (p.pipeline_status !== 'COMPLETE' ? dueClass(p.filing_deadline) : '')} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                    <Icon name="clock" size={12} /> Deadline {fmtDue(p.filing_deadline, true)}
                  </span></>}
                {p.blocker_reason && <><span>·</span><span style={{ color: 'var(--error-main)' }}><Icon name="alert" size={12} /> {p.blocker_reason}</span></>}
                {activeReview && <><span>·</span><a style={{ cursor: 'pointer' }} onClick={() => setTab('review')} title="Open the peer review"><ReviewPill status={activeReview.status} /></a></>}
                {p.archived && <><span>·</span><span className="pill archived">Archived</span></>}
              </div>
            </div>
          </div>
        </div>
        <div className="ph-actions">
          <WorkTimerButton project={p} />
          <button className="btn" disabled={!pro || !pro.drive_folder_url} title={pro && pro.drive_folder_url ? 'Open the pro\'s Drive folder' : 'No Drive folder yet — create it from the pro'}
            onClick={() => pro && safeUrl(pro.drive_folder_url) && window.open(safeUrl(pro.drive_folder_url), '_blank')}><Icon name="paperclip" size={14} /> Files</button>
          <MoreMenu btnClass="btn" items={[
            { label: 'Open pro', icon: 'users', onClick: () => openRecord('pro', p.org_id) },
            { label: 'Copy link', icon: 'copy', onClick: () => copyLink({ view: 'project', id: projectId }) },
            detail && !activeReview && !p.archived && p.pipeline_status !== 'COMPLETE' && { label: 'Submit for peer review…', icon: 'eye', onClick: () => setSubmitting(true) },
            p.pipeline_status !== 'BLOCKED' && { label: 'Mark blocked…', icon: 'alert', onClick: () => changeStage(p, 'BLOCKED') },
            p.archived ? { label: 'Restore project', icon: 'refresh', onClick: () => restoreRecord('project', p).catch(() => {}) } : { label: 'Archive project', icon: 'archive', danger: true, onClick: archive },
          ]} />
          {next && <button className="btn primary" onClick={() => changeStage(p, next)} title={'Move to ' + label('PIPELINE_STATUS', next)}><Icon name="check" size={14} /> {p.pipeline_status === 'BLOCKED' ? 'Unblock' : 'Advance stage'}</button>}
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {!detail && typeof loading === 'string' && <LoadState state={loading} onRetry={() => loadProject(projectId, true)} />}

      {tab === 'tasks' && (
        <div className="det-grid">
          <div className="det-main"><TaskList entityType="PROJECT" entityId={projectId} tasks={tasks} loading={!detail} /></div>
          <div className="det-side"><ProjectSideMeta project={p} pro={pro} /></div>
        </div>
      )}
      {tab === 'overview' && (
        <div className="det-grid">
          <div className="det-main det-card"><ProjectOverview project={p} /></div>
          <div className="det-side"><ProjectSideMeta project={p} pro={pro} /></div>
        </div>
      )}
      {tab === 'stages' && <StageAndTimeTab project={p} detail={detail} />}
      {tab === 'outstanding' && <OutstandingItems project={p} items={detail ? detail.outstanding : null} />}
      {tab === 'review' && <ReviewPanel project={p} detail={detail} />}
      {submitting && <SubmitReviewModal project={p} onClose={() => setSubmitting(false)} onDone={() => setTab('review')} />}
      {tab === 'notes' && (
        <div className="det-grid">
          <div className="det-main"><NotesThread entityType="PROJECT" entityId={projectId} notes={detail ? detail.notes : null} /></div>
          <div className="det-side"><ProjectSideMeta project={p} pro={pro} /></div>
        </div>
      )}
      {tab === 'audit' && <AuditTab events={detail ? detail.audit : null} />}
    </div>
  );
}

function ProjectOverview({ project }) {
  const save = (field) => (v) => updateProject(project, { [field]: v }, field.replace(/_/g, ' ')).catch(() => {});
  const E = (field, opts = {}) => <InlineEdit value={project[field]} onSave={save(field)} {...opts} />;
  const person = (field) => E(field, { type: 'person', display: project[field] ? <Person email={project[field]} /> : null });
  return (
    <>
      <FieldGroup title="Project">
        <Field label="Filing type">{E('filing_type', { type: 'select', options: enumOptions('FILING_TYPE'), display: label('FILING_TYPE', project.filing_type) })}</Field>
        <Field label="Tax year">{E('tax_year', { type: 'number', mono: true })}</Field>
        <Field label="Filing deadline">{E('filing_deadline', { type: 'date', mono: true, display: project.filing_deadline ? fmtDue(project.filing_deadline, true) : null })}</Field>
        <Field label="Project start">{E('project_start_date', { type: 'date', mono: true, display: project.project_start_date ? fmtDue(project.project_start_date, true) : null })}</Field>
        <Field label="States covered">{E('states_covered')}</Field>
        <Field label="Project ID"><span className="val mono">{project.project_id}</span></Field>
      </FieldGroup>
      <FieldGroup title="Schedule & status">
        <Field label="Stage"><InlineEdit value={project.pipeline_status} type="select" options={enumOptions('PIPELINE_STATUS')} display={<Pill kind="pipeline" value={project.pipeline_status} />} onSave={(v) => v && changeStage(project, v)} /></Field>
        <Field label="Blocker">{E('blocker_reason')}</Field>
        <Field label="Extension needed?">{E('extension_needed', { type: 'bool', display: project.extension_needed ? 'Yes' : 'No' })}</Field>
        <Field label="Extension filed?">{E('extension_filed', { type: 'bool', display: project.extension_filed ? 'Yes' : 'No' })}</Field>
        <Field label="E-file date">{E('efile_date', { type: 'date', mono: true, display: project.efile_date ? fmtDue(project.efile_date, true) : null })}</Field>
      </FieldGroup>
      <FieldGroup title="People">
        <Field label="Tax advisor">{person('tax_advisor_email')}</Field>
        <Field label="Tax preparer">{person('tax_preparer_email')}</Field>
        <Field label="Peer reviewer">{person('peer_reviewer_email')}</Field>
        <Field label="OS">{person('os_email')}</Field>
      </FieldGroup>
      <FieldGroup title="Coverage & complexity" defaultOpen={false}>
        <Field label="Complexity">{E('complexity', { type: 'select', options: [{ value: 'LOW', label: 'Low' }, { value: 'MED', label: 'Medium' }, { value: 'HIGH', label: 'High' }] })}</Field>
        <Field label="Tax risk level">{E('tax_risk_level', { type: 'select', options: ['Low', 'Medium', 'High'].map((v) => ({ value: v, label: v })) })}</Field>
      </FieldGroup>
      <FieldGroup title="Books & billing" defaultOpen={false}>
        <Field label="Books for scope">{E('books_status', { type: 'select', options: ['Not started', 'In progress', 'Delivered', 'N/A'].map((v) => ({ value: v, label: v })) })}</Field>
        <Field label="Billing kind">{E('billing_kind', { type: 'select', options: ['Subscription credit', 'One-time fee', 'Included', 'Waived'].map((v) => ({ value: v, label: v })) })}</Field>
        <Field label="Add-ons">{E('add_ons')}</Field>
      </FieldGroup>
      <div className="muted small" style={{ padding: '10px 16px' }}>Setting the e-file date or deadline re-dates the tasks anchored to it. Assigning a role fills any unassigned open tasks for that role.</div>
    </>
  );
}

function ProjectSideMeta({ project, pro }) {
  return (
    <div className="det-card">
      <div className="det-card-head"><div className="title">Project details</div></div>
      <div style={{ padding: '8px 14px' }}>
        <div className="field"><span className="lbl">Pro</span><span className="val"><a className="cell-link" onClick={() => openRecord('pro', project.org_id)} style={{ cursor: 'pointer' }}>{project.business_name}</a></span></div>
        <div className="field"><span className="lbl">Stage</span><span className="val"><Pill kind="pipeline" value={project.pipeline_status} /></span></div>
        <div className="field"><span className="lbl">Filing</span><span className="val">{label('FILING_TYPE', project.filing_type)}</span></div>
        <div className="field"><span className="lbl">Tax year</span><span className="val mono">{project.tax_year}</span></div>
        <div className="field"><span className="lbl">Deadline</span><span className={'val mono ' + (project.pipeline_status !== 'COMPLETE' ? dueClass(project.filing_deadline) : '')}>{project.filing_deadline ? fmtDue(project.filing_deadline, true) : '—'}</span></div>
        <div className="field"><span className="lbl">Advisor</span><span className="val"><Person email={project.tax_advisor_email} /></span></div>
        <div className="field"><span className="lbl">Preparer</span><span className="val"><Person email={project.tax_preparer_email} /></span></div>
        <div className="field"><span className="lbl">Peer reviewer</span><span className="val"><Person email={project.peer_reviewer_email} /></span></div>
        <div className="field"><span className="lbl">Progress</span><span className="val" style={{ flex: 1 }}><ProgressBar pct={project.progress} /></span></div>
        <div style={{ marginTop: 12, borderTop: '1px solid var(--grey-100)', paddingTop: 12 }}>
          <div className="muted small">Drive folder</div>
          {pro && pro.drive_folder_url
            ? <a className="cell-link" href={safeUrl(pro.drive_folder_url)} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}><Icon name="folder" size={14} /> {pro.business_name} ({project.org_id})-TAX</a>
            : <span className="muted small">Not created yet</span>}
        </div>
      </div>
    </div>
  );
}

function StageAndTimeTab({ project, detail }) {
  const timer = useStore((s) => s.timer);
  if (!detail) return <div className="det-card"><div className="muted" style={{ padding: 24 }}>Loading…</div></div>;
  const history = detail.history;
  const entries = detail.time.filter((e) => e.stopped_at);
  const totalMin = entries.reduce((s, e) => s + (e.duration_min || 0), 0);
  const byUser = {};
  entries.forEach((e) => { byUser[e.user_email] = (byUser[e.user_email] || 0) + (e.duration_min || 0); });
  const running = detail.time.filter((e) => !e.stopped_at);
  const currentSince = history.length ? history[history.length - 1].changed_at : project.created_at;
  const daysInCurrent = currentSince ? Math.max(0, Math.round((Date.now() - new Date(currentSince).getTime()) / 864e5 * 10) / 10) : null;
  const totalDays = history.reduce((s, h) => s + (h.days_in_prev_stage || 0), 0) + (project.pipeline_status !== 'COMPLETE' ? daysInCurrent || 0 : 0);

  function exportStages() {
    downloadCSV(project.project_id + '-stage-history.csv', toCSV(history, [
      { key: 'from_stage', label: 'From stage', value: (r) => (r.from_stage ? label('PIPELINE_STATUS', r.from_stage) : '(created)') },
      { key: 'to_stage', label: 'To stage', value: (r) => label('PIPELINE_STATUS', r.to_stage) },
      { key: 'changed_at', label: 'Changed at' },
      { key: 'changed_by', label: 'Changed by' },
      { key: 'advisor_email', label: 'Advisor' },
      { key: 'days_in_prev_stage', label: 'Days in prev stage' },
    ]));
  }
  function exportTime() {
    downloadCSV(project.project_id + '-time-entries.csv', toCSV(entries, [
      { key: 'user_email', label: 'User' }, { key: 'started_at', label: 'Started' }, { key: 'stopped_at', label: 'Stopped' },
      { key: 'duration_min', label: 'Minutes' }, { key: 'auto_stopped', label: 'Auto-stopped' },
    ]));
  }

  return (
    <div className="det-grid">
      <div className="det-main" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="det-card">
          <div className="det-card-head">
            <div className="title">Stage timeline</div>
            <button className="btn sm" onClick={exportStages} disabled={!history.length}><Icon name="download" size={12} /> Export CSV</button>
          </div>
          <div style={{ padding: '8px 16px 16px' }}>
            {history.map((h, i) => (
              <div key={h.history_id} className="stage-step">
                <div className="stage-rail"><span className="stage-node" />{i < history.length - 1 && <span className="stage-line" />}</div>
                <div className="stage-body">
                  <div className="stage-top">
                    <Pill kind="pipeline" value={h.to_stage} />
                    {h.days_in_prev_stage != null && <span className="muted small">{h.days_in_prev_stage} day{h.days_in_prev_stage === 1 ? '' : 's'} in {label('PIPELINE_STATUS', h.from_stage)}</span>}
                    {!h.from_stage && <span className="muted small">project created</span>}
                  </div>
                  <div className="muted small" style={{ marginTop: 2 }}><span className="mono">{fmtTsShort(h.changed_at)}</span> · moved by <PersonName email={h.changed_by} /></div>
                </div>
              </div>
            ))}
            {project.pipeline_status !== 'COMPLETE' && history.length > 0 && (
              <div className="stage-step">
                <div className="stage-rail"><span className="stage-node live" /></div>
                <div className="stage-body"><span className="muted small">In <strong>{label('PIPELINE_STATUS', project.pipeline_status)}</strong> for {daysInCurrent} days{timer && timer.project_id === project.project_id ? ' — your timer is running' : ''}</span></div>
              </div>
            )}
            {!history.length && <div className="muted small">No stage changes recorded yet.</div>}
          </div>
        </div>
        <div className="det-card">
          <div className="det-card-head">
            <div className="title">Logged time — {(totalMin / 60).toFixed(1)} hrs total</div>
            <button className="btn sm" onClick={exportTime} disabled={!entries.length}><Icon name="download" size={12} /> Export CSV</button>
          </div>
          <table className="tmpl-tbl">
            <thead><tr><th>Who</th><th>Started</th><th>Stopped</th><th style={{ width: 100 }}>Duration</th></tr></thead>
            <tbody>
              {running.map((e) => (
                <tr key={e.entry_id}><td><Person email={e.user_email} /></td><td className="mono small">{fmtTsShort(e.started_at)}</td><td><span className="pill pp-DOC_GATHERING">running</span></td><td className="mono muted">—</td></tr>
              ))}
              {entries.slice().reverse().map((e) => (
                <tr key={e.entry_id}>
                  <td><Person email={e.user_email} /></td>
                  <td className="mono small">{fmtTsShort(e.started_at)}</td>
                  <td className="mono small">{fmtTsShort(e.stopped_at)}{e.auto_stopped && <span className="pill pp-WFP" style={{ marginLeft: 6 }} title={e.note}>auto-stopped</span>}</td>
                  <td className="mono">{fmtMinutes(e.duration_min)}</td>
                </tr>
              ))}
              {!entries.length && !running.length && <tr><td colSpan="4" className="muted" style={{ textAlign: 'center', padding: 20 }}>No time logged yet. Use "Start timer" while working the return.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="det-side">
        <div className="det-card">
          <div className="det-card-head"><div className="title">Cycle time</div></div>
          <div style={{ padding: '10px 14px' }}>
            <div className="field"><span className="lbl">Total in pipeline</span><span className="val mono">{Math.round(totalDays * 10) / 10} days</span></div>
            <div className="field"><span className="lbl">Current stage</span><span className="val"><Pill kind="pipeline" value={project.pipeline_status} /></span></div>
            <div className="field"><span className="lbl">Transitions</span><span className="val mono">{Math.max(0, history.length - 1)}</span></div>
            <div className="field"><span className="lbl">Actual time logged</span><span className="val mono">{(totalMin / 60).toFixed(1)} hrs</span></div>
          </div>
        </div>
        <div className="det-card">
          <div className="det-card-head"><div className="title">Time by person</div></div>
          <div style={{ padding: '10px 14px' }}>
            {Object.entries(byUser).map(([email, min]) => (
              <div key={email} className="field"><span className="lbl"><Person email={email} /></span><span className="val mono">{(min / 60).toFixed(1)}h</span></div>
            ))}
            {!Object.keys(byUser).length && <span className="muted small">No entries yet.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function OutstandingItems({ project, items }) {
  const team = useStore((s) => s.team);
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState({ item: '', owner_email: '', due_date: '' });
  const [showResolved, setShowResolved] = React.useState(false);
  function save() {
    if (!draft.item.trim()) { setAdding(false); return; }
    addOutstanding(project.project_id, { ...draft, item: draft.item.trim() });
    setDraft({ item: '', owner_email: '', due_date: '' });
  }
  const list = (items || []).filter((i) => showResolved || !i.resolved);
  const resolvedCount = (items || []).filter((i) => i.resolved).length;
  return (
    <div className="det-card">
      <div className="det-card-head">
        <div className="title">Outstanding items</div>
        <span style={{ display: 'flex', gap: 8 }}>
          {resolvedCount > 0 && <button className="btn subtle sm" onClick={() => setShowResolved(!showResolved)}>{showResolved ? 'Hide' : 'Show'} resolved ({resolvedCount})</button>}
          <button className="btn sm" onClick={() => setAdding(true)}><Icon name="plus" size={12} /> Add item</button>
        </span>
      </div>
      <table className="tmpl-tbl">
        <thead><tr><th style={{ width: 36 }} /><th>Item</th><th style={{ width: 180 }}>Owner</th><th style={{ width: 130 }}>Due</th><th style={{ width: 44 }} /></tr></thead>
        <tbody>
          {!items && <tr><td colSpan="5" className="muted">Loading…</td></tr>}
          {list.map((it) => (
            <tr key={it.item_id} className={it.resolved ? 'resolved' : ''}>
              <td><button className={'tk-check' + (it.resolved ? ' done' : '')} title={it.resolved ? 'Re-open' : 'Mark received'} onClick={() => resolveOutstanding(it, !it.resolved)}>{it.resolved && <Icon name="check" size={11} />}</button></td>
              <td style={it.resolved ? { textDecoration: 'line-through', color: 'var(--fg-secondary)' } : null}>{it.item}</td>
              <td>{it.owner_email ? <Person email={it.owner_email} /> : <span className="muted">—</span>}</td>
              <td className={'mono ' + (!it.resolved ? dueClass(it.due_date) : '')}>{it.due_date ? fmtDue(it.due_date) : '—'}</td>
              <td><button className="tb-icon-btn" style={{ width: 24, height: 24 }} title="Delete" onClick={() => deleteOutstanding(it)}><Icon name="x" size={13} /></button></td>
            </tr>
          ))}
          {adding && (
            <tr>
              <td />
              <td><input className="note-input" style={{ minHeight: 0, height: 32 }} autoFocus placeholder="What's outstanding?" value={draft.item}
                onChange={(e) => setDraft((d) => ({ ...d, item: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { e.stopPropagation(); setAdding(false); } }} /></td>
              <td><select className="note-input" style={{ minHeight: 0, height: 32 }} value={draft.owner_email} onChange={(e) => setDraft((d) => ({ ...d, owner_email: e.target.value }))}>
                <option value="">Unassigned</option>{team.filter((m) => m.active).map((m) => <option key={m.email} value={m.email}>{m.name}</option>)}
              </select></td>
              <td><input type="date" className="note-input" style={{ minHeight: 0, height: 32 }} value={draft.due_date} onChange={(e) => setDraft((d) => ({ ...d, due_date: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} /></td>
              <td><button className="btn primary sm" onClick={save}>Add</button></td>
            </tr>
          )}
          {items && list.length === 0 && !adding && (
            <tr><td colSpan="5" className="muted" style={{ textAlign: 'center', padding: 24 }}>No outstanding items. Click "Add item" to track a request.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
