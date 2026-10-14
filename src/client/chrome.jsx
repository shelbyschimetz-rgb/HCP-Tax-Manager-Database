/* App chrome: sidebar (expanded / icon rail / top nav), topbar, sync pill, prefs menu. */
import React from 'react';
import { Icon, TMLogo, Popover } from './ui.jsx';
import { useStore, savePrefs, refreshAll, stopTimer } from './store.js';
import { navigate, useRoute } from './router.js';
import { FeedbackButton } from './help.jsx';
import { timeAgo, fmtElapsed, ROLE_LABELS, cx } from './util.js';
import { SKINS, SKIN_ORDER, useSkin } from './skins.js';

const NAV = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'inbox', label: 'Inbox', icon: 'inbox', countKey: 'inbox' },
  { id: 'my-tasks', label: 'My Tasks', icon: 'check-circle', countKey: 'myTasks' },
  { id: 'peer-review', label: 'Peer Review', icon: 'eye', countKey: 'reviews' },
];
const NAV_WORK = [
  { id: 'pros', label: 'Pros', icon: 'users', countKey: 'pros' },
  { id: 'projects', label: 'Projects', icon: 'briefcase', countKey: 'projects' },
  { id: 'templates', label: 'Templates', icon: 'template' },
  { id: 'reports', label: 'Reports', icon: 'chart' },
  { id: 'archive', label: 'Archive', icon: 'archive' },
  { id: 'guide', label: 'Guide', icon: 'help' },
];
const BUILTIN_STARRED = [
  { id: 'pros-my', label: 'My pros', view: 'pros', savedView: 'my' },
  { id: 'pros-risk', label: 'At-risk pros', view: 'pros', savedView: 'risk' },
  { id: 'proj-mine', label: 'My projects', view: 'projects', savedView: 'my' },
  { id: 'proj-qa', label: 'Pending peer review', view: 'projects', savedView: 'qa' },
];

export function useCounts() {
  const inbox = useStore((s) => s.inbox);
  const myTasks = useStore((s) => s.myTasks);
  const pros = useStore((s) => s.pros);
  const projects = useStore((s) => s.projects);
  const reviews = useStore((s) => s.reviews);
  const me = useStore((s) => s.user && s.user.email);
  return React.useMemo(() => ({
    // waiting for any reviewer, plus reviews that need something from me
    reviews: reviews.filter((r) => r.status === 'SUBMITTED' || (r.status === 'REWORK' && r.submitted_by === me) || (r.status === 'IN_REVIEW' && r.reviewer_email === me)).length,
    inbox: inbox.length,
    myTasks: myTasks.filter((t) => t.status !== 'DONE').length,
    pros: pros.filter((p) => !p.archived).length,
    projects: projects.filter((p) => !p.archived && p.pipeline_status !== 'COMPLETE').length,
  }), [inbox, myTasks, pros, projects, reviews, me]);
}

function go(view, extra) { navigate({ view, ...(extra || {}) }); }

/** Top nav items under the active skin: themed names, plus the Game tab. */
function useNav() {
  const skin = useSkin();
  return React.useMemo(() => {
    if (!skin) return NAV;
    return [...NAV.map((n) => (skin.nav[n.id] ? { ...n, label: skin.nav[n.id] } : n)), { id: 'game', label: skin.game, icon: 'trophy' }];
  }, [skin]);
}

