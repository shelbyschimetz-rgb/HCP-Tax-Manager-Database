/* Nested task list — the daily driver. One "+ Add task" button, sections, subtasks, checklists. */
import React from 'react';
import { Icon, Avatar, PersonName, SavedTick, MoreMenu, confirmDialog } from './ui.jsx';
import { useStore, toggleTask, createTask, updateTask, deleteTask, toggleChecklistItem, mutate, mergeTasks } from './store.js';
import { dueClass, fmtDue, sectionLabel, ROLE_LABELS, cx } from './util.js';

const SECTION_ORDER = ['ONBOARDING_SETUP', 'RETURN_PREP_KICKOFF', 'ADVISORY_WORK', 'DOC_GATHERING', 'EXTENSION', 'PREP', 'INTERNAL_REVIEW_QC', 'CLIENT_REVIEW', 'FILING_DELIVERY'];

function AssigneeCell({ task }) {
  const team = useStore((s) => s.team);
  const [editing, setEditing] = React.useState(false);
  if (editing) {
    return (
      <span className="tk-assignee" onClick={(e) => e.stopPropagation()}>
        <select className="tm-inline-input" autoFocus value={task.assignee_email || ''}
          onChange={(e) => { setEditing(false); updateTask(task, { assignee_email: e.target.value }); }}
          onBlur={() => setEditing(false)} onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}>
          <option value="">Unassigned</option>
          {team.filter((m) => m.active).map((m) => <option key={m.email} value={m.email}>{m.name}</option>)}
        </select>
      </span>
    );
  }
  return (
    <span className="tk-assignee tm-editable" onClick={(e) => { e.stopPropagation(); setEditing(true); }} title="Change assignee">
      <Avatar email={task.assignee_email} empty={!task.assignee_email} />
      <span className="name">{task.assignee_email ? <PersonName email={task.assignee_email} /> : <span className="role-tag">{ROLE_LABELS[task.assignee_role] || 'unassigned'}</span>}</span>
    </span>
  );
}

function DueCell({ task }) {
  const [editing, setEditing] = React.useState(false);
  if (editing) {
    return (
      <span className="tk-due" onClick={(e) => e.stopPropagation()}>
        <input type="date" className="tm-inline-input" autoFocus defaultValue={task.due_date || ''}
          onBlur={(e) => { setEditing(false); if (e.target.value !== (task.due_date || '')) updateTask(task, { due_date: e.target.value }); }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }} />
      </span>
    );
  }
  return (
    <span className={'tk-due tm-editable ' + (task.status !== 'DONE' ? dueClass(task.due_date) : '')} title="Change due date"
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}>
      {task.due_date ? fmtDue(task.due_date) : <span className="muted">—</span>}
    </span>
  );
}

