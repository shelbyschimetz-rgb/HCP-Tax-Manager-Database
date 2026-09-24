/* Detail pages: Pro detail, Project detail. Both share the tab pattern + nested task list. */

/* ---- Nested task list (the daily-driver moment) ---- */
function TaskRow({ task, onToggle, depth = 0 }) {
  const [open, setOpen] = React.useState(true);
  const [checklistOpen, setChecklistOpen] = React.useState(false);
  const hasSubs = task.subtasks && task.subtasks.length > 0;
  const hasChecklist = task.checklist && task.checklist.length > 0;
  const done = task.status === 'DONE';
  const blocked = task.blockedBy && task.blockedBy.length > 0;

  return (
    <>
      <div className={'tk-row' + (done ? ' done' : '') + (depth > 0 ? ' subtask' : '') + (depth === 2 ? ' depth-2' : '') + (!hasSubs && !hasChecklist ? ' no-expand' : '')}
           onClick={() => hasChecklist ? setChecklistOpen(!checklistOpen) : null}>
        <button className="drag" onClick={e => e.stopPropagation()}><Icon name="drag" size={14} /></button>
        {hasSubs ? (
          <button className="expand" onClick={e => { e.stopPropagation(); setOpen(!open); }}>
            <Icon name={open ? 'chevron-down' : 'chevron-right'} size={13} />
          </button>
        ) : <span className="expand"></span>}
        <span className="tk-title">
          <button className={'tk-check' + (done ? ' done' : '')} onClick={e => { e.stopPropagation(); onToggle(task.id); }}>
            {done && <Icon name="check" size={11} />}
          </button>
          <span className="text">{task.title}</span>
          {task._justSaved && (Date.now() - task._justSaved) < 1500 && (
            <span className="row-saved"><Icon name="check" size={9} /> saved</span>
          )}
          {hasSubs && (
            <span className="subt-count" title={`${task.subtasks.length} subtask${task.subtasks.length === 1 ? '' : 's'}`}>
              <Icon name="link" size={11} /> {task.subtasks.length}
            </span>
          )}
          {hasChecklist && (
            <span className="badge-checklist" title="Checklist task">
              {task.checklist.filter(c => c.checked).length}/{task.checklist.length} verified
            </span>
          )}
          {blocked && <span className="badge-blocked">blocked</span>}
        </span>
        <span className={'tk-due ' + dueClass(task.due)}>{fmtDue(task.due)}</span>
        <span className="tk-assignee">
          <Avatar email={task.assignee} empty={!task.assignee} />
          <span className="name">{task.assignee ? teamByEmail[task.assignee]?.name : <span className="role-tag">{task.assigneeRole}</span>}</span>
        </span>
        <button className="more" onClick={e => e.stopPropagation()}><Icon name="more" size={14} /></button>
      </div>

      {hasChecklist && checklistOpen && (
        <div className="tk-checklist">
          {task.checklist.map(c => (
            <label key={c.id} className={'item' + (c.checked ? ' checked' : '')}>
              <input type="checkbox" defaultChecked={c.checked} />
              <span>{c.label}</span>
            </label>
          ))}
        </div>
      )}

      {hasSubs && open && task.subtasks.map(s => (
        <TaskRow key={s.id} task={s} onToggle={onToggle} depth={depth + 1} />
      ))}
    </>
  );
}

function TaskSection({ section, sectionLabel, items, onToggle }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const total = items.length;
  const done = items.filter(t => t.status === 'DONE').length;
  const pct = total === 0 ? 0 : Math.round(done / total * 100);
  return (
    <div className={'tk-section' + (collapsed ? ' collapsed' : '')}>
      <div className="tk-section-head" onClick={() => setCollapsed(!collapsed)}>
        <span className="caret"><Icon name="chevron-down" size={13} /></span>
        <span className="title">{sectionLabel}</span>
        <span className="count">{done}/{total}</span>
        <span className="progress"><div style={{ width: pct + '%' }} /></span>
        <span className="progress-pct">{pct}%</span>
      </div>
      <div className="tk-list">
        {items.map(t => <TaskRow key={t.id} task={t} onToggle={onToggle} />)}
      </div>
    </div>
  );
}

function TaskList({ sections, onToggleTask }) {
  const [composing, setComposing] = React.useState(false);
  const [draft, setDraft] = React.useState({ section: sections[0]?.section || '', title: '', assignee: '', due: '' });
  const titleRef = React.useRef(null);

  React.useEffect(() => {
    if (composing) titleRef.current?.focus();
  }, [composing]);

  function startCompose(sectionKey) {
    setDraft(d => ({ ...d, section: sectionKey || sections[0]?.section || '', title: '', assignee: '', due: '' }));
    setComposing(true);
  }
  function cancel() { setComposing(false); }
  function submit() {
    if (!draft.title.trim()) { setComposing(false); return; }
    SyncBus.start('task');
    // In real app, ghost-POST would commit; this prototype just resets the form.
    setComposing(false);
  }
  function onKey(e) {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') cancel();
  }

  return (
    <div className="task-shell">
      <div className="tk-toolbar">
        <button className="btn primary sm" onClick={() => startCompose()}>
          <Icon name="plus" size={13} /> Add task
        </button>
        <span className="muted small" style={{ marginLeft: 12 }}>
          {sections.reduce((s, sec) => s + sec.items.length, 0)} tasks across {sections.length} sections
        </span>
        <span className="spacer"></span>
        <button className="btn subtle sm" title="Show / hide done">
          <Icon name="eye" size={12} /> Hide done
        </button>
      </div>

      {composing && (
        <div className="tk-compose">
          <span className="dot" />
          <input
            ref={titleRef}
            className="title-input"
            placeholder="Write a task name…"
            value={draft.title}
            onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            onKeyDown={onKey}
          />
          <select
            value={draft.section}
            onChange={e => setDraft(d => ({ ...d, section: e.target.value }))}
            title="Section"
          >
            {sections.map(s => (
              <option key={s.section} value={s.section}>
                {ENUM_LABELS.TASK_SECTION[s.section] || s.section}
              </option>
            ))}
          </select>
          <select
            value={draft.assignee}
            onChange={e => setDraft(d => ({ ...d, assignee: e.target.value }))}
            title="Assignee"
          >
            <option value="">Unassigned</option>
            {TEAM.map(t => <option key={t.email} value={t.email}>{t.name}</option>)}
          </select>
          <input
            type="date"
            value={draft.due}
            onChange={e => setDraft(d => ({ ...d, due: e.target.value }))}
            title="Due date"
            className="due-input"
            onKeyDown={onKey}
          />
          <button className="btn sm primary" onClick={submit} disabled={!draft.title.trim()}>Add</button>
          <button className="btn sm subtle" onClick={cancel} title="Esc">Cancel</button>
        </div>
      )}

      {sections.map(s => (
        <TaskSection
          key={s.section}
          section={s.section}
          sectionLabel={ENUM_LABELS.TASK_SECTION[s.section] || s.section}
          items={s.items}
          onToggle={onToggleTask}
        />
      ))}
    </div>
  );
}

