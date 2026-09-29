/* App shell: routing, drawer, chrome, boot. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { useStore, applyBoot, getState, clearFlash } from './store.js';
import { api } from './api.js';
import { useRoute, navigate, patchRoute, initRouter } from './router.js';
import { openRecord, getListOrder, closeDrawer } from './nav.js';
import { Sidebar, TopNav, Topbar, applyAccent } from './chrome.jsx';
import { Icon, Toasts, Flash, DialogHost, TMLogo } from './ui.jsx';
import { ProsList, ProjectsList } from './lists.jsx';
import { ProDetail, ProjectDetail } from './detail.jsx';
import { Home, MyTasks, Templates, Archive, Inbox } from './misc.jsx';
import { IntakeWizard } from './intake.jsx';
import { Reports, Settings } from './reports.jsx';
import { PeerReviewQueue } from './review.jsx';

const VIEW_TITLES = {
  home: 'Home', inbox: 'Inbox', 'my-tasks': 'My Tasks', 'peer-review': 'Peer Review', pros: 'Pros', projects: 'Projects', templates: 'Templates',
  reports: 'Reports', archive: 'Archive', settings: 'Settings',
};

function DetailDrawer({ drawer }) {
  const isProject = drawer.kind === 'project';
  const pros = useStore((s) => s.pros);
  const projects = useStore((s) => s.projects);
  const order = getListOrder(drawer.kind);
  const idx = order.indexOf(drawer.id);
  const prev = idx > 0 ? order[idx - 1] : null;
  const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
  const rec = isProject ? projects.find((p) => p.project_id === drawer.id) : pros.find((p) => p.org_id === drawer.id);
  const here = rec ? (isProject ? rec.business_name + ' · TY' + rec.tax_year : rec.business_name) : drawer.id;
  const go = (id) => id && patchRoute({ drawer: { kind: drawer.kind, id, tab: drawer.tab } }, { replace: true });
  const bodyRef = React.useRef(null);

  React.useEffect(() => {
    const h = (e) => {
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === 'Escape' && !typing && !document.querySelector('.tm-modal-backdrop') && !document.querySelector('.popover')) closeDrawer();
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'j' || e.key === 'ArrowLeft') go(prev);
      if (e.key === 'k' || e.key === 'ArrowRight') go(next);
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  });
  React.useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [drawer.id]);

  return (
    <>
      <div className="drawer-backdrop" onClick={closeDrawer} />
      <aside className="drawer" role="dialog" aria-label="Detail">
        <div className="drawer-head">
          <span className="nav">
            <button className="icon-btn" disabled={!prev} onClick={() => go(prev)} title="Previous record (J)"><Icon name="chevron-left" size={16} /></button>
            <button className="icon-btn" disabled={!next} onClick={() => go(next)} title="Next record (K)"><Icon name="chevron-right" size={16} /></button>
          </span>
          <span className="where">
            <a onClick={closeDrawer} style={{ cursor: 'pointer' }}>{isProject ? 'Projects' : 'Pros'}</a>
            <Icon name="chevron-right" size={12} style={{ color: 'var(--grey-400)' }} />
            <span className="here">{here}</span>
            {idx >= 0 && <span className="muted small" style={{ marginLeft: 8 }}>{idx + 1} of {order.length}</span>}
          </span>
          <span className="spacer" />
          <button className="icon-btn" onClick={() => navigate({ view: drawer.kind, id: drawer.id, tab: drawer.tab })} title="Open as full page"><Icon name="external" size={14} /></button>
          <button className="icon-btn" onClick={closeDrawer} title="Close (Esc)"><Icon name="x" size={16} /></button>
        </div>
        <div className="drawer-body" ref={bodyRef}>
          {isProject ? <ProjectDetail key={drawer.id} projectId={drawer.id} inDrawer /> : <ProDetail key={drawer.id} orgId={drawer.id} inDrawer />}
        </div>
      </aside>
    </>
  );
}

function App() {
  const route = useRoute();
  const prefs = useStore((s) => s.prefs);
  const pros = useStore((s) => s.pros);
  const projects = useStore((s) => s.projects);
  const user = useStore((s) => s.user);

  React.useEffect(() => { applyAccent(prefs.accent); }, [prefs.accent]);
  React.useEffect(() => {
    document.body.classList.toggle('tm-dark', !!prefs.dark);
  }, [prefs.dark]);

  const view = route.view;
  // Inline banners belong to the screen they were raised for; drop stale ones on navigation.
  React.useEffect(() => {
    const f = getState().flash;
    if (f && Date.now() - (f.at || 0) > 1500) clearFlash();
  }, [view, route.id]);
  const active = view === 'pro' ? 'pros' : view === 'project' ? 'projects' : view === 'intake' ? 'inbox' : view;
  const pro = view === 'pro' ? pros.find((p) => p.org_id === route.id) : null;
  const project = view === 'project' ? projects.find((p) => p.project_id === route.id) : null;
  const intakePro = view === 'intake' ? pros.find((p) => p.org_id === route.id) : null;

  const crumbs = (() => {
    switch (view) {
      case 'pro': return [{ label: 'Pros', onClick: () => navigate({ view: 'pros' }) }, { label: pro ? pro.business_name : route.id }];
      case 'project': return [{ label: 'Projects', onClick: () => navigate({ view: 'projects' }) }, { label: project ? project.business_name + ' · TY' + project.tax_year : route.id }];
      case 'intake': return [{ label: 'Inbox', onClick: () => navigate({ view: 'inbox' }) }, { label: 'Onboarding' + (intakePro ? ' · ' + intakePro.business_name : '') }];
      default: return [{ label: VIEW_TITLES[view] || 'Home' }];
    }
  })();

  React.useEffect(() => {
    document.title = (crumbs[crumbs.length - 1].label || 'Home') + ' · Tax Manager';
  }, [crumbs[crumbs.length - 1].label]);

  const screen = (() => {
    switch (view) {
      case 'home': return <Home />;
      case 'inbox': return <Inbox />;
      case 'my-tasks': return <MyTasks />;
      case 'peer-review': return <PeerReviewQueue />;
      case 'pros': return <ProsList />;
      case 'projects': return <ProjectsList />;
      case 'pro': return <ProDetail key={route.id} orgId={route.id} />;
      case 'project': return <ProjectDetail key={route.id} projectId={route.id} />;
      case 'templates': return <Templates />;
      case 'reports': return <Reports />;
      case 'archive': return <Archive />;
      case 'settings': return user.admin ? <Settings /> : <Home />;
      case 'intake': return <IntakeWizard key={route.id} orgId={route.id} />;
      default: return <Home />;
    }
  })();

  const collapsed = prefs.nav !== 'top' && (prefs.sidebar_collapsed || prefs.nav === 'collapsed-sidebar');
  const cls = 'app' + (collapsed ? ' collapsed' : '') + (prefs.dark ? ' dark' : '') + (prefs.nav === 'top' ? ' nav-top' : '') + (route.drawer ? ' drawer-open' : '');

  return (
    <div className={cls} data-density={prefs.density || 'cozy'} data-pill={prefs.pill || 'filled'} data-tasks="spreadsheet">
      {prefs.nav === 'top' ? <TopNav active={active} /> : <Sidebar active={active} />}
      <div className="main">
        <Topbar crumbs={crumbs} onOpenPro={(id) => openRecord('pro', id)} />
        <div className="content">
          <div className="content-inner">
            {(prefs.feedback || 'inline') === 'inline' && <Flash />}
            {screen}
          </div>
        </div>
      </div>
      {route.drawer && <DetailDrawer drawer={route.drawer} />}
      <Toasts />
      <DialogHost />
    </div>
  );
}

function BootError({ boot }) {
  const setupNeeded = boot.code === 'NOT_SETUP';
  return (
    <div className="tm-boot">
      <div className="tm-boot-card">
        <span className="sb-logo" style={{ width: 40, height: 40, borderRadius: 10 }}><TMLogo size={22} /></span>
        <h1>{boot.code === 'NO_ACCESS' ? 'You don\'t have access yet' : setupNeeded ? 'Tax Manager isn\'t set up yet' : 'Something went wrong'}</h1>
        <p>{boot.error}</p>
        {boot.code === 'NO_ACCESS' && <p className="muted small">Signed in as <span className="mono">{boot.email || 'unknown'}</span>. An admin adds you in the Identity tab of the Tax Manager DB sheet.</p>}
        {setupNeeded && <p className="muted small">Open the Apps Script editor, pick the <span className="mono">setup</span> function, and click Run. Then reload this page.</p>}
        <button className="btn primary" onClick={() => window.location.reload()}>Reload</button>
      </div>
    </div>
  );
}

export async function start() {
  try {
    await startInner();
    window.__TM_STARTED__ = true;
  } catch (e) {
    if (window.__TM_FAIL__) window.__TM_FAIL__('Startup error: ' + (e && (e.stack || e.message) || e));
    throw e;
  }
}

async function startInner() {
  let boot = window.__TM_BOOT__;
  if (!boot || typeof boot !== 'object') {
    // Inline startup data missing or unreadable: fetch it over google.script.run instead.
    try { boot = { ok: true, data: await api('bootstrap') }; } catch (e) {
      boot = e && e.code ? { ok: false, error: e.message, code: e.code } : boot;
    }
  }
  const root = createRoot(document.getElementById('root'));
  if (!boot || typeof boot !== 'object') {
    root.render(<BootError boot={{ error: (window.__TM_BOOT_ERR__ ? 'Startup data could not be read (' + window.__TM_BOOT_ERR__ + '). ' : 'The page loaded without its data. ') + 'Open the app URL with ?diag=1 at the end and send what it shows.', code: 'ERROR' }} />);
    window.__TM_STARTED__ = true;
    return;
  }
  if (!boot.ok) {
    root.render(<BootError boot={boot} />);
    window.__TM_STARTED__ = true;
    return;
  }
  applyBoot(boot.data);
  // Don't let a slow/missing google.script.url callback leave the page blank.
  await Promise.race([initRouter(), new Promise((r) => setTimeout(r, 2500))]);
  root.render(<App />);
}
