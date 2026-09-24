/* Shared icons (inline SVG, currentColor) + chrome (sidebar + topbar). */

const Icon = ({ name, size = 16, ...rest }) => {
  const s = size;
  const props = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', ...rest };
  switch (name) {
    case 'home':        return <svg {...props}><path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/></svg>;
    case 'inbox':       return <svg {...props}><path d="M3 13h5l1 3h6l1-3h5"/><path d="M3 13V6a2 2 0 012-2h14a2 2 0 012 2v7"/></svg>;
    case 'check-circle':return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/></svg>;
    case 'users':       return <svg {...props}><circle cx="9" cy="8" r="3.5"/><path d="M2.5 19a6.5 6.5 0 0113 0"/><circle cx="17" cy="9" r="2.75"/><path d="M14 19a5.5 5.5 0 017-5"/></svg>;
    case 'folder':      return <svg {...props}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>;
    case 'kanban':      return <svg {...props}><rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="14" rx="1"/></svg>;
    case 'list':        return <svg {...props}><line x1="8" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="8" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5"/><circle cx="4" cy="12" r="1.5"/><circle cx="4" cy="18" r="1.5"/></svg>;
    case 'table':       return <svg {...props}><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="4" x2="9" y2="20"/></svg>;
    case 'calendar':    return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/></svg>;
    case 'file-text':   return <svg {...props}><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="14 3 14 9 20 9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="14" y2="17"/></svg>;
    case 'archive':     return <svg {...props}><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a2 2 0 002 2h10a2 2 0 002-2V8"/><line x1="10" y1="13" x2="14" y2="13"/></svg>;
    case 'settings':    return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 01-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 012.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 012.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>;
    case 'plus':        return <svg {...props}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
    case 'search':      return <svg {...props}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
    case 'bell':        return <svg {...props}><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>;
    case 'help':        return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 015.8 1c0 2-3 2.5-3 4"/><line x1="12" y1="17" x2="12" y2="17.5"/></svg>;
    case 'chevron-down':return <svg {...props}><polyline points="6 9 12 15 18 9"/></svg>;
    case 'chevron-right':return <svg {...props}><polyline points="9 6 15 12 9 18"/></svg>;
    case 'chevron-left':return <svg {...props}><polyline points="15 6 9 12 15 18"/></svg>;
    case 'sparkles':    return <svg {...props}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M19 14l.7 2L22 16.7 19.7 17.4 19 19.7l-.7-2.3-2.3-.7L18.3 16z"/></svg>;
    case 'sidebar':     return <svg {...props}><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/></svg>;
    case 'filter':      return <svg {...props}><polygon points="3 4 21 4 14 12 14 19 10 21 10 12 3 4"/></svg>;
    case 'sort':        return <svg {...props}><path d="M3 6h13M3 12h9M3 18h5"/><polyline points="17 14 21 18 17 22"/><line x1="21" y1="18" x2="14" y2="18"/></svg>;
    case 'group':       return <svg {...props}><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="12" width="12" height="3" rx="1"/><rect x="3" y="17" width="14" height="3" rx="1"/></svg>;
    case 'columns':     return <svg {...props}><rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/></svg>;
    case 'arrow-up':    return <svg {...props}><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>;
    case 'arrow-down':  return <svg {...props}><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>;
    case 'more':        return <svg {...props}><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>;
    case 'drag':        return <svg {...props}><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>;
    case 'check':       return <svg {...props}><polyline points="20 6 9 17 4 12"/></svg>;
    case 'x':           return <svg {...props}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
    case 'alert':       return <svg {...props}><path d="M12 2L1 21h22L12 2z"/><line x1="12" y1="10" x2="12" y2="14"/><circle cx="12" cy="17.5" r="0.5" fill="currentColor"/></svg>;
    case 'link':        return <svg {...props}><path d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"/><path d="M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/></svg>;
    case 'paperclip':   return <svg {...props}><path d="M21 12l-9 9a5.5 5.5 0 11-7.8-7.8l9-9a3.7 3.7 0 015.2 5.2L9.5 18.5a1.8 1.8 0 11-2.6-2.6L15 8"/></svg>;
    case 'mail':        return <svg {...props}><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/></svg>;
    case 'flag':        return <svg {...props}><path d="M4 4v17"/><path d="M4 4h11l2 3h4v8h-6l-2-3H4"/></svg>;
    case 'clock':       return <svg {...props}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>;
    case 'chart':       return <svg {...props}><line x1="4" y1="20" x2="20" y2="20"/><rect x="5" y="11" width="3.5" height="7"/><rect x="10.5" y="7" width="3.5" height="11"/><rect x="16" y="13" width="3.5" height="5"/></svg>;
    case 'timer':       return <svg {...props}><circle cx="12" cy="13" r="8"/><path d="M12 13V9"/><line x1="9" y1="2" x2="15" y2="2"/><line x1="12" y1="2" x2="12" y2="5"/></svg>;
    case 'stop':        return <svg {...props}><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>;
    case 'play':        return <svg {...props}><polygon points="7 5 19 12 7 19 7 5"/></svg>;
    case 'download':    return <svg {...props}><path d="M12 3v12"/><polyline points="7 10 12 15 17 10"/><line x1="4" y1="21" x2="20" y2="21"/></svg>;
    case 'sun':         return <svg {...props}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/></svg>;
    case 'moon':        return <svg {...props}><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>;
    case 'star':        return <svg {...props}><polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2"/></svg>;
    case 'tasks':       return <svg {...props}><polyline points="4 7 6 9 10 5"/><polyline points="4 14 6 16 10 12"/><line x1="13" y1="7" x2="20" y2="7"/><line x1="13" y1="14" x2="20" y2="14"/></svg>;
    case 'template':    return <svg {...props}><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="9" x2="9" y2="20"/></svg>;
    case 'eye':         return <svg {...props}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'wand':        return <svg {...props}><path d="M15 4l5 5L9 20H4v-5L15 4z"/><line x1="13" y1="6" x2="18" y2="11"/></svg>;
    case 'history':     return <svg {...props}><polyline points="3 12 3 6 9 6"/><path d="M3.5 9.5a9 9 0 11-2 5"/><polyline points="12 8 12 12 15 14"/></svg>;
    case 'circle':      return <svg {...props}><circle cx="12" cy="12" r="9"/></svg>;
    case 'briefcase':   return <svg {...props}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="3" y1="13" x2="21" y2="13"/></svg>;
    case 'phone':       return <svg {...props}><path d="M22 17v3a2 2 0 01-2.2 2A19 19 0 012 4.2 2 2 0 014 2h3a2 2 0 012 1.7 12 12 0 00.7 2.8 2 2 0 01-.5 2L8 9.7a16 16 0 006.3 6.3l1.2-1.2a2 2 0 012-.5 12 12 0 002.8.7A2 2 0 0122 17z"/></svg>;
    default:            return <svg {...props}><circle cx="12" cy="12" r="3"/></svg>;
  }
};

