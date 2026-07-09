---
title: feat — S2 collapsible dashboard sections
date: 2026-07-08
type: feat
classification: software
feature: 017
slug: feat-s2-collapsible-dashboard-sections
product_contract_source: ce-plan-bootstrap
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
origin: user request in chat on 2026-07-08 — collapse/expand each S2 dashboard stats section by clicking its title (Skill Ratings, Development Progress, Match Time History, Recent Performance, Video Assessments).
---

# Feature 017 — S2 Collapsible Dashboard Sections

## Goal Capsule

- **Objective:** On `S2-player-dashboard.html`, each of the five stats sections collapses and expands when the coach clicks its **section title**. Section bodies hide/show; titles stay visible with a clear expanded/collapsed affordance.
- **Authority:** S2-only UI enhancement. No API, schema, or S5 changes.
- **Done when:** All five `.stats-section` blocks toggle on title click; default is expanded; `missingDataMessage` hide rule still works; existing S2 Playwright suites pass; new collapse coverage is green.
- **Out:** Collapse on S5, S1, or other pages; persisting state across visits; accordion “only one open at a time”.

## Product Contract

### Problem Frame

The S2 dashboard stacks five dense stats blocks (especially after feature 015/016 added Skill Ratings). Coaches scrolling on mobile or reviewing one area at a time must pass through all content. Click-to-collapse section titles give quick focus without leaving the page.

### Actors

- A1. Coach — reads the dashboard; toggles sections while reviewing a player.

### Key Flows

- F1. Coach opens S2 for a player with stats → all five sections render **expanded**.
- F2. Coach clicks **Development Progress** title → metrics/timeline hide; title shows collapsed state; click again → body reappears.
- F3. Same toggle works for Skill Ratings (entire block, including Any Position + role sub-tables), Match Time History, Recent Performance, Video Assessments.
- F4. Player with `missingDataMessage` → all `.stats-section` elements stay `hidden` as today; collapse wiring does not run or does not surface those sections.

### Acceptance Examples

- AE1. Lionel Messi (seeded stats): click **Match Time History** → `#metricMinutes` not visible; title `aria-expanded="false"`; second click → visible again.
- AE2. Skill Ratings section: collapsing hides empty helper, Any Position table, and role table together — inner sub-titles are not separate toggles.
- AE3. Rookie Carter (no stats): sections remain hidden; no collapse buttons shown in the stats area.

### Requirements

#### Structure and interaction

- R1. The five top-level `.stats-section` blocks on S2 gain a collapsible shell:
  1. Skill Ratings (`data-testid="skill-ratings-section"`)
  2. Development Progress
  3. Match Time History
  4. Recent Performance
  5. Video Assessments
- R2. Each section’s **primary** `.section-title` (first title in the section, not the inner “Any Position” / role sub-titles) becomes a `<button type="button" class="section-toggle">` with:
  - `aria-expanded` (`true` / `false`)
  - `aria-controls` pointing at the section body wrapper id
  - `data-testid="dashboard-section-toggle-{slug}"` where slug is `skill-ratings`, `development-progress`, `match-time`, `recent-performance`, `video-assessments`
- R3. Section content below the primary title is wrapped in `<div class="section-body" id="...">` so collapse hides one container per section.
- R4. Clicking the title button toggles collapsed state on the parent `.stats-section` via class `is-collapsed` (or equivalent). Collapsed → body hidden; expanded → body visible.
- R5. **Default:** all sections **expanded** on every page load (no `localStorage` / `sessionStorage` persistence in v1).
- R6. Visual affordance: chevron or `+`/`−` icon on the title button (CSS `::after` or inline span) reflecting state; `cursor: pointer` on the button; preserve existing lime bar `::before` on `.section-title` where possible.

#### Compatibility

- R7. Existing `statsSections.forEach(el => el.hidden = ...)` logic for `missingDataMessage` continues to hide entire `.stats-section` elements — unchanged contract from feature 005.
- R8. No change to bottom CTA row (`Compare Player` / `Submit a Clip`) or player summary card.
- R9. Keyboard: title buttons are focusable; `Enter` / `Space` toggle (native button behavior).

#### Non-goals

- R10. Inner Skill Ratings sub-blocks (Any Position / role) do **not** get their own collapse toggles in this feature.
- R11. S5 and other mockup pages keep static section titles.

### Scope Boundaries

#### In scope

- `docs/ux/mockup/S2-player-dashboard.html` markup + IIFE wiring
- `docs/ux/mockup/style/site.css` collapse styles (scoped to S2 toggle pattern)
- Static-analysis spec for toggle markup
- Playwright scenarios in `tests/playwright/s2-player-dashboard.spec.js` (or focused sibling file)
- Short note in `docs/ux/mockup/API-Mockup-Mapping.md` under S2 (UI-only)

#### Deferred

- Remember collapsed state per player or per coach (`sessionStorage` key by `playerId`)
- “Expand all / Collapse all” control
- Animated height transition (optional polish; plain `hidden` or `display:none` is enough for v1)
- Port the same pattern to S5

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Toggle target | Primary section title only | Matches user request; avoids nested accordion complexity |
| Default state | Expanded | Dashboard is for reading; collapse is opt-in focus |
| Persistence | None in v1 | Smallest diff; defer if coaches ask |
| Hide mechanism | `is-collapsed` class on `.stats-section` | Keeps `hidden` attribute for no-stats gate separate |
| Implementation | Vanilla JS in S2 IIFE | Matches existing mockup pattern; no new dependencies |

**Product Contract preservation:** New plan (017); no upstream brainstorm.

## Planning Contract

### Key Technical Decisions

- KTD1. **HTML shape per section:**

