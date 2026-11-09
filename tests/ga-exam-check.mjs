/**
 * Repeatable checks for the Georgia exam page. No network. No browser.
 * Run: node tests/ga-exam-check.mjs
 */
import fs from 'fs';
import vm from 'vm';
import assert from 'assert';

const root = new URL('..', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const gaHtml = read('GA_Exam_Prep.html');
const indexHtml = read('index.html');
const mdHtml = read('MD_Exam_Prep.html');
const vaHtml = read('VA_Exam_Prep.html');

function scriptsOf(html) {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}
for (const [name, html] of [['GA', gaHtml], ['index', indexHtml]]) {
  scriptsOf(html).forEach((src, i) => {
    new vm.Script(src, { filename: `${name}-${i}.js` });
  });
}

assert.equal(gaHtml.includes('script.google.com'), true);
assert.equal(gaHtml.includes("const SK='ga_exam_v1'"), true);
assert.equal(gaHtml.includes("var COACH_STATE='GA'"), true);
assert.equal(gaHtml.includes('ihub_coach_apikey_GA'), true);
assert.match(gaHtml, /ihub_coach_log_'\+COACH_STATE/);
assert.equal(gaHtml.includes("COACH_LS_KEY='ihub_coach_apikey',"), false);
assert.equal(gaHtml.includes('md_exam_v2'), false);
assert.equal(gaHtml.includes('va_exam_v5'), false);
assert.equal(gaHtml.includes("COACH_STATE='MD'"), false);
assert.equal(gaHtml.includes("COACH_STATE='VA'"), false);
assert.equal(gaHtml.includes('Maryland Life'), false);
assert.equal(gaHtml.includes('Prometric'), false);
assert.match(gaHtml, /Georgia Life, Accident & Sickness practice \(GA Exam Prep\)/);
assert.match(gaHtml, /Life, Accident &amp; Sickness combo/);
assert.equal(gaHtml.includes("'>Life &amp; Health</option>'"), false);
assert.equal(gaHtml.includes('GA_SYNC_OFF'), false);
assert.match(gaHtml, /var GA_SYNC_LIVE=true;/);
assert.equal(gaHtml.includes('Only the numbers in this report are sent'), false);
assert.match(gaHtml, /Your name and your progress report are sent/);
assert.match(gaHtml, /Team sending isn\\'t switched on yet/);
const mdSyncUrl = mdHtml.match(/var IHUB_SYNC_URL='([^']+)'/)[1];
assert.equal(gaHtml.includes(mdSyncUrl), true);
assert.match(indexHtml, /href="GA_Exam_Prep\.html"/);
assert.match(indexHtml, /ihub_team/);
assert.match(mdHtml, /const SK='md_exam_v2'/);
assert.match(vaHtml, /const SK='va_exam_v5'/);
assert.match(mdHtml, /var COACH_STATE='MD'/);
assert.match(vaHtml, /var COACH_STATE='VA'/);

function boot(search) {
  let html = gaHtml.replace(
    'boot();',
    'globalThis.__bank=BANK; globalThis.__outline=OUTLINE_WEIGHTS.slice(); globalThis.__tracks=TRACK_DEFS; globalThis.__lh=TRACK_LH; globalThis.__groups=TOPIC_GROUPS; globalThis.__gaTopics=GA_TOPICS; globalThis.__final=function(){return finalState;}; globalThis.__state=function(){return state;}; boot();'
  );
  const scripts = scriptsOf(html);
  function el(id) {
    return {
      style: {}, dataset: {}, className: '', innerHTML: '', textContent: '',
      value: (id === 'rev-topic' || id === 'rev-result') ? '' : '10', hidden: false,
      classList: { toggle() {}, add() {}, remove() {}, contains() { return false } },
      addEventListener() {}, appendChild(c) { return c; }, removeChild() {},
      setAttribute() {}, getAttribute() { return ''; }, focus() {},
      querySelector() { return el(); }, querySelectorAll() { return []; },
      parentNode: { removeChild() {} }
    };
  }
  const store = {};
  const localStorage = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };
  let fetches = 0;
  const els = {};
  const sandbox = {
    console, localStorage, document: {
      getElementById(id) { if (!els[id]) els[id] = el(id); return els[id]; }, querySelector() { return el(); }, querySelectorAll() { return []; },
      addEventListener() {}, createElement() { return el(); },
      documentElement: { setAttribute() {}, getAttribute() { return null; } },
      body: el(), readyState: 'complete'
    },
    navigator: { sendBeacon() { fetches += 1; throw new Error('beacon'); } },
    location: { search },
    fetch() { fetches += 1; throw new Error('fetch'); },
    setTimeout() { return 0; }, clearTimeout() {}, clearInterval() {}, setInterval() { return 0; },
    confirm() { return false; }, alert() {},
    URLSearchParams, Blob, Date, Math, JSON, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, encodeURIComponent, decodeURIComponent,
    addEventListener() {}, removeEventListener() {}, scrollTo() {}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const src of scripts) vm.runInContext(src, sandbox, { filename: 'GA_Exam_Prep.html' });
  sandbox.__fetches = () => fetches;
  sandbox.__store = store;
  return sandbox;
}

const page = boot('?team=qa-team');
assert.equal(page.COACH_STATE, 'GA');
assert.equal(page.GA_SYNC_OFF, undefined);
assert.equal(page.GA_SYNC_LIVE, true);
assert.equal(page.IHUB_SYNC_URL, mdSyncUrl);
assert.equal(page.__bank.length, 559);
assert.equal(page.__fetches(), 0);
page.syncSend(true);
page.syncBeacon();
assert.equal(page.__fetches(), 0, 'Georgia sync must not post before opt-in');
page.syncPaint();
const syncBox = page.document.getElementById('sync-box').innerHTML;
assert.match(syncBox, /Auto-send to your team lead/);
assert.match(syncBox, /Turn on/);
assert.equal(/isn't switched on yet/.test(syncBox), false);

let posted = null;
let beacons = 0;
page.fetch = function (url, opts) {
  posted = { url, body: opts.body };
  return Promise.resolve({ json() { return Promise.resolve({ ok: true, lead: 'Lead' }); } });
};
page.navigator.sendBeacon = function () { beacons += 1; return true; };
page.syncPut({ on: true, name: 'Ada', tried: 0 });
assert.ok(page.__store.ihub_sync_GA);
assert.equal(page.__store.ihub_sync_MD, undefined);
assert.equal(page.__store.ihub_sync_VA, undefined);
page.localStorage.setItem('ihub_track_GA', 'life');
page.trackApply();
page.syncSend(true);
assert.equal(posted.url, mdSyncUrl);
let payload = JSON.parse(posted.body);
assert.equal(payload.state, 'GA');
assert.equal(payload.exam, '12-GA-01');
assert.equal(payload.summary.track, 'Life 12-GA-01');
page.localStorage.setItem('ihub_track_GA', 'health');
page.trackApply();
page.syncSend(true);
payload = JSON.parse(posted.body);
assert.equal(payload.exam, '12-GA-02');
assert.equal(payload.summary.track, 'A&S 12-GA-02');
page.localStorage.setItem('ihub_track_GA', 'lh');
page.trackApply();
page.syncSend(true);
payload = JSON.parse(posted.body);
assert.equal(payload.exam, '12-GA-05');
assert.equal(payload.summary.track, 'Combo 12-GA-05');
page.syncBeacon();
assert.equal(beacons, 1);
posted = null;
beacons = 0;
page.GA_SYNC_LIVE = false;
page.syncSend(true);
page.syncBeacon();
assert.equal(posted, null);
assert.equal(beacons, 0);

const report = page.progReportText();
assert.match(report, /Georgia Life, Accident & Sickness practice/);
assert.match(report, /Team code: qa-team/);
assert.equal(/Maryland/.test(report), false);

page.save();
assert.ok(page.__store.ga_exam_v1, 'progress key');
assert.equal(page.__store.md_exam_v2, undefined);
assert.equal(page.__store.va_exam_v5, undefined);
assert.equal(page.__store.ihub_team, 'qa-team');
for (const key of Object.keys(page.__store)) {
  assert.equal(/md_exam|va_exam|ihub_sync_MD|ihub_sync_VA|ihub_plan_MD|ihub_plan_VA/.test(key), false, key);
}

const leak = /maryland|virginia|\bCOMAR\b|Title 38\.2|14 VAC/i;
for (const q of page.__bank) {
  const text = [q.question, q.explanation, ...Object.values(q.options)].join(' ');
  assert.equal(leak.test(text), false, q.question.slice(0, 80));
  assert.equal(q.provenance === 'reused-national-screened' || q.provenance === 'original-georgia', true);
  assert.ok(q.options.A && q.options.B && q.options.C && q.options.D);
  assert.ok('ABCD'.includes(q.correct));
}
const originals = page.__bank.filter((q) => q.provenance === 'original-georgia');
assert.equal(originals.length, 72);
assert.ok(originals.filter((q) => q.topic.startsWith('Georgia laws common')).length >= 27);
assert.ok(originals.filter((q) => q.topic.startsWith('Georgia rules for life')).length >= 7);
assert.ok(originals.filter((q) => q.topic.startsWith('Georgia rules for accident')).length >= 7);

function draw(weight, length) {
  if (!weight) return 0;
  return Math.max(1, Math.round(length * weight));
}
function pool(topics) {
  return page.__bank.filter((q) => topics.includes(q.topic)).length;
}
function checkTrack(def, length) {
  let sum = 0;
  for (const d of def.domains) {
    sum += d.weight;
    const n = draw(d.weight, length);
    const have = pool(d.topics);
    assert.ok(have >= n, `${def.label} ${d.name} draws ${n} from ${have}`);
  }
  assert.ok(Math.abs(sum - 1) < 1e-9, def.label + ' weights ' + sum);
}
checkTrack(page.__tracks.GA.life, 90);
checkTrack(page.__tracks.GA.health, 90);
checkTrack({ label: 'combo', domains: page.__outline }, 135);
assert.equal(page.__tracks.GA.life.items, 90);
assert.equal(page.__tracks.GA.life.minutes, 120);
assert.equal(page.__tracks.GA.health.items, 90);
assert.equal(page.__tracks.GA.health.minutes, 120);
assert.equal(page.__lh.items, 135);
assert.equal(page.__lh.minutes, 150);
assert.equal(Object.keys(page.__tracks).join(), 'GA');
assert.deepEqual(page.__gaTopics, page.__groups[2].topics.map((t) => t.label));
assert.equal(page.__gaTopics.length, 3);

page.setMode('ga');
const laws = page.getTopics();
assert.deepEqual(laws, page.__gaTopics);
for (const topic of laws) assert.match(topic, /^Georgia /);

page.localStorage.setItem('ihub_track_GA', 'life');
page.trackApply();
const lifeLaws = page.getTopics();
assert.equal(lifeLaws.includes('Georgia rules for accident and sickness only'), false);
assert.equal(lifeLaws.includes('Georgia rules for life insurance only'), true);
assert.equal(lifeLaws.every((t) => t.startsWith('Georgia ')), true);

page.localStorage.setItem('ihub_track_GA', 'health');
page.trackApply();
const healthLaws = page.getTopics();
assert.equal(healthLaws.includes('Georgia rules for life insurance only'), false);
assert.equal(healthLaws.includes('Georgia rules for accident and sickness only'), true);

page.setMode('random');
page.localStorage.setItem('ihub_track_GA', 'lh');
page.trackApply();
const mixed = page.getTopics();
assert.ok(mixed.includes('Life: types of policies and annuities'));
assert.ok(mixed.includes('Accident and sickness: types of policies'));
assert.equal(mixed.includes('Georgia rules for life insurance only'), true);

for (const mode of ['random', 'topic', 'weak', 'ga', 'srs', 'cards']) page.setMode(mode);
for (const tab of ['practice', 'review', 'final']) page.switchTab(tab);
page.generateQuestions();
page.startFinalExam(135);
assert.equal(page.__final().questions.length, 135);
assert.equal(page.__final().duration, 150);
page.startFinalExam(75);
assert.equal(page.__final().questions.length, Math.round(135 / 2));
page.localStorage.setItem('ihub_track_GA', 'life');
page.trackApply();
page.startFinalExam(135);
assert.equal(page.__final().questions.length, 90);
assert.equal(page.__final().duration, 120);
page.localStorage.setItem('ihub_track_GA', 'health');
page.trackApply();
page.startFinalExam(75);
assert.equal(page.__final().questions.length, 45);
assert.equal(page.__final().duration, 60);

const fresh = boot('');
fresh.save();
assert.notEqual(fresh.__store, page.__store);
assert.ok(fresh.__store.ga_exam_v1);
assert.equal(fresh.__store.md_exam_v2, undefined);
assert.equal(fresh.__store.ihub_team, undefined);
assert.equal(/Team code/.test(fresh.progReportText()), false);
assert.equal(fresh.__fetches(), 0);

function assertSitting(label, track, startLen, expectLen) {
  page.localStorage.setItem('ihub_track_GA', track);
  page.trackApply();
  page.startFinalExam(startLen);
  const qs = page.__final().questions;
  assert.equal(qs.length, expectLen, label + ' length');
  const seen = {};
  qs.forEach((q) => {
    assert.notEqual(q._dn, 'Mixed', label + ' mixed');
    assert.ok(q._dn, label + ' category');
    assert.equal(seen[q.question], undefined, label + ' duplicate');
    seen[q.question] = 1;
  });
}
assertSitting('life', 'life', 90, 90);
assertSitting('health', 'health', 90, 90);
assertSitting('combo', 'lh', 135, 135);

page.localStorage.setItem('ihub_track_GA', 'life');
page.trackApply();
page.__state().reviewHistory.push({
  topic: 'Georgia laws common to life and accident and sickness',
  question: 'Sample <b>question</b>',
  options: { A: 'a', B: 'b', C: 'c', D: 'd' },
  correct: 'A', userAnswer: 'A', isCorrect: true, explanation: 'because'
});
const pdfText = [];
let pdfName = '';
page.jspdf = { jsPDF: function () {
  return {
    internal: { getNumberOfPages() { return 1; } },
    setFontSize() {}, setFont() {}, setTextColor() {}, setFillColor() {}, setDrawColor() {},
    rect() {}, line() {}, addPage() {}, setPage() {},
    splitTextToSize(s) { return [String(s)]; },
    text(s) { pdfText.push(String(s)); },
    save(name) { pdfName = name; }
  };
}};
page.exportPDF();
assert.equal(pdfName, 'GA_Exam_Prep_Review.pdf');
assert.match(pdfText[0], /GA Exam Prep — Life only/);
assert.equal(/Maryland/.test(pdfText.join(' ')), false);

page.renderReview();
assert.match(page.document.getElementById('review-container').innerHTML, /&lt;b&gt;/);

for (const q of page.__bank) {
  assert.ok('ABCD'.includes(q.correct), q.question.slice(0, 40));
  const texts = ['A', 'B', 'C', 'D'].map((k) => q.options[k]);
  assert.equal(new Set(texts).size, 4, q.question.slice(0, 60));
}
const deductible = page.__bank.find((q) => q.question.startsWith('A health plan has a $1,500 individual deductible'));
assert.equal(deductible.correct, 'C');
assert.equal(deductible.options.C, '$3,200');
const keyPerson = page.__bank.find((q) => q.question.includes('pays the business if an owner or partner'));
assert.equal(keyPerson.correct, 'A');
assert.match(keyPerson.options.A, /Key person disability/);
const chapter30 = page.__bank.find((q) => q.question.includes('end of Chapter 33-30'));
assert.equal(chapter30.correct, 'A');
assert.match(chapter30.options.A, /33-30-28 and 33-30-29 have no enacted text/);
assert.equal(page.__bank.length, 559);

assert.equal(/length:\s*140|__finalLen=140|\|\|140|140 q/.test(gaHtml), false);
assert.match(gaHtml, /Half-length practice exam/);
assert.match(gaHtml, /Full-length exam \(timed like the real test\)/);
function labelsFor(track) {
  page.localStorage.setItem('ihub_track_GA', track);
  page.trackApply();
  page.trackFinalLabels();
  return {
    full: page.document.getElementById('final-150').innerHTML,
    half: page.document.getElementById('final-75').innerHTML
  };
}
const lifeLabels = labelsFor('life');
const healthLabels = labelsFor('health');
const comboLabels = labelsFor('lh');
assert.equal(lifeLabels.full, 'Full practice sim (90 q &middot; 120 min)');
assert.equal(lifeLabels.half, 'Shorter practice (45 q &middot; 60 min)');
assert.equal(healthLabels.full, lifeLabels.full);
assert.equal(healthLabels.half, lifeLabels.half);
assert.equal(comboLabels.full, 'Full practice sim (135 q &middot; 150 min)');
assert.equal(comboLabels.half, 'Shorter practice (68 q &middot; 76 min)');
labelsFor('life');
assert.equal(page.document.getElementById('final-150').innerHTML, lifeLabels.full);

const gs = read('apps-script/live/user_progress.gs');
const clasp = JSON.parse(read('apps-script/live/.clasp.json'));
assert.equal(clasp.scriptId, '1lmwo8X8yWRHlt3xlIQVq_pfODLmXAktrmhGusopHLvcerdJGPLI7N3bk');
assert.equal(clasp.rootDir, '.');
assert.match(gs, /st !== 'MD' && st !== 'VA' && st !== 'GA'/);
assert.match(gs, /if \(rec\['State'\] !== 'GA'\) return row;/);
assert.match(gs, /return row\.map\(gaWrite\);/);
assert.match(gs, /if \(st === 'GA'\) row = row\.map\(gaWrite\);/);
assert.match(gs, /if \(iState >= 0 && v\[i\]\[iState\] === 'GA'\) flat = asText\(flat\);/);
assert.match(gs, /function cleanupGeorgiaTestRows/);
assert.match(gs, /removed = cleanupGeorgiaTestRows\(\)/);
assert.match(gs, /values\[i\]\[iN\] === '=Sync test'/);
assert.match(gs, /getFormula\(\) !== ''/);
assert.equal(gs.includes("insertSheet('Georgia')"), false);
assert.equal(gs.includes('function handleGeorgia_'), false);
assert.equal(gs.includes('GA_SYNC_PROPOSED'), false);
const cellFn = gs.slice(gs.indexOf('function oneLine'), gs.indexOf('function tidyRows'))
  + gs.slice(gs.indexOf('function asText'), gs.indexOf('/* One row per person per exam date'));
const cellBox = { String, Object, Date };
vm.runInNewContext(cellFn + '\nthis.asText=asText; this.gaWrite=gaWrite; this.oneLine=oneLine;', cellBox);
assert.equal(cellBox.asText('=cmd'), "'=cmd");
assert.equal(cellBox.asText('+1'), "'+1");
assert.equal(cellBox.asText('-1'), "'-1");
assert.equal(cellBox.asText('@sum'), "'@sum");
assert.equal(cellBox.asText('\t1'), "'\t1");
assert.equal(cellBox.asText('\r1'), "'\r1");
assert.equal(cellBox.asText('Ada'), 'Ada');
assert.equal(cellBox.asText(3), 3);
assert.equal(cellBox.asText(''), '');
assert.equal(cellBox.gaWrite('=X\nY'), "'=X | Y");
assert.equal(cellBox.gaWrite('Ada\nBee'), 'Ada | Bee');
assert.equal(cellBox.gaWrite(3), 3);
assert.equal(cellBox.oneLine('=X\nY'), '=X | Y');

console.log('ga-exam-check: ok', page.__bank.length, 'questions');
