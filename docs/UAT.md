# Tax Manager — manual acceptance (UAT)

Run these against the deployed web app after first setup and after each major release. Two people make the concurrency checks easy.

## Chrome and sync
- [ ] Sidebar shows Home, Inbox (count), My Tasks (count), Pros, Projects, Templates, Reports, Archive, plus Settings for EXEC/ADMIN. Collapse to the icon rail, reload, and it stays collapsed.
- [ ] Toggle any task. The top-bar pill goes **Saving task…** → **Synced just now**. The page never reloads. A small green **✓ saved** appears on the row.
- [ ] Search "Org ID or business name" finds a pro by partial name and by Org ID. Enter opens it.
- [ ] ↻ Refresh pulls a change a teammate just made.

## Lists
- [ ] Pros list: Org ID and Business stay pinned while the table scrolls horizontally.
- [ ] Filter, Sort, Group, and Hide all apply instantly. Copy the URL into a new tab and the same view opens.
- [ ] **Save view** adds a tab and a Starred sidebar entry. Deleting it (× on the active tab) removes both.
- [ ] Projects → **Board**: drag a card to another stage. It lands with ✓ saved. Drag to **Blocked** and you're asked for a reason.

## Drawer (no full reload between record opens)
- [ ] Clicking a row opens the drawer and the list stays underneath. Clicking another row swaps the content.
- [ ] ←/→ (or J/K) move to the previous/next record with an "N of M" counter. Esc closes the drawer. The expand icon opens a full page.
- [ ] Browser Back closes the drawer.

## Tasks (single-button compose)
- [ ] **+ Add task** opens one compose row (title, section, assignee, due date). Enter adds the task and keeps the row open. Esc cancels.
- [ ] Checking a parent completes its subtasks. Checking the last subtask completes the parent. Un-checking a subtask re-opens the parent.
- [ ] Peer Review Verification expands to a 10-item checklist that shows "n/10 verified".
- [ ] Assign a peer reviewer on the project Overview. The unassigned "Peer Reviewer" tasks fill in.
- [ ] Set the e-file date. The Filing & Delivery task due dates update.

## Records
- [ ] Overview fields are click-to-edit. Enter or blur saves; Esc cancels.
- [ ] **Concurrency:** two people open the same pro. Person A edits Vertical, then person B edits Vertical. B sees "changed by someone else → Refresh" and their value rolls back.
- [ ] Notes: add a note (⌘/Ctrl-Enter), edit your own, and confirm you can't edit someone else's.
- [ ] Project **Time & stages** shows each transition with the days spent in the prior stage.
- [ ] **Outstanding items:** add, mark received, delete.
- [ ] Archive a pro with a reason. It leaves the lists and appears in Archive; **Restore** brings it back.

## Timer
- [ ] **Start timer** on project A. The top-bar chip counts up. Try starting on project B and you get "You have a timer running on A". **Stop that & start here** switches the timer.
- [ ] Stopping logs an entry on Time & stages. A forgotten timer auto-stops at 8h and is flagged "auto-stopped".

## Salesforce → Inbox → Wizard
- [ ] Settings → **Sync now** creates one pro per new Org ID (Tax Onboarding rows only), and a second run creates nothing.
- [ ] A case owner not on the roster shows "OS needs manual assignment" on the Inbox card.
- [ ] **Claim & start onboarding** opens the wizard with a green banner. The pro gets its onboarding tasks.
- [ ] Upload a filled "Make A Copy Tax Notes" workbook. The review shows values with their source cells. Uncheck a row, apply, and confirm the pro fields, owners, and intake answers are filled. The original .xlsx is in the pro's Drive folder.
- [ ] Assignments shows advisors with pro counts and "next up". Picking another advisor saves it.
- [ ] Create Drive folder: running it twice doesn't create a duplicate.
- [ ] Create return project(s) → projects appear with template tasks. **Finish onboarding** sets the pro to Onboarded.

## Templates, reports, settings
- [ ] Non-admins can view templates but can't edit them. Admins can add, edit, reorder (drag), toggle active, and **Publish version**.
- [ ] Each of the six reports renders and **Export CSV** downloads a file.
- [ ] Preferences (avatar menu): density, dark mode, accent, pill style, and navigation all persist across reloads.
