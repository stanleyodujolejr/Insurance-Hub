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
            out.append(fix_screened(item))
    return out


def fix_screened(q):
    """Correct screened national items the reviewer flagged. Match on the stem."""
    stem = q["question"]
    if stem.startswith("Which life insurance policy is designed to be 'paid up'"):
        q["question"] = (
            "Which traditional life policy is designed to endow at age 100, so that if the insured is still living the cash value equals the face amount?"
        )
        q["options"] = {
            "A": "Term insurance that expires at age 65",
            "B": "Limited-payment whole life that is paid up at age 65 but does not endow at 65",
            "C": "Ordinary whole life that endows at age 100",
            "D": "Return of premium term",
        }
        q["correct"] = "C"
        q["explanation"] = (
            "Ordinary whole life is the continuous-premium policy traditionally set to mature at age 100, when the cash value equals the face amount and the insurer pays the living insured. Limited-payment whole life can be paid up at 65, which only means premiums stop; the policy does not endow at 65. Term that expires at 65 and return-of-premium term do not endow at 100. This is product design, not a Georgia statute."
        )
    elif stem.startswith("Under current law, required minimum distributions (RMDs) from Traditional IRAs"):
        q["question"] = (
            "A Traditional IRA owner born in 1954 must take the first required minimum distribution by April 1 of the year after reaching:"
        )
        q["correct"] = "D"
        q["explanation"] = (
            "The IRS retirement-topics page states that the required beginning date for an IRA is April 1 of the year following the year the owner reaches age 73. SECURE 2.0 Act section 107 (Division T of Public Law 117-328) sets that applicable age at 73 for an individual who attains age 72 after December 31, 2022, and age 73 before January 1, 2033. Someone born in 1954 reaches 73 in 2027. The same section sets age 75 for an individual who attains age 74 after December 31, 2032, so 73 is not the only age in the statute. Missing an RMD can bring a 25 percent excise tax, reduced to 10 percent if corrected in time (IRS RMD page)."
        )
    elif stem.startswith("Under the ACA, what is the maximum out-of-pocket limit"):
        q["options"]["D"] = "$8,700"
        q["correct"] = "C"
        q["explanation"] = (
            "The 2024 HHS Notice of Benefit and Payment Parameters set the ACA in-network out-of-pocket maximum for self-only coverage at $9,450. Only one choice states that individual figure. Plans cannot require the enrollee to pay more than that amount in in-network deductibles, copayments, and coinsurance for the year."
        )
    elif stem.startswith("A health plan has a $1,500 individual deductible"):
        q["options"]["C"] = "$3,200"
        q["correct"] = "C"
        q["explanation"] = (
            "The member pays the $1,500 deductible first. Coinsurance applies to the remaining $8,500. Twenty percent of $8,500 is $1,700. $1,500 plus $1,700 is $3,200. That total is under the $6,000 out-of-pocket maximum, so the member pays $3,200, not $3,000 and not the full $6,000 cap."
        )
    elif stem.startswith("Which type of policy would a business purchase to replace the income"):
        q["question"] = (
            "A business wants a policy that it owns and that pays the business if an owner or partner who is essential to the firm becomes disabled. Which policy is that?"
        )
        q["correct"] = "A"
        q["explanation"] = (
            "Key-person disability income insurance is purchased by the business. The business is the owner and beneficiary, and the benefit covers the financial loss of a key person's services. It does not pay the disabled owner's personal living expenses. Business overhead expense insurance pays fixed operating costs such as rent and utilities. The overhead item in this bank states that overhead coverage does not replace the owner's personal income. Group long-term disability and workers' compensation are different coverages."
        )
    elif stem.startswith("Which Medicare cost-sharing feature requires a beneficiary to pay for the first 20 days"):
        q["explanation"] = (
            "For a qualifying skilled nursing facility stay after a 3-day inpatient hospital stay, Medicare Part A pays covered services in full for days 1-20. CMS's 2026 fact sheet sets the daily coinsurance for skilled nursing days 21-100 at $217. After day 100, Medicare pays nothing for that stay. The 2024 daily amount was $204; this item uses the 2026 figure."
        )
    elif stem.startswith("The 'donut hole'"):
        q["question"] = "For 2026, which statement about the old Medicare Part D coverage gap (the 'donut hole') is accurate?"
        q["options"] = {
            "A": "The gap still requires the beneficiary to pay all drug costs after a set amount, with no annual cap",
            "B": "The coverage gap was eliminated starting in 2025, and the 2026 annual out-of-pocket cap for covered Part D drugs is $2,100",
            "C": "The gap is a break in hospital coverage between Part A and Part B",
            "D": "Medigap plans sold after 2020 must leave a $5,000 drug gap",
        }
        q["correct"] = "B"
        q["explanation"] = (
            "CMS's final 2026 Part D redesign instructions set the annual out-of-pocket threshold at $2,100, which is the 2025 cap of $2,000 adjusted for the increase in Part D drug spending. After that threshold, the enrollee pays no cost sharing for covered Part D drugs. The old coverage gap is not a separate phase in which the beneficiary pays most of the cost."
        )
    elif stem.startswith("A Flexible Spending Account (FSA) differs"):
        q["explanation"] = (
            "A health FSA is generally use-it-or-lose-it unless the employer adopts a carryover or a grace period. IRS Revenue Procedure 2025-32 sets the 2026 salary-reduction limit for a health FSA at $3,400. If the plan allows a carryover, the maximum carried from a 2026 plan year into 2027 is $680. An HSA rolls over indefinitely and is owned by the employee. An FSA does not require a high-deductible health plan; an HSA does."
        )
    elif stem.startswith("Under SECURE 2.0, Required Minimum Distributions"):
        q["question"] = (
            "Under SECURE 2.0, an individual who attains age 72 after December 31, 2022, and attains age 73 before January 1, 2033, must begin required minimum distributions at age:"
        )
        q["correct"] = "C"
        q["explanation"] = (
            "SECURE 2.0 Act section 107 sets the applicable age at 73 for that individual. The same section sets age 75 for an individual who attains age 74 after December 31, 2032, so 75 is a real later age and is not the answer for this person. The IRS retirement-topics page describes the current required beginning date as April 1 of the year after the owner reaches 73. Roth IRAs have no lifetime RMD for the owner."
        )
    elif stem.startswith("For 2026, the 401(k) employee salary deferral"):
        q["options"]["C"] = "$24,500"
        q["correct"] = "C"
        q["explanation"] = (
            "IRS news release IR-2025-111 (November 13, 2025) and the IRS cost-of-living table set the 2026 elective deferral limit for a 401(k) at $24,500. The age-50 catch-up is $8,000, so someone 50 or older can generally defer $32,500. The defined-contribution annual-additions limit under section 415(c) is $72,000. Employees who turn 60, 61, 62, or 63 in 2026 have a higher catch-up of $11,250 instead of $8,000. The question asks for the regular deferral limit, which is $24,500."
        )
    elif stem.startswith("A SIMPLE IRA is designed for"):
        q["options"]["B"] = (
            "An employer with 100 or fewer employees who earned at least $5,000 from that employer in the prior year"
        )
        q["correct"] = "B"
        q["explanation"] = (
            "IRC section 408(p) defines a SIMPLE plan for an employer that had no more than 100 employees who received at least $5,000 of compensation from the employer in the prior year. The $5,000 is compensation the employees earned from the employer. It is not money the employer received from the employees. The employer must make either a matching contribution or a nonelective contribution."
        )
    elif stem.startswith("Required Minimum Distributions (RMDs) are required beginning at age 73"):
        q["question"] = (
            "For an IRA owner born in 1955, required minimum distributions beginning at age 73 apply to all of the following EXCEPT:"
        )
        q["explanation"] = (
            "Someone born in 1955 attains age 73 in 2028, before January 1, 2033, so SECURE 2.0 section 107 sets the applicable age at 73. A Roth IRA still has no required minimum distribution during the owner's lifetime (IRS retirement-topics page). Most non-spouse beneficiaries of an inherited IRA must empty the account within 10 years under the SECURE Act of 2019. They do not stretch distributions over their own life expectancy. That 10-year rule is the same point made by the stretch-IRA item in this bank."
        )
    elif stem.startswith("The 'catch-up contribution' provision"):
        q["explanation"] = (
            "A catch-up contribution lets a participant age 50 or older contribute more than the regular annual limit. IRS release IR-2025-111 sets the 2026 IRA catch-up at $1,100, so the IRA total is $7,500 plus $1,100, or $8,600. The 2026 401(k) catch-up for age 50 and older is $8,000, on top of the $24,500 deferral. Participants who turn 60 through 63 in 2026 have a higher 401(k) catch-up of $11,250."
        )
    elif stem.startswith("To become fully insured for Social Security"):
        q["explanation"] = (
            "Social Security retirement benefits generally require 40 quarters of coverage, which is 10 years of work. The Social Security Administration's 2026 cost-of-living fact sheet, and the November 3, 2025 Federal Register notice, set the 2026 quarter-of-coverage amount at $1,890 of covered earnings. A worker can earn up to four credits in a year."
        )
    elif stem.startswith("The standard Medicare Part A deductible covers hospitalization"):
        q["explanation"] = (
            "CMS's 2026 Medicare Parts A and B fact sheet says the Part A inpatient deductible covers the first 60 days of a benefit period and is $1,736 in 2026. Days 61 through 90 cost $434 a day. Lifetime reserve days cost $868 a day. For a skilled nursing facility, days 21 through 100 cost $217 a day. The deductible is per benefit period, not per calendar year."
        )
    elif stem.startswith("Premium tax credits (PTC) under the ACA"):
        q["explanation"] = (
            "For 2026, IRS Revenue Procedure 2025-25 sets the applicable percentage from 2.10 percent of household income below 133 percent of the federal poverty line up to 9.96 percent from 300 percent through 400 percent of the poverty line. The temporary enhancement that allowed a credit above 400 percent of the poverty line expired after 2025. CMS's 2026 program-integrity summary says marketplace premium tax credits again require household income from 100 percent to 400 percent of the poverty line. Income above 400 percent is not eligible."
        )
    elif stem.startswith("Medigap Plan G covers all of the following EXCEPT"):
        q["explanation"] = (
            "Plan G covers the Part A deductible and inpatient coinsurance, Part B coinsurance, and Part B excess charges. It does not cover the annual Part B deductible. CMS's 2026 fact sheet sets that Part B deductible at $283 and the standard monthly Part B premium at $202.90. The question asks which item Plan G does not cover, which is the Part B deductible, not the dollar amount of the premium."
        )
    elif stem.startswith("The Inflation Reduction Act (2022) capped Medicare Part D"):
        q["question"] = "The annual out-of-pocket cap for Medicare Part D covered drugs in 2026 is:"
        q["options"]["C"] = "$2,100"
        q["correct"] = "C"
        q["explanation"] = (
            "CMS's final 2026 Part D redesign instructions set the annual out-of-pocket threshold at $2,100. That is the original 2025 cap of $2,000, adjusted for the increase in average Part D drug spending. After the enrollee reaches $2,100, covered Part D drugs have no further enrollee cost sharing for the year."
        )
    elif "wait twenty-four" in q["explanation"] or stem.startswith("A candidate fails the Georgia Life Agent exam"):
        q["explanation"] = (
            "Handbook #121100 (October 2026) says a reservation must be made at least 24 hours before the exam date. That 24-hour figure is the lead time before the sitting, not a wait after a failing score before the candidate may schedule. A candidate who fails may schedule the next exam within one day, but must wait 14 days to retest after attempts one and two, and 60 days after the third attempt and any later attempt. There is no limit on the number of attempts."
        )
    return q


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
            "  if(teamCode()) L.push('Team code: '+teamCode());\n"
            "  L.push('Generated '+new Date().toLocaleDateString());",
        ),
        (
            "var IHUB_SYNC_URL='https://script.google.com/macros/s/AKfycbwda1rK5LLe7j1KgqQwa-SV5tbMJ5KsE0GsJT-6CDkb-JlKxOzEp0qu_kMDqbG7Y-ii/exec';\n"
            "var SYNC_GAP=5*60000;",
            "var IHUB_SYNC_URL='https://script.google.com/macros/s/AKfycbwda1rK5LLe7j1KgqQwa-SV5tbMJ5KsE0GsJT-6CDkb-JlKxOzEp0qu_kMDqbG7Y-ii/exec';\n"
            "var GA_SYNC_LIVE=false;\n"
            "var SYNC_GAP=5*60000;",
        ),
        (
            "function syncSend(force){\n  var c=syncCfg();\n  if(!c.on||!c.name||!IHUB_SYNC_URL)return;",
            "function syncSend(force){\n  var c=syncCfg();\n  if(!GA_SYNC_LIVE)return;\n  if(!c.on||!c.name||!IHUB_SYNC_URL)return;",
        ),
        (
            "function syncBeacon(){\n  var c=syncCfg();\n  if(!c.on||!c.name||!IHUB_SYNC_URL||!navigator.sendBeacon)return;",
            "function syncBeacon(){\n  if(!GA_SYNC_LIVE)return;\n  var c=syncCfg();\n  if(!c.on||!c.name||!IHUB_SYNC_URL||!navigator.sendBeacon)return;",
        ),
        (
            "function syncPaint(){\n  var el=document.getElementById('sync-box'); if(!el)return;\n  var c=syncCfg();",
            "function syncPaint(){\n  var el=document.getElementById('sync-box'); if(!el)return;\n"
            "  if(!GA_SYNC_LIVE){\n"
            "    el.innerHTML='<div class=\"sync-t\">Auto-send to your team lead</div>'\n"
            "      +'<div class=\"sync-s\">Team sending isn\\'t switched on yet.</div>';\n"
            "    return;\n"
            "  }\n"
            "  var c=syncCfg();",
        ),
        (
            "Only the numbers in this report are sent. No answers, no personal info beyond the name you type.",
            "Your name and your progress report are sent. No answers are sent.",
        ),
        (
            "Only your study numbers are sent: no answers and nothing else about you.",
            "Your name and your progress report are sent. No answers are sent.",
        ),
        (
            "if(!confirm('Remove this exam result from this device? (Your team lead\\'s Sheet keeps its copy.)'))return;",
            "var leadCopy='';\n"
            "    try{var sc=syncCfg(); if(GA_SYNC_LIVE&&(sc.on||sc.ok)) leadCopy=' (Your team lead\\'s Sheet keeps its copy.)';}catch(e){}\n"
            "    if(!confirm('Remove this exam result from this device?'+leadCopy))return;",
        ),
        (
            "function twShow(){\n  var code=teamCode(); if(!code)return;",
            "function twShow(){\n  if(!GA_SYNC_LIVE)return;\n  var code=teamCode(); if(!code)return;",
        ),
        (
            "function teamCode(){try{return teamClean(localStorage.getItem('ihub_team'));}catch(e){return '';}}\nfunction syncPayload(c){",
            "function teamCode(){try{return teamClean(localStorage.getItem('ihub_team'));}catch(e){return '';}}\n"
            "function gaExamCode(){var id='lh'; try{id=trackId();}catch(e){} if(id==='life') return '12-GA-01'; if(id==='health') return '12-GA-02'; return '12-GA-05';}\n"
            "function gaTrackTag(){var code=gaExamCode(); if(code==='12-GA-01') return 'Life 12-GA-01'; if(code==='12-GA-02') return 'A&S 12-GA-02'; return 'Combo 12-GA-05';}\n"
            "function syncPayload(c){",
        ),
        (
            "return {name:c.name,state:COACH_STATE,team:teamCode(),sentAt:Date.now(),",
            "return {name:c.name,state:COACH_STATE,team:teamCode(),exam:gaExamCode(),sentAt:Date.now(),",
        ),
        (
            "coach:!!coachGetKey(),track:trackLabel(),sessions7d:todaySessions7()}",
            "coach:!!coachGetKey(),track:gaTrackTag(),sessions7d:todaySessions7()}",
        ),
        ("window.__finalLen=140;", "window.__finalLen=135;"),
        (
            "sel='<label class=\"today-x\">Exam <select id=\"trk-sel\" class=\"today-sel\"><option value=\"lh\"'+(t==='lh'?' selected':'')+'>Life &amp; Health</option>';",
            "sel='<label class=\"today-x\">Exam <select id=\"trk-sel\" class=\"today-sel\"><option value=\"lh\"'+(t==='lh'?' selected':'')+'>Life, Accident &amp; Sickness combo</option>';",
        ),
        ("bind('#final-start',function(){startFinalExam(window.__finalLen||140);});", "bind('#final-start',function(){startFinalExam(window.__finalLen||135);});"),
        (
            "@media(max-width:560px){\n  .c-fab{right:12px;bottom:60px;width:52px;height:52px}",
            "@media(max-width:560px){\n  .wrap{padding-right:76px}\n  .c-fab{right:10px;bottom:78px;width:48px;height:48px}",
        ),
        (
            "doc.text('MD Exam Prep — Maryland L&H Review Export',ML,11);",
            "var pdfTrack=''; try{pdfTrack=trackLabel();}catch(e){}\n  doc.text('GA Exam Prep — '+pdfTrack,ML,11);",
        ),
        ("doc.save('MD_Exam_Prep_Review.pdf');", "doc.save('GA_Exam_Prep_Review.pdf');"),
        ("name:q._dn||'Mixed'", "name:q._dn||q.topic"),
        ("let finalState={length:140,duration:150", "let finalState={length:0,duration:0"),
        (
            '<button class="mode-btn" id="final-75" type="button">Half (75 q &middot; 75 min)</button>\n          <button class="mode-btn active" id="final-150" type="button">Real exam (140 q &middot; 150 min)</button>',
            '<button class="mode-btn" id="final-75" type="button">Half-length practice exam</button>\n          <button class="mode-btn active" id="final-150" type="button">Full-length exam (timed like the real test)</button>',
        ),
        (
            "weak.map(t=>`<span class=\"weak-tag\">${t}</span>`)",
            "weak.map(t=>`<span class=\"weak-tag\">${fEscape(t)}</span>`)",
        ),
        (
            '"Maryland Guaranty Corporation limits"',
            '"Georgia Life and Health Insurance Guaranty Association limits"',
        ),
        (
            'Must exist at the time of APPLICATION for life insurance — NOT at the time of death. You automatically have it in your own life, and in a spouse, dependent, business partner, or key employee. (Property insurance is the opposite: interest must exist at time of loss.)',
            "O.C.G.A. § 33-24-3(h): an insurable interest must exist when the personal-insurance contract becomes effective, and need not exist when the loss occurs. Subsection (a) is a reasonable expectation of pecuniary advantage through the continued life, health, or bodily safety of another, or a substantial interest from love and affection for individuals closely related by blood or by law. Subsection (b): a person has an unlimited insurable interest in that person's own life, health, and bodily safety and may name any beneficiary.",
        ),
    ]
    repls.append((
        """function pickFinalExamQuestions(length){
  const picks=[];
  OUTLINE_WEIGHTS.forEach(d=>{
    if(!d.weight)return;
    const n=Math.max(1,Math.round(length*d.weight));
    const pool=shuffle(BANK.filter(q=>d.topics.indexOf(q.topic)>=0));
    if(!pool.length)return;
    for(let i=0;i<n;i++){const q=pool[i%pool.length];picks.push(Object.assign({},q,{_dk:d.key,_dn:d.name}));}
  });
  while(picks.length<length){const q=BANK[Math.floor(Math.random()*BANK.length)];picks.push(Object.assign({},q,{_dk:'?',_dn:'Mixed'}));}
  return shuffle(picks).slice(0,length);
}""",
        """function pickFinalExamQuestions(length){
  var domains=OUTLINE_WEIGHTS.filter(function(d){
    return d.weight>0 && BANK.some(function(q){return d.topics.indexOf(q.topic)>=0;});
  });
  var parts=domains.map(function(d){return {d:d, exact:length*d.weight, n:Math.floor(length*d.weight)};});
  var left=length-parts.reduce(function(s,p){return s+p.n;},0);
  parts.sort(function(a,b){return (b.exact-b.n)-(a.exact-a.n);});
  var i=0;
  while(left>0 && parts.length){parts[i%parts.length].n++; left--; i++;}
  var seen={}, picks=[];
  parts.forEach(function(p){
    var pool=shuffle(BANK.filter(function(q){return p.d.topics.indexOf(q.topic)>=0 && !seen[q.question];}));
    var take=Math.min(p.n, pool.length);
    for(var j=0;j<take;j++){
      seen[pool[j].question]=1;
      picks.push(Object.assign({}, pool[j], {_dk:p.d.key, _dn:p.d.name}));
    }
  });
  if(picks.length<length){
    var rest=shuffle(BANK.filter(function(q){
      return !seen[q.question] && parts.some(function(p){return p.d.topics.indexOf(q.topic)>=0;});
    }));
    for(var r=0;r<rest.length && picks.length<length;r++){
      var q=rest[r], dom=null;
      for(var u=0;u<parts.length;u++){if(parts[u].d.topics.indexOf(q.topic)>=0){dom=parts[u].d;break;}}
      seen[q.question]=1;
      picks.push(Object.assign({}, q, {_dk:dom.key, _dn:dom.name}));
    }
  }
  return shuffle(picks).slice(0,length);
}""",
    ))
    repls.append((
        "con.innerHTML=items.map(r=>`<div class=\"review-card ${r.isCorrect?'rc-c':'rc-w'}\"><div class=\"review-topic\">${r.topic} &middot; ${r.isCorrect?'&#10003; Correct':'&#10007; Incorrect'}</div><div class=\"review-qtext\">${r.question}</div><div class=\"review-opts\">${['A','B','C','D'].map(l=>`<div class=\"review-opt ${l===r.correct?'ro-c':(l===r.userAnswer&&!r.isCorrect?'ro-w':'')}\"><span style=\"font-weight:700;min-width:16px;flex-shrink:0\">${l}</span><span>${(r.options||{})[l]||''}</span></div>`).join('')}</div><div class=\"review-expl\"><strong>Explanation:</strong> ${r.explanation}</div></div>`).join('');",
        "con.innerHTML=items.map(function(r){\n"
        "    return '<div class=\"review-card '+(r.isCorrect?'rc-c':'rc-w')+'\"><div class=\"review-topic\">'+fEscape(r.topic)+' &middot; '+(r.isCorrect?'&#10003; Correct':'&#10007; Incorrect')+'</div><div class=\"review-qtext\">'+fEscape(r.question)+'</div><div class=\"review-opts\">'+['A','B','C','D'].map(function(l){\n"
        "      var cls=l===r.correct?'ro-c':(l===r.userAnswer&&!r.isCorrect?'ro-w':'');\n"
        "      return '<div class=\"review-opt '+cls+'\"><span style=\"font-weight:700;min-width:16px;flex-shrink:0\">'+l+'</span><span>'+fEscape((r.options||{})[l]||'')+'</span></div>';\n"
        "    }).join('')+'</div><div class=\"review-expl\"><strong>Explanation:</strong> '+fEscape(r.explanation||'')+'</div></div>';\n"
        "  }).join('');",
    ))
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
    if "GA_SYNC_OFF" in html:
        raise SystemExit("Georgia sync was turned off")
    if "var GA_SYNC_LIVE=false" not in html:
        raise SystemExit("Georgia sync live flag missing")
    if "function doPost" in html:
        raise SystemExit("doPost must not be in the page")
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
