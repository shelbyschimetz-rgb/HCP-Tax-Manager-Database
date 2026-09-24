/**
 * Db — thin record layer over the master spreadsheet.
 *
 * Reads a whole tab once per execution (memoized), maps rows to objects by
 * header name, and writes single rows back in place. Every mutating API call
 * runs inside Locks.withLock(), so read-modify-write here is safe.
 *
 * Optimistic concurrency: tables with a row_version column reject updates
 * whose expected version doesn't match (ConflictError), and bump it on write.
 */

function AppError(message, code) {
  this.name = 'AppError';
  this.message = message;
  this.code = code || 'ERROR';
}
AppError.prototype = Object.create(Error.prototype);

function conflict_(what) {
  return new AppError(what + ' was changed by someone else. Refresh to see the latest, then try again.', 'CONFLICT');
}

var Db = (function () {
  var cache = {};
  var ssCache = null;

  function spreadsheet() {
    if (ssCache) return ssCache;
    var id = getProp_(PROP.DB_ID);
    if (!id) throw new AppError('Tax Manager is not set up yet. Run setup() from the Apps Script editor.', 'NOT_SETUP');
    ssCache = SpreadsheetApp.openById(id);
    return ssCache;
  }

  function sheet(table) {
    var sh = spreadsheet().getSheetByName(table);
    if (!sh) throw new AppError('Missing tab "' + table + '" in the database sheet. Run setup() again.', 'NOT_SETUP');
    return sh;
  }

  function fromCell(v, type) {
    if (v === '' || v == null) {
      return type === 'b' ? false : type === 'j' ? null : null;
    }
    if (v instanceof Date) {
      // Someone formatted a column as a date in the sheet — normalize.
      var tz = spreadsheet().getSpreadsheetTimeZone();
      var hm = Utilities.formatDate(v, tz, 'HH:mm:ss');
      return hm === '00:00:00' ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : v.toISOString();
    }
    switch (type) {
      case 'n': {
        var n = Number(v);
        return isNaN(n) ? null : n;
      }
      case 'b':
        if (v === true || v === false) return v;
        return /^(true|yes|y|1|x)$/i.test(String(v).trim());
      case 'j':
        try { return JSON.parse(v); } catch (e) { return null; }
      default:
        return String(v);
    }
  }

  function toCell(v, type) {
    if (v == null) return '';
    if (type === 'b') return v ? 'TRUE' : 'FALSE';
    if (type === 'j') return typeof v === 'string' ? v : JSON.stringify(v);
    if (v instanceof Date) return v.toISOString();
    return String(v);
  }

  function load(table) {
    if (cache[table]) return cache[table];
    var schema = SCHEMA[table];
    var sh = sheet(table);
    var values = sh.getDataRange().getValues();
    var header = (values[0] || []).map(function (h) { return String(h).trim(); });
    var colIdx = {};
    header.forEach(function (h, i) { if (h) colIdx[h] = i; });
    var rows = [];
    var index = {};
    for (var r = 1; r < values.length; r++) {
      var raw = values[r];
      var keyVal = raw[colIdx[schema.key]];
      if (keyVal === '' || keyVal == null) continue; // skip blank rows
      var obj = {};
      for (var c = 0; c < schema.cols.length; c++) {
        var col = schema.cols[c];
        var i = colIdx[col];
        obj[col] = i == null ? fromCell('', schema.types[col]) : fromCell(raw[i], schema.types[col]);
      }
      obj.__row = r + 1;
      index[String(obj[schema.key])] = rows.length;
      rows.push(obj);
    }
    cache[table] = { rows: rows, index: index, header: header, colIdx: colIdx, sh: sh };
    return cache[table];
  }

  function strip(obj) {
    var out = {};
    for (var k in obj) if (k !== '__row') out[k] = obj[k];
    return out;
  }

  function rowArray(t, schema, obj) {
    var arr = [];
    for (var i = 0; i < t.header.length; i++) {
      var h = t.header[i];
      if (schema.cols.indexOf(h) >= 0) arr.push(toCell(obj[h], schema.types[h]));
      else arr.push(obj.__extra && obj.__extra[i] != null ? obj.__extra[i] : '');
    }
    return arr;
  }

  function list(table) {
    return load(table).rows.map(strip);
  }

  function get(table, key) {
    var t = load(table);
    var i = t.index[String(key)];
    return i == null ? null : strip(t.rows[i]);
  }

  function where(table, pred) {
    return list(table).filter(pred);
  }

  function stamp(table, obj, isNew) {
    var cols = SCHEMA[table].cols;
    var now = nowIso_();
    var me = Identity.currentEmail();
    if (isNew) {
      if (cols.indexOf('created_at') >= 0 && !obj.created_at) obj.created_at = now;
      if (cols.indexOf('created_by') >= 0 && !obj.created_by) obj.created_by = me;
      if (cols.indexOf('row_version') >= 0) obj.row_version = 1;
    }
    if (cols.indexOf('updated_at') >= 0) obj.updated_at = now;
    if (cols.indexOf('updated_by') >= 0) obj.updated_by = me;
  }

  function insertMany(table, objs) {
    if (!objs.length) return [];
    var schema = SCHEMA[table];
    var t = load(table);
    var out = [];
    var arrays = objs.map(function (o) {
      var obj = {};
      schema.cols.forEach(function (c) { obj[c] = o[c] == null ? null : o[c]; });
      if (!obj[schema.key]) throw new AppError('Missing ' + schema.key + ' for new ' + table + ' row');
      if (t.index[String(obj[schema.key])] != null) {
        throw new AppError(table + ' ' + obj[schema.key] + ' already exists.', 'DUPLICATE');
      }
      stamp(table, obj, true);
      out.push(obj);
      return rowArray(t, schema, obj);
    });
    var start = t.sh.getLastRow() + 1;
    var over = start + arrays.length - 1 - t.sh.getMaxRows();
    if (over > 0) t.sh.insertRowsAfter(t.sh.getMaxRows(), over + 100);
    var range = t.sh.getRange(start, 1, arrays.length, t.header.length);
    range.setNumberFormat('@'); // rows past the formatted block must stay plain text too
    range.setValues(arrays);
    out.forEach(function (obj, i) {
      obj.__row = start + i;
      t.index[String(obj[schema.key])] = t.rows.length;
      t.rows.push(obj);
    });
    return out.map(strip);
  }

  function insert(table, obj) {
    return insertMany(table, [obj])[0];
  }

  /**
   * Merge `patch` into the row with `key`. If expectedVersion is given and the
   * table versions rows, a mismatch throws a CONFLICT AppError.
   * opts.system: bookkeeping write (wizard progress, Drive link) — doesn't bump
   * row_version, so it never invalidates a user's in-flight edit.
   */
  function update(table, key, patch, expectedVersion, opts) {
    var schema = SCHEMA[table];
    var t = load(table);
    var i = t.index[String(key)];
    if (i == null) throw new AppError(table + ' ' + key + ' not found.', 'NOT_FOUND');
    var cur = t.rows[i];
    var versioned = schema.cols.indexOf('row_version') >= 0;
    if (versioned && expectedVersion != null && Number(expectedVersion) !== Number(cur.row_version || 1)) {
      throw conflict_(table === 'Pros' ? 'This pro' : table === 'Projects' ? 'This project' : 'This record');
    }
    var next = {};
    for (var k in cur) next[k] = cur[k];
    for (var p in patch) {
      if (p === schema.key || p === '__row' || p === 'row_version') continue;
      if (schema.cols.indexOf(p) >= 0) next[p] = patch[p];
    }
    if (versioned) next.row_version = Number(cur.row_version || 1) + (opts && opts.system ? 0 : 1);
    stamp(table, next, false);
    // Preserve any non-schema columns the team added by hand.
    var raw = t.sh.getRange(cur.__row, 1, 1, t.header.length).getValues()[0];
    next.__extra = raw;
    t.sh.getRange(cur.__row, 1, 1, t.header.length).setValues([rowArray(t, schema, next)]);
    delete next.__extra;
    t.rows[i] = next;
    return strip(next);
  }

  function remove(table, key) {
    var t = load(table);
    var i = t.index[String(key)];
    if (i == null) return false;
    t.sh.deleteRow(t.rows[i].__row);
    delete cache[table]; // row numbers shifted — reload on next access
    return true;
  }

  function clearCache() { cache = {}; ssCache = null; }

  return {
    spreadsheet: spreadsheet, list: list, get: get, where: where, insert: insert,
    insertMany: insertMany, update: update, remove: remove, clearCache: clearCache,
    _fromCell: fromCell,
  };
})();

/* ---------------- small shared utilities ---------------- */

function nowIso_() {
  return new Date().toISOString();
}

function todayIso_() {
  var tz = Session.getScriptTimeZone ? Session.getScriptTimeZone() : 'America/Denver';
  return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
}

function uid_(prefix) {
  return (prefix ? prefix + '-' : '') + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
}

/** Add `days` to a YYYY-MM-DD date string. */
function addDays_(iso, days) {
  if (!iso) return '';
  var d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z');
  if (isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

function daysBetween_(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  var a = new Date(fromIso).getTime();
  var b = new Date(toIso).getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round(((b - a) / 86400000) * 10) / 10;
}

function isEmpty_(v) {
  return v == null || v === '' || (typeof v === 'number' && isNaN(v));
}