export function Sidebar({ active }) {
  const counts = useCounts();
  const NAV = useNav();
  const user = useStore((s) => s.user);
  const prefs = useStore((s) => s.prefs);
  const collapsed = prefs.sidebar_collapsed || prefs.nav === 'collapsed-sidebar';
  const saved = [
    ...((prefs.saved_views && prefs.saved_views.pros) || []).map((v) => ({ id: 'u-pros-' + v.id, label: v.label, view: 'pros', savedView: v.id })),
    ...((prefs.saved_views && prefs.saved_views.projects) || []).map((v) => ({ id: 'u-proj-' + v.id, label: v.label, view: 'projects', savedView: v.id })),
  ];
  const items = user && user.admin ? [...NAV_WORK, { id: 'settings', label: 'Settings', icon: 'settings' }] : NAV_WORK;

  if (collapsed) {
    return (
      <aside className="sidebar">
        <div className="sb-head"><span className="sb-logo"><TMLogo /></span></div>
        <button className="sb-create" onClick={() => savePrefs({ sidebar_collapsed: false, nav: 'sidebar' })} title="Expand sidebar">
          <Icon name="sidebar" size={16} />
        </button>
        <nav className="sb-section" style={{ flex: 1 }}>
          {[...NAV, ...items].map((n) => (
            <a key={n.id} className={'sb-item' + (active === n.id ? ' active' : '')} onClick={() => go(n.id)} title={n.label}>
              <Icon name={n.icon} size={18} className="icon" />
            </a>
          ))}
        </nav>
        <div className="sb-foot">
          <span className="sb-avatar" style={{ background: user.color }}>{user.initials}</span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sb-head">
        <span className="sb-logo"><TMLogo /></span>
        <div className="sb-title">Tax Manager<small>Housecall Pro</small></div>
        <button className="sb-collapse-btn" title="Collapse sidebar" onClick={() => savePrefs({ sidebar_collapsed: true })}>
          <Icon name="sidebar" size={16} />
        </button>
      </div>

      <button className="sb-create" onClick={() => go('inbox')}>
        <Icon name="plus" size={16} />
        <span className="label">Claim from Inbox</span>
      </button>

      <nav className="sb-section">
        {NAV.map((n) => (
          <a key={n.id} className={'sb-item' + (active === n.id ? ' active' : '')} onClick={() => go(n.id)}>
            <Icon name={n.icon} size={17} className="icon" />
            <span className="label">{n.label}</span>
            {n.countKey && counts[n.countKey] > 0 && <span className="count">{counts[n.countKey]}</span>}
          </a>
        ))}
      </nav>
      <div className="sb-divider" />
      <nav className="sb-section">
        <div className="sb-section-label">Work</div>
        {items.map((n) => (
          <a key={n.id} className={'sb-item' + (active === n.id ? ' active' : '')} onClick={() => go(n.id)}>
            <Icon name={n.icon} size={17} className="icon" />
            <span className="label">{n.label}</span>
            {n.countKey && <span className="count">{counts[n.countKey]}</span>}
          </a>
        ))}
      </nav>
      <div className="sb-divider" />
      <nav className="sb-section" style={{ overflowY: 'auto', minHeight: 0, flex: 1 }}>
        <div className="sb-section-label"><span>Starred</span></div>
        {[...BUILTIN_STARRED, ...saved].map((s) => (
          <a key={s.id} className="sb-item" onClick={() => go(s.view, { savedView: s.savedView })}>
            <Icon name="star" size={14} className="icon" />
            <span className="label">{s.label}</span>
          </a>
        ))}
      </nav>
      <div className="sb-foot">
        <span className="sb-avatar" style={{ background: user.color }}>{user.initials}</span>
        <div className="sb-user">
          <div className="name">{user.name}</div>
          <div className="role">{user.roles.map((r) => ROLE_LABELS[r] || r).join(' · ') || 'Team'} · {user.email.split('@')[0]}</div>
        </div>
      </div>
    </aside>
  );
}

export function TopNav({ active }) {
  const counts = useCounts();
  const NAV = useNav();
  const user = useStore((s) => s.user);
  const items = [...NAV, ...NAV_WORK, ...(user.admin ? [{ id: 'settings', label: 'Settings', icon: 'settings' }] : [])];
  return (
    <div className="topnav-row">
      <span className="topnav-brand"><span className="sb-logo"><TMLogo size={16} /></span>Tax Manager</span>
      {items.map((n) => (
        <button key={n.id} className={'topnav-item' + (active === n.id ? ' active' : '')} onClick={() => go(n.id)}>
          <Icon name={n.icon} size={15} />
          {n.label}
          {n.countKey && counts[n.countKey] > 0 && <span className="count">{counts[n.countKey]}</span>}
        </button>
      ))}
    </div>
  );
}

export function SyncPill() {
  const s = useStore((st) => st.sync);
  const [, force] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 15000);
    return () => clearInterval(t);
  }, []);
  if (s.phase === 'saving') return <span className="sync-pill saving" title="Saving to the Tax Manager DB"><span className="dot" /> Saving {s.label}…</span>;
  if (s.phase === 'error') {
    return (
      <span className="sync-pill error" title="Last save failed — click to retry" style={{ cursor: 'pointer' }} onClick={() => s.retry && s.retry()}>
        <span className="dot" /> Sync failed — click to retry
      </span>
    );
  }
  return <span className="sync-pill" title="All changes saved"><span className="dot" /> Synced {timeAgo(s.ts)}</span>;
}

function TimerChip() {
  const timer = useStore((s) => s.timer);
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    if (!timer) return undefined;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [timer]);
  if (!timer) return null;
  if (timer.stopAt) {
    return (
      <button className="btn sm" style={{ borderColor: 'var(--error-main)', color: 'var(--error-main)' }} title="The stop didn't save. Click to try again; it keeps the time you first clicked Stop." onClick={stopTimer}>
        <Icon name="alert" size={12} /> Stop not saved — retry
      </button>
    );
  }
  const sec = Math.max(0, Math.floor((Date.now() - new Date(timer.started_at).getTime()) / 1000));
  return (
    <button className="btn sm timer-running" title={'Timer on ' + timer.label + ' — click to stop & log'} onClick={stopTimer}
      style={{ maxWidth: 260 }}>
      <span className="timer-dot" />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{timer.label}</span>
      <span className="mono">{fmtElapsed(sec)}</span>
      <Icon name="stop" size={12} />
    </button>
  );
}

