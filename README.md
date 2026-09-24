# Tax Manager

Tax Manager is the internal Google Apps Script web app that replaces the tax team's Asana workflow. It covers pros, projects (returns), task templates, the Salesforce onboarding inbox, the intake wizard, the work timer, stage analytics, and CSV reports.

Built from the design handoff in [`docs/design/`](docs/design/README.md). The UI matches that prototype: Housecall Pro tokens, side-drawer details, a sync-status pill, and single-button task compose. All data lives in a Google Sheet that this app creates for you.

---

## Deploy it (first time, ~15 minutes)

You need a Google Workspace account on the `housecallpro.com` domain and Node.js 18+ (`node -v`). Run everything from this `tax-manager/` folder.

1. **Turn on the Apps Script API** for your Google account (one time):
   https://script.google.com/home/usersettings → *Google Apps Script API* → **On**.

2. **Install and log in:**
   ```bash
   cd tax-manager
   npm install
   npx clasp login          # opens a browser; pick your housecallpro.com account
   ```

3. **Create the Apps Script project.** This writes `.clasp.json`; commit it, since it only holds the script ID and isn't a secret.
   ```bash
   npx clasp create-script --type standalone --title "Tax Manager" --rootDir dist
   ```

4. **Build and upload the code:**
   ```bash
   npm run push
   ```

5. **Run setup once.** Open the project (`npx clasp open-script`), choose **`setup`** in the function dropdown, and click **Run**. Approve the permissions prompt: Sheets, Drive, triggers, and your email. Setup then:
   - creates the **Tax Manager DB** spreadsheet in your Drive, with every tab and header;
   - adds **you** to the team roster as EXEC + ADMIN;
   - seeds the default Pro (10) and Project (25) task templates;
   - installs the background jobs: Salesforce sync every 4h, and timer auto-stop hourly.

   The execution log prints the spreadsheet URL. `setup` is safe to re-run at any time; it only adds what's missing.

6. **Publish the web app:**
   ```bash
   npm run deploy
   ```
   The first run creates the deployment and saves its ID in `.deployment-id` (commit that too). It then prints the app URL:
   `https://script.google.com/a/macros/housecallpro.com/s/<id>/exec`

   The deployment runs **as you** and is open to **anyone at housecallpro.com** who is on the roster (settings in `appsscript.json`).

7. **Add the team.** Open the DB spreadsheet → **Identity** tab. Add one row per person:

   | name | email | active | roles | accepting_new | color |
   |---|---|---|---|---|---|
   | Jane Doe | jane.doe@housecallpro.com | TRUE | ADVISOR,PREPARER | TRUE | |

   Roles (comma-separated): `ADVISOR, PREPARER, PEER_REVIEWER, OS, BK, BK_LEAD, BK_TEAM_LEAD, EXEC, ADMIN`. EXEC/ADMIN can edit templates, change settings, and run imports. `accepting_new = FALSE` takes an advisor out of the round-robin.

8. **Connect the integrations.** In the app, go to **Settings** (visible to EXEC/ADMIN):
   - **Salesforce feed:** paste the URL of the "New Tax Onboarding Cases" sheet. The deploying account needs view access. Click **Sync now** to test.
   - **Drive parent folder:** paste the URL of *HCP Tax Shared Drive / client data*. The deploying account needs edit access. Per-pro folders are created as `Business (OrgID)-TAX`.

9. **Migrate from Asana.** Export each Asana project to CSV (… → Export → CSV), then use **Import** on the Pros list first, then on the Projects list. Columns are matched by name (`Org ID`, `Name`, `Filing Type`, `Return Stage`, `Extension Needed?`, `Assignee Email`, …). Rows update existing records, and the preview shows exactly what will change. For new projects the importer creates the template tasks, and sections before the project's current stage are pre-marked done.

### Shipping updates later

```bash
git pull
npm run deploy      # builds, pushes, and updates the SAME deployment, so the URL doesn't change
```

---

## How it works

