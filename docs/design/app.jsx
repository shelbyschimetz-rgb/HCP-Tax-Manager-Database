/* App router + Tweaks panel + entry. */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "nav": "sidebar",
  "density": "cozy",
  "dark": false,
  "pillStyle": "filled",
  "accent": "blue",
  "tasksTreatment": "spreadsheet",
  "detailLayout": "drawer",
  "flashStyle": "inline"
}/*EDITMODE-END*/;

/* SyncBus — simulates the hidden-iframe POST cycle.
 * Real Apps Script implementation: every action does
 *   const f = makeHiddenForm({ action, ...payload });
 *   f.target = '__ghost';
 *   f.submit();
 * and the ghost iframe receives doPost's response.
 * Status pill in topbar shows the cycle.
 */
const SyncBus = (() => {
  const listeners = new Set();
  let state = { phase: 'idle', label: '', ts: Date.now() };
  let timer = null;
  function set(next) { state = next; listeners.forEach(l => l(state)); }
  function start(label) {
    if (timer) clearTimeout(timer);
    set({ phase: 'saving', label, ts: Date.now() });
    const delay = 350 + Math.random() * 250; // simulate Apps Script roundtrip ~400ms
    timer = setTimeout(() => set({ phase: 'idle', label: '', ts: Date.now() }), delay);
  }
  function fail(label) {
    if (timer) clearTimeout(timer);
    set({ phase: 'error', label, ts: Date.now() });
  }
  function subscribe(l) { listeners.add(l); l(state); return () => listeners.delete(l); }
  return { start, fail, subscribe, get: () => state };
})();
function useSync() {
  const [s, setS] = React.useState(SyncBus.get());
  React.useEffect(() => SyncBus.subscribe(setS), []);
  return s;
}
function timeAgo(ts) {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return sec + 's ago';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + 'm ago';
  return Math.floor(min / 60) + 'h ago';
}

const ACCENTS = {
  blue:    { main: '#0E6FBE', dark: '#0D47A1', 50: '#E3F2FD' },
  indigo:  { main: '#4F46E5', dark: '#3730A3', 50: '#EEF2FF' },
  forest:  { main: '#1F8A5B', dark: '#0F5B3B', 50: '#E0F4EA' },
  graphite:{ main: '#37414D', dark: '#1F2937', 50: '#EDF0F5' },
};

