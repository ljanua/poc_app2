---
title: 'feat: S2 player dashboard UI improvements'
date: 2026-07-17
type: feat
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# feat: S2 player dashboard UI improvements

## Goal Capsule

- **Objective:** Tighten the S2 dashboard toolbar and Skill Ratings section — remove redundant controls, use icon actions with tooltips, sharpen the partial-metrics notice, and make skill ratings collapse per position with a bright-yellow position average.
- **Authority:** User request 2026-07-17 (six items; call-outs 1–3 confirmed "all as proposed").
- **Stop when:** All six behaviors render correctly on S2 (coach + guest), one-line action row on mobile/desktop, and the S2 Playwright suite (updated) is green.

## Product Contract

### Summary

`docs/ux/mockup/S2-player-dashboard.html` has a toolbar with a locked team dropdown, a redundant "Back to Player List" button (header already has a `←` back arrow), and text action buttons ("Edit Player", "Share link", "Revoke share"). The Skill Ratings section collapses as one block, has no per-position average, and the "no stats" notice is all-or-nothing. This plan removes the redundant controls, converts actions to icon buttons with tooltip labels on a single line, distinguishes a partial-metrics notice, and reworks Skill Ratings so each position group collapses independently and shows a right-aligned bright-yellow average that reuses S1's calculation.

### Requirements

- R1. Remove the team dropdown (`#dashboardTeamSelect`) and its binding logic from S2.
- R2. Remove the "Back to Player List" button (`#backToListLink`); keep the header `←` back arrow.
- R3. Render "Edit Player", "Share link" (and its "New share link" state), and "Revoke share" as **icon** buttons with hover/focus tooltip labels (`title` + `aria-label`), fitting on one line on mobile and desktop. Preserve existing element IDs and `data-testid`s.
- R4. When a player has **partial** data (some sections render but performance stats are absent), the notice reads **"Some of the performance metrics are not available yet."**; when the player has **no** data at all, keep **"Performance metrics are not available yet."** Adjust at the S2 display layer; do not change the shared client default string.
- R5. In Skill Ratings, make **each position group** ("Any Position" and the role position) independently collapsible; the "Skill Ratings" heading becomes a static (non-collapsing) section title.
- R6. Each position group shows its **average skill rating** on the same line as the group title, aligned right, in bright yellow (`#facc15`), using S1's calculation (mean of numeric ratings `> 0`, rounded); show a neutral placeholder (`—`) when no qualifying ratings exist.

### Actors

- A1. Coach/ClubAdmin/SystemAdmin viewing a player dashboard.
- A2. Guest (share-token) viewer — sees the same layout with write actions inert.

### Key Flows

- F1. Coach opens S2 → toolbar shows only icon actions (Edit / Share / Revoke as applicable) on one line; no team dropdown, no back button.
- F2. Player with skill ratings but no performance stats → partial notice "Some of the performance metrics are not available yet."
- F3. Skill Ratings → user expands/collapses "Any Position" and the role group independently; each title row shows its yellow average.

### Acceptance Examples

- AE1. `#dashboardTeamSelect` and `#backToListLink` are absent from the rendered S2 DOM.
- AE2. Edit/Share/Revoke controls expose their labels via `title`/`aria-label` (icons visible, text label not inline) and stay on a single row.
- AE3. A player with recorded skill ratings but missing performance stats shows the "Some of the performance metrics are not available yet." notice.
- AE4. "Any Position" and role groups each have their own collapse toggle and a right-aligned yellow average matching S1's value for the same ratings.
- AE5. Guest view: icon actions render, write actions remain inert (`aria-disabled="true"`), no regressions.

### Scope Boundaries

#### In scope

- `docs/ux/mockup/S2-player-dashboard.html` (markup + inline script)
- `docs/ux/mockup/style/site.css` (icon-button, position-group header, average styles)
- `tests/playwright/s2-player-dashboard.spec.js` (update removed/changed behaviors)
- `docs/ux/mockup/API-Mockup-Mapping.md` (note S2 changes if it documents these)

#### Out of scope / deferred

- Changing the shared `missingDataMessage` client default or backend stats logic.
- Any change to S1, S5, S6, or the skill-ratings data model.
- Changing what counts as an assessed stat (only the notice wording/trigger for display).
- Reordering or restyling non-Skill-Ratings dashboard sections.

## Planning Contract

### Assumptions

- The header `←` (`.back-btn`) already provides back navigation, so `#backToListLink` is redundant.
- "Partial data" is detectable on S2 from already-loaded state: `missingStats` is true AND the player has some renderable content (rated skills `hasRatedSkills`, or live clips) — that is exactly the branch where some sections still show.
- Icon glyphs are a presentation choice; emoji/inline-SVG acceptable as long as tooltips carry the label and testids/IDs are preserved.
- S1's average logic lives inline in `S1-player-list.html` (`computeOverallAnyRating`): mean of ratings where `Number.isFinite(num) && num > 0`, then `Math.round`. Re-implement the same logic inline in S2 (no shared module exists to import).

### Key Technical Decisions

