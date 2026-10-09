/**
 * Digest — a personal morning summary for everyone on the roster, weekdays
 * ~7am: overdue / due-today / this-week tasks, return deadlines in the next
 * 14 days, and peer reviews waiting on them.
 *
 * Delivery (Settings): Slack DM through a Slack app's bot token
 * (chat:write, users:read, users:read.email), or email. People with nothing
 * to report get nothing.
 */

function digestTrigger() {
  var ch = Digest.channel();
  if (ch === 'off') return null;
  var dow = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'u'); // 1 = Mon … 7 = Sun
  if (Number(dow) > 5) return null;
  return Digest.sendAll();
}

var Digest = (function () {
  var OPEN = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED'];

  function channel() {
    var c = getProp_(PROP.DIGEST_CHANNEL, 'off');
    return c === 'slack' || c === 'email' ? c : 'off';
  }

  function appUrl() {
    try { return ScriptApp.getService().getUrl(); } catch (e) { return ''; }
  }

  /** Everything loaded once, shared across people. */
  function context() {
    var pros = {};
    Db.list('Pros').forEach(function (p) { pros[p.org_id] = p; });
    var projects = {};
    Db.list('Projects').forEach(function (p) { projects[p.project_id] = p; });
    return { today: todayIso_(), pros: pros, projects: projects, tasks: Db.list('Tasks'), reviews: Db.list('PeerReviews') };
  }

  function bizOf(ctx, t) {
    if (t.entity_type === 'PRO') return ctx.pros[t.entity_id] ? ctx.pros[t.entity_id].business_name : t.entity_id;
    var p = ctx.projects[t.entity_id];
    return p ? ((ctx.pros[p.org_id] || {}).business_name || p.org_id) + ' · TY' + p.tax_year : t.entity_id;
  }

  function live(ctx, t) {
    var rec = t.entity_type === 'PRO' ? ctx.pros[t.entity_id] : ctx.projects[t.entity_id];
    return rec && !rec.archived;
  }

  /** One person's digest, or null if there's nothing to say. */
  function build(member, ctx) {
    var email = member.email;
    var today = ctx.today, week = addDays_(today, 7), soon = addDays_(today, 14);
    var mine = ctx.tasks.filter(function (t) { return t.assignee_email === email && OPEN.indexOf(t.status) >= 0 && live(ctx, t); });
    var overdue = mine.filter(function (t) { return t.due_date && t.due_date < today; });
    var dueToday = mine.filter(function (t) { return t.due_date === today; });
    var thisWeek = mine.filter(function (t) { return t.due_date > today && t.due_date <= week; });
    var top = overdue.concat(dueToday).sort(function (a, b) { return a.due_date < b.due_date ? -1 : 1; }).slice(0, 6)
      .map(function (t) { return { title: t.title, biz: bizOf(ctx, t), due: t.due_date, overdue: t.due_date < today }; });

    var deadlines = Object.keys(ctx.projects).map(function (k) { return ctx.projects[k]; }).filter(function (p) {
      return !p.archived && p.pipeline_status !== 'COMPLETE' && !p.efile_date && p.filing_deadline && p.filing_deadline <= soon
        && (p.tax_advisor_email === email || p.tax_preparer_email === email);
    }).sort(function (a, b) { return a.filing_deadline < b.filing_deadline ? -1 : 1; }).slice(0, 8).map(function (p) {
      return {
        biz: (ctx.pros[p.org_id] || {}).business_name || p.org_id, ty: p.tax_year, type: label_('FILING_TYPE', p.filing_type),
        deadline: p.filing_deadline, past: p.filing_deadline < today, stage: label_('PIPELINE_STATUS', p.pipeline_status),
      };
    });

    var reviewer = member.roles.indexOf('PEER_REVIEWER') >= 0;
    var inReview = ctx.reviews.filter(function (r) { return r.status === 'IN_REVIEW' && r.reviewer_email === email; });
    var assignedToMe = ctx.reviews.filter(function (r) { return r.status === 'SUBMITTED' && r.reviewer_email === email; });
    var queue = reviewer ? ctx.reviews.filter(function (r) { return r.status === 'SUBMITTED' && !r.reviewer_email && r.submitted_by !== email; }).length : 0;
    var rework = ctx.reviews.filter(function (r) { return r.status === 'REWORK' && r.submitted_by === email; });
    var reviews = {
      in_review: inReview.map(function (r) { return r.business_name + ' · TY' + r.tax_year; }),
      assigned: assignedToMe.map(function (r) { return r.business_name + ' · TY' + r.tax_year; }),
      queue: queue,
      rework: rework.map(function (r) { return r.business_name + ' · TY' + r.tax_year; }),
    };

    var any = overdue.length || dueToday.length || thisWeek.length || deadlines.length
      || reviews.in_review.length || reviews.assigned.length || reviews.queue || reviews.rework.length;
    if (!any) return null;
    return {
      name: String(member.name || email).split(' ')[0],
      counts: { overdue: overdue.length, today: dueToday.length, week: thisWeek.length },
      top: top, deadlines: deadlines, reviews: reviews,
    };
  }

  function md(d, url) {
    var fmt = function (iso) { return iso ? iso.slice(5).replace('-', '/') : ''; };
    var out = ['*Good morning, ' + d.name + '!* Here\'s your Tax Manager day.'];
    var c = d.counts;
    if (c.overdue || c.today || c.week) {
      out.push('', ':white_check_mark: *Tasks:* ' + [
        c.overdue ? ':red_circle: ' + c.overdue + ' overdue' : '', c.today ? ':large_yellow_circle: ' + c.today + ' due today' : '', c.week ? c.week + ' more this week' : '',
      ].filter(Boolean).join(' · '));
      d.top.forEach(function (t) { out.push('• ' + t.title + ' — ' + t.biz + ' _(' + (t.overdue ? 'was due ' + fmt(t.due) : 'today') + ')_'); });
    }
    if (d.deadlines.length) {
      out.push('', ':date: *Return deadlines in the next 2 weeks*');
      d.deadlines.forEach(function (p) { out.push('• ' + p.biz + ' · TY' + p.ty + ' ' + p.type + ' — ' + (p.past ? '*past due ' + fmt(p.deadline) + '*' : fmt(p.deadline)) + ' (' + p.stage + ')'); });
    }
    var r = d.reviews;
    if (r.in_review.length || r.assigned.length || r.queue || r.rework.length) {
      out.push('', ':mag: *Peer review*');
      if (r.in_review.length) out.push('• In review with you: ' + r.in_review.join(', '));
      if (r.assigned.length) out.push('• Sent to you, ready to claim: ' + r.assigned.join(', '));
      if (r.queue) out.push('• ' + r.queue + ' waiting in the queue for any reviewer');
      if (r.rework.length) out.push('• Sent back to you for rework: ' + r.rework.join(', '));
    }
    if (url) out.push('', '<' + url + '#/my-tasks|Open My Tasks> · <' + url + '#/peer-review|Peer Review>');
    return out.join('\n');
  }

  function html(d, url) {
    var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    return '<div style="font:14px/1.5 Arial;color:#15212F">' + esc(md(d, ''))
      .replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/_\(([^)\n]+)\)_/g, '<span style="color:#5A6778">($1)</span>')
      .replace(/:red_circle: /g, '🔴 ').replace(/:large_yellow_circle: /g, '🟡 ').replace(/:white_check_mark: /g, '').replace(/:date: /g, '').replace(/:mag: /g, '')
      .replace(/\n/g, '<br>')
      + (url ? '<p><a href="' + esc(url) + '#/my-tasks">Open My Tasks</a> · <a href="' + esc(url) + '#/peer-review">Peer Review</a></p>' : '') + '</div>';
  }

  /* ---------------- Slack ---------------- */

  function slack(method, payload, get) {
    var token = getProp_(PROP.SLACK_TOKEN);
    if (!token) throw new AppError('Add the Slack bot token in Settings first.', 'NOT_CONFIGURED');
    var url = 'https://slack.com/api/' + method;
    var opts = { method: get ? 'get' : 'post', headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true };
    if (get) url += '?' + Object.keys(payload).map(function (k) { return k + '=' + encodeURIComponent(payload[k]); }).join('&');
    else { opts.contentType = 'application/json; charset=utf-8'; opts.payload = JSON.stringify(payload); }
    var res = JSON.parse(UrlFetchApp.fetch(url, opts).getContentText() || '{}');
    if (!res.ok) throw new AppError('Slack said "' + (res.error || 'unknown error') + '" for ' + method + '.', 'SLACK');
    return res;
  }

  function slackId(email, ids) {
    if (ids[email]) return ids[email];
    var res = slack('users.lookupByEmail', { email: email }, true);
    ids[email] = res.user.id;
    return ids[email];
  }

  function deliver(member, d, ids) {
    var url = appUrl();
    if (channel() === 'email') {
      MailApp.sendEmail({ to: member.email, subject: 'Your Tax Manager day', htmlBody: html(d, url), name: 'Tax Manager' });
    } else {
      slack('chat.postMessage', { channel: slackId(member.email, ids), text: md(d, url), unfurl_links: false, unfurl_media: false });
    }
  }

  /** Send to everyone (or just `onlyEmail`). Returns a summary. */
  function sendAll(onlyEmail) {
    var ctx = context();
    var ids = {};
    try { ids = JSON.parse(getProp_(PROP.SLACK_IDS) || '{}'); } catch (e) { ids = {}; }
    var sum = { sent: 0, nothing: 0, failed: [] };
    Identity.roster().filter(function (m) { return m.active && (!onlyEmail || m.email === onlyEmail); }).forEach(function (m) {
      var d = build(m, ctx);
      if (!d) { sum.nothing++; return; }
      try { deliver(m, d, ids); sum.sent++; } catch (e) { sum.failed.push(m.email + ': ' + (e.message || e)); }
    });
    setProp_(PROP.SLACK_IDS, JSON.stringify(ids));
    if (!onlyEmail) setProp_(PROP.LAST_DIGEST, JSON.stringify({ at: nowIso_(), sent: sum.sent, failed: sum.failed.length }));
    return sum;
  }

  /** What `email` would get today, as text. */
  function preview(email) {
    var m = Identity.find(email);
    if (!m) return { text: '' };
    var d = build(m, context());
    return { text: d ? md(d, appUrl()) : '' };
  }

  /** A test send to one person, regardless of the on/off setting. */
  function test(email) {
    var m = Identity.find(email);
    var d = build(m, context()) || { name: String(m.name).split(' ')[0], counts: { overdue: 0, today: 0, week: 0 }, top: [], deadlines: [], reviews: { in_review: [], assigned: [], queue: 0, rework: [] } };
    var ids = {};
    try { ids = JSON.parse(getProp_(PROP.SLACK_IDS) || '{}'); } catch (e) { ids = {}; }
    if (channel() === 'off') throw new AppError('Pick Slack or Email for the morning digest first.', 'VALIDATION');
    deliver(m, d, ids);
    setProp_(PROP.SLACK_IDS, JSON.stringify(ids));
    return { sent: true, channel: channel() };
  }

  function status() {
    var t = getProp_(PROP.SLACK_TOKEN);
    var last = getProp_(PROP.LAST_DIGEST);
    return { channel: channel(), slack_token_set: !!t, slack_token_hint: t ? '…' + t.slice(-4) : '', last: last ? JSON.parse(last) : null };
  }

  return { channel: channel, build: build, md: md, sendAll: sendAll, preview: preview, test: test, status: status };
})();