function setAccent(name) {
  const a = ACCENTS[name] || ACCENTS.blue;
  document.documentElement.style.setProperty('--primary-main', a.main);
  document.documentElement.style.setProperty('--primary-dark', a.dark);
  document.documentElement.style.setProperty('--primary-50', a['50']);
  document.documentElement.style.setProperty('--info-main', a.main);
}

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [collapsed, setCollapsed] = React.useState(false);
  const [route, setRoute] = React.useState({ view: 'home' });
  const [drawer, setDrawer] = React.useState(null); // { view: 'pro-detail'|'project-detail', orgId/projectId }
  const [flash, setFlash] = React.useState(null);

  React.useEffect(() => setAccent(tweaks.accent), [tweaks.accent]);

  const sidebarCollapsed = collapsed || tweaks.nav === 'collapsed-sidebar';
  const navMode = tweaks.nav;
  const useDrawer = tweaks.detailLayout === 'drawer';

  function onNav(view, params = {}) {
    // Detail views open in drawer (no full reload), unless drawer mode disabled OR opened from drawer "expand"
    if (useDrawer && (view === 'pro-detail' || view === 'project-detail')) {
      setDrawer({ view, ...params });
      return;
    }
    setRoute({ view, ...params });
    setDrawer(null);
    if (view === 'intake') setFlash({ kind: 'success', msg: `Claimed ${params.sfdcId || ''} — onboarding wizard ready.` });
  }
  function expandDrawer() {
    if (drawer) {
      setRoute({ ...drawer });
      setDrawer(null);
    }
  }
  function closeDrawer() { setDrawer(null); }

  // Esc closes drawer
  React.useEffect(() => {
    if (!drawer) return;
    const h = e => { if (e.key === 'Escape') closeDrawer(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [drawer]);

  const crumbs = (() => {
    switch (route.view) {
      case 'home':           return [{ label: 'Home' }];
      case 'inbox':          return [{ label: 'Inbox' }];
      case 'pros':           return [{ label: 'Pros' }];
      case 'pro-detail':     return [{ label: 'Pros', onClick: () => onNav('pros') }, { label: (PROS.find(p => p.org_id === route.orgId) || PROS[0]).business_name }];
      case 'projects':       return [{ label: 'Projects' }];
      case 'project-detail': return [{ label: 'Projects', onClick: () => onNav('projects') }, { label: (PROJECTS.find(p => p.project_id === route.projectId) || PROJECTS[0]).business_name + ' · TY' + (PROJECTS.find(p => p.project_id === route.projectId) || PROJECTS[0]).tax_year }];
      case 'my-tasks':       return [{ label: 'My Tasks' }];
      case 'templates':      return [{ label: 'Templates' }];
      case 'reports':        return [{ label: 'Reports' }];
      case 'archive':        return [{ label: 'Archive' }];
      case 'intake':         return [{ label: 'Inbox', onClick: () => onNav('inbox') }, { label: 'Onboarding wizard' }];
      default:               return [{ label: 'Home' }];
    }
  })();

  const counts = {
    inbox: SFDC_INBOX.length,
    myTasks: MY_TASKS.filter(t => t.status !== 'DONE').length,
    pros: PROS.length,
    projects: PROJECTS.filter(p => p.pipeline_status !== 'COMPLETE').length,
  };

  const activeNav = route.view === 'pro-detail' ? 'pros'
    : route.view === 'project-detail' ? 'projects'
    : route.view === 'intake' ? 'inbox'
    : route.view;

  const screen = (() => {
    switch (route.view) {
      case 'home':           return <Home onNav={onNav} />;
      case 'inbox':          return <Inbox onNav={onNav} />;
      case 'pros':           return <ProsList initialSavedView={route.savedView} onNav={onNav} />;
      case 'pro-detail':     return <ProDetail orgId={route.orgId} onNav={onNav} />;
      case 'projects':       return <ProjectsList initialSavedView={route.savedView} onNav={onNav} />;
      case 'project-detail': return <ProjectDetail projectId={route.projectId} onNav={onNav} />;
      case 'my-tasks':       return <MyTasks onNav={onNav} />;
      case 'templates':      return <Templates onNav={onNav} />;
      case 'reports':        return <Reports onNav={onNav} />;
      case 'archive':        return <Archive onNav={onNav} />;
      case 'intake':         return <IntakeWizard sfdcId={route.sfdcId} onNav={onNav} />;
      default:               return <Home onNav={onNav} />;
    }
  })();

  const appClass = 'app'
    + (sidebarCollapsed ? ' collapsed' : '')
    + (tweaks.dark ? ' dark' : '')
    + (navMode === 'top' ? ' nav-top' : '')
    + (drawer ? ' drawer-open' : '');

  return (
    <div className={appClass}
         data-density={tweaks.density}
         data-pill={tweaks.pillStyle}
         data-tasks={tweaks.tasksTreatment}>
      {navMode === 'top'
        ? <TopNav active={activeNav} onNav={onNav} counts={counts} />
        : sidebarCollapsed
          ? <CollapsedSidebar active={activeNav} onNav={onNav} setCollapsed={setCollapsed} />
          : <Sidebar active={activeNav} onNav={onNav} collapsed={collapsed} setCollapsed={setCollapsed} counts={counts} />}

      <div className="main">
        <Topbar crumbs={crumbs} onNav={onNav} />
        <div className="content">
          <div className="content-inner">
            {tweaks.flashStyle === 'inline' && flash && (
              <div className={'flash ' + flash.kind}>
                <Icon name={flash.kind === 'success' ? 'check-circle' : 'alert'} size={16} />
                <span>{flash.msg}</span>
                <span className="x" onClick={() => setFlash(null)}><Icon name="x" size={14} /></span>
              </div>
            )}
            {screen}
          </div>
        </div>
      </div>

      {drawer && (
        <DetailDrawer
          drawer={drawer}
          onClose={closeDrawer}
          onExpand={expandDrawer}
          onSwitch={(d) => setDrawer(d)}
        />
      )}

      {tweaks.flashStyle === 'toast' && flash && (
        <div style={{ position: 'fixed', bottom: 80, right: 24, zIndex: 1000 }}>
          <div className={'flash ' + flash.kind} style={{ marginBottom: 0, boxShadow: 'var(--shadow-modal)' }}>
            <Icon name={flash.kind === 'success' ? 'check-circle' : 'alert'} size={16} />
            <span>{flash.msg}</span>
            <span className="x" onClick={() => setFlash(null)}><Icon name="x" size={14} /></span>
          </div>
        </div>
      )}

      {/* Hidden iframe — every mutation form posts target=__ghost so the main page never reloads */}
      <iframe name="__ghost" className="ghost-iframe" title="background-sync" />

      <TaxTweaks tweaks={tweaks} setTweak={setTweak} />
    </div>
  );
}

/* ---- DetailDrawer: slides in from the right; list stays mounted underneath ---- */
function DetailDrawer({ drawer, onClose, onExpand, onSwitch }) {
  const isProject = drawer.view === 'project-detail';
  const list = isProject ? PROJECTS : PROS;
  const currentIdx = isProject
    ? list.findIndex(p => p.project_id === drawer.projectId)
    : list.findIndex(p => p.org_id === drawer.orgId);
  const prev = currentIdx > 0 ? list[currentIdx - 1] : null;
  const next = currentIdx >= 0 && currentIdx < list.length - 1 ? list[currentIdx + 1] : null;
  function goPrev() {
    if (!prev) return;
    onSwitch(isProject ? { view: 'project-detail', projectId: prev.project_id } : { view: 'pro-detail', orgId: prev.org_id });
  }
  function goNext() {
    if (!next) return;
    onSwitch(isProject ? { view: 'project-detail', projectId: next.project_id } : { view: 'pro-detail', orgId: next.org_id });
  }
  const here = isProject
    ? (list[currentIdx]?.business_name + ' · TY' + list[currentIdx]?.tax_year)
    : list[currentIdx]?.business_name;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}></div>
      <aside className="drawer" role="dialog" aria-label="Detail">
        <div className="drawer-head">
          <span className="nav">
            <button className="icon-btn" disabled={!prev} onClick={goPrev} title="Previous record (J)"><Icon name="chevron-left" size={16} /></button>
            <button className="icon-btn" disabled={!next} onClick={goNext} title="Next record (K)"><Icon name="chevron-right" size={16} /></button>
          </span>
          <span className="where">
            <a onClick={onClose} style={{ cursor: 'pointer' }}>{isProject ? 'Projects' : 'Pros'}</a>
            <Icon name="chevron-right" size={12} style={{ color: 'var(--grey-400)' }} />
            <span className="here">{here}</span>
            <span className="muted small" style={{ marginLeft: 8 }}>{currentIdx + 1} of {list.length}</span>
          </span>
          <span className="spacer"></span>
          <button className="icon-btn" onClick={onExpand} title="Open as full page">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
          <button className="icon-btn" onClick={onClose} title="Close (Esc)"><Icon name="x" size={16} /></button>
        </div>
        <div className="drawer-body">
          {isProject
            ? <ProjectDetail projectId={drawer.projectId} onNav={(view, params) => onSwitch({ view, ...params })} />
            : <ProDetail orgId={drawer.orgId} onNav={(view, params) => onSwitch({ view, ...params })} />}
        </div>
      </aside>
    </>
  );
}