- KTD1. Delete the `#dashboardTeamSelect` markup and the teamSelect binding block; keep `#dashboardTeamChip` as the team display.
- KTD2. Delete the `#backToListLink` markup and its guest-inert reference; leave the header back arrow intact.
- KTD3. Convert the three action controls to icon buttons: `✏️` Edit, `🔗` Share (`🔗` with a "New share link" tooltip when a share is active), `🚫` Revoke. Keep `id`/`data-testid`; move the human label into `title` + `aria-label`; the JS that currently sets `textContent` between "Share link"/"New share link" instead updates `title`/`aria-label`.
- KTD4. Partial notice: in the `missingStats` branch on S2, choose the message string by whether partial content exists (`hasRatedSkills || liveClips.length > 0`) → "Some of the performance metrics are not available yet.", else fall back to `dashboard.performance.missingDataMessage`.
- KTD5. Skill Ratings restructure: the outer `.stats-section` for skill ratings no longer toggles as a whole; instead "Any Position" and role blocks each get a collapse toggle + collapsible body, mirroring the existing `.section-toggle`/`.section-body` + `is-collapsed` pattern. Reuse per-player persisted collapse state keyed by group where practical (optional; default collapsed/expanded state can match current behavior).
- KTD6. Position average: compute per group with the S1 formula and render a right-aligned `<span>` (yellow `#facc15`) in each group's title row; reuse/extend the `.player-card-overall-rating` styling or add a dedicated class.

### Product Contract preservation

Bootstrap from confirmed scope (call-outs 1–3 accepted as proposed).

## Implementation Units

### U1. Trim the toolbar: remove team dropdown + back button; icon actions

**Goal:** Toolbar shows only icon actions on one line; redundant controls gone.

**Requirements:** R1, R2, R3; AE1, AE2, AE5

**Dependencies:** None

**Files:**

- `docs/ux/mockup/S2-player-dashboard.html`
- `docs/ux/mockup/style/site.css`

**Approach:**

- Remove `#dashboardTeamSelect` markup and the teamSelect binding block in the inline script; keep team chip.
- Remove `#backToListLink` markup and its `makeInert(...)` reference in the guest block.
- Replace button text with icon glyphs; set `title` + `aria-label` to the label; update the share-button state code to swap tooltip text instead of `textContent`.
- Add CSS for a compact icon-button row that wraps to a single line on small screens (icon-only sizing, gap, no-wrap).

**Test scenarios:**

- Covers AE1. `#dashboardTeamSelect` / `#backToListLink` absent.
- Covers AE2. Edit/Share/Revoke expose `title`/`aria-label`; row stays single-line (spot-check via attribute + visibility).
- Covers AE5. Guest view still marks write actions inert; no dropdown/back button.
- Regression: Edit link still targets `S5-player-edit.html?playerId=<id>`.

**Verification:** Updated S2 Playwright green; manual check of the action row on a narrow viewport.

### U2. Partial-metrics notice wording

**Goal:** Distinguish partial vs total absence of performance metrics.

**Requirements:** R4; AE3

**Dependencies:** None

**Files:**

- `docs/ux/mockup/S2-player-dashboard.html`

**Approach:**

- In the `missingStats` branch, set `noStatsNotice.textContent` to "Some of the performance metrics are not available yet." when `hasRatedSkills || liveClips.length > 0`; otherwise keep `dashboard.performance.missingDataMessage`.
- Do not touch `mockup-api-client.js`.

**Test scenarios:**

- Covers AE3. No-stats player *with* a recorded rating → "Some of the performance metrics are not available yet."
- Edge: no-stats player with *no* ratings/clips → original "Performance metrics are not available yet."

**Verification:** Updated S2 Playwright green.

### U3. Per-position collapsible Skill Ratings with yellow average

**Goal:** Each position group collapses independently and shows a right-aligned yellow average.

**Requirements:** R5, R6; AE4

**Dependencies:** None

**Files:**

- `docs/ux/mockup/S2-player-dashboard.html`
- `docs/ux/mockup/style/site.css`

**Approach:**

- Make "Skill Ratings" a static section title (drop its section-level toggle).
- Give "Any Position" and the role block each a toggle header + collapsible body using the existing `.section-toggle` / `.section-body` / `is-collapsed` pattern; preserve `data-testid`s on the tables/bodies.
- Add a right-aligned average span to each group title using the S1 formula (mean of ratings `> 0`, `Math.round`), colored `#facc15`; render `—` when no qualifying rating.

**Test scenarios:**

- Covers AE4. Each group has its own toggle; expanding one does not toggle the other; each title shows the correct yellow average for its ratings.
- Edge: group with all "Not rated" → average shows `—`.
- Regression: `skill-rating-value-<skillId>` cells still render after expand.

**Verification:** Updated S2 Playwright green.

### U4. Update Playwright + mapping doc

**Goal:** Tests reflect removed/changed behaviors; docs note the S2 changes.

**Requirements:** R1–R6 (verification), AE1–AE5

**Dependencies:** U1, U2, U3

**Files:**

- `tests/playwright/s2-player-dashboard.spec.js`
- `docs/ux/mockup/API-Mockup-Mapping.md`

**Approach:**

- Remove/replace the "locks the team dropdown…" test (team dropdown no longer exists).
- Add assertions for absent dropdown/back button, icon action tooltips, partial-metrics wording, per-group collapse, and per-group yellow average.
- Keep the guest-share expectations working (`share-link-button` still present as an icon button).
- Update `API-Mockup-Mapping.md` if it documents the S2 toolbar / skill-ratings behaviors.

**Test scenarios:**

- Covers AE1–AE4 as assertions; AE5 via existing guest coverage kept green.

**Verification:** `s2-player-dashboard` (and `s2-guest-share` where reachable) green.

## Verification Contract

- Playwright: `tests/playwright/s2-player-dashboard.spec.js` (updated); `tests/playwright/s2-guest-share.spec.js` unaffected/green where runnable.
- Manual: S2 as coach and via a share token — action row on one line, partial notice wording, independent group collapse, yellow averages matching S1.

## Definition of Done

- R1–R6 and AE1–AE5 satisfied.
- U1–U4 complete; redundant controls removed; icon actions with tooltips on one line; partial-metrics wording correct; per-position collapse + yellow average matching S1.
- S2 Playwright suite updated and green; no changes to shared client defaults or the data model.