/* ---- Field group (collapsible card section) ---- */
function FieldGroup({ title, children, defaultOpen = true }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className={'field-grp' + (open ? '' : ' collapsed')}>
      <div className="field-grp-head" onClick={() => setOpen(!open)}>
        <Icon name="chevron-down" size={13} className="caret" />
        {title}
      </div>
      <div className="fields">{children}</div>
    </div>
  );
}
function Field({ label, value, empty, mono, pill }) {
  return (
    <div className="field">
      <span className="lbl">{label}</span>
      <span className={'val' + (empty ? ' empty' : '') + (mono ? ' mono' : '')}>{empty ? '—' : (pill || value)}</span>
    </div>
  );
}

/* ---- Pro detail ---- */
function ProDetail({ orgId, onNav }) {
  const pro = PROS.find(p => p.org_id === orgId) || ARCHIVED_PROS.find(p => p.org_id === orgId) || PROS[0];
  const archived = pro.archived;
  const projects = PROJECTS.filter(p => p.org_id === pro.org_id);
  const [tab, setTab] = React.useState('tasks');
  const [tasks, setTasks] = React.useState(() => makeProTasks());
  const [proNotes] = React.useState(() => makeProNotes());

  const toggleTask = (id) => {
    SyncBus.start('task');
    setTasks(secs => secs.map(s => ({
      ...s,
      items: s.items.map(t => t.id === id ? { ...t, status: t.status === 'DONE' ? 'IN_PROGRESS' : 'DONE', _justSaved: Date.now() } : t)
    })));
  };

  const advisor = teamByEmail[pro.assigned_advisor_email];
  const os = teamByEmail[pro.assigned_os_email];

  return (
    <div data-screen-label="Pro detail">
      <div className="ph">
        <div style={{ minWidth: 0 }}>
          <div className="ph-title">
            <span className="av xl" style={{ background: advisor?.color || 'var(--primary-main)' }}>
              {pro.business_name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {pro.business_name}
                <button className="tb-icon-btn" style={{ width: 28, height: 28 }} title="Star"><Icon name="star" size={16} /></button>
              </div>
              <div className="ph-meta" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className="mono">Org {pro.org_id}</span>
                <span>·</span>
                <Pill kind="lifecycle" value={pro.lifecycle_status} />
                <span>·</span>
                <span>{ENUM_LABELS.ENTITY_TYPE[pro.entity_type]}</span>
                <span>·</span>
                <span>{pro.state} · {pro.vertical}</span>
                {archived && (<><span>·</span><span className="pill archived">Archived</span></>)}
              </div>
            </div>
          </div>
        </div>
        <div className="ph-actions">
          <button className="btn"><Icon name="paperclip" size={14} /> Drive folder</button>
          <button className="btn"><Icon name="more" size={14} /></button>
          <button className="btn primary"><Icon name="plus" size={14} /> Add project</button>
        </div>
      </div>

      <div className="view-tabs">
        <button className={'view-tab' + (tab === 'overview' ? ' active' : '')} onClick={() => setTab('overview')}><Icon name="file-text" size={14} /> Overview</button>
        <button className={'view-tab' + (tab === 'tasks' ? ' active' : '')} onClick={() => setTab('tasks')}>
          <Icon name="check-circle" size={14} /> Tasks
          <span className="badge">{tasks.reduce((s, sec) => s + sec.items.length, 0)}</span>
        </button>
        <button className={'view-tab' + (tab === 'intake' ? ' active' : '')} onClick={() => setTab('intake')}><Icon name="wand" size={14} /> Intake answers</button>
        <button className={'view-tab' + (tab === 'notes' ? ' active' : '')} onClick={() => setTab('notes')}><Icon name="file-text" size={14} /> Notes <span className="badge">{proNotes.length}</span></button>
        <button className={'view-tab' + (tab === 'projects' ? ' active' : '')} onClick={() => setTab('projects')}>
          <Icon name="briefcase" size={14} /> Projects
          <span className="badge">{projects.length}</span>
        </button>
        <button className={'view-tab' + (tab === 'audit' ? ' active' : '')} onClick={() => setTab('audit')}><Icon name="history" size={14} /> Audit</button>
      </div>


      {tab === 'tasks' && (
        <div className="det-grid">
          <div className="det-main">
            <TaskList sections={tasks} onToggleTask={toggleTask} />
          </div>
          <div className="det-side">
            <SideMeta pro={pro} projects={projects} />
          </div>
        </div>
      )}

      {tab === 'overview' && (
        <div className="det-grid">
          <div className="det-main det-card">
            <FieldGroup title="Identity">
              <Field label="Business name" value={pro.business_name} />
              <Field label="DBA" value={pro.dba} empty={!pro.dba} />
              <Field label="Vertical" value={pro.vertical} />
              <Field label="State" value={pro.state} />
              <Field label="Year started" value={pro.year_started} empty={!pro.year_started} />
              <Field label="Time zone" value={pro.time_zone} empty={!pro.time_zone} />
              <Field label="Scope start" value={pro.scope_start_date} empty={!pro.scope_start_date} mono />
            </FieldGroup>
            <FieldGroup title="Tax context">
              <Field label="Entity type" value={ENUM_LABELS.ENTITY_TYPE[pro.entity_type]} />
              <Field label="Last filing year" value={pro.last_filing_year || '—'} empty={!pro.last_filing_year} />
              <Field label="Doc collection" value={ENUM_LABELS.DOC_COLLECTION_STATUS[pro.doc_collection_status]} />
            </FieldGroup>
            <FieldGroup title="Owners" defaultOpen={false}>
              <Field label="Owner 1" value={pro.owner1_name ? `${pro.owner1_name}${pro.owner1_pct ? ' · ' + pro.owner1_pct + '%' : ''}` : null} empty={!pro.owner1_name} />
              <Field label="Owner 2" value={pro.owner2_name ? `${pro.owner2_name}${pro.owner2_pct ? ' · ' + pro.owner2_pct + '%' : ''}` : null} empty={!pro.owner2_name} />
              <Field label="Owner 3" value={pro.owner3_name} empty={!pro.owner3_name} />
            </FieldGroup>
            <FieldGroup title="INHA bookkeeping" defaultOpen={false}>
              <Field label="Books with HCP" value={pro.books_with_hcp ? 'Yes' : 'No'} />
              <Field label="Prior books status" value={pro.prior_books_status} empty={!pro.prior_books_status} />
              <Field label="Payroll servicer" value={pro.payroll_servicer} empty={!pro.payroll_servicer} />
            </FieldGroup>
            <FieldGroup title="Risk & notes">
              <Field label="At risk" value={pro.at_risk ? `Yes — ${pro.at_risk_reason}` : 'No'} />
              <Field label="Last advisor touchpoint" value={pro.last_advisor_touchpoint} empty={!pro.last_advisor_touchpoint} mono />
              <Field label="Misc notes" empty />
            </FieldGroup>
          </div>
          <div className="det-side">
            <SideMeta pro={pro} projects={projects} />
          </div>
        </div>
      )}

      {tab === 'projects' && (
        <div className="det-card">
          <div className="det-card-head">
            <div className="title">Projects ({projects.length})</div>
            <button className="btn primary sm"><Icon name="plus" size={12} /> New project</button>
          </div>
          <table className="tbl">
            <colgroup><col style={{ width: 280 }} /><col style={{ width: 130 }} /><col style={{ width: 170 }} /><col style={{ width: 120 }} /><col style={{ width: 60 }} /></colgroup>
            <thead>
              <tr><th>Project</th><th>Filing</th><th>Stage</th><th>Deadline</th><th>Advisor</th></tr>
            </thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.project_id} onClick={() => onNav('project-detail', { projectId: p.project_id })}>
                  <td><span className="cell"><span style={{ display:'flex',flexDirection:'column' }}><span style={{fontWeight: 600}}>{ENUM_LABELS.FILING_TYPE[p.filing_type]} · TY{p.tax_year}</span><span className="cell-id">{p.project_id}</span></span></span></td>
                  <td><span className="cell muted">{ENUM_LABELS.FILING_TYPE[p.filing_type]}</span></td>
                  <td><span className="cell"><Pill kind="pipeline" value={p.pipeline_status} /></span></td>
                  <td><span className={'cell mono ' + dueClass(p.filing_deadline)}>{fmtDue(p.filing_deadline, true)}</span></td>
                  <td><span className="cell"><Avatar email={p.tax_advisor_email} /></span></td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr><td colSpan="5"><div className="empty" style={{ padding: '40px 20px' }}>
                  <div className="icon-bg" style={{ width: 56, height: 56 }}><Icon name="briefcase" size={22} /></div>
                  <h3>No projects yet</h3>
                  <p>Add a tax return project to start tracking prep work.</p>
                  <button className="btn primary"><Icon name="plus" size={14} /> Add project</button>
                </div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'intake' && (
        <div className="det-card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>Intake answers</h2>
              <p className="muted small" style={{ marginTop: 4 }}>Captured during onboarding intake. Earlier answers preserved via <span className="mono">is_current</span> flag.</p>
            </div>
            <button className="btn sm"><Icon name="wand" size={12} /> Re-run intake</button>
          </div>
          <table className="tmpl-tbl" style={{ marginTop: 0 }}>
            <thead><tr><th style={{ width: 360 }}>Question</th><th>Answer</th><th style={{ width: 130 }}>Answered</th></tr></thead>
            <tbody>
              <tr className="section-row"><td colSpan="3">General intake</td></tr>
              <tr><td>Multi-state operations?</td><td>Yes — {pro.state}, neighboring states pending</td><td className="muted mono">May 6, 2026</td></tr>
              <tr><td>Employees / contractors?</td><td>3 W-2 employees, 12 1099 contractors</td><td className="muted mono">May 6, 2026</td></tr>
              <tr><td>Other businesses?</td><td>None</td><td className="muted mono">May 6, 2026</td></tr>
              <tr><td>Estimated tax payments made?</td><td>Q1 yes, Q2 pending</td><td className="muted mono">May 6, 2026</td></tr>
              <tr><td>Crypto or digital asset transactions?</td><td>No</td><td className="muted mono">May 6, 2026</td></tr>
              <tr><td>Foreign accounts?</td><td>No</td><td className="muted mono">May 6, 2026</td></tr>
              <tr><td>Vehicles for business?</td><td>2 — service truck + work van</td><td className="muted mono">May 6, 2026</td></tr>
              <tr className="section-row"><td colSpan="3">Entity questionnaire ({ENUM_LABELS.ENTITY_TYPE[pro.entity_type]})</td></tr>
              <tr><td>2553 election on file?</td><td>Yes — 2018</td><td className="muted mono">May 6, 2026</td></tr>
              <tr><td>Reasonable comp for shareholder-employees?</td><td>$64k/year — needs review</td><td className="muted mono">May 6, 2026</td></tr>
              <tr><td>Distributions taken in 2024?</td><td>$28,500</td><td className="muted mono">May 6, 2026</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === 'notes' && (
        <div className="det-grid">
          <div className="det-main"><NotesThread seed={proNotes} /></div>
          <div className="det-side"><SideMeta pro={pro} projects={projects} /></div>
        </div>
      )}

      {tab === 'audit' && <AuditTab id={pro.org_id} entityType="pro" />}
    </div>
  );
}

function NotesThread({ seed }) {
  const [notes, setNotes] = React.useState(seed);
  const [draft, setDraft] = React.useState('');
  const [editingId, setEditingId] = React.useState(null);
  const [editText, setEditText] = React.useState('');

  function fmtTs(ts) {
    const d = new Date(ts.replace(' ', 'T'));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  function addNote() {
    if (!draft.trim()) return;
    SyncBus.start('note');
    const now = new Date();
    const at = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0') + ' ' + String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
    setNotes(n => [...n, { id: 'new-' + Date.now(), author: ME_EMAIL, at, body: draft.trim(), edited: false }]);
    setDraft('');
  }
  function saveEdit(id) {
    SyncBus.start('note');
    setNotes(n => n.map(x => x.id === id ? { ...x, body: editText, edited: true } : x));
    setEditingId(null);
  }

  return (
    <div className="det-card">
      <div className="det-card-head">
        <div className="title">Notes</div>
        <span className="muted small">{notes.length} entr{notes.length === 1 ? 'y' : 'ies'} · newest first</span>
      </div>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--grey-100)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Avatar email={ME_EMAIL} />
          <div style={{ flex: 1 }}>
            <textarea className="note-input" placeholder="Add a note… (visible to the whole tax team, timestamped)" value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote(); }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <span className="muted small">⌘↵ to post</span>
              <button className="btn primary sm" onClick={addNote} disabled={!draft.trim()}>Add note</button>
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding: '4px 14px 12px' }}>
        {notes.slice().reverse().map(n => (
          <div key={n.id} className="note-entry">
            <Avatar email={n.author} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="note-meta">
                <strong>{teamByEmail[n.author]?.name || n.author}</strong>
                <span className="muted small mono">{fmtTs(n.at)}</span>
                {n.edited && <span className="muted small">· edited</span>}
                {n.author === ME_EMAIL && editingId !== n.id && (
                  <button className="note-edit-btn" onClick={() => { setEditingId(n.id); setEditText(n.body); }}>Edit</button>
                )}
              </div>
              {editingId === n.id ? (
                <div style={{ marginTop: 4 }}>
                  <textarea className="note-input" value={editText} onChange={e => setEditText(e.target.value)} />
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button className="btn primary sm" onClick={() => saveEdit(n.id)}>Save</button>
                    <button className="btn subtle sm" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="note-body">{n.body}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SideMeta({ pro, projects }) {
  return (
    <div className="det-card">
      <div className="det-card-head">
        <div className="title">Pro details</div>
        <button className="tb-icon-btn" style={{ width: 24, height: 24 }}><Icon name="more" size={14} /></button>
      </div>
      <div style={{ padding: '8px 14px' }}>
        <div className="field"><span className="lbl">Status</span><span className="val"><Pill kind="lifecycle" value={pro.lifecycle_status} /></span></div>
        <div className="field"><span className="lbl">Advisor</span><span className="val" style={{ display:'flex', gap: 6, alignItems: 'center' }}><Avatar email={pro.assigned_advisor_email} /> {teamByEmail[pro.assigned_advisor_email]?.name}</span></div>
        <div className="field"><span className="lbl">OS</span><span className="val" style={{ display:'flex', gap: 6, alignItems: 'center' }}><Avatar email={pro.assigned_os_email} /> {teamByEmail[pro.assigned_os_email]?.name}</span></div>
        <div className="field"><span className="lbl">Entity</span><span className="val">{ENUM_LABELS.ENTITY_TYPE[pro.entity_type]}</span></div>
        <div className="field"><span className="lbl">State</span><span className="val">{pro.state}</span></div>
        <div className="field"><span className="lbl">Vertical</span><span className="val">{pro.vertical}</span></div>
        <div className="field"><span className="lbl">Docs</span><span className="val">{ENUM_LABELS.DOC_COLLECTION_STATUS[pro.doc_collection_status]}</span></div>
        <div className="field"><span className="lbl">Last filed</span><span className={'val' + (pro.last_filing_year ? '' : ' empty')}>{pro.last_filing_year || '—'}</span></div>
        <div className="field"><span className="lbl">Active projects</span><span className="val mono">{projects.filter(p => p.pipeline_status !== 'COMPLETE').length}</span></div>
        {pro.at_risk && (
          <div className="field"><span className="lbl">At risk</span><span className="val" style={{ color: 'var(--warning-dark)' }}><Icon name="alert" size={13} /> {pro.at_risk_reason}</span></div>
        )}
        <div style={{ marginTop: 12, borderTop: '1px solid var(--grey-100)', paddingTop: 12 }}>
          <div className="muted small">Drive folder</div>
          <a className="cell-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Icon name="folder" size={14} /> {pro.business_name} ({pro.org_id})-TAX
          </a>
        </div>
      </div>
    </div>
  );
}


function AuditTab({ id, entityType }) {
  const events = [
    { ts: 'Today · 11:42a',    actor: 'morgan.knox',     change: 'Updated', field: 'doc_collection_status', from: 'WAITING', to: 'PARTIAL' },
    { ts: 'Today · 11:38a',    actor: 'morgan.knox',     change: 'Completed task', field: 'task',         from: '',         to: 'Send organizer to pro' },
    { ts: 'Yesterday · 4:22p', actor: 'amelia.brooks',   change: 'Updated', field: 'inha_remarks',           from: '',         to: 'Books current through Apr; May statements pending' },
    { ts: 'Yesterday · 9:10a', actor: 'amelia.brooks',   change: 'Created task',  field: 'task',           from: '',         to: 'Send organizer to pro' },
    { ts: 'May 8 · 2:13p',     actor: 'morgan.knox',     change: 'Transitioned lifecycle', field: 'lifecycle_status', from: 'ONBOARDED', to: 'ACTIVE_PROJECT' },
    { ts: 'May 8 · 2:13p',     actor: 'morgan.knox',     change: 'Created project', field: 'project',      from: '',         to: 'PRJ-749297-2024-1040' },
    { ts: 'May 8 · 2:11p',     actor: 'morgan.knox',     change: 'Materialized tasks',  field: 'tasks',    from: '',         to: '23 from ProTaskTemplates v3' },
    { ts: 'May 6 · 10:02a',    actor: 'aria.morgan',     change: 'Updated', field: 'assigned_advisor_email', from: '',       to: 'ashley.laudermilk@housecallpro.com' },
    { ts: 'May 6 · 9:58a',     actor: 'aria.morgan',     change: 'Provisioned Drive folder', field: 'drive_folder_id', from: '', to: '1xK...m9P' },
    { ts: 'May 6 · 9:55a',     actor: 'aria.morgan',     change: 'Created pro', field: 'pro',              from: '',         to: id },
  ];
  return (
    <div className="det-card">
      <div className="det-card-head"><div className="title">Audit trail</div><span className="muted small">Last 50 events · sourced from AuditLog</span></div>
      <table className="tmpl-tbl">
        <thead><tr><th style={{ width: 140 }}>When</th><th style={{ width: 140 }}>Actor</th><th style={{ width: 180 }}>Action</th><th>From → To</th></tr></thead>
        <tbody>
          {events.map((e, i) => (
            <tr key={i}>
              <td className="muted mono small">{e.ts}</td>
              <td><span style={{ display:'inline-flex', gap: 6, alignItems: 'center' }}><Avatar email={e.actor + '@housecallpro.com'} /> {e.actor}</span></td>
              <td>{e.change} <span className="muted small">{e.field}</span></td>
              <td className="muted small">{e.from && <><span className="mono">{e.from}</span> → </>}<span className="mono">{e.to}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---- Work timer: one per project, blocks concurrent timers for same user ---- */
/* Global registry so a user can only run one timer at a time across projects. */
window.__activeTimer = window.__activeTimer || null; // { projectId, startedAt }
function useWorkTimer(projectId) {
  const [running, setRunning] = React.useState(() => window.__activeTimer?.projectId === projectId);
  const [startedAt, setStartedAt] = React.useState(() => window.__activeTimer?.projectId === projectId ? window.__activeTimer.startedAt : null);
  const [elapsed, setElapsed] = React.useState(0);
  const [conflict, setConflict] = React.useState(null);

  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [running, startedAt]);

  function start() {
    if (window.__activeTimer && window.__activeTimer.projectId !== projectId) {
      const other = PROJECTS.find(p => p.project_id === window.__activeTimer.projectId);
      setConflict(other ? other.business_name : window.__activeTimer.projectId);
      return;
    }
    const now = Date.now();
    window.__activeTimer = { projectId, startedAt: now };
    setStartedAt(now); setElapsed(0); setRunning(true);
    SyncBus.start('timer start');
  }
  function stop() {
    window.__activeTimer = null;
    setRunning(false);
    SyncBus.start('time entry');
  }
  function forceSwitch() {
    window.__activeTimer = null;
    setConflict(null);
    start();
  }
  return { running, elapsed, start, stop, conflict, dismissConflict: () => setConflict(null), forceSwitch };
}

function fmtElapsed(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h > 0 ? h + ':' : '') + String(m).padStart(h > 0 ? 2 : 1, '0') + ':' + String(s).padStart(2, '0');
}

function WorkTimerButton({ timer }) {
  return (
    <div style={{ position: 'relative' }}>
      {timer.running ? (
        <button className="btn timer-running" onClick={timer.stop} title="Stop timer & log time">
          <span className="timer-dot" /> <span className="mono">{fmtElapsed(timer.elapsed)}</span> <Icon name="stop" size={13} />
        </button>
      ) : (
        <button className="btn" onClick={timer.start} title="Start work timer">
          <Icon name="play" size={13} /> Start timer
        </button>
      )}
      {timer.conflict && (
        <div className="popover" style={{ right: 0, left: 'auto', minWidth: 280, top: 'calc(100% + 6px)' }}>
          <h6>Timer already running</h6>
          <p className="small" style={{ margin: '0 0 10px', color: 'var(--fg-secondary)' }}>
            You have a timer running on <strong>{timer.conflict}</strong>. Stop it before starting a new one.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn sm subtle" onClick={timer.dismissConflict}>Cancel</button>
            <button className="btn sm primary" onClick={timer.forceSwitch}>Stop that &amp; start here</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Time & stages tab: stage timeline + durations + logged time ---- */
function StageAndTimeTab({ project, timer }) {
  const history = React.useMemo(() => makeStageHistory(project), [project.project_id]);
  const entries = TIME_ENTRIES.filter(e => e.project_id === project.project_id);
  const totalMin = entries.reduce((s, e) => s + e.duration_min, 0);
  const byUser = {};
  entries.forEach(e => { byUser[e.user_email] = (byUser[e.user_email] || 0) + e.duration_min; });

  function exportStages() {
    const csv = toCSV(history, [
      { key: 'from_stage', label: 'From stage', value: r => r.from_stage ? (ENUM_LABELS.PIPELINE_STATUS[r.from_stage] || r.from_stage) : '(created)' },
      { key: 'to_stage', label: 'To stage', value: r => ENUM_LABELS.PIPELINE_STATUS[r.to_stage] || r.to_stage },
      { key: 'changed_at', label: 'Changed at' },
      { key: 'changed_by', label: 'Changed by' },
      { key: 'days_in_prev_stage', label: 'Days in prev stage' },
    ]);
    downloadCSV(project.project_id + '-stage-history.csv', csv);
  }
  function exportTime() {
    const csv = toCSV(entries, [
      { key: 'user_email', label: 'User' },
      { key: 'started_at', label: 'Started' },
      { key: 'stopped_at', label: 'Stopped' },
      { key: 'duration_min', label: 'Minutes' },
    ]);
    downloadCSV(project.project_id + '-time-entries.csv', csv);
  }

  return (
    <div className="det-grid">
      <div className="det-main" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="det-card">
          <div className="det-card-head">
            <div className="title">Stage timeline</div>
            <button className="btn sm" onClick={exportStages}><Icon name="download" size={12} /> Export CSV</button>
          </div>
          <div style={{ padding: '8px 16px 16px' }}>
            {history.map((h, i) => (
              <div key={i} className="stage-step">
                <div className="stage-rail">
                  <span className="stage-node" />
                  {i < history.length - 1 && <span className="stage-line" />}
                </div>
                <div className="stage-body">
                  <div className="stage-top">
                    <Pill kind="pipeline" value={h.to_stage} />
                    {h.days_in_prev_stage != null && (
                      <span className="muted small">{h.days_in_prev_stage} day{h.days_in_prev_stage === 1 ? '' : 's'} in {ENUM_LABELS.PIPELINE_STATUS[h.from_stage]}</span>
                    )}
                  </div>
                  <div className="muted small" style={{ marginTop: 2 }}>
                    <span className="mono">{h.changed_at}</span> · moved by {teamByEmail[h.changed_by]?.name || h.changed_by}
                  </div>
                </div>
              </div>
            ))}
            {timer.running && (
              <div className="stage-step">
                <div className="stage-rail"><span className="stage-node live" /></div>
                <div className="stage-body">
                  <span className="muted small">Currently in <strong>{ENUM_LABELS.PIPELINE_STATUS[project.pipeline_status]}</strong> — timer running</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="det-card">
          <div className="det-card-head">
            <div className="title">Logged time — {(totalMin / 60).toFixed(1)} hrs total</div>
            <button className="btn sm" onClick={exportTime}><Icon name="download" size={12} /> Export CSV</button>
          </div>
          <table className="tmpl-tbl">
            <thead><tr><th>Who</th><th>Started</th><th>Stopped</th><th style={{ width: 90 }}>Duration</th></tr></thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i}>
                  <td><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Avatar email={e.user_email} /> {teamByEmail[e.user_email]?.name}</span></td>
                  <td className="mono small">{e.started_at}</td>
                  <td className="mono small">{e.stopped_at}</td>
                  <td className="mono">{Math.floor(e.duration_min / 60)}h {e.duration_min % 60}m</td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan="4" className="muted" style={{ textAlign: 'center', padding: 20 }}>No time logged yet. Use "Start timer" while working the return.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="det-side">
        <div className="det-card">
          <div className="det-card-head"><div className="title">Cycle time</div></div>
          <div style={{ padding: '10px 14px' }}>
            <div className="field"><span className="lbl">Total in pipeline</span><span className="val mono">{history.reduce((s, h) => s + (h.days_in_prev_stage || 0), 0)} days</span></div>
            <div className="field"><span className="lbl">Current stage</span><span className="val"><Pill kind="pipeline" value={project.pipeline_status} /></span></div>
            <div className="field"><span className="lbl">Transitions</span><span className="val mono">{history.length}</span></div>
            <div className="field"><span className="lbl">Actual time logged</span><span className="val mono">{(totalMin / 60).toFixed(1)} hrs</span></div>
          </div>
        </div>
        <div className="det-card">
          <div className="det-card-head"><div className="title">Time by person</div></div>
          <div style={{ padding: '10px 14px' }}>
            {Object.entries(byUser).map(([email, min]) => (
              <div key={email} className="field"><span className="lbl" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Avatar email={email} /> {teamByEmail[email]?.name}</span><span className="val mono">{(min / 60).toFixed(1)}h</span></div>
            ))}
            {Object.keys(byUser).length === 0 && <span className="muted small">No entries yet.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Project detail ---- */
function ProjectDetail({ projectId, onNav }) {
  const project = PROJECTS.find(p => p.project_id === projectId) || PROJECTS[0];
  const pro = PROS.find(p => p.org_id === project.org_id);
  const [tab, setTab] = React.useState('tasks');
  const [tasks, setTasks] = React.useState(() => makeProjectTasks());
  const [projNotes] = React.useState(() => makeProjectNotes());
  const timer = useWorkTimer(project.project_id);

  const toggleTask = (id) => {
    SyncBus.start('task');
    setTasks(secs => secs.map(s => ({
      ...s,
      items: s.items.map(t => {
        if (t.id === id) return { ...t, status: t.status === 'DONE' ? 'IN_PROGRESS' : 'DONE', _justSaved: Date.now() };
        if (t.subtasks) {
          return { ...t, subtasks: t.subtasks.map(st => st.id === id ? { ...st, status: st.status === 'DONE' ? 'IN_PROGRESS' : 'DONE' } : st) };
        }
        return t;
      })
    })));
  };

  return (
    <div data-screen-label="Project detail">
      <div className="ph">
        <div style={{ minWidth: 0 }}>
          <div className="ph-title">
            <span className="av xl" style={{ background: 'var(--primary-main)' }}><Icon name="briefcase" size={18} /></span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {project.business_name}
                <span className="muted small">· TY{project.tax_year} {ENUM_LABELS.FILING_TYPE[project.filing_type]}</span>
              </div>
              <div className="ph-meta" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className="mono">{project.project_id}</span>
                <span>·</span>
                <Pill kind="pipeline" value={project.pipeline_status} />
                <span>·</span>
                <span className={'mono ' + dueClass(project.filing_deadline)} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  <Icon name="clock" size={12} /> Deadline {fmtDue(project.filing_deadline, true)}
                </span>
                {project.blocker_reason && (<><span>·</span><span style={{ color: 'var(--error-main)' }}><Icon name="alert" size={12} /> {project.blocker_reason}</span></>)}
              </div>
            </div>
          </div>
        </div>
        <div className="ph-actions">
          <WorkTimerButton timer={timer} />
          <button className="btn"><Icon name="paperclip" size={14} /> Files</button>
          <button className="btn"><Icon name="more" size={14} /></button>
          <button className="btn primary"><Icon name="check" size={14} /> Advance stage</button>
        </div>
      </div>

      <div className="view-tabs">
        <button className={'view-tab' + (tab === 'tasks' ? ' active' : '')} onClick={() => setTab('tasks')}>
          <Icon name="check-circle" size={14} /> Tasks
          <span className="badge">{tasks.reduce((s, sec) => s + sec.items.length + sec.items.reduce((q, t) => q + (t.subtasks?.length || 0), 0), 0)}</span>
        </button>
        <button className={'view-tab' + (tab === 'overview' ? ' active' : '')} onClick={() => setTab('overview')}><Icon name="file-text" size={14} /> Overview</button>
        <button className={'view-tab' + (tab === 'stages' ? ' active' : '')} onClick={() => setTab('stages')}><Icon name="timer" size={14} /> Time &amp; stages</button>
        <button className={'view-tab' + (tab === 'outstanding' ? ' active' : '')} onClick={() => setTab('outstanding')}><Icon name="flag" size={14} /> Outstanding items</button>
        <button className={'view-tab' + (tab === 'notes' ? ' active' : '')} onClick={() => setTab('notes')}><Icon name="file-text" size={14} /> Notes <span className="badge">{projNotes.length}</span></button>
        <button className={'view-tab' + (tab === 'audit' ? ' active' : '')} onClick={() => setTab('audit')}><Icon name="history" size={14} /> Audit</button>
      </div>

      {tab === 'stages' && <StageAndTimeTab project={project} timer={timer} />}

      {tab === 'tasks' && (
        <div className="det-grid">
          <div className="det-main">
            <TaskList sections={tasks} onToggleTask={toggleTask} />
          </div>
          <div className="det-side">
            <ProjectSideMeta project={project} pro={pro} onNav={onNav} />
          </div>
        </div>
      )}

      {tab === 'overview' && (
        <div className="det-grid">
          <div className="det-main det-card">
            <FieldGroup title="Project">
              <Field label="Filing type" value={ENUM_LABELS.FILING_TYPE[project.filing_type]} />
              <Field label="Tax year" value={project.tax_year} mono />
              <Field label="Filing deadline" value={fmtDue(project.filing_deadline, true)} mono />
              <Field label="Project start" value="May 6, 2026" mono />
              <Field label="States covered" value={project.states_covered} />
              <Field label="Project ID" value={project.project_id} mono />
            </FieldGroup>
            <FieldGroup title="Schedule & status">
              <Field label="Stage" pill={<Pill kind="pipeline" value={project.pipeline_status} />} />
              <Field label="Extension needed?" value={project.extension_needed ? 'Yes' : 'No'} />
              <Field label="Extension filed?" value={project.extension_filed ? 'Yes' : 'No'} />
              <Field label="E-file date" value={project.efile_date ? fmtDue(project.efile_date, true) : '—'} empty={!project.efile_date} mono />
            </FieldGroup>
            <FieldGroup title="People">
              <Field label="Tax advisor" pill={<span style={{ display:'inline-flex', gap: 6, alignItems: 'center' }}><Avatar email={project.tax_advisor_email} /> {teamByEmail[project.tax_advisor_email]?.name}</span>} />
              <Field label="Tax preparer" pill={<span style={{ display:'inline-flex', gap: 6, alignItems: 'center' }}><Avatar email={project.tax_preparer_email} /> {teamByEmail[project.tax_preparer_email]?.name}</span>} />
              <Field label="Peer reviewer" pill={project.peer_reviewer_email ? <span style={{ display:'inline-flex', gap: 6, alignItems: 'center' }}><Avatar email={project.peer_reviewer_email} /> {teamByEmail[project.peer_reviewer_email]?.name}</span> : <span className="muted">— unassigned —</span>} />
              <Field label="OS" pill={<span style={{ display:'inline-flex', gap: 6, alignItems: 'center' }}><Avatar email={project.os_email} /> {teamByEmail[project.os_email]?.name}</span>} />
            </FieldGroup>
            <FieldGroup title="Coverage & complexity" defaultOpen={false}>
              <Field label="Complexity" value={project.complexity} />
              <Field label="Tax risk level" value="Medium" />
              <Field label="States covered" value={project.states_covered} />
            </FieldGroup>
            <FieldGroup title="Books & billing" defaultOpen={false}>
              <Field label="Billing kind" value="Subscription credit" />
              <Field label="Add-ons" empty />
            </FieldGroup>
          </div>
          <div className="det-side">
            <ProjectSideMeta project={project} pro={pro} onNav={onNav} />
          </div>
        </div>
      )}

      {tab === 'outstanding' && <OutstandingItems />}

      {tab === 'notes' && (
        <div className="det-grid">
          <div className="det-main"><NotesThread seed={projNotes} /></div>
          <div className="det-side"><ProjectSideMeta project={project} pro={pro} onNav={onNav} /></div>
        </div>
      )}

      {tab === 'audit' && <AuditTab id={project.project_id} entityType="project" />}
    </div>
  );
}

function OutstandingItems() {
  const [items, setItems] = React.useState([]);
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState({ item: '', owner: '', due: '' });
  function save() {
    if (!draft.item.trim()) { setAdding(false); return; }
    SyncBus.start('outstanding item');
    setItems(x => [...x, { ...draft, id: 'oi-' + Date.now() }]);
    setDraft({ item: '', owner: '', due: '' });
    setAdding(false);
  }
  return (
    <div className="det-card">
      <div className="det-card-head">
        <div className="title">Outstanding items</div>
        <button className="btn sm" onClick={() => setAdding(true)}><Icon name="plus" size={12} /> Add item</button>
      </div>
      <table className="tmpl-tbl">
        <thead><tr><th>Item</th><th style={{ width: 160 }}>Owner</th><th style={{ width: 130 }}>Due</th><th style={{ width: 40 }}></th></tr></thead>
        <tbody>
          {items.map(it => (
            <tr key={it.id}>
              <td>{it.item}</td>
              <td>{it.owner ? <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Avatar email={it.owner} /> {teamByEmail[it.owner]?.name || it.owner}</span> : <span className="muted">—</span>}</td>
              <td className="mono">{it.due || '—'}</td>
              <td><button className="tb-icon-btn" style={{ width: 24, height: 24 }} onClick={() => setItems(x => x.filter(y => y.id !== it.id))}><Icon name="x" size={13} /></button></td>
            </tr>
          ))}
          {adding && (
            <tr>
              <td><input className="note-input" style={{ minHeight: 0, height: 32 }} autoFocus placeholder="What's outstanding?" value={draft.item} onChange={e => setDraft(d => ({ ...d, item: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setAdding(false); }} /></td>
              <td><select className="note-input" style={{ minHeight: 0, height: 32 }} value={draft.owner} onChange={e => setDraft(d => ({ ...d, owner: e.target.value }))}><option value="">Unassigned</option>{TEAM.map(t => <option key={t.email} value={t.email}>{t.name}</option>)}</select></td>
              <td><input type="date" className="note-input" style={{ minHeight: 0, height: 32 }} value={draft.due} onChange={e => setDraft(d => ({ ...d, due: e.target.value }))} /></td>
              <td><button className="btn primary sm" onClick={save}>Add</button></td>
            </tr>
          )}
          {items.length === 0 && !adding && (
            <tr><td colSpan="4" className="muted" style={{ textAlign: 'center', padding: 24 }}>No outstanding items. Click "Add item" to track a request.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ProjectSideMeta({ project, pro, onNav }) {
  return (
    <div className="det-card">
      <div className="det-card-head"><div className="title">Project details</div></div>
      <div style={{ padding: '8px 14px' }}>
        <div className="field"><span className="lbl">Pro</span><span className="val"><a className="cell-link" onClick={() => onNav('pro-detail', { orgId: project.org_id })}>{project.business_name}</a></span></div>
        <div className="field"><span className="lbl">Stage</span><span className="val"><Pill kind="pipeline" value={project.pipeline_status} /></span></div>
        <div className="field"><span className="lbl">Filing</span><span className="val">{ENUM_LABELS.FILING_TYPE[project.filing_type]}</span></div>
        <div className="field"><span className="lbl">Tax year</span><span className="val mono">{project.tax_year}</span></div>
        <div className="field"><span className="lbl">Deadline</span><span className={'val mono ' + dueClass(project.filing_deadline)}>{fmtDue(project.filing_deadline, true)}</span></div>
        <div className="field"><span className="lbl">Advisor</span><span className="val" style={{ display:'flex', gap: 6, alignItems: 'center' }}><Avatar email={project.tax_advisor_email} /> {teamByEmail[project.tax_advisor_email]?.name}</span></div>
        <div className="field"><span className="lbl">Preparer</span><span className="val" style={{ display:'flex', gap: 6, alignItems: 'center' }}><Avatar email={project.tax_preparer_email} /> {teamByEmail[project.tax_preparer_email]?.name}</span></div>
        <div className="field"><span className="lbl">Peer reviewer</span>
          <span className="val" style={{ display:'flex', gap: 6, alignItems: 'center' }}>
            {project.peer_reviewer_email
              ? <><Avatar email={project.peer_reviewer_email} /> {teamByEmail[project.peer_reviewer_email]?.name}</>
              : <span className="muted">unassigned</span>}
          </span>
        </div>
        <div className="field"><span className="lbl">Progress</span><span className="val"><ProgressBar pct={project.progress} /></span></div>
        <div style={{ marginTop: 12, borderTop: '1px solid var(--grey-100)', paddingTop: 12 }}>
          <div className="muted small">Drive folder</div>
          <a className="cell-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Icon name="folder" size={14} /> {pro?.business_name} ({project.org_id})-TAX / {project.tax_year}
          </a>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ProDetail, ProjectDetail, TaskList, ProgressBar });