export function Topbar({ crumbs, onOpenPro }) {
  const pros = useStore((s) => s.pros);
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [sel, setSel] = React.useState(0);
  const results = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return null;
    return pros.filter((p) => String(p.org_id).includes(needle) || String(p.business_name || '').toLowerCase().includes(needle) || String(p.dba || '').toLowerCase().includes(needle)).slice(0, 8);
  }, [q, pros]);

  function pick(r) { onOpenPro(r.org_id); setOpen(false); setQ(''); }

  return (
    <div className="topbar">
      <div className="tb-crumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Icon name="chevron-right" size={14} className="sep" />}
            {c.onClick ? <a onClick={c.onClick} style={{ cursor: 'pointer' }}>{c.label}</a>
              : i === crumbs.length - 1 ? <span className="here">{c.label}</span> : <a>{c.label}</a>}
          </React.Fragment>
        ))}
      </div>
      <div className="tb-search">
        <Icon name="search" size={15} />
        <input
          placeholder="Search Org ID or business name…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setSel(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!results || !results.length) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((sel + 1) % results.length); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSel((sel - 1 + results.length) % results.length); }
            if (e.key === 'Enter') pick(results[sel]);
            if (e.key === 'Escape') { setQ(''); e.currentTarget.blur(); }
          }}
        />
        {open && results && results.length > 0 && (
          <div className="results" onMouseDown={(e) => e.preventDefault()}>
            <div className="res-group">Pros</div>
            {results.map((r, i) => (
              <div key={r.org_id} className={'res' + (i === sel ? ' sel' : '')} onClick={() => pick(r)}>
                <div>
                  <div className="biz">{r.business_name}{r.archived && <span className="muted small"> · archived</span>}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>{[r.vertical, r.state].filter(Boolean).join(' · ') || '—'}</div>
                </div>
                <div className="id">{r.org_id}</div>
              </div>
            ))}
          </div>
        )}
        {open && results && results.length === 0 && (
          <div className="results"><div style={{ padding: 12, color: 'var(--fg-secondary)', fontSize: 13 }}>No matches</div></div>
        )}
      </div>
      <div className="tb-actions">
        <PointsChip />
        <SkinPicker />
        <TimerChip />
        <SyncPill />
        <FeedbackButton />
        <button className="tb-icon-btn" title="Refresh data" onClick={refreshAll}><Icon name="refresh" size={17} /></button>
        <HelpButton />
        <PrefsMenu />
      </div>
    </div>
  );
}

/** Per-person contest skin; hidden when an admin turns the contest off. */
export function SkinPicker() {
  const prefs = useStore((s) => s.prefs);
  const enabled = useStore((s) => s.config.game_enabled !== false);
  if (!enabled) return null;
  return (
    <label className="tb-skin" title="Pick a contest skin (only changes how the app looks for you)">
      <select aria-label="Skin" value={SKINS[prefs.skin] ? prefs.skin : ''} onChange={(e) => savePrefs({ skin: e.target.value })}>
        <option value="">Classic (no skin)</option>
        {SKIN_ORDER.map((id) => <option key={id} value={id}>{SKINS[id].name}</option>)}
      </select>
    </label>
  );
}

function PointsChip() {
  const skin = useSkin();
  const game = useStore((s) => s.game);
  const me = useStore((s) => s.user && s.user.email);
  if (!skin || !game || !game.enabled) return null;
  const mine = (game.people || []).find((p) => p.email === me);
  return (
    <button className="tb-points" title={'Your ' + skin.points + ' this contest — open ' + skin.game} onClick={() => go('game')}>
      <Icon name="trophy" size={13} /> {(mine ? mine.points : 0).toLocaleString()} {skin.points}
    </button>
  );
}

function HelpButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <span className="popover-host">
      <button className="tb-icon-btn" title="Help" onClick={() => setOpen(!open)}><Icon name="help" size={18} /></button>
      <Popover open={open} onClose={() => setOpen(false)} align="right" style={{ width: 300 }}>
        <h6>Keyboard + tips</h6>
        <div className="small" style={{ lineHeight: 1.7, color: 'var(--fg-secondary)' }}>
          <div><span className="kbd">Esc</span> close drawer / cancel edit</div>
          <div><span className="kbd">J</span> / <span className="kbd">K</span> previous / next record in drawer</div>
          <div><span className="kbd">Enter</span> save a task or inline edit</div>
          <div><span className="kbd">⌘/Ctrl ↵</span> post a note</div>
          <div style={{ marginTop: 8 }}>Every change saves in the background — watch the pill in the top bar. Use <Icon name="refresh" size={11} /> to pull the latest changes from teammates.</div>
          <button className="btn sm" style={{ marginTop: 10 }} onClick={() => { setOpen(false); navigate({ view: 'guide' }); }}><Icon name="file-text" size={12} /> Open the full guide</button>
        </div>
      </Popover>
    </span>
  );
}

