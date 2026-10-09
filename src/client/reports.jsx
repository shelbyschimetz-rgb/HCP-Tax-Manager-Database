/* Reports (CSV export) + admin Settings. */
import React from 'react';
import { Icon, Avatar, Person, Pill } from './ui.jsx';
import { useStore, api, mutate, toast, refreshAll } from './store.js';
import { openRecord } from './nav.js';
import { label, toCSV, downloadCSV, fmtTsShort, fmtMinutes, relTime, today } from './util.js';
import { PeerReviewReport } from './review.jsx';

const REPORTS = [
  { id: 'pipeline', label: 'Pipeline snapshot', icon: 'briefcase' },
  { id: 'cycle', label: 'Stage cycle time', icon: 'timer' },
  { id: 'advisor', label: 'Per-advisor summary', icon: 'users' },
  { id: 'balance', label: 'Advisor load balance', icon: 'users' },
  { id: 'time', label: 'Logged time', icon: 'clock' },
  { id: 'risk', label: 'At-risk pros', icon: 'alert' },
  { id: 'peer', label: 'Peer review', icon: 'eye' },
];

function Bar({ value, max, width = 260 }) {
  return <span className="rep-bar-track" style={{ display: 'inline-block', width }}><span className="rep-bar" style={{ display: 'block', width: (max ? (value / max) * 100 : 0) + '%' }} /></span>;
}

function ExportBtn({ onClick, disabled }) {
  return <button className="btn sm" onClick={onClick} disabled={disabled}><Icon name="download" size={12} /> Export CSV</button>;
}

