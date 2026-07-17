---
title: 'feat: S2 Skill Ratings position groups default collapsed'
date: 2026-07-17
type: feat
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# feat: S2 Skill Ratings position groups default collapsed

## Goal Capsule

- **Objective:** On S2, make each Skill Ratings position group ("Any Position" and the role group) render **collapsed by default**, but keep it expanded when the user has expanded it before (persisted per player).
- **Authority:** User request 2026-07-17 — "In the 'Skill Rating' section, by default show each position collapsed, unless it has been changed by the user."
- **Stop when:** Groups start collapsed on first view; a user's per-group expand/collapse choice survives reloads and player switches; the S2 Playwright suite (updated) is green.

## Product Contract

### Summary

The Skill Ratings position groups on `docs/ux/mockup/S2-player-dashboard.html` currently render **expanded** every visit (`aria-expanded="true"`, no `is-collapsed`) and their collapse state is not remembered. This plan flips the default to **collapsed** and persists each group's expand/collapse state per player, reusing the same per-player state object the dashboard's other collapsible sections already use (`vantageiq_s2_dashboard_sections`). "Changed by the user" means: once a user expands (or re-collapses) a group, that choice is restored on later visits for that player until they change it again.

### Requirements

- R1. Each Skill Ratings position group ("Any Position", role group) renders **collapsed by default** on first view for a player (no stored preference).
- R2. When a user expands or collapses a group, that choice is **persisted per player** and restored on reload and when navigating back to the same player.
- R3. Persistence reuses the existing per-player dashboard state object in `localStorage` key `vantageiq_s2_dashboard_sections`, with distinct slugs for the two groups; it does not clobber the existing section slugs.
- R4. A group with no stored preference falls back to collapsed (R1); a stored `true` restores expanded, a stored `false` restores collapsed.
- R5. `aria-expanded` on each group toggle matches the rendered collapsed/expanded state on load and after every toggle.

### Actors

- A1. Coach/ClubAdmin/SystemAdmin viewing a player dashboard.
- A2. Guest (share-token) viewer — sees the same default-collapsed groups; persistence still applies within their session/storage.

### Key Flows

- F1. First visit to a player with skill ratings → both groups render collapsed; the yellow average is still visible on each group title row.
- F2. User expands "Any Position" → reloads the page → "Any Position" is still expanded; the role group (untouched) is still collapsed.
- F3. User switches to another player and back → the first player's per-group choices are restored independently.

### Acceptance Examples

- AE1. On first load for a player (cleared storage), `#body-skill-any` and `#body-skill-role` are hidden and their toggles read `aria-expanded="false"`.
- AE2. After expanding "Any Position" and reloading, `#body-skill-any` is visible / `aria-expanded="true"`, while the role group remains collapsed.
- AE3. The yellow per-group average (`skill-ratings-any-average` / `skill-ratings-role-average`) renders regardless of collapsed state.
- AE4. Expanding a group writes its slug into the current player's entry in `vantageiq_s2_dashboard_sections` without removing the existing section slugs.

### Scope Boundaries

#### In scope

- `docs/ux/mockup/S2-player-dashboard.html` (position-group default state + persistence in the inline script)
- `tests/playwright/s2-player-dashboard.spec.js` (default-collapsed + persistence assertions)
- `docs/ux/mockup/API-Mockup-Mapping.md` (note the new default + persistence for Skill Ratings groups)

#### Deferred to Follow-Up Work

- Persisting collapse state to the backend / across devices (today it is `localStorage`-only, matching existing sections).

#### Out of scope

- The whole-section collapse behavior of the other stats sections (Development Progress, etc.) — unchanged.
- The average calculation, icon toolbar, or partial-metrics notice from the prior S2 plan — unchanged.
- Changing what counts as a group or the skill-ratings data model.

## Planning Contract

### Assumptions

- Persistence is **per player**, matching the existing section behavior (`vantageiq_s2_dashboard_sections` is keyed `{ [playerId]: { [slug]: true|false } }`, `true` = expanded).
- Reuse the existing storage object with two new slugs — `skill-any` and `skill-role` — rather than introducing a new key. The role group uses a single stable slug even though the underlying position name varies (only one role group renders at a time).
- Guest viewers use the same client-side storage; no separate guest persistence path is required.

### Key Technical Decisions

