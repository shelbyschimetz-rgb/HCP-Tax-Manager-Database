/* Pipeline snapshot and stage cycle time: filters, per-advisor drilldowns, hover definitions. */
import React from 'react';
import { Icon, Pill } from './ui.jsx';
import { useStore } from './store.js';
import { openRecord } from './nav.js';
import { label, toCSV, downloadCSV, fmtDue, today, cx } from './util.js';

const OPEN_STAGES = ['IN_QUEUE', 'IN_QUEUE_ESCALATED', 'DOC_GATHERING', 'PREP', 'WFP', 'QA', 'CLIENT_REVIEW', 'FILING_DELIVERY', 'BLOCKED'];

export const STAGE_DEFS = {
  IN_QUEUE: 'The return exists but work hasn\'t started. Moves on when the advisor kicks off document collection.',
  IN_QUEUE_ESCALATED: 'A queued return that\'s aging or needs a manager\'s decision.',
  DOC_GATHERING: 'Collecting documents and confirming the books. Moves on when the preparer has checked the documents.',
  PREP: 'The return is being built. Moves on when the preparer submits it for peer review (or to Waiting for pro if items are outstanding).',
  WFP: 'Waiting for pro: prep is paused on something only the pro can provide.',
  QA: 'Peer review. Moves on when the reviewer clicks Review complete.',
  CLIENT_REVIEW: 'The draft is with the pro: review call and signed 8879.',
  FILING_DELIVERY: 'E-file, IRS acceptance, and signed copies to Drive.',
  COMPLETE: 'Filed and delivered.',
  BLOCKED: 'Can\'t move for a reason outside the team\'s control (a reason is always recorded).',
};

function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** The deadline that applies: six months later when an extension was filed. */
export function effectiveDeadline(p) {
  if (!p.filing_deadline) return '';
  return p.extension_filed ? addDays(p.filing_deadline, 183) : p.filing_deadline;
}
function daysSince(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return isNaN(ms) ? null : Math.max(0, Math.round((ms / 86400000) * 10) / 10);
}
/** Weekday-only days between two timestamps (Saturdays and Sundays don't count). */
function businessDays(a, b) {
  let t = new Date(a).getTime();
  const end = new Date(b).getTime();
  if (isNaN(t) || isNaN(end) || end <= t) return 0;
  let ms = 0;
  while (t < end) {
    const d = new Date(t);
    const next = Math.min(end, Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) ms += next - t;
    t = next;
  }
  return Math.round((ms / 86400000) * 10) / 10;
}
const avg = (a) => (a.length ? Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 10) / 10 : null);
function median(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 10) / 10;
}

/** Column header or label with a hover definition. */
export function Def({ tip, children }) {
  return <span className="rep-def" title={tip}>{children}</span>;
}
function StagePill({ stage }) {
  return <span title={STAGE_DEFS[stage]}><Pill kind="pipeline" value={stage} /></span>;
}
function Seg({ value, options, onChange }) {
  return (
    <div className="tm-seg">
      {options.map((o) => <button key={o.value} className={cx(value === o.value && 'on')} onClick={() => onChange(o.value)} title={o.tip}>{o.label}</button>)}
    </div>
  );
}
function ExportBtn({ onClick, disabled }) {
  return <button className="btn sm" onClick={onClick} disabled={disabled}><Icon name="download" size={12} /> Export CSV</button>;
}
function useNames() {
  const teamBy = useStore((s) => s.teamBy);
  return (e) => (!e ? 'Unassigned' : teamBy[e] ? teamBy[e].name : e);
}
function bizOf(p) { return p ? (p.business_name || p.org_id) + ' · TY' + p.tax_year : ''; }

/* ---------------- Pipeline snapshot ---------------- */

const PIPE_DEFS = {
  open: 'Open returns in this stage right now (not archived, not Complete).',
  due: 'Open returns whose deadline is in the next 30 days. Uses the extended deadline (six months later) when an extension was filed.',
  overdue: 'Open returns past their deadline with no e-file date. Uses the extended deadline when an extension was filed.',
  moved: 'Returns that left this stage in the last 30 days (moved forward, back, or to Blocked). A view of recent history through the stage.',
  days: 'Days since the return entered its current stage.',
};