function TaskRow({ task, all, depth = 0, onAddSub, dnd }) {
  const [open, setOpen] = React.useState(true);
  const [checklistOpen, setChecklistOpen] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState(false);
  const subs = all.filter((t) => t.parent_task_id === task.task_id);
  const hasSubs = subs.length > 0;
  const hasChecklist = task.checklist && task.checklist.length > 0;
  const done = task.status === 'DONE';
  const blockers = String(task.blocked_by || '').split(',').filter(Boolean);
  const openBlockers = blockers.filter((id) => { const b = all.find((t) => t.task_id === id); return !b || b.status !== 'DONE'; });
  const pending = String(task.task_id).startsWith('tmp-');

  return (
    <>
      <div className={cx('tk-row', done && 'done', task.status === 'SKIPPED' && 'skipped', depth > 0 && 'subtask', depth >= 2 && 'depth-2', !hasSubs && !hasChecklist && 'no-expand', dnd.over === task.task_id && 'drop-above', pending && 'pending')}
        draggable={depth === 0 && !pending}
        onDragStart={(e) => { dnd.start(task); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', task.task_id); }}
        onDragOver={(e) => { if (dnd.dragging && dnd.dragging.section === task.section && depth === 0) { e.preventDefault(); dnd.setOver(task.task_id); } }}
        onDrop={(e) => { e.preventDefault(); dnd.drop(task); }}
        onDragEnd={dnd.end}
        onClick={() => (hasChecklist ? setChecklistOpen(!checklistOpen) : null)}>
        <button className="drag" onClick={(e) => e.stopPropagation()} title="Drag to reorder"><Icon name="drag" size={14} /></button>
        {hasSubs ? (
          <button className="expand" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}><Icon name={open ? 'chevron-down' : 'chevron-right'} size={13} /></button>
        ) : <span className="expand" />}
        <span className="tk-title">
          <button className={'tk-check' + (done ? ' done' : '')} disabled={pending} title={done ? 'Mark not done' : 'Mark done'}
            onClick={(e) => { e.stopPropagation(); toggleTask(task); }}>
            {done && <Icon name="check" size={11} />}
          </button>
          {editTitle ? (
            <input className="tm-inline-input" autoFocus defaultValue={task.title} onClick={(e) => e.stopPropagation()}
              onBlur={(e) => { setEditTitle(false); const v = e.target.value.trim(); if (v && v !== task.title) updateTask(task, { title: v }); }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditTitle(false); }} />
          ) : (
            <span className="text" onDoubleClick={(e) => { e.stopPropagation(); setEditTitle(true); }} title="Double-click to rename">{task.title}</span>
          )}
          <SavedTick savedKey={'task:' + task.task_id} />
          {hasSubs && <span className="subt-count" title={`${subs.length} subtask${subs.length === 1 ? '' : 's'}`}><Icon name="link" size={11} /> {subs.filter((s) => s.status === 'DONE').length}/{subs.length}</span>}
          {hasChecklist && <span className="badge-checklist" title="Checklist task — click to expand">{task.checklist.filter((c) => c.checked).length}/{task.checklist.length} verified</span>}
          {openBlockers.length > 0 && <span className="badge-blocked" title={'Waiting on: ' + openBlockers.map((id) => (all.find((t) => t.task_id === id) || {}).title).filter(Boolean).join(', ')}>blocked</span>}
        </span>
        <DueCell task={task} />
        <AssigneeCell task={task} />
        <MoreMenu items={[
          depth === 0 && { label: 'Add subtask', icon: 'plus', onClick: () => onAddSub(task) },
          { label: 'Rename', icon: 'edit', onClick: () => setEditTitle(true) },
          task.status !== 'SKIPPED' && task.status !== 'DONE' && { label: 'Skip (not applicable)', icon: 'x', onClick: () => updateTaskStatus(task, 'SKIPPED') },
          task.status === 'SKIPPED' && { label: 'Un-skip', icon: 'refresh', onClick: () => updateTaskStatus(task, 'NOT_STARTED') },
          { label: 'Delete task', icon: 'trash', danger: true, onClick: async () => { if (await confirmDialog('Delete "' + task.title + '"?', { message: hasSubs ? 'Its subtasks are deleted too.' : '', ok: 'Delete', danger: true })) deleteTask(task); } },
        ]} />
      </div>
      {hasChecklist && checklistOpen && (
        <div className="tk-checklist">
          {task.checklist.map((c) => (
            <label key={c.id} className={'item' + (c.checked ? ' checked' : '')}>
              <input type="checkbox" checked={!!c.checked} onChange={(e) => toggleChecklistItem(task, c.id, e.target.checked)} />
              <span>{c.label}</span>
            </label>
          ))}
        </div>
      )}
      {hasSubs && open && subs.map((s) => <TaskRow key={s.task_id} task={s} all={all} depth={depth + 1} onAddSub={onAddSub} dnd={dnd} />)}
    </>
  );
}

function updateTaskStatus(task, status) {
  const before = { ...task };
  return mutate({
    label: 'task', what: task.title, action: 'setTaskStatus', payload: { task_id: task.task_id, status },
    optimistic: () => { mergeTasks([{ ...task, status }]); return () => mergeTasks([before]); },
    apply: (d) => mergeTasks(d.tasks),
  }).catch(() => {});
}

function TaskSection({ section, items, all, onAddSub, dnd }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const counted = all.filter((t) => t.section === section && t.status !== 'SKIPPED');
  const done = counted.filter((t) => t.status === 'DONE').length;
  const pct = counted.length === 0 ? 0 : Math.round((done / counted.length) * 100);
  return (
    <div className={'tk-section' + (collapsed ? ' collapsed' : '')}>
      <div className="tk-section-head" onClick={() => setCollapsed(!collapsed)}>
        <span className="caret"><Icon name="chevron-down" size={13} /></span>
        <span className="title">{sectionLabel(section)}</span>
        <span className="count">{done}/{counted.length}</span>
        <span className="progress"><div style={{ width: pct + '%' }} /></span>
        <span className="progress-pct">{pct}%</span>
      </div>
      <div className="tk-list">
        {items.map((t) => <TaskRow key={t.task_id} task={t} all={all} onAddSub={onAddSub} dnd={dnd} />)}
      </div>
    </div>
  );
}

