/**
 * Churn — archive pros that churned, from the "Bizsol Retention Data" report.
 *
 * Source: the Tax tab (one row per retention case). A row with Status
 * "Closed" and Sub-Status "Lost" means the pro churned. The report has no
 * reliable dates, so rows are read top to bottom as oldest → newest: a
 * "Closed / Saved" row BELOW a pro's last Lost row means they were saved
 * since, and they are left alone.
 *
 * For each churned pro: archive the pro, and archive every return that isn't
 * Complete (completed returns stay as history). Each loss acts once — the
 * ChurnLog tab remembers how many Lost rows a pro had when it was handled, so
 * restoring a pro by hand sticks until a NEW Lost case appears.
 *
 * Runs every morning (~5am) once an admin has turned it on in Settings.
 */

function churnTrigger() {
  if (!Churn.config().enabled) return null;
  return Churn.run();
}

var Churn = {
  REASON: 'Churned: Salesforce retention case Closed / Lost',

  config: function () {
    return {
      sheet_id: getProp_(PROP.CHURN_SHEET_ID, DEFAULTS.CHURN_SHEET_ID),
      tab: getProp_(PROP.CHURN_TAB, DEFAULTS.CHURN_TAB),
      enabled: getProp_(PROP.CHURN_ENABLED) === 'true',
    };
  },

  /** Churned org IDs from the report: [{ org_id, business_name, lost_cases }]. */
  read: function () {
    var cfg = Churn.config();
    var ss;
    try { ss = SpreadsheetApp.openById(cfg.sheet_id); } catch (e) {
      throw new AppError('Can\'t open the churn report. Share it with the account Tax Manager runs as, or fix the link in Settings.', 'NOT_CONFIGURED');
    }
    var sh = ss.getSheetByName(cfg.tab);
    if (!sh) throw new AppError('The churn report has no "' + cfg.tab + '" tab.', 'NOT_CONFIGURED');
    var values = sh.getDataRange().getValues();
    var norm = (values[0] || []).map(function (h) { return String(h).trim().toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' '); });
    var col = function (names) { for (var i = 0; i < names.length; i++) { var at = norm.indexOf(names[i]); if (at >= 0) return at; } return -1; };
    var cStatus = col(['status']), cSub = col(['sub status', 'substatus']), cOrg = col(['org id', 'orgid', 'organization id']), cName = col(['account name', 'account']);
    if (cStatus < 0 || cSub < 0 || cOrg < 0) {
      throw new AppError('The churn report\'s "' + cfg.tab + '" tab needs Status, Sub-Status and Org ID columns.', 'NOT_CONFIGURED');
    }
    var by = {};
    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      var org = String(row[cOrg] == null ? '' : row[cOrg]).trim().replace(/\.0+$/, '');
      if (!/^\d+$/.test(org)) continue;
      var status = String(row[cStatus] || '').trim().toLowerCase();
      var sub = String(row[cSub] || '').trim().toLowerCase();
      var a = by[org] || (by[org] = { org_id: org, business_name: '', lost_cases: 0, lastLost: -1, lastSaved: -1 });
      if (cName >= 0 && row[cName]) a.business_name = String(row[cName]).trim();
      if (status === 'closed' && sub === 'lost') { a.lost_cases++; a.lastLost = r; }
      if (status === 'closed' && sub === 'saved') a.lastSaved = r;
    }
    return Object.keys(by).map(function (k) { return by[k]; })
      .filter(function (a) { return a.lastLost >= 0 && a.lastSaved < a.lastLost; })
      .map(function (a) { return { org_id: a.org_id, business_name: a.business_name, lost_cases: a.lost_cases }; });
  },

  /** What a run would do now. No writes. */
  plan: function () {
    var churned = Churn.read();
    var log = {};
    Db.list('ChurnLog').forEach(function (l) { log[l.org_id] = l; });
    var projectsBy = {};
    Db.list('Projects').forEach(function (p) { (projectsBy[p.org_id] = projectsBy[p.org_id] || []).push(p); });
    var actions = [];
    churned.forEach(function (c) {
      var l = log[c.org_id];
      if (l && Number(l.lost_cases || 0) >= c.lost_cases) return; // this loss was already handled
      var pro = Db.get('Pros', c.org_id);
      var a = { org_id: c.org_id, business_name: pro ? pro.business_name : c.business_name, lost_cases: c.lost_cases };
      if (!pro) a.action = 'NO_PRO';
      else if (pro.archived) a.action = 'ALREADY_ARCHIVED';
      else {
        var mine = (projectsBy[c.org_id] || []).filter(function (p) { return !p.archived; });
        a.action = 'ARCHIVE';
        a.projects = mine.filter(function (p) { return p.pipeline_status !== 'COMPLETE'; }).map(function (p) { return p.project_id; });
        a.kept_complete = mine.length - a.projects.length;
      }
      actions.push(a);
    });
    var archive = actions.filter(function (a) { return a.action === 'ARCHIVE'; });
    return {
      tab: Churn.config().tab, churned_in_report: churned.length,
      to_archive: archive.length, returns_to_archive: archive.reduce(function (n, a) { return n + a.projects.length; }, 0),
      complete_returns_kept: archive.reduce(function (n, a) { return n + a.kept_complete; }, 0),
      not_in_tax_manager: actions.filter(function (a) { return a.action === 'NO_PRO'; }).length,
      actions: actions,
    };
  },

  /** Archive churned pros. Locks in small batches so teammates' saves can interleave. */
  run: function () {
    Db.clearCache();
    var p = Churn.plan();
    var t0 = Date.now();
    var done = { pros_archived: 0, returns_archived: 0, logged: 0, deferred: 0, archived: [] };
    var CHUNK = 10;
    for (var i = 0; i < p.actions.length; i += CHUNK) {
      if (Date.now() - t0 > 240000) { done.deferred += p.actions.length - i; break; }
      var batch = p.actions.slice(i, i + CHUNK);
      Locks.withLock(function () {
        batch.forEach(function (a) {
          var archivedReturns = 0;
          var action = a.action;
          var pro = Db.get('Pros', a.org_id);
          if (action === 'ARCHIVE' && pro && !pro.archived) {
            Pros.archive(a.org_id, Churn.REASON);
            Db.where('Projects', function (x) { return x.org_id === a.org_id && !x.archived && x.pipeline_status !== 'COMPLETE'; })
              .forEach(function (x) { Projects.archive(x.project_id, Churn.REASON); archivedReturns++; });
            done.pros_archived++;
            done.returns_archived += archivedReturns;
            done.archived.push({ org_id: a.org_id, business_name: a.business_name, returns: archivedReturns });
          } else if (action === 'ARCHIVE') {
            action = 'ALREADY_ARCHIVED';
          }
          var row = {
            org_id: a.org_id, business_name: a.business_name, lost_cases: a.lost_cases, action: action,
            projects_archived: archivedReturns, processed_at: nowIso_(), note: action === 'ARCHIVE' ? Churn.REASON : '',
          };
          if (Db.get('ChurnLog', a.org_id)) Db.update('ChurnLog', a.org_id, row); else Db.insert('ChurnLog', row);
          done.logged++;
        });
      });
    }
    var result = {
      at: nowIso_(), churned_in_report: p.churned_in_report, pros_archived: done.pros_archived,
      returns_archived: done.returns_archived, complete_returns_kept: p.complete_returns_kept,
      not_in_tax_manager: p.not_in_tax_manager, deferred: done.deferred, archived: done.archived.slice(0, 200),
    };
    setProp_(PROP.LAST_CHURN, JSON.stringify({
      at: result.at, pros_archived: result.pros_archived, returns_archived: result.returns_archived,
      complete_returns_kept: result.complete_returns_kept, deferred: result.deferred,
    }));
    return result;
  },
};
