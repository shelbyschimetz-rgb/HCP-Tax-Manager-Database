/* Onboarding intake wizard (full page): workbook import → profile → assignments → IAC → projects. */
import React from 'react';
import { Icon, Avatar, Person, enumOptions, Empty } from './ui.jsx';
import { useStore, api, mutate, mergePro, mergeTasks, updatePro, updateProject, createProject, toggleTask, toast, flash, loadPro } from './store.js';
import { navigate } from './router.js';
import { openRecord } from './nav.js';
import { PeopleSelect } from './lists.jsx';
import { label, readFileBase64, relTime, today, fmtDue, cx, safeUrl } from './util.js';

const STAGES = [
  { id: 'A', label: 'Pre-IAC setup', steps: [
    { id: 'A0', label: 'Upload workbook', est: '30 sec' },
    { id: 'A1', label: 'Business profile', est: '2 min' },
    { id: 'A2', label: 'Owners', est: '1 min' },
    { id: 'A3', label: 'Assignments', est: '1 min' },
    { id: 'A4', label: 'INHA bookkeeping context', est: '2 min' },
    { id: 'A5', label: 'Provision Drive folder', est: '15 sec' },
  ] },
  { id: 'B', label: 'IAC capture', steps: [
    { id: 'B1', label: 'General intake', est: '8 min' },
    { id: 'B2', label: 'Entity questionnaire', est: '6 min' },
    { id: 'B3', label: 'Complexity & risk', est: '2 min' },
  ] },
  { id: 'C', label: 'Post-IAC handoff', steps: [
    { id: 'C1', label: 'Create return project(s)', est: '3 min' },
    { id: 'C2', label: 'Confirm preparer + peer', est: '1 min' },
    { id: 'C3', label: 'Send organizer (task)', est: 'tracked' },
    { id: 'C4', label: '8821 IRS auth (task)', est: 'tracked' },
  ] },
];
const ALL_STEPS = STAGES.flatMap((s) => s.steps);

const LEADS = {
  A0: 'Attach the OS onboarding workbook. We read the General, Sole Prop, and Entity tabs and map the values into the right fields — you review before anything is applied.',
  A1: 'Confirm what came in from Salesforce and the workbook. Every field saves when you leave it.',
  A2: 'Add the legal owners. Ownership % must sum to 100 for S-Corp or Partnership.',
  A3: 'Pick the advisor, OS, and BK lead for this pro. These drive task assignment when templates materialize.',
  A4: 'Capture how the books look today before the IAC call.',
  A5: 'Create the per-org folder under the HCP Tax shared drive. Safe to re-run.',
  B1: 'Answers save when you leave each field. Earlier answers are preserved via the is_current flag.',
  B2: 'Answers save when you leave each field. Earlier answers are preserved via the is_current flag.',
  B3: 'Flag anything that makes this pro higher-touch. Complexity becomes the default on new projects.',
  C1: 'Wrap up onboarding by creating this pro\'s tax return projects. Project templates materialize automatically.',
  C2: 'Confirm who prepares and who peer-reviews each return.',
  C3: 'Tracked as a pro task — check it off when the organizer has gone out.',
  C4: 'Tracked as a pro task — check it off once the signed 8821 is on file.',
};

