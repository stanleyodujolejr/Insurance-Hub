/* Insurance Hub progress sync + Sunday email.
   SETUP (once):
   1. Paste this whole file into Extensions > Apps Script of a new Google Sheet. Save.
   2. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone. Copy the /exec URL.
   3. In the editor, pick installWeekly in the function dropdown and press Run (approve the prompt).
      That schedules the Sunday 6pm email. Run weeklyDigest any time to get one now.
   The apps POST a JSON snapshot here; this keeps a full Log and a one-row-per-person Latest.
   TEAMS (v11): each other leader gets a row in the Teams tab: Code, Leader, Email. The Link
   column fills itself; send that link to the leader. Their recruits' reports carry the code,
   and on Sunday that leader is emailed only their own people. You get everyone.
   Adding a leader never needs a redeploy. People with no code are your own team. */

var SITE = 'https://stanleyodujolejr.github.io/Insurance-Hub/';
var TEAM_HEADERS = ['Code', 'Leader', 'Email', 'Link'];
var HEADERS = ['Received', 'Name', 'State', 'Team', 'Exam type', 'Answered', 'Accuracy %', 'Answered 7d',
  'Days studied', 'Last studied', 'Mastered', 'Learning', 'Struggling', 'Due now',
  'Mock exams', 'Last mock %', 'Best mock %', 'Weakest domain', 'Flashcards mastered',
  'Exam date', 'Days left', 'Readiness %', 'Needed per day', 'Sessions 7d', 'Coach connected',
  'Exam result', 'Exam score %', 'Exam taken', 'Readiness at exam', 'Report'];
var RESULT_HEADERS = ['Recorded', 'Name', 'State', 'Team', 'Exam type', 'Exam taken', 'Result', 'Score %',
  'Readiness at exam', 'Mock avg at exam', 'Answered at exam', 'Mastered at exam'];
var STALE_DAYS = 3;       // flag anyone who has not studied in this many days
var PASS = 70;

/* ------------------------------ receive ------------------------------ */
/* Rows are written BY HEADER NAME, and missing headers are appended to row 1,
   so adding a field never shifts or breaks a Sheet created by an older version. */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var p = JSON.parse(e.postData.contents);
    var name = String(p.name || '').trim().slice(0, 60);
    var st = String(p.state || '');
    if (!name || (st !== 'MD' && st !== 'VA' && st !== 'GA')) return out({ ok: false, error: 'bad payload' });
    var team = teamClean(p.team);
    var s = p.summary || {}, res = p.result || {};
    if (!(res.examTaken && (res.examResult === 'Passed' || res.examResult === 'Failed'))) res = {};   // only a real result counts
    var rec = {
      'Received': new Date(), 'Name': name, 'State': st, 'Team': team,
      'Exam type': String(s.track || '').slice(0, 30),
      'Answered': num(s.answered), 'Accuracy %': num(s.accuracy), 'Answered 7d': num(s.answered7d),
      'Days studied': num(s.daysStudied), 'Last studied': s.lastStudied ? new Date(s.lastStudied) : '',
      'Mastered': num(s.mastered), 'Learning': num(s.learning), 'Struggling': num(s.struggling),
      'Due now': num(s.due), 'Mock exams': num(s.mocks), 'Last mock %': num(s.lastMock),
      'Best mock %': num(s.bestMock), 'Weakest domain': String(s.weakest || '').slice(0, 120),
      'Flashcards mastered': num(s.cardsMastered),
      'Exam date': s.examDate ? String(s.examDate).slice(0, 10) : '', 'Days left': num(s.daysLeft),
      'Readiness %': num(s.readiness), 'Needed per day': num(s.perDay), 'Sessions 7d': num(s.sessions7d),
      'Coach connected': s.coach === true ? 'yes' : s.coach === false ? 'no' : '',
      'Exam result': res.examResult || '', 'Exam score %': num(res.examScore),
      'Exam taken': res.examTaken ? String(res.examTaken).slice(0, 10) : '', 'Readiness at exam': num(res.readinessAtExam),
      'Report': oneLine(p.report).slice(0, 20000)
    };
    var log = sheet('Log');
    log.appendRow(rowFor(log, rec));
    upsertLatest(rec);
    if (res.examResult) upsertResult(name, st, team, res);
    tidyRows();
    var t = team ? teamByCode(team) : null;
    return out({ ok: true, lead: t ? t.leader : '' });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return out({ ok: true, service: 'insurance-hub-sync' }); }

