/**
 * Exports — a daily, human-friendly copy of everything in a separate
 * "Tax Manager Reports" spreadsheet, for leadership, Looker/Data Studio, or
 * other Apps Scripts (e.g. Tax Advisor Performance) to read.
 *
 * Tabs (rewritten on every run): About, Pros, Tax Returns, and one per report.
 * "Pipeline history" is appended to — one row per stage per day — so trends
 * accumulate over time. Runs daily via dailyExportTrigger (~6am) and on
 * demand from Settings → "Export now". The app's own DB sheet stays the
 * source of truth; this sheet is a read-only copy (edits here are overwritten).
 */

function dailyExportTrigger() {
  Exports.run();
}

var Exports = (function () {

  function yes(b) { return b ? 'Yes' : 'No'; }

  function spreadsheet(createIfMissing) {
    var id = getProp_(PROP.EXPORT_SHEET_ID);
    if (id) {
      try { return SpreadsheetApp.openById(id); } catch (e) { if (!createIfMissing) throw e; }
    }
    if (!createIfMissing) return null;
    var ss = SpreadsheetApp.create('Tax Manager Reports');
    setProp_(PROP.EXPORT_SHEET_ID, ss.getId());
    return ss;
  }

  /** Replace a tab's contents with header + rows. */
  function writeTab(ss, name, header, rows, note) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.clearContents();
    var data = [header].concat(rows.map(function (r) {
      return r.map(function (v) { return v == null ? '' : v; });
    }));
    var needRows = data.length + (note ? 2 : 0);
    if (sh.getMaxRows() < needRows) sh.insertRowsAfter(sh.getMaxRows(), needRows - sh.getMaxRows());
    if (sh.getMaxColumns() < header.length) sh.insertColumnsAfter(sh.getMaxColumns(), header.length - sh.getMaxColumns());
    sh.getRange(1, 1, data.length, header.length).setValues(data);
    sh.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#E3F2FD');
    sh.setFrozenRows(1);
    if (note) sh.getRange(data.length + 2, 1).setValue(note);
    return data.length - 1;
  }

  function run() {
    var t0 = Date.now();
    var ss = spreadsheet(true);
    var team = {};
    Identity.roster().forEach(function (m) { team[m.email] = m.name; });
    var who = function (e) { return e ? (team[e] || e) : ''; };
    var today = todayIso_();
    var pros = Db.list('Pros');
    var projects = Db.list('Projects');
    var tasks = Db.list('Tasks');
    var outstanding = Db.list('OutstandingItems');
    var time = Db.list('TimeEntries');
    var history = Db.list('ProjectStageHistory');
    var proBy = {};
    pros.forEach(function (p) { proBy[p.org_id] = p; });

    var taskAgg = {};
    tasks.forEach(function (t) {
      if (t.entity_type !== 'PROJECT' || t.status === 'SKIPPED') return;
      var a = taskAgg[t.entity_id] || (taskAgg[t.entity_id] = { done: 0, total: 0 });
      a.total++;
      if (t.status === 'DONE') a.done++;
    });
    var openItems = {};
    outstanding.forEach(function (o) { if (!o.resolved) openItems[o.project_id] = (openItems[o.project_id] || 0) + 1; });
    var minutes = {};
    time.forEach(function (e) { if (e.stopped_at) minutes[e.project_id] = (minutes[e.project_id] || 0) + (e.duration_min || 0); });
    var stageSince = {};
    history.forEach(function (h) { if (!stageSince[h.project_id] || h.changed_at > stageSince[h.project_id]) stageSince[h.project_id] = h.changed_at; });
    var projCount = {}, activeCount = {};
    projects.forEach(function (p) {
      if (p.archived) return;
      projCount[p.org_id] = (projCount[p.org_id] || 0) + 1;
      if (p.pipeline_status !== 'COMPLETE') activeCount[p.org_id] = (activeCount[p.org_id] || 0) + 1;
    });

    var counts = {};

    counts.Pros = writeTab(ss, 'Pros', [
      'Org ID', 'Business', 'DBA', 'Lifecycle', 'Entity type', 'State', 'Vertical',
      'Tax advisor', 'Tax advisor email', 'Onboarding specialist', 'OS email', 'OS needs assignment', 'BK lead',
      'Owner 1', 'Owner 1 email', 'Owner 1 phone', 'Owner 1 %', 'Owner 2', 'Owner 2 %', 'Owner 3', 'Owner 3 %',
      'Doc collection', 'Books with HCP', 'Prior books', 'Payroll servicer', 'Year started', 'Scope start', 'Time zone',
      'Last advisor touchpoint', 'Last filing year', 'At risk', 'At-risk reason', 'Open returns', 'Total returns',
      'Drive folder', 'SFDC case', 'Onboarding claimed by', 'Onboarding claimed at', 'Archived', 'Archived at', 'Archive reason',
      'Created', 'Updated', 'Asana link',
    ], pros.map(function (p) {
      return [
        p.org_id, p.business_name, p.dba, label_('LIFECYCLE_STATUS', p.lifecycle_status), label_('ENTITY_TYPE', p.entity_type), p.state, p.vertical,
        who(p.assigned_advisor_email), p.assigned_advisor_email, who(p.assigned_os_email), p.assigned_os_email, yes(p.needs_os_assignment), who(p.bk_lead_email),
        p.owner1_name, p.owner1_email, p.owner1_phone, p.owner1_pct, p.owner2_name, p.owner2_pct, p.owner3_name, p.owner3_pct,
        label_('DOC_COLLECTION_STATUS', p.doc_collection_status), yes(p.books_with_hcp), p.prior_books_status, p.payroll_servicer, p.year_started,
        p.scope_start_date, p.time_zone, p.last_advisor_touchpoint, p.last_filing_year, yes(p.at_risk), p.at_risk_reason,
        activeCount[p.org_id] || 0, projCount[p.org_id] || 0, p.drive_folder_url, p.sfdc_case_number, who(p.onboarding_claimed_by),
        dateOnly_(p.onboarding_claimed_at), yes(p.archived), dateOnly_(p.archived_at), p.archive_reason,
        dateOnly_(p.created_at), dateOnly_(p.updated_at), p.source_ref,
      ];
    }));

    counts['Tax Returns'] = writeTab(ss, 'Tax Returns', [
      'Project ID', 'Org ID', 'Business', 'Filing type', 'Tax year', 'Stage', 'In stage since', 'Days in stage', 'Blocker',
      'Filing deadline', 'Past deadline', 'Project start', 'E-filed', 'Extension needed', 'Extension filed',
      'Tax advisor', 'Preparer', 'Peer reviewer', 'OS', 'Complexity', 'States', 'Tax risk', 'Books for scope', 'Billing',
      'Progress %', 'Tasks done', 'Tasks total', 'Open outstanding items', 'Hours logged', 'Archived', 'Created', 'Updated', 'Asana link',
    ], projects.map(function (p) {
      var a = taskAgg[p.project_id] || { done: 0, total: 0 };
      var since = stageSince[p.project_id] || p.stage_changed_at || p.created_at;
      var pct = p.pipeline_status === 'COMPLETE' ? 100 : a.total ? Math.round((a.done / a.total) * 100) : 0;
      var past = p.filing_deadline && p.filing_deadline < today && !p.efile_date && p.pipeline_status !== 'COMPLETE';
      return [
        p.project_id, p.org_id, proBy[p.org_id] ? proBy[p.org_id].business_name : '', label_('FILING_TYPE', p.filing_type), p.tax_year,
        label_('PIPELINE_STATUS', p.pipeline_status), dateOnly_(since), since ? Math.max(0, Math.round(daysBetween_(since, nowIso_()))) : '',
        p.blocker_reason, p.filing_deadline, past ? 'Yes' : 'No', p.project_start_date, p.efile_date, yes(p.extension_needed), yes(p.extension_filed),
        who(p.tax_advisor_email), who(p.tax_preparer_email), who(p.peer_reviewer_email), who(p.os_email),
        p.complexity, p.states_covered, p.tax_risk_level, p.books_status, p.billing_kind,
        pct, a.done, a.total, openItems[p.project_id] || 0, Math.round(((minutes[p.project_id] || 0) / 60) * 10) / 10,
        yes(p.archived), dateOnly_(p.created_at), dateOnly_(p.updated_at), p.source_ref,
      ];
    }));

    var r = Reports.all();
    counts['Pipeline snapshot'] = writeTab(ss, 'Pipeline snapshot', ['Stage', 'Open projects', 'Past deadline'],
      r.pipeline.map(function (x) { return [label_('PIPELINE_STATUS', x.stage), x.count, x.overdue]; }));
    counts['Stage cycle time'] = writeTab(ss, 'Stage cycle time',
      ['Stage', 'Avg days', 'Median days', 'Sample size'].concat(r.cycle.advisors.map(function (a) { return who(a) + ' (avg days)'; })),
      r.cycle.rows.map(function (x) {
        return [label_('PIPELINE_STATUS', x.stage), x.avg_days, x.median_days, x.count].concat(r.cycle.advisors.map(function (a) { return x.by_advisor[a]; }));
      }), 'Days spent in each stage, from stage-change history. Raw durations, no SLA targets.');
    counts['Per-advisor summary'] = writeTab(ss, 'Per-advisor summary',
      ['Advisor', 'Email', 'Open projects', 'Completed YTD', 'Avg cycle days', 'On-time %', 'Hours logged on their projects'],
      r.advisor.map(function (x) { return [who(x.advisor_email), x.advisor_email, x.open_projects, x.completed_ytd, x.avg_cycle_days, x.on_time_pct, x.actual_hrs]; }));
    counts['Advisor load balance'] = writeTab(ss, 'Advisor load balance', ['Advisor', 'Email', 'Active pros', 'Accepting new', 'Last assigned', 'Next up'],
      r.balance.loads.slice().sort(function (a, b) { return a.count - b.count; }).map(function (l) {
        return [l.name, l.email, l.count, yes(l.accepting), dateOnly_(l.lastAssigned), l.email === r.balance.next ? 'Yes' : ''];
      }));
    counts['Logged time'] = writeTab(ss, 'Logged time',
      ['Project ID', 'Business', 'Return type', 'Tax year', 'Person', 'Advisor', 'Started', 'Stopped', 'Minutes', 'Auto-stopped'],
      r.time.map(function (e) {
        return [e.project_id, e.business_name, label_('FILING_TYPE', e.filing_type), e.tax_year, who(e.user_email), who(e.advisor_email),
          e.started_at, e.stopped_at, e.duration_min, e.auto_stopped ? 'Yes' : ''];
      }));
    counts['At-risk pros'] = writeTab(ss, 'At-risk pros', ['Org ID', 'Business', 'Reason', 'Advisor', 'Last advisor touchpoint'],
      r.risk.map(function (x) { return [x.org_id, x.business_name, x.at_risk_reason, who(x.assigned_advisor_email), x.last_advisor_touchpoint]; }));

    // Pipeline history: one row per stage per day; re-running today replaces today's rows.
    var hs = ss.getSheetByName('Pipeline history') || ss.insertSheet('Pipeline history');
    var existing = hs.getLastRow() > 0 ? hs.getRange(1, 1, hs.getLastRow(), 4).getValues() : [];
    var kept = existing.slice(1).filter(function (row) {
      var d = row[0] instanceof Date ? Utilities.formatDate(row[0], ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : String(row[0]);
      return d && d !== today;
    });
    var todays = r.pipeline.map(function (x) { return [today, label_('PIPELINE_STATUS', x.stage), x.count, x.overdue]; });
    counts['Pipeline history'] = writeTab(ss, 'Pipeline history', ['Date', 'Stage', 'Open projects', 'Past deadline'], kept.concat(todays));

    writeTab(ss, 'About', ['Tax Manager Reports', ''], [
      ['Last refreshed', new Date().toISOString()],
      ['Refreshes', 'Every morning (~6am) and when an admin clicks "Export now" in Tax Manager → Settings'],
      ['Source', 'Tax Manager database (read-only copy — edits here are overwritten on the next refresh)'],
      ['Rows', Object.keys(counts).map(function (k) { return k + ': ' + counts[k]; }).join(' · ')],
    ]);
    var about = ss.getSheetByName('About');
    if (about && ss.getSheets()[0].getName() !== 'About' && ss.setActiveSheet && ss.moveActiveSheet) {
      ss.setActiveSheet(about);
      ss.moveActiveSheet(1);
    }
    var blank = ss.getSheetByName('Sheet1');
    if (blank && ss.getSheets().length > 1) ss.deleteSheet(blank);

    var result = { url: ss.getUrl(), at: nowIso_(), counts: counts, ms: Date.now() - t0 };
    setProp_(PROP.LAST_EXPORT, JSON.stringify(result));
    return result;
  }

  function status() {
    var last = getProp_(PROP.LAST_EXPORT);
    var id = getProp_(PROP.EXPORT_SHEET_ID);
    return {
      sheet_id: id,
      url: id ? 'https://docs.google.com/spreadsheets/d/' + id : '',
      last: last ? JSON.parse(last) : null,
    };
  }

  return { run: run, status: status, spreadsheet: spreadsheet };
})();

function label_(kind, v) {
  return v == null || v === '' ? '' : (LABELS[kind] && LABELS[kind][v]) || v;
}

function dateOnly_(iso) {
  return iso ? String(iso).slice(0, 10) : '';
}
