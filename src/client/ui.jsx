/* Shared UI atoms: icons, avatars, pills, modal, toasts, inline edit. */
import React from 'react';
import { useStore, dismissToast, clearFlash } from './store.js';
import { label, cx, ENUMS } from './util.js';

export const Icon = ({ name, size = 16, ...rest }) => {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', ...rest };
  switch (name) {
    case 'home': return <svg {...props}><path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" /></svg>;
    case 'inbox': return <svg {...props}><path d="M3 13h5l1 3h6l1-3h5" /><path d="M3 13V6a2 2 0 012-2h14a2 2 0 012 2v7" /></svg>;
    case 'check-circle': return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M9 12l2 2 4-4" /></svg>;
    case 'users': return <svg {...props}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 19a6.5 6.5 0 0113 0" /><circle cx="17" cy="9" r="2.75" /><path d="M14 19a5.5 5.5 0 017-5" /></svg>;
    case 'folder': return <svg {...props}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>;
    case 'kanban': return <svg {...props}><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="10" rx="1" /><rect x="17" y="4" width="4" height="14" rx="1" /></svg>;
    case 'list': return <svg {...props}><line x1="8" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="8" y1="18" x2="20" y2="18" /><circle cx="4" cy="6" r="1.5" /><circle cx="4" cy="12" r="1.5" /><circle cx="4" cy="18" r="1.5" /></svg>;
    case 'table': return <svg {...props}><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="9" y1="4" x2="9" y2="20" /></svg>;
    case 'calendar': return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></svg>;
    case 'file-text': return <svg {...props}><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" /><polyline points="14 3 14 9 20 9" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="14" y2="17" /></svg>;
    case 'archive': return <svg {...props}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a2 2 0 002 2h10a2 2 0 002-2V8" /><line x1="10" y1="13" x2="14" y2="13" /></svg>;
    case 'settings': return <svg {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 01-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 012.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 012.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>;
    case 'plus': return <svg {...props}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
    case 'search': return <svg {...props}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
    case 'bell': return <svg {...props}><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></svg>;
    case 'help': return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M9.1 9a3 3 0 015.8 1c0 2-3 2.5-3 4" /><line x1="12" y1="17" x2="12" y2="17.5" /></svg>;
    case 'chevron-down': return <svg {...props}><polyline points="6 9 12 15 18 9" /></svg>;
    case 'chevron-right': return <svg {...props}><polyline points="9 6 15 12 9 18" /></svg>;
    case 'chevron-left': return <svg {...props}><polyline points="15 6 9 12 15 18" /></svg>;
    case 'sidebar': return <svg {...props}><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="9" y1="4" x2="9" y2="20" /></svg>;
    case 'filter': return <svg {...props}><polygon points="3 4 21 4 14 12 14 19 10 21 10 12 3 4" /></svg>;
    case 'sort': return <svg {...props}><path d="M3 6h13M3 12h9M3 18h5" /><polyline points="17 14 21 18 17 22" /><line x1="21" y1="18" x2="14" y2="18" /></svg>;
    case 'group': return <svg {...props}><rect x="3" y="4" width="18" height="4" rx="1" /><rect x="3" y="12" width="12" height="3" rx="1" /><rect x="3" y="17" width="14" height="3" rx="1" /></svg>;
    case 'columns': return <svg {...props}><rect x="3" y="4" width="7" height="16" rx="1" /><rect x="14" y="4" width="7" height="16" rx="1" /></svg>;
    case 'arrow-up': return <svg {...props}><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>;
    case 'arrow-down': return <svg {...props}><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>;
    case 'more': return <svg {...props}><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>;
    case 'drag': return <svg {...props}><circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" /></svg>;
    case 'check': return <svg {...props}><polyline points="20 6 9 17 4 12" /></svg>;
    case 'x': return <svg {...props}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
    case 'alert': return <svg {...props}><path d="M12 2L1 21h22L12 2z" /><line x1="12" y1="10" x2="12" y2="14" /><circle cx="12" cy="17.5" r="0.5" fill="currentColor" /></svg>;
    case 'link': return <svg {...props}><path d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1" /><path d="M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" /></svg>;
    case 'paperclip': return <svg {...props}><path d="M21 12l-9 9a5.5 5.5 0 11-7.8-7.8l9-9a3.7 3.7 0 015.2 5.2L9.5 18.5a1.8 1.8 0 11-2.6-2.6L15 8" /></svg>;
    case 'mail': return <svg {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3 7 12 13 21 7" /></svg>;
    case 'flag': return <svg {...props}><path d="M4 4v17" /><path d="M4 4h11l2 3h4v8h-6l-2-3H4" /></svg>;
    case 'clock': return <svg {...props}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>;
    case 'chart': return <svg {...props}><line x1="4" y1="20" x2="20" y2="20" /><rect x="5" y="11" width="3.5" height="7" /><rect x="10.5" y="7" width="3.5" height="11" /><rect x="16" y="13" width="3.5" height="5" /></svg>;
    case 'timer': return <svg {...props}><circle cx="12" cy="13" r="8" /><path d="M12 13V9" /><line x1="9" y1="2" x2="15" y2="2" /><line x1="12" y1="2" x2="12" y2="5" /></svg>;
    case 'stop': return <svg {...props}><rect x="7" y="7" width="10" height="10" rx="1.5" /></svg>;
    case 'play': return <svg {...props}><polygon points="7 5 19 12 7 19 7 5" /></svg>;
    case 'download': return <svg {...props}><path d="M12 3v12" /><polyline points="7 10 12 15 17 10" /><line x1="4" y1="21" x2="20" y2="21" /></svg>;
    case 'upload': return <svg {...props}><path d="M12 15V3" /><polyline points="7 8 12 3 17 8" /><line x1="4" y1="21" x2="20" y2="21" /></svg>;
    case 'star': return <svg {...props}><polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2" /></svg>;
    case 'template': return <svg {...props}><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="9" x2="9" y2="20" /></svg>;
    case 'eye': return <svg {...props}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>;
    case 'wand': return <svg {...props}><path d="M15 4l5 5L9 20H4v-5L15 4z" /><line x1="13" y1="6" x2="18" y2="11" /></svg>;
    case 'history': return <svg {...props}><polyline points="3 12 3 6 9 6" /><path d="M3.5 9.5a9 9 0 11-2 5" /><polyline points="12 8 12 12 15 14" /></svg>;
    case 'circle': return <svg {...props}><circle cx="12" cy="12" r="9" /></svg>;
    case 'briefcase': return <svg {...props}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" /><line x1="3" y1="13" x2="21" y2="13" /></svg>;
    case 'refresh': return <svg {...props}><polyline points="21 4 21 10 15 10" /><path d="M20 15a8 8 0 11-2-8.5L21 10" /></svg>;
    case 'trash': return <svg {...props}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>;
    case 'edit': return <svg {...props}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>;
    case 'external': return <svg {...props}><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>;
    case 'copy': return <svg {...props}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>;
    case 'sparkles': return <svg {...props}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" /><path d="M19 14l.7 2L22 16.7 19.7 17.4 19 19.7l-.7-2.3-2.3-.7L18.3 16z" /></svg>;
    case 'sun': return <svg {...props}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></svg>;
    case 'moon': return <svg {...props}><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></svg>;
    case 'tasks': return <svg {...props}><polyline points="4 7 6 9 10 5" /><polyline points="4 14 6 16 10 12" /><line x1="13" y1="7" x2="20" y2="7" /><line x1="13" y1="14" x2="20" y2="14" /></svg>;
    default: return <svg {...props}><circle cx="12" cy="12" r="3" /></svg>;
  }
};

export const TMLogo = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M5 6h14M12 6v13" /><path d="M16 17h4M16 13h4" />
  </svg>
);

export function useMember(email) {
  return useStore((s) => (email ? s.teamBy[email] : null));
}

export function Avatar({ email, size = 'md', empty }) {
  const m = useMember(email);
  const cls = size === 'lg' ? 'av lg' : size === 'xl' ? 'av xl' : 'av';
  if (empty || !email) return <span className={cls + ' empty'} title="unassigned"><Icon name="users" size={size === 'lg' ? 16 : 12} /></span>;
  if (!m) {
    const init = String(email).split('@')[0].split(/[._]/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    return <span className={cls} style={{ background: 'var(--grey-500)', color: '#fff' }} title={email}>{init || '?'}</span>;
  }
  return <span className={cls} style={{ background: m.color, color: '#fff' }} title={m.name}>{m.initials}</span>;
}

export function PersonName({ email, fallback }) {
  const m = useMember(email);
  if (!email) return <span className="muted">{fallback || '—'}</span>;
  return <>{m ? m.name : email}</>;
}

export function Person({ email, fallback }) {
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
      <Avatar email={email} empty={!email} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><PersonName email={email} fallback={fallback || 'unassigned'} /></span>
    </span>
  );
}

export function AvatarStack({ emails, max = 3 }) {
  const list = (emails || []).filter(Boolean).slice(0, max);
  return <span className="av-stack">{list.map((e, i) => <Avatar key={i} email={e} />)}</span>;
}

export function Pill({ kind, value }) {
  if (!value) return <span className="muted">—</span>;
  const cls = kind === 'lifecycle' ? `pill lc-${value}` : `pill pp-${value}`;
  return <span className={cls}>{label(kind === 'lifecycle' ? 'LIFECYCLE_STATUS' : 'PIPELINE_STATUS', value)}</span>;
}

export function ProgressBar({ pct }) {
  pct = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%' }}>
      <span style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--grey-200)', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: pct >= 50 ? 'var(--success-main)' : 'var(--primary-main)', transition: 'width 200ms ease' }} />
      </span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-secondary)', minWidth: 30, textAlign: 'right' }}>{pct}%</span>
    </span>
  );
}

