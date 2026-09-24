/**
 * Web — doGet serves the single-page app with the initial payload inlined, so
 * the first paint needs no extra round-trip. Everything after that goes
 * through google.script.run.api() (see Api.js) — the page never reloads for a
 * mutation.
 */

function doGet(e) {
  var boot;
  try {
    var me = Identity.current();
    boot = { ok: true, data: Boot.payload(me) };
  } catch (err) {
    boot = { ok: false, error: err.message || String(err), code: err.code || 'ERROR', email: Identity.currentEmail() };
  }
  var html = HtmlService.createHtmlOutputFromFile('index').getContent();
  // Inline the payload. Escape "<" so no string in the data can close the script tag.
  var json = JSON.stringify(boot).replace(/</g, '\\u003c')
    .replace(new RegExp('\\u2028', 'g'), '\\u2028').replace(new RegExp('\\u2029', 'g'), '\\u2029');
  html = html.replace('"__TM_BOOT__"', function () { return json; });
  return HtmlService.createHtmlOutput(html)
    .setTitle('Tax Manager')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}