/* ---- Avatar ---- */
function Avatar({ email, size = 'md', empty }) {
  const m = email && teamByEmail[email];
  const cls = size === 'lg' ? 'av lg' : size === 'xl' ? 'av xl' : 'av';
  if (empty || !m) return <span className={cls + ' empty'} title="unassigned"><Icon name="users" size={size === 'lg' ? 16 : 12} /></span>;
  return <span className={cls} style={{ background: m.color, color: '#fff' }} title={m.name}>{m.initials}</span>;
}
function AvatarStack({ emails, max = 3 }) {
  const list = emails.filter(Boolean).slice(0, max);
  return <span className="av-stack">{list.map((e, i) => <Avatar key={i} email={e} />)}</span>;
}

/* ---- Pill ---- */
function Pill({ kind, value }) {
  const cls = kind === 'lifecycle' ? `pill lc-${value}` : `pill pp-${value}`;
  const label = (kind === 'lifecycle' ? ENUM_LABELS.LIFECYCLE_STATUS : ENUM_LABELS.PIPELINE_STATUS)[value] || value;
  return <span className={cls}>{label}</span>;
}

/* ---- Sidebar ---- */
const NAV = [
  { id: 'home',       label: 'Home',         icon: 'home' },
  { id: 'inbox',      label: 'Inbox',        icon: 'inbox', countKey: 'inbox' },
  { id: 'my-tasks',   label: 'My Tasks',     icon: 'check-circle', countKey: 'myTasks' },
];
const NAV_WORK = [
  { id: 'pros',       label: 'Pros',         icon: 'users' },
  { id: 'projects',   label: 'Projects',     icon: 'briefcase' },
  { id: 'templates',  label: 'Templates',    icon: 'template' },
  { id: 'reports',    label: 'Reports',      icon: 'chart' },
  { id: 'archive',    label: 'Archive',      icon: 'archive' },
];
const SAVED_VIEWS_SIDEBAR = [
  { id: 'pros-my',   label: 'My pros',          icon: 'star', route: { view: 'pros', tab: 'my' } },
  { id: 'pros-risk', label: 'At-risk pros',     icon: 'star', route: { view: 'pros', tab: 'risk' } },
  { id: 'proj-mine', label: 'My projects',      icon: 'star', route: { view: 'projects', tab: 'my' } },
  { id: 'proj-qa',   label: 'Pending peer review', icon: 'star', route: { view: 'projects', tab: 'qa' } },
];