- KTD1. The position groups are rendered dynamically inside the `renderSkillRatings` IIFE (only present when a group has rows), so both the initial default-collapsed application and the persistence read/write happen there, using `player.id` for the storage key — not in `initDashboardSectionToggles` (which explicitly skips `data-section="skill-ratings"`).
- KTD2. Reuse the same `localStorage` key and `{ [playerId]: { [slug]: true|false } }` shape as `initDashboardSectionToggles`. On render, read the player's entry; for each group slug, collapsed = `stored[slug] !== true` (default collapsed when absent). On toggle, write `stored[slug] = expanded`, preserving the other keys in the player's entry and the other players' entries.
- KTD3. Apply the collapsed state by toggling `is-collapsed` on the `.skill-position-group` and setting `aria-expanded` on the `.position-toggle` at render time (currently the markup hardcodes `aria-expanded="true"` and no `is-collapsed`). The existing per-toggle click handler continues to flip `is-collapsed`/`aria-expanded`; extend it to also persist.
- KTD4. Guard `localStorage` reads/writes with try/catch (mirroring `initDashboardSectionToggles`) so quota/parse errors degrade to in-visit-only collapse.

### Product Contract preservation

Direct planning from the user request (`product_contract_source: ce-plan-bootstrap`).

## Implementation Units

### U1. Default position groups to collapsed with per-player persistence

**Goal:** Skill Ratings groups start collapsed, restore the user's per-player choice, and persist changes.

**Requirements:** R1–R5; AE1–AE4

**Dependencies:** None

**Files:**

- `docs/ux/mockup/S2-player-dashboard.html`

**Approach:**

- In `renderSkillRatings`, after the groups are populated, read the current player's entry from `vantageiq_s2_dashboard_sections` (same read helper shape as `initDashboardSectionToggles`; a small local reader or a shared helper — implementer's call).
- For each rendered group (`skillRatingsAnyBlock` → slug `skill-any`, `skillRatingsRoleBlock` → slug `skill-role`): compute `collapsed = stored[slug] !== true`, then toggle `is-collapsed` on the `.skill-position-group` and set the toggle's `aria-expanded` accordingly.
- In the existing `.position-toggle` click handler, after flipping `is-collapsed`, write the new expanded state to the player's entry under the group's slug (preserving sibling keys) with a try/catch.
- Derive each toggle's slug from a stable source (e.g., a `data-*` attribute on the group or a lookup by element id) so the click handler knows which slug to persist.
- Optionally simplify the markup's hardcoded `aria-expanded="true"` since render now sets it; not required.

**Test scenarios:**

- Covers AE1. Cleared storage → both group bodies hidden, both toggles `aria-expanded="false"`.
- Covers AE2. Expand "Any Position", reload → Any expanded, role still collapsed.
- Covers AE3. Averages visible while collapsed.
- Covers AE4. After expanding, the player's entry in `vantageiq_s2_dashboard_sections` contains `skill-any: true` and still contains any pre-existing section slugs.
- Edge: switch to a second player and back → first player's choices restored independently (F3).
- Regression: `skill-rating-value-<skillId>` cells still render after expanding a group.

**Verification:** Updated S2 Playwright green; manual check that groups open closed and remember an expand across reload.

### U2. Update Playwright + mapping doc

**Goal:** Tests assert the new default and persistence; docs describe it.

**Requirements:** R1–R5 (verification), AE1–AE4

**Dependencies:** U1

**Files:**

- `tests/playwright/s2-player-dashboard.spec.js`
- `docs/ux/mockup/API-Mockup-Mapping.md`

**Approach:**

- Update the "collapses each Skill Ratings position group independently" test: groups now start **collapsed** (bodies hidden, `aria-expanded="false"`); expanding shows the body; assert independence between Any and role.
- Add a persistence test: expand a group, `page.reload()`, assert it stays expanded and the untouched group stays collapsed; assert per-player independence with a second player.
- Keep the yellow-average test working — averages must be assertable without expanding (they live in the always-visible title row).
- Update the beforeEach note that clears `vantageiq_s2_dashboard_sections` (already cleared) — no change needed beyond confirming it covers the new slugs.
- Update `API-Mockup-Mapping.md` Skill Ratings group bullet: default **collapsed**, per-player persistence via the shared `vantageiq_s2_dashboard_sections` object using slugs `skill-any` / `skill-role`.

**Test scenarios:**

- Covers AE1–AE4 as assertions.
- Regression: existing average/color test and the "no-stats player with ratings" test still pass (that player's group also defaults collapsed — adjust it to expand before asserting the skill value, or assert the average which is always visible).

**Verification:** `tests/playwright/s2-player-dashboard.spec.js` green.

## Verification Contract

- Playwright: `tests/playwright/s2-player-dashboard.spec.js` (updated) green; `tests/playwright/s2-guest-share.spec.js` unaffected (backend-gated, runs where `DATABASE_URL` is configured).
- Manual: load S2 as coach with cleared storage → both groups closed; expand one, reload → stays open, other stays closed; switch players and back → per-player state restored.

## Definition of Done

- R1–R5 and AE1–AE4 satisfied.
- U1–U2 complete; groups default collapsed, per-player expand/collapse persists via the shared `vantageiq_s2_dashboard_sections` object without clobbering existing section slugs.
- S2 Playwright suite updated and green; no change to the average calculation, storage key shape, or data model.
