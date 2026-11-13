/**
 * Maryland and Virginia exam-page checks. No network. No browser.
 * Run: node tests/md-va-exam-check.mjs
 * Also invoked at the end of tests/ga-exam-check.mjs.
 */
import fs from 'fs';
import vm from 'vm';
import assert from 'assert';

const root = new URL('..', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const mdHtml = read('MD_Exam_Prep.html');
const vaHtml = read('VA_Exam_Prep.html');

function scriptsOf(html) {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}
for (const [name, html] of [['MD', mdHtml], ['VA', vaHtml]]) {
  scriptsOf(html).forEach((src, i) => {
    new vm.Script(src, { filename: `${name}-${i}.js` });
  });
  assert.equal(html.includes('maximum-scale'), false, name + ' viewport');
  assert.equal(html.includes('apps-script/live'), false);
}

function boot(html, stateCode) {
  const hooked = html.replace(
    'boot();',
    'globalThis.__bank=BANK; globalThis.__outline=function(){return OUTLINE_WEIGHTS.map(function(d){return Object.assign({},d,{topics:d.topics.slice()});});}; globalThis.__tracks=TRACK_DEFS; globalThis.__lh=TRACK_LH; globalThis.__final=function(){return finalState;}; globalThis.__seen=function(){return state.seenIds;}; globalThis.__hist=function(){return state.reviewHistory;}; boot();'
  );
  const scripts = scriptsOf(hooked);
  function el(id) {
    return {
      style: {}, dataset: {}, className: '', innerHTML: '', textContent: '',
      value: (id === 'rev-topic' || id === 'rev-result') ? '' : '10', hidden: false,
      classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
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
  const els = {};
  const sandbox = {
    console, localStorage,
    document: {
      getElementById(id) { if (!els[id]) els[id] = el(id); return els[id]; },
      querySelector() { return el(); }, querySelectorAll() { return []; },
      addEventListener() {}, createElement() { return el(); },
      documentElement: { setAttribute() {}, getAttribute() { return null; } },
      body: el(), readyState: 'complete'
    },
    navigator: { sendBeacon() { return false; } },
    location: { search: '' },
    fetch() { throw new Error('fetch'); },
    setTimeout() { return 0; }, clearTimeout() {}, clearInterval() {}, setInterval() { return 0; },
    confirm() { return false; }, alert() {},
    URLSearchParams, Blob, Date, Math, JSON, Object, Array, String, Number, RegExp,
    parseInt, parseFloat, isNaN, encodeURIComponent, decodeURIComponent,
    addEventListener() {}, removeEventListener() {}, scrollTo() {}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const src of scripts) vm.runInContext(src, sandbox, { filename: stateCode + '_Exam_Prep.html' });
  sandbox.__store = store;
  assert.equal(sandbox.COACH_STATE, stateCode);
  return sandbox;
}

function sumItems(domains) {
  return domains.filter((d) => d.weight).reduce((s, d) => s + d.items, 0);
}
function sumWeights(domains) {
  return domains.filter((d) => d.weight).reduce((s, d) => s + d.weight, 0);
}
function topicsOf(domains) {
  const seen = {};
  domains.forEach((d) => {
    if (!d.weight) return;
    d.topics.forEach((t) => {
      assert.equal(seen[t], undefined, 'topic on two weighted sections: ' + t);
      seen[t] = d.key;
    });
  });
  return seen;
}
function poolSize(bank, topics) {
  return bank.filter((q) => topics.includes(q.topic)).length;
}

const gaLeak = /\bO\.C\.G\.A\b|12-GA-|Georgia law|Georgia Insurance Code|Pearson VUE Georgia/i;
const prelicenseRequired = /must (still )?(finish|complete)[^.]{0,80}pre-licen|requires \d+ hours of pre-licen|complete approved pre-licensing|pre-licensing education requirement before/i;

function checkBank(bank, label) {
  const stems = new Map();
  const ids = new Set();
  for (const q of bank) {
    assert.ok(q.question && q.explanation && q.explanation.length > 20, label + ' ' + q.question);
    assert.ok(q.options && q.options.A && q.options.B && q.options.C && q.options.D, q.question);
    assert.equal(Object.keys(q.options).length, 4, q.question);
    assert.equal(new Set(['A', 'B', 'C', 'D'].map((k) => q.options[k])).size, 4, q.question.slice(0, 60));
    assert.ok('ABCD'.includes(q.correct) && q.correct.length === 1, q.question.slice(0, 40));
    const blob = [q.question, q.explanation, ...Object.values(q.options)].join('\n');
    assert.equal(gaLeak.test(blob), false, q.question.slice(0, 80));
    assert.equal(stems.has(q.question), false, 'duplicate stem ' + q.question.slice(0, 80));
    stems.set(q.question, 1);
    const id = q.question.slice(0, 48);
    ids.add(id);
  }
  return ids;
}

function checkQids(page) {
  const seen = new Map();
  for (const q of page.__bank) {
    const id = page.qid(q);
    assert.equal(seen.has(id), false, id);
    seen.set(id, q.question);
    const base = q.question.slice(0, 48);
    const n = page.__bank.filter((x) => x.question.slice(0, 48) === base).length;
    if (n === 1) assert.equal(id, base, q.question.slice(0, 40));
    else assert.notEqual(id, base);
  }
}

function domainCounts(qs) {
  const by = {};
  qs.filter((q) => !q._unscored).forEach((q) => { by[q._dk] = (by[q._dk] || 0) + 1; });
  return by;
}

function assertFull(page, startLen, scored, unscored, minutes, domains) {
  page.startFinalExam(startLen);
  const st = page.__final();
  const qs = st.questions;
  assert.equal(qs.filter((q) => !q._unscored).length, scored);
  assert.equal(qs.filter((q) => q._unscored).length, unscored);
  assert.equal(qs.length, scored + unscored);
  assert.equal(st.duration, minutes);
  assert.equal(st.length, scored + unscored);
  const stems = new Set();
  qs.forEach((q) => {
    assert.equal(stems.has(q.question), false, q.question.slice(0, 60));
    stems.add(q.question);
    assert.equal(typeof q._unscored, 'boolean');
    assert.ok(Array.isArray(q._order) && q._order.length === 4);
  });
  const by = domainCounts(qs);
  domains.filter((d) => d.weight).forEach((d) => {
    assert.equal(by[d.key], d.items, d.name);
  });
  const html = page.document.getElementById('final-questions').innerHTML;
  assert.equal((html.match(/class="qcard"/g) || []).length, 1);
  assert.equal(/Unscored practice item/.test(html), false);
  assert.match(html, /Flag for review/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /aria-current="true"/);
  assert.match(html, /id="final-qtext"/);
  assert.match(html, /id="final-prev"/);
  assert.match(html, /id="final-next"/);
  assert.match(html, /data-jump=/);
}

function assertHalf(page, domains, scored, unscored, minutes) {
  page.startFinalExam(75);
  const st = page.__final();
  const scoredQs = st.questions.filter((q) => !q._unscored);
  assert.equal(scoredQs.length, scored);
  assert.equal(st.questions.filter((q) => q._unscored).length, unscored);
  assert.equal(st.duration, minutes);
  const by = domainCounts(st.questions);
  const totalItems = sumItems(domains);
  let got = 0;
  domains.filter((d) => d.weight).forEach((d) => {
    const exact = scored * d.items / totalItems;
    const n = by[d.key] || 0;
    assert.ok(n === Math.floor(exact) || n === Math.ceil(exact), d.name + ' ' + n + ' vs ' + exact);
    got += n;
  });
  assert.equal(got, scored);
  const stems = new Set();
  st.questions.forEach((q) => {
    assert.equal(stems.has(q.question), false);
    stems.add(q.question);
  });
}

function grade(page, startLen, wantCorrect) {
  page.startFinalExam(startLen);
  const st = page.__final();
  let seen = 0;
  st.questions.forEach((q, i) => {
    if (q._unscored) {
      st.answers[i] = q.correct === 'A' ? 'B' : 'A';
      return;
    }
    const ok = seen < wantCorrect;
    seen += 1;
    st.answers[i] = ok ? q.correct : (q.correct === 'A' ? 'B' : 'A');
  });
  page.submitFinalExam(true);
  return page.document.getElementById('final-results').innerHTML;
}

function checkTrackPools(bank, def) {
  const covered = new Set();
  let weight = 0;
  let items = 0;
  def.domains.forEach((d) => {
    weight += d.weight;
    items += d.items;
    const have = poolSize(bank, d.topics);
    assert.ok(have >= d.items, def.label + ' ' + d.name + ' draws ' + d.items + ' from ' + have);
    d.topics.forEach((t) => {
      assert.equal(covered.has(t), false, def.label + ' overlap ' + t);
      covered.add(t);
    });
  });
  assert.ok(Math.abs(weight - 1) < 1e-9, def.label + ' weights ' + weight);
  assert.equal(items, def.scored, def.label + ' scored');
  const inTrack = bank.filter((q) => covered.has(q.topic)).length;
  assert.ok(inTrack >= def.scored + def.unscored, def.label + ' bank ' + inTrack);
}

const md = boot(mdHtml, 'MD');
const va = boot(vaHtml, 'VA');

assert.equal(md.__bank.length, 296);
assert.equal(va.__bank.length, 367);
checkBank(md.__bank, 'MD');
checkBank(va.__bank, 'VA');
checkQids(md);
checkQids(va);

for (const q of md.__bank) {
  const correctText = q.options[q.correct] + '\n' + q.explanation;
  assert.equal(/\bPSI\b/.test(correctText), false, q.question.slice(0, 70));
  assert.equal(/scores are valid|valid for 1 year/i.test(q.explanation), false, q.question.slice(0, 70));
  assert.equal(prelicenseRequired.test(correctText), false, q.question.slice(0, 80));
}
const vendor = md.__bank.find((q) => q.question.startsWith('Maryland uses which testing provider'));
assert.equal(vendor.correct, 'A');
assert.equal(vendor.options.A, 'Prometric');
assert.match(vendor.options.C, /PSI/);

const mdOutline = md.__outline();
assert.equal(sumItems(mdOutline), 130);
assert.ok(Math.abs(sumWeights(mdOutline) - 1) < 1e-9);
assert.equal(mdOutline.some((d) => !d.weight || d.key === 'S'), false);
topicsOf(mdOutline);
mdOutline.forEach((d) => {
  if (!d.weight) return;
  assert.ok(poolSize(md.__bank, d.topics) >= d.items, d.name);
});
assert.equal(md.__lh.scored, 130);
assert.equal(md.__lh.unscored, 10);
assert.equal(md.__lh.minutes, 150);
checkTrackPools(md.__bank, md.__tracks.MD.life);
checkTrackPools(md.__bank, md.__tracks.MD.health);
assert.equal(md.__tracks.MD.life.scored, 80);
assert.equal(md.__tracks.MD.life.unscored, 10);
assert.equal(md.__tracks.MD.life.minutes, 105);
assert.equal(md.__tracks.MD.health.minutes, 105);

for (let n = 0; n < 3; n++) assertFull(md, 140, 130, 10, 150, mdOutline);
assertHalf(md, mdOutline, 65, 5, 75);
md.localStorage.setItem('ihub_track_MD', 'life');
md.trackApply();
for (let n = 0; n < 2; n++) assertFull(md, 140, 80, 10, 105, md.__outline());
assertHalf(md, md.__outline(), 40, 5, 53);
md.localStorage.setItem('ihub_track_MD', 'health');
md.trackApply();
assertFull(md, 140, 80, 10, 105, md.__outline());
assertHalf(md, md.__outline(), 40, 5, 53);
md.localStorage.setItem('ihub_track_MD', 'lh');
md.trackApply();

let html = grade(md, 140, 90);
assert.match(html, /Below 70%/);
assert.match(html, /90 of 130 scored/);
assert.match(html, /10 unscored practice/);
html = grade(md, 140, 91);
assert.match(html, /PASS \(70% of scored items\)/);
assert.match(html, /91 of 130 scored/);
assert.doesNotMatch(html, /91 of 140/);

md.trackFinalLabels();
assert.equal(md.document.getElementById('final-150').innerHTML, 'Real exam (130 scored + 10 unscored &middot; 150 min)');
assert.equal(md.document.getElementById('final-75').innerHTML, 'Half (65 scored + 5 unscored &middot; 75 min)');
md.localStorage.setItem('ihub_track_MD', 'life');
md.trackApply();
md.trackFinalLabels();
assert.equal(md.document.getElementById('final-150').innerHTML, 'Real exam (80 scored + 10 unscored &middot; 105 min)');
assert.equal(md.document.getElementById('final-75').innerHTML, 'Half (40 scored + 5 unscored &middot; 53 min)');

const freeA = md.__bank.find((q) => q.question === "The 'free look' period for a life insurance policy in Maryland allows the policyowner to:");
const freeB = md.__bank.find((q) => q.question === "The 'free look' period for a life insurance policy in Maryland is at least:");
const freeBase = freeA.question.slice(0, 48);
assert.equal(freeBase, freeB.question.slice(0, 48));
assert.notEqual(md.qid(freeA), md.qid(freeB));
md.localStorage.setItem('md_exam_v2', JSON.stringify({
  srs: { [freeBase]: { b: 4, seen: 2, missed: 1, due: 9 } },
  seenIds: { [freeA.topic]: [freeBase], [freeB.topic]: [freeBase] },
  total: 3, correct: 1
}));
md.load();
assert.equal(md.srsGet(freeA).b, 4);
assert.equal(md.srsGet(freeB).b, 4);
assert.equal(md.srsAll()[freeBase], undefined);
assert.equal(md.__seen()[freeA.topic].has(freeBase), false);
assert.equal(md.__seen()[freeA.topic].has(md.qid(freeA)), true);
assert.equal(md.__seen()[freeB.topic].has(md.qid(freeB)), true);
const unique = md.__bank[0];
assert.equal(md.qid(unique), unique.question.slice(0, 48));
md.localStorage.setItem('md_exam_v2', JSON.stringify({ srs: { [md.qid(unique)]: { b: 1, seen: 1, missed: 0, due: 2 } } }));
md.load();
assert.equal(md.srsGet(unique).b, 1);
assert.equal(md.srsAll()[md.qid(unique)].b, 1);

md.localStorage.setItem('ihub_track_MD', 'lh');
md.trackApply();
md.generateQuestions();
const practice = md.document.getElementById('questions-container').innerHTML;
assert.equal((practice.match(/class="qcard"/g) || []).length, 1);
assert.match(practice, /of 10/);
assert.match(practice, /id="prac-next"[^>]*disabled/);
assert.match(practice, /display:none/);
assert.doesNotMatch(practice, /class="qcard"[\s\S]*class="qcard"/);

const vaOutline = va.__outline();
assert.equal(sumItems(vaOutline), 140);
assert.ok(Math.abs(sumWeights(vaOutline) - 1) < 1e-9);
assert.equal(vaOutline.some((d) => d.key === 'S' || !d.weight), false);
const vaReg = vaOutline.find((d) => d.key === '1');
assert.ok(vaReg.topics.includes('Virginia-specific health & Medicare regulations'));
assert.equal(vaReg.items, 14);
const vaSenior = vaOutline.find((d) => d.key === '15');
assert.ok(vaSenior.topics.includes('Medicare, Medigap & senior health plans'));
assert.equal(vaSenior.items, 15);
topicsOf(vaOutline);
vaOutline.forEach((d) => {
  if (!d.weight) return;
  assert.ok(poolSize(va.__bank, d.topics) >= d.items, d.name);
});
assert.ok(va.__bank.filter((q) => q.topic === 'Virginia-specific health & Medicare regulations').length >= 10);

for (const q of va.__bank) {
  const correct = q.options[q.correct];
  if (/Medallion 4\.0/.test(correct)) assert.match(correct, /Cardinal Care Managed Care/);
  assert.doesNotMatch(q.explanation, /program is called Medallion 4\.0|administered through Medallion/i);
}
const cardinal = va.__bank.find((q) => q.question.startsWith('Virginia Medicaid managed care'));
assert.equal(cardinal.correct, 'B');
assert.match(cardinal.options.B, /Cardinal Care Managed Care/);
assert.match(cardinal.explanation, /October 1, 2023/);
assert.match(cardinal.explanation, /did not reduce or change existing coverage/);
assert.equal(cardinal.topic, 'Medicare, Medigap & senior health plans');
assert.equal(va.__bank.filter((q) => q.question === "'Twisting' in insurance is defined as:").length, 1);
assert.equal(va.__bank.filter((q) => q.question === 'Medicare Advantage (Part C) plans:').length, 1);
assert.equal(va.__bank.filter((q) => q.question.startsWith('Which statement about Medicare Advantage')).length, 1);
assert.equal(va.__bank.filter((q) => q.question.startsWith('Which unfair trade practice is a producer committing by misrepresenting')).length, 1);

assert.equal(va.__lh.scored, 140);
assert.equal(va.__lh.unscored, 10);
assert.equal(va.__lh.minutes, 150);
assert.ok(va.__tracks.VA.life);
assert.ok(va.__tracks.VA.health);
assert.equal(va.__tracks.VA.life.scored, 90);
assert.equal(va.__tracks.VA.life.unscored, 15);
assert.equal(va.__tracks.VA.life.minutes, 120);
assert.equal(va.__tracks.VA.health.scored, 90);
assert.equal(va.__tracks.VA.health.unscored, 15);
assert.equal(va.__tracks.VA.health.minutes, 120);
assert.equal(va.__tracks.VA.life.topics, undefined);
checkTrackPools(va.__bank, va.__tracks.VA.life);
checkTrackPools(va.__bank, va.__tracks.VA.health);
assert.equal(va.__tracks.VA.life.domains.some((d) => d.topics.includes('Virginia-specific health & Medicare regulations')), false);
assert.equal(va.__tracks.VA.health.domains.some((d) => d.topics.includes('Virginia-specific health & Medicare regulations')), true);

for (let n = 0; n < 3; n++) assertFull(va, 150, 140, 10, 150, vaOutline);
assertHalf(va, vaOutline, 70, 5, 75);
va.localStorage.setItem('ihub_track_VA', 'life');
va.trackApply();
assertFull(va, 150, 90, 15, 120, va.__outline());
assertHalf(va, va.__outline(), 45, 8, 60);
va.localStorage.setItem('ihub_track_VA', 'health');
va.trackApply();
assertFull(va, 150, 90, 15, 120, va.__outline());
assertHalf(va, va.__outline(), 45, 8, 60);
va.localStorage.setItem('ihub_track_VA', 'lh');
va.trackApply();

html = grade(va, 150, 97);
assert.match(html, /Below this page's pass mark \(70% of scored items\)/);
assert.match(html, /97 of 140 scored/);
html = grade(va, 150, 98);
assert.match(html, /PASS \(this page's pass mark: 70% of scored items\)/);
assert.match(html, /98 of 140 scored/);
assert.equal(/official pass mark/i.test(html), false);

va.trackFinalLabels();
assert.equal(va.document.getElementById('final-150').innerHTML, 'Real exam (140 scored + 10 unscored &middot; 150 min)');
assert.equal(va.document.getElementById('final-75').innerHTML, 'Half (70 scored + 5 unscored &middot; 75 min)');

const death = va.__bank.filter((q) => q.question.slice(0, 48) === 'Life insurance death benefits paid to a named be');
assert.equal(death.length, 2);
const deathBase = death[0].question.slice(0, 48);
va.localStorage.setItem('va_exam_v5', JSON.stringify({
  srs: { [deathBase]: { b: 3, seen: 4, missed: 1, due: 8 } }
}));
va.load();
assert.equal(va.srsGet(death[0]).b, 3);
assert.equal(va.srsGet(death[1]).b, 3);
assert.equal(va.srsAll()[deathBase], undefined);

va.generateQuestions();
const vaPractice = va.document.getElementById('questions-container').innerHTML;
assert.equal((vaPractice.match(/class="qcard"/g) || []).length, 1);
assert.match(vaPractice, /id="prac-next"[^>]*disabled/);

function assertReviewEscapes(page) {
  page.__hist().push({
    topic: 'Topic <x>',
    question: 'Sample <b>question</b>',
    options: { A: '<i>a</i>', B: 'b', C: 'c', D: 'd' },
    correct: 'A',
    userAnswer: 'B',
    isCorrect: false,
    explanation: '<script>no</script>'
  });
  page.renderReview();
  const review = page.document.getElementById('review-container').innerHTML;
  assert.match(review, /&lt;b&gt;question&lt;\/b&gt;/);
  assert.match(review, /&lt;i&gt;a&lt;\/i&gt;/);
  assert.match(review, /&lt;script&gt;no&lt;\/script&gt;/);
  assert.match(review, /Topic &lt;x&gt;/);
  assert.equal(/<b>|<script>|<i>/.test(review), false);
}
assertReviewEscapes(md);
assertReviewEscapes(va);
assert.equal(md.FINAL_FULL_SIGNAL, 140);
assert.equal(md.__finalLen, 140);

console.log('md-va-exam-check: ok', md.__bank.length, va.__bank.length);