/* A line break inside a cell makes Sheets grow the row to fit it, and neither the Format menu
   nor a forced row height stopped it (2026-10-29). So no cell keeps a line break: the report is
   stored on one line with " | " between its lines. tidyRows() runs after every report and
   flattens any old multi-line cell; run it once by hand to fix the rows already there. */
var ROW_PX = 21;
function oneLine(s) { return String(s || '').replace(/\s*[\r\n]+\s*/g, ' | ').replace(/^ \| | \| $/g, ''); }
function tidyRows() {
  var fixed = 0;
  ['Log', 'Latest', 'Results'].forEach(function (n) {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n);
    if (!sh) return;
    var v = sh.getDataRange().getValues();
    var iState = v.length ? v[0].map(String).indexOf('State') : -1;
    for (var i = 1; i < v.length; i++) for (var j = 0; j < v[i].length; j++) {
      if (typeof v[i][j] === 'string' && /[\r\n]/.test(v[i][j])) {
        var flat = oneLine(v[i][j]);
        if (iState >= 0 && v[i][iState] === 'GA') flat = asText(flat);
        sh.getRange(i + 1, j + 1, 1, 1).setValues([[flat]]); fixed++;
      }
    }
    if (sh.setRowHeightsForced && v.length > 1) sh.setRowHeightsForced(2, v.length - 1, ROW_PX);
  });
  return 'Flattened ' + fixed + ' multi-line cell(s)';
}

function headerOf(sh, list) {
  list = list || HEADERS;
  var h = sh.getDataRange().getValues()[0].map(String);
  var missing = list.filter(function (k) { return h.indexOf(k) < 0; });
  if (missing.length) {
    sh.getRange(1, h.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
    h = h.concat(missing);
  }
  return h;
}
function rowFor(sh, rec) {
  var row = headerOf(sh).map(function (k) { return rec[k] === undefined ? '' : rec[k]; });
  if (rec['State'] !== 'GA') return row;
  return row.map(gaWrite);
}
/* Sheets treats a leading = + - @ tab or CR as a formula. Prefix those so the cell stays text.
   Maryland and Virginia rows return above and are written exactly as before.
   Georgia strings are flattened first. A value like =X, a line break, then Y becomes
   "=X | Y", which setValues would run as a formula unless asText prefixes it. */
function asText(v) {
  if (v instanceof Date || typeof v === 'number') return v;
  if (v === '' || v == null) return v === undefined ? '' : v;
  var s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) return "'" + s;
  return v;
}
function gaWrite(v) {
  if (typeof v !== 'string') return v;
  return asText(oneLine(v));
}
/* One row per person per exam date; re-sends update it instead of duplicating. */
function upsertResult(name, st, team, res) {
  var sh = sheet('Results', RESULT_HEADERS), h = headerOf(sh, RESULT_HEADERS);
  var taken = String(res.examTaken).slice(0, 10);
  var rec = { 'Recorded': new Date(), 'Name': name, 'State': st, 'Team': team, 'Exam type': String(res.examTrack || ''),
    'Exam taken': taken, 'Result': res.examResult, 'Score %': num(res.examScore),
    'Readiness at exam': num(res.readinessAtExam), 'Mock avg at exam': num(res.mockAvgAtExam),
    'Answered at exam': num(res.answeredAtExam), 'Mastered at exam': num(res.masteredAtExam) };
  var row = h.map(function (k) { return rec[k] === undefined ? '' : rec[k]; });
  if (st === 'GA') row = row.map(gaWrite);
  var vals = sh.getDataRange().getValues(), iN = h.indexOf('Name'), iS = h.indexOf('State'), iT = h.indexOf('Exam taken'), iG = h.indexOf('Team');
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][iN]).toLowerCase() === name.toLowerCase() && vals[i][iS] === st && dayKey(vals[i][iT]) === taken &&
        teamClean(vals[i][iG]) === team) {
      sh.getRange(i + 1, 1, 1, row.length).setValues([row]); return;
    }
  }
  sh.appendRow(row);
}
function dayKey(v) {
  if (v instanceof Date) return v.getFullYear() + '-' + ('0' + (v.getMonth() + 1)).slice(-2) + '-' + ('0' + v.getDate()).slice(-2);
  return String(v).slice(0, 10);
}

