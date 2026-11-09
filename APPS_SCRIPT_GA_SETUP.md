# Georgia progress sync — setup order

The page already points at the same web-app URL as Maryland and Virginia, and `GA_SYNC_LIVE` is `false`. While that flag is false, the Georgia page can show the team-lead section, but it does not POST and it does not call `sendBeacon`. The note on the page is: Team sending isn't switched on yet.

Merging the page is safe before this script change. Do not set `GA_SYNC_LIVE` to `true` in the same change that edits the script.

`apps-script/GA_SYNC_PROPOSED.gs` is a new file for the existing project. It does not contain `doPost`. Apps Script has one global scope, so a second `doPost` would replace the live one and break Maryland and Virginia.

## Order

1. Add the script file and one line, then redeploy the same deployment.
   - Open the Apps Script project that owns the current web app. Do not create a second web app.
   - Add `apps-script/GA_SYNC_PROPOSED.gs` as a new file. Leave every existing file as it is.
   - In the existing `doPost`, after the JSON body is parsed and before the existing Maryland and Virginia handling, add this line only:

     `if (data.state === 'GA') return handleGeorgia_(data);`

     Use the variable name that file already uses for the parsed body (`data` or `body`).
   - Deploy: Manage deployments, edit the existing web app, version New version, deploy. Keep the same URL. Execute as the script owner, and leave access as it already is.

2. Send one test Georgia row.
   - In the Apps Script editor, run `testGeorgiaRow`. It calls `handleGeorgia_` with a fake payload, writes a row on the `Georgia` tab, and checks that a name starting with `=` was stored as text. Delete that test row afterward.
   - Or, after the redeploy, POST once to the same `IHUB_SYNC_URL` already in `GA_Exam_Prep.html`:

     ```bash
     curl -sS -X POST -H 'Content-Type: text/plain;charset=utf-8' \
       --data '{"name":"Sync test","state":"GA","team":"test","exam":"12-GA-01","sentAt":0,"summary":{"track":"Life 12-GA-01","answered":1,"accuracy":100,"readiness":70,"weakest":""},"report":"test row"}' \
       "$IHUB_SYNC_URL"
     ```

     A working script responds with `{"ok":true,"lead":""}` and adds a row on the `Georgia` tab. Delete the test row.

3. Confirm Maryland and Virginia still land on their existing tabs. Send or wait for one real or test post from each page and check that those rows did not move onto the Georgia tab.

4. In a follow-up pull request, change `var GA_SYNC_LIVE=false;` to `var GA_SYNC_LIVE=true;` in `GA_Exam_Prep.html`. That is the line that allows the page to POST. Until then, turning auto-send on in the browser does not contact the script.

The first Georgia post creates a tab named `Georgia` if it is missing. The header row is `sentAt`, `name`, `team`, `exam`, `track`, `answered`, `accuracy`, `readiness`, `weakest`, `report`. String cells that start with `=`, `+`, `-`, `@`, a tab, or a carriage return are prefixed with an apostrophe before they are written.
