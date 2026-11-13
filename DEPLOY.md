# Deploy the Apps Script

Pushes to `main` that change `apps-script/live/` run `.github/workflows/deploy-apps-script.yml`. A change that only touches `.clasp.json` does not. The workflow installs the pinned `@google/clasp` 3.4.1 from `tools/clasp` with `npm ci --ignore-scripts`, pushes that folder to the existing Apps Script project, and, when a deployment ID is configured, updates that same web app so the study pages keep their current URL.

You do the steps below once, on your own PC. Nothing in this list is committed. `.clasp.json` and `.clasprc.json` are gitignored.

## 1. Turn on the Apps Script API

In a browser, open [https://script.google.com/home/usersettings](https://script.google.com/home/usersettings) while signed in as the Google account that owns the script. Turn **Google Apps Script API** on.

## 2. Log in with clasp

Install the Node.js LTS installer from [https://nodejs.org](https://nodejs.org) if you do not already have Node.js 20 or newer. Open PowerShell and check:

```powershell
node -v
```

From any folder, log in with the same clasp version the workflow uses:

```powershell
npx --yes @google/clasp@3.4.1 login
```

A browser window opens. Sign in as the account that owns the Apps Script project and allow access. clasp writes a login token to:

```text
%USERPROFILE%\.clasprc.json
```

That file is a credential. Do not commit it, email it, or paste it into chat. Close the editor when you are done copying it.

## 3. Create the production environment, then add its secrets

The workflow job uses the GitHub environment named `production`. Create that environment before the first run. If a run happens first, GitHub creates `production` with no branch limit.

On GitHub open this repository, then **Settings → Environments → New environment**. Name it `production`.

Leave **Required reviewers** empty. Do not add yourself. A required reviewer would wait for a click on every deploy, including the automatic deploy after a merge to `main`.

Under **Deployment branches and tags**, choose **Selected branches and tags**. Add a branch rule for `main` only. Do not add any other branch.

Save the protection rules. Then, on that same `production` environment page, open **Environment secrets** and add:

| Name | What to paste |
| --- | --- |
| `CLASPRC_JSON` | The entire contents of `%USERPROFILE%\.clasprc.json` |
| `APPS_SCRIPT_ID` | Apps Script editor → **Project Settings** → **Script ID** |
| `DEPLOYMENT_ID` | Apps Script editor → **Deploy** → **Manage deployments** → the ID of the web app the study pages already use |

Do not also create those names under **Settings → Secrets and variables → Actions** (repository secrets). A workflow run from another branch can read repository secrets. Secrets on `production` are available only to jobs GitHub allows onto that environment, which is `main` after the branch rule above. The workflow also skips the job unless `github.ref` is `refs/heads/main`.

Copy the credentials file onto the clipboard without printing it:

```powershell
Get-Content -Raw -Path "$env:USERPROFILE\.clasprc.json" | Set-Clipboard
```

Paste that into `CLASPRC_JSON` and save. Paste the raw JSON only. Do not wrap it in extra quotes. Pretty-printed or one-line JSON both work.

`CLASPRC_JSON` and `APPS_SCRIPT_ID` are required. If either is missing, the workflow stops before it pushes and prints which secret to add.

`DEPLOYMENT_ID` is optional. When it is set, the workflow runs `clasp deploy -i` for that deployment. That creates a new version from the files just pushed and points the existing deployment at it, so the web-app URL does not change. When it is unset, the workflow still pushes, then logs that deploy was skipped. The live URL keeps serving the previous version until you add the secret and run the workflow again from `main` (**Actions → Deploy Apps Script → Run workflow**, with the branch selector left on `main`).

Copy the deployment that already serves the exam pages. Do not create a new deployment. A new deployment gets a new URL, and the pages would keep posting to the old one.

## 4. What runs after that

A push to `main` that changes a file under `apps-script/live/`, other than `.clasp.json`, starts **Deploy Apps Script**. Changing only this workflow, or only `.clasp.json`, does not. You can also start it by hand from the Actions tab. Choose the `main` branch. Any other branch skips the job before it reads the secrets.

On the runner the workflow writes `~/.clasprc.json` from `CLASPRC_JSON` and writes a repo-root `.clasp.json` whose `scriptId` is `APPS_SCRIPT_ID` and whose `rootDir` is `apps-script/live`. It then runs `clasp push -f`. Those files stay on the runner and are deleted at the end of the job. The workflow steps do not print them.

## Optional: push from this PC

You do not need a local `.clasp.json` for the GitHub Actions path. If you want to push from PowerShell, create the file yourself and do not commit it. From the repository root, `.clasp.json` looks like this:

```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "rootDir": "apps-script/live"
}
```

From the repository root, use the same locked clasp the workflow installs:

```powershell
npm ci --ignore-scripts --prefix tools\clasp
npx --prefix tools\clasp clasp push -f
npx --prefix tools\clasp clasp deploy -i YOUR_DEPLOYMENT_ID
```

`APPS_SCRIPT_GA_SETUP.md` is the earlier manual checklist. Its `cp .clasp.json` step needs the local file above. That file is not in git.
