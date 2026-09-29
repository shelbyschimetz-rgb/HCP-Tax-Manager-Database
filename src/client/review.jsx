/* Tax QA peer review: submit form, the project's Peer review tab, the queue page, and the report. */
import React from 'react';
import { Icon, Avatar, Person, PersonName, Modal, Empty } from './ui.jsx';
import { useStore, api, peerReviewAction, toggleChecklistItem, toast, refreshReviews, loadProject, OPEN_REVIEW } from './store.js';
import { openRecord } from './nav.js';
import { PeopleSelect } from './lists.jsx';
import { label, ENUMS, relTime, fmtTs, toCSV, downloadCSV, today, cx } from './util.js';

const STATUS_CLS = { SUBMITTED: 'pp-IN_QUEUE', IN_REVIEW: 'pp-QA', REWORK: 'pp-IN_QUEUE_ESCALATED', COMPLETE: 'pp-COMPLETE', CANCELLED: 'archived' };
const EVENT_LABELS = {
  SUBMITTED: 'Submitted for review', CLAIMED: 'Claimed the review', RELEASED: 'Released it back to the queue',
  REWORK: 'Sent back for rework', RESUBMITTED: 'Resubmitted', COMPLETED: 'Marked the review complete', CANCELLED: 'Cancelled the review',
};
const ADD_ON_HINT = 'K-1s: only select if more than 4 partners. Multi-state: list the states in Comments.';

export function ReviewPill({ status }) {
  return <span className={'pill ' + (STATUS_CLS[status] || '')}>{label('PEER_REVIEW_STATUS', status)}</span>;
}

export function reviewPerms(r, user, project) {
  const me = user.email;
  const admin = !!user.admin;
  const reviewer = admin || (user.roles || []).includes('PEER_REVIEWER');
  return {
    claim: r.status === 'SUBMITTED' && reviewer && r.submitted_by !== me,
    act: r.status === 'IN_REVIEW' && (r.reviewer_email === me || admin),
    resubmit: r.status === 'REWORK' && (r.submitted_by === me || (project && project.tax_preparer_email === me) || admin),
    cancel: OPEN_REVIEW.includes(r.status) && (r.submitted_by === me || admin),
    release: r.status === 'IN_REVIEW' && (r.reviewer_email === me || admin),
  };
}