export function IntakeWizard({ orgId }) {
  const [data, setData] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [step, setStep] = React.useState(null);
  const [completed, setCompleted] = React.useState([]);
  const [lastSave, setLastSave] = React.useState(null);
  const storePro = useStore((s) => s.pros.find((p) => p.org_id === orgId));
  const sync = useStore((s) => s.sync);
  const [, tick] = React.useState(0);

  const load = React.useCallback(async () => {
    try {
      const d = await api('getIntake', { org_id: orgId });
      setData(d);
      const st = d.pro.intake_state || {};
      setStep((cur) => cur || st.step || 'A0');
      setCompleted(st.completed || []);
    } catch (e) { setErr(e.message); }
  }, [orgId]);
  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => { if (sync.phase === 'idle' && sync.label) setLastSave(Date.now()); }, [sync]);
  React.useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 5000); return () => clearInterval(t); }, []);

  if (err) return <div className="flash error"><Icon name="alert" size={16} /> {err}</div>;
  if (!data) return <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Loading onboarding…</div>;

  const pro = { ...data.pro, ...(storePro || {}) };
  const stageOf = (id) => STAGES.find((s) => s.steps.some((t) => t.id === id));
  const cur = ALL_STEPS.find((t) => t.id === step) || ALL_STEPS[0];
  const idx = ALL_STEPS.indexOf(cur);

  function saveProgress(nextStep, nextCompleted) {
    return api('saveIntakeProgress', { org_id: orgId, state: { step: nextStep, completed: nextCompleted } })
      .then(() => setLastSave(Date.now()))
      .catch((e) => toast('error', 'Couldn\'t save wizard progress — ' + e.message));
  }
  function go(id) { setStep(id); saveProgress(id, completed); }
  function next() {
    const done = completed.includes(cur.id) ? completed : [...completed, cur.id];
    setCompleted(done);
    const n = ALL_STEPS[idx + 1];
    if (n) { setStep(n.id); saveProgress(n.id, done); } else saveProgress(cur.id, done);
  }
  function saveExit() {
    saveProgress(cur.id, completed);
    flash('success', 'Onboarding progress saved for ' + pro.business_name + '.');
    openRecord('pro', orgId);
  }
  async function finish() {
    const done = [...new Set([...completed, cur.id])];
    setCompleted(done);
    await saveProgress(cur.id, done);
    if (['CLOSED_WON', 'ONBOARDING_SCHEDULED'].includes(pro.lifecycle_status)) {
      try { await updatePro(pro, { lifecycle_status: 'ONBOARDED' }, 'lifecycle'); } catch (e) { return; }
    }
    flash('success', pro.business_name + ' is onboarded. 🎉');
    openRecord('pro', orgId);
  }

  const q = data.queue;
  return (
    <div data-screen-label="Intake wizard">
      <div className="ph">
        <div>
          <div className="ph-title"><Icon name="wand" size={22} /> Onboarding · {pro.business_name}</div>
          <div className="ph-meta">
            {q && <><span className="mono">Case {q.sfdc_opportunity_id}</span> · </>}Org <span className="mono">{pro.org_id}</span>
            {q && q.case_owner && <> · Owner: {q.case_owner}</>} · <Pillish pro={pro} />
          </div>
        </div>
        <div className="ph-actions">
          <button className="btn" onClick={() => openRecord('pro', orgId)}><Icon name="users" size={14} /> Open pro</button>
          <button className="btn" onClick={saveExit}><Icon name="check-circle" size={14} /> Save &amp; exit</button>
        </div>
      </div>
      <div className="wiz-shell">
        <aside className="wiz-side">
          {STAGES.map((stage) => (
            <div key={stage.id} className="wiz-stage">
              <div className="wiz-stage-title">{stage.id} · {stage.label}</div>
              {stage.steps.map((s) => {
                const isDone = completed.includes(s.id);
                return (
                  <div key={s.id} className={cx('wiz-step', step === s.id && 'active', isDone && 'complete')} onClick={() => go(s.id)}>
                    <span className="dot">{isDone ? <Icon name="check" size={11} /> : s.id.slice(1) === '0' ? '0' : s.id.slice(1)}</span>
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
            <span>Stage {stageOf(cur.id).id}</span> <Icon name="chevron-right" size={11} /> <span>{stageOf(cur.id).label}</span>
          </div>
          <h1>{cur.label}</h1>
          <p className="lead">{LEADS[cur.id]}</p>
          <div className="wiz-form">
            {cur.id === 'A0' && <WorkbookStep pro={pro} onApplied={(res) => { mergePro(res.pro); mergeTasks(res.tasks); setData((d) => ({ ...d, pro: { ...d.pro, ...res.pro }, answers: res.answers })); }} onDone={next} />}
            {cur.id === 'A1' && <ProfileStep pro={pro} />}
            {cur.id === 'A2' && <OwnersStep pro={pro} />}
            {cur.id === 'A3' && <AssignmentStep pro={pro} loads={data.loads} suggested={data.suggested_advisor} />}
            {cur.id === 'A4' && <BooksStep pro={pro} />}
            {cur.id === 'A5' && <DriveStep pro={pro} data={data} />}
            {cur.id === 'B1' && <QuestionsStep orgId={orgId} branch="GENERAL" questions={data.questions.GENERAL} answers={data.answers} onSaved={(a) => setData((d) => ({ ...d, answers: [...d.answers.filter((x) => !(x.branch === a.branch && x.question === a.question)), a] }))} />}
            {cur.id === 'B2' && (() => {
              const branch = pro.entity_type === 'SOLE_PROP_SCHED_C' ? 'SCHED_C' : 'ENTITY';
              return (
                <>
                  {!pro.entity_type && <div className="wb-warn"><Icon name="alert" size={13} /> Entity type isn't set yet — showing the S-Corp / C-Corp / Partnership questionnaire. Set it in Business profile to switch.</div>}
                  <QuestionsStep orgId={orgId} branch={branch} questions={data.questions[branch]} answers={data.answers} onSaved={(a) => setData((d) => ({ ...d, answers: [...d.answers.filter((x) => !(x.branch === a.branch && x.question === a.question)), a] }))} />
                </>
              );
            })()}
            {cur.id === 'B3' && <RiskStep pro={pro} complexity={(data.pro.intake_state || {}).complexity} onComplexity={(c) => { setData((d) => ({ ...d, pro: { ...d.pro, intake_state: { ...(d.pro.intake_state || {}), complexity: c } } })); api('saveIntakeProgress', { org_id: orgId, state: { complexity: c } }).catch(() => {}); }} />}
            {cur.id === 'C1' && <ProjectsStep pro={pro} complexity={(data.pro.intake_state || {}).complexity} />}
            {cur.id === 'C2' && <PreparerStep pro={pro} />}
            {cur.id === 'C3' && <TaskStep orgId={orgId} match={/organizer/i} fallback="Send organizer to pro" />}
            {cur.id === 'C4' && <TaskStep orgId={orgId} match={/8821/} fallback="Collect 8821 IRS authorization" />}
          </div>
          <div className="wiz-foot">
            <div className="l">
              <Icon name="check-circle" size={14} style={{ color: sync.phase === 'error' ? 'var(--error-main)' : 'var(--success-main)' }} />
              <span>{sync.phase === 'saving' ? 'Saving…' : sync.phase === 'error' ? 'Last save failed' : 'All edits auto-saved' + (lastSave ? ' · last save ' + relTime(new Date(lastSave).toISOString()) : '')}</span>
            </div>
            <div className="r">
              {idx > 0 && <button className="btn" onClick={() => go(ALL_STEPS[idx - 1].id)}><Icon name="chevron-left" size={13} /> Back</button>}
              <button className="btn" onClick={() => { saveProgress(cur.id, completed); toast('success', 'Draft saved'); }}>Save draft</button>
              {idx < ALL_STEPS.length - 1
                ? <button className="btn primary" onClick={next}>Next step <Icon name="chevron-right" size={13} /></button>
                : <button className="btn primary" onClick={finish}><Icon name="check" size={13} /> Finish onboarding</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pillish({ pro }) {
  return <span className={'pill lc-' + pro.lifecycle_status}>{label('LIFECYCLE_STATUS', pro.lifecycle_status)}</span>;
}

/* ---------- field helpers: save on blur ---------- */

function ProField({ pro, field, label: lbl, type = 'text', options, hint, width, mono, placeholder }) {
  const [v, setV] = React.useState(pro[field] == null ? '' : String(pro[field]));
  React.useEffect(() => { setV(pro[field] == null ? '' : String(pro[field])); }, [pro[field]]);
  function commit(val) {
    let out = val;
    if (type === 'number') out = val === '' ? null : Number(val);
    if (type === 'bool') out = val === 'true';
    const curVal = pro[field] == null ? '' : String(pro[field]);
    if (String(out == null ? '' : out) === curVal) return;
    updatePro(pro, { [field]: out }, lbl).catch(() => {});
  }
  let input;
  if (type === 'select' || type === 'bool') {
    const opts = type === 'bool' ? [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] : options;
    input = (
      <select value={type === 'bool' ? String(!!pro[field]) : v} onChange={(e) => { setV(e.target.value); commit(e.target.value); }} style={width ? { width } : null}>
        {type !== 'bool' && <option value="">Select…</option>}
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  } else if (type === 'person') {
    input = <PeopleSelect value={pro[field] || ''} onChange={(val) => commit(val)} />;
  } else if (type === 'textarea') {
    input = <textarea rows={3} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => commit(v)} />;
  } else {
    input = <input className={mono ? 'mono' : ''} type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'} value={v} placeholder={placeholder || ''} style={width ? { width } : null}
      onChange={(e) => setV(e.target.value)} onBlur={() => commit(v)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />;
  }
  return <div className="wiz-field"><label className="lbl">{lbl}</label>{input}{hint && <span className="hint">{hint}</span>}</div>;
}

const TZ = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu'].map((v) => ({ value: v, label: v }));

function ProfileStep({ pro }) {
  return (
    <>
      <div className="wiz-row">
        <div className="wiz-field"><label className="lbl">Org ID</label><input className="mono" value={pro.org_id} readOnly /><span className="hint">From Salesforce — the dedup key, so it can't be edited here.</span></div>
        <ProField pro={pro} field="business_name" label="Business name" />
      </div>
      <div className="wiz-row">
        <ProField pro={pro} field="dba" label="DBA (optional)" placeholder="—" />
        <ProField pro={pro} field="year_started" label="Year started" type="number" placeholder="e.g. 2018" />
      </div>
      <div className="wiz-row">
        <ProField pro={pro} field="vertical" label="Vertical" placeholder="e.g. Plumbing" hint="Not in the SFDC feed — capture during intake." />
        <ProField pro={pro} field="state" label="State" placeholder="e.g. CO" width={90} />
      </div>
      <div className="wiz-row">
        <ProField pro={pro} field="entity_type" label="Entity type" type="select" options={enumOptions('ENTITY_TYPE')} />
        <ProField pro={pro} field="last_filing_year" label="Last filing year" type="number" placeholder="e.g. 2024" />
      </div>
      <div className="wiz-row">
        <ProField pro={pro} field="scope_start_date" label="Scope start" type="date" />
        <ProField pro={pro} field="time_zone" label="Time zone" type="select" options={TZ} />
      </div>
    </>
  );
}

function OwnersStep({ pro }) {
  const total = [1, 2, 3].reduce((s, n) => s + (Number(pro['owner' + n + '_pct']) || 0), 0);
  const any = [1, 2, 3].some((n) => pro['owner' + n + '_pct'] != null && pro['owner' + n + '_pct'] !== '');
  const needs100 = ['S_CORP', 'PARTNERSHIP'].includes(pro.entity_type);
  return (
    <>
      {[1, 2, 3].map((n) => (
        <div key={n} className="tm-owner-block">
          <div className="wiz-stage-title" style={{ margin: '4px 0 8px' }}>Owner {n}{n > 1 ? ' (optional)' : ''}</div>
          <div className="wiz-row">
            <ProField pro={pro} field={'owner' + n + '_name'} label="Name" />
            <ProField pro={pro} field={'owner' + n + '_pct'} label="% ownership" type="number" width={120} />
          </div>
          <div className="wiz-row">
            <ProField pro={pro} field={'owner' + n + '_email'} label="Email" />
            <ProField pro={pro} field={'owner' + n + '_phone'} label="Phone" mono />
          </div>
        </div>
      ))}
      {any && (
        <div className={needs100 && Math.abs(total - 100) > 0.01 ? 'wb-warn' : 'wb-note'}>
          <Icon name={needs100 && Math.abs(total - 100) > 0.01 ? 'alert' : 'check-circle'} size={13} /> Ownership totals {total}%{needs100 ? (Math.abs(total - 100) > 0.01 ? ' — must sum to 100 for ' + label('ENTITY_TYPE', pro.entity_type) + '.' : '.') : '.'}
        </div>
      )}
    </>
  );
}

function AssignmentStep({ pro, loads, suggested }) {
  const sorted = loads.slice().sort((a, b) => a.count - b.count);
  const max = Math.max(1, ...loads.map((l) => l.count));
  const current = pro.assigned_advisor_email;
  const overridden = current && suggested && current !== suggested;
  return (
    <>
      <div className="wiz-field">
        <label className="lbl">Tax advisor</label>
        {suggested && <div className="lb-suggest"><Icon name="sparkles" size={13} /><span>Balanced pick: <strong><Person email={suggested} /></strong> — fewest active pros (ties go round-robin)</span></div>}
        <div className="lb-list">
          {sorted.map((l) => {
            const isPick = l.email === current;
            return (
              <button key={l.email} type="button" className={cx('lb-row', isPick && 'picked', !l.accepting && 'off')}
                onClick={() => l.accepting && !isPick && updatePro(pro, { assigned_advisor_email: l.email }, 'advisor').catch(() => {})}>
                <span className="lb-radio">{isPick && <Icon name="check" size={12} />}</span>
                <Avatar email={l.email} />
                <span className="lb-name">{l.name}{l.email === suggested && <span className="lb-tag">next up</span>}{!l.accepting && <span className="lb-tag off">not accepting</span>}</span>
                <span className="lb-bar-track"><span className="lb-bar" style={{ width: (l.count / max) * 100 + '%' }} /></span>
                <span className="lb-count mono">{l.count}</span>
              </button>
            );
          })}
          {!sorted.length && <div className="muted small">No active advisors on the roster (Identity tab, role ADVISOR).</div>}
        </div>
        <span className="hint">{overridden ? 'Overriding the balanced pick — still counts toward this advisor\'s load.' : current ? 'Counts include this pro. Change it if this pro needs a specialist.' : 'Pick an advisor.'}</span>
      </div>
      <div className="wiz-row">
        <ProField pro={pro} field="assigned_os_email" label="Onboarding specialist" type="person" hint={pro.needs_os_assignment ? 'Salesforce case owner didn\'t match the roster — pick the OS.' : ''} />
        <ProField pro={pro} field="bk_lead_email" label="BK lead" type="person" />
      </div>
    </>
  );
}

function BooksStep({ pro }) {
  return (
    <>
      <div className="wiz-row">
        <ProField pro={pro} field="books_with_hcp" label="Books with HCP (INHA)?" type="bool" />
        <ProField pro={pro} field="doc_collection_status" label="Doc collection" type="select" options={enumOptions('DOC_COLLECTION_STATUS')} />
      </div>
      <div className="wiz-row">
        <ProField pro={pro} field="prior_books_status" label="Prior books" placeholder="e.g. Self-managed in QBO" />
        <ProField pro={pro} field="payroll_servicer" label="Payroll servicer" placeholder="e.g. Gusto" />
      </div>
      <ProField pro={pro} field="books_access" label="Access" placeholder="e.g. QBO accountant invite sent" />
      <ProField pro={pro} field="inha_remarks" label="Remarks" type="textarea" />
    </>
  );
}

function DriveStep({ pro, data }) {
  const [busy, setBusy] = React.useState(false);
  async function provision() {
    setBusy(true);
    try {
      const res = await mutate({ label: 'Drive folder', what: 'Drive folder', action: 'provisionDrive', payload: { org_id: pro.org_id } });
      mergePro(res.pro);
      toast('success', res.created ? 'Folder created' : 'Folder already existed — linked');
    } catch (e) { /* toast */ }
    setBusy(false);
  }
  const done = !!pro.drive_folder_url;
  return (
    <>
      <div className="wiz-field">
        <label className="lbl">Target folder</label>
        <div style={{ background: 'var(--grey-50)', border: '1px solid var(--border-light)', borderRadius: 8, padding: 14, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5 }}>
          {data.drive_parent_name || 'HCP Tax Shared Drive / client data'} / <strong>{pro.business_name} ({pro.org_id})-TAX</strong>
        </div>
        <span className="hint">Idempotent — clicking again with the folder already present is a no-op.</span>
      </div>
      {!data.drive_configured && <div className="wb-warn"><Icon name="alert" size={13} /> An admin needs to set the parent Drive folder in Settings before folders can be created.</div>}
      {done ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'var(--success-light)', borderRadius: 8 }}>
          <Icon name="check-circle" size={20} style={{ color: 'var(--success-dark)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: 'var(--success-dark)' }}>Folder ready</div>
            <div style={{ fontSize: 12.5, color: 'var(--success-dark)', marginTop: 2 }}>Link saved to the pro record.</div>
          </div>
          <a className="btn sm" href={safeUrl(pro.drive_folder_url)} target="_blank" rel="noreferrer"><Icon name="external" size={12} /> Open</a>
        </div>
      ) : (
        <button className="btn primary" style={{ width: 'max-content' }} disabled={busy || !data.drive_configured} onClick={provision}><Icon name="folder" size={13} /> {busy ? 'Creating…' : 'Create Drive folder'}</button>
      )}
    </>
  );
}

function QuestionsStep({ orgId, branch, questions, answers, onSaved }) {
  const current = {};
  (answers || []).filter((a) => a.branch === branch).forEach((a) => { current[a.question] = a; });
  const extra = Object.keys(current).filter((q) => !(questions || []).includes(q));
  const list = [...(questions || []), ...extra];
  return (
    <>
      {list.map((q) => <QuestionRow key={q} orgId={orgId} branch={branch} question={q} answer={current[q]} onSaved={onSaved} />)}
    </>
  );
}

function QuestionRow({ orgId, branch, question, answer, onSaved }) {
  const [a, setA] = React.useState(answer ? answer.answer : '');
  const [n, setN] = React.useState(answer ? answer.notes : '');
  React.useEffect(() => { setA(answer ? answer.answer : ''); setN(answer ? answer.notes : ''); }, [answer && answer.answer_id]);
  function commit() {
    if ((answer ? answer.answer : '') === a && (answer ? answer.notes || '' : '') === n) return;
    mutate({ label: 'answer', what: question.slice(0, 40), action: 'saveAnswer', payload: { org_id: orgId, branch, question, answer: a, notes: n } })
      .then(onSaved).catch(() => {});
  }
  return (
    <div className="wiz-field">
      <label className="lbl">{question}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="tm-seg sm">
          {['Yes', 'No'].map((v) => <button key={v} className={cx(String(a).toLowerCase().startsWith(v.toLowerCase()) && 'on')} onClick={() => { setA(v); mutate({ label: 'answer', what: question.slice(0, 40), action: 'saveAnswer', payload: { org_id: orgId, branch, question, answer: v, notes: n } }).then(onSaved).catch(() => {}); }}>{v}</button>)}
        </span>
        <input style={{ flex: 1 }} placeholder="Answer / detail" value={a} onChange={(e) => setA(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
        <input style={{ flex: 0.8 }} placeholder="Notes" value={n || ''} onChange={(e) => setN(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
      </div>
      {answer && answer.source === 'WORKBOOK' && <span className="hint">From workbook {answer.source_ref}</span>}
    </div>
  );
}

function RiskStep({ pro, complexity, onComplexity }) {
  return (
    <>
      <div className="wiz-row">
        <ProField pro={pro} field="at_risk" label="At risk?" type="bool" />
        <ProField pro={pro} field="at_risk_reason" label="At-risk reason" placeholder="e.g. Multi-state nexus unresolved" />
      </div>
      <div className="wiz-field">
        <label className="lbl">Expected complexity</label>
        <span className="tm-seg">
          {[['LOW', 'Low'], ['MED', 'Medium'], ['HIGH', 'High']].map(([v, l]) => <button key={v} className={cx((complexity || 'MED') === v && 'on')} onClick={() => onComplexity(v)}>{l}</button>)}
        </span>
        <span className="hint">Used as the default complexity on the projects you create next.</span>
      </div>
    </>
  );
}

function ProjectsStep({ pro, complexity }) {
  const projects = useStore((s) => s.projects);
  const mine = projects.filter((p) => p.org_id === pro.org_id && !p.archived);
  const defaultType = pro.entity_type === 'SOLE_PROP_SCHED_C' ? 'F1040_SCHC' : ['S_CORP', 'PARTNERSHIP', 'C_CORP'].includes(pro.entity_type) ? pro.entity_type : 'F1040_SCHC';
  const [rows, setRows] = React.useState([{ filing_type: defaultType, tax_year: String(Number(today().slice(0, 4)) - 1) }]);
  const [busy, setBusy] = React.useState(false);
  async function create() {
    setBusy(true);
    let n = 0;
    for (const r of rows) {
      if (!r.filing_type || !r.tax_year) continue;
      try { await createProject({ org_id: pro.org_id, filing_type: r.filing_type, tax_year: Number(r.tax_year), complexity: complexity || 'MED' }); n++; } catch (e) { /* toast */ }
    }
    setBusy(false);
    if (n) { toast('success', `Created ${n} project${n === 1 ? '' : 's'} with template tasks`); setRows([{ filing_type: defaultType, tax_year: rows[0].tax_year }]); }
  }
  return (
    <>
      {mine.length > 0 && (
        <div className="wiz-field">
          <label className="lbl">Existing projects</label>
          {mine.map((p) => (
            <div key={p.project_id} className="tm-proj-line" onClick={() => openRecord('project', p.project_id)}>
              <strong>{label('FILING_TYPE', p.filing_type)} · TY{p.tax_year}</strong>
              <span className="mono muted small">{p.project_id}</span>
              <span className={'pill pp-' + p.pipeline_status}>{label('PIPELINE_STATUS', p.pipeline_status)}</span>
              <span className="muted small">due {fmtDue(p.filing_deadline, true)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="wiz-field">
        <label className="lbl">New return project(s)</label>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <select value={r.filing_type} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, filing_type: e.target.value } : x)))}>
              {enumOptions('FILING_TYPE').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input type="number" className="mono" style={{ width: 110 }} value={r.tax_year} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, tax_year: e.target.value } : x)))} />
            {rows.length > 1 && <button className="tb-icon-btn" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn sm" onClick={() => setRows([...rows, { filing_type: defaultType, tax_year: String(Number(rows[rows.length - 1].tax_year) - 1) }])}><Icon name="plus" size={12} /> Another year / type</button>
          <button className="btn primary sm" disabled={busy} onClick={create}><Icon name="wand" size={12} /> {busy ? 'Creating…' : 'Create & materialize tasks'}</button>
        </div>
        <span className="hint">Deadlines default from filing type + tax year; advisor and OS come from this pro.</span>
      </div>
    </>
  );
}

function PreparerStep({ pro }) {
  const projects = useStore((s) => s.projects);
  const mine = projects.filter((p) => p.org_id === pro.org_id && !p.archived);
  if (!mine.length) return <div className="wb-note"><Icon name="alert" size={13} /> No projects yet — create them in the previous step.</div>;
  return (
    <>
      {mine.map((p) => (
        <div key={p.project_id} className="tm-owner-block">
          <div className="wiz-stage-title" style={{ margin: '4px 0 8px' }}>{label('FILING_TYPE', p.filing_type)} · TY{p.tax_year}</div>
          <div className="wiz-row">
            <div className="wiz-field"><label className="lbl">Preparer</label><PeopleSelect value={p.tax_preparer_email} roles={['PREPARER', 'ADVISOR']} onChange={(v) => updateProject(p, { tax_preparer_email: v }, 'preparer').catch(() => {})} /></div>
            <div className="wiz-field"><label className="lbl">Peer reviewer</label><PeopleSelect value={p.peer_reviewer_email} roles={['PEER_REVIEWER', 'ADVISOR']} onChange={(v) => updateProject(p, { peer_reviewer_email: v }, 'peer reviewer').catch(() => {})} /></div>
          </div>
        </div>
      ))}
    </>
  );
}

function TaskStep({ orgId, match, fallback }) {
  const detail = useStore((s) => s.details.pro[orgId]);
  React.useEffect(() => { loadPro(orgId); }, [orgId]);
  if (!detail) return <div className="muted">Loading tasks…</div>;
  const task = detail.tasks.find((t) => match.test(t.title));
  if (!task) {
    return <div className="wb-note"><Icon name="alert" size={13} /> No "{fallback}" task on this pro. Add it from the pro's task list, or re-check the Pro templates.</div>;
  }
  const done = task.status === 'DONE';
  return (
    <div className="tm-proj-line" style={{ cursor: 'default' }}>
      <button className={'tk-check' + (done ? ' done' : '')} onClick={() => toggleTask(task)}>{done && <Icon name="check" size={11} />}</button>
      <strong style={done ? { textDecoration: 'line-through', color: 'var(--fg-secondary)' } : null}>{task.title}</strong>
      <span className="muted small">{task.due_date ? 'due ' + fmtDue(task.due_date) : ''}</span>
      <span style={{ marginLeft: 'auto' }}><Person email={task.assignee_email} /></span>
    </div>
  );
}

/* ---------- workbook import ---------- */

function WorkbookStep({ pro, onApplied, onDone }) {
  const [phase, setPhase] = React.useState('drop'); // drop | extracting | review | applied
  const [result, setResult] = React.useState(null);
  const [checked, setChecked] = React.useState({});
  const [err, setErr] = React.useState('');
  const [drag, setDrag] = React.useState(false);
  const [applied, setApplied] = React.useState(null);
  const fileRef = React.useRef(null);

  async function handle(file) {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) { setErr('That isn\'t an .xlsx file — use the "Make A Copy Tax Notes" template.'); return; }
    setErr(''); setPhase('extracting');
    try {
      const base64 = await readFileBase64(file);
      const res = await mutate({ label: 'workbook', what: file.name, action: 'uploadWorkbook', payload: { org_id: pro.org_id, filename: file.name, base64 } });
      if (res.pro) mergePro(res.pro);
      setResult(res);
      setChecked(Object.fromEntries(res.rows.map((r, i) => [i, r.field !== 'org_id'])));
      setPhase('review');
    } catch (e) { setErr(e.message); setPhase('drop'); }
  }
  async function switchTab(tab) {
    try {
      const res = await api('reextractWorkbook', { org_id: pro.org_id, tabs: result.tabs, entity_tab: tab });
      setResult({ ...result, ...res });
      setChecked(Object.fromEntries(res.rows.map((r, i) => [i, r.field !== 'org_id'])));
    } catch (e) { toast('error', e.message); }
  }
  async function apply() {
    const rows = result.rows.filter((_, i) => checked[i]);
    try {
      const res = await mutate({ label: 'mapped fields', what: 'workbook values', action: 'applyWorkbook', payload: { org_id: pro.org_id, rows, filename: result.filename } });
      onApplied(res);
      setApplied({ count: rows.length, answers: rows.filter((r) => r.kind === 'answer').length });
      setPhase('applied');
    } catch (e) { /* toast */ }
  }

  if (phase === 'drop' || phase === 'extracting') {
    return (
      <div className="wb-drop-wrap">
        <div className={cx('wb-drop', phase === 'extracting' && 'busy', drag && 'drag')}
          onClick={() => phase === 'drop' && fileRef.current && fileRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}>
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={(e) => handle(e.target.files[0])} />
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
              <div className="wb-drop-sub">Converting in Drive, then matching labels on the General, Sole Prop, and Entity tabs</div>
            </>
          )}
        </div>
        {err && <div className="wb-warn"><Icon name="alert" size={13} /> {err}</div>}
        <div className="wb-note"><Icon name="alert" size={13} /> The original file is saved to the pro's Drive folder as the source of record. Nothing is written to the record until you review and confirm.</div>
        <button className="btn subtle sm" style={{ width: 'max-content' }} onClick={onDone}>Skip — no workbook for this pro</button>
      </div>
    );
  }
  if (phase === 'applied') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'var(--success-light)', borderRadius: 8 }}>
          <Icon name="check-circle" size={22} style={{ color: 'var(--success-dark)' }} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--success-dark)' }}>{applied.count} values applied</div>
            <div style={{ fontSize: 12.5, color: 'var(--success-dark)', marginTop: 2 }}>Pro profile, owners, and bookkeeping filled · {applied.answers} intake answers written{result.savedUrl ? ' · workbook saved to Drive' : ''}.</div>
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button className="btn primary" onClick={onDone}>Continue to Business profile <Icon name="chevron-right" size={13} /></button>
          <button className="btn" onClick={() => setPhase('review')}>Back to review</button>
        </div>
      </div>
    );
  }
  const groups = [...new Set(result.rows.map((r) => r.group))];
  const count = Object.values(checked).filter(Boolean).length;
  return (
    <div>
      <div className="wb-review-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="pill" style={{ background: 'var(--success-light)', color: 'var(--success-dark)' }}><Icon name="check" size={11} /> Parsed</span>
          <span className="muted small">{result.filename} · {result.rows.length} values found</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="muted small">Entity tab used:</span>
          <select value={result.entityTab} onChange={(e) => switchTab(e.target.value)} style={{ height: 30, borderRadius: 6, border: '1px solid var(--border-light)', padding: '0 8px', font: 'inherit', fontSize: 12.5 }}>
            <option value="SoleProp">Sole Prop</option>
            <option value="Entity">S-Corp / C-Corp / Partnership</option>
          </select>
        </div>
      </div>
      <div className="wb-review">
        {groups.map((g) => (
          <div key={g} className="wb-group">
            <div className="wb-group-title">{g}</div>
            {result.rows.map((r, i) => (r.group !== g ? null : (
              <div key={i} className="wb-map-row">
                <label className="wb-check"><input type="checkbox" checked={!!checked[i]} onChange={(e) => setChecked({ ...checked, [i]: e.target.checked })} disabled={r.field === 'org_id'} /></label>
                <span className="wb-src">
                  <span className="wb-src-val" title={r.raw}>{r.raw}</span>
                  <span className="wb-src-cell mono">{r.tab.replace(/\s+/g, ' ')}!{r.ref}</span>
                </span>
                <Icon name="chevron-right" size={13} className="muted" />
                <span className="wb-target" title={r.label}>{r.kind === 'answer' ? r.label : r.label}{r.field === 'org_id' && String(r.value) !== String(pro.org_id) ? <span className="lb-tag off">≠ {pro.org_id}</span> : ''}</span>
              </div>
            )))}
          </div>
        ))}
        {!result.rows.length && <div className="muted" style={{ padding: 16 }}>No values found — is this the "Make A Copy Tax Notes" template?</div>}
      </div>
      <div className={result.warnings.length ? 'wb-warn' : 'wb-note'}>
        <Icon name="alert" size={13} /> {result.warnings.length ? result.warnings.join(' ') : 'Checks passed: entity tab matches and owner % sums to 100 (where given).'} Uncheck any row you don't want applied.
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button className="btn primary" disabled={!count} onClick={apply}><Icon name="check" size={14} /> Apply {count} values</button>
        <button className="btn" onClick={() => { setPhase('drop'); setResult(null); }}>Replace file</button>
      </div>
    </div>
  );
}