export function Spinner({ size = 16 }) {
  return <span className="tm-spinner" style={{ width: size, height: size }} />;
}

export function SavedTick({ savedKey }) {
  const at = useStore((s) => s.justSaved[savedKey]);
  if (!at) return null;
  return <span className="row-saved"><Icon name="check" size={9} /> saved</span>;
}

export function Empty({ icon = 'inbox', title, children, action }) {
  return (
    <div className="empty">
      <div className="icon-bg"><Icon name={icon} size={26} /></div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, width = 520 }) {
  React.useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', h, true);
    return () => document.removeEventListener('keydown', h, true);
  }, [onClose]);
  return (
    <div className="tm-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tm-modal" role="dialog" aria-label={title} style={{ width }}>
        <div className="tm-modal-head">
          <div className="title">{title}</div>
          <button className="tb-icon-btn" onClick={onClose} title="Close (Esc)"><Icon name="x" size={16} /></button>
        </div>
        <div className="tm-modal-body">{children}</div>
        {footer && <div className="tm-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/** Promise-based prompt/confirm rendered as a modal. */
let dialogSetter = null;
export function DialogHost() {
  const [d, setD] = React.useState(null);
  dialogSetter = setD;
  const [val, setVal] = React.useState('');
  React.useEffect(() => { if (d) setVal(d.defaultValue || ''); }, [d]);
  if (!d) return null;
  const close = (result) => { setD(null); d.resolve(result); };
  return (
    <Modal title={d.title} onClose={() => close(null)} width={440}
      footer={<>
        <button className="btn subtle" onClick={() => close(null)}>Cancel</button>
        <button className={cx('btn', d.danger ? 'danger' : 'primary')} disabled={d.input && d.required && !val.trim()}
          onClick={() => close(d.input ? val.trim() : true)}>{d.ok || 'OK'}</button>
      </>}>
      {d.message && <p style={{ margin: '0 0 12px', color: 'var(--fg-secondary)', lineHeight: 1.5 }}>{d.message}</p>}
      {d.input && (
        <input className="tm-input" autoFocus placeholder={d.placeholder || ''} value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (!d.required || val.trim())) close(val.trim()); }} />
      )}
    </Modal>
  );
}
export function askText(title, opts = {}) {
  return new Promise((resolve) => dialogSetter && dialogSetter({ title, input: true, ...opts, resolve }));
}
export function confirmDialog(title, opts = {}) {
  return new Promise((resolve) => dialogSetter && dialogSetter({ title, ...opts, resolve }));
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="tm-toasts">
      {toasts.map((t) => (
        <div key={t.id} className={'flash ' + (t.kind === 'error' ? 'error' : 'success')} style={{ marginBottom: 0, boxShadow: 'var(--shadow-modal)' }}>
          <Icon name={t.kind === 'error' ? 'alert' : 'check-circle'} size={16} />
          <span style={{ flex: 1 }}>{t.msg}</span>
          {t.action && <button className="btn sm" onClick={() => { dismissToast(t.id); t.action.fn(); }}>{t.action.label}</button>}
          <span className="x" onClick={() => dismissToast(t.id)}><Icon name="x" size={14} /></span>
        </div>
      ))}
    </div>
  );
}