function money(v) {
  if (v === '' || v == null) return '';
  const n = Number(v);
  return isNaN(n) ? String(v) : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const MONEY_RE = /^\$?\s*\d{1,3}(,?\d{3})*(\.\d{1,2})?$/;

function splitAddOns(s) { return String(s || '').split(',').map((x) => x.trim()).filter(Boolean); }

function AddOnPicker({ value, onChange }) {
  const opts = ENUMS.PEER_REVIEW_ADD_ONS || [];
  function toggle(o) {
    if (value.includes(o)) { onChange(value.filter((x) => x !== o)); return; }
    onChange(o === 'No add-ons' ? [o] : [...value.filter((x) => x !== 'No add-ons'), o]);
  }
  return (
    <div className="pr-addons" role="group" aria-label="Return add-ons">
      {opts.map((o) => (
        <label key={o} className={cx('pr-addon', value.includes(o) && 'on')}>
          <input type="checkbox" checked={value.includes(o)} onChange={() => toggle(o)} />
          <span>{o}</span>
        </label>
      ))}
    </div>
  );
}

/** Submit a return for peer review, or resubmit after rework (review given). */
export function SubmitReviewModal({ project, review, onClose, onDone }) {
  const user = useStore((s) => s.user);
  const pro = useStore((s) => s.pros.find((p) => p.org_id === project.org_id));
  const resubmit = !!review;
  const known = ENUMS.PEER_REVIEW_ADD_ONS || [];
  const [f, setF] = React.useState({
    safe: review ? (review.safe_harbor_amount ? String(review.safe_harbor_amount) : '') : '',
    addOns: review ? splitAddOns(review.add_ons) : splitAddOns(project.add_ons).filter((a) => known.includes(a)),
    advisor: project.tax_advisor_email || '',
    reviewer: project.peer_reviewer_email && project.peer_reviewer_email !== user.email ? project.peer_reviewer_email : '',
    comments: review ? review.comments || '' : '',
    note: '',
  });
  const [tried, setTried] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e && e.target ? e.target.value : e });
  const addErr = f.addOns.length ? '' : 'Pick the add-ons on this return, or "No add-ons".';
  const safeErr = f.safe.trim() && !MONEY_RE.test(f.safe.trim()) ? 'Enter a dollar amount, like 1250 or $1,250.00.' : '';
  async function submit() {
    setTried(true);
    if (addErr || safeErr) return;
    setBusy(true);
    try {
      const res = resubmit
        ? await peerReviewAction('resubmitPeerReview', { review_id: review.review_id, safe_harbor_amount: f.safe, add_ons: f.addOns, comments: f.comments, note: f.note }, 'resubmit')
        : await peerReviewAction('submitPeerReview', {
          project_id: project.project_id, safe_harbor_amount: f.safe, add_ons: f.addOns, advisor_email: f.advisor, reviewer_email: f.reviewer, comments: f.comments,
        }, 'peer review');
      toast('success', resubmit ? 'Resubmitted. The reviewer has it back.' : res.review.reviewer_email ? 'Sent to peer review. The reviewer has a task.' : 'Sent to peer review. It\'s in the queue for any reviewer to claim.');
      onDone && onDone(res.review);
      onClose();
    } catch (e) { setBusy(false); }
  }
  return (
    <Modal title={resubmit ? 'Resubmit for peer review' : 'Tax QA peer review'} onClose={onClose} width={640}
      footer={<><button className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy} onClick={submit}>{busy ? 'Sending…' : resubmit ? 'Resubmit' : 'Submit for review'}</button></>}>
      <div className="pr-facts">
        <div><span className="lbl">Org ID</span><span className="mono">{project.org_id}</span></div>
        <div><span className="lbl">Company name</span><span>{pro ? pro.business_name : project.business_name}</span></div>
        <div><span className="lbl">Return year</span><span className="mono">{project.tax_year}</span></div>
        <div><span className="lbl">Return type</span><span>{label('FILING_TYPE', project.filing_type)}</span></div>
      </div>
      {resubmit && (
        <div className="wiz-field">
          <label className="lbl">What did you change?</label>
          <textarea className="tm-input" rows={2} autoFocus value={f.note} onChange={set('note')} placeholder="e.g. Added UT TC-65 and fixed the apportionment" />
          {review.last_rework_notes && <span className="hint">Reviewer asked for: {review.last_rework_notes}</span>}
        </div>
      )}
      <div className="wiz-field">
        <label className="lbl" htmlFor="pr-safe">Estimated safe harbor tax payment amount</label>
        <input id="pr-safe" className={cx('tm-input mono', safeErr && 'invalid')} style={{ maxWidth: 220 }} inputMode="decimal" value={f.safe} onChange={set('safe')} placeholder="$0.00" autoFocus={!resubmit} />
        {safeErr && <span className="tm-field-error">{safeErr}</span>}
      </div>
      <div className="wiz-field">
        <label className="lbl">Return add-ons (select all that apply)</label>
        <AddOnPicker value={f.addOns} onChange={set('addOns')} />
        <span className="hint">{ADD_ON_HINT}</span>
        {tried && addErr && <span className="tm-field-error">{addErr}</span>}
      </div>
      {!resubmit && (
        <div className="wiz-row">
          <div className="wiz-field"><label className="lbl">Assigned tax advisor</label><PeopleSelect value={f.advisor} onChange={set('advisor')} roles={['ADVISOR']} /></div>
          <div className="wiz-field"><label className="lbl">Reviewer</label><PeopleSelect value={f.reviewer} onChange={set('reviewer')} roles={['PEER_REVIEWER']} placeholder="Anyone can claim it" />
            <span className="hint">Leave blank to post it to the review queue.</span></div>
        </div>
      )}
      <div className="wiz-field">
        <label className="lbl">Comments</label>
        <textarea className="tm-input" rows={3} value={f.comments} onChange={set('comments')} placeholder="Anything the reviewer should know: transcripts used, states included, open questions" />
      </div>
      <p className="muted small" style={{ margin: 0 }}>Person submitting: <strong>{user.name}</strong>. The return moves to QA and the reviewer gets a task due in 2 days.</p>
    </Modal>
  );
}

