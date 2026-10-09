# Deploy Tax Manager in the browser (no command line)

You need three files: **Code.gs**, **index.html**, and **appsscript.json**. To regenerate them from the code, run `npm run paste`; they land in `tax-manager/paste/`. Sign in to Chrome with your **housecallpro.com** Google account first.

## 1. Create the project
1. Go to **https://script.google.com** → **New project**.
2. Click **Untitled project** at the top and rename it **Tax Manager**.

## 2. Paste the settings file
1. Click the **gear icon (Project Settings)** on the left.
2. Tick **"Show 'appsscript.json' manifest file in editor"**.
3. Click the **< > (Editor)** icon on the left, then open **appsscript.json**.
4. Select everything in it, delete it, paste in the contents of **appsscript.json**, and press **Ctrl/⌘ + S**.

## 3. Paste the code file
1. Open **Code.gs**.
2. Select everything, delete it, paste in the contents of **Code.gs**, and press **Ctrl/⌘ + S**.

## 4. Add the page file
1. Next to **Files**, click **+** → **HTML**.
2. Name it exactly **`index`**. The editor adds `.html` for you.
3. Select everything in the new file, delete it, paste in the contents of **index.html**, and press **Ctrl/⌘ + S**.

## 5. Run setup (one time)
1. Make sure **Code.gs** is open.
2. In the toolbar's function dropdown, pick **`setup`** and click **▶ Run**.
3. When it says *Authorization required*: **Review permissions** → pick your account → **Allow**.
4. Wait for "Execution completed". The log shows a link to the new **Tax Manager DB** spreadsheet in your Drive.

## 6. Publish
1. Click **Deploy** (top right) → **New deployment**.
2. Click the gear next to *Select type* → **Web app**.
3. Fill in the dialog:
   - **Description:** `v1`
   - **Execute as:** **Me**
   - **Who has access:** **Anyone within Housecall Pro**
4. Click **Deploy** and copy the **Web app URL**. That's the link your team uses.

## 7. Set it up for the team
1. Open the **Tax Manager DB** spreadsheet → **Identity** tab and add one row per teammate:
   - **name**
   - **email**
   - **active:** `TRUE`
   - **roles:** e.g. `ADVISOR,PREPARER` or `OS`
   - **accepting_new:** `TRUE`
2. Open the app → **Settings**:
   - Paste the link to the Salesforce "New Tax Onboarding Cases" sheet and click **Sync now**.
   - Paste the link to the shared Drive client-data folder.
3. Optional: use **Import** on the Pros page, then the Projects page, to bring in Asana CSV exports.

## Importing from Asana
1. In Asana, export the **HCP Tax Pros** and **HCP Tax Returns** project lists to CSV.
2. In Tax Manager, go to **Pros → Import**, choose **Pros**, pick the pros CSV, then **Preview → Import**.
3. Then go to **Projects → Import**, choose **Projects**, pick the returns CSV, then **Preview → Import**. The returns import takes several minutes; keep the tab open.

Rows are matched by Org ID and by each Asana project's own link, so re-importing a file updates records instead of duplicating them. Import once, at cutover: re-importing overwrites edits made in Tax Manager since.

## Daily reports sheet
In **Settings → Daily reports sheet**, click **Export now** once. That creates **Tax Manager Reports** in your Drive and turns on the daily refresh (~6am): Pros, Tax Returns, each report, **Peer reviews**, **Peer review summary**, and a growing **Pipeline history** tab.

## Updating later (keeps the same link)
1. Paste the new **Code.gs** and **index.html** over the old ones and save.
2. Go to **Deploy → Manage deployments** → **pencil icon** → **Version: New version** → **Deploy**.
3. If the update adds a background job, open **Settings** in the app and click **Save settings** (or run `setup` again) to switch it on.

New database tabs and columns (like **PeerReviews**) are added automatically the first time someone opens the app after an update. You don't need to run `setup` again.

## Onboarding case source
Cases come from the **Tax OB Cases** tab of the "Tax ACE SF Reports Refresh" sheet. In **Settings → Salesforce onboarding feed**, paste the link to that tab (with `#gid=98552997` on the end), click **Save settings**, then **Sync now**. The tab is picked from the link. Both `Account Name` and `ACCOUNT_NAME` style headers work.

## Salesforce cases from past years
The sync only takes cases whose **Created Date** is in the current calendar year or later. The cutoff moves forward on its own every January 1. To clear out cases that came in before this rule existed, go to **Settings → Salesforce onboarding feed → Clear out old cases** and click **Find old cases**. It shows:
- how many untouched pros would be removed (their empty Drive folders go to the Drive trash for 30 days);
- which pros have work and will be kept. Those only leave the Inbox.

Click **Clean up** to run it. If it says there are more to do, click **Find old cases** again.

## Churned pros
In **Settings → Churned pros**, click **Preview** to see which pros would be archived from the "Bizsol Retention Data - All Time" report (**Tax** tab, Status = Closed and Sub-Status = Lost). Click **Archive now and turn on daily** to run it and switch on the ~5am daily check. Complete returns are never archived. A pro whose last row is Closed / Saved is left alone. Restoring a pro from Archive sticks until a new Lost case appears. The report must be shared with the account Tax Manager runs as.

## Fresh start for tasks
**Settings → Fresh start for tasks** moves open tasks created before this Monday out of everyone's lists, either advisors' tasks only or everyone's. They go to the **TasksArchive** tab in the database sheet, so nothing is lost.

## "Someone else is saving" errors
Tax Manager saves one change at a time. The app now waits up to 30 seconds and retries a busy save quietly up to 3 times before showing an error. The Salesforce sync and the churn check also save in small batches instead of holding up everyone else. If the message still shows up often, tell the admin the time it happened.

## Peer review
Peer review replaces the Slack "Tax QA Peer Review" workflow. Preparers submit from a project's **Peer review** tab, and reviewers claim from **Peer Review** in the sidebar. Only people with `PEER_REVIEWER` (or EXEC/ADMIN) in their Identity roles can claim reviews, so add that role to every reviewer before you retire the Slack workflow.

## If something goes wrong
- **Health check:** add `?diag=1` to the end of the app URL (…/exec?diag=1). It lists each part of the setup as OK or FAIL, with the fix.
- **Blank page, or stuck on "Loading Tax Manager…":** `index.html` was probably cut off when pasted. Open the file in Notepad, press Ctrl+A then Ctrl+C, and paste it again. The file must end with `</html>`. Don't open `index.html` in a browser and copy from there; that copies the rendered page, not the file.
- **Test changes without redeploying:** **Deploy → Test deployments** gives a `/dev` link that always runs the latest saved code.
- **"Drive is not defined"** when uploading a workbook: click **Services +** → **Drive API** (v3) → **Add**.
- **"Tax Manager isn't set up yet"** when opening the app: run `setup` again (step 5).
- **"You don't have access yet"**: that person's email isn't in the Identity tab, or **active** isn't `TRUE`.
