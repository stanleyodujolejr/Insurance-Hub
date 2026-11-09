# Georgia progress sync — proposed Apps Script change

Maryland and Virginia post progress only. They do not call the report URL with GET. The script behind that URL is not in this repository, so this project cannot show whether a `state` of `GA` is stored separately from Maryland and Virginia. Do not assume the current deployment already does that.

`GA_Exam_Prep.html` now uses the same opt-in send as those two pages, aimed at the same web-app URL. The post includes `state: "GA"` and `exam` set to `12-GA-01` (Life), `12-GA-02` (Accident and Sickness), or `12-GA-05` (combo). `summary.track` repeats that as `Life 12-GA-01`, `A&S 12-GA-02`, or `Combo 12-GA-05`. Sending stays off until the student types a first name and turns it on. If the script rejects the post, or the response is not JSON with `ok: true`, the page records the error and studying continues. Nothing is posted during that failure.

## Paste and redeploy

1. Open the existing Apps Script project that owns the current web-app deployment. Do not create a second web app.
2. Open `apps-script/GA_SYNC_PROPOSED.gs` in this repo. Copy `handleGeorgia_` and `jsonOut_` into the project if those names are not already used.
3. In the existing `doPost`, after the body is parsed, add: if `body.state === 'GA'`, return `handleGeorgia_(body)`. Leave the Maryland and Virginia path as it is.
4. In the spreadsheet bound to that script, the first Georgia post creates a tab named `Georgia` if it is missing. You can create that tab yourself first; the header row is `sentAt`, `name`, `team`, `exam`, `track`, `answered`, `accuracy`, `readiness`, `weakest`, `report`.
5. Deploy: Manage deployments, edit the existing web app, set the version to New version, and deploy. Keep the same URL. Execute as the script owner, and leave access as it already is for the Maryland and Virginia page.
6. On the Georgia page, turn auto-send on with a test name. A row should appear on the Georgia tab, and the page should say it was sent. If the script is not updated yet, the page shows that it was not sent and does not block the exam.

Do not point Georgia at a new `/exec` URL unless you also change `IHUB_SYNC_URL` in `GA_Exam_Prep.html`.
