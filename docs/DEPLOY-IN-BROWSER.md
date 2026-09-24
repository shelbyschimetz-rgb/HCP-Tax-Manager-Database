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

## Updating later (keeps the same link)
1. Paste the new **Code.gs** and **index.html** over the old ones and save.
2. Go to **Deploy → Manage deployments** → **pencil icon** → **Version: New version** → **Deploy**.

## If something goes wrong
- **"Drive is not defined"** when uploading a workbook: click **Services +** → **Drive API** (v3) → **Add**.
- **"Tax Manager isn't set up yet"** when opening the app: run `setup` again (step 5).
- **"You don't have access yet"**: that person's email isn't in the Identity tab, or **active** isn't `TRUE`.