/* Top nav alternative — for the Tweaks comparison */
function TopNav({ active, onNav, counts }) {
  const items = [
    { id: 'home',     label: 'Home',     icon: 'home' },
    { id: 'inbox',    label: 'Inbox',    icon: 'inbox',     count: counts.inbox },
    { id: 'my-tasks', label: 'My Tasks', icon: 'check-circle', count: counts.myTasks },
    { id: 'pros',     label: 'Pros',     icon: 'users' },
    { id: 'projects', label: 'Projects', icon: 'briefcase' },
    { id: 'templates',label: 'Templates',icon: 'template' },
    { id: 'archive',  label: 'Archive',  icon: 'archive' },
  ];
  return (
    <>
      <style>{`
        .app.nav-top { grid-template-columns: 1fr; grid-template-rows: 52px 1fr; }
        .app.nav-top .topnav-row { display: flex; align-items: center; gap: 2px; padding: 0 16px; height: 52px; background: #fff; border-bottom: 1px solid var(--border-light); }
        .app.nav-top .topnav-brand { font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 8px; margin-right: 12px; }
        .app.nav-top .topnav-brand .sb-logo { width: 26px; height: 26px; }
        .app.nav-top .topnav-item { display: inline-flex; align-items: center; gap: 6px; padding: 0 12px; height: 52px; background: transparent; border: 0; border-bottom: 2px solid transparent; cursor: pointer; color: var(--fg-secondary); font: inherit; font-size: 13px; font-weight: 500; }
        .app.nav-top .topnav-item:hover { color: var(--fg-primary); }
        .app.nav-top .topnav-item.active { color: var(--primary-main); border-bottom-color: var(--primary-main); font-weight: 600; }
        .app.nav-top .topnav-item .count { background: var(--grey-200); color: var(--fg-secondary); font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 999px; }
        .app.nav-top .topnav-item.active .count { background: var(--primary-50); color: var(--primary-dark); }
        .app.nav-top .main { grid-column: 1; }
      `}</style>
      <div className="topnav-row">
        <span className="topnav-brand">
          <span className="sb-logo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M5 6h14M12 6v13"/><path d="M16 17h4M16 13h4"/>
            </svg>
          </span>
          Tax Manager
        </span>
        {items.map(n => (
          <button key={n.id} className={'topnav-item' + (active === n.id ? ' active' : '')} onClick={() => onNav(n.id)}>
            <Icon name={n.icon} size={15} />
            {n.label}
            {n.count != null && <span className="count">{n.count}</span>}
          </button>
        ))}
        <div className="spacer" style={{ flex: 1 }}></div>
        <span className="sb-avatar" style={{ background: ME.color }}>{ME.initials}</span>
      </div>
    </>
  );
}

