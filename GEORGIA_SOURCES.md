# Georgia exam practice — sources and limits

This file describes the Georgia work on this branch. It is not a description of what is already published from `main`.

Shipped `main` before this branch is the Maryland and Virginia study hub only (`index.html`, `MD_Exam_Prep.html`, `VA_Exam_Prep.html`). The live GitHub Pages site follows `main` until a maintainer publishes. `STUDY_PLAN.md` is the Maryland/Virginia handoff and still points at an older host in its tool line.

Fetched for this branch on **2026-11-07**.

## Official exam names

Pearson VUE is the exam vendor linked from its Georgia insurance page. The candidate handbook and content outlines used here:

- Candidate handbook **#121100**, cover date **October 2026**: https://www.pearsonvue.com/content/dam/VUE/vue/en/documents/publications/121100.pdf
- Content outlines **#121102**, header **rev09/2026**, outlines **effective October 22, 2024**: https://www.pearsonvue.com/content/dam/VUE/vue/en/documents/publications/121102.pdf
- Vendor page: https://www.pearsonvue.com/us/en/ga/insurance.html
- Georgia Office of the Commissioner of Insurance and Safety Fire is the regulator named in the handbook. Licensing steps in the handbook point to https://oci.georgia.gov/ and https://oci.ga.gov, and to applications at https://www.sircon.com/georgia

From the October 2026 handbook fee table:

| Code | Name in the handbook | Time | Exam fee |
|---|---|---|---|
| 12-GA-01 | Life Agent | 2 hours | $67 |
| 12-GA-02 | Accident/Sickness Agent | 2 hours | $67 |
| 12-GA-05 | Life/Accident/Sickness Agent COMBO | 2.5 hours | $67 |

The combo is an official exam in that table. It is not a study mode invented for this app. The three rows are marked available in Spanish.

Outline headings (scored + pretest):

- Life: **80 scored + 10 pretest**
- Accident and Sickness: **80 scored + 10 pretest**
- Life, Accident and Sickness: **125 scored + 10 pretest**

The handbook score section says the reported score is the percentage answered correctly and: "You need to answer 70% of questions correctly in order to pass the examination." The same section says the Georgia Insurance Department set the passing score and that forms are equated. Pretest items are mixed in, are not identified, and do not affect the official score.

This app's full practice sim uses the **sitting** length and time (90 questions / 120 minutes, or 135 / 150). **Every item in the sim is graded.** It does not insert 10 unidentified unscored items. The extra 10 questions, compared with the scored counts, are spread by the official section weights. That is practice timing, not a copy of Pearson's scoring.

## Section weights used

Weights are scored-section counts divided by the scored total in outline #121102. They are not estimated.

Life (80): types 15, provisions 15, application/underwriting/delivery 12, retirement and other concepts 8, Georgia laws common to life and accident & sickness 24, Georgia life-only rules 6.

Accident and sickness (80): types 16, provisions 15, social insurance 6, other concepts 5, field underwriting 8, Georgia laws common 24, Georgia accident-and-sickness-only rules 6.

Combo (125): life types 15, life provisions 15, life application 12, life retirement/other 8, accident-and-sickness types 16, provisions 15, social insurance 6, other concepts 5, field underwriting 8, Georgia common 19, Georgia life-only 3, Georgia accident-and-sickness-only 3.

Social Security items sit in the life "other concepts" pool and in the accident-and-sickness social-insurance pool. On the combo sim they are only in social insurance, so one item is not drawn twice. Contract-law items are in both single-exam application/field sections, and only in the life application section of the combo sim, for the same reason.

## Question provenance

`GA_Exam_Prep.html` is built by `scripts/build_ga_exam.py`.

- **original-georgia** (72 items) in `content/ga-law-questions.json`. Written for this branch. Not Pearson items. Each explanation cites a page that was opened for this branch. Twenty of those items were added after the source gaps below were read.
- **reused-national-screened** (487 items). Taken from the existing Maryland and Virginia banks only when the topic is a general life/health topic, the stem is not a duplicate, and the text does not match a state-leak screen (Maryland, Virginia, COMAR, Title 38.2, guaranty, a numbered free-look, "your state", and similar). Topic labels were remapped onto the Georgia outline. They remain practice items from this project, not official exam questions.

Pearson states that its examination questions are copyrighted and are not available for distribution. None were copied.

## Law pages actually read