```
tax-manager/
├── src/server/        Apps Script (V8) — runs in Google's cloud
│   ├── Web.js         doGet: serves index.html with the first data payload inlined
│   ├── Api.js         api(action, payload): the one entry point for google.script.run
│   ├── Db.js          Sheet-as-database: header-mapped rows, row_version concurrency
│   ├── Identity.js    roster, current user, Case Owner → email resolver, lock, audit
│   ├── Records.js     pros, projects, stage history, notes, outstanding items
│   ├── Tasks.js       template materialization, due-date anchors, done cascade
│   ├── Templates.js   template CRUD, versions, seed data
│   ├── Work.js        advisor load balancer (least-loaded + round-robin), work timer
│   ├── Sfdc.js        Salesforce sheet sync → pros + inbox; claim; Drive folders
│   ├── Intake.js      workbook import (label-keyed extraction), wizard answers
│   ├── Reports.js     the six reports
│   ├── Migration.js   Asana CSV import
│   └── Setup.js       setup(), triggers, Drive API helper
├── src/client/        React UI (bundled + inlined into one index.html by build.mjs)
├── appsscript.json    manifest: V8, Drive advanced service, scopes, web-app access
├── tests/             server tests (real server code on in-memory Sheets fakes) + client tests + browser e2e
└── dev/               local dev server with demo data
```

**Database.** The tabs are `Pros, Projects, Tasks, TaskTemplates, TemplateVersions, AuditLog, Notes, TimeEntries, ProjectStageHistory, OutstandingItems, Identity, SfdcIntakeQueue, IntakeAnswers`. Columns are looked up by header name, so reordering columns or adding your own columns in the sheet is safe. Cells are stored as plain text. Every write runs under a script lock. Records carry a `row_version`, so if two people edit the same pro, the second save is rejected and rolled back with a "changed by someone else → Refresh" message instead of silently overwriting.

**No page reloads.** Every change updates the screen immediately and saves in the background. The pill in the top bar cycles `Saving task…` → `Synced just now`, or shows `Sync failed — click to retry` with an automatic rollback. Filter, sort, group, and hidden columns live in the URL hash, so views are shareable. Detail tabs switch instantly because one call loads the whole record.

**Where this differs from the design handoff** (on purpose):

| Handoff said | Built | Why |
|---|---|---|
| Hidden `<iframe name="__ghost">` form POSTs + `doPost?bg=1` | `google.script.run.api(...)` | Apps Script serves `doPost` responses from a different sandbox origin inside a nested iframe, so the ghost iframe can't `postMessage` back to the page reliably. `google.script.run` is Apps Script's built-in async channel and meets the same goal: the main page never reloads on a mutation. It also needs no CSRF token (Google authenticates each call). |
| Full reload on sidebar navigation, plus `<link rel=prefetch>` | Client-side routing via `google.script.history` | Apps Script page loads take 1–3 s, so switching sections instantly is faster than prefetching. Links and the back button still work. **Refresh** (↻ in the top bar) pulls teammates' latest changes. |
| Preferences in `UserProperties` | Script properties keyed by email | The app runs as the deployer, so `UserProperties` would be shared by everyone. |
| Separate "Recently visited" drawer history | Recently visited pros shown on Home (from prefs) | Same information, simpler. |
| Tax Advisor Performance integration | Not built (deferred in the handoff) | The `ProjectStageHistory` and `TimeEntries` tabs are ready for it to read. |

**Drive API.** The workbook import converts the uploaded `.xlsx` with the Drive advanced service (v3), which `appsscript.json` enables. If the editor ever says "Drive is not defined", open *Services* in the editor and add **Drive API v3**.

---

## Local development

```bash
npm run dev            # http://localhost:5173 — real server code, fake Sheets, demo data
npm run dev:reseed     # reset demo data
# view as someone else: http://localhost:5173/?as=riley.advisor@housecallpro.com
```

## Tests

```bash
npm test               # 22 server tests + 7 client tests
npm i --no-save playwright && npm run dev &   # then:
npm run test:e2e       # click-through of every screen + concurrent-edit rollback
```

The server tests run the actual `src/server/*.js` files under Node against in-memory fakes of SpreadsheetApp, PropertiesService, LockService, etc. They cover setup, access control, the SFDC sync (dedup, record type filter, resolver, OS flag), load balancing, inbox claim, template materialization (subtasks, blockers, checklists, anchors), the done cascade, optimistic concurrency, stage history, the timer (conflicts, force switch, 8h auto-stop), notes, outstanding items, workbook extraction (including rows inserted by reps), Asana import, and reports.

Manual acceptance script: [`docs/UAT.md`](docs/UAT.md).