export function PipelineReport({ intervals }) {
  const projects = useStore((s) => s.projects);
  const name = useNames();
  const [advisor, setAdvisor] = React.useState('');
  const [year, setYear] = React.useState('');
  const [view, setView] = React.useState('stage');
  const [openStage, setOpenStage] = React.useState(null);
  const t = today();
  const soon = addDays(t, 30);
  const monthAgo = addDays(t, -30);

  const open = projects.filter((p) => !p.archived && p.pipeline_status !== 'COMPLETE');
  const advisors = [...new Set(open.map((p) => p.tax_advisor_email || ''))].sort((a, b) => name(a).localeCompare(name(b)));
  const years = [...new Set(open.map((p) => String(p.tax_year)))].sort().reverse();
  const pick = open.filter((p) => (advisor === '' || (p.tax_advisor_email || '') === advisor || (advisor === '-' && !p.tax_advisor_email)) && (!year || String(p.tax_year) === year));
  const projBy = React.useMemo(() => Object.fromEntries(projects.map((p) => [p.project_id, p])), [projects]);
  const moved = (intervals || []).filter((iv) => iv.ended_at.slice(0, 10) >= monthAgo && projBy[iv.project_id]).filter((iv) => {
    const p = projBy[iv.project_id];
    return (advisor === '' || (iv.advisor_email || '') === advisor || (advisor === '-' && !iv.advisor_email)) && (!year || String(p.tax_year) === year);
  });
  const isDue = (p) => { const d = effectiveDeadline(p); return d && !p.efile_date && d >= t && d <= soon; };
  const isOver = (p) => { const d = effectiveDeadline(p); return d && !p.efile_date && d < t; };
  const rows = OPEN_STAGES.map((s) => {
    const inStage = pick.filter((p) => p.pipeline_status === s);
    return { stage: s, list: inStage, count: inStage.length, due: inStage.filter(isDue).length, overdue: inStage.filter(isOver).length, moved: moved.filter((iv) => iv.stage === s) };
  });
  const max = Math.max(1, ...rows.map((r) => r.count));
  const stamp = t;

  const exportRows = () => downloadCSV(`pipeline-snapshot-${stamp}.csv`, toCSV(pick, [
    { key: 'business_name', label: 'Business' }, { key: 'org_id', label: 'Org ID' }, { key: 'tax_year', label: 'Tax year' },
    { key: 'pipeline_status', label: 'Stage', value: (p) => label('PIPELINE_STATUS', p.pipeline_status) },
    { key: 'tax_advisor_email', label: 'Advisor', value: (p) => name(p.tax_advisor_email) },
    { key: 'deadline', label: 'Deadline (with extension)', value: effectiveDeadline },
    { key: 'days', label: 'Days in stage', value: (p) => daysSince(p.stage_changed_at || p.created_at) },
    { key: 'status', label: 'Deadline status', value: (p) => (isOver(p) ? 'Past deadline' : isDue(p) ? 'Due in 30 days' : '') },
  ]));

  return (
    <div className="det-card">
      <div className="det-card-head">
        <div className="title">Pipeline snapshot: open returns by stage</div>
        <ExportBtn onClick={exportRows} disabled={!pick.length} />
      </div>
      <div className="rep-filters">
        <label>Advisor <select className="tm-input" value={advisor} onChange={(e) => setAdvisor(e.target.value)}>
          <option value="">Everyone</option>
          {advisors.map((a) => <option key={a || '-'} value={a || '-'}>{name(a)}</option>)}
        </select></label>
        <label>Tax year <select className="tm-input" value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">All years</option>
          {years.map((y) => <option key={y} value={y}>TY{y}</option>)}
        </select></label>
        <Seg value={view} onChange={setView} options={[{ value: 'stage', label: 'By stage' }, { value: 'advisor', label: 'By advisor', tip: 'Open returns per advisor per stage' }]} />
      </div>

      {view === 'stage' ? (
        <table className="tmpl-tbl">
          <thead><tr>
            <th>Stage</th><th style={{ width: 260 }}>Volume</th>
            <th style={{ width: 80 }}><Def tip={PIPE_DEFS.open}>Open</Def></th>
            <th style={{ width: 130 }}><Def tip={PIPE_DEFS.due}>Due in 30 days</Def></th>
            <th style={{ width: 120 }}><Def tip={PIPE_DEFS.overdue}>Past deadline</Def></th>
            <th style={{ width: 150 }}><Def tip={PIPE_DEFS.moved}>Moved on (30 days)</Def></th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <React.Fragment key={r.stage}>
                <tr className="rep-row-click" onClick={() => setOpenStage(openStage === r.stage ? null : r.stage)} title="Click to see these returns">
                  <td><Icon name={openStage === r.stage ? 'chevron-down' : 'chevron-right'} size={12} /> <StagePill stage={r.stage} /></td>
                  <td><span className="rep-bar-track" style={{ display: 'inline-block', width: 240 }}><span className="rep-bar" style={{ display: 'block', width: (r.count / max) * 100 + '%' }} /></span></td>
                  <td className="mono">{r.count}</td>
                  <td className="mono">{r.due || <span className="muted">0</span>}</td>
                  <td>{r.overdue > 0 ? <span style={{ color: 'var(--error-main)', fontWeight: 600 }}>{r.overdue}</span> : <span className="muted">0</span>}</td>
                  <td className="mono">{r.moved.length || <span className="muted">0</span>}</td>
                </tr>
                {openStage === r.stage && (
                  <tr className="rep-drill"><td colSpan={6}><StageDrill row={r} name={name} projBy={projBy} isDue={isDue} isOver={isOver} /></td></tr>
                )}
              </React.Fragment>
            ))}
            <tr><td><strong>Total open</strong></td><td />
              <td className="mono"><strong>{pick.length}</strong></td>
              <td className="mono">{rows.reduce((s, r) => s + r.due, 0)}</td>
              <td className="mono">{rows.reduce((s, r) => s + r.overdue, 0)}</td>
              <td className="mono">{moved.length}</td></tr>
          </tbody>
        </table>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="tmpl-tbl">
            <thead><tr><th>Advisor</th>{OPEN_STAGES.map((s) => <th key={s} style={{ minWidth: 92 }}><span title={STAGE_DEFS[s]}>{label('PIPELINE_STATUS', s)}</span></th>)}<th><Def tip={PIPE_DEFS.open}>Total</Def></th><th><Def tip={PIPE_DEFS.overdue}>Past deadline</Def></th></tr></thead>
            <tbody>
              {advisors.map((a) => {
                const mine = pick.filter((p) => (p.tax_advisor_email || '') === a);
                if (!mine.length) return null;
                return (
                  <tr key={a || '-'}>
                    <td style={{ whiteSpace: 'nowrap' }}>{name(a)}</td>
                    {OPEN_STAGES.map((s) => {
                      const n = mine.filter((p) => p.pipeline_status === s);
                      const over = n.filter(isOver).length;
                      return (
                        <td key={s} className={cx('mono', n.length && 'rep-cell-click')} title={n.length ? `${n.length} open, ${over} past deadline. Click to list them.` : ''}
                          onClick={() => { if (n.length) { setAdvisor(a || '-'); setView('stage'); setOpenStage(s); } }}>
                          {n.length || <span className="muted">·</span>}{over > 0 && <sup style={{ color: 'var(--error-main)', marginLeft: 2 }}>{over}</sup>}
                        </td>
                      );
                    })}
                    <td className="mono"><strong>{mine.length}</strong></td>
                    <td className="mono">{mine.filter(isOver).length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="muted small" style={{ padding: '8px 16px' }}>Small red numbers are past deadline. Click a number to list those returns.</div>
        </div>
      )}
      <div className="muted small" style={{ padding: '10px 16px' }}>Live from the Projects tab. Hover a column or stage for its definition; click a stage to list its returns.</div>
    </div>
  );
}

function StageDrill({ row, name, projBy, isDue, isOver }) {
  const list = [...row.list].sort((a, b) => (effectiveDeadline(a) || '9999') < (effectiveDeadline(b) || '9999') ? -1 : 1);
  return (
    <div className="rep-drill-body">
      <div className="rep-drill-head">In {label('PIPELINE_STATUS', row.stage)} now ({list.length})</div>
      {list.length ? (
        <table className="tmpl-tbl">
          <thead><tr><th>Return</th><th>Advisor</th><th><Def tip="Extended deadline when an extension was filed.">Deadline</Def></th><th><Def tip={PIPE_DEFS.days}>Days in stage</Def></th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.project_id} className="rep-row-click" onClick={() => openRecord('project', p.project_id)}>
                <td>{bizOf(p)}</td><td>{name(p.tax_advisor_email)}</td>
                <td style={{ color: isOver(p) ? 'var(--error-main)' : isDue(p) ? 'var(--warning-main)' : undefined }}>{effectiveDeadline(p) ? fmtDue(effectiveDeadline(p), true) : '—'}{p.extension_filed ? ' (ext.)' : ''}</td>
                <td className="mono">{daysSince(p.stage_changed_at || p.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <div className="muted small">None right now.</div>}
      <div className="rep-drill-head" style={{ marginTop: 12 }}>Moved on in the last 30 days ({row.moved.length})</div>
      {row.moved.length ? (
        <table className="tmpl-tbl">
          <thead><tr><th>Return</th><th>Advisor</th><th>Moved to</th><th>When</th><th>Days spent here</th></tr></thead>
          <tbody>
            {[...row.moved].sort((a, b) => (a.ended_at < b.ended_at ? 1 : -1)).map((iv) => (
              <tr key={iv.project_id + iv.ended_at} className="rep-row-click" onClick={() => openRecord('project', iv.project_id)}>
                <td>{bizOf(projBy[iv.project_id])}</td><td>{name(iv.advisor_email)}</td><td>{label('PIPELINE_STATUS', iv.to_stage)}</td>
                <td>{fmtDue(iv.ended_at.slice(0, 10), true)}</td><td className="mono">{iv.days}{iv.partial ? '*' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <div className="muted small">None.</div>}
      {row.moved.some((iv) => iv.partial) && <div className="muted small">* Counted from when the return was added to Tax Manager; time before that (e.g. in Asana) isn't known.</div>}
    </div>
  );
}

/* ---------------- Stage cycle time ---------------- */

const CYCLE_DEFS = {
  avg: 'Average days a return spent in this stage before it moved on, over the stays counted.',
  median: 'The middle value: half the stays were shorter, half longer. Less thrown off by a few very long stays than the average.',
  n: 'How many stays were counted. Small samples (under ~10) swing a lot; read them with care.',
  person: 'Average days, with the number of stays in brackets. Click to see every stay behind the number.',
};
const RANGES = [
  { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }, { value: 'ytd', label: 'This year' },
  { value: 'all', label: 'All time' }, { value: 'custom', label: 'Custom' },
];

export function CycleReport({ intervals }) {
  const projects = useStore((s) => s.projects);
  const name = useNames();
  const projBy = React.useMemo(() => Object.fromEntries(projects.map((p) => [p.project_id, p])), [projects]);
  const t = today();
  const [range, setRange] = React.useState('90');
  const [from, setFrom] = React.useState(addDays(t, -90));
  const [to, setTo] = React.useState(t);
  const [group, setGroup] = React.useState('advisor');
  const [dayMode, setDayMode] = React.useState('cal');
  const [partial, setPartial] = React.useState(false);
  const [quick, setQuick] = React.useState(false);
  const [drill, setDrill] = React.useState(null);

  const [lo, hi] = range === 'custom' ? [from, to] : range === 'all' ? ['', ''] : range === 'ytd' ? [t.slice(0, 4) + '-01-01', ''] : [addDays(t, -Number(range)), ''];
  const inRange = (intervals || []).filter((iv) => iv.stage !== 'COMPLETE' && projBy[iv.project_id]).filter((iv) => {
    const d = iv.ended_at.slice(0, 10);
    return (!lo || d >= lo) && (!hi || d <= hi);
  });
  const skippedPartial = inRange.filter((iv) => iv.partial).length;
  const skippedQuick = inRange.filter((iv) => !iv.partial && iv.quick).length;
  const used = inRange.filter((iv) => (partial || !iv.partial) && (quick || !iv.quick))
    .map((iv) => ({ ...iv, d: dayMode === 'biz' ? businessDays(iv.started_at, iv.ended_at) : iv.days }));
  const who = (iv) => (group === 'advisor' ? iv.advisor_email : iv.moved_by) || '';
  const people = [...new Set(used.map(who))].sort((a, b) => name(a).localeCompare(name(b)));
  const stages = OPEN_STAGES.filter((s) => used.some((iv) => iv.stage === s));
  const rows = stages.map((s) => {
    const mine = used.filter((iv) => iv.stage === s);
    const ds = mine.map((iv) => iv.d);
    const by = {};
    people.forEach((p) => { const x = mine.filter((iv) => who(iv) === p).map((iv) => iv.d); by[p] = { avg: avg(x), n: x.length }; });
    return { stage: s, avg: avg(ds), median: median(ds), n: ds.length, by };
  });
  const unit = dayMode === 'biz' ? 'business days' : 'days';
  const drillList = drill ? used.filter((iv) => iv.stage === drill.stage && (drill.who == null || who(iv) === drill.who)).sort((a, b) => b.d - a.d) : [];

  return (
    <div className="det-card">
      <div className="det-card-head">
        <div className="title">Days spent in each stage</div>
        <ExportBtn disabled={!rows.length} onClick={() => downloadCSV(`stage-cycle-time-${t}.csv`, toCSV(rows, [
          { key: 'stage', label: 'Stage', value: (r) => label('PIPELINE_STATUS', r.stage) },
          { key: 'avg', label: 'Avg ' + unit }, { key: 'median', label: 'Median ' + unit }, { key: 'n', label: 'Stays counted' },
          ...people.flatMap((p) => [{ key: p + 'a', label: name(p) + ' (avg)', value: (r) => r.by[p].avg }, { key: p + 'n', label: name(p) + ' (stays)', value: (r) => r.by[p].n }]),
        ]))} />
      </div>
      <div className="rep-filters">
        <label>Moved on <select className="tm-input" value={range} onChange={(e) => setRange(e.target.value)}>{RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></label>
        {range === 'custom' && <>
          <label>From <input className="tm-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>To <input className="tm-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </>}
        <label>Break out by <Seg value={group} onChange={setGroup} options={[
          { value: 'advisor', label: 'Advisor on the return', tip: 'The return\'s advisor at the time it left the stage' },
          { value: 'mover', label: 'Who moved it', tip: 'The person who moved the return out of the stage' },
        ]} /></label>
        <label>Count <Seg value={dayMode} onChange={setDayMode} options={[{ value: 'cal', label: 'Calendar days' }, { value: 'biz', label: 'Business days', tip: 'Leaves out Saturdays and Sundays' }]} /></label>
      </div>
      <div className="rep-filters" style={{ paddingTop: 0 }}>
        <label className="rep-check" title="Returns added to Tax Manager partway through the pipeline (e.g. imported from Asana). Their first stay only counts from the day they were added, so it's too short or too long."><input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} /> Include stays that began before Tax Manager ({skippedPartial})</label>
        <label className="rep-check" title="Stays under an hour are usually catch-up clicks moving a return through several stages at once."><input type="checkbox" checked={quick} onChange={(e) => setQuick(e.target.checked)} /> Include stays under an hour ({skippedQuick})</label>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="tmpl-tbl">
          <thead><tr>
            <th>Stage</th>
            <th style={{ width: 90 }}><Def tip={CYCLE_DEFS.avg}>Avg {dayMode === 'biz' ? 'bus. days' : 'days'}</Def></th>
            <th style={{ width: 80 }}><Def tip={CYCLE_DEFS.median}>Median</Def></th>
            <th style={{ width: 80 }}><Def tip={CYCLE_DEFS.n}>Stays</Def></th>
            {people.map((p) => <th key={p || '-'} style={{ minWidth: 120 }}><Def tip={CYCLE_DEFS.person}>{name(p)}</Def></th>)}
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.stage}>
                <td className="rep-cell-click" onClick={() => setDrill({ stage: r.stage, who: null })}><StagePill stage={r.stage} /></td>
                <td className="mono rep-cell-click" style={{ fontWeight: 600 }} onClick={() => setDrill({ stage: r.stage, who: null })}>{r.avg}</td>
                <td className="mono muted">{r.median}</td>
                <td className={cx('mono', r.n < 10 ? 'rep-small-n' : 'muted')} title={r.n < 10 ? 'Small sample: read with care' : ''}>{r.n}</td>
                {people.map((p) => (
                  <td key={p || '-'} className={cx('mono', r.by[p].n && 'rep-cell-click')} onClick={() => r.by[p].n && setDrill({ stage: r.stage, who: p })}
                    title={r.by[p].n ? `${r.by[p].n} stay${r.by[p].n === 1 ? '' : 's'}. Click to see them.` : ''}>
                    {r.by[p].n ? <>{r.by[p].avg} <span className={cx('rep-n', r.by[p].n < 5 && 'rep-small-n')}>({r.by[p].n})</span></> : <span className="muted">—</span>}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4 + people.length} className="muted" style={{ textAlign: 'center', padding: 24 }}>No stays in this date range. Try a wider range{(skippedPartial || skippedQuick) ? ' or include the left-out stays above' : ''}.</td></tr>}
          </tbody>
        </table>
      </div>
      {drill && (
        <div className="rep-drill-body" style={{ margin: '0 16px 12px' }}>
          <div className="rep-drill-head" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{label('PIPELINE_STATUS', drill.stage)}{drill.who != null ? ' · ' + name(drill.who) : ''}: {drillList.length} stay{drillList.length === 1 ? '' : 's'}, longest first</span>
            <span className="spacer" style={{ flex: 1 }} />
            <button className="btn sm" onClick={() => downloadCSV(`stage-stays-${drill.stage}-${t}.csv`, toCSV(drillList, [
              { key: 'b', label: 'Return', value: (iv) => bizOf(projBy[iv.project_id]) }, { key: 'started_at', label: 'Entered' }, { key: 'ended_at', label: 'Left' },
              { key: 'to', label: 'Moved to', value: (iv) => label('PIPELINE_STATUS', iv.to_stage) }, { key: 'd', label: unit },
              { key: 'a', label: 'Advisor', value: (iv) => name(iv.advisor_email) }, { key: 'm', label: 'Moved by', value: (iv) => name(iv.moved_by) },
              { key: 'f', label: 'Note', value: (iv) => [iv.partial && 'began before Tax Manager', iv.quick && 'under an hour'].filter(Boolean).join('; ') },
            ]))}><Icon name="download" size={12} /> CSV</button>
            <button className="icon-btn" onClick={() => setDrill(null)} title="Close"><Icon name="x" size={14} /></button>
          </div>
          <table className="tmpl-tbl">
            <thead><tr><th>Return</th><th>Entered</th><th>Left</th><th>Moved to</th><th>{dayMode === 'biz' ? 'Bus. days' : 'Days'}</th><th>Advisor</th><th>Moved by</th></tr></thead>
            <tbody>
              {drillList.map((iv) => (
                <tr key={iv.project_id + iv.ended_at} className="rep-row-click" onClick={() => openRecord('project', iv.project_id, { tab: 'stages' })}>
                  <td>{bizOf(projBy[iv.project_id])}</td>
                  <td>{fmtDue(iv.started_at.slice(0, 10), true)}</td><td>{fmtDue(iv.ended_at.slice(0, 10), true)}</td>
                  <td>{label('PIPELINE_STATUS', iv.to_stage)}</td>
                  <td className="mono">{iv.d}{iv.partial ? '*' : ''}{iv.quick ? '†' : ''}</td>
                  <td>{name(iv.advisor_email)}</td><td>{name(iv.moved_by)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {drillList.some((iv) => iv.partial || iv.quick) && <div className="muted small">* began before Tax Manager (counted from the day it was added). † under an hour.</div>}
        </div>
      )}
      <div className="rep-howto">
        <strong>Where these numbers come from.</strong> Every time a return changes stage, Tax Manager writes a row to the ProjectStageHistory tab (when, who moved it, and the return's advisor at that moment).
        A <em>stay</em> runs from the move into a stage to the move out of it, so a return still sitting in a stage isn't counted until it moves on. The date range filters on the day it moved on.
        Left out by default: stays that began before Tax Manager (returns imported partway through, like the Asana import, only have a clock from the day they were added) and stays under an hour (catch-up clicks).
        Complete is never counted. "Advisor on the return" is whoever was the advisor when it moved, not necessarily who did the work; switch to "Who moved it" to see who actually advanced it.
        Click any number to see every stay behind it.
      </div>
    </div>
  );
}