Code text below is the 2025 Code of Georgia compilation on Justia, opened 2026-11-07. Where a second public copy was opened, it is named. These are not a substitute for the Official Code of Georgia Annotated.

- O.C.G.A. § 33-3-1 domestic, foreign, and alien: https://law.justia.com/codes/georgia/title-33/chapter-3/section-33-3-1/
- O.C.G.A. § 33-6-4 unfair methods and deceptive practices, including the rebate and $100 promotional text: https://law.justia.com/codes/georgia/title-33/chapter-6/article-1/section-33-6-4/
- O.C.G.A. § 33-23-35 premiums. Justia and Georgia Commons (through the 2025 regular session) agree on the fiduciary rule and the $1,000 felony threshold: https://law.justia.com/codes/georgia/title-33/chapter-23/article-1/section-33-23-35/ and https://georgiacommons.org/code/33-23-35
- O.C.G.A. § 33-24-3 insurable interest: https://law.justia.com/codes/georgia/title-33/chapter-24/article-1/section-33-24-3/
- O.C.G.A. § 33-24-6 consent of the insured: https://law.justia.com/codes/georgia/title-33/chapter-24/article-1/section-33-24-6/
- O.C.G.A. § 33-43-1 Medicare supplement definitions, including the 63-day creditable-coverage break: https://law.justia.com/codes/georgia/title-33/chapter-43/section-33-43-1/
- O.C.G.A. § 33-42-1 and § 33-42-3 long-term care: https://law.justia.com/codes/georgia/title-33/chapter-42/section-33-42-1/ and https://law.justia.com/codes/georgia/title-33/chapter-42/section-33-42-3/
- Ga. Comp. R. & Regs. 120-2-24 replacement of life insurance, including Exhibit A's 10-day individual life return language: https://rules.sos.ga.gov/gac/120-2-24

The outline cites insurable interest as 33-24-6. In the 2025 code that was opened, § 33-24-6 is consent of the insured and § 33-24-3 is insurable interest. Practice items cite the section whose text was read.

## Source gaps closed on the fix pass

Opened 2026-11-09. No review comments were posted on PR #1 at the time of this pass.

