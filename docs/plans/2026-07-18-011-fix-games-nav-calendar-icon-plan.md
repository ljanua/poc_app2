---
title: "fix: Align Games bottom-nav icon to calendar"
type: fix
date: 2026-07-18
origin: user request
product_contract_source: ce-plan-bootstrap
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
---

# fix: Align Games bottom-nav icon to calendar

## Goal Capsule

- **Outcome:** Every mockup bottom-nav `Games` item shows the same calendar icon already used on S10 (`🗓️`), replacing the literal `???` placeholder on other screens.
- **Authority:** User request (this plan); S10 Games nav as the icon source of truth.
- **Done when:** No mockup HTML still uses `???` for `data-testid="nav-games"`; Playwright asserts the calendar glyph on at least one off-S10 page; S10 unchanged.

## Product Contract

### Summary

Make the bottom-nav Games icon consistent: use the S10 calendar emoji everywhere Games appears in the nav. Other pages currently show a leftover `???` placeholder from when the Games item was wired in.

### Requirements

- R1. Canonical Games nav icon is the calendar emoji `🗓️` as already rendered on `docs/ux/mockup/S10-games.html` (`data-testid="nav-games"`).
- R2. Every other mockup page that includes `data-testid="nav-games"` must use that same `nav-icon` content (not `???` or any other glyph).
- R3. Do not change other bottom-nav items (Players, Teams, Capture, My Clips, role-gated entries) or Games link targets/labels/`data-testid`.
- R4. Screens that do not currently expose Games in the bottom nav (e.g. login, `S3a-team-update.html`) stay as-is unless they already have `nav-games`.

### Scope Boundaries

- **In:** Replace Games `nav-icon` text on all mockup HTML that currently has the wrong/placeholder icon.
- **Out:** Centralizing bottom-nav into a shared partial/component; redesigning the nav set; SVG icons; docs mapping churn unless a Games icon note already exists and is wrong.

### Deferred to Follow-Up Work

- Extract shared bottom-nav markup so icon drift cannot recur.

## Planning Contract

### Assumptions

- The wrong icon is the literal three-character placeholder `???` (confirmed across S1–S9 family pages that include Games), not a different emoji that needs product debate.
- S10’s `🗓️` is the required canonical glyph; no alternate calendar character.

### Key Technical Decisions

- KTD1. Mechanical per-page string replace of Games `nav-icon` from `???` → `🗓️`; do not introduce a shared nav renderer in this fix (keeps blast radius to icon consistency only).
- KTD2. Strengthen coverage by asserting the icon on an off-S10 page that already has a Games nav test (extend `tests/playwright/s10-games.spec.js` “Games nav is present for coach”), so placeholder regression fails CI.

## Implementation Units

### U1. Replace placeholder Games icons on all non-S10 mockups

**Goal:** Every `data-testid="nav-games"` icon matches S10.

**Requirements:** R1, R2, R3, R4

**Dependencies:** None

**Files:**

- Modify: `docs/ux/mockup/S1-player-list.html`
- Modify: `docs/ux/mockup/S2-player-dashboard.html`
- Modify: `docs/ux/mockup/S3-team-management.html`
- Modify: `docs/ux/mockup/S4-video-capture.html`
- Modify: `docs/ux/mockup/S5-player-edit.html`
- Modify: `docs/ux/mockup/S6-assessment-list.html`
- Modify: `docs/ux/mockup/S7-admin-user-management.html`
- Modify: `docs/ux/mockup/S7a-clubs.html`
- Modify: `docs/ux/mockup/S8-skills.html`
- Modify: `docs/ux/mockup/S9-assessment.html`
- Leave unchanged: `docs/ux/mockup/S10-games.html` (already correct)

**Approach:** For each file above, within the `nav-games` anchor only, set `<span class="nav-icon">🗓️</span>`. Repo search for `nav-icon">???` under `docs/ux/mockup/` should return zero hits after the change. Do not touch S3a or S0 if they lack `nav-games`.

**Patterns to follow:** Existing S10 bottom-nav Games item markup.

**Test expectation:** none — behavioral proof owned by U2; this unit is markup-only.

**Verification:** Grep shows no `???` Games icons; spot-check S1 and S7a bottom nav visually or via DOM.

### U2. Playwright assertion for Games calendar icon off S10

**Goal:** Prevent the placeholder from returning unnoticed.

**Requirements:** R1, R2

**Dependencies:** U1

**Files:**

- Modify: `tests/playwright/s10-games.spec.js`

**Approach:** In the existing “Games nav is present for coach” flow (lands on S1 then uses `nav-games`), assert that `[data-testid="nav-games"] .nav-icon` has text `🗓️` before click. Keep the click/navigation assertion.

**Execution note:** Prefer smoke/DOM assertion over visual snapshot; emoji text match is enough.

**Test scenarios:**

- Happy path: On S1 as coach Joao, Games nav icon text is `🗓️`.
- Integration: Clicking Games still navigates to S10.

**Verification:** Focused Playwright file for S10/nav passes.

## Verification Contract

- Grep `docs/ux/mockup` for `nav-icon">???` → no matches.
- Grep `data-testid="nav-games"` siblings → all use `🗓️`.
- Run `tests/playwright/s10-games.spec.js`.

## Definition of Done

- U1 and U2 complete.
- Verification Contract green.
- No unrelated nav or copy changes in the diff.