function Sidebar({ active, onNav, collapsed, setCollapsed, counts }) {
  return (
    <aside className="sidebar">
      <div className="sb-head">
        <span className="sb-logo">
          {/* Subtle "TM" mark to keep it tax-manager but HCP blue */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M5 6h14M12 6v13"/><path d="M16 17h4M16 13h4"/>
          </svg>
        </span>
        <div className="sb-title">
          Tax Manager
          <small>Housecall Pro</small>
        </div>
        <button className="sb-collapse-btn" title="Collapse sidebar" onClick={() => setCollapsed(true)}>
          <Icon name="sidebar" size={16} />
        </button>
      </div>

      <button className="sb-create" onClick={() => onNav('inbox')}>
        <Icon name="plus" size={16} />
        <span className="label">Claim from Inbox</span>
      </button>

      <nav className="sb-section">
        {NAV.map(n => (
          <a key={n.id} className={'sb-item' + (active === n.id ? ' active' : '')} onClick={() => onNav(n.id)}>
            <Icon name={n.icon} size={17} className="icon" />
            <span className="label">{n.label}</span>
            {counts[n.countKey] != null && <span className="count">{counts[n.countKey]}</span>}
          </a>
        ))}
      </nav>

      <div className="sb-divider"></div>

      <nav className="sb-section">
        <div className="sb-section-label">Work</div>
        {NAV_WORK.map(n => (
          <a key={n.id} className={'sb-item' + (active === n.id ? ' active' : '')} onClick={() => onNav(n.id)}>
            <Icon name={n.icon} size={17} className="icon" />
            <span className="label">{n.label}</span>
            {counts[n.id] != null && <span className="count">{counts[n.id]}</span>}
          </a>
        ))}
      </nav>

      <div className="sb-divider"></div>

      <nav className="sb-section">
        <div className="sb-section-label">
          <span>Starred</span>
          <button className="add" title="Save current view"><Icon name="plus" size={12} /></button>
        </div>
        {SAVED_VIEWS_SIDEBAR.map(s => (
          <a key={s.id} className="sb-item" onClick={() => onNav(s.route.view, { savedView: s.route.tab })}>
            <Icon name="star" size={14} className="icon" />
            <span className="label">{s.label}</span>
          </a>
        ))}
      </nav>

      <div className="sb-foot">
        <span className="sb-avatar" style={{ background: ME.color }}>{ME.initials}</span>
        <div className="sb-user">
          <div className="name">{ME.name}</div>
          <div className="role">Exec · {ME.email.split('@')[0]}</div>
        </div>
      </div>
    </aside>
  );
}

function CollapsedSidebar({ active, onNav, setCollapsed }) {
  const items = [...NAV, ...NAV_WORK];
  return (
    <aside className="sidebar">
      <div className="sb-head">
        <span className="sb-logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M5 6h14M12 6v13"/><path d="M16 17h4M16 13h4"/>
          </svg>
        </span>
      </div>
      <button className="sb-create" onClick={() => setCollapsed(false)} title="Expand sidebar">
        <Icon name="plus" size={16} />
      </button>
      <nav className="sb-section" style={{ flex: 1 }}>
        {items.map(n => (
          <a key={n.id} className={'sb-item' + (active === n.id ? ' active' : '')} onClick={() => onNav(n.id)} title={n.label}>
            <Icon name={n.icon} size={18} className="icon" />
          </a>
        ))}
      </nav>
      <div className="sb-foot">
        <span className="sb-avatar" style={{ background: ME.color }}>{ME.initials}</span>
      </div>
    </aside>
  );
}

/* ---- Topbar ---- */
function Topbar({ crumbs, onNav }) {
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);

  const results = React.useMemo(() => {
    if (!q.trim()) return null;
    const needle = q.trim().toLowerCase();
    return PROS.filter(p =>
      p.org_id.includes(needle) || p.business_name.toLowerCase().includes(needle)
    ).slice(0, 8);
  }, [q]);

  return (
    <div className="topbar">
      <div className="tb-crumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Icon name="chevron-right" size={14} className="sep" />}
            {c.onClick
              ? <a onClick={c.onClick} style={{ cursor: 'pointer' }}>{c.label}</a>
              : i === crumbs.length - 1
                ? <span className="here">{c.label}</span>
                : <a>{c.label}</a>}
          </React.Fragment>
        ))}
      </div>

      <div className="tb-search">
        <Icon name="search" size={15} />
        <input
          placeholder="Search Org ID or business name…"
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {open && results && results.length > 0 && (
          <div className="results" onMouseDown={e => e.preventDefault()}>
            <div className="res-group">Pros</div>
            {results.map(r => (
              <div key={r.org_id} className="res" onClick={() => { onNav('pro-detail', { orgId: r.org_id }); setOpen(false); setQ(''); }}>
                <div>
                  <div className="biz">{r.business_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>{r.vertical} · {r.state}</div>
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
        <SyncPill />
        <button className="tb-icon-btn" title="Help"><Icon name="help" size={18} /></button>
        <button className="tb-icon-btn" title="Notifications"><Icon name="bell" size={18} /></button>
        <span className="sb-avatar" style={{ background: ME.color, width: 32, height: 32 }}>{ME.initials}</span>
      </div>
    </div>
  );
}

/* sync pill — shows the hidden-iframe POST cycle visually */
function SyncPill() {
  const s = (typeof useSync === 'function') ? useSync() : { phase: 'idle', label: '', ts: Date.now() };
  const [, force] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => force(x => x + 1), 15000);
    return () => clearInterval(t);
  }, []);
  if (s.phase === 'saving') return <span className="sync-pill saving" title="Background POST → __ghost iframe → doPost"><span className="dot" /> Saving {s.label}…</span>;
  if (s.phase === 'error')  return <span className="sync-pill error"  title="Last sync failed — click to retry"><span className="dot" /> Sync failed</span>;
  return <span className="sync-pill" title="All changes synced to Records DB"><span className="dot" /> Synced {timeAgo(s.ts)}</span>;
}

/* Days-from-today helper for due-date colors */
function dueClass(iso) {
  if (!iso) return '';
  const due = new Date(iso + 'T12:00:00');
  const today = new Date(window.MOCK_TODAY || '2026-05-13' + 'T00:00:00');
  const diff = Math.round((due - today) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  return '';
}
function fmtDue(iso, withYear) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  const today = new Date((window.MOCK_TODAY || '2026-05-13') + 'T00:00:00');
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  const m = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (withYear || diff < -30 || diff > 365) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return m;
}

Object.assign(window, { Icon, Avatar, AvatarStack, Pill, Sidebar, CollapsedSidebar, Topbar, dueClass, fmtDue });
