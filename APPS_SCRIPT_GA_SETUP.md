# Georgia progress sync

The live Apps Script is in `apps-script/live/`. It is the project Insurance Hub progress sync (`scriptId` `1lmwo8X8yWRHlt3xlIQVq_pfODLmXAktrmhGusopHLvcerdJGPLI7N3bk`), bound to the sheet Insurance Hub Progress. The web app `AKfycbwda1rK5LLe7j1KgqQwa-SV5tbMJ5KsE0GsJT-6CDkb-JlKxOzEp0qu_kMDqbG7Y-ii` is deployment version 5, which accepts `state` `GA`. `user_progress.gs` in this repo matches that deployment. Version 4 is the previous deployment and the rollback target below.

Georgia posts the same shape Maryland and Virginia already post: `name`, `state`, `team`, `summary`, `result`, and `report`. The Pearson track is `summary.track` (`Life 12-GA-01`, `A&S 12-GA-02`, or `Combo 12-GA-05`). The script stores that as Exam type on Log, Latest, and Results, so the Sunday team-lead digest includes it. There is no separate Georgia tab.

Sync is live. `GA_SYNC_LIVE` is `true` in `GA_Exam_Prep.html`. The page uses the same web-app URL as Maryland and Virginia and Georgia's own storage keys (`ihub_sync_GA` and the other `ihub_*_GA` keys). Nothing is posted until the student types a first name and turns auto-send on.

## Changes from the live script

1. **GA acceptance.** `doPost` accepts `state` `GA` in the same check that accepts `MD` and `VA`: `st !== 'MD' && st !== 'VA' && st !== 'GA'`.
2. **GA-only escaping.** For a Georgia row, every string field is passed through `oneLine` and then `asText` before it is written to Log, Latest, or Results (`gaWrite`). `asText` prefixes a value that starts with `=`, `+`, `-`, `@`, a tab, or a carriage return with an apostrophe. Maryland and Virginia rows return before that step and are written with the same values as the live script.
3. **`tidyRows`.** Flattening a line break can rebuild a formula. `=X` plus a newline plus `Y` becomes `=X | Y`, and a raw `setValues` would run that. When that row's State is `GA`, `tidyRows` writes `asText` of the flattened value. Maryland and Virginia cells are still written as `oneLine` only.
4. **`testGeorgiaRow`.** Editor function. It posts one fake Georgia row through `doPost`, checks Latest, then deletes the row. The name cell must read `=Sync test` with an empty formula. The report `=X\nY` must be stored as the plain text `=X | Y` with an empty formula.
5. **`cleanupGeorgiaTestRows`.** Deletes every row whose Name is `=Sync test`, State is `GA`, and Team is `test` on Log, Latest, and Results. `testGeorgiaRow` calls it. Run it yourself after the curl check.

Sheets does not keep the apostrophe: the cell shows the original text and has no formula.

## Deploy with clasp 3.4.1

Do this after the pull request is merged. Do not paste the script by hand and do not create a second web app. `clasp redeploy <deploymentId>` is the 3.4.1 command that updates an existing deployment (`update-deployment`). With no version flag it creates a new version from the pushed files and points that deployment at it. `clasp deploy -i <id>` calls the same operation.

From `apps-script/live`:

1. Pull the remote project into a temp folder and diff it against this directory. clasp 3.4.1 writes the script as `user_progress.js`. Compare that file to `user_progress.gs`. The only expected script difference is the list above. If the pull differs anywhere else, stop.

   ```bash
   rm -rf /tmp/ihub-clasp-pull
   mkdir -p /tmp/ihub-clasp-pull
   cp .clasp.json /tmp/ihub-clasp-pull/
   (cd /tmp/ihub-clasp-pull && clasp pull)
   diff -u /tmp/ihub-clasp-pull/user_progress.js user_progress.gs
   diff -u /tmp/ihub-clasp-pull/appsscript.json appsscript.json
   ```

2. See which files will go up. Expect `appsscript.json` and `user_progress.gs`.

   ```bash
   clasp status
   ```

3. Push. This updates the project head. The web app stays on version 4.

   ```bash
   clasp push
   ```

4. In the Apps Script editor, run `testGeorgiaRow`. That uses the pushed head, not the web app. It removes its own Log and Latest rows before it returns.

5. Confirm a Maryland or Virginia post. The URL is still version 4, so this checks that the deployment was not moved. State on that row stays `MD` or `VA`.

6. Point the same deployment at the new version. The URL does not change.

   ```bash
   clasp redeploy AKfycbwda1rK5LLe7j1KgqQwa-SV5tbMJ5KsE0GsJT-6CDkb-JlKxOzEp0qu_kMDqbG7Y-ii
   ```

Optional curl, only after step 6, to the `IHUB_SYNC_URL` in `GA_Exam_Prep.html`. Then run `cleanupGeorgiaTestRows` in the editor. That is what removes the curl row. `testGeorgiaRow` already removes its own rows, so do not rely on the curl for cleanup.

```bash
curl -sS -X POST -H 'Content-Type: text/plain;charset=utf-8' \
  --data '{"name":"=Sync test","state":"GA","team":"test","summary":{"track":"Life 12-GA-01","answered":1,"accuracy":100,"readiness":70,"weakest":""},"result":{},"report":"=X\nY"}' \
  "$IHUB_SYNC_URL"
```

A working script responds with `{"ok":true,"lead":""}` (or a leader name when `test` is on the Teams tab). On Latest, the name cell shows `=Sync test` as plain text with no formula, and the report shows `=X | Y` as plain text with no formula. Then run `cleanupGeorgiaTestRows`.

Rollback is the same deployment id at version 4:

```bash
clasp redeploy AKfycbwda1rK5LLe7j1KgqQwa-SV5tbMJ5KsE0GsJT-6CDkb-JlKxOzEp0qu_kMDqbG7Y-ii -V 4
```

`var GA_SYNC_LIVE=true;` is already set in `GA_Exam_Prep.html`. That is the line that allows the page to POST. Set it back to `false` only to stop Georgia posts without redeploying the script.