- **Guaranty limits.** O.C.G.A. § 33-38-7(a)(12), 2025 Code text: https://law.justia.com/codes/georgia/title-33/chapter-38/section-33-38-7/ The association's benefit is the lesser of the insurer's contractual obligation and the statutory caps. For one life: life death benefits $300,000, but not more than $100,000 net cash surrender and withdrawal; disability income $300,000; long-term care $300,000; other non-health-benefit-plan health insurance $300,000; health benefit plans $500,000; annuity present value $300,000, but not more than $250,000 net cash surrender and withdrawal. Aggregate for one life is $300,000, or $500,000 if health benefit plan benefits are included. One owner of multiple nongroup life policies, and certain unallocated annuity owners, are capped at $5 million. Subsection (b) limits this section to liquidations with a finding of insolvency on or after July 1, 2020. The association's own FAQ repeats the advertising ban and says the statute controls if the FAQ conflicts: https://www.glhiga.org/faqs.html
- **Advertising the association.** O.C.G.A. § 33-38-21, version effective until January 1, 2027: https://law.justia.com/codes/georgia/title-33/chapter-38/section-33-38-21/ An agent may not use the association's existence to sell or solicit. After notice and hearing, the Commissioner may impose up to $1,000 per act, not more than $10,000 in the aggregate, or suspend or revoke the license. A later version is scheduled for January 1, 2027 and was not the text used here.
- **Rule 120-2-16-.34.** Full rule text loaded from https://rules.sos.ga.gov/gac/120-2-16 Partnership policies must meet O.C.G.A. §§ 33-42-4 and 49-4-162, cover a Georgia resident, be IRC § 7702B(b) qualified, and be issued no earlier than January 1, 2007. Inflation: compound annual if the buyer is under 61; some inflation protection from 61 through 75; optional at 76 and older. Sellers need at least 8 hours initial training and 4 hours every 24 months. Form LTCP 200-A, printed in the rule, defines asset disregard as Medicaid disregard equal to benefits received and says purchase does not automatically confer Medicaid eligibility.
- **Outline citation "Reg. 100-2-10 through 12."** That string is in the #121102 PDF. rules.sos.ga.gov publishes Subject 120-2-10 (insurance contract) and Subject 120-2-12 (accident and sickness advertising). No insurance subject 100-2-10 was found. Practice items tell the student to study 120-2-10 and 120-2-12 and not to treat 100-2-10 as a real insurance rule. https://rules.sos.ga.gov/gac/120-2-10 and https://rules.sos.ga.gov/gac/120-2-12
- **Chapters 33-29 and 33-30.** The 2025 Official Code of Georgia Annotated supplement published under authority of the State lists Chapter 29 as Individual Accident and Sickness Insurance, §§ 33-29-1 through 33-29-22, and Chapter 30 as Group or Blanket Accident and Sickness Insurance, §§ 33-30-1 through 33-30-29: https://www.legis.ga.gov/api/document/docs/default-source/joint-features-document-library/t33-ch23-66-%28v25%29-pdf.pdf The supplement reprints amended sections, not the full unchanged text of every section. Pearson's group citation stops at 33-30-15; the official index continues through 33-30-29. Rule 120-2-10-.03 expressly applies O.C.G.A. § 33-29-6 to outpatient reimbursement on individual accident and sickness policies. Unchanged section text that the supplement does not reprint is not invented into questions.
- **Rule 120-2-8.** https://rules.sos.ga.gov/gac/120-2-8 Open enrollment is the six months beginning when the person is both 65 or older and enrolled in Medicare Part B (120-2-8-.11). Six months of continuous creditable coverage in that window bars a preexisting-condition exclusion. A Medicare supplement that replaces one in force at least six months may not impose a new preexisting, waiting, elimination, or probationary period (120-2-8-.23).
- **Rule 120-2-11.** https://rules.sos.ga.gov/gac/120-2-11 Life and annuity advertising must be truthful. An advertisement may not imply a governmental endorsement of the insurer unless the entity authorized that use (120-2-11-.08).
- **Rule 120-2-16 other than .34.** The same rules page includes the long-term care standards. Alzheimer's disease may not be excluded as a mental or nervous disorder (120-2-16 limitation text). Partnership detail is in .34, above.
- **Rule 120-2-31.** https://rules.sos.ga.gov/gac/120-2-31 A Buyer's Guide is required before solicitation. A Policy Summary is required before the initial premium unless the policy or the summary gives an unconditional refund of at least ten days. Failure to deliver them is an omission that misrepresents policy terms (120-2-31-.08).
- **33-24-6 versus 33-24-3.** The outline's life-only line says "Insurable Interest Ref: 33-24-6." The 2025 code titles do not match that cross-reference. Section 33-24-3 is insurable interest in personal insurance: https://law.justia.com/codes/georgia/title-33/chapter-24/article-1/section-33-24-3/ Section 33-24-6 is consent of the insured, including the spouse exception: https://law.justia.com/codes/georgia/title-33/chapter-24/article-1/section-33-24-6/ Questions cite the section whose text was read. They do not teach 33-24-6 as the insurable-interest definition.

## Still not used as an answer

- Commissioner penalty amounts in § 33-6-9 and the examination-of-records sections in §§ 33-2-10 through 33-2-13 were not read, so no question states those amounts or procedures.
- The full operative text of unchanged sections in Chapters 33-29 and 33-30 is not in the public 2025 supplement PDF. Those sections are not guessed.
- Prelicensing hour splits in the handbook's license table were too compressed in text extraction to use. The items use the handbook's prose that a prelicensing course is valid for one year.
- O.C.G.A. § 33-38-21 changes on January 1, 2027. Items use the version effective until that date.

## Storage and the report service

Georgia progress uses `ga_exam_v1` plus `ihub_*_GA` keys (plan, track, today, results, sync flags, welcome, coach log). The coach API key and model on this page are `ihub_coach_apikey_GA` and `ihub_coach_model_GA`, so they do not read or write the Maryland/Virginia key. Theme and the team code (`ihub_team`) stay shared, which is how a hub link remembers `?team=`.

The Google Apps Script that receives Maryland and Virginia reports is not in this repository. Georgia sets `GA_SYNC_OFF` and an empty sync URL. The page does not POST progress. A team code in the link is stored in the browser and printed on the local report. It is not sent, and no team code is hard-coded.

## Checks

`node tests/ga-exam-check.mjs` parses the page, boots it in a stub browser, and checks track draws, storage keys, the sync gate, and the report title. It does not call Pearson, Anthropic, or the report endpoint.