function upsertLatest(rec) {
  var sh = sheet('Latest');
  var row = rowFor(sh, rec), h = headerOf(sh);
  var iN = h.indexOf('Name'), iS = h.indexOf('State'), iG = h.indexOf('Team');
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][iN]).toLowerCase() === rec['Name'].toLowerCase() && vals[i][iS] === rec['State'] &&
        teamClean(vals[i][iG]) === rec['Team']) {
      sh.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return;
    }
  }
  sh.appendRow(row);
}

/* ---------------------------- Sunday email ---------------------------- */
function installWeekly() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'weeklyDigest') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('weeklyDigest').timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(18).create();
  return 'Scheduled: Sundays 6pm (' + Session.getScriptTimeZone() + ')';
}

/* You get everyone; each leader in the Teams tab gets only their own team. */
function weeklyDigest() {
  var now = new Date(), owner = Session.getEffectiveUser().getEmail();
  var d = buildDigest(now);
  MailApp.sendEmail({ to: owner, subject: d.subject, body: d.text, htmlBody: d.html });
  var sent = [d.subject];
  teams().forEach(function (t) {
    if (!t.email || t.email.toLowerCase() === String(owner).toLowerCase()) return;
    var td = buildDigest(now, t.code);
    MailApp.sendEmail({ to: t.email, subject: td.subject, body: td.text, htmlBody: td.html });
    sent.push(td.subject);
  });
  return sent.join('\n');
}

/* Pure: reads the sheets, returns {subject,text,html}. No team = the full digest for the owner;
   a team code = only that team's people, written for that leader. */