function TextModal({ title, message, fieldLabel, placeholder, required, ok, danger, onClose, onSubmit, children }) {
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  async function go() {
    if (required && !text.trim()) return;
    setBusy(true);
    try { await onSubmit(text.trim()); onClose(); } catch (e) { setBusy(false); }
  }
  return (
    <Modal title={title} onClose={onClose} width={520}
      footer={<><button className="btn subtle" onClick={onClose}>Cancel</button><button className={cx('btn', danger ? 'danger' : 'primary')} disabled={busy || (required && !text.trim())} onClick={go}>{busy ? 'Saving…' : ok}</button></>}>
      {message && <p style={{ margin: '0 0 12px', color: 'var(--fg-secondary)', lineHeight: 1.5 }}>{message}</p>}
      <div className="wiz-field">
        <label className="lbl">{fieldLabel}</label>
        <textarea className="tm-input" rows={4} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) go(); }} />
      </div>
      {children}
    </Modal>
  );
}

function CompleteModal({ review, project, task, onClose }) {
  const [advance, setAdvance] = React.useState(project.pipeline_status === 'QA');
  const list = (task && task.checklist) || [];
  const open = list.filter((c) => !c.checked).length;
  return (
    <TextModal title="Mark review complete" ok="Review complete" fieldLabel="Notes for the preparer (optional)" placeholder="Anything to carry into client review"
      message={open ? `${list.length - open} of ${list.length} checklist items are verified. You can still complete the review.` : 'The checklist is fully verified.'}
      onClose={onClose}
      onSubmit={(notes) => peerReviewAction('completePeerReview', { review_id: review.review_id, notes, advance }, 'review complete')
        .then(() => toast('success', 'Review complete' + (advance ? '. The return moved to Client review.' : '.')))}>
      {project.pipeline_status === 'QA' && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={advance} onChange={(e) => setAdvance(e.target.checked)} /> Move the return to Client review
        </label>
      )}
    </TextModal>
  );
}

function Fact({ k, children }) {
  return <div className="pr-fact"><span className="lbl">{k}</span><span className="val">{children}</span></div>;
}

