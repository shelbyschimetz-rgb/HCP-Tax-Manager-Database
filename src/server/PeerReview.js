/**
 * PeerReviews — the Tax QA peer review, formerly a Slack workflow.
 *
 * One row per review request on a project. Lifecycle:
 *
 *   SUBMITTED ──claim──▶ IN_REVIEW ──complete──▶ COMPLETE
 *       ▲                  │    ▲
 *       └────release───────┘    │
 *                          rework│resubmit
 *                               ▼│
 *                             REWORK
 *   (any open state) ──cancel──▶ CANCELLED
 *
 * The review drives the project's existing tasks so it shows up in My Tasks:
 * "Peer Review Verification" (checklist) belongs to the reviewer, "Apply
 * peer-review changes" goes to the submitter on rework. Every step also posts
 * to the project's notes thread and the audit log.
 */

var PeerReviews = (function () {
  var OPEN = ['SUBMITTED', 'IN_REVIEW', 'REWORK'];
  var REVIEW_DAYS = 2; // reviewer's task due date after submit / resubmit
  var REWORK_DAYS = 2; // submitter's task due date after a rework request

  function isOpen(r) { return OPEN.indexOf(r.status) >= 0; }

  function byNewest(a, b) { return (a.submitted_at || '') < (b.submitted_at || '') ? 1 : -1; }

  function forProject(projectId) {
    return Db.where('PeerReviews', function (r) { return r.project_id === projectId; }).sort(byNewest);
  }

  function open() { return Db.where('PeerReviews', isOpen).sort(byNewest); }

  function closed(limit) {
    return Db.where('PeerReviews', function (r) { return !isOpen(r); })
      .sort(function (a, b) { return (a.completed_at || a.cancelled_at || '') < (b.completed_at || b.cancelled_at || '') ? 1 : -1; })
      .slice(0, limit || 300);
  }

  function activeFor(projectId) { return forProject(projectId).filter(isOpen)[0] || null; }

  function must(id) {
    var r = Db.get('PeerReviews', id);
    if (!r) throw new AppError('That peer review no longer exists.', 'NOT_FOUND');
    return r;
  }

  function needStatus(r, allowed, verb) {
    if (allowed.indexOf(r.status) < 0) {
      throw new AppError('Can\'t ' + verb + ': this review is "' + (LABELS.PEER_REVIEW_STATUS[r.status] || r.status) + '". Refresh to see the latest.', 'CONFLICT');
    }
  }

  function isAdmin(me) { return Identity.hasRole(me, ['EXEC', 'ADMIN']); }

  function normAddOns(v) {
    var list = (Array.isArray(v) ? v : String(v || '').split(',')).map(function (s) { return String(s).trim(); }).filter(Boolean);
    var bad = list.filter(function (s) { return ENUMS.PEER_REVIEW_ADD_ONS.indexOf(s) < 0; });
    if (bad.length) throw new AppError('Unknown add-on: ' + bad.join(', ') + '.', 'VALIDATION');
    if (!list.length) throw new AppError('Pick the return\'s add-ons, or "No add-ons".', 'VALIDATION');
    if (list.indexOf('No add-ons') >= 0 && list.length > 1) throw new AppError('"No add-ons" can\'t be combined with other add-ons.', 'VALIDATION');
    return list;
  }

  function normMoney(v) {
    var s = String(v == null ? '' : v).replace(/[$,\s]/g, '');
    if (!s) return '';
    if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new AppError('Safe harbor amount must be a dollar amount, like 1250 or $1,250.00.', 'VALIDATION');
    return String(Number(s).toFixed(2));
  }

  function withEvent(r, action, note, extra) {
    var ev = (r.events || []).slice();
    var e = { at: nowIso_(), by: Identity.currentEmail(), action: action, note: note || '' };
    if (extra) for (var k in extra) e[k] = extra[k];
    ev.push(e);
    return ev;
  }

  /* ---------------- project tasks ---------------- */

  function findTask(projectId, id, re) {
    var tasks = Tasks.forEntity('PROJECT', projectId);
    var t = id ? tasks.filter(function (x) { return x.task_id === id; })[0] : null;
    return t || tasks.filter(function (x) { return re.test(x.title); })[0] || null;
  }

  function templateChecklist() {
    var tp = Templates.active('PROJECT').filter(function (t) { return /peer review verification/i.test(t.title); })[0];
    return tp && tp.checklist && tp.checklist.length ? tp.checklist.map(function (c) { return typeof c === 'string' ? c : c.label; }) : Templates.PEER_REVIEW_CHECKLIST;
  }

  /** The reviewer's "Peer Review Verification" task: found or created, reopened, assigned, dated. */
  function prepareReviewTask(r, reviewer, resetChecklist) {
    var t = findTask(r.project_id, r.review_task_id, /peer review verification/i);
    if (!t) {
      t = Tasks.create({ entity_type: 'PROJECT', entity_id: r.project_id, section: 'INTERNAL_REVIEW_QC', title: 'Peer Review Verification' },
        { role: 'PEER_REVIEWER', checklist: templateChecklist() });
    }
    var changed = [];
    if (t.status === 'DONE' || t.status === 'SKIPPED') changed = changed.concat(Tasks.setStatus(t.task_id, 'NOT_STARTED'));
    if (resetChecklist && t.checklist && t.checklist.some(function (c) { return c.checked; })) {
      Db.update('Tasks', t.task_id, { checklist: t.checklist.map(function (c) { return { id: c.id, label: c.label, checked: false }; }) });
    }
    changed.push(Tasks.update(t.task_id, { assignee_email: reviewer || '', due_date: addDays_(todayIso_(), REVIEW_DAYS) }));
    return changed;
  }

  function setTaskStatus(taskId, status) {
    var t = taskId && Db.get('Tasks', taskId);
    return t && t.status !== status ? Tasks.setStatus(taskId, status) : [];
  }

  function latest(tasks) {
    var by = {};
    tasks.forEach(function (t) { if (t) by[t.task_id] = t; });
    return Object.keys(by).map(function (k) { return Db.get('Tasks', k) || by[k]; });
  }

  function result(r, project, tasks) {
    return { review: Db.get('PeerReviews', r.review_id), project: project || null, tasks: latest(tasks || []) };
  }

  function note(r, text) {
    Notes.add('PROJECT', r.project_id, text);
  }

  function money(v) {
    if (!v) return '';
    var parts = Number(v).toFixed(2).split('.');
    return '$' + parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + parts[1];
  }

  /* ---------------- actions ---------------- */

  function submit(p) {
    var project = Db.get('Projects', p.project_id);
    if (!project) throw new AppError('Project not found.', 'NOT_FOUND');
    if (project.archived) throw new AppError('This return is archived. Restore it before sending it to peer review.', 'VALIDATION');
    if (activeFor(project.project_id)) throw new AppError('This return already has an open peer review. It\'s on the Peer review tab.', 'CONFLICT');
    var me = Identity.currentEmail();
    var reviewer = String(p.reviewer_email || '').trim().toLowerCase();
    if (reviewer && reviewer === me) throw new AppError('You can\'t review your own return. Leave Reviewer blank or pick someone else.', 'VALIDATION');
    if (!reviewer && project.peer_reviewer_email && project.peer_reviewer_email !== me) reviewer = project.peer_reviewer_email;
    var addOns = normAddOns(p.add_ons);
    var pro = Db.get('Pros', project.org_id);
    var comments = String(p.comments || '').trim();
    var r = Db.insert('PeerReviews', {
      review_id: uid_('PR'), project_id: project.project_id, org_id: project.org_id,
      business_name: pro ? pro.business_name : project.org_id, tax_year: project.tax_year, filing_type: project.filing_type,
      status: 'SUBMITTED', safe_harbor_amount: normMoney(p.safe_harbor_amount), add_ons: addOns.join(', '),
      advisor_email: String(p.advisor_email || project.tax_advisor_email || '').toLowerCase(), comments: comments,
      submitted_by: me, submitted_at: nowIso_(), reviewer_email: reviewer, round: 1, rework_count: 0,
      events: [{ at: nowIso_(), by: me, action: 'SUBMITTED', note: comments }],
    });

    var tasks = [];
    var self = findTask(project.project_id, null, /submit for peer review/i);
    if (self && self.status !== 'DONE') tasks = tasks.concat(Tasks.setStatus(self.task_id, 'DONE'));
    var prepared = prepareReviewTask(r, reviewer, true);
    tasks = tasks.concat(prepared);
    var reviewTask = prepared[prepared.length - 1];
    Db.update('PeerReviews', r.review_id, { review_task_id: reviewTask.task_id }, null, { system: true });

    // The return itself: add-ons, people, and stage follow the review.
    var patch = {};
    var addOnText = addOns[0] === 'No add-ons' ? '' : addOns.join(', ');
    if (addOnText !== (project.add_ons || '')) patch.add_ons = addOnText;
    if (reviewer && reviewer !== project.peer_reviewer_email) patch.peer_reviewer_email = reviewer;
    if (!project.tax_advisor_email && r.advisor_email) patch.tax_advisor_email = r.advisor_email;
    var seq = ENUMS.PIPELINE_SEQUENCE;
    var at = seq.indexOf(project.pipeline_status);
    if (project.pipeline_status === 'IN_QUEUE_ESCALATED' || (at >= 0 && at < seq.indexOf('QA'))) patch.pipeline_status = 'QA';
    var proj = project;
    if (Object.keys(patch).length) {
      var res = Projects.update(project.project_id, patch);
      proj = res.project;
      tasks = tasks.concat(res.tasks);
    }
    note(r, 'Submitted for peer review.' + [
      r.add_ons ? ' Add-ons: ' + r.add_ons + '.' : '',
      r.safe_harbor_amount ? ' Safe harbor estimate: ' + money(r.safe_harbor_amount) + '.' : '',
      comments ? '\n' + comments : '',
    ].join(''));
    Audit.log('PROJECT', project.project_id, 'Submitted for peer review', 'peer_review', '', r.review_id);
    return result(r, proj, tasks);
  }

  function claim(id) {
    var me = Identity.current();
    var r = must(id);
    needStatus(r, ['SUBMITTED'], 'claim');
    if (!Identity.hasRole(me, ['PEER_REVIEWER', 'EXEC', 'ADMIN'])) {
      throw new AppError('Only peer reviewers can claim reviews. Ask a manager to add PEER_REVIEWER to your roles.', 'FORBIDDEN');
    }
    if (r.submitted_by === me.email) throw new AppError('You submitted this return, so someone else has to review it.', 'FORBIDDEN');
    var was = r.reviewer_email && r.reviewer_email !== me.email ? 'Was assigned to ' + r.reviewer_email : '';
    Db.update('PeerReviews', id, {
      status: 'IN_REVIEW', reviewer_email: me.email, claimed_at: r.claimed_at || nowIso_(), events: withEvent(r, 'CLAIMED', was),
    });
    var tasks = prepareReviewTask(r, me.email, false);
    var t = tasks[tasks.length - 1];
    if (t && t.status === 'NOT_STARTED') tasks = tasks.concat(Tasks.setStatus(t.task_id, 'IN_PROGRESS'));
    var project = Db.get('Projects', r.project_id);
    if (project && project.peer_reviewer_email !== me.email) {
      var res = Projects.update(r.project_id, { peer_reviewer_email: me.email });
      project = res.project;
      tasks = tasks.concat(res.tasks);
    }
    Audit.log('PROJECT', r.project_id, 'Claimed peer review', 'peer_reviewer', r.reviewer_email || '', me.email);
    return result(r, project, tasks);
  }

  function requireReviewer(r, me, verb) {
    if (r.reviewer_email !== me.email && !isAdmin(me)) {
      throw new AppError('Only the reviewer who claimed this review can ' + verb + ' it.', 'FORBIDDEN');
    }
  }

  function release(id) {
    var me = Identity.current();
    var r = must(id);
    needStatus(r, ['IN_REVIEW'], 'release');
    requireReviewer(r, me, 'release');
    Db.update('PeerReviews', id, { status: 'SUBMITTED', reviewer_email: '', events: withEvent(r, 'RELEASED', '') });
    var tasks = [];
    var t = findTask(r.project_id, r.review_task_id, /peer review verification/i);
    if (t) {
      tasks.push(Tasks.update(t.task_id, { assignee_email: '' }));
      tasks = tasks.concat(setTaskStatus(t.task_id, 'NOT_STARTED'));
    }
    Audit.log('PROJECT', r.project_id, 'Released peer review', 'peer_reviewer', r.reviewer_email, '');
    return result(r, null, tasks);
  }

  function rework(id, notes) {
    var me = Identity.current();
    var r = must(id);
    needStatus(r, ['IN_REVIEW'], 'send back');
    requireReviewer(r, me, 'send back');
    notes = String(notes || '').trim();
    if (!notes) throw new AppError('Say what needs to be reworked.', 'VALIDATION');
    var tasks = [];
    var t = findTask(r.project_id, r.rework_task_id, /apply peer-review changes/i);
    if (!t) {
      t = Tasks.create({ entity_type: 'PROJECT', entity_id: r.project_id, section: 'INTERNAL_REVIEW_QC', title: 'Apply peer-review changes' }, { role: 'PREPARER' });
    }
    if (t.status === 'DONE' || t.status === 'SKIPPED') tasks = tasks.concat(Tasks.setStatus(t.task_id, 'NOT_STARTED'));
    // Rework is what unblocks it now, not the review task being done.
    tasks.push(Tasks.update(t.task_id, { assignee_email: r.submitted_by, due_date: addDays_(todayIso_(), REWORK_DAYS), blocked_by: '' }));
    Db.update('PeerReviews', id, {
      status: 'REWORK', rework_count: (r.rework_count || 0) + 1, last_rework_notes: notes, last_rework_at: nowIso_(),
      rework_task_id: t.task_id, events: withEvent(r, 'REWORK', notes),
    });
    note(r, 'Peer review: needs rework (round ' + (r.round || 1) + ').\n' + notes);
    Audit.log('PROJECT', r.project_id, 'Peer review sent back for rework', 'peer_review', 'IN_REVIEW', 'REWORK');
    return result(r, null, tasks);
  }

  function resubmit(id, p) {
    var me = Identity.current();
    var r = must(id);
    needStatus(r, ['REWORK'], 'resubmit');
    var project = Db.get('Projects', r.project_id) || {};
    if (r.submitted_by !== me.email && project.tax_preparer_email !== me.email && !isAdmin(me)) {
      throw new AppError('Only the person who submitted this return, its preparer, or a manager can resubmit it.', 'FORBIDDEN');
    }
    p = p || {};
    var patch = {};
    if ('safe_harbor_amount' in p) patch.safe_harbor_amount = normMoney(p.safe_harbor_amount);
    if ('add_ons' in p) patch.add_ons = normAddOns(p.add_ons).join(', ');
    if ('comments' in p) patch.comments = String(p.comments || '').trim();
    var what = String(p.note || '').trim();
    var round = (r.round || 1) + 1;
    patch.status = r.reviewer_email ? 'IN_REVIEW' : 'SUBMITTED';
    patch.round = round;
    patch.resubmitted_at = nowIso_();
    patch.events = withEvent(r, 'RESUBMITTED', what, { round: round });
    Db.update('PeerReviews', id, patch);
    var tasks = setTaskStatus(r.rework_task_id, 'DONE');
    var rt = findTask(r.project_id, r.review_task_id, /peer review verification/i);
    if (rt) tasks.push(Tasks.update(rt.task_id, { due_date: addDays_(todayIso_(), REVIEW_DAYS) }));
    var proj = null;
    if ('add_ons' in patch) {
      var text = patch.add_ons === 'No add-ons' ? '' : patch.add_ons;
      if (text !== (project.add_ons || '')) { var res = Projects.update(r.project_id, { add_ons: text }); proj = res.project; }
    }
    note(r, 'Resubmitted for peer review (round ' + round + ').' + (what ? '\n' + what : ''));
    Audit.log('PROJECT', r.project_id, 'Resubmitted for peer review', 'peer_review', 'REWORK', patch.status);
    return result(r, proj, tasks);
  }

  function complete(id, p) {
    var me = Identity.current();
    var r = must(id);
    needStatus(r, ['IN_REVIEW'], 'complete');
    requireReviewer(r, me, 'complete');
    p = p || {};
    var notes = String(p.notes || '').trim();
    Db.update('PeerReviews', id, {
      status: 'COMPLETE', completed_at: nowIso_(), completed_by: me.email, completion_notes: notes, events: withEvent(r, 'COMPLETED', notes),
    });
    var tasks = [];
    var rt = findTask(r.project_id, r.review_task_id, /peer review verification/i);
    if (rt) tasks = tasks.concat(setTaskStatus(rt.task_id, 'DONE'));
    var wt = findTask(r.project_id, r.rework_task_id, /apply peer-review changes/i);
    if (wt && wt.status !== 'DONE' && wt.status !== 'SKIPPED') {
      tasks = tasks.concat(Tasks.setStatus(wt.task_id, r.rework_count ? 'DONE' : 'SKIPPED'));
    }
    var project = Db.get('Projects', r.project_id);
    if (p.advance && project && project.pipeline_status === 'QA') {
      var res = Projects.update(r.project_id, { pipeline_status: 'CLIENT_REVIEW' });
      project = res.project;
      tasks = tasks.concat(res.tasks);
    }
    var rounds = r.round || 1;
    note(r, 'Peer review complete' + (rounds > 1 ? ' after ' + rounds + ' rounds' : '') + '.' + (notes ? '\n' + notes : ''));
    Audit.log('PROJECT', r.project_id, 'Peer review complete', 'peer_review', 'IN_REVIEW', 'COMPLETE');
    return result(r, project, tasks);
  }

  function cancel(id, reason) {
    var me = Identity.current();
    var r = must(id);
    needStatus(r, OPEN, 'cancel');
    if (r.submitted_by !== me.email && !isAdmin(me)) throw new AppError('Only the person who submitted this review or a manager can cancel it.', 'FORBIDDEN');
    reason = String(reason || '').trim();
    if (!reason) throw new AppError('Give a reason for cancelling.', 'VALIDATION');
    Db.update('PeerReviews', id, { status: 'CANCELLED', cancelled_at: nowIso_(), cancel_reason: reason, events: withEvent(r, 'CANCELLED', reason) });
    note(r, 'Peer review cancelled: ' + reason);
    Audit.log('PROJECT', r.project_id, 'Cancelled peer review', 'peer_review', r.status, 'CANCELLED');
    return result(r, null, []);
  }

  /* ---------------- report ---------------- */

  function facts(r) {
    var end = r.completed_at || '';
    return {
      review_id: r.review_id, project_id: r.project_id, org_id: r.org_id, business_name: r.business_name,
      tax_year: r.tax_year, filing_type: r.filing_type, status: r.status,
      submitted_by: r.submitted_by, advisor_email: r.advisor_email, reviewer_email: r.reviewer_email,
      submitted_at: r.submitted_at, claimed_at: r.claimed_at, completed_at: end,
      hours_to_claim: hoursBetween_(r.submitted_at, r.claimed_at),
      review_days: r.claimed_at && end ? daysBetween_(r.claimed_at, end) : null,
      total_days: end ? daysBetween_(r.submitted_at, end) : null,
      rounds: r.round || 1, rework_count: r.rework_count || 0,
      safe_harbor_amount: r.safe_harbor_amount, add_ons: r.add_ons, comments: r.comments,
      last_rework_notes: r.last_rework_notes, completion_notes: r.completion_notes, cancel_reason: r.cancel_reason,
    };
  }

  function report() {
    var all = Db.list('PeerReviews').sort(byNewest);
    var live = all.filter(function (r) { return r.status !== 'CANCELLED'; });
    var now = nowIso_();
    var waiting = live.filter(function (r) { return r.status === 'SUBMITTED'; });
    var queue = {
      waiting: waiting.length,
      in_review: live.filter(function (r) { return r.status === 'IN_REVIEW'; }).length,
      rework: live.filter(function (r) { return r.status === 'REWORK'; }).length,
      completed: live.filter(function (r) { return r.status === 'COMPLETE'; }).length,
      oldest_waiting_hours: waiting.length ? Math.max.apply(null, waiting.map(function (r) { return hoursBetween_(r.submitted_at, now) || 0; })) : null,
    };

    var rev = {};
    live.forEach(function (r) {
      if (!r.reviewer_email) return;
      var a = rev[r.reviewer_email] || (rev[r.reviewer_email] = { reviewer_email: r.reviewer_email, completed: 0, open: 0, sent_back: 0, claim: [], review: [] });
      if (r.status === 'COMPLETE') a.completed++; else a.open++;
      if (r.rework_count) a.sent_back++;
      var f = facts(r);
      if (f.hours_to_claim != null) a.claim.push(f.hours_to_claim);
      if (f.review_days != null) a.review.push(f.review_days);
    });
    var reviewers = Object.keys(rev).map(function (k) {
      var a = rev[k];
      var n = a.completed + a.open;
      return {
        reviewer_email: k, reviews: n, completed: a.completed, open: a.open, sent_back: a.sent_back,
        rework_rate: n ? Math.round((a.sent_back / n) * 100) : null,
        avg_hours_to_claim: avg_(a.claim), avg_review_days: avg_(a.review),
      };
    }).sort(function (a, b) { return b.reviews - a.reviews; });

    var sub = {};
    live.forEach(function (r) {
      var a = sub[r.submitted_by] || (sub[r.submitted_by] = { submitted_by: r.submitted_by, submitted: 0, completed: 0, reworked: 0, rounds: [] });
      a.submitted++;
      if (r.status === 'COMPLETE') { a.completed++; a.rounds.push(r.round || 1); }
      if (r.rework_count) a.reworked++;
    });
    var submitters = Object.keys(sub).map(function (k) {
      var a = sub[k];
      return {
        submitted_by: k, submitted: a.submitted, completed: a.completed, reworked: a.reworked,
        rework_rate: a.submitted ? Math.round((a.reworked / a.submitted) * 100) : null, avg_rounds: avg_(a.rounds),
      };
    }).sort(function (a, b) { return b.submitted - a.submitted; });

    return { queue: queue, reviewers: reviewers, submitters: submitters, log: all.map(facts) };
  }

  return {
    forProject: forProject, open: open, closed: closed, activeFor: activeFor,
    submit: submit, claim: claim, release: release, rework: rework, resubmit: resubmit, complete: complete, cancel: cancel,
    report: report, facts: facts,
  };
})();
