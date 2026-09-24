/**
 * Minimal in-memory fakes of the Apps Script services the server code uses,
 * so the real server files can run under Node for tests and local dev.
 * Only the surface Tax Manager touches is implemented.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_DIR = path.join(HERE, '..', 'src', 'server');

class FakeRange {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = this.sheet.data[this.r - 1 + i] || [];
      const vals = [];
      for (let j = 0; j < this.nc; j++) { const v = row[this.c - 1 + j]; vals.push(v == null ? '' : v); }
      out.push(vals);
    }
    return out;
  }
  setValues(values) {
    if (values.length !== this.nr || values.some(r => r.length !== this.nc)) {
      throw new Error(`setValues dimension mismatch: range ${this.nr}x${this.nc}, data ${values.length}x${values[0] && values[0].length}`);
    }
    for (let i = 0; i < this.nr; i++) {
      const ri = this.r - 1 + i;
      while (this.sheet.data.length <= ri) this.sheet.data.push([]);
      for (let j = 0; j < this.nc; j++) this.sheet.data[ri][this.c - 1 + j] = values[i][j];
    }
    this.sheet.writes++;
    return this;
  }
  getMergedRanges() { return []; }
  setNumberFormat() { return this; }
  setFontWeight() { return this; }
  setBackground() { return this; }
}

class FakeSheet {
  constructor(name, data) { this.name = name; this.data = data || []; this.writes = 0; }
  getName() { return this.name; }
  trimmed() {
    let last = this.data.length;
    while (last > 0 && (this.data[last - 1] || []).every(v => v === '' || v == null)) last--;
    return last;
  }
  getLastRow() { return this.trimmed(); }
  getLastColumn() { return Math.max(0, ...this.data.map(r => { let n = r.length; while (n > 0 && (r[n - 1] === '' || r[n - 1] == null)) n--; return n; })); }
  getMaxRows() { return Math.max(1000, this.data.length); }
  getDataRange() {
    const nr = Math.max(1, this.getLastRow());
    const nc = Math.max(1, this.getLastColumn());
    return new FakeRange(this, 1, 1, nr, nc);
  }
  getRange(r, c, nr = 1, nc = 1) { return new FakeRange(this, r, c, nr, nc); }
  appendRow(row) { this.data.splice(this.getLastRow(), 0, row.slice()); return this; }
  deleteRow(r) { this.data.splice(r - 1, 1); return this; }
  setFrozenRows() { return this; }
}

class FakeSpreadsheet {
  constructor(id, name, tabs) {
    this.id = id; this.name = name;
    this.sheets = (tabs || []).map(t => new FakeSheet(t.name, t.data));
  }
  getId() { return this.id; }
  getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id; }
  getName() { return this.name; }
  getSpreadsheetTimeZone() { return 'America/Denver'; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  getSheets() { return this.sheets.slice(); }
  insertSheet(n) { const s = new FakeSheet(n, []); this.sheets.push(s); return s; }
  deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }
  toJSON() { return { id: this.id, name: this.name, tabs: this.sheets.map(s => ({ name: s.name, data: s.data })) }; }
}

class FakeProps {
  constructor(store) { this.store = store; }
  getProperty(k) { return k in this.store ? this.store[k] : null; }
  setProperty(k, v) { this.store[k] = String(v); return this; }
  deleteProperty(k) { delete this.store[k]; return this; }
  getProperties() { return { ...this.store }; }
}

export function createGas(opts = {}) {
  const state = opts.state || { spreadsheets: {}, props: {}, triggers: [], folders: {} };
  const spreadsheets = {};
  for (const [id, s] of Object.entries(state.spreadsheets)) spreadsheets[id] = new FakeSpreadsheet(s.id, s.name, s.tabs);
  let currentUser = opts.user || 'dev.user@housecallpro.com';
  const logs = [];

  const SpreadsheetApp = {
    openById(id) {
      if (!spreadsheets[id]) throw new Error('Spreadsheet not found: ' + id);
      return spreadsheets[id];
    },
    create(name) {
      const id = 'ss_' + crypto.randomBytes(14).toString('hex');
      spreadsheets[id] = new FakeSpreadsheet(id, name, [{ name: 'Sheet1', data: [] }]);
      return spreadsheets[id];
    },
  };

  function makeFolder(id, name, parentId) {
    return {
      getId: () => id,
      getName: () => name,
      getUrl: () => 'https://drive.google.com/drive/folders/' + id,
      isTrashed: () => false,
      getFoldersByName(n) {
        const hits = Object.values(state.folders).filter(f => f.parent === id && f.name === n);
        let i = 0;
        return { hasNext: () => i < hits.length, next: () => makeFolder(hits[i].id, hits[i++].name, id) };
      },
      createFolder(n) {
        const fid = 'fld_' + crypto.randomBytes(8).toString('hex');
        state.folders[fid] = { id: fid, name: n, parent: id };
        return makeFolder(fid, n, id);
      },
      createFile(blob) {
        return { getUrl: () => 'https://drive.google.com/file/d/' + crypto.randomBytes(8).toString('hex'), getName: () => blob.name };
      },
    };
  }
  const DriveApp = {
    getFolderById(id) {
      const f = state.folders[id];
      if (!f) throw new Error('No folder ' + id);
      return makeFolder(id, f.name, f.parent);
    },
    getFileById() { return { setTrashed() {} }; },
  };

  const lock = { tryLock: () => true, waitLock() {}, releaseLock() {} };

  const ctx = {
    console: { log: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push('ERR ' + a.join(' ')), warn: (...a) => logs.push(a.join(' ')) },
    Logger: { log: (...a) => logs.push(a.join(' ')) },
    SpreadsheetApp,
    DriveApp,
    PropertiesService: {
      getScriptProperties: () => new FakeProps(state.props),
      getUserProperties: () => new FakeProps(state.props),
    },
    LockService: { getScriptLock: () => lock, getUserLock: () => lock },
    Session: {
      getActiveUser: () => ({ getEmail: () => currentUser }),
      getEffectiveUser: () => ({ getEmail: () => currentUser }),
      getScriptTimeZone: () => 'America/Denver',
    },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate(d, tz, fmt) {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        }).formatToParts(d).reduce((o, p) => (o[p.type] = p.value, o), {});
        const hh = parts.hour === '24' ? '00' : parts.hour;
        return fmt.replace('yyyy', parts.year).replace('MM', parts.month).replace('dd', parts.day)
          .replace('HH', hh).replace('mm', parts.minute).replace('ss', parts.second);
      },
      base64Decode: s => Array.from(Buffer.from(s, 'base64')),
      newBlob: (bytes, mime, name) => ({ bytes, mime, name }),
    },
    ScriptApp: {
      getService: () => ({ getUrl: () => 'https://script.google.com/a/macros/housecallpro.com/s/DEV/exec' }),
      getProjectTriggers: () => state.triggers.map(h => ({ getHandlerFunction: () => h })),
      newTrigger(h) {
        const b = { timeBased: () => b, everyHours: () => b, everyMinutes: () => b, create: () => { state.triggers.push(h); return b; } };
        return b;
      },
    },
    HtmlService: {
      createHtmlOutputFromFile: () => ({ getContent: () => '<script>window.__TM_BOOT__ = "__TM_BOOT__";</script>' }),
      createHtmlOutput: html => { const o = { html, setTitle: () => o, addMetaTag: () => o, setXFrameOptionsMode: () => o, getContent: () => html }; return o; },
      XFrameOptionsMode: { DEFAULT: 'DEFAULT', ALLOWALL: 'ALLOWALL' },
    },
    MimeType: { GOOGLE_SHEETS: 'application/vnd.google-apps.spreadsheet' },
    Date, JSON, Math, Object, Array, String, Number, Boolean, RegExp, Error, isNaN, parseFloat, parseInt, Intl,
  };
  vm.createContext(ctx);
  const files = fs.readdirSync(SERVER_DIR).filter(f => f.endsWith('.js')).sort();
  const src = files.map(f => `// ---- ${f}\n` + fs.readFileSync(path.join(SERVER_DIR, f), 'utf8')).join('\n');
  vm.runInContext(src, ctx, { filename: 'server.js' });

  return {
    ctx,
    logs,
    state,
    setUser(email) { currentUser = email; },
    get user() { return currentUser; },
    /** Call the real api() as a given user; returns data or throws with the server's message. */
    call(action, payload, as) {
      const prev = currentUser;
      if (as) currentUser = as;
      try {
        const res = ctx.api(action, JSON.parse(JSON.stringify(payload || {})));
        const clean = JSON.parse(JSON.stringify(res));
        if (!clean.ok) { const e = new Error(clean.error); e.code = clean.code; throw e; }
        return clean.data;
      } finally { currentUser = prev; }
    },
    raw(action, payload, as) {
      const prev = currentUser;
      if (as) currentUser = as;
      try { return JSON.parse(JSON.stringify(ctx.api(action, payload || {}))); } finally { currentUser = prev; }
    },
    snapshot() {
      return { ...state, spreadsheets: Object.fromEntries(Object.entries(spreadsheets).map(([k, v]) => [k, v.toJSON()])) };
    },
    spreadsheet(id) { return spreadsheets[id || state.props.DB_SPREADSHEET_ID]; },
    addSpreadsheet(name, tabs) {
      const id = 'ss_' + crypto.randomBytes(14).toString('hex');
      spreadsheets[id] = new FakeSpreadsheet(id, name, tabs);
      return id;
    },
    addFolder(name) {
      const id = 'fld_' + crypto.randomBytes(8).toString('hex');
      state.folders[id] = { id, name, parent: null };
      return id;
    },
  };
}
