/**
 * DO NOT REPLACE EXISTING CODE.
 *
 * Add this file to the existing Insurance Hub Apps Script project.
 * Apps Script shares one global scope, so a second top-level doPost
 * would override the live doPost and stop Maryland and Virginia posts.
 * This file has no doPost.
 *
 * After this file is in the project, add ONE line inside the existing
 * doPost, after the JSON body is parsed and before the existing handling:
 *
 *   if (data.state === 'GA') return handleGeorgia_(data);
 *
 * Then redeploy that same web app (new version, same URL).
 * See APPS_SCRIPT_GA_SETUP.md. Do not flip GA_SYNC_LIVE in the page
 * until a Georgia test row and a Maryland or Virginia row both land.
 */

/**
 * Example only. Do not paste this function into the project.
 *
 * function doPost(e) {
 *   var data = JSON.parse(e.postData.contents);
 *   if (data.state === 'GA') return handleGeorgia_(data);
 *   // existing Maryland and Virginia handling stays below this line
 * }
 */

function gaCell_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') return value;
  if (typeof value === 'number' && isFinite(value)) return value;
  var s = String(value == null ? '' : value);
  if (/^[=+\-@\t\r]/.test(s)) return "'" + s;
  return s;
}

function handleGeorgia_(data) {
  var summary = data.summary || {};
  var exam = String(data.exam || '');
  if (exam !== '12-GA-01' && exam !== '12-GA-02' && exam !== '12-GA-05') {
    return gaJsonOut_({ ok: false, error: 'unknown georgia exam' });
  }
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName('Georgia');
  if (!sheet) {
    sheet = ss.insertSheet('Georgia');
    sheet.appendRow(['sentAt', 'name', 'team', 'exam', 'track', 'answered', 'accuracy', 'readiness', 'weakest', 'report']);
  }
  sheet.appendRow([
    new Date(data.sentAt || Date.now()),
    gaCell_(data.name),
    gaCell_(data.team),
    gaCell_(exam),
    gaCell_(summary.track),
    summary.answered || 0,
    summary.accuracy == null ? '' : summary.accuracy,
    summary.readiness == null ? '' : summary.readiness,
    gaCell_(summary.weakest),
    gaCell_(data.report)
  ]);
  return gaJsonOut_({ ok: true, lead: '' });
}

function gaJsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Run this from the Apps Script editor after the file is added.
 * It writes one fake Georgia row and checks the Georgia tab.
 * Delete that row when you are done. It does not call the web app.
 */
function testGeorgiaRow() {
  var out = handleGeorgia_({
    name: '=Sync test',
    state: 'GA',
    team: 'test',
    exam: '12-GA-01',
    sentAt: Date.now(),
    summary: { track: 'Life 12-GA-01', answered: 1, accuracy: 100, readiness: 70, weakest: '' },
    report: 'test row from testGeorgiaRow'
  });
  var text = out.getContent();
  var parsed = JSON.parse(text);
  if (!parsed.ok) throw new Error('handleGeorgia_ rejected the test row: ' + text);
  var sheet = SpreadsheetApp.getActive().getSheetByName('Georgia');
  if (!sheet) throw new Error('Georgia tab was not created');
  var last = sheet.getLastRow();
  var row = sheet.getRange(last, 1, 1, 10).getValues()[0];
  if (row[1] !== '=Sync test') throw new Error('name was not stored as text: ' + row[1]);
  if (sheet.getRange(last, 2).getFormula() !== '') throw new Error('name cell was stored as a formula');
  if (row[3] !== '12-GA-01') throw new Error('exam column: ' + row[3]);
  if (row[4] !== 'Life 12-GA-01') throw new Error('track column: ' + row[4]);
  Logger.log('Georgia test row is on row ' + last + '. Delete it after you check the tab.');
}