export function Flash() {
  const f = useStore((s) => s.flash);
  if (!f) return null;
  return (
    <div className={'flash ' + f.kind}>
      <Icon name={f.kind === 'success' ? 'check-circle' : 'alert'} size={16} />
      <span>{f.msg}</span>
      <span className="x" onClick={clearFlash}><Icon name="x" size={14} /></span>
    </div>
  );
}

/** Popover anchored under a trigger; closes on outside click / Esc. */
export function Popover({ open, onClose, children, align = 'left', style }) {
  React.useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="popover" style={{ ...(align === 'right' ? { left: 'auto', right: 0 } : {}), ...style }}>{children}</div>
    </>
  );
}

/** Row-level "more" menu. items: [{label, icon, onClick, danger}] */
export function MoreMenu({ items, btnClass = 'more', size = 14, align = 'right' }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span className="popover-host" onClick={(e) => e.stopPropagation()}>
      <button className={btnClass} onClick={() => setOpen(!open)} title="More"><Icon name="more" size={size} /></button>
      <Popover open={open} onClose={() => setOpen(false)} align={align} style={{ minWidth: 190, padding: 6 }}>
        {items.filter(Boolean).map((it, i) => (
          <button key={i} className={cx('tm-menu-item', it.danger && 'danger')} disabled={it.disabled}
            onClick={() => { setOpen(false); it.onClick(); }}>
            {it.icon && <Icon name={it.icon} size={14} />} {it.label}
          </button>
        ))}
      </Popover>
    </span>
  );
}