/* ====== Tweaks panel ====== */
function TaxTweaks({ tweaks, setTweak }) {
  return (
    <TweaksPanel title="Tweaks" defaultPosition={{ right: 16, bottom: 16 }}>
      <TweakSection title="Layout">
        <TweakSelect
          label="Navigation"
          value={tweaks.nav}
          options={[
            { value: 'sidebar', label: 'Left sidebar (expanded)' },
            { value: 'collapsed-sidebar', label: 'Left sidebar (icon rail)' },
            { value: 'top', label: 'Top nav' },
          ]}
          onChange={v => setTweak('nav', v)}
        />
        <TweakRadio
          label="Detail view"
          value={tweaks.detailLayout}
          options={[
            { value: 'drawer', label: 'Side drawer' },
            { value: 'page',   label: 'Full page' },
          ]}
          onChange={v => setTweak('detailLayout', v)}
        />
        <TweakRadio
          label="Density"
          value={tweaks.density}
          options={[
            { value: 'compact', label: 'Compact' },
            { value: 'cozy', label: 'Cozy' },
            { value: 'comfortable', label: 'Comfy' },
          ]}
          onChange={v => setTweak('density', v)}
        />
        <TweakToggle
          label="Dark mode"
          value={tweaks.dark}
          onChange={v => setTweak('dark', v)}
        />
      </TweakSection>

      <TweakSection title="Style">
        <TweakColor
          label="Accent color"
          value={tweaks.accent}
          options={[
            { value: 'blue',    color: '#0E6FBE' },
            { value: 'indigo',  color: '#4F46E5' },
            { value: 'forest',  color: '#1F8A5B' },
            { value: 'graphite',color: '#37414D' },
          ]}
          onChange={v => setTweak('accent', v)}
        />
        <TweakRadio
          label="Status pills"
          value={tweaks.pillStyle}
          options={[
            { value: 'filled',   label: 'Filled' },
            { value: 'outlined', label: 'Outline' },
            { value: 'dot',      label: 'Dot' },
          ]}
          onChange={v => setTweak('pillStyle', v)}
        />
        <TweakRadio
          label="Action feedback"
          value={tweaks.flashStyle}
          options={[
            { value: 'inline', label: 'Inline banner' },
            { value: 'toast',  label: 'Toast' },
          ]}
          onChange={v => setTweak('flashStyle', v)}
        />
      </TweakSection>

      <TweakSection title="About">
        <div style={{ fontSize: 11.5, color: 'var(--fg-secondary)', lineHeight: 1.55 }}>
          <strong style={{ color: 'var(--fg-primary)' }}>Apps Script-optimized architecture</strong><br />
          Every mutation (task check, inline edit, stage transition) POSTs to a hidden <span className="mono">__ghost</span> iframe so the main page never reloads. The sync pill in the topbar shows the cycle.<br /><br />
          Page reloads <em>only</em> happen on sidebar nav between top-level sections — and those can be prefetched at idle.<br /><br />
          <strong style={{ color: 'var(--fg-primary)' }}>Try:</strong> click a pro row (slides in a drawer, list stays); toggle any task (note the topbar pill); use ←/→/Esc in the drawer.
        </div>
      </TweakSection>
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

window.MOCK_TODAY = '2026-05-13';
