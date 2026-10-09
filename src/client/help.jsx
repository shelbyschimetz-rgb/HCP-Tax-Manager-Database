/* In-app Guide (the frontline SOP) and the Feedback button. */
import React from 'react';
import { Icon, Modal } from './ui.jsx';
import { useStore, mutate, toast } from './store.js';
import { getRoute, format } from './router.js';
import { readFileBase64, cx } from './util.js';
import SOP from '../../docs/frontline-sop.html';

// In a srcdoc frame, "#section" links would resolve against the app's URL and
// load the whole app inside the frame. Scroll to the section instead, and send
// any other link to a new tab.
const FRAME_SCRIPT = '<script>document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a");if(!a)return;var h=a.getAttribute("href")||"";'
  + 'if(h.charAt(0)==="#"){e.preventDefault();var el=document.getElementById(h.slice(1));if(el)el.scrollIntoView({behavior:"smooth",block:"start"});}'
  + 'else{a.setAttribute("target","_blank");a.setAttribute("rel","noopener");}});<' + '/script>';

export function Guide() {
  const dark = useStore((s) => !!s.prefs.dark);
  const doc = React.useMemo(() => '<!doctype html><html data-theme="' + (dark ? 'dark' : 'light') + '"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' + SOP + FRAME_SCRIPT + '</body></html>', [dark]);
  return (
    <div data-screen-label="Guide" className="guide-wrap">
      <iframe title="Frontline SOP" className="guide-frame" srcDoc={doc} />
    </div>
  );
}

const KINDS = [
  { id: 'BUG', label: 'Something\'s broken' },
  { id: 'IDEA', label: 'Idea or request' },
  { id: 'QUESTION', label: 'Question' },
];

export function FeedbackButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button className="btn sm tb-feedback" onClick={() => setOpen(true)} title="Report a bug or send feedback"><Icon name="flag" size={13} /> Feedback</button>
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
}

function FeedbackModal({ onClose }) {
  const [kind, setKind] = React.useState('BUG');
  const [message, setMessage] = React.useState('');
  const [shot, setShot] = React.useState(null); // { mime, base64, url }
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');

  async function takeFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { setErr('Attach an image (PNG or JPG).'); return; }
    if (file.size > 5 * 1024 * 1024) { setErr('That image is over 5 MB.'); return; }
    setErr('');
    setShot({ mime: file.type, base64: await readFileBase64(file), url: URL.createObjectURL(file) });
  }
  function onPaste(e) {
    const item = [...(e.clipboardData ? e.clipboardData.items : [])].find((i) => /^image\//.test(i.type));
    if (item) { e.preventDefault(); takeFile(item.getAsFile()); }
  }
  async function send() {
    if (!message.trim()) { setErr('Tell us what happened or what you\'d like.'); return; }
    setBusy(true);
    try {
      const r = getRoute();
      await mutate({
        label: 'feedback', what: 'feedback', action: 'submitFeedback',
        payload: { kind, message: message.trim(), page: '#' + format(r), browser: navigator.userAgent, screenshot: shot ? { mime: shot.mime, base64: shot.base64 } : null },
      });
      toast('success', 'Thanks! Your feedback was sent.');
      onClose();
    } catch (e) { setBusy(false); }
  }
  return (
    <Modal title="Report a bug or send feedback" onClose={onClose} width={560}
      footer={<><button className="btn subtle" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send'}</button></>}>
      <div className="tm-seg" style={{ marginBottom: 12 }}>
        {KINDS.map((k) => <button key={k.id} className={cx(kind === k.id && 'on')} onClick={() => setKind(k.id)}>{k.label}</button>)}
      </div>
      <div className="wiz-field">
        <label className="lbl" htmlFor="fb-msg">{kind === 'BUG' ? 'What happened? What did you expect?' : kind === 'IDEA' ? 'What would make this better?' : 'What\'s your question?'}</label>
        <textarea id="fb-msg" className="tm-input" rows={5} autoFocus value={message} onChange={(e) => setMessage(e.target.value)} onPaste={onPaste}
          placeholder={kind === 'BUG' ? 'e.g. On Summit Peak Plumbing, clicking Advance stage showed "Sync failed"' : ''} />
        <span className="hint">The page you're on is included automatically. You can paste a screenshot straight into the box.</span>
      </div>
      <div className="wiz-field">
        <label className="lbl">Screenshot (optional)</label>
        {shot ? (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <img src={shot.url} alt="Screenshot preview" style={{ maxHeight: 90, maxWidth: 200, borderRadius: 6, border: '1px solid var(--border-light)' }} />
            <button className="btn subtle sm" onClick={() => setShot(null)}>Remove</button>
          </div>
        ) : <input type="file" accept="image/*" onChange={(e) => takeFile(e.target.files[0])} />}
      </div>
      {err && <span className="tm-field-error">{err}</span>}
    </Modal>
  );
}
