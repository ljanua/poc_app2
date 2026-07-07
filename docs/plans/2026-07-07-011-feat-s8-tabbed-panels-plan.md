---
title: feat: S8 Skills page — convert four stacked panels to four boxed tabs
date: 2026-07-07
type: feat
origin: user request in chat on 2026-07-07 — "On S8-skills, move all 4 sections of the UI into 4 tabes tabs: Sports, Positions, Skills, Position-Skills"
---

# feat: S8 Skills page — convert four stacked panels to four boxed tabs

## Summary

Refactor the `S8-skills.html` mockup so the four existing vertical sections (Sports, Positions, Skills, Position-Skills) become a single boxed-tab bar with four tabs. The KPI row (# Sports, # Active Positions, # Skills, # Assignments) stays above the tab bar. The Position-Skills tab is the default selection on page load. All existing data-testids, modals, and read/write flows remain functionally unchanged — only their visual arrangement changes.

## Problem Frame

The current `S8-skills.html` renders its four table-card panels in a single vertical stack. A SystemAdmin lands on the page and sees all four tables simultaneously, which forces a long scroll to reach Position-Skills (the actual daily operational entry point) and visually competes with the show-inactive toggle and the KPI row.

Tabbing the four sections gives each its own focused view, hides operational noise on entry (only the Position-Skills tab is active), and brings the Position-Skills controls — the position filter, "Assign Skills" button, and skill table — to the visible viewport on first load.

This is a UI-only change. No API contract, schema, role-gating, or React code is touched. The mockup HTML and one static-analysis test file are the touch surface.

## Requirements

### R1 — Four tabs in this order
- "Sports"
- "Positions"
- "Skills"
- "Position-Skills"

### R2 — Boxed (Material-style) tab style
A rectangular bar of four tabs. The active tab is visually distinct (filled background); inactive tabs are not. Hover state distinct from active. Tab labels do not wrap.

### R3 — Default active tab is Position-Skills
On first page load (and after a hard refresh) the Position-Skills tab is selected, its panel is visible, and the other three panels are hidden.

### R4 — KPI row stays above the tab bar
The existing `.kpi-row` (4 cards: # Sports, # Active Positions, # Skills, # Assignments) remains in its current position above the tabs. KPIs are global, not per-tab.

### R5 — Toolbar stays above the tab bar
The existing toolbar (Show inactive checkbox) remains above the tab bar. The toolbar applies to all four tabs (a global filter), so it stays outside the tabbed region.

### R6 — One panel visible at a time
Clicking a tab hides the previously-active panel and shows the new one. Tabs are mutually exclusive; no "expand all" / accordions.

### R7 — Preserve all existing data-testids
Every `data-testid="..."` and every element id used by the static-analysis test (`mockup-api-client.spec.ts`) and the Playwright spec (`tests/playwright/s8-skills.spec.js`) keeps its current value. The change is structural, not naming.

### R8 — Default tab persists within a session
If a SystemAdmin navigates away from S8 and back (within the same session), the last-active tab is restored from sessionStorage. On a fresh hard load, Position-Skills is the default. If sessionStorage is unavailable, fall back to the default without throwing.

### R9 — No regression in static-analysis or Playwright tests
- `apps/api/tests/integration/skills/mockup-api-client.spec.ts` keeps passing (it pattern-matches the four `<h2>` headings and the modal ids — the headings move inside their respective tab panels but the strings are unchanged).
- `tests/playwright/s8-skills.spec.js` keeps passing (it asserts `#sportsTableBody`, `#positionsTableBody`, `#skillsTableBody`, `#positionSkillsTableBody`, the add-* buttons, the position filter, the positionSkillsFilter, role-gating elements, and the `nav-skills` entry — none of these identifiers change).

## Scope Boundaries

### In scope
- `docs/ux/mockup/S8-skills.html` — restructure the four sections into a tab bar + four panels.
- `docs/ux/mockup/style/site.css` — add a small `.tabs` / `.tab` / `.tab.active` stylesheet block. No global renames.
- `apps/api/tests/integration/skills/mockup-api-client.spec.ts` — update the one assertion that explicitly enumerates the four `<h2>` headings in source order, if needed (the headings still exist inside the panels; the test currently asserts they appear in source order — they will no longer be contiguous in the source, so the assertion needs to relax from "in source order" to "each heading exists in the document").

### Deferred for later
- Per-tab KPI subsets (e.g., a small "Sports KPI" inside the Sports tab). Out of scope for this change; the global KPI row already covers the four counts.
- React mirror (`apps/web/src/features/admin-skills/pages/AdminSkillsPage.tsx`) — out of scope. The user asked about the mockup S8 page; the React feature is a separate surface and was deliberately left as a single-page layout last cycle.
- Hash-route deep-linking (`/S8-skills.html#sports`) — out of scope. R8 covers sessionStorage only.
- Animation/transitions between tabs — out of scope; show/hide is sufficient.

### Outside this product's identity
- Removing the show-inactive toggle or the KPI row.
- Renaming the tabs.
- Reordering the tabs.

## Key Technical Decisions

**KTD-1: Boxed tab style.** A horizontal `.tabs` flex container with one `.tab` per item, each `<button>` element with `role="tab"` and `aria-selected`. Active state uses a contrasting background color (e.g., the same `var(--brand-1)` already used for primary buttons in `site.css`); inactive tabs use the page background. The four `<section>` panels get `role="tabpanel"`, `hidden` attribute on the three non-active panels, and a stable per-panel id (e.g., `tabpanel-sports`).

Rationale: matches the user's chosen "boxed" style. Keeps the existing `.table-card` styling intact for each panel. `hidden` attribute is the simplest, most accessible hide mechanism — no `display:none` inline overrides needed.

**KTD-2: Default-tab state lives in sessionStorage under key `vantageiq_s8_active_tab`.** Read on DOMContentLoaded; if missing or invalid, default to `position-skills`. Write on every tab click. Guards wrap sessionStorage in try/catch so private-browsing or quota errors fall back to the in-memory default without throwing.

Rationale: satisfies R8 with no new dependencies. Consistent with the existing `vantageiq_mockup_v2` / `vantageiq_current_user_email` localStorage convention in `mockup-api-client.js`.

**KTD-3: No new external state. The four tab buttons and four panels live entirely inside `S8-skills.html`.** No changes to `mockup-api-client.js`, no React component changes, no API contract changes. Tabs are pure view state.

Rationale: keeps this change minimal and bounded. The mockup-api-client is the wrong place for tab UI state.

**KTD-4: Tab switching does not re-fetch from the API.** Switching tabs only toggles `hidden`. The underlying `state.sports`, `state.positions`, `state.skills`, `state.positionSkills` arrays and the four render functions (`renderSports`, `renderPositions`, `renderSkills`, `renderPositionSkills`) keep their existing behavior — they run on initial load and after CRUD operations.

Rationale: matches R9 (no behavior change) and avoids surprising refetch latency when a coach demo clicks through tabs. The seed-or-server data is loaded once at page load as today.

## High-Level Technical Design

### Tab bar + panel composition

```text
+---------------------------------------------------------------+
|  Header (back, title, role badge, exit)                       |
+---------------------------------------------------------------+
|  Toolbar: [ ] Show inactive                                   |
+---------------------------------------------------------------+
|  KPI row: [Sports] [Active Positions] [Skills] [Assignments]   |
+---------------------------------------------------------------+
|  [ Sports ] [ Positions ] [ Skills ] [ Position-Skills ]       |  <- tab bar
+---------------------------------------------------------------+
|                                                               |
|  <section class="table-card" role="tabpanel" hidden>          |
|     <h2>Sports</h2>  [Add Sport]   #sportsTable ...           |
|  </section>                                                   |
|                                                               |
|  <section class="table-card" role="tabpanel" hidden>          |
|     <h2>Positions</h2>  Sport: [...] [Add Position] ...       |
|  </section>                                                   |
|                                                               |
|  <section class="table-card" role="tabpanel" hidden>          |
|     <h2>Skills</h2>  [Add Skill]   #skillsTable ...            |
|  </section>                                                   |
|                                                               |
|  <section class="table-card" role="tabpanel">  <- active      |
|     <h2>Position Skills</h2>  Position: [...] [Assign Skills] |
|     #positionSkillsTable ...                                  |
|  </section>                                                   |
|                                                               |
+---------------------------------------------------------------+
|  Bottom nav: Players · Teams · Capture · My Clips · Users ·    |
|              Clubs · Skills                                   |
+---------------------------------------------------------------+
```

### Click handler

A single delegated `click` listener on the `.tabs` container. Reads the clicked button's `data-tab-id`, calls `setActiveTab(id)`, which (a) toggles `aria-selected` on buttons, (b) toggles `hidden` on panels, (c) writes the new id to sessionStorage.

```text
function setActiveTab(tabId) {
  document.querySelectorAll('[role="tab"]').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.tabId === tabId);
    btn.setAttribute('aria-selected', btn.dataset.tabId === tabId ? 'true' : 'false');
  });
  document.querySelectorAll('[role="tabpanel"]').forEach(function (panel) {
    panel.hidden = panel.dataset.tabId !== tabId;
  });
  try { sessionStorage.setItem('vantageiq_s8_active_tab', tabId); } catch (e) {}
}

document.querySelector('.tabs').addEventListener('click', function (event) {
  const btn = event.target.closest('[role="tab"]');
  if (!btn) return;
  setActiveTab(btn.dataset.tabId);
});

document.addEventListener('DOMContentLoaded', function () {
  let initial = 'position-skills';
  try {
    const stored = sessionStorage.getItem('vantageiq_s8_active_tab');
    if (stored && ['sports', 'positions', 'skills', 'position-skills'].includes(stored)) {
      initial = stored;
    }
  } catch (e) {}
  setActiveTab(initial);
});
```

### CSS sketch

```css
.tabs {
  display: flex;
  gap: 0.5rem;
  border: 1px solid var(--border-soft);
  border-radius: var(--r-lg);
  padding: 0.35rem;
  margin: 0.5rem 0 1rem;
  background: var(--surface);
}

.tab {
  flex: 1;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--r-md);
  padding: 0.55rem 0.9rem;
  font: inherit;
  cursor: pointer;
  color: var(--text-soft);
}

.tab:hover { background: var(--surface-soft); }

.tab.active {
  background: var(--brand-1);
  color: #fff;
  border-color: var(--brand-1);
}

.tab:focus-visible { outline: 2px solid var(--brand-1); outline-offset: 2px; }
```

Exact token names (`--brand-1`, `--r-lg`, `--surface`, etc.) mirror the existing `site.css` palette used by primary buttons and table cards so no visual redesign is implied.

## Implementation Units

### U1. Restructure S8-skills.html into a tab bar + four tab panels

**Goal:** Convert the four stacked `<section class="table-card">` blocks into one `.tabs` bar plus four `<section role="tabpanel">` panels; default to Position-Skills; persist the last-active tab in sessionStorage; ship without changing any data-testid or element id used by existing tests.

**Requirements:** R1, R2, R3, R4, R5, R6, R7, R8

**Files:**
- `docs/ux/mockup/S8-skills.html` — restructure the four sections; add the tab bar; add the click handler and DOMContentLoaded bootstrap; preserve every existing `data-testid="..."` and element id.
- `docs/ux/mockup/style/site.css` — append the `.tabs` / `.tab` / `.tab.active` stylesheet block. No rename of existing rules.

**Approach:**
- Insert a `<div class="tabs" role="tablist">` containing four `<button class="tab" role="tab" data-tab-id="sports|positions|skills|position-skills" ...>` elements, between the `.kpi-row` and the existing `#skillPanels` div.
- Wrap each of the four existing `<section class="table-card">` blocks with `role="tabpanel"` and `data-tab-id="..."`. Keep the existing `<h2>` inside each section unchanged.
- Add `hidden` to the three non-Position-Skills panels in the initial markup (so the page is correct without JS, then JS upgrades to sessionStorage-driven state).
- Add a `<script>` block (in the existing inline `<script>` near the bottom of the file) implementing `setActiveTab(tabId)` and the DOMContentLoaded bootstrap. Use try/catch around sessionStorage to satisfy R8.
- Add the `.tabs` / `.tab` rules at the end of `site.css`.

**Patterns to follow:**
- Existing `.table-card` style block in `site.css` (border, radius, overflow).
- Existing primary-button hover/active colors already defined for `.btn-primary`.
- Existing inline-script structure in `S8-skills.html` (the IIFE that wires `MockupApi`, `state`, `currentUser`, etc.).

**Test scenarios:**
- The four `<h2>` headings (Sports, Positions, Skills, Position Skills) all exist in the document. (Static-analysis test updates the source-order assertion to a per-heading existence assertion.)
- The four `data-testid` selectors used by Playwright (`add-sport`, `add-position`, `add-skill`, `assign-skills`, `position-sport-filter`, `position-skills-filter`) are still present at the document level.
- The four table-body ids (`#sportsTableBody`, `#positionsTableBody`, `#skillsTableBody`, `#positionSkillsTableBody`) are still present.
- A new test scenario: clicking each of the four tabs toggles `aria-selected="true"` on exactly one button and `hidden` to false on exactly one panel.
- A new test scenario: `sessionStorage.getItem('vantageiq_s8_active_tab')` is `position-skills` on first visit and reflects the last clicked tab afterwards.

**Verification:**
- Open `http://localhost:5500/S8-skills.html` logged in as `maria@vantageiq.club` and confirm the Position-Skills tab is active, the Position filter select is populated with the 13 seeded positions, the table renders the 5 assignments for `pos_gk`, and the other three panels are not visible.
- Click each of the four tabs in turn and confirm only the matching panel is visible, the click handler does not throw, and `sessionStorage` is updated.
- Hard-refresh the page; confirm the previously-active tab is restored (or Position-Skills if none was stored).
- Run `npx playwright test tests/playwright/s8-skills.spec.js` and confirm all 8 scenarios still pass.

### U2. Add a static-analysis assertion that the four tab ids and the default-tab behavior are present

**Goal:** Lock in the tab ids, the `role="tab"` / `role="tabpanel"` semantics, and the Position-Skills default so a future refactor cannot silently regress to a single stacked layout.

**Requirements:** R1, R2, R3, R7, R9

**Files:**
- `apps/api/tests/integration/skills/mockup-api-client.spec.ts` — extend the existing S8 describe block with new `it(...)` cases.

**Approach:**
- Add an `it(...)` asserting the source contains all four `data-tab-id` values: `sports`, `positions`, `skills`, `position-skills`.
- Add an `it(...)` asserting each panel has `role="tabpanel"` and exactly one panel lacks the `hidden` attribute in the initial markup.
- Add an `it(...)` asserting the click handler is wired and `setActiveTab` reads/writes `vantageiq_s8_active_tab`.
- Relax the existing "four panel `<h2>` headings in source order" assertion to a per-heading existence assertion (each heading string is found somewhere in the document).

**Test scenarios:**
- Test passes: all four data-tab-ids present.
- Test passes: exactly one panel lacks `hidden` initially, and it is the Position-Skills panel (`data-tab-id="position-skills"`).
- Test passes: the `setActiveTab` function name appears in the source.
- Test passes: the four `<h2>` headings exist somewhere in the document (order-independent).

**Verification:**
- `npx vitest run apps/api/tests/integration/skills` — all tests in this directory pass.
- `npx vitest run apps/api/tests/integration/skills/mockup-api-client.spec.ts` alone — passes.

## Risks & Mitigations

**Risk-1:** The existing static-analysis test asserts the four `<h2>` headings appear in source order. They will still appear, but no longer contiguously. Mitigation: relax that single assertion from "in order" to "each heading exists" in U2.

**Risk-2:** Playwright spec selectors target elements that may sit inside hidden panels (e.g., `#sportsTableBody`). Playwright's `toHaveCount` ignores hidden elements by default; tests should continue to pass without modification. Mitigation: do not add any `display: none` styling; use the `hidden` attribute which Playwright respects automatically.

**Risk-3:** `aria-selected` on the wrong tab on first load (e.g., all four selected, or none). Mitigation: `setActiveTab(initial)` is called once on `DOMContentLoaded` and toggles every button deterministically.

**Risk-4:** sessionStorage is unavailable in some test runners / private-browsing. Mitigation: try/catch around all sessionStorage access; default falls back to `position-skills`.

**Risk-5:** The "Show inactive" toolbar applies globally, but a user may expect it to scope to the active tab. Mitigation: keep current behavior (global filter) and document it as a deferred follow-up; do not change semantics.

## Acceptance Examples

- **AE-1:** As a SystemAdmin visiting `S8-skills.html` for the first time, the Position-Skills tab is active and only the Position-Skills panel is visible; the KPI row shows 1 / 13 / 31 / 65 against the seeded dataset.
- **AE-2:** As a SystemAdmin, clicking the "Sports" tab hides the Position-Skills panel and shows the Sports panel with the 1 seeded sport row and the "Add Sport" button visible.
- **AE-3:** As a SystemAdmin, after clicking "Positions", navigating to `S7a-clubs.html`, and clicking the bottom-nav "Skills" link to return to S8, the Positions tab is still active (sessionStorage restored).
- **AE-4:** As a Coach, navigating directly to `S8-skills.html`, the role-notice is visible and the `.tabs` bar is hidden.

## System-Wide Impact

- **Mockup surface:** only `S8-skills.html` and `site.css`. No other mockup page references the S8 DOM.
- **React surface:** none. The React `admin-skills` page is unchanged.
- **API surface:** none. No contract change.
- **Database:** none.
- **Tests:** one static-analysis test extended; one Playwright spec unchanged.

## Verification Strategy

- After U1: manual smoke against the running mockup server (`npm run serve:mockup`); confirm the four tabs render and switch as expected; confirm all 8 Playwright scenarios still pass.
- After U2: `npx vitest run apps/api/tests/integration/skills` — all suites pass.
- Final: `npx vitest run apps/api/tests/integration/skills apps/web/tests/unit/features/admin-skills` plus `npx playwright test tests/playwright/s8-skills.spec.js` — all green.

## Deferred to Follow-Up Work

- React mirror tab refactor (`apps/web/src/features/admin-skills/pages/AdminSkillsPage.tsx`).
- Hash-route deep-linking (`S8-skills.html#sports`).
- Per-tab KPI subsets inside each panel.
- Animated tab transitions.