/**
 * Click-to-edit value. Enter / blur saves, Esc cancels.
 * type: text | number | date | select | textarea | bool | person
 */
export function InlineEdit({ value, display, type = 'text', options, onSave, placeholder, mono, disabled }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const team = useStore((s) => s.team);
  const ref = React.useRef(null);
  React.useEffect(() => { if (editing && ref.current) { ref.current.focus(); if (ref.current.select && type !== 'select') ref.current.select(); } }, [editing, type]);

  function start() {
    if (disabled) return;
    setDraft(value == null ? '' : type === 'bool' ? (value ? 'true' : 'false') : String(value));
    setEditing(true);
  }
  function commit() {
    setEditing(false);
    let v = draft;
    if (type === 'number') v = draft === '' ? null : Number(draft);
    if (type === 'bool') v = draft === 'true';
    const cur = value == null ? '' : value;
    if (String(v == null ? '' : v) === String(cur)) return;
    onSave(v);
  }
  const empty = value == null || value === '';
  if (!editing) {
    return (
      <span className={cx('val', empty && !display && 'empty', mono && 'mono', !disabled && 'tm-editable')} onClick={start}
        title={disabled ? '' : 'Click to edit'}>
        {display != null ? display : empty ? (placeholder || '—') : String(value)}
      </span>
    );
  }
  const common = {
    ref, className: 'tm-inline-input', value: draft,
    onChange: (e) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e) => {
      if (e.key === 'Enter' && type !== 'textarea') { e.preventDefault(); commit(); }
      if (e.key === 'Enter' && type === 'textarea' && (e.metaKey || e.ctrlKey)) commit();
      if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); }
    },
  };
  if (type === 'select' || type === 'bool' || type === 'person') {
    const opts = type === 'bool' ? [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]
      : type === 'person' ? [{ value: '', label: '— unassigned —' }, ...team.filter((m) => m.active).map((m) => ({ value: m.email, label: m.name }))]
        : [{ value: '', label: '—' }, ...(options || [])];
    return (
      <select {...common} onChange={(e) => { setDraft(e.target.value); }}>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  if (type === 'textarea') return <textarea {...common} rows={3} />;
  return <input {...common} type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'} />;
}

export function Field({ label: lbl, children }) {
  return (
    <div className="field">
      <span className="lbl">{lbl}</span>
      {children}
    </div>
  );
}

export function FieldGroup({ title, children, defaultOpen = true }) {
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

export function enumOptions(kind) {
  const labelled = ['LIFECYCLE_STATUS', 'PIPELINE_STATUS', 'FILING_TYPE', 'ENTITY_TYPE', 'DOC_COLLECTION_STATUS'];
  return (ENUMS[kind] || []).map((v) => ({ value: v, label: labelled.includes(kind) ? label(kind, v) : v }));
}
