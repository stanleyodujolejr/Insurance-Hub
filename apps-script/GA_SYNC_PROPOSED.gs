/**
 * Proposed addition for the existing Insurance Hub Apps Script.
 * The live script is not in this repository, so this file does not replace it.
 * Merge the Georgia branch below into the current doPost, then redeploy
 * that same web app. See APPS_SCRIPT_GA_SETUP.md.
 *
 * The page posts JSON and treats a response as success only when ok is true.
 * Any other response, or a network failure, is stored on the device and study continues.
 */
function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return jsonOut_({ ok: false, error: 'bad json' });
  }
  if (body.state === 'GA') return handleGeorgia_(body);
  // Keep the existing Maryland and Virginia handler here.
  // Do not send a Georgia row through that handler.
  return jsonOut_({ ok: false, error: 'unhandled state' });
}

function handleGeorgia_(body) {
  var summary = body.summary || {};
  var exam = body.exam || '';
  if (exam !== '12-GA-01' && exam !== '12-GA-02' && exam !== '12-GA-05') {
    return jsonOut_({ ok: false, error: 'unknown georgia exam' });
  }
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName('Georgia');
  if (!sheet) {
    sheet = ss.insertSheet('Georgia');
    sheet.appendRow(['sentAt', 'name', 'team', 'exam', 'track', 'answered', 'accuracy', 'readiness', 'weakest', 'report']);
  }
  sheet.appendRow([
    new Date(body.sentAt || Date.now()),
    String(body.name || ''),
    String(body.team || ''),
    exam,
    String(summary.track || ''),
    summary.answered || 0,
    summary.accuracy == null ? '' : summary.accuracy,
    summary.readiness == null ? '' : summary.readiness,
    String(summary.weakest || ''),
    String(body.report || '')
  ]);
  return jsonOut_({ ok: true, lead: '' });
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