export function TaskList({ entityType, entityId, tasks, loading }) {
  const team = useStore((s) => s.team);
  const [composing, setComposing] = React.useState(false);
  const [hideDone, setHideDone] = React.useState(false);
  const [draft, setDraft] = React.useState({ section: '', title: '', assignee_email: '', due_date: '', parent_task_id: '' });
  const [dragging, setDragging] = React.useState(null);
  const [over, setOver] = React.useState(null);
  const titleRef = React.useRef(null);
  const idleRef = React.useRef(null);

  const all = (tasks || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const present = [...new Set(all.map((t) => t.section))];
  const defaults = entityType === 'PRO' ? ['ONBOARDING_SETUP', 'RETURN_PREP_KICKOFF', 'ADVISORY_WORK'] : ['DOC_GATHERING', 'EXTENSION', 'PREP', 'INTERNAL_REVIEW_QC', 'CLIENT_REVIEW', 'FILING_DELIVERY'];
  const sections = [...new Set([...SECTION_ORDER.filter((s) => present.includes(s) || defaults.includes(s)), ...present])];
  const visible = all.filter((t) => !(hideDone && (t.status === 'DONE' || t.status === 'SKIPPED')));

  const bumpIdle = React.useCallback(() => {
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(() => setComposing(false), 60000);
  }, []);
  React.useEffect(() => () => clearTimeout(idleRef.current), []);
  React.useEffect(() => { if (composing && titleRef.current) titleRef.current.focus(); }, [composing, draft.parent_task_id]);

  function startCompose(parent) {
    setDraft({ section: parent ? parent.section : sections[0] || 'GENERAL', title: '', assignee_email: parent ? parent.assignee_email || '' : '', due_date: parent ? parent.due_date || '' : '', parent_task_id: parent ? parent.task_id : '' });
    setComposing(true);
    bumpIdle();
  }
  function submit() {
    if (!draft.title.trim()) return;
    createTask({ entity_type: entityType, entity_id: entityId, section: draft.section, title: draft.title.trim(), assignee_email: draft.assignee_email, due_date: draft.due_date, parent_task_id: draft.parent_task_id });
    setDraft((d) => ({ ...d, title: '' }));
    bumpIdle();
    if (titleRef.current) titleRef.current.focus();
  }
  function onKey(e) {
    bumpIdle();
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    if (e.key === 'Escape') { e.stopPropagation(); setComposing(false); }
  }

  const dnd = {
    dragging, over, setOver,
    start: (t) => setDragging(t),
    end: () => { setDragging(null); setOver(null); },
    drop: (target) => {
      const t = dragging;
      setDragging(null); setOver(null);
      if (!t || t.task_id === target.task_id || t.section !== target.section) return;
      const siblings = all.filter((x) => x.section === t.section && !x.parent_task_id && x.task_id !== t.task_id);
      const idx = siblings.findIndex((x) => x.task_id === target.task_id);
      const prev = siblings[idx - 1];
      const order = prev ? ((prev.sort_order || 0) + (target.sort_order || 0)) / 2 : (target.sort_order || 0) - 1;
      updateTask(t, { sort_order: order });
    },
  };

  const parent = draft.parent_task_id ? all.find((t) => t.task_id === draft.parent_task_id) : null;

  return (
    <div className="task-shell">
      <div className="tk-toolbar">
        <button className="btn primary sm" onClick={() => startCompose()}><Icon name="plus" size={13} /> Add task</button>
        <span className="muted small" style={{ marginLeft: 12 }}>
          {loading ? 'Loading tasks…' : `${all.length} tasks across ${sections.filter((s) => all.some((t) => t.section === s)).length} sections`}
        </span>
        <span className="spacer" />
        <button className={cx('btn subtle sm', hideDone && 'active')} onClick={() => setHideDone(!hideDone)} title="Show / hide done">
          <Icon name="eye" size={12} /> {hideDone ? 'Show done' : 'Hide done'}
        </button>
      </div>
      {composing && (
        <div className="tk-compose" onMouseMove={bumpIdle}>
          <span className="dot" />
          <input ref={titleRef} className="title-input" placeholder={parent ? `Subtask of "${parent.title}"…` : 'Write a task name…'}
            value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} onKeyDown={onKey} />
          {!parent && (
            <select value={draft.section} onChange={(e) => setDraft((d) => ({ ...d, section: e.target.value }))} onKeyDown={onKey} title="Section">
              {sections.map((s) => <option key={s} value={s}>{sectionLabel(s)}</option>)}
            </select>
          )}
          <select value={draft.assignee_email} onChange={(e) => setDraft((d) => ({ ...d, assignee_email: e.target.value }))} onKeyDown={onKey} title="Assignee">
            <option value="">Unassigned</option>
            {team.filter((m) => m.active).map((m) => <option key={m.email} value={m.email}>{m.name}</option>)}
          </select>
          <input type="date" value={draft.due_date} onChange={(e) => setDraft((d) => ({ ...d, due_date: e.target.value }))} title="Due date" className="due-input" onKeyDown={onKey} />
          <button className="btn sm primary" onClick={submit} disabled={!draft.title.trim()}>Add</button>
          <button className="btn sm subtle" onClick={() => setComposing(false)} title="Esc">Cancel</button>
        </div>
      )}
      {loading && !all.length && <div className="muted" style={{ padding: 24, textAlign: 'center' }}>Loading…</div>}
      {sections.map((s) => {
        const items = visible.filter((t) => t.section === s && !t.parent_task_id);
        if (!items.length && !all.some((t) => t.section === s)) return null;
        return <TaskSection key={s} section={s} items={items} all={all.filter((t) => visible.includes(t))} onAddSub={startCompose} dnd={dnd} />;
      })}
      {!loading && all.length === 0 && (
        <div className="muted" style={{ padding: 28, textAlign: 'center' }}>No tasks yet. {entityType === 'PRO' ? 'Claiming the pro from the Inbox materializes the onboarding templates.' : 'Add one above.'}</div>
      )}
    </div>
  );
}
