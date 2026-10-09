/**
 * Feedback — the "Feedback" button in the top bar. Anyone can send a bug,
 * idea or question (with an optional screenshot). Items land in the Feedback
 * tab, and a weekly email (Mondays ~8am) sends everything new to the admin.
 */

function feedbackEmailTrigger() {
  return Feedback.sendWeekly(false);
}

var Feedback = (function () {
  var KINDS = { BUG: 'Bug', IDEA: 'Idea', QUESTION: 'Question' };

  function recipient() {
    var e = getProp_(PROP.FEEDBACK_EMAIL);
    if (e) return e;
    try { return Session.getEffectiveUser().getEmail(); } catch (err) { return ''; }
  }

  function screenshotFolder() {
    var root = DriveApp.getRootFolder();
    var it = root.getFoldersByName('Tax Manager feedback screenshots');
    return it.hasNext() ? it.next() : root.createFolder('Tax Manager feedback screenshots');
  }

  function submit(p) {
    var kind = KINDS[p.kind] ? p.kind : 'BUG';
    var message = String(p.message || '').trim();
    if (!message) throw new AppError('Describe the problem or idea first.', 'VALIDATION');
    if (message.length > 5000) message = message.slice(0, 5000);
    var me = Identity.currentEmail();
    var url = '';
    if (p.screenshot && p.screenshot.base64) {
      if (String(p.screenshot.base64).length > 7000000) throw new AppError('That screenshot is too big. Keep it under 5 MB.', 'VALIDATION');
      var mime = /^image\/(png|jpeg|gif|webp)$/.test(p.screenshot.mime) ? p.screenshot.mime : 'image/png';
      var stamp = nowIso_().slice(0, 16).replace(/[:T]/g, '-');
      var file = screenshotFolder().createFile(Utilities.newBlob(Utilities.base64Decode(p.screenshot.base64), mime, stamp + ' ' + me.split('@')[0] + '.png'));
      url = file.getUrl();
    }
    return Db.append('Feedback', [{
      feedback_id: uid_('FB'), created_at: nowIso_(), created_by: me, kind: kind, message: message,
      page: String(p.page || '').slice(0, 300), browser: String(p.browser || '').slice(0, 300), screenshot_url: url, emailed_at: '',
    }])[0];
  }

  function recent(limit) {
    return Db.list('Feedback').sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; }).slice(0, limit || 50);
  }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /** Email everything not yet emailed. force=true sends even when empty (a test). */
  function sendWeekly(force) {
    var to = recipient();
    if (!to) throw new AppError('Set who gets the feedback email in Settings.', 'NOT_CONFIGURED');
    var items = Db.where('Feedback', function (f) { return !f.emailed_at; })
      .sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; });
    if (!items.length && !force) return { sent: false, items: 0 };
    var names = {};
    Identity.roster().forEach(function (m) { names[m.email] = m.name; });
    var groups = ['BUG', 'IDEA', 'QUESTION'].map(function (k) {
      var list = items.filter(function (f) { return f.kind === k; });
      if (!list.length) return '';
      return '<h3 style="margin:20px 0 8px;font:600 16px Arial">' + KINDS[k] + 's (' + list.length + ')</h3>' + list.map(function (f) {
        return '<div style="border:1px solid #DCE3EC;border-radius:8px;padding:10px 12px;margin:0 0 8px;font:14px Arial">'
          + '<div style="color:#5A6778;font-size:12px">' + esc(names[f.created_by] || f.created_by) + ' · ' + esc(String(f.created_at).slice(0, 10))
          + (f.page ? ' · on ' + esc(f.page) : '') + '</div>'
          + '<div style="white-space:pre-wrap;margin-top:4px">' + esc(f.message) + '</div>'
          + (f.screenshot_url ? '<div style="margin-top:6px"><a href="' + esc(f.screenshot_url) + '">Screenshot</a></div>' : '')
          + '</div>';
      }).join('');
    }).join('');
    var sheet = '';
    try { sheet = Db.spreadsheet().getUrl(); } catch (e) { sheet = ''; }
    MailApp.sendEmail({
      to: to,
      subject: 'Tax Manager feedback: ' + (items.length ? items.length + ' new this week' : 'nothing new (test)'),
      htmlBody: '<div style="font:14px Arial;color:#15212F;max-width:680px">'
        + '<p>' + (items.length ? items.length + ' new feedback item' + (items.length === 1 ? '' : 's') + ' since the last email.' : 'No new feedback. This is a test of the weekly email.') + '</p>'
        + groups
        + (sheet ? '<p style="color:#5A6778;font-size:12px">Everything is also in the Feedback tab of the <a href="' + esc(sheet) + '">Tax Manager DB</a>.</p>' : '')
        + '</div>',
    });
    var now = nowIso_();
    items.forEach(function (f) { Db.update('Feedback', f.feedback_id, { emailed_at: now }); });
    setProp_(PROP.LAST_FEEDBACK_EMAIL, JSON.stringify({ at: now, to: to, items: items.length }));
    return { sent: true, items: items.length, to: to };
  }

  function status() {
    var last = getProp_(PROP.LAST_FEEDBACK_EMAIL);
    return {
      to: recipient(), last: last ? JSON.parse(last) : null,
      unsent: Db.where('Feedback', function (f) { return !f.emailed_at; }).length,
      recent: recent(15),
    };
  }

  return { submit: submit, recent: recent, sendWeekly: sendWeekly, status: status, recipient: recipient };
})();
