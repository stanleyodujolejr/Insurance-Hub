#!/usr/bin/env python3
"""Build GA_Exam_Prep.html from the Maryland page engine plus screened national items.

Reads MD_Exam_Prep.html and VA_Exam_Prep.html. Does not modify them.
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
MD = (ROOT / "MD_Exam_Prep.html").read_text(encoding="utf-8")
VA = (ROOT / "VA_Exam_Prep.html").read_text(encoding="utf-8")
GA_LAW = json.loads((ROOT / "content" / "ga-law-questions.json").read_text(encoding="utf-8"))

LEAK = re.compile(
    r"maryland|virginia|\bMD\b|\bVA\b|COMAR|MIA\b|38\.2|Title 38|Ins\. Art|14 VAC|"
    r"Teyah|Richard|Baltimore|Annapolis|Richmond|Georgia|O\.C\.G\.A|OCGA|Prometric",
    re.I,
)
SKIP_TOPICS = {
    "Unfair trade practices & consumer protection",
    "Replacement regulations & Guaranty Association",
    "Producer licensing & reporting rules",
    "Maryland Insurance Article & required numbers",
    "Maryland-specific health & Medicare regulations",
    "Virginia Title 38.2 & required numbers",
    "Virginia-specific health & Medicare regulations",
}
MAP = {
    "Types of life insurance policies": "Life: types of policies and annuities",
    "Annuities": "Life: types of policies and annuities",
    "Provisions, riders & nonforfeiture options": "Life: riders, provisions, options, and exclusions",
    "Premiums, proceeds & beneficiaries": "Life: riders, provisions, options, and exclusions",
    "Life insurance underwriting & policy issue": "Life: application, underwriting, and delivery",
    "Insurance fundamentals, risk & contract law": "Insurance contract law",
    "Legal concepts (subrogation, waiver, estoppel)": "Insurance contract law",
    "Uses of life insurance (key person, buy-sell, estate)": "Life: retirement and other insurance concepts",
    "Group life insurance": "Life: retirement and other insurance concepts",
    "Retirement plans & IRAs": "Life: retirement and other insurance concepts",
    "Federal tax — Life & Annuities": "Life: retirement and other insurance concepts",
    "Health & accident insurance basics": "Accident and sickness: types of policies",
    "Health plan types (HMO, PPO, EPO, POS, HDHP)": "Accident and sickness: types of policies",
    "Disability income insurance": "Accident and sickness: types of policies",
    "Group health insurance": "Accident and sickness: types of policies",
    "Dental & vision insurance": "Accident and sickness: types of policies",
    "Medical expense & cost-sharing": "Accident and sickness: provisions, clauses, and riders",
    "Health insurance policy provisions": "Accident and sickness: provisions, clauses, and riders",
    "Medicare, Medigap & senior health plans": "Medicare, Medicaid, and related coverage",
    "Health insurance underwriting & renewability": "Accident and sickness: field underwriting",
    "Federal tax — Health insurance": "Accident and sickness: other insurance concepts",
}


def js_array(text, name, endname):
    i = text.find(name)
    j = text.find(endname, i)
    blob = text[i:j]
    s = blob[blob.find("[") :]
    depth = 0
    in_str = False
    esc = False
    for n, c in enumerate(s):
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
        else:
            if c == '"':
                in_str = True
            elif c == "[":
                depth += 1
            elif c == "]":
                depth -= 1
                if depth == 0:
                    return json.loads(s[: n + 1])
    raise SystemExit("could not parse " + name)


def load_bank(text):
    bank = js_array(text, "const BANK=", "const TOPIC_GROUPS")
    extra = js_array(text, "const NEW_BANK=", "NEW_BANK.forEach")
    return bank + extra


def blob(q):
    opts = q.get("options") or {}
    return " ".join([q.get("question", ""), q.get("explanation", "")] + list(opts.values()))


def keep_national(q):
    if q.get("topic") in SKIP_TOPICS or q.get("topic") not in MAP and q.get("topic") != "Social Security & disability benefits":
        return False
    if not all(k in (q.get("options") or {}) for k in "ABCD"):
        return False
    if q.get("correct") not in list("ABCD"):
        return False
    text = blob(q)
    if LEAK.search(text):
        return False
    if len(q.get("explanation") or "") < 80 or len(q.get("question") or "") < 25:
        return False
    if re.search(r"guaranty", text, re.I):
        return False
    if re.search(r"free look", text, re.I) and re.search(r"\d+\s*-?\s*days?", text, re.I):
        return False
    if re.search(r"\byour state\b", text, re.I):
        return False
    return True


def route(q):
    if q["topic"] == "Social Security & disability benefits":
        text = blob(q).lower()
        if "medicare" in text or "medigap" in text:
            return "Medicare, Medicaid, and related coverage"
        if "social security" not in text and "ssdi" not in text and "blackout" not in text:
            return "Accident and sickness: types of policies"
        return "Social Security benefits"
    return MAP[q["topic"]]


def screened():
    seen = set()
    out = []
    for src in (MD, VA):
        for q in load_bank(src):
            if not keep_national(q):
                continue
            key = re.sub(r"\s+", " ", q["question"].lower()).strip()
            if key in seen:
                continue
            seen.add(key)
            item = {
                "topic": route(q),
                "question": q["question"],
                "options": {k: q["options"][k] for k in "ABCD"},
                "correct": q["correct"],
                "explanation": q["explanation"],
                "provenance": "reused-national-screened",
            }
            out.append(item)
    return out


TOPICS = [
    ("LIFE — POLICIES, CONTRACTS, AND USES", [
        ("L1", "Life: types of policies and annuities"),
        ("L2", "Life: riders, provisions, options, and exclusions"),
        ("L3", "Life: application, underwriting, and delivery"),
        ("L4", "Insurance contract law"),
        ("L5", "Life: retirement and other insurance concepts"),
        ("L6", "Social Security benefits"),
    ]),
    ("ACCIDENT AND SICKNESS", [
        ("A1", "Accident and sickness: types of policies"),
        ("A2", "Accident and sickness: provisions, clauses, and riders"),
        ("A3", "Medicare, Medicaid, and related coverage"),
        ("A4", "Accident and sickness: other insurance concepts"),
        ("A5", "Accident and sickness: field underwriting"),
    ]),
    ("GEORGIA LAW", [
        ("GA", "Georgia laws common to life and accident and sickness"),
        ("GL", "Georgia rules for life insurance only"),
        ("GH", "Georgia rules for accident and sickness only"),
    ]),
]

T = {label: label for _, items in TOPICS for _, label in items}
COMMON = "Georgia laws common to life and accident and sickness"
LIFE_ONLY = "Georgia rules for life insurance only"
HEALTH_ONLY = "Georgia rules for accident and sickness only"
TYPES = "Life: types of policies and annuities"
PROV = "Life: riders, provisions, options, and exclusions"
APP = "Life: application, underwriting, and delivery"
CONTRACT = "Insurance contract law"
RET = "Life: retirement and other insurance concepts"
SS = "Social Security benefits"
HTYPES = "Accident and sickness: types of policies"
HPROV = "Accident and sickness: provisions, clauses, and riders"
MED = "Medicare, Medicaid, and related coverage"
OTHER = "Accident and sickness: other insurance concepts"
FIELD = "Accident and sickness: field underwriting"


def dom(key, name, count, total, topics):
    return {
        "key": key,
        "name": name,
        "weight": count / total,
        "items": count,
        "topics": topics,
    }


def outlines():
    life = [
        dom("1", "Types of policies", 15, 80, [TYPES]),
        dom("2", "Policy riders, provisions, options, and exclusions", 15, 80, [PROV]),
        dom("3", "Application, underwriting, and delivering the policy", 12, 80, [APP, CONTRACT]),
        dom("4", "Retirement and other insurance concepts", 8, 80, [RET, SS]),
        dom("5", "Georgia laws common to life and accident and sickness", 24, 80, [COMMON]),
        dom("6", "Georgia rules for life insurance only", 6, 80, [LIFE_ONLY]),
    ]
    health = [
        dom("1", "Types of policies", 16, 80, [HTYPES]),
        dom("2", "Policy provisions, clauses, and riders", 15, 80, [HPROV]),
        dom("3", "Social insurance", 6, 80, [MED, SS]),
        dom("4", "Other insurance concepts", 5, 80, [OTHER]),
        dom("5", "Field underwriting procedures", 8, 80, [FIELD, CONTRACT]),
        dom("6", "Georgia laws common to life and accident and sickness", 24, 80, [COMMON]),
        dom("7", "Georgia rules for accident and sickness only", 6, 80, [HEALTH_ONLY]),
    ]
    combo = [
        dom("1", "Life: types of policies", 15, 125, [TYPES]),
        dom("2", "Life: riders, provisions, options, and exclusions", 15, 125, [PROV]),
        dom("3", "Life: application, underwriting, and delivery", 12, 125, [APP, CONTRACT]),
        dom("4", "Life: retirement and other insurance concepts", 8, 125, [RET]),
        dom("5", "Accident and sickness: types of policies", 16, 125, [HTYPES]),
        dom("6", "Accident and sickness: provisions, clauses, and riders", 15, 125, [HPROV]),
        dom("7", "Social insurance", 6, 125, [MED, SS]),
        dom("8", "Accident and sickness: other insurance concepts", 5, 125, [OTHER]),
        dom("9", "Accident and sickness: field underwriting", 8, 125, [FIELD]),
        dom("10", "Georgia laws common to life and accident and sickness", 19, 125, [COMMON]),
        dom("11", "Georgia rules for life insurance only", 3, 125, [LIFE_ONLY]),
        dom("12", "Georgia rules for accident and sickness only", 3, 125, [HEALTH_ONLY]),
    ]
    return life, health, combo


def js(value):
    raw = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return raw.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")


def main():
    national = screened()
    bank = national + GA_LAW
    labels = [label for _, items in TOPICS for _, label in items]
    missing = sorted({q["topic"] for q in bank} - set(labels))
    if missing:
        raise SystemExit("unmapped topics " + str(missing))
    life, health, combo = outlines()
    groups = [
        {"group": name, "topics": [{"ch": ch, "label": label} for ch, label in items]}
        for name, items in TOPICS
    ]
    n = len(bank)
    n_topics = len(labels)
    block = (
        "const BANK=" + js(bank) + ";\n"
        "const TOPIC_GROUPS=" + js(groups) + ";\n"
        "const ALL_TOPICS=TOPIC_GROUPS.flatMap(g=>g.topics.map(t=>t.label));\n"
        "const GA_TOPICS=TOPIC_GROUPS[2].topics.map(t=>t.label);\n"
        "const SK='ga_exam_v1';\n"
        "const OUTLINE_WEIGHTS=" + js(combo) + ";\n"
    )
    start = MD.find("const BANK=")
    end = MD.find("\n", MD.find("const OUTLINE_WEIGHTS="))
    if start < 0 or end < 0:
        raise SystemExit("anchors missing")
    html = MD[:start] + block + MD[end:]
    src_life = (
        "Pearson VUE 12-GA-01 Life Agent. Outline #121102 effective Oct 22, 2024 "
        "(rev 09/2026): 80 scored + 10 unscored pretest, 2 hours. "
        "This practice sim grades every item and does not hide pretest items. "
        "Handbook #121100 (October 2026): 70% correct to pass."
    )
    src_health = (
        "Pearson VUE 12-GA-02 Accident/Sickness Agent. Outline #121102: "
        "80 scored + 10 unscored pretest, 2 hours. "
        "This practice sim grades every item and does not hide pretest items. "
        "Handbook #121100 (October 2026): 70% correct to pass."
    )
    src_combo = (
        "Pearson VUE 12-GA-05 Life/Accident/Sickness Agent combo, an official exam, not a made-up combined test. "
        "Outline #121102: 125 scored + 10 unscored pretest, 2.5 hours. "
        "This practice sim uses that sitting length and grades every item; it does not insert unidentified pretest questions. "
        "Handbook #121100 (October 2026): 70% correct to pass."
    )
    tracks = {
        "GA": {
            "health": {
                "label": "Accident & Sickness only",
                "source": src_health,
                "items": 90,
                "minutes": 120,
                "scored": 80,
                "unscored": 10,
                "domains": health,
            },
            "life": {
                "label": "Life only",
                "source": src_life,
                "items": 90,
                "minutes": 120,
                "scored": 80,
                "unscored": 10,
                "domains": life,
            },
        }
    }
    td_at = html.find("var TRACK_DEFS=")
    td_end = html.find("\n", td_at)
    if td_at < 0 or html[td_at:td_end].count("var TRACK_DEFS=") != 1:
        raise SystemExit("TRACK_DEFS line missing")
    html = html[:td_at] + "var TRACK_DEFS=" + js(tracks) + ";" + html[td_end:]
    html = html.replace(
        "var TRACK_LH={label:'Life & Health'};",
        "var TRACK_LH={label:'Life, Accident & Sickness combo',items:135,minutes:150,scored:125,unscored:10,source:"
        + json.dumps(src_combo)
        + "};",
        1,
    )
    repls = [
        ("<title>MD Exam Prep — Maryland Life &amp; Health Licensing</title>", "<title>GA Exam Prep — Georgia Life, Accident &amp; Sickness</title>"),
        (
            "<h1>MD Exam Prep</h1>\n      <p>Maryland Life &amp; Health &middot; 27 topics &middot; 296 questions &middot; answers shuffled each attempt</p>",
            "<h1>GA Exam Prep</h1>\n"
            "      <p><a id=\"hub-back\" href=\"index.html\" style=\"color:#9A3412;font-weight:700;font-size:13px;text-decoration:none\">&larr; All states</a></p>\n"
            "      <p>Georgia Life, Accident &amp; Sickness &middot; "
            + str(n_topics)
            + " topics &middot; "
            + str(n)
            + " practice questions &middot; not Pearson VUE items</p>\n"
            "      <p style=\"font-size:12px;color:#4a5568;margin-top:6px\">Practice only. Official exams are Pearson VUE 12-GA-01, 12-GA-02, and 12-GA-05. This page grades every question it shows.</p>",
        ),
        (
            '<button class="mode-btn" id="mode-md" onclick="setMode(\'md\')">&#9878;&#65039; MD laws only</button>',
            '<button class="mode-btn" id="mode-ga" onclick="setMode(\'ga\')">&#9878;&#65039; GA laws only</button>',
        ),
        (
            "Simulated final exam, weighted by the official Prometric Series 20-30 (Maryland) content outline.\n          <strong>70%</strong> is the passing score.",
            "Practice simulation weighted by Pearson VUE Georgia outline #121102 (effective October 22, 2024). "
            "The handbook states that <strong>70%</strong> correct passes. "
            "Official sittings also include 10 unscored pretest items that this sim does not hide; every item here is graded.",
        ),
        (
            "if(state.mode==='md')return MD_TOPICS.filter(inTrack).length?MD_TOPICS.filter(inTrack):MD_TOPICS;",
            "if(state.mode==='ga')return GA_TOPICS.filter(inTrack).length?GA_TOPICS.filter(inTrack):GA_TOPICS;",
        ),
        ("bind('#mode-md',function(){setMode('md');});", "bind('#mode-ga',function(){setMode('ga');});"),
        ("var COACH_STATE='MD', COACH_STATE_NAME='Maryland';", "var COACH_STATE='GA', COACH_STATE_NAME='Georgia';"),
        (
            "var COACH_LS_KEY='ihub_coach_apikey', COACH_LS_MODEL='ihub_coach_model', COACH_LS_LOG='ihub_coach_log_'+COACH_STATE;",
            "var COACH_LS_KEY='ihub_coach_apikey_GA', COACH_LS_MODEL='ihub_coach_model_GA', COACH_LS_LOG='ihub_coach_log_'+COACH_STATE;",
        ),
        (
            "var who=(COACH_STATE==='VA')?'Virginia Life & Health (VA Exam Prep)':'Maryland Life & Health (MD Exam Prep)';",
            "var who='Georgia Life, Accident & Sickness practice (GA Exam Prep)';",
        ),
        (
            "  L.push(who);\n  L.push('Generated '+new Date().toLocaleDateString());",
            "  L.push(who);\n"
            "  if(teamCode()) L.push('Team code saved on this device only (not sent): '+teamCode());\n"
            "  L.push('Generated '+new Date().toLocaleDateString());",
        ),
        (
            "if(!confirm('Remove this exam result from this device? (Your team lead\\'s Sheet keeps its copy.)'))return;",
            "if(!confirm('Remove this exam result from this device? Georgia results are stored only on this device.'))return;",
        ),
        (
            "var IHUB_SYNC_URL='https://script.google.com/macros/s/AKfycbwda1rK5LLe7j1KgqQwa-SV5tbMJ5KsE0GsJT-6CDkb-JlKxOzEp0qu_kMDqbG7Y-ii/exec';",
            "var IHUB_SYNC_URL='';\nvar GA_SYNC_OFF=true;",
        ),
        ("function syncSend(force){", "function syncSend(force){\n  if(typeof GA_SYNC_OFF!=='undefined'&&GA_SYNC_OFF)return;"),
        ("function syncBeacon(){", "function syncBeacon(){\n  if(typeof GA_SYNC_OFF!=='undefined'&&GA_SYNC_OFF)return;"),
        ("window.__finalLen=140;", "window.__finalLen=135;"),
        (
            "sel='<label class=\"today-x\">Exam <select id=\"trk-sel\" class=\"today-sel\"><option value=\"lh\"'+(t==='lh'?' selected':'')+'>Life &amp; Health</option>';",
            "sel='<label class=\"today-x\">Exam <select id=\"trk-sel\" class=\"today-sel\"><option value=\"lh\"'+(t==='lh'?' selected':'')+'>Life, Accident &amp; Sickness combo</option>';",
        ),
        ("bind('#final-start',function(){startFinalExam(window.__finalLen||140);});", "bind('#final-start',function(){startFinalExam(window.__finalLen||135);});"),
    ]
    for old, new in repls:
        count = html.count(old)
        if count < 1:
            raise SystemExit(f"replace count {count} for: {old[:80]}")
        html = html.replace(old, new)
    html = html.replace(
        "b.innerHTML=d.items?'Real exam ('+d.items+' q &middot; '+d.minutes+' min)':b.dataset.orig;",
        "b.innerHTML=d.items?'Full practice sim ('+d.items+' q &middot; '+d.minutes+' min)':b.dataset.orig;",
        1,
    )
    html = html.replace(
        "h.innerHTML=d.items?'Half ('+Math.round(d.items/2)+' q &middot; '+Math.round(d.minutes/2)+' min)':h.dataset.orig;",
        "var halfN=Math.round(d.items/2), halfM=Math.round(d.minutes*halfN/d.items);\n"
        "  h.innerHTML=d.items?'Shorter practice ('+halfN+' q &middot; '+halfM+' min)':h.dataset.orig;",
        1,
    )
    html = html.replace(
        "var h='<div class=\"today-top\"><div class=\"today-t\">Today&#39;s session</div>'+sel+'</div>';",
        "var h='<div class=\"today-top\"><div class=\"today-t\">Today&#39;s session</div>'+sel+'</div>';\n"
        "  try{var _src=trackDef().source; if(_src) h+='<div class=\"today-wk\">'+cEsc(_src)+'</div>';}catch(e){}",
        1,
    )
    old_coach = (
        "var sys='You are an expert tutor helping a student pass the '+COACH_STATE_NAME+' Life & Health insurance producer licensing exam. '"
    )
    new_coach = (
        "var sys='You are an expert tutor for Georgia producer licensing: Life (12-GA-01), Accident and Sickness (12-GA-02), "
        "and the combined Life, Accident and Sickness exam (12-GA-05). The study material is original practice content plus reused national items, not Pearson VUE exam questions. '"
    )
    if html.count(old_coach) != 1:
        raise SystemExit("coach prompt missing")
    html = html.replace(old_coach, new_coach, 1)
    # sync panel: honest gate, no send button
    old_paint = "function syncPaint(){\n  var el=document.getElementById('sync-box'); if(!el)return;\n  var c=syncCfg();"
    new_paint = """function syncPaint(){
  var el=document.getElementById('sync-box'); if(!el)return;
  if(typeof GA_SYNC_OFF!=='undefined'&&GA_SYNC_OFF){
    var team=teamCode();
    el.innerHTML='<div class="sync-t">Reports stay on this device</div>'
      +'<div class="sync-s">Georgia progress is saved in this browser. Sending a report to a team lead is off until the report service is updated for Georgia. This page does not transmit progress.</div>'
      +(team?'<div class="sync-s">Team code <b>'+cEsc(team)+'</b> from your link is stored only in this browser. It is not sent.</div>':'');
    return;
  }
  var c=syncCfg();"""
    if html.count(old_paint) != 1:
        raise SystemExit("syncPaint anchor missing")
    html = html.replace(old_paint, new_paint, 1)
    old_tw = "function twShow(){"
    new_tw = """function twShow(){
  if(typeof GA_SYNC_OFF!=='undefined'&&GA_SYNC_OFF){
    var code=teamCode(); if(!code)return;
    try{if(localStorage.getItem(twKey(code)))return;}catch(e){return;}
    if(document.getElementById('tw-back'))return;
    var back=document.createElement('div'); back.id='tw-back'; back.className='tw-back';
    back.innerHTML='<div class="tw-card" role="dialog" aria-modal="true" aria-labelledby="tw-t">'
      +'<div class="tw-t" id="tw-t">Team link saved on this device</div>'
      +'<div class="tw-s">Code <b>'+cEsc(code)+'</b> stays in this browser. Georgia progress is not sent to a team lead.</div>'
      +'<div class="tw-row"><button id="tw-yes" class="sync-btn" type="button">OK</button></div></div>';
    document.body.appendChild(back);
    document.getElementById('tw-yes').addEventListener('click',function(){
      try{localStorage.setItem(twKey(code),'seen');}catch(e){}
      var b=document.getElementById('tw-back'); if(b)b.parentNode.removeChild(b);
    });
    return;
  }
"""
    # The original function starts with function twShow(){ — replacing the token leaves the rest of the original body,
    # which would still run after the GA branch returns. The early return handles GA_SYNC_OFF. Good.
    if html.count(old_tw) != 1:
        raise SystemExit("twShow count")
    html = html.replace(old_tw, new_tw, 1)
    # Carry team back to the hub after teamCode exists.
    html = html.replace(
        "try{twShow();}catch(e){}",
        "try{twShow();}catch(e){}\n"
        "(function(){try{var t=teamCode();var a=document.getElementById('hub-back');if(a&&t)a.href='index.html?team='+encodeURIComponent(t);}catch(e){}})();",
        1,
    )
    forbidden = ["Maryland Life", "MD laws only", "COACH_STATE==='VA'", "mode-md", "md_exam_v2", "Prometric"]
    for word in forbidden:
        if word in html:
            raise SystemExit("forbidden leftover " + word)
    if "script.google.com" in html:
        raise SystemExit("sync host still present")
    out = ROOT / "GA_Exam_Prep.html"
    out.write_text(html, encoding="utf-8")
    print(json.dumps({
        "questions": n,
        "topics": n_topics,
        "national": len(national),
        "georgia_original": len(GA_LAW),
        "bytes": out.stat().st_size,
    }, indent=2))


if __name__ == "__main__":
    main()
