/**
 * Web — doGet serves the single-page app with the initial payload inlined, so
 * the first paint needs no extra round-trip. Everything after that goes
 * through google.script.run.api() (see Api.js) — the page never reloads for a
 * mutation.
 */

function doGet(e) {
  if (e && e.parameter && e.parameter.diag) return diagnostics_();
  var boot;
  try {
    var me = Identity.current();
    boot = { ok: true, data: Boot.payload(me) };
  } catch (err) {
    boot = { ok: false, error: err.message || String(err), code: err.code || 'ERROR', email: Identity.currentEmail() };
  }
  var html;
  try {
    html = HtmlService.createHtmlOutputFromFile('index').getContent();
  } catch (err2) {
    return HtmlService.createHtmlOutput('<p style="font:14px Arial;padding:40px">Tax Manager setup problem: there is no HTML file named <b>index</b> in the Apps Script project. ('
      + String(err2.message || err2).replace(/</g, '&lt;') + ')</p>');
  }
  // Inline the payload. Escape "<" so no string in the data can close the script tag.
  var json = JSON.stringify(boot).replace(/</g, '\\u003c')
    .replace(new RegExp('\\u2028', 'g'), '\\u2028').replace(new RegExp('\\u2029', 'g'), '\\u2029');
  html = html.replace('"__TM_BOOT__"', function () { return json; });
  return HtmlService.createHtmlOutput(html)
    .setTitle('Tax Manager')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/** ?diag=1 — plain-text health check for troubleshooting a blank or broken page. */
function diagnostics_() {
  var lines = ['Tax Manager diagnostics — ' + new Date().toISOString()];
  function check(label, fn) {
    try { lines.push('OK    ' + label + (function (v) { return v == null || v === '' ? '' : ': ' + v; })(fn())); }
    catch (err) { lines.push('FAIL  ' + label + ': ' + (err && err.message ? err.message : err)); }
  }
  check('Signed-in email', function () { return Identity.currentEmail() || '(empty — deployment must be "Anyone within Housecall Pro")'; });
  check('Database spreadsheet', function () { return Db.spreadsheet().getName() + ' (' + getProp_(PROP.DB_ID) + ')'; });
  check('On team roster', function () { var m = Identity.current(); return m.name + ' · ' + m.roles.join(','); });
  check('Task templates', function () { return Templates.all('PRO').length + ' pro / ' + Templates.all('PROJECT').length + ' project'; });
  var html = '';
  check('index.html file', function () {
    html = HtmlService.createHtmlOutputFromFile('index').getContent();
    var ends = /<\/html>\s*$/i.test(html);
    if (!ends) throw new Error(Math.round(html.length / 1024) + ' KB but does not end with </html> — the paste was cut off; paste the whole file again');
    if (html.indexOf('"__TM_BOOT__"') < 0) throw new Error('boot placeholder missing — this is not the Tax Manager index.html');
    if (html.indexOf('__TM_BUNDLE_LOADED__') < 0) throw new Error('app script section missing');
    return Math.round(html.length / 1024) + ' KB, complete';
  });
  check('Startup data', function () { var p = Boot.payload(Identity.current()); return p.pros.length + ' pros, ' + p.projects.length + ' projects'; });
  check('Drive advanced service', function () { return typeof Drive !== 'undefined' && Drive.Files ? 'enabled' : (function () { throw new Error('not enabled — Services + → Drive API v3'); })(); });
  check('Triggers', function () { return ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); }).join(', ') || '(none — run setup)'; });
  return ContentService.createTextOutput(lines.join('\n')).setMimeType(ContentService.MimeType.TEXT);
}
