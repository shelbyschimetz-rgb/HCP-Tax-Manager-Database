# Handoff: Tax Manager — UX Redesign (Apps Script-optimized)

## Overview

Tax Manager is the internal Google Apps Script web app that replaces Housecall Pro's tax-team Asana workflow. This handoff covers a redesign of M1–M6 surfaces (with M1–M3 already shipped and M4–M6 pending) optimized for the Apps Script runtime: minimal full-page reloads, single-button compose flows, side-drawer detail views, and an at-a-glance sync-status pill.

The redesign deviates from a literal Asana clone in places where the Asana pattern would force a full page reload — instead, all per-record actions stay in-page via the **hidden-iframe POST pattern** described below.

## About the Design Files

The files in this bundle are **design references created in HTML/JSX as a React prototype** — they exist to show intended layout, interaction, and behavior. They are **not production code to copy directly into Apps Script**.

Your task is to **recreate these designs in the existing Tax Manager codebase** (the `src/server/*.gs` + `src/client/views/*.html` server-rendered Apps Script structure). That source is NOT in this bundle — it must be pulled into your session first: it should already be committed to this repository (check for a `tax-manager-src` branch or the `src/` tree on your working branch). If it isn't present, get it committed/uploaded before starting — you cannot rebuild against files you can't see. Reuse the existing `Db.gs`, `Audit.gs`, `Locks.gs`, `Identity.gs`, etc. — only the **client folder** changes substantially, plus a small addition to `doPost` to handle background-iframe submits without redirecting.

Specifically:
- Replace `src/client/styles.html` content with the inlined version of `styles.css` + `hcp-tokens.css` from this bundle (CSP blocks external CSS).
- Replace each view in `src/client/views/` with the HTML equivalent of the corresponding React screen.
- Add one hidden `<iframe name="__ghost">` to the served HTML in `Layout.gs`.
- Adjust `doPost` to accept a `?bg=1` parameter that, when present, returns a small JSON-in-HTML response (instead of `HtmlService.createHtmlOutput(...).setHeaders('Location', ...)`) so the iframe receives confirmation without navigating the parent.

## Fidelity

**High-fidelity.** This is a pixel-targeted spec: exact colors from the Housecall Pro design system (`hcp-tokens.css`), Open Sans typography, MUI-style 8px spacing scale, signature card shadow. Recreate the look exactly; reuse the existing `Db.gs` data model and Apps Script lifecycle.

---

## Architecture decisions (NON-NEGOTIABLE)

Before any screen-by-screen detail, the global architectural moves:

### 1. Hidden-iframe POST for all mutations

Every state-changing form has:
```html
<form method="POST" action="<deployment_url>?bg=1" target="__ghost" onsubmit="optimisticUpdate(this)">
```

The `__ghost` iframe is invisible (`width:0; height:0; visibility:hidden`) and lives once in the served HTML. The main page **never reloads** in response to a mutation.

`doPost` checks for `bg=1` and returns a minimal HTML response with a `<script>` that does `parent.postMessage(...)` back to the page with success/failure + new `row_version`. The page handler then either confirms the optimistic update or rolls it back with an error toast.

For full request/response shape, see `optimisticUpdate()` helper to write in the client.

### 2. Side-drawer detail (not full-page nav)