```html
<div class="section stats-section" data-section="development-progress">
  <button type="button" class="section-title section-toggle" id="toggle-development-progress"
    aria-expanded="true" aria-controls="body-development-progress"
    data-testid="dashboard-section-toggle-development-progress">
    Development Progress
  </button>
  <div class="section-body" id="body-development-progress">
    <!-- existing metric-grid, timeline, etc. -->
  </div>
</div>
```

- KTD2. **`initDashboardSectionToggles()`** runs after stats sections are shown (post-`missingDataMessage` check). Queries `.stats-section .section-toggle` and toggles `is-collapsed` on the closest `.stats-section`.
- KTD3. **CSS:** `.stats-section.is-collapsed .section-body { display: none; }`; `.section-toggle` resets button chrome (width 100%, text-align left, transparent background, inherit font); chevron via `.section-toggle::after { content: '▼'; }` and `.is-collapsed .section-toggle::after { content: '▶'; }` (or rotate transform).
- KTD4. **Skill Ratings:** wrap everything after the primary title (empty helper + any block + role block) in one `.section-body`.

### Risks

- **Risk:** Converting `.section-title` from `div` to `button` breaks flex `::before` bar styling. **Mitigation:** keep classes `section-title section-toggle` on the button; add scoped CSS for button reset.
- **Risk:** Playwright `getByText('Development Progress')` matches button label — still visible when collapsed. **Mitigation:** assert body content visibility, not title visibility.
- **Risk:** `hidden` on section vs `is-collapsed` conflict. **Mitigation:** `hidden` removes section from layout entirely (no-stats); `is-collapsed` only applies when section is shown.

### Dependencies

- Builds on current S2 structure (features 005, 015, 016). No backend dependency.

## Implementation Units

### U1. S2 markup + CSS

**Goal:** Restructure the five stats sections for collapse; add styles.

**Requirements:** R1–R6, R8, R9.

**Files:**
- `docs/ux/mockup/S2-player-dashboard.html`
- `docs/ux/mockup/style/site.css`

**Approach:**
- For each `.stats-section`, convert primary title to `button.section-toggle` and wrap remaining content in `.section-body` with stable ids.
- Add `data-section` slug on each section root for tests.
- Add CSS for `.section-toggle`, `.section-body`, `.stats-section.is-collapsed`, chevron affordance.

**Test scenarios:**
- S2 source contains five `dashboard-section-toggle-*` testids.
- S2 source contains `section-body` wrappers inside each `.stats-section`.
- CSS contains `.stats-section.is-collapsed .section-body`.

**Verification:** Static-analysis spec (U3) passes.

---

### U2. S2 collapse JavaScript

**Goal:** Wire click toggles after dashboard render.

**Requirements:** R4, R5, R7.

**Files:**
- `docs/ux/mockup/S2-player-dashboard.html` (IIFE)

**Approach:**
- Add `initDashboardSectionToggles()`:
  - Select `.stats-section .section-toggle`
  - On click: toggle `is-collapsed` on parent `.stats-section`; sync `aria-expanded`
  - Skip sections that are `hidden` (no-stats path)
- Call after `statsSections.forEach(... hidden = false)` and after `renderSkillRatings()`.

**Test scenarios:**
- Click collapse hides `#metricCurrentLevel`; expand restores it.
- Skill Ratings collapse hides `skill-ratings-any-section` and `skill-ratings-empty` when visible.
- No-stats player: sections stay hidden; toggles not interactable.

**Verification:** Playwright (U3).

---

### U3. Tests + mapping note

**Goal:** Lock structure and behavior; document UI-only change.

**Requirements:** AE1–AE3, R7.

**Files:**
- `apps/api/tests/integration/players/s2-dashboard-collapsible-sections.spec.ts` (new)
- `tests/playwright/s2-player-dashboard.spec.js` (extend)
- `docs/ux/mockup/API-Mockup-Mapping.md` (short S2 UI bullet)

**Approach:**
- Static spec: five toggle testids, `initDashboardSectionToggles` or equivalent, `is-collapsed` class usage.
- Playwright: collapse Development Progress + Skill Ratings; verify body hidden/visible; ensure existing “shows key development sections” still passes (titles visible, bodies visible by default).

**Test scenarios:**
- Happy path: toggle one section off and on.
- Regression: default load shows metric content visible.
- No-stats: sections hidden unchanged.

**Verification:**
- `npx vitest run apps/api/tests/integration/players/s2-dashboard-collapsible-sections.spec.ts`
- `npx playwright test tests/playwright/s2-player-dashboard.spec.js`

---

## Verification Contract

- `npx vitest run apps/api/tests/integration/players/s2-dashboard-collapsible-sections.spec.ts`
- `npx playwright test tests/playwright/s2-player-dashboard.spec.js tests/playwright/player-skill-ratings.spec.js`
- Manual: mobile-width smoke — tap titles, confirm layout does not jump under bottom nav

## Definition of Done

- R1–R11 satisfied.
- Five sections collapse/expand on title click; default expanded.
- No API or data contract changes.
- Existing S2 no-stats and skill-ratings behavior unchanged.

## Appendix

### Section slug map

| Title | `data-section` | `data-testid` toggle |
|---|---|---|
| Skill Ratings | `skill-ratings` | `dashboard-section-toggle-skill-ratings` |
| Development Progress | `development-progress` | `dashboard-section-toggle-development-progress` |
| Match Time History | `match-time` | `dashboard-section-toggle-match-time` |
| Recent Performance | `recent-performance` | `dashboard-section-toggle-recent-performance` |
| Video Assessments | `video-assessments` | `dashboard-section-toggle-video-assessments` |