function Seg({ value, options, onChange }) {
  return (
    <div className="tm-seg">
      {options.map((o) => (
        <button key={o.value} className={cx(value === o.value && 'on')} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

const ACCENTS = { blue: '#0E6FBE', indigo: '#4F46E5', forest: '#1F8A5B', graphite: '#37414D' };

function PrefsMenu() {
  const user = useStore((s) => s.user);
  const prefs = useStore((s) => s.prefs);
  const [open, setOpen] = React.useState(false);
  return (
    <span className="popover-host">
      <button className="sb-avatar" style={{ background: user.color, width: 32, height: 32, border: 0, cursor: 'pointer' }} title="Preferences" onClick={() => setOpen(!open)}>
        {user.initials}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} align="right" style={{ width: 300 }}>
        <div style={{ fontWeight: 600 }}>{user.name}</div>
        <div className="muted small" style={{ marginBottom: 10 }}>{user.email}</div>
        <h6>Layout</h6>
        <div className="tm-pref-row"><span>Navigation</span>
          <Seg value={prefs.nav === 'top' ? 'top' : prefs.sidebar_collapsed ? 'rail' : 'sidebar'}
            options={[{ value: 'sidebar', label: 'Sidebar' }, { value: 'rail', label: 'Rail' }, { value: 'top', label: 'Top' }]}
            onChange={(v) => savePrefs(v === 'top' ? { nav: 'top' } : { nav: 'sidebar', sidebar_collapsed: v === 'rail' })} />
        </div>
        <div className="tm-pref-row"><span>Detail view</span>
          <Seg value={prefs.detail_layout || 'drawer'} options={[{ value: 'drawer', label: 'Drawer' }, { value: 'page', label: 'Full page' }]}
            onChange={(v) => savePrefs({ detail_layout: v })} />
        </div>
        <div className="tm-pref-row"><span>Density</span>
          <Seg value={prefs.density || 'cozy'} options={[{ value: 'compact', label: 'Compact' }, { value: 'cozy', label: 'Cozy' }, { value: 'comfortable', label: 'Comfy' }]}
            onChange={(v) => savePrefs({ density: v })} />
        </div>
        <div className="tm-pref-row"><span>Dark mode</span>
          <Seg value={prefs.dark ? 'on' : 'off'} options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]} onChange={(v) => savePrefs({ dark: v === 'on' })} />
        </div>
        <h6 style={{ marginTop: 10 }}>Style</h6>
        <div className="tm-pref-row"><span>Accent</span>
          <span style={{ display: 'inline-flex', gap: 6 }}>
            {Object.entries(ACCENTS).map(([k, c]) => (
              <button key={k} title={k} onClick={() => savePrefs({ accent: k })}
                style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: (prefs.accent || 'blue') === k ? '2px solid var(--fg-primary)' : '2px solid transparent', cursor: 'pointer' }} />
            ))}
          </span>
        </div>
        <div className="tm-pref-row"><span>Status pills</span>
          <Seg value={prefs.pill || 'filled'} options={[{ value: 'filled', label: 'Filled' }, { value: 'outlined', label: 'Outline' }, { value: 'dot', label: 'Dot' }]}
            onChange={(v) => savePrefs({ pill: v })} />
        </div>
        <div className="tm-pref-row"><span>Feedback</span>
          <Seg value={prefs.feedback || 'inline'} options={[{ value: 'inline', label: 'Banner' }, { value: 'toast', label: 'Toast' }]}
            onChange={(v) => savePrefs({ feedback: v })} />
        </div>
      </Popover>
    </span>
  );
}

export function applyAccent(name) {
  const A = {
    blue: { main: '#0E6FBE', dark: '#0D47A1', 50: '#E3F2FD' },
    indigo: { main: '#4F46E5', dark: '#3730A3', 50: '#EEF2FF' },
    forest: { main: '#1F8A5B', dark: '#0F5B3B', 50: '#E0F4EA' },
    graphite: { main: '#37414D', dark: '#1F2937', 50: '#EDF0F5' },
  };
  const a = A[name] || A.blue;
  const r = document.documentElement.style;
  r.setProperty('--primary-main', a.main);
  r.setProperty('--primary-dark', a.dark);
  r.setProperty('--primary-50', a['50']);
  r.setProperty('--info-main', a.main);
}

export { useRoute };