function buildDigest(now, team) {
  var forTeam = team !== undefined && team !== null;
  var tinfo = forTeam ? (teamByCode(team) || { code: team, leader: '', link: SITE + '?team=' + team }) : null;
  var latest = rows('Latest').filter(function (r) { return !forTeam || teamClean(r['Team']) === team; });
  var log = rows('Log');
  var weekAgo = now.getTime() - 6.5 * 86400000;
  var people = latest.map(function (r) {
    var base = null;   // newest Log row for this person that is at least ~a week old
    log.forEach(function (l) {
      if (sameWho(l, r) && time(l['Received']) <= weekAgo &&
          (!base || time(l['Received']) > time(base['Received']))) base = l;
    });
    var last = time(r['Last studied']);
    var idle = last ? Math.floor((now.getTime() - last) / 86400000) : null;
    var tc = teamClean(r['Team']), tl = (!forTeam && tc) ? teamByCode(tc) : null;
    var p = {
      who: r['Name'] + ' (' + r['State'] + (r['Exam type'] && r['Exam type'] !== 'Life & Health' ? ', ' + r['Exam type'] : '') +
        (!forTeam && tc ? ', ' + (tl && tl.leader ? tl.leader + "'s team" : 'team ' + tc + ' (not in the Teams tab)') : '') + ')',
      sessions: r['Sessions 7d'],
      answered: n(r['Answered']),
      weekAnswered: base ? n(r['Answered']) - n(base['Answered']) : n(r['Answered 7d']),
      mastered: n(r['Mastered']),
      weekMastered: base ? n(r['Mastered']) - n(base['Mastered']) : null,
      accuracy: r['Accuracy %'], readiness: r['Readiness %'],
      lastMock: r['Last mock %'], mocks: n(r['Mock exams']),
      weakest: r['Weakest domain'], examDate: fmtDate(r['Exam date']), daysLeft: r['Days left'],
      perDay: r['Needed per day'], coach: r['Coach connected'], idle: idle,
      synced: time(r['Received']),
      result: r['Exam result'], resultDate: fmtDate(r['Exam taken']), resultScore: r['Exam score %'],
      resultReady: r['Readiness at exam'], resultAge: r['Exam taken'] ? Math.floor((now.getTime() - time(r['Exam taken'])) / 86400000) : null
    };
    p.flags = [];
    if (idle === null) p.flags.push('has not studied yet');
    else if (idle >= STALE_DAYS) p.flags.push('no study in ' + idle + ' days');
    if (p.weekAnswered === 0 && idle !== null && idle < STALE_DAYS) p.flags.push('no new questions this week');
    if (isNum(p.daysLeft) && p.daysLeft <= 14 && isNum(p.readiness) && p.readiness < PASS)
      p.flags.push('exam in ' + p.daysLeft + ' days, readiness ' + p.readiness + '%');
    if (isNum(p.daysLeft) && p.daysLeft <= 14 && p.mocks === 0) p.flags.push('no mock exam taken yet');
    if (p.synced && now.getTime() - p.synced > 7 * 86400000) p.flags.push('app has not synced in over a week');
    if (p.result === 'Passed') p.flags = [];   // licensed now: no study nags
    p.news = (p.result && p.resultAge !== null && p.resultAge <= 7)
      ? (p.result === 'Passed' ? 'PASSED' : 'did not pass') + ' on ' + p.resultDate : '';
    return p;
  });

  var subject, title = 'Insurance Hub weekly' + (forTeam && tinfo.leader ? ' for ' + tinfo.leader + "'s team" : '');
  if (!people.length) subject = title + ': nobody has turned on auto-send yet';
  else subject = title + ': ' + people.map(function (p) {
    var nm = p.who.replace(/ \(.*/, '');
    if (p.news) return nm + ' ' + p.news.replace(/ on .*/, '');
    if (p.result === 'Passed') return nm + ' licensed';
    return nm + (p.flags.length ? ' needs a nudge' : ' +' + p.weekAnswered + ' questions');
  }).join(', ');

  var T = [], H = [];
  H.push('<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2933;max-width:640px">');
  H.push('<h2 style="margin:0 0 4px">' + esc(title) + '</h2>');
  H.push('<div style="color:#6b7684;margin-bottom:16px">' + fmtDate(now) + '. Read Readiness and Mastered, not raw accuracy.</div>');
  T.push(title.toUpperCase() + '  ' + fmtDate(now), '');
  if (!people.length) {
    var link = forTeam ? tinfo.link : SITE;
    T.push('No data yet. Send your recruits this link: ' + link, 'Then have them open the Review tab, find "Auto-send to your team lead", type their name and tap Turn on.');
    H.push('<p>No data yet. Send your recruits this link: <a href="' + esc(link) + '">' + esc(link) + '</a><br>Then have them open the <b>Review</b> tab, find <b>Auto-send to your team lead</b>, type their name and tap <b>Turn on</b>.</p>');
  }
  if (forTeam && people.length) {
    T.push('Your team link (send it to new recruits): ' + tinfo.link, '');
    H.push('<div style="color:#6b7684;margin-bottom:14px">Your team link for new recruits: <a href="' + esc(tinfo.link) + '">' + esc(tinfo.link) + '</a></div>');
  }
  var sb = scoreboard(forTeam ? team : null);
  if (sb) {
    T.push('EXAM RESULTS SO FAR', '  ' + sb, '');
    H.push('<div style="background:#eef6f2;border-radius:10px;padding:12px 16px;margin-bottom:14px"><b>Exam results so far</b><br>' + esc(sb) + '</div>');
  }
  people.forEach(function (p) {
    if (p.result) {
      var rl = ['Exam result', (p.result === 'Passed' ? 'PASSED' : 'Did not pass') + ' on ' + p.resultDate +
        (isNum(p.resultScore) ? ', scored ' + p.resultScore + '%' : '') + (isNum(p.resultReady) ? ' (readiness going in: ' + p.resultReady + '%)' : '')];
    }
    var lines = p.result ? [rl] : [];
    lines = lines.concat([
      ['This week', p.weekAnswered + ' questions answered' + (p.weekMastered !== null ? ', +' + p.weekMastered + ' mastered' : '')],
      ['Today sessions', isNum(p.sessions) ? p.sessions + ' of the last 7 days finished' : '-'],
      ['Last studied', p.idle === null ? 'never' : p.idle === 0 ? 'today' : p.idle + ' day' + (p.idle === 1 ? '' : 's') + ' ago'],
      ['Readiness', isNum(p.readiness) ? p.readiness + '% (pass is ' + PASS + '%)' : 'not enough data yet'],
      ['Mock exams', p.mocks ? p.mocks + ' taken, last ' + p.lastMock + '%' : 'none yet'],
      ['Exam date', p.examDate ? p.examDate + (isNum(p.daysLeft) ? ' (' + p.daysLeft + ' days left' + (isNum(p.perDay) ? ', needs ~' + p.perDay + '/day' : '') + ')' : '') : 'not set'],
      ['Weakest area', p.weakest || '-'],
      ['Totals', p.answered + ' answered, ' + p.mastered + ' mastered, accuracy ' + (isNum(p.accuracy) ? p.accuracy + '%' : '-')],
      ['Claude coach', p.coach === 'yes' ? 'connected' : p.coach === 'no' ? 'offline mode only' : '-']
    ]);
    T.push(p.who.toUpperCase());
    if (p.flags.length) T.push('  !! ' + p.flags.join('; '));
    lines.forEach(function (l) { T.push('  ' + l[0] + ': ' + l[1]); });
    T.push('');
    H.push('<div style="border:1px solid #e3e7ec;border-radius:10px;padding:14px 16px;margin-bottom:14px">');
    H.push('<div style="font-size:16px;font-weight:bold;margin-bottom:6px">' + esc(p.who) + '</div>');
    if (p.flags.length) H.push('<div style="background:#fdecec;color:#a32d2d;border-radius:6px;padding:7px 10px;margin-bottom:8px">' + esc(p.flags.join('; ')) + '</div>');
    H.push('<table style="border-collapse:collapse;font-size:13.5px">');
    lines.forEach(function (l) {
      H.push('<tr><td style="color:#6b7684;padding:3px 14px 3px 0;white-space:nowrap">' + l[0] + '</td><td style="padding:3px 0">' + esc(l[1]) + '</td></tr>');
    });
    H.push('</table></div>');
  });
  H.push('</div>');
  return { subject: subject, text: T.join('\n'), html: H.join('') };
}

/* Pass/fail counts with the average readiness each group had going in: the calibration. */
function scoreboard(team) {
  var r = rows('Results', RESULT_HEADERS).filter(function (x) { return team === null || team === undefined || teamClean(x['Team']) === team; });
  if (!r.length) return '';
  function grp(ok) {
    var g = r.filter(function (x) { return (x['Result'] === 'Passed') === ok; });
    var rd = g.filter(function (x) { return isNum(x['Readiness at exam']); });
    var avg = rd.length ? Math.round(rd.reduce(function (a, x) { return a + Number(x['Readiness at exam']); }, 0) / rd.length) : null;
    return { n: g.length, avg: avg };
  }
  var P = grp(true), F = grp(false);
  return P.n + ' passed' + (P.avg !== null ? ' (avg readiness going in ' + P.avg + '%)' : '') + ', ' +
    F.n + ' did not pass' + (F.avg !== null ? ' (avg readiness going in ' + F.avg + '%)' : '') + '.';
}

/* ------------------------------ helpers ------------------------------ */
function sheet(n, list) {
  list = list || HEADERS;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(n);
  if (!sh) {
    sh = ss.insertSheet(n);
    sh.appendRow(list);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, list.length).setFontWeight('bold');
  }
  return sh;
}
function rows(n, list) {
  var v = sheet(n, list).getDataRange().getValues(), h = v[0], out = [];
  for (var i = 1; i < v.length; i++) {
    var o = {};
    h.forEach(function (k, j) { o[k] = v[i][j]; });
    if (o['Name']) out.push(o);
  }
  return out;
}
function sameWho(a, b) {
  return String(a['Name']).toLowerCase() === String(b['Name']).toLowerCase() && a['State'] === b['State'] &&
    teamClean(a['Team']) === teamClean(b['Team']);
}
/* ------------------------------- teams ------------------------------- */
function teamClean(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30); }
/* Reads the Teams tab and fills any empty Link cell, so the sheet hands you the link to send. */
function teams() {
  var sh = sheet('Teams', TEAM_HEADERS), h = headerOf(sh, TEAM_HEADERS), v = sh.getDataRange().getValues(), list = [];
  var iC = h.indexOf('Code'), iL = h.indexOf('Leader'), iE = h.indexOf('Email'), iK = h.indexOf('Link');
  for (var i = 1; i < v.length; i++) {
    var code = teamClean(v[i][iC]); if (!code) continue;
    var link = SITE + '?team=' + code;
    if (String(v[i][iK] || '') !== link) sh.getRange(i + 1, iK + 1, 1, 1).setValues([[link]]);
    list.push({ code: code, leader: String(v[i][iL] || '').trim(), email: String(v[i][iE] || '').trim(), link: link });
  }
  return list;
}
function teamByCode(code) {
  var t = teams();
  for (var i = 0; i < t.length; i++) if (t[i].code === code) return t[i];
  return null;
}
function time(v) { if (!v) return 0; var t = (v instanceof Date) ? v.getTime() : new Date(v).getTime(); return isNaN(t) ? 0 : t; }
function n(v) { return isNum(v) ? Number(v) : 0; }
function isNum(v) { return v !== '' && v !== null && v !== undefined && !isNaN(Number(v)); }
function fmtDate(v) {
  if (!v) return '';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  var d = (v instanceof Date) ? v : new Date(v);
  return isNaN(d.getTime()) ? String(v) : Utilities.formatDate(d, Session.getScriptTimeZone(), 'EEE MMM d');
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function num(v) { return (v === null || v === undefined || v === '') ? '' : Number(v); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* Removes the editor and curl test rows: Name "=Sync test", State GA, Team test.
   Run this after the curl check. testGeorgiaRow calls it before returning. */
function cleanupGeorgiaTestRows() {
  var removed = 0;
  ['Log', 'Latest', 'Results'].forEach(function (n) {
    var sh = SpreadsheetApp.getActive().getSheetByName(n);
    if (!sh) return;
    var values = sh.getDataRange().getValues();
    if (!values.length) return;
    var headers = values[0].map(String);
    var iN = headers.indexOf('Name'), iS = headers.indexOf('State'), iG = headers.indexOf('Team');
    if (iN < 0 || iS < 0 || iG < 0) return;
    for (var i = values.length - 1; i >= 1; i--) {
      if (values[i][iN] === '=Sync test' && values[i][iS] === 'GA' && teamClean(values[i][iG]) === 'test') {
        sh.deleteRow(i + 1);
        removed++;
      }
    }
  });
  Logger.log('Removed ' + removed + ' Georgia test row(s) from Log, Latest, and Results.');
  return removed;
}

/* Editor-only check. Posts one Georgia row through doPost, checks Latest, then deletes
   that row from Log, Latest, and Results. The web app deployment is not involved. */
function testGeorgiaRow() {
  var removed = 0;
  try {
    var payload = {
      name: '=Sync test', state: 'GA', team: 'test', sentAt: Date.now(),
      summary: { track: 'Life 12-GA-01', answered: 1, accuracy: 100, readiness: 70, weakest: '' },
      result: {}, report: '=X\nY'
    };
    var sent = doPost({ postData: { contents: JSON.stringify(payload) } });
    var parsed = JSON.parse(sent.getContent());
    if (!parsed.ok) throw new Error('doPost rejected the Georgia test row: ' + sent.getContent());
    var sh = SpreadsheetApp.getActive().getSheetByName('Latest');
    if (!sh) throw new Error('Latest tab is missing');
    var values = sh.getDataRange().getValues();
    var headers = values[0].map(String);
    var iN = headers.indexOf('Name'), iS = headers.indexOf('State'), iE = headers.indexOf('Exam type'), iR = headers.indexOf('Report');
    if (iN < 0 || iS < 0 || iR < 0) throw new Error('Latest is missing Name, State, or Report');
    var found = 0;
    for (var i = 1; i < values.length; i++) {
      if (values[i][iN] === '=Sync test' && values[i][iS] === 'GA') found = i + 1;
    }
    if (!found) throw new Error('Georgia test row not on Latest');
    if (sh.getRange(found, iN + 1).getFormula() !== '') throw new Error('name cell was stored as a formula');
    if (iE >= 0 && values[found - 1][iE] !== 'Life 12-GA-01') throw new Error('exam type: ' + values[found - 1][iE]);
    if (values[found - 1][iR] !== '=X | Y') throw new Error('report was not stored as text: ' + values[found - 1][iR]);
    if (sh.getRange(found, iR + 1).getFormula() !== '') throw new Error('report cell was stored as a formula');
  } finally {
    removed = cleanupGeorgiaTestRows();
  }
  if (removed < 2) throw new Error('expected Log and Latest test rows to be removed, removed ' + removed);
  if (cleanupGeorgiaTestRows() !== 0) throw new Error('Georgia test rows remained after cleanup');
  Logger.log('Georgia test row checked and removed.');
}
