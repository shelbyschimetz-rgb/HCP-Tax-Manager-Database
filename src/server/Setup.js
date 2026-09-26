/**
 * Setup — run `setup()` once from the Apps Script editor after `clasp push`.
 *
 *  1. Creates the "Tax Manager DB" spreadsheet (or reuses DB_SPREADSHEET_ID).
 *  2. Creates / upgrades every tab and header (safe to re-run).
 *  3. Adds you to the Identity roster as EXEC + ADMIN.
 *  4. Seeds the default task templates.
 *  5. Installs the time-driven triggers (SFDC sync every 4h, timer auto-stop hourly,
 *     daily export to the "Tax Manager Reports" sheet ~6am).
 */

function setup() {
  var res = Setup.run();
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}

/** Re-install triggers only (e.g. after changing the owner). */
function installTriggers() {
  return Setup.installTriggers();
}

/** Trigger handlers — must be global functions. */
function sfdcSyncTrigger() {
  Locks.withLock(function () { return Sfdc.sync(); });
}
function timerAutoStopTrigger() {
  Locks.withLock(function () { return Timer.autoStopStale(); });
}

/** Drive advanced service (v3): convert an .xlsx blob to a Google Sheet, return its id. */
function DriveApi_createSheetFromBlob_(blob, name) {
  var file = Drive.Files.create({ name: name, mimeType: 'application/vnd.google-apps.spreadsheet' }, blob);
  return file.id;
}

var Setup = {
  run: function () {
    var props = PropertiesService.getScriptProperties();
    var id = props.getProperty(PROP.DB_ID);
    var ss = null;
    if (id) {
      try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
    }
    var created = false;
    if (!ss) {
      ss = SpreadsheetApp.create('Tax Manager DB');
      props.setProperty(PROP.DB_ID, ss.getId());
      created = true;
    }
    Db.clearCache();
    var tabs = Setup.ensureTabs(ss);
    if (created) {
      var first = ss.getSheetByName('Sheet1');
      if (first && ss.getSheets().length > 1) ss.deleteSheet(first);
    }
    var me = Identity.currentEmail();
    if (me && !Db.get('Identity', me)) {
      Db.insert('Identity', { name: Setup.nameFromEmail(me), email: me, active: true, roles: 'EXEC,ADMIN', accepting_new: false, color: '' });
    }
    var seeded = Templates.seedIfEmpty();
    var triggers = Setup.installTriggers();
    return {
      spreadsheet: ss.getUrl(),
      created_spreadsheet: created,
      tabs: tabs,
      templates_seeded: seeded,
      triggers: triggers,
      next: 'Deploy → New deployment → Web app. Add your team to the Identity tab.',
    };
  },

  nameFromEmail: function (email) {
    return email.split('@')[0].split(/[._]/).map(function (s) { return s.charAt(0).toUpperCase() + s.slice(1); }).join(' ');
  },

  /** Create missing tabs and append any missing header columns. */
  ensureTabs: function (ss) {
    var out = [];
    Object.keys(SCHEMA).forEach(function (name) {
      var cols = SCHEMA[name].cols;
      var sh = ss.getSheetByName(name);
      if (!sh) {
        sh = ss.insertSheet(name);
        sh.getRange(1, 1, 1, cols.length).setValues([cols]);
        sh.setFrozenRows(1);
        sh.getRange(1, 1, 1, cols.length).setFontWeight('bold').setBackground('#E3F2FD');
        // Plain text everywhere so dates / IDs / booleans are never auto-converted.
        sh.getRange(1, 1, sh.getMaxRows(), Math.max(cols.length, 1)).setNumberFormat('@');
        out.push(name + ' (created)');
        return;
      }
      var lastCol = Math.max(sh.getLastColumn(), 1);
      var header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
      var missing = cols.filter(function (c) { return header.indexOf(c) < 0; });
      if (missing.length) {
        var at = header.filter(function (h) { return h !== ''; }).length + 1;
        sh.getRange(1, at, 1, missing.length).setValues([missing]);
        sh.getRange(1, at, sh.getMaxRows(), missing.length).setNumberFormat('@');
        out.push(name + ' (+' + missing.join(', ') + ')');
      } else {
        out.push(name);
      }
    });
    return out;
  },

  installTriggers: function () {
    var want = { sfdcSyncTrigger: 'every 4 hours', timerAutoStopTrigger: 'hourly', dailyExportTrigger: 'daily ~6am' };
    var have = {};
    ScriptApp.getProjectTriggers().forEach(function (t) { have[t.getHandlerFunction()] = true; });
    var added = [];
    if (!have.sfdcSyncTrigger) { ScriptApp.newTrigger('sfdcSyncTrigger').timeBased().everyHours(4).create(); added.push('sfdcSyncTrigger'); }
    if (!have.timerAutoStopTrigger) { ScriptApp.newTrigger('timerAutoStopTrigger').timeBased().everyHours(1).create(); added.push('timerAutoStopTrigger'); }
    if (!have.dailyExportTrigger) { ScriptApp.newTrigger('dailyExportTrigger').timeBased().everyDays(1).atHour(6).create(); added.push('dailyExportTrigger'); }
    return Object.keys(want).map(function (k) { return k + ' — ' + want[k] + (added.indexOf(k) >= 0 ? ' (installed)' : ' (already installed)'); });
  },
};