function ReviewCard({ review: r, project, tasks, onModal }) {
  const user = useStore((s) => s.user);
  const perms = reviewPerms(r, user, project);
  const [busy, setBusy] = React.useState(false);
  const task = (tasks || []).find((t) => t.task_id === r.review_task_id);
  const list = (task && task.checklist) || [];
  async function run(action, what, msg) {
    setBusy(true);
    try { await peerReviewAction(action, { review_id: r.review_id }, what); if (msg) toast('success', msg); } catch (e) { /* toast shown */ }
    setBusy(false);
  }
  return (
    <div className="det-card">
      <div className="det-card-head">
        <div className="title" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          Peer review{(r.round || 1) > 1 ? ' · round ' + r.round : ''} <ReviewPill status={r.status} />
        </div>
        <span className="muted small">Submitted {relTime(r.submitted_at)}</span>
      </div>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {r.status === 'REWORK' && (
          <div className="pr-banner">
            <Icon name="flag" size={15} />
            <div><strong>Needs rework</strong> · sent back by <PersonName email={r.reviewer_email} /> {relTime(r.last_rework_at)}
              <div className="pr-banner-body">{r.last_rework_notes}</div></div>
          </div>
        )}
        {r.status === 'COMPLETE' && (
          <div className="pr-banner ok">
            <Icon name="check-circle" size={15} />
            <div><strong>Review complete</strong> · <PersonName email={r.completed_by} /> {relTime(r.completed_at)}
              {r.completion_notes && <div className="pr-banner-body">{r.completion_notes}</div>}</div>
          </div>
        )}
        <div className="pr-grid">
          <Fact k="Org ID"><span className="mono">{r.org_id}</span></Fact>
          <Fact k="Company name">{r.business_name}</Fact>
          <Fact k="Return year"><span className="mono">{r.tax_year}</span></Fact>
          <Fact k="Return type">{label('FILING_TYPE', r.filing_type)}</Fact>
          <Fact k="Safe harbor estimate"><span className="mono">{money(r.safe_harbor_amount) || '—'}</span></Fact>
          <Fact k="Add-ons">{r.add_ons || '—'}</Fact>
          <Fact k="Tax advisor"><Person email={r.advisor_email} /></Fact>
          <Fact k="Submitted by"><Person email={r.submitted_by} /></Fact>
          <Fact k="Reviewer">{r.reviewer_email ? <Person email={r.reviewer_email} /> : <span className="muted">Anyone can claim</span>}</Fact>
          <Fact k="Claimed">{r.claimed_at ? fmtTs(r.claimed_at) : '—'}</Fact>
        </div>
        {r.comments && <div><div className="lbl pr-lbl">Comments</div><div className="pr-comments">{r.comments}</div></div>}

        {r.status === 'IN_REVIEW' && list.length > 0 && (
          <div>
            <div className="lbl pr-lbl">Reviewer checklist · {list.filter((c) => c.checked).length}/{list.length} verified</div>
            <div className="tk-checklist pr-checklist">
              {list.map((c) => (
                <label key={c.id} className={'item' + (c.checked ? ' checked' : '')}>
                  <input type="checkbox" checked={!!c.checked} disabled={!perms.act} onChange={(e) => toggleChecklistItem(task, c.id, e.target.checked)} />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {(perms.claim || perms.act || perms.resubmit || perms.cancel) && (
          <div className="pr-actions">
            {perms.claim && <button className="btn primary" disabled={busy} onClick={() => run('claimPeerReview', 'claim', 'Claimed. The review is on your task list.')}><Icon name="check" size={14} /> Claim review</button>}
            {perms.act && <button className="btn primary" disabled={busy} onClick={() => onModal('complete')}><Icon name="check-circle" size={14} /> Review complete</button>}
            {perms.act && <button className="btn" disabled={busy} onClick={() => onModal('rework')}><Icon name="flag" size={14} /> Needs rework</button>}
            {perms.resubmit && <button className="btn primary" disabled={busy} onClick={() => onModal('resubmit')}><Icon name="refresh" size={14} /> Resubmit</button>}
            <span className="spacer" />
            {perms.release && <button className="btn subtle" disabled={busy} onClick={() => run('releasePeerReview', 'release', 'Released back to the queue.')}>Release to queue</button>}
            {perms.cancel && <button className="btn subtle" disabled={busy} onClick={() => onModal('cancel')}>Cancel review</button>}
          </div>
        )}
        {!perms.claim && r.status === 'SUBMITTED' && r.submitted_by === user.email && <p className="muted small" style={{ margin: 0 }}>Waiting for a reviewer to claim it.</p>}
        {!perms.act && r.status === 'IN_REVIEW' && <p className="muted small" style={{ margin: 0 }}>In review with <PersonName email={r.reviewer_email} />.</p>}

        <div>
          <div className="lbl pr-lbl">History</div>
          <ol className="pr-timeline">
            {(r.events || []).map((e, i) => (
              <li key={i}>
                <Avatar email={e.by} />
                <div><span><strong><PersonName email={e.by} /></strong> {EVENT_LABELS[e.action] || e.action.toLowerCase()}</span>
                  <span className="muted small"> · {fmtTs(e.at)}</span>
                  {e.note && e.action !== 'SUBMITTED' && <div className="pr-note">{e.note}</div>}</div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

/** Project → Peer review tab. */
export function ReviewPanel({ project, detail }) {
  const [modal, setModal] = React.useState(null);
  const queue = useStore((s) => s.reviews);
  // Reviews change hands between people: always show the latest when the tab opens.
  React.useEffect(() => { loadProject(project.project_id, true); }, [project.project_id]);
  if (!detail) return <div className="det-card"><div className="muted" style={{ padding: 24 }}>Loading…</div></div>;
  const reviews = (detail.reviews || []).map((r) => {
    const q = queue.find((x) => x.review_id === r.review_id);
    return q && Number(q.row_version || 0) > Number(r.row_version || 0) ? q : r;
  });
  const active = reviews.find((r) => OPEN_REVIEW.includes(r.status));
  const past = reviews.filter((r) => r !== active);
  const shown = active || past[0];
  return (
    <div className="det-grid">
      <div className="det-main" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!active && (
          <div className="tm-empty-card">
            <Empty icon="eye" title={past.length ? 'No review open' : 'Not sent to peer review yet'}
              action={project.archived ? null : <button className="btn primary" onClick={() => setModal('submit')}><Icon name="plus" size={14} /> Submit for peer review</button>}>
              When prep and your self-review are done, submit the return here. It moves to QA and a peer reviewer gets a task.
            </Empty>
          </div>
        )}
        {shown && <ReviewCard review={shown} project={project} tasks={detail.tasks} onModal={setModal} />}
        {past.length > (active ? 0 : 1) && (
          <div className="det-card">
            <div className="det-card-head"><div className="title">Earlier reviews</div></div>
            <table className="tmpl-tbl">
              <thead><tr><th>Submitted</th><th>Status</th><th>Submitted by</th><th>Reviewer</th><th style={{ width: 70 }}>Rounds</th></tr></thead>
              <tbody>
                {past.slice(active ? 0 : 1).map((r) => (
                  <tr key={r.review_id}>
                    <td className="mono small">{String(r.submitted_at).slice(0, 10)}</td>
                    <td><ReviewPill status={r.status} />{r.cancel_reason && <span className="muted small"> {r.cancel_reason}</span>}</td>
                    <td><Person email={r.submitted_by} /></td>
                    <td><Person email={r.reviewer_email} fallback="—" /></td>
                    <td className="mono">{r.round || 1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="det-side">
        <div className="det-card">
          <div className="det-card-head"><div className="title">How peer review works</div></div>
          <ol className="pr-how">
            <li><strong>Submit</strong> when prep is done. The return moves to QA.</li>
            <li>A reviewer <strong>claims</strong> it and works the checklist.</li>
            <li><strong>Needs rework</strong> sends it back with notes; you get a task, fix it, and <strong>resubmit</strong>.</li>
            <li><strong>Review complete</strong> closes it and can move the return to Client review.</li>
          </ol>
        </div>
      </div>
      {modal === 'submit' && <SubmitReviewModal project={project} onClose={() => setModal(null)} />}
      {modal === 'resubmit' && active && <SubmitReviewModal project={project} review={active} onClose={() => setModal(null)} />}
      {modal === 'complete' && active && <CompleteModal review={active} project={project} task={detail.tasks.find((t) => t.task_id === active.review_task_id)} onClose={() => setModal(null)} />}
      {modal === 'rework' && active && (
        <TextModal title="Send back for rework" ok="Send back" required fieldLabel="What needs to be reworked?" placeholder="Be specific: form, line, and what's wrong"
          message="The preparer gets a task to apply your changes, due in 2 days. Your notes also go on the project's Notes tab."
          onClose={() => setModal(null)}
          onSubmit={(notes) => peerReviewAction('reworkPeerReview', { review_id: active.review_id, notes }, 'rework').then(() => toast('success', 'Sent back for rework.'))} />
      )}
      {modal === 'cancel' && active && (
        <TextModal title="Cancel this review?" ok="Cancel review" danger required fieldLabel="Reason" placeholder="e.g. Submitted before the K-1 arrived"
          message="The review closes without a result. You can submit the return again later."
          onClose={() => setModal(null)}
          onSubmit={(reason) => peerReviewAction('cancelPeerReview', { review_id: active.review_id, reason }, 'cancel').then(() => toast('success', 'Review cancelled.'))} />
      )}
    </div>
  );
}

/* ---------------- queue page ---------------- */

const QUEUE_TABS = [
  { id: 'SUBMITTED', label: 'Waiting for reviewer' },
  { id: 'IN_REVIEW', label: 'In review' },
  { id: 'REWORK', label: 'Needs rework' },
  { id: 'closed', label: 'Completed' },
];

export function PeerReviewQueue() {
  const reviews = useStore((s) => s.reviews);
  const user = useStore((s) => s.user);
  const projects = useStore((s) => s.projects);
  const [tab, setTab] = React.useState('SUBMITTED');
  const [mine, setMine] = React.useState(false);
  const [closed, setClosed] = React.useState(null);
  const [busy, setBusy] = React.useState(null);
  React.useEffect(() => { refreshReviews(); }, []);
  React.useEffect(() => {
    if (tab !== 'closed') return;
    setClosed(null);
    api('getPeerReviews', { closed: true }).then(setClosed).catch((e) => { toast('error', e.message); setClosed([]); });
  }, [tab]);
  const me = user.email;
  const isMine = (r) => r.reviewer_email === me || r.submitted_by === me;
  const base = tab === 'closed' ? (closed || []) : reviews.filter((r) => r.status === tab);
  const rows = mine ? base.filter(isMine) : base;
  const count = (id) => (id === 'closed' ? null : reviews.filter((r) => r.status === id && (!mine || isMine(r))).length);

  async function claim(r) {
    setBusy(r.review_id);
    try { await peerReviewAction('claimPeerReview', { review_id: r.review_id }, 'claim'); toast('success', 'Claimed ' + r.business_name + '. It\'s on your task list.'); } catch (e) { /* toast */ }
    setBusy(null);
  }
  const open = (r) => openRecord('project', r.project_id, { tab: 'review' });

  return (
    <div data-screen-label="Peer review">
      <div className="ph">
        <div>
          <div className="ph-title"><Icon name="eye" size={22} /> Peer review</div>
          <div className="ph-meta">Tax QA reviews across every return. Submit from a project's Peer review tab; claim here or from the project.</div>
        </div>
        <div className="ph-actions">
          <label className="btn subtle" style={{ gap: 8 }}><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Only mine</label>
        </div>
      </div>
      <div className="view-tabs">
        {QUEUE_TABS.map((t) => (
          <button key={t.id} className={'view-tab' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>
            {t.label}{count(t.id) != null && <span className="badge">{count(t.id)}</span>}
          </button>
        ))}
      </div>
      {tab === 'closed' && !closed && <div className="muted" style={{ padding: 24 }}>Loading…</div>}
      {(tab !== 'closed' || closed) && (rows.length ? (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr>
              <th>Return</th><th style={{ width: 170 }}>Submitted by</th><th style={{ width: 170 }}>Tax advisor</th><th style={{ width: 170 }}>Reviewer</th>
              <th style={{ width: 130 }}>{tab === 'closed' ? 'Closed' : tab === 'SUBMITTED' ? 'Waiting' : 'Updated'}</th><th style={{ width: 70 }}>Round</th><th style={{ width: 150 }} />
            </tr></thead>
            <tbody>
              {rows.map((r) => {
                const project = projects.find((p) => p.project_id === r.project_id);
                const perms = reviewPerms(r, user, project);
                const when = tab === 'closed' ? r.completed_at || r.cancelled_at : tab === 'SUBMITTED' ? r.resubmitted_at || r.submitted_at : r.last_rework_at || r.resubmitted_at || r.claimed_at;
                return (
                  <tr key={r.review_id} onClick={() => open(r)}>
                    <td><span className="cell"><span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontWeight: 600 }}>{r.business_name}</span>
                      <span className="muted small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.add_ons || ''}><span className="mono">{r.org_id}</span> · TY{r.tax_year} {label('FILING_TYPE', r.filing_type)}{r.add_ons ? ' · ' + r.add_ons : ''}</span>
                    </span></span></td>
                    <td><span className="cell"><Person email={r.submitted_by} /></span></td>
                    <td><span className="cell"><Person email={r.advisor_email} fallback="—" /></span></td>
                    <td><span className="cell">{r.reviewer_email ? <Person email={r.reviewer_email} /> : <span className="muted">Anyone</span>}</span></td>
                    <td><span className="cell small">{tab === 'closed' ? <ReviewPill status={r.status} /> : relTime(when)}</span></td>
                    <td><span className="cell mono">{r.round || 1}</span></td>
                    <td><span className="cell" style={{ justifyContent: 'flex-end' }}>
                      {perms.claim
                        ? <button className="btn primary sm" disabled={busy === r.review_id} onClick={(e) => { e.stopPropagation(); claim(r); }}>{busy === r.review_id ? 'Claiming…' : 'Claim'}</button>
                        : <button className="btn sm" onClick={(e) => { e.stopPropagation(); open(r); }}>Open</button>}
                    </span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tm-empty-card"><Empty icon="eye" title={tab === 'SUBMITTED' ? 'Nothing waiting for a reviewer' : tab === 'closed' ? 'No completed reviews yet' : 'Nothing here'}>
          {tab === 'SUBMITTED' ? 'Returns submitted for peer review show up here until someone claims them.' : 'Reviews move through these tabs as they are claimed, sent back and completed.'}
        </Empty></div>
      ))}
    </div>
  );
}

/* ---------------- report ---------------- */

export function PeerReviewReport({ data, name }) {
  const q = data.queue;
  const stamp = today();
  const hrs = (h) => (h == null ? '—' : h < 48 ? h + ' h' : Math.round((h / 24) * 10) / 10 + ' d');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="home-stat-grid">
        <div className="home-stat"><div className="label">Waiting for reviewer</div><div className="val">{q.waiting}</div><div className="delta muted">oldest {hrs(q.oldest_waiting_hours)}</div></div>
        <div className="home-stat"><div className="label">In review</div><div className="val">{q.in_review}</div><div className="delta muted">claimed</div></div>
        <div className="home-stat"><div className="label">Needs rework</div><div className="val">{q.rework}</div><div className="delta muted">with the preparer</div></div>
        <div className="home-stat"><div className="label">Completed</div><div className="val">{q.completed}</div><div className="delta muted">all time</div></div>
      </div>
      <div className="det-card">
        <div className="det-card-head">
          <div className="title">By reviewer</div>
          <button className="btn sm" disabled={!data.reviewers.length} onClick={() => downloadCSV(`peer-review-by-reviewer-${stamp}.csv`, toCSV(data.reviewers, [
            { key: 'reviewer_email', label: 'Reviewer', value: (r) => name(r.reviewer_email) }, { key: 'reviews', label: 'Reviews' }, { key: 'completed', label: 'Completed' },
            { key: 'open', label: 'Open' }, { key: 'sent_back', label: 'Sent back' }, { key: 'rework_rate', label: 'Rework rate %' },
            { key: 'avg_hours_to_claim', label: 'Avg hours to claim' }, { key: 'avg_review_days', label: 'Avg review days' },
          ]))}><Icon name="download" size={12} /> Export CSV</button>
        </div>
        <table className="tmpl-tbl">
          <thead><tr><th>Reviewer</th><th className="num">Reviews</th><th className="num">Completed</th><th className="num">Open</th><th className="num">Sent back</th><th className="num">Rework rate</th><th className="num">Avg time to claim</th><th className="num">Avg review time</th></tr></thead>
          <tbody>
            {data.reviewers.map((r) => (
              <tr key={r.reviewer_email}>
                <td><Person email={r.reviewer_email} /></td><td className="mono">{r.reviews}</td><td className="mono">{r.completed}</td><td className="mono">{r.open}</td>
                <td className="mono">{r.sent_back}</td><td className="mono">{r.rework_rate == null ? '—' : r.rework_rate + '%'}</td>
                <td className="mono">{hrs(r.avg_hours_to_claim)}</td><td className="mono">{r.avg_review_days == null ? '—' : r.avg_review_days + ' d'}</td>
              </tr>
            ))}
            {!data.reviewers.length && <tr><td colSpan="8" className="muted" style={{ textAlign: 'center', padding: 20 }}>No reviews claimed yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="det-card">
        <div className="det-card-head"><div className="title">By preparer (who submitted)</div></div>
        <table className="tmpl-tbl">
          <thead><tr><th>Submitted by</th><th className="num">Submitted</th><th className="num">Completed</th><th className="num">Sent back at least once</th><th className="num">Rework rate</th><th className="num">Avg rounds to pass</th></tr></thead>
          <tbody>
            {data.submitters.map((r) => (
              <tr key={r.submitted_by}>
                <td><Person email={r.submitted_by} /></td><td className="mono">{r.submitted}</td><td className="mono">{r.completed}</td><td className="mono">{r.reworked}</td>
                <td className="mono">{r.rework_rate == null ? '—' : r.rework_rate + '%'}</td><td className="mono">{r.avg_rounds == null ? '—' : r.avg_rounds}</td>
              </tr>
            ))}
            {!data.submitters.length && <tr><td colSpan="6" className="muted" style={{ textAlign: 'center', padding: 20 }}>No reviews submitted yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="det-card">
        <div className="det-card-head">
          <div className="title">Every review ({data.log.length})</div>
          <button className="btn sm" disabled={!data.log.length} onClick={() => downloadCSV(`peer-reviews-${stamp}.csv`, toCSV(data.log, [
            { key: 'review_id', label: 'Review ID' }, { key: 'project_id', label: 'Project ID' }, { key: 'org_id', label: 'Org ID' }, { key: 'business_name', label: 'Business' },
            { key: 'tax_year', label: 'Tax year' }, { key: 'filing_type', label: 'Return type', value: (r) => label('FILING_TYPE', r.filing_type) },
            { key: 'status', label: 'Status', value: (r) => label('PEER_REVIEW_STATUS', r.status) },
            { key: 'submitted_by', label: 'Submitted by', value: (r) => name(r.submitted_by) }, { key: 'advisor_email', label: 'Tax advisor', value: (r) => name(r.advisor_email) },
            { key: 'reviewer_email', label: 'Reviewer', value: (r) => name(r.reviewer_email) }, { key: 'submitted_at', label: 'Submitted' }, { key: 'claimed_at', label: 'Claimed' },
            { key: 'completed_at', label: 'Completed' }, { key: 'hours_to_claim', label: 'Hours to claim' }, { key: 'review_days', label: 'Review days' },
            { key: 'rounds', label: 'Rounds' }, { key: 'rework_count', label: 'Times sent back' }, { key: 'safe_harbor_amount', label: 'Safe harbor estimate' },
            { key: 'add_ons', label: 'Add-ons' }, { key: 'comments', label: 'Comments' }, { key: 'last_rework_notes', label: 'Last rework notes' },
          ]))}><Icon name="download" size={12} /> Export CSV</button>
        </div>
        <table className="tmpl-tbl">
          <thead><tr><th style={{ width: 120 }}>Submitted</th><th>Return</th><th style={{ width: 150 }}>Submitted by</th><th style={{ width: 150 }}>Reviewer</th><th style={{ width: 150 }}>Status</th><th className="num" style={{ width: 90 }}>To claim</th><th className="num" style={{ width: 70 }}>Rounds</th></tr></thead>
          <tbody>
            {data.log.slice(0, 200).map((r) => (
              <tr key={r.review_id} style={{ cursor: 'pointer' }} onClick={() => openRecord('project', r.project_id, { tab: 'review' })}>
                <td className="mono small" style={{ whiteSpace: 'nowrap' }}>{String(r.submitted_at || '').slice(0, 10)}</td>
                <td>{r.business_name} <span className="muted small">· TY{r.tax_year} {label('FILING_TYPE', r.filing_type)}</span></td>
                <td><Person email={r.submitted_by} /></td>
                <td><Person email={r.reviewer_email} fallback="—" /></td>
                <td><ReviewPill status={r.status} /></td>
                <td className="mono">{hrs(r.hours_to_claim)}</td>
                <td className="mono">{r.rounds}</td>
              </tr>
            ))}
            {!data.log.length && <tr><td colSpan="7" className="muted" style={{ textAlign: 'center', padding: 20 }}>No peer reviews yet. They're submitted from each project's Peer review tab.</td></tr>}
          </tbody>
        </table>
        {data.log.length > 200 && <div className="muted small" style={{ padding: '10px 16px' }}>Showing the latest 200. Export CSV has all {data.log.length}, and the daily reports sheet has a Peer reviews tab.</div>}
      </div>
    </div>
  );
}