export function Reports() {
  const teamBy = useStore((s) => s.teamBy);
  const [report, setReport] = React.useState('pipeline');
  const [data, setData] = React.useState(null);
  const [err, setErr] = React.useState('');
  const load = React.useCallback(async () => {
    setErr('');
    try { setData(await api('getReports')); } catch (e) { setErr(e.message); }
  }, []);
  React.useEffect(() => { load(); }, [load]);
  const name = (e) => (teamBy[e] ? teamBy[e].name : e || '—');
  const stamp = today();

  return (
    <div data-screen-label="Reports">
      <div className="ph">
        <div>
          <div className="ph-title"><Icon name="chart" size={22} /> Reports</div>
          <div className="ph-meta">Management views across the whole book, computed live. Every report exports to CSV.{data && ' Generated ' + relTime(data.generated_at) + '.'}</div>
        </div>
        <div className="ph-actions"><button className="btn" onClick={load}><Icon name="refresh" size={14} /> Recalculate</button></div>
      </div>
      <div className="rep-tabs">
        {REPORTS.map((r) => (
          <button key={r.id} className={'saved-view' + (report === r.id ? ' active' : '')} onClick={() => setReport(r.id)}><Icon name={r.icon} size={13} /> {r.label}</button>
        ))}
      </div>
      {err && <div className="flash error"><Icon name="alert" size={14} /> {err}</div>}
      {!data && !err && <div className="det-card"><div className="muted" style={{ padding: 24 }}>Crunching numbers…</div></div>}

      {data && report === 'pipeline' && (() => {
        const rows = data.pipeline;
        const max = Math.max(1, ...rows.map((r) => r.count));
        return (
          <div className="det-card">
            <div className="det-card-head">
              <div className="title">Pipeline snapshot — open projects by stage</div>
              <ExportBtn onClick={() => downloadCSV(`pipeline-snapshot-${stamp}.csv`, toCSV(rows, [
                { key: 'stage', label: 'Stage', value: (r) => label('PIPELINE_STATUS', r.stage) }, { key: 'count', label: 'Open projects' }, { key: 'overdue', label: 'Past deadline' },
              ]))} />
            </div>
            <table className="tmpl-tbl">
              <thead><tr><th>Stage</th><th style={{ width: 320 }}>Volume</th><th style={{ width: 120 }}>Open</th><th style={{ width: 130 }}>Past deadline</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.stage}>
                    <td><Pill kind="pipeline" value={r.stage} /></td>
                    <td><Bar value={r.count} max={max} /></td>
                    <td className="mono">{r.count}</td>
                    <td>{r.overdue > 0 ? <span style={{ color: 'var(--error-main)', fontWeight: 600 }}>{r.overdue}</span> : <span className="muted">0</span>}</td>
                  </tr>
                ))}
                <tr><td><strong>Total open</strong></td><td /><td className="mono"><strong>{rows.reduce((s, r) => s + r.count, 0)}</strong></td><td className="mono">{rows.reduce((s, r) => s + r.overdue, 0)}</td></tr>
              </tbody>
            </table>
          </div>
        );
      })()}

      {data && report === 'cycle' && (
        <div className="det-card">
          <div className="det-card-head">
            <div className="title">Days spent in each stage — with per-advisor breakout</div>
            <ExportBtn disabled={!data.cycle.rows.length} onClick={() => downloadCSV(`stage-cycle-time-${stamp}.csv`, toCSV(data.cycle.rows, [
              { key: 'stage', label: 'Stage', value: (r) => label('PIPELINE_STATUS', r.stage) },
              { key: 'avg_days', label: 'Avg days' }, { key: 'median_days', label: 'Median days' }, { key: 'count', label: 'Sample size' },
              ...data.cycle.advisors.map((a) => ({ key: a, label: name(a) + ' (avg days)', value: (r) => r.by_advisor[a] })),
            ]))} />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tmpl-tbl">
              <thead><tr><th>Stage</th><th style={{ width: 100 }}>Avg days</th><th style={{ width: 100 }}>Median</th><th style={{ width: 90 }}>Sample</th>{data.cycle.advisors.map((a) => <th key={a} style={{ width: 140 }}>{name(a)}</th>)}</tr></thead>
              <tbody>
                {data.cycle.rows.map((r) => (
                  <tr key={r.stage}>
                    <td><Pill kind="pipeline" value={r.stage} /></td>
                    <td className="mono" style={{ fontWeight: 600 }}>{r.avg_days}</td>
                    <td className="mono muted">{r.median_days}</td>
                    <td className="mono muted">{r.count}</td>
                    {data.cycle.advisors.map((a) => <td key={a} className="mono">{r.by_advisor[a] ?? <span className="muted">—</span>}</td>)}
                  </tr>
                ))}
                {!data.cycle.rows.length && <tr><td colSpan={4 + data.cycle.advisors.length} className="muted" style={{ textAlign: 'center', padding: 24 }}>No stage changes recorded yet — this fills in as projects move through the pipeline.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 16px' }} className="muted small">Raw durations from stage-change timestamps (ProjectStageHistory). No SLA targets applied.</div>
        </div>
      )}

      {data && report === 'advisor' && (
        <div className="det-card">
          <div className="det-card-head">
            <div className="title">Per-advisor summary — YTD</div>
            <ExportBtn onClick={() => downloadCSV(`advisor-summary-${stamp}.csv`, toCSV(data.advisor, [
              { key: 'advisor_email', label: 'Advisor', value: (r) => name(r.advisor_email) }, { key: 'advisor_email', label: 'Email' },
              { key: 'open_projects', label: 'Open projects' }, { key: 'completed_ytd', label: 'Completed YTD' },
              { key: 'avg_cycle_days', label: 'Avg cycle days' }, { key: 'on_time_pct', label: 'On-time %' }, { key: 'actual_hrs', label: 'Hrs logged on their projects' },
            ]))} />
          </div>
          <table className="tmpl-tbl">
            <thead><tr><th>Advisor</th><th style={{ width: 110 }}>Open</th><th style={{ width: 130 }}>Completed YTD</th><th style={{ width: 130 }}>Avg cycle</th><th style={{ width: 110 }}>On-time</th><th style={{ width: 130 }}>Hrs logged</th></tr></thead>
            <tbody>
              {data.advisor.map((r) => (
                <tr key={r.advisor_email}>
                  <td><Person email={r.advisor_email} /></td>
                  <td className="mono">{r.open_projects}</td>
                  <td className="mono">{r.completed_ytd}</td>
                  <td className="mono">{r.avg_cycle_days != null ? r.avg_cycle_days + ' days' : <span className="muted">—</span>}</td>
                  <td>{r.on_time_pct != null ? <span className={r.on_time_pct >= 90 ? 'pill pp-COMPLETE' : 'pill pp-WFP'}>{r.on_time_pct}%</span> : <span className="muted">—</span>}</td>
                  <td className="mono">{r.actual_hrs}h</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '10px 16px' }} className="muted small">On-time = e-filed by the deadline (+6 months when an extension was filed). Hours are all work-timer entries on the advisor's projects (TimeEntries).</div>
        </div>
      )}

      {data && report === 'balance' && (() => {
        const loads = data.balance.loads.slice().sort((a, b) => a.count - b.count);
        const max = Math.max(1, ...loads.map((l) => l.count));
        const total = loads.reduce((s, l) => s + l.count, 0);
        return (
          <div className="det-card">
            <div className="det-card-head">
              <div className="title">Active pros per advisor — next assignment highlighted</div>
              <ExportBtn onClick={() => downloadCSV(`advisor-load-balance-${stamp}.csv`, toCSV(loads, [
                { key: 'name', label: 'Advisor' }, { key: 'email', label: 'Email' }, { key: 'count', label: 'Active pros' },
                { key: 'accepting', label: 'Accepting new', value: (r) => (r.accepting ? 'Yes' : 'No') }, { key: 'lastAssigned', label: 'Last assigned' },
              ]))} />
            </div>
            <table className="tmpl-tbl">
              <thead><tr><th>Advisor</th><th style={{ width: 340 }}>Load</th><th style={{ width: 110 }}>Active pros</th><th style={{ width: 130 }}>Status</th></tr></thead>
              <tbody>
                {loads.map((l) => (
                  <tr key={l.email} style={l.email === data.balance.next ? { background: 'var(--primary-50)' } : null}>
                    <td><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Avatar email={l.email} /> {l.name}{l.email === data.balance.next && <span className="lb-tag">next up</span>}</span></td>
                    <td><Bar value={l.count} max={max} width={280} /></td>
                    <td className="mono" style={{ fontWeight: 600 }}>{l.count}</td>
                    <td>{l.accepting ? <span className="pill pp-COMPLETE">Accepting</span> : <span className="pill">Paused</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '10px 16px' }} className="muted small">
              {total} active pros across {loads.length} advisors{loads.length ? ` (avg ${(total / loads.length).toFixed(1)})` : ''}. New pros auto-assign to the least-loaded accepting advisor; ties go to whoever was assigned least recently. The OS can override in the intake wizard. Toggle "accepting_new" in the Identity tab to pause someone.
            </div>
          </div>
        );
      })()}

      {data && report === 'time' && (
        <div className="det-card">
          <div className="det-card-head">
            <div className="title">Logged time — all projects ({fmtMinutes(data.time.reduce((s, t) => s + t.duration_min, 0))})</div>
            <ExportBtn disabled={!data.time.length} onClick={() => downloadCSV(`time-entries-${stamp}.csv`, toCSV(data.time, [
              { key: 'project_id', label: 'Project' }, { key: 'business_name', label: 'Business' },
              { key: 'filing_type', label: 'Return type', value: (r) => label('FILING_TYPE', r.filing_type) }, { key: 'tax_year', label: 'Tax year' },
              { key: 'user_email', label: 'User' }, { key: 'advisor_email', label: 'Advisor' }, { key: 'started_at', label: 'Started' },
              { key: 'stopped_at', label: 'Stopped' }, { key: 'duration_min', label: 'Minutes' }, { key: 'auto_stopped', label: 'Auto-stopped', value: (r) => (r.auto_stopped ? 'Yes' : '') },
            ]))} />
          </div>
          {data.time_by_type.length > 0 && (
            <div style={{ padding: '10px 16px', display: 'flex', gap: 16, flexWrap: 'wrap', borderBottom: '1px solid var(--grey-100)' }}>
              {data.time_by_type.map((t) => <span key={t.filing_type} className="small"><strong>{label('FILING_TYPE', t.filing_type)}</strong> <span className="mono muted">{fmtMinutes(t.minutes)}</span></span>)}
            </div>
          )}
          <table className="tmpl-tbl">
            <thead><tr><th>Project</th><th>Who</th><th>Started</th><th>Stopped</th><th style={{ width: 100 }}>Duration</th></tr></thead>
            <tbody>
              {data.time.slice(0, 500).map((e) => (
                <tr key={e.entry_id} style={{ cursor: 'pointer' }} onClick={() => openRecord('project', e.project_id)}>
                  <td>{e.business_name || e.project_id} <span className="muted small">· {label('FILING_TYPE', e.filing_type)} TY{e.tax_year}</span></td>
                  <td><Person email={e.user_email} /></td>
                  <td className="mono small">{fmtTsShort(e.started_at)}</td>
                  <td className="mono small">{fmtTsShort(e.stopped_at)}{e.auto_stopped && <span className="pill pp-WFP" style={{ marginLeft: 6 }}>auto</span>}</td>
                  <td className="mono">{fmtMinutes(e.duration_min)}</td>
                </tr>
              ))}
              {!data.time.length && <tr><td colSpan="5" className="muted" style={{ textAlign: 'center', padding: 24 }}>No time logged yet — the work timer on each project fills this in.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {data && report === 'peer' && data.peer && <PeerReviewReport data={data.peer} name={name} />}

      {data && report === 'risk' && (
        <div className="det-card">
          <div className="det-card-head">
            <div className="title">At-risk pros ({data.risk.length})</div>
            <ExportBtn disabled={!data.risk.length} onClick={() => downloadCSV(`at-risk-pros-${stamp}.csv`, toCSV(data.risk, [
              { key: 'org_id', label: 'Org ID' }, { key: 'business_name', label: 'Business' }, { key: 'at_risk_reason', label: 'Reason' },
              { key: 'assigned_advisor_email', label: 'Advisor', value: (r) => name(r.assigned_advisor_email) }, { key: 'last_advisor_touchpoint', label: 'Last touch' },
            ]))} />
          </div>
          <table className="tmpl-tbl">
            <thead><tr><th style={{ width: 90 }}>Org ID</th><th>Business</th><th>Reason</th><th style={{ width: 170 }}>Advisor</th><th style={{ width: 120 }}>Last touch</th></tr></thead>
            <tbody>
              {data.risk.map((p) => (
                <tr key={p.org_id} style={{ cursor: 'pointer' }} onClick={() => openRecord('pro', p.org_id)}>
                  <td className="cell-id">{p.org_id}</td>
                  <td>{p.business_name}</td>
                  <td style={{ color: 'var(--warning-dark)' }}><Icon name="alert" size={12} /> {p.at_risk_reason || '—'}</td>
                  <td><Person email={p.assigned_advisor_email} /></td>
                  <td className="mono small">{p.last_advisor_touchpoint || '—'}</td>
                </tr>
              ))}
              {!data.risk.length && <tr><td colSpan="5" className="muted" style={{ textAlign: 'center', padding: 24 }}>No pros flagged at risk.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Settings (EXEC / ADMIN) ---------------- */

export function Settings() {
  const [s, setS] = React.useState(null);
  const [f, setF] = React.useState({});
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState('');
  const [syncResult, setSyncResult] = React.useState(null);
  const [cleanup, setCleanup] = React.useState(null);
  React.useEffect(() => {
    api('getSettings').then((d) => { setS(d); setF({ sfdc_sheet_id: d.sfdc_sheet_id, sfdc_tab: d.sfdc_tab, drive_parent_id: d.drive_parent_id, email_domain: d.email_domain, timer_max_hours: d.timer_max_hours, export_sheet_id: (d.export && d.export.sheet_id) || '', churn_sheet_id: (d.churn && d.churn.sheet_id) || '' }); })
      .catch((e) => setErr(e.message));
  }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save() {
    setBusy('save');
    try {
      const d = await mutate({ label: 'settings', what: 'settings', action: 'saveSettings', payload: { settings: f } });
      setS(d); setF((cur) => ({ ...cur, sfdc_sheet_id: d.sfdc_sheet_id, sfdc_tab: d.sfdc_tab, churn_sheet_id: d.churn ? d.churn.sheet_id : cur.churn_sheet_id }));
      toast('success', 'Settings saved');
    } catch (e) { /* toast */ }
    setBusy('');
  }
  async function exportNow() {
    setBusy('export');
    try {
      const r = await mutate({ label: 'reports export', what: 'reports export', action: 'runExport', payload: {} });
      setS((cur) => ({ ...cur, export: { sheet_id: r.url.split('/d/')[1], url: r.url, last: r }, triggers: [...new Set([...cur.triggers, 'dailyExportTrigger'])] }));
      setF((cur) => ({ ...cur, export_sheet_id: r.url }));
      toast('success', 'Exported to the Tax Manager Reports sheet');
    } catch (e) { /* toast */ }
    setBusy('');
  }
  async function syncNow() {
    setBusy('sync');
    try {
      const r = await mutate({ label: 'Salesforce sync', what: 'Salesforce sync', action: 'runSfdcSync', payload: {} });
      setSyncResult(r);
      refreshAll();
    } catch (e) { /* toast */ }
    setBusy('');
  }
  async function findOld() {
    setBusy('find');
    try { setCleanup({ plan: await api('sfdcCleanupPreview') }); } catch (e) { toast('error', e.message); }
    setBusy('');
  }
  async function removeOld() {
    setBusy('clean');
    try {
      const r = await mutate({ label: 'Inbox cleanup', what: 'Inbox cleanup', action: 'sfdcCleanup', payload: {} });
      setCleanup({ done: r });
      refreshAll();
    } catch (e) { /* toast */ }
    setBusy('');
  }
  if (err) return <div className="flash error"><Icon name="alert" size={14} /> {err}</div>;
  if (!s) return <div className="muted" style={{ padding: 24 }}>Loading settings…</div>;
  const last = syncResult || s.sfdc_last_result;
  return (
    <div data-screen-label="Settings">
      <div className="ph">
        <div>
          <div className="ph-title"><Icon name="settings" size={22} /> Settings</div>
          <div className="ph-meta">Integrations and the database. Team members and roles live in the <strong>Identity</strong> tab of the database sheet.</div>
        </div>
        <div className="ph-actions">
          <a className="btn" href={/^https:/.test(s.db_url) ? s.db_url : undefined} target="_blank" rel="noreferrer"><Icon name="table" size={14} /> Open database sheet</a>
        </div>
      </div>
      <div className="tm-settings-grid">
        <div className="det-card" style={{ padding: 20 }}>
          <h3 className="tm-h3">Salesforce onboarding feed</h3>
          <p className="muted small">The "New Tax Onboarding Cases" sheet. Every 4 hours, rows with Case Record Type = Tax Onboarding, a Created Date in {s.sfdc_first_year || 'this year'} or later, and a new Org ID create a pro + Inbox item. Older cases are skipped.</p>
          <div className="wiz-field"><label className="lbl">Source sheet link</label><input className="tm-input" value={f.sfdc_sheet_id || ''} onChange={set('sfdc_sheet_id')} placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=…" />
            <span className="hint">Paste the link while the right tab is open: the tab is picked from the link's #gid. Then click Save settings.</span></div>
          <div className="wiz-field"><label className="lbl">Tab name (blank = first tab)</label><input className="tm-input" value={f.sfdc_tab || ''} onChange={set('sfdc_tab')} /></div>
          <div className="wiz-field"><label className="lbl">Email domain for the Case Owner resolver</label><input className="tm-input" value={f.email_domain || ''} onChange={set('email_domain')} /><span className="hint">"Angel Julia Marcos" → angel.marcos@{f.email_domain || 'housecallpro.com'} — must be on the Identity roster, else the pro is flagged for manual OS assignment.</span></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn" disabled={!!busy || !s.sfdc_sheet_id} onClick={syncNow}><Icon name="refresh" size={13} /> {busy === 'sync' ? 'Syncing…' : 'Sync now'}</button>
            <span className="muted small">{s.sfdc_last_sync ? 'Last sync ' + relTime(s.sfdc_last_sync) : 'Never synced'}</span>
          </div>
          {last && <div className="wb-note" style={{ marginTop: 10 }}>Last run: {last.scanned} rows · {last.created} new pros · {last.existing} already existed{last.skipped_old != null ? ' · ' + last.skipped_old + ' created before ' + String(last.cutoff || '').slice(0, 4) : ''} · {last.skipped_type} other record types · {last.flagged_os} need an OS.</div>}
          <div style={{ borderTop: '1px solid var(--border-light)', marginTop: 14, paddingTop: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Clear out old cases</div>
            <p className="muted small" style={{ margin: '4px 0 8px' }}>Removes unclaimed Inbox cases created before {s.sfdc_first_year || 'this year'}. Pros nobody has worked on are deleted along with their empty Drive folder; pros with any work stay and just leave the Inbox.</p>
            {!cleanup && <button className="btn" disabled={!!busy} onClick={findOld}><Icon name="search" size={13} /> {busy === 'find' ? 'Checking…' : 'Find old cases'}</button>}
            {cleanup && cleanup.plan && (
              <div className="wb-note" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                <div><strong>{cleanup.plan.remove.length}</strong> untouched pro{cleanup.plan.remove.length === 1 ? '' : 's'} to remove · <strong>{cleanup.plan.keep.length}</strong> with work to keep (they only leave the Inbox).</div>
                {cleanup.plan.keep.length > 0 && <div className="small muted">Keeping: {cleanup.plan.keep.slice(0, 8).map((k) => k.business_name + ' (' + k.reason + ')').join(', ')}{cleanup.plan.keep.length > 8 ? ', …' : ''}</div>}
                {cleanup.plan.remove.length + cleanup.plan.keep.length > 0 ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn danger" disabled={!!busy} onClick={removeOld}>{busy === 'clean' ? 'Cleaning up…' : 'Clean up ' + (cleanup.plan.remove.length + cleanup.plan.keep.length) + ' cases'}</button>
                    <button className="btn" disabled={!!busy} onClick={() => setCleanup(null)}>Cancel</button>
                  </div>
                ) : <div className="small">Nothing to clean up. <a style={{ cursor: 'pointer' }} onClick={() => setCleanup(null)}>Close</a></div>}
              </div>
            )}
            {cleanup && cleanup.done && (
              <div className="wb-note">Removed {cleanup.done.pros_removed} pros and {cleanup.done.folders_trashed} empty Drive folders (in Drive's trash for 30 days). {cleanup.done.dismissed} pros with work left the Inbox.{cleanup.done.deferred ? ' ' + cleanup.done.deferred + ' more still to do: click Find old cases again.' : ''}</div>
            )}
          </div>
        </div>
        <div className="det-card" style={{ padding: 20 }}>
          <h3 className="tm-h3">Drive</h3>
          <p className="muted small">Parent folder for per-pro folders ("Business (Org)-TAX"), e.g. HCP Tax Shared Drive / client data. The deploying account needs edit access.</p>
          <div className="wiz-field"><label className="lbl">Parent folder URL or ID</label><input className="tm-input" value={f.drive_parent_id || ''} onChange={set('drive_parent_id')} placeholder="https://drive.google.com/drive/folders/…" />
            {s.drive_parent_name && <span className="hint">Current: {s.drive_parent_name}</span>}</div>
          <h3 className="tm-h3" style={{ marginTop: 18 }}>Work timer</h3>
          <div className="wiz-field"><label className="lbl">Auto-stop after (hours)</label><input className="tm-input mono" type="number" min="1" max="24" style={{ width: 110 }} value={f.timer_max_hours || ''} onChange={set('timer_max_hours')} /><span className="hint">Forgotten timers stop at this length and are flagged "auto-stopped".</span></div>
          <h3 className="tm-h3" style={{ marginTop: 18 }}>Background jobs</h3>
          <div className="small">{['sfdcSyncTrigger', 'timerAutoStopTrigger', 'dailyExportTrigger', 'churnTrigger'].map((t) => (
            <div key={t} style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '4px 0' }}>
              {s.triggers.includes(t) ? <Icon name="check-circle" size={14} style={{ color: 'var(--success-main)' }} /> : <Icon name="alert" size={14} style={{ color: 'var(--warning-main)' }} />}
              <span className="mono">{t}</span><span className="muted">{t === 'sfdcSyncTrigger' ? 'every 4h' : t === 'dailyExportTrigger' ? 'daily ~6am' : t === 'churnTrigger' ? 'daily ~5am' + (s.churn && s.churn.enabled ? '' : ' (off)') : 'hourly'}</span>
            </div>
          ))}</div>
        </div>
      </div>
      <div className="det-card" style={{ padding: 20, marginTop: 16 }}>
        <h3 className="tm-h3">Daily reports sheet</h3>
        <p className="muted small">
          Every morning (~6am) Tax Manager refreshes a Google Sheet with every pro, every tax return, every peer review, and all the reports, plus a
          <strong> Pipeline history</strong> tab that adds one row per stage per day for trend charts. Share it like any sheet; edits there are overwritten on the next refresh.
        </p>
        {s.export && s.export.url
          ? <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <a className="btn" href={/^https:/.test(s.export.url) ? s.export.url : undefined} target="_blank" rel="noreferrer"><Icon name="table" size={14} /> Open Tax Manager Reports</a>
            <span className="muted small">{s.export.last ? 'Last refreshed ' + relTime(s.export.last.at) + ' · ' + Object.entries(s.export.last.counts || {}).filter(([k]) => k === 'Pros' || k === 'Tax Returns').map(([k, v]) => v + ' ' + k.toLowerCase()).join(' · ') : 'Not refreshed yet'}</span>
          </div>
          : <p className="small" style={{ marginTop: 0 }}>No reports sheet yet — <strong>Export now</strong> creates "Tax Manager Reports" in your Drive.</p>}
        <div className="wiz-field"><label className="lbl">Use an existing sheet instead (optional)</label><input className="tm-input" value={f.export_sheet_id || ''} onChange={set('export_sheet_id')} placeholder="https://docs.google.com/spreadsheets/d/…" /><span className="hint">Tabs named Pros, Tax Returns, the report names, About and Pipeline history are replaced; other tabs are left alone. Save settings after changing this.</span></div>
        <button className="btn" disabled={!!busy} onClick={exportNow}><Icon name="download" size={13} /> {busy === 'export' ? 'Exporting…' : 'Export now'}</button>
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button className="btn primary" disabled={!!busy} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save settings'}</button>
      </div>
      <div className="tm-settings-grid" style={{ marginTop: 16 }}>
        <ChurnCard s={s} f={f} set={set} onSaved={(d) => setS(d)} />
        <TaskCleanupCard />
      </div>
      <div className="det-card" style={{ padding: 20, marginTop: 16 }}>
        <h3 className="tm-h3">Team roster</h3>
        <p className="muted small" style={{ marginBottom: 0 }}>
          Add people in the <strong>Identity</strong> tab of the database sheet: Name · Email · Active (TRUE/FALSE) · Roles (comma-separated: ADVISOR, PREPARER, PEER_REVIEWER, OS, BK, BK_LEAD, BK_TEAM_LEAD, EXEC, ADMIN) · Accepting new (advisors) · Color (optional hex). Changes apply on the next page load.
        </p>
        <p className="muted small">App URL: <span className="mono">{s.url}</span></p>
      </div>
    </div>
  );
}

/* ---------------- Churned pros (daily auto-archive) ---------------- */

function ChurnCard({ s, f, set, onSaved }) {
  const [plan, setPlan] = React.useState(null);
  const [result, setResult] = React.useState(null);
  const [busy, setBusy] = React.useState('');
  const c = s.churn || {};
  async function preview() {
    setBusy('preview'); setResult(null);
    try {
      if ((f.churn_sheet_id || '') !== (c.sheet_id || '')) onSaved(await api('saveSettings', { settings: { churn_sheet_id: f.churn_sheet_id } }));
      setPlan(await api('churnPreview', {}));
    } catch (e) { toast('error', e.message); }
    setBusy('');
  }
  async function run() {
    setBusy('run');
    try {
      const r = await mutate({ label: 'churn check', what: 'churn check', action: 'churnRun', payload: {} });
      setResult(r); setPlan(null);
      onSaved(await api('getSettings', {}));
      refreshAll();
    } catch (e) { /* toast */ }
    setBusy('');
  }
  async function turnOff() {
    setBusy('off');
    try { onSaved(await mutate({ label: 'settings', what: 'settings', action: 'saveSettings', payload: { settings: { churn_enabled: false } } })); toast('success', 'Daily churn check turned off'); } catch (e) { /* toast */ }
    setBusy('');
  }
  return (
    <div className="det-card" style={{ padding: 20 }}>
      <h3 className="tm-h3">Churned pros</h3>
      <p className="muted small">Every morning (~5am), pros whose latest case in the retention report is <strong>Closed / Lost</strong> are archived, along with their returns. Complete returns stay as history. A later <strong>Closed / Saved</strong> row means the pro was saved, and they're left alone. Each lost case acts once, so restoring a pro by hand sticks.</p>
      <div className="wiz-field"><label className="lbl">Retention report link</label><input className="tm-input" value={f.churn_sheet_id || ''} onChange={set('churn_sheet_id')} placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=…" />
        <span className="hint">Tab: {c.tab || 'Tax'}. Paste a link with #gid to pick a different tab.</span></div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className={'pill ' + (c.enabled ? 'pp-COMPLETE' : '')}>{c.enabled ? 'On: runs daily' : 'Off'}</span>
        <button className="btn" disabled={!!busy} onClick={preview}><Icon name="search" size={13} /> {busy === 'preview' ? 'Checking…' : 'Preview'}</button>
        {c.enabled && <button className="btn subtle" disabled={!!busy} onClick={turnOff}>Turn off</button>}
        {c.last && <span className="muted small">Last run {relTime(c.last.at)}: {c.last.pros_archived} pros, {c.last.returns_archived} returns archived</span>}
      </div>
      {plan && (
        <div className="wb-note" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, marginTop: 12 }}>
          <div><strong>{plan.to_archive}</strong> pros to archive, with <strong>{plan.returns_to_archive}</strong> open returns. {plan.complete_returns_kept} complete returns stay. {plan.not_in_tax_manager} churned pros aren't in Tax Manager.</div>
          {plan.actions.length > 0 && <div className="small" style={{ maxHeight: 160, overflow: 'auto' }}>{plan.actions.map((a) => <div key={a.org_id}><span className="mono">{a.org_id}</span> {a.business_name}{a.projects.length ? ' · ' + a.projects.length + ' return' + (a.projects.length === 1 ? '' : 's') : ''}</div>)}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn danger" disabled={!!busy} onClick={run}>{busy === 'run' ? 'Archiving…' : plan.to_archive ? 'Archive ' + plan.to_archive + ' now and turn on daily' : 'Turn on daily check'}</button>
            <button className="btn" disabled={!!busy} onClick={() => setPlan(null)}>Cancel</button>
          </div>
        </div>
      )}
      {result && <div className="wb-note" style={{ marginTop: 12 }}>Archived {result.pros_archived} pros and {result.returns_archived} returns. The daily check is on.{result.deferred ? ' ' + result.deferred + ' more will finish on the next run.' : ''} Archived pros are in Archive, where Restore brings one back.</div>}
    </div>
  );
}

/* ---------------- Fresh start for tasks ---------------- */

function TaskCleanupCard() {
  const teamBy = useStore((st) => st.teamBy);
  const [scope, setScope] = React.useState('ADVISOR');
  const [plan, setPlan] = React.useState(null);
  const [done, setDone] = React.useState(null);
  const [busy, setBusy] = React.useState('');
  async function preview(sc) {
    setBusy('preview'); setDone(null);
    try { setPlan(await api('taskCleanupPreview', { scope: sc || scope })); } catch (e) { toast('error', e.message); }
    setBusy('');
  }
  async function run() {
    setBusy('run');
    try {
      const r = await mutate({ label: 'task cleanup', what: 'task cleanup', action: 'taskCleanup', payload: { scope } });
      setDone(r); setPlan(null); refreshAll();
    } catch (e) { /* toast */ }
    setBusy('');
  }
  const name = (e) => (e ? (teamBy[e] ? teamBy[e].name : e) : 'Unassigned');
  return (
    <div className="det-card" style={{ padding: 20 }}>
      <h3 className="tm-h3">Fresh start for tasks</h3>
      <p className="muted small">Clears open tasks created before this week (Monday) from every list and My Tasks. Done tasks and anything an open peer review needs stay. Cleared tasks move to the <strong>TasksArchive</strong> tab of the database sheet, so nothing is lost.</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="tm-input" style={{ width: 'auto' }} value={scope} onChange={(e) => { setScope(e.target.value); setPlan(null); }}>
          <option value="ADVISOR">Advisors' tasks</option>
          <option value="ALL">Everyone's tasks</option>
        </select>
        <button className="btn" disabled={!!busy} onClick={() => preview()}><Icon name="search" size={13} /> {busy === 'preview' ? 'Counting…' : 'Preview'}</button>
      </div>
      {plan && (
        <div className="wb-note" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, marginTop: 12 }}>
          <div><strong>{plan.count}</strong> open tasks created before {plan.before}.</div>
          {plan.by_person.length > 0 && <div className="small">{plan.by_person.slice(0, 12).map((p) => name(p.email) + ' ' + p.count).join(' · ')}</div>}
          {plan.count > 0 ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn danger" disabled={!!busy} onClick={run}>{busy === 'run' ? 'Clearing…' : 'Clear ' + plan.count + ' tasks'}</button>
              <button className="btn" disabled={!!busy} onClick={() => setPlan(null)}>Cancel</button>
            </div>
          ) : <div className="small">Nothing to clear.</div>}
        </div>
      )}
      {done && <div className="wb-note" style={{ marginTop: 12 }}>Cleared {done.cleared} tasks. They're in the TasksArchive tab.</div>}
    </div>
  );
}