Clicking a Pro row in the Pros list **does not navigate** away from the list. Instead a right-side drawer (78vw, max 1100px, min 720px) slides in over the list. The list stays mounted; clicking another row swaps the drawer content (via hidden-iframe fetch of the next pro's HTML chunk). Esc or ✕ closes the drawer.

Drawer has its own header: prev/next nav arrows, breadcrumb showing the pro name + position counter ("3 of 22"), "open in full page" button, close.

Same pattern for Projects.

### 3. Page reloads ONLY happen for:
1. First load
2. Sidebar nav between top-level sections (Pros → Projects → My Tasks etc.) — and even these can be preloaded at idle with `<link rel="prefetch">` for warming up the next likely view
3. An explicit user-clicked **Refresh** button when fresh data matters

### 4. Client-side filter, sort, group, search, tab-switching

The Pros and Projects lists load with all visible records in the initial payload (capped at ~200 rows, with a "show all" link to fetch more). Filter/sort/group/column-hide/saved-view operations happen entirely client-side in vanilla JS — no reload. Hash-fragment URL stores the current view state so it's shareable.

Tab switching within a Pro/Project detail (Overview / Tasks / Intake / Books / Audit) is also client-side — preload all tabs into the page, show/hide with JS.

### 5. Sync-status pill in topbar

A small pill in the topbar always shows the user where their last action stands:
- `Synced 2s ago` (idle, success)
- `Saving task…` (in-flight)
- `Sync failed — click to retry` (error)

This is the user's anchor; they should never wonder "did that save?"

### 6. Single-button task compose

Replace the per-section "+ Add task" buttons with **one** "+ Add task" button at the top of the task list. Clicking it shows an inline compose row with: title input, section dropdown, assignee dropdown, due date. Enter saves, Esc cancels.

---

## Screens

### Global Chrome

#### Sidebar (collapsible, left)

- Width: 240px expanded, 64px collapsed (icon rail)
- Background: `--bg-paper` (#FFFFFF)
- Border-right: 1px solid `--border-light` (#E0E0E0)
- Top section: brand logo (28×28 blue square, white "TM" mark) + "Tax Manager / Housecall Pro" stacked text + collapse button
- Primary CTA below brand: "Claim from Inbox" — pill button, primary blue background
- Nav sections:
  - **Top:** Home, Inbox (with count badge), My Tasks (with count badge)
  - **Work:** Pros (count), Projects (count), Templates, Archive
  - **Starred:** user's saved views — My pros, At-risk pros, My projects, Pending peer review
- Bottom: user avatar + name + role
- Active state: light blue background (`--primary-50`), text in `--primary-dark`, count badge in dark blue
- Hover: `--grey-100` background

Persist expanded/collapsed state in `UserProperties` so it survives across page loads.

#### Topbar (sticky, top)

- Height: 56px
- Grid: `minmax(160px, 1fr) minmax(320px, 480px) auto` (breadcrumb | search | actions)
- Breadcrumb: clickable parent crumbs + current crumb (bold)
- Search: Org ID or business name; live-filter against a cached Pros index (preloaded to client on first load)
- Right actions: **Sync pill** (small, with colored dot — green idle, blue pulsing saving, red error), AI Assist button (purple `--ai-light` background, sparkles icon), Help, Bell, user avatar

#### Drawer (overlay for detail views)

- Position: fixed, top 56px (below topbar), right 0, bottom 0
- Width: 78vw, max 1100px, min 720px
- Background: `--bg-default` (#FAFAFA)
- Box shadow on left edge: `-16px 0 40px rgba(0,0,0,0.18), -1px 0 0 var(--border-light)`
- Slides in with `transform: translateX(40px) → 0 + opacity 0 → 1`, 220ms `cubic-bezier(.16,1,.3,1)`
- Drawer head (52px tall, white):
  - Prev/next arrows (icon-only, 32×32)
  - Breadcrumb: "Pros > [BusinessName]" with "N of M" counter
  - Spacer
  - "Open in full page" icon button (external link icon)
  - Close ✕ button (Esc shortcut)
- Drawer body: scrolls vertically, padding `20px 28px 64px`
- Backdrop: `rgba(33, 41, 52, 0.32)` semi-transparent overlay, clickable to close

### Home

- Greeting: "Good [afternoon], [FirstName]." (24px, semibold)
- Subhead with "Today's date · N tasks overdue · M due today"
- 4-column stat grid: My tasks today | Open projects assigned | Pros at risk | Inbox awaiting claim
- Two-column main:
  - **Left (2fr):** "My tasks · next up" card — table of next ~6 tasks across pros and projects with check, title, section context, due
  - **Right (1fr):** stacked cards
    - HCP Assist callout (purple gradient background, sparkles icon, summary text, "Show in projects" / "Dismiss" actions)
    - "Recently visited" or "My pros" (depending on role) — list of 5 with avatar, business name, state · vertical, lifecycle pill

### Pros list (`/pros`)

- Page header: icon + "Pros" + subhead "Business clients HCP does tax work for"
- Right actions: "Import" + "+ New pro" (primary)
- View toggle: List (active) · Board (soon) · Calendar (soon)
- Saved-view chip tabs: All pros · My pros · At risk · Onboarding · "+ Save view"
- Toolbar chips (each opens a popover): Filter · Sort · Group · Hide · Saved views toggle · "22 records"
- Virtualized table:
  - 22 columns total, ~2620px wide table that **horizontally scrolls**
  - Pinned left: Org ID (90px), Business (240px)
  - Pinned shadow: `box-shadow: 6px 0 8px -4px rgba(0,0,0,0.08)` on right edge
  - Other columns: DBA, Lifecycle, Entity, State, Vertical, Advisor (avatar), OS (avatar), BK lead (avatar), Primary owner, Docs (colored pill), Books w/ HCP (yes/no with check), Prior books, Payroll, Year started, Scope start, Time zone, Last touch, Last filed, At risk (warning icon), Projects count
  - Row height: `--row-h` (36 / 40 / 44 px based on density tweak)
  - Hover: `--table-row-hover` (#EEF7FE)
  - Click row: opens detail in drawer

### Projects list (`/projects`)

Same chrome pattern as Pros. 20 columns, 2400px wide table.

Columns: Project (pinned, 240px), Org ID (90), Filing type (140), Stage (170, pill), Blocker (200, red text if present), Tax year (90), Deadline (110, color-coded by overdue/today), E-filed (110, mono date), Progress (130, bar + %), Ext needed (yes pill), Ext filed (yes pill), Advisor (avatar), Preparer (avatar), Peer review (avatar, empty state), OS (avatar), Complexity (LOW/MED/HIGH pill), States, Tax risk (Low/Medium/High pill), Books for scope, Billing.

Saved views: All projects · My projects · 1040 + Sched C · Open · Pending peer review.

Toggle between **List** view and **Board** (Kanban) view — Board groups projects by pipeline stage into vertical columns. Cards show business name, filing type · TY, avatar stack, deadline (overdue in red), and a 3px top-border colored by complexity. "+ Add card" button at column footer.

### Pro / Project detail (in drawer)

Both share the same shell:
- Header card: 40×40 avatar circle with business initials | H1 business name + star button | Metadata row (Org ID mono, lifecycle pill, entity type, state · vertical, archived badge if applicable) | Right actions (Drive folder, More menu, Add project / Advance stage)
- Tabs (sticky, below header, border-bottom): Tasks (active default), Overview, Intake answers (Pro only), Outstanding items (Project only), Projects (Pro only), Books, Audit
- Tab content in two-column grid: 1fr main + 280px right rail (rail collapses to single column below 1180px)

#### Tasks tab — the daily driver

- **One** "+ Add task" button at the top of the task-shell in a toolbar bar (gray-50 bg). Compose row appears below when clicked: section dropdown, title input (autofocused), assignee dropdown, due date picker, Add/Cancel.
- Sections shown as collapsible headers: chevron · section name · `done/total` count chip · progress bar · % complete
- Tasks rendered as 6-col grid rows:
  - Drag handle (18px, opacity 0 → 1 on row hover)
  - Expand/collapse chevron (18px, only if has subtasks)
  - Title cell (`minmax(0, 1fr)`): check button (round, transitions to green filled with checkmark when done), text (strike-through if done), subtask count badge, checklist badge if applicable, blocked-by badge
  - Due date (84px, color-coded: red bold if overdue, amber bold if today, normal otherwise)
  - Assignee cell (130px): avatar + name; if no assignee, dashed-border empty avatar + italic role tag
  - More menu (28px, opacity 0 → 1 on hover)
- Row height: 38px
- Hover: `--bg-hover` (rgba(33,150,243,0.08))
- Subtasks: indented 30px and 60px respectively
- Checklist tasks (like "Peer Review Verification"): show a count badge "0/10 verified", click to expand inline checkbox list with subtle gray background
- Task complete: optimistic UI update + inline "✓ saved" pill that fades after 1.4s + topbar sync pill cycles to "Saving task…" → "Synced just now"

#### Right rail — sticky metadata

- Top card: HCP Assist summary of the pro/project (purple gradient bg, sparkles icon, brief AI-generated synopsis, "Draft pro email" / "Summarize tasks" action buttons)
- Lower card: Pro details — Status pill, Advisor (avatar + name), OS, Entity, State, Vertical, Docs status, Last filed, Active projects count, At-risk badge (warning if true), Drive folder link
- Same shape for Project detail, with project-specific fields

#### Overview tab

Replaces the top-to-bottom edit form with collapsible field groups in a single card, each showing label-value pairs in a 2-col grid: Identity, Tax context, Owners (collapsed default), INHA bookkeeping (collapsed default), Risk & notes. Values are hover-editable inline (click → input → blur saves via hidden iframe).

#### Audit tab

Read-only table from `AuditLog`: When (relative time + mono short timestamp), Actor (avatar + email handle), Action ("Updated lifecycle_status", etc.), From → To (mono, old → new values).

### My Tasks (`/me/tasks`)

- Page header: icon + "My Tasks" + count subhead
- View toggle: List (active) · Calendar · Board
- Buckets (each collapsible): Overdue (pink count badge), Today (amber), This week, Later, Completed
- Each task row: check button, title, parent record context (business name · section), due date, "blocked by N" badge if applicable, more menu
- Click task opens the parent record in a drawer

### Templates (`/templates`)

- Tab: Pro templates (35) / Project templates (21)
- Layout: 240px left side panel + main area
  - Side panel: Sections list (Doc Gathering, Extension, Prep, etc.) with task counts; below: Versioning history (v3 current, v2 Feb 2026, v1 Jan 2026)
  - Main: large table with section group headers + rows (drag handle, title, default-role pill, due anchor, offset mono, active toggle, more menu)
- Actions: Version history · Preview materialization · Add task

### Archive (`/archive`)

- Tab: Pros (2) / Projects (0)
- Table: Org ID, Business (muted), Last status pill, Archived date (mono), By (avatar), Reason, Restore action
- Empty state for Projects tab: icon, "No archived projects yet", description, no CTA

### Inbox (`/inbox`)

- Page header: icon + "Inbox" + "N closed-won" badge
- Each Salesforce closed-won opportunity rendered as a card:
  - Business name (15px semibold)
  - Meta row: vertical · state · entity hint · email · closed-won date · SFDC opportunity ID (mono)
  - "Proposed advisor:" + avatar + name (or "unassigned" muted)
  - Right side: "Claim & start onboarding" primary button + "Dismiss" subtle button

### Onboarding intake wizard (`/intake/<sfdc_id>`)

Page-level (full screen, not in drawer):
- Header: wand icon + "Onboarding · [BusinessName]" + SFDC ID / vertical / state / proposed Org meta
- Right action: "Save & exit"
- 240px left stage rail:
  - Stage A · Pre-IAC setup (5 steps with circle indicators, time estimates, completion checks)
  - Stage B · IAC capture (3 steps)
  - Stage C · Post-IAC handoff (4 steps)
  - Active step: blue-50 background, blue circle outline; completed: green filled circle with check
- Main: step title + lead description + form fields in 2-col grid
- Footer: "All edits auto-saved · last save 3s ago" (left) | "Save draft" + "Next step" (right)

### Settings — Tweaks panel

(Floating bottom-right, only when "Tweaks" mode is toggled on)
- Layout: Navigation (Left sidebar expanded / icon rail / Top nav), Detail view (Side drawer / Full page), Density (Compact / Cozy / Comfy), Dark mode toggle
- Style: Accent color swatches (HCP blue / Indigo / Forest / Graphite), Status pills (Filled / Outline / Dot), Action feedback (Inline banner / Toast)
- About section: short architecture note

---

## Interactions & Behavior

### Sync cycle (every mutation)

1. User clicks check / drag / edit
2. Optimistic UI update happens immediately (row strikes through, card moves, value changes)
3. `SyncBus.start('task' | 'field' | 'stage' | …)` called
4. Topbar pill: "Synced 12s ago" → "Saving task…" (blue, pulsing dot)
5. Hidden form submits to `__ghost` iframe with `?bg=1`
6. After ~400ms (server roundtrip + lock acquisition + Sheet write), `doPost` responds with HTML containing `<script>parent.postMessage({ ok: true, row_version: 47 }, '*')</script>`
7. Page receives postMessage, confirms the optimistic state, advances row_version
8. SyncBus → "Synced just now" (green idle)
9. Inline saved indicator (small green pill `✓ saved`) appears next to the affected row, fades after 1.4s

If the server rejects:
1. SyncBus → "Sync failed" (red)
2. Page rolls back the optimistic update
3. Toast: "Couldn't save '[task title]' — try again" with retry button

### Drawer navigation

- Click row → drawer slides in (220ms)
- Esc or ✕ → drawer slides out (180ms backdrop fade)
- Prev/next arrows → swap drawer content (no animation, immediate)
- "Open in full page" → close drawer + navigate to `/<view>/<id>` (full reload, but only one)
- Click another row in the list (visible through drawer or after closing) → drawer content swaps

### Task complete

- Click empty round checkbox → fills green, title strikes through, "✓ saved" pill appears
- Section progress bar updates immediately
- Parent task auto-DONE when all children DONE (cascading)
- Manual parent DONE cascades to children
- Click filled check → uncheck (returns to IN_PROGRESS)

### Inline edit (Overview tab fields)

- Hover field value → background lightens to `--grey-100`
- Click → inline input with current value, focused
- Enter saves (hidden iframe POST), Esc cancels, blur saves
- After save: brief "✓" indicator, value returns to display mode

### Kanban drag

- Card lifted on mousedown with `transform: scale(1.02)` and stronger shadow
- Drop zones highlight in `--primary-50` on hover
- On drop: card animates into new column, brief "✓" indicator
- Pipeline stage transition POSTs to `__ghost`
- On rejection (e.g. invalid transition): card snaps back with shake animation + toast

### Inbox claim

- "Claim & start onboarding" button click
- Hidden iframe POST claims the row (`state=CLAIMED, claimed_by, claimed_at`)
- On success: full navigation to `/intake/<sfdc_id>` with flash banner

### List filter/sort/group

- All client-side, instant
- State persists in URL hash: `#filter=advisor:me,risk:true&sort=deadline:asc&group=stage`
- Saved view chip click → applies that view's filter+sort+group combo

### Task list compose

- Click "+ Add task" → compose row appears at top with title field focused
- Section defaults to first section
- Tab through fields, Enter to save, Esc to cancel
- On Add: row added to chosen section, compose resets but stays open for rapid entry
- After 60s idle in compose, hide compose (avoid accidental empty submits)

---

## State Management

### Server state (already exists; reuse as-is)

`Db.gs` abstracts the partitioned multi-Sheet master DB. All reads/writes go through it. No client-side localStorage for record data — only for UI preferences.

### Client state (in served HTML, no SPA)

```js
window.TM = {
  user: { email, displayName, roles: [...] },
  // Preloaded by initial doGet call:
  pros: [...],          // capped at 200, full list available via /pros?all=1
  projects: [...],
  myTasks: [...],
  identity: {...},      // emailmap
  config: {...},        // master sheet IDs, deployment URL
  // Per-record cache for drawer swaps:
  proCache: {},         // orgId → { record, tasks, projects, ... }
  projectCache: {},
  // Current UI state:
  view: { route, filters, sort, group, hidden, savedView },
  drawer: null,         // { type: 'pro'|'project', id, tab }
  sync: { phase: 'idle'|'saving'|'error', label, ts },
};
```

### UserProperties (persisted across reloads)

- `sidebar_collapsed: bool`
- `accent_color: 'blue'|'indigo'|'forest'|'graphite'`
- `density: 'compact'|'cozy'|'comfortable'`
- `dark_mode: bool`
- `saved_views: { pros: [...], projects: [...] }`
- `recently_visited: { pros: [orgId, ...], projects: [projectId, ...] }`

---

## Design Tokens

All tokens live in `hcp-tokens.css` (full file included in this bundle). Quick reference:

### Colors
- Primary: `#0E6FBE` (HCP blue), dark `#0D47A1`, 50-tint `#E3F2FD`
- Success: `#00A344`, light `#DCF9D7`, dark `#00662B`
- Warning: `#BF8600`, light `#FFF1C6`, dark `#8C5400`
- Error: `#D81B60` (ruby pink), light `#FFDDE9`, dark `#880E4F`
- AI: `#623CC9` (purple), light `#EFECFA`, dark `#4E30A1`, gradient `linear-gradient(110deg, #2FA7CD 4%, #5655CE 35%, #7A09BE 100%)`
- Neutrals: Material grey 50→900 scale, `#FAFAFA` page bg, `#FFFFFF` paper, `#E0E0E0` border-light, `#757575` border-dark, `#212121` HCP black

### Status pills (lifecycle / pipeline)
- Closed-won: `#FEF3C7` bg / `#92400E` text
- Onboarding scheduled: `#DBEAFE` / `#1E40AF`
- Pass back: `#FFDDE9` / `#880E4F`
- Onboarded: `#E0E7FF` / `#3730A3`
- Advisory only: `#EEEEEE` / `#616161`
- Active project: `#DCF9D7` / `#00662B`
- In queue: `#FEF3C7` / `#92400E`
- In queue (escalated): `#FED7AA` / `#9A3412`
- Doc gathering: `#DBEAFE` / `#1E40AF`
- Prep: `#E0E7FF` / `#3730A3`
- Waiting for pro (WFP): `#FEF3C7` / `#92400E`
- QA: `#DDD6FE` / `#5B21B6`
- Client review: `#FCE7F3` / `#9D174D`
- Filing & delivery: `#CFFAFE` / `#155E75`
- Complete: `#DCF9D7` / `#00662B`
- Blocked: `#FFDDE9` / `#880E4F`

### Typography
- Family: `'Open Sans', 'Segoe UI', Tahoma, Arial, sans-serif` (loaded via Google Fonts `@import` — confirm Apps Script CSP allows fonts.googleapis.com; otherwise drop .woff2 into Drive and serve)
- Weights: 400 / 500 (eyebrow) / 600 (semibold) / 700 (rare)
- Sizes: caption 12, body2 14, body1 16, subtitle2 16 (semi), subtitle1 18, h6 22, h5 28, h4 40 (semi)
- Buttons: 14px / 1 / 600, **lowercase with first-letter-cap** (HCP voice tic — apply via CSS `text-transform: lowercase` + `::first-letter { text-transform: uppercase }`)
- Eyebrow: 12px / 32px line-height / 500 / uppercase / 0.08rem letter-spacing

### Spacing
- 8px base scale: `--sp-0 .. --sp-16` (0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- Common: 8, 12, 16, 24

### Radius
- `--radius-sm: 4px` (chips)
- `--radius-md: 8px` (inputs)
- `--radius-lg: 12px` (cards)
- `--radius-pill: 200px` (buttons)
- `50%` (avatars, FAB)

### Shadows
- `--shadow-card: 0px 0px 12px 2px rgba(0,0,0,0.1), 0px 0px 0px 0px rgba(0,0,0,0.1), 0px 0px 0px 0px rgba(0,0,0,0.1)` (signature HCP all-around glow)
- `--shadow-menu: 0px 3px 6px rgba(0,0,0,0.08), 0px 1px 2px rgba(0,0,0,0.06)`
- `--shadow-modal: 0px 24px 48px rgba(0,0,0,0.18), 0px 8px 16px rgba(0,0,0,0.08)`
- Drawer: `-16px 0 40px rgba(0,0,0,0.18), -1px 0 0 var(--border-light)`

---

## Assets

- **Logos** (already in `assets/logos/`): `housecall-mark.svg`, `housecall-pro-wordmark.svg`. For the brand mark in the sidebar, use a simple white "TM" glyph on `--primary-main` background (custom SVG, included in this bundle inline).
- **Icons**: HCP product uses Material UI Icons in production. For Apps Script (no @mui/icons-material at runtime), the prototype uses inline SVGs sourced from Lucide. Either:
  - Inline the SVG path data directly in the HTML templates (recommended; no fetch, no CSP issue), or
  - Bundle a small `icons.html` with `<symbol>` definitions and use `<use href="#name">`
- **Empty-state illustrations**: not used in this redesign; simple icon-in-tinted-circle pattern works well enough.

---

## Files in this bundle

- `README.md` — this file
- `Tax Manager — Redesign.html` — the React-based prototype entry point (reference only)
- `app.jsx` — main routing + sync bus + tweaks panel
- `chrome.jsx` — Sidebar, Topbar, sync pill, avatar, pill, icon set
- `screens-lists.jsx` — Pros list, Projects list, Kanban, toolbar popovers
- `screens-detail.jsx` — Pro detail, Project detail, task list, field groups, AI summary, audit
- `screens-misc.jsx` — Home, My Tasks, Templates, Archive, Inbox, Intake wizard
- `data.js` — Realistic mock dataset (use schema as reference, not values)
- `styles.css` — All component styles
- `hcp-tokens.css` — Design tokens (colors, type, spacing, radius, shadow)
- `tweaks-panel.jsx` — Tweaks UI helpers (you can ignore in production)
- `assets/housecall-mark.svg`, `assets/housecall-pro-wordmark.svg`

The existing Tax Manager codebase you're modifying lives in this repository (the `src/` tree — pull the `tax-manager-src` branch if it's not on your working branch). See its own `README.md` for backend conventions, `src/server/*.gs` for business logic to reuse, and `src/client/views/*.html` for the view templates to replace.

---

## Suggested implementation order

1. **Foundation**: replace `src/client/styles.html` with `styles.css + hcp-tokens.css` inlined. Add the `__ghost` iframe to `Layout.gs`. Add `bg=1` handling to `doPost` that returns a small `<script>postMessage(...)</script>` instead of redirecting.

2. **Sidebar + Topbar + Sync pill**: rebuild `Layout.gs` to render the new sidebar + topbar chrome. Add a small client-side `SyncBus` module (~50 lines of vanilla JS) that owns the pill state and listens for postMessage from `__ghost`.

3. **Pros list**: replace `pros.html`. Render the table with the 22 columns. Implement client-side filter/sort/group/hide popovers (vanilla JS state, no server roundtrip). Saved views are URL-hash-keyed.

4. **Side-drawer**: implement the drawer as a pure-CSS modal with a `<div id="drawer">` and a small JS module to populate it. On row click, fetch the pro detail via hidden iframe (the iframe sets `parent.__drawer.populate(html)` and the drawer fills). 78vw, slide-in animation.

5. **Pro detail in drawer**: rebuild `proDetail.html` to render inside the drawer. Tabs are client-side (preload all tab content into hidden divs, show/hide on tab click). Task list uses the new single-button compose. Each task toggle / inline edit goes through `__ghost`.

6. **Projects list + Kanban**: same as Pros, with kanban as an alternate view. Drag-to-change-stage submits via `__ghost`.

7. **Project detail**: same pattern.

8. **My Tasks**: rebuild the bucketed view. Each task toggle through `__ghost`.

9. **Templates editor**: section sidebar + main table.

10. **Archive**: simple table with restore via `__ghost`.

11. **Inbox + Intake wizard**: these are full-page (intake especially makes sense as full-page since it's a focused flow). Inbox claim does a hidden-iframe POST then a full navigation to the wizard.

12. **Settings + Tweaks**: defer or implement as the user's role-based default landing. Persist preferences to `UserProperties`.

13. **Prefetch**: add `<link rel="prefetch" href="?view=projects">` etc. to the served HTML so the next major-section page is warm.

---

## Verification

Per the original implementation plan in the codebase's `README.md`, hand-rolled unit tests live at `src/tests/runAll.gs`. Add tests for:
- The `bg=1` doPost handler returns the right postMessage payload format
- Sync bus state transitions (idle → saving → idle / error)
- Drawer history (open A, swap to B, close, open again → A is gone, B is in recently-visited)
- Filter/sort/group/hide combinations are idempotent and survive hash-fragment restore

Manual UAT scripts at `docs/uat/M<N>.md` should be updated to reflect:
- The drawer pattern (no full reload between record opens)
- The sync pill states
- The single-button task compose
- Horizontal scrolling on lists

---

## Open questions for the implementer to resolve

1. **CSP for Google Fonts** — confirm `fonts.googleapis.com` is allowed in the Apps Script web-app sandbox. If not, drop `Open Sans` .woff2 files into the Shared Drive and serve via `DriveApp.getFileById(...)` returning a base64 data-URL CSS rule.
2. **iframe postMessage origin** — `script.googleusercontent.com` is the sandbox origin. Validate the message origin in the parent before applying server confirmation.
3. **CSRF** — Apps Script handles auth via the deployment, but for `bg=1` POSTs you may want to include a CSRF token issued in the initial `doGet` (kept in `UserProperties`) and verified in `doPost`.
4. **Drawer URL state** — should the drawer state be in the URL hash (`#drawer=pro:749297`) so back-button closes it? Probably yes.
5. **List payload size** — at 200 rows × ~25 fields × 100 chars avg, the initial payload is ~500KB. If startup feels slow, switch to a thin list (just the displayed columns) + per-row hydration on drawer open.


---

# ADDENDUM — Deployment build (updated 2026-09-24)

This addendum supersedes the original spec wherever they differ. It captures every feature and integration decision made after the first handoff. Build order and platform notes from the original README still apply.

## Changes to what the original README described

- **Removed: Books-by-Period tab** on both Pro and Project detail (no data source). Do not build it.
- **Removed: HCP Assist** — all AI summary cards and the topbar Assist button are gone. No AI surfaces in this build.
- **Removed: per-section "+ Add task" buttons.** Replaced with ONE "+ Add task" button in a toolbar at the top of the task list; clicking it opens an inline compose row (title, section dropdown, assignee dropdown, due date). Section defaults to the first; Enter saves, Esc cancels.
- **Pro/Project detail tabs are now:** Pro = Tasks · Overview · Intake answers · Projects · Notes · Audit. Project = Tasks · Overview · Time & stages · Outstanding items · Notes · Audit.
- **Detail opens in a side drawer** (see original §2), not a full page.

## New feature: Running notes thread (Pro + Project)

A "Notes" tab on both Pro and Project detail. An editable, append-style thread — each note has author, timestamp, body. Not a single free-text field; a chronological log the team adds to. New note posts via the hidden-iframe pattern. Persist to a `Notes` tab: `note_id, entity_type (PRO|PROJECT), entity_id, author_email, body, created_at`. The legacy single "Misc notes" field on the Pro record is retired in favor of this thread.

## New feature: Work timer (return prep time tracking)

- A **Start/Stop timer button in the Project detail header.** Live-counts while running; on stop, logs an entry.
- **One timer per project.** **Blocks a second concurrent timer for the same user** — attempting to start another prompts "You have a timer running on [X] — stop it before starting a new one" with a "Stop that & start here" option.
- Handle the forgot-to-stop case: auto-stop after a max duration (recommend 8h) and flag it.
- Schema — `TimeEntries` tab: `entry_id, project_id, user_email, started_at, stopped_at, duration_min, auto_stopped (BOOL), note`.
- Rolls up per project, per advisor, per return type; feeds the Reports section.

## New feature: Stage-change timestamps + cycle-time analytics

- Every pipeline stage transition writes a row to a dedicated **`ProjectStageHistory`** tab: `history_id, project_id, from_stage, to_stage, changed_at, changed_by, advisor_email, days_in_prev_stage`. (Audit log alone could reconstruct this, but the dedicated tab keeps reporting queries simple/fast.)
- **"Time & stages" tab** on Project detail: a stage timeline (each transition — who moved it, when, days in prior stage), the logged-time table with per-person rollup, and a cycle-time summary.
- **Raw durations only — no SLA/targets** in this build (per decision). Reports show avg/median days per stage; targets are a later addition.

## New feature: Reports (CSV export)

New "Reports" nav section. Five reports, each on-screen plus a one-click **Export CSV** button. CSV is the required export format.
1. **Pipeline snapshot** — open projects per stage + past-deadline counts. (Computes from live Project records.)
2. **Stage cycle time** — avg/median days per stage, broken out per advisor. (From `ProjectStageHistory`.)
3. **Per-advisor summary** — open, completed YTD, avg cycle, on-time %, actual hours logged. (From Projects + `ProjectStageHistory` + `TimeEntries`.)
4. **Logged time** — all timer entries. (From `TimeEntries`.)
5. **At-risk pros** — computes from live Pro records.
Reports 2–4 accrue from live usage and are near-empty at launch; 1 & 5 and Advisor load balance are accurate from migrated data on day one.

## New feature: Round-robin, load-balanced advisor assignment

When a new Pro is ready to assign an advisor:
1. Count active (non-archived) Pros per eligible advisor.
2. Pick the advisor with the fewest; **tie-break by round-robin** (least-recently-assigned wins). Deterministic.
3. Write `assigned_advisor_email`, audit-log it. In the intake wizard's Assignment step it's **pre-filled but overridable**, showing each advisor's current count for transparency.
- **Eligibility:** `ADVISOR` role + `active=TRUE` in Identity. (A "not taking new clients" flag is a reasonable later add.)
- **Balance basis:** headcount of active Pros (per decision — not weighted by open projects/complexity).
- An OS override still counts that Pro against the chosen advisor for future balancing.
- A **"Advisor load balance"** report/affordance shows Pros-per-advisor with the next-up highlighted.

## Integration: Salesforce "New Tax Onboarding Cases" auto-create

**Source sheet** (refreshes every 4h) — columns:
| Col | Field | Use |
|---|---|---|
| A | Account Name | `Pros.business_name` |
| B | Case Owner | → `assigned_os_email` via resolver (below) |
| C | Org ID | **primary key / dedup key** |
| D | Case Number | `SfdcIntakeQueue.sfdc_opportunity_id` |
| E | Service Time (Days) | informational |
| F | Sub-Status Notes | seeds the Pro's notes thread |
| G | Created Date | cursor for "what's new" |
| H | Case Record Type | filter to `Tax Onboarding` |
| I | Date/Time Closed | informational |

**Automation** — time-driven trigger every 4h:
1. Read sheet, filter `Case Record Type = Tax Onboarding`.
2. For each row, dedup on **Org ID**. **Every new Org ID → create a Pro** (regardless of case status). Existing Org ID → skip.
3. On create: set business_name, org_id, case number, OS (resolver), seed notes from Sub-Status Notes; run the **advisor load-balancer**; provision the Drive folder.
4. **The OS then manually claims the Pro from the Inbox** to kick off task-template materialization + the intake wizard. (Auto-create does NOT auto-start onboarding.)

## Integration: Case Owner → email resolver

- **Convention:** `first.last@housecallpro.com` — lowercase, first + last only, **drop middle names** (e.g. "Angel Julia Marcos" → `angel.marcos@housecallpro.com`; "Cherrie Groves" → `cherrie.groves@housecallpro.com`).
- **Validate** the derived email against the Identity roster.
- **No match → leave `assigned_os_email` blank and flag the Pro** for manual assignment. No guessing beyond the convention. **No alias handling** in this build.
- Identity roster tab: `Name | Email | Active` (first.last emails). Case Owner in this feed = the onboarding specialist (not the advisor).

## Integration: Onboarding workbook import (intake wizard)

First step of Stage A ("Upload workbook"). Flow: **Upload → Extract → Review → Apply.**
- OS attaches the `.xlsx` (template: "Make A Copy Tax Notes" — included in `/reference`). Original saved to the Pro's Drive folder as source of record.
- **Extraction:** convert upload to a Google Sheet (`Drive.Files.insert convert:true`), read with `SpreadsheetApp`. The template is stable (labels col B, answers col F, notes col G) so this is structured cell-reads, **no AI parsing needed**. **IMPORTANT: key off label text, not fixed cell addresses** — reps may insert/rename rows and hard cell refs drift. (The prototype shows fixed addresses only for demo legibility.)
- **Three tabs map to:**
  - *General Information* → Pro record (Org ID, Business Name, DBA, Entity Type, Last Filing Year, Year Started, Vertical, State, Scope Start, Time Zone), Owners 1–3, INHA/Books/BK Lead/Payroll, + the 15 "Business Information" Q&A rows → `IntakeAnswers` branch `GENERAL`.
  - *Sole Prop* → `IntakeAnswers` branch `SCHED_C`.
  - *SCorp/CCorp/Partnerships* → `IntakeAnswers` branch `ENTITY`.
  - Wizard reads General + whichever entity tab matches the entity type.
- **Review screen:** parsed value + source location on the left, target field on the right, per-row checkbox to exclude, entity-tab switch. Nothing is written until the OS confirms. Surface warnings: entity-type mismatch, owner % not summing to 100.

## Outstanding items (Project) — manual entry

The Outstanding items tab is manual entry (no external source): add rows with item / owner / due; delete rows. Persist to an `OutstandingItems` tab: `item_id, project_id, item, owner_email, due_date, created_at, created_by, resolved (BOOL)`.

## Migration

Full pull of existing records from **Asana** into the master DB at cutover (per the M6 migration tool in the codebase's implementation plan). Not a go-forward-only start.

## Deployment checklist (resolved decisions)

- Export format: **CSV**.
- Dedup key for Salesforce auto-create: **Org ID**.
- Auto-create scope: **every new row/Org ID** (don't gate on case status).
- Onboarding kickoff: **OS manually claims from Inbox** (auto-create only creates the record).
- Timer: **one per project; block concurrent per user**.
- Stage analytics: **raw durations only** (no SLA targets yet).
- OS resolver: **first.last@housecallpro.com; blank+flag on no match; no aliases**.
- Advisor assignment: **headcount-based least-loaded with round-robin tiebreak; OS override allowed**.
- Migration: **full Asana pull**.

## Still open (not blocking)

- Tax Advisor Performance Apps Script integration — deferred by request. When ready, cleanest path is shared Sheets (that app reads the `ProjectStageHistory` / `TimeEntries` / advisor-summary data this build produces).
- Original architecture questions still stand: Google Fonts CSP vs. self-host Open Sans; CSRF token for `bg=1` POSTs; drawer state in URL hash; initial list payload size.
