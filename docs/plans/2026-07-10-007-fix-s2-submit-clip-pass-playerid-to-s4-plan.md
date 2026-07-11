---
title: fix — S2 Submit a Clip passes playerId to S4 for auto-select
date: 2026-07-10
type: fix
classification: software
feature: 027
slug: fix-s2-submit-clip-pass-playerid-to-s4
product_contract_source: ce-plan-bootstrap
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
origin: user request 2026-07-10 — S2 Submit a Clip must pass player id to S4-video-capture so Player is auto-selected.
---

# Feature 027 — S2 Submit Clip Passes playerId to S4

## Goal Capsule

- **Objective:** When a coach clicks **Submit a Clip** / **Submit New Clip** on `S2-player-dashboard`, navigate to `S4-video-capture` with the dashboard player’s **`playerId`** so the Player `<select>` is pre-selected.
- **Authority:** Mockup HTML only (`S2` link wiring + `S4` query-param apply); reuse the existing `?playerId=` convention already used for S2→S5 and S2→S6.
- **Done when:** Both S2 clip CTAs include `playerId` when a player is known; S4 reads `playerId` after populating the player list and selects that option when present; Playwright covers the handoff.
- **Out:** Changing bottom-nav Capture links site-wide; auto-selecting team/skills beyond what is needed for the player option to appear; API/schema changes.

### Summary

Wire S2 clip CTAs to `S4-video-capture.html?playerId=…` and teach S4 to apply that query param to the Player select after load.

## Product Contract

### Problem Frame

S2 already knows which player the coach is viewing, and already passes `playerId` to Edit Player and View Results. The Submit Clip buttons still link to bare `S4-video-capture.html`, so the coach must re-pick the same player on S4.

### Actors

- A1. **Coach** — on a player’s S2 dashboard, clicks Submit a Clip / Submit New Clip and expects that player selected on S4.

### Key Flows

- F1. S2 with resolved player → click Submit a Clip / Submit New Clip → land on S4 with `?playerId=<id>` → Player select shows that player.
- F2. S4 opened without `playerId` (bottom nav, direct URL) → Player select stays on placeholder (unchanged).
- F3. S4 opened with unknown/stale `playerId` → leave Player unselected (no crash).

### Acceptance Examples

- AE1. Dashboard for Lionel Messi (`playerId=10`) → Submit a Clip href contains `playerId=10` → S4 `#player` value is `10`.
- AE2. Empty-state **Submit a Clip** CTA (no-stats player) also carries that player’s id when the dashboard resolved them.
- AE3. Opening S4 with no query leaves `#player` empty.

### Requirements

- R1. Both S2 primary clip CTAs (**Submit New Clip** in video assessments and **Submit a Clip** in the no-stats empty state) must include `playerId` when `player.id` is known — same encoding style as Edit Player (`encodeURIComponent`).
- R2. S4 must read `playerId` from the URL (query string) after the player options are populated and set `#player` to that value when a matching option exists.
- R3. If the id is missing from the option list, leave the select on the placeholder; do not invent a player.
- R4. Changing the Team filter on S4 after load may clear or refresh the player list — if refresh rebuilds options, re-apply `playerId` when the option is still present, or accept that a team change is a deliberate user override (prefer: re-apply only on initial load unless cheap to re-apply after each `refreshPlayers`).
- R5. Extend Playwright coverage on the existing S2→S4 navigation assertion so it checks `playerId` in the URL and the selected player on S4.

### Scope Boundaries

#### In scope

- `docs/ux/mockup/S2-player-dashboard.html` clip CTA hrefs
- `docs/ux/mockup/S4-video-capture.html` query-param apply
- `tests/playwright/s2-player-dashboard.spec.js` (and/or `s4-video-capture.spec.js`)

#### Out of scope

- Bottom-nav Capture links on S2 or other screens
- Passing `playerName` / `teamName` unless required for the option to appear (prefer id-only; set team filter only if needed so the player remains in the filtered list)
- Backend/OpenAPI changes

## Planning Contract

### Assumptions

- Product Contract preservation: N/A (ce-plan-bootstrap).
- Query key is **`playerId`**, matching S5/S6 handoffs already on S2.
- With S4’s default team filter `all`, the dashboard player is already in `listPlayers` for the same coach scope — no team pre-filter required for the happy path.

### Key Technical Decisions

- KTD1. **Mirror View Results / Edit Player wiring on S2** — set clip CTA `href` in the same render path that already has `player` (not hard-coded static HTML alone), so both CTAs stay correct for no-stats and stats-present states.
- KTD2. **Apply `playerId` after `populatePlayerSelect`** on initial load; optionally after each `refreshPlayers` when the option still exists so a team change that still includes the player keeps selection.
- KTD3. **No API changes** — pure mockup navigation + client select state.

### Risks & Dependencies

- Existing Playwright test navigates S2→S4 without asserting selection — must update or it will keep passing while the bug remains half-fixed.
- Coach `onlyMine` filtering: if a player is visible on S2 but missing from S4’s list, auto-select cannot work — treat as F3; investigate only if AE1 fails in practice.

## Implementation Units

### U1. S2 clip CTAs include playerId

- **Goal:** Both Submit clip links carry the dashboard player id.
- **Requirements:** R1, AE2
- **Dependencies:** None
- **Files:**
  - Modify: `docs/ux/mockup/S2-player-dashboard.html`
  - Test: `tests/playwright/s2-player-dashboard.spec.js`
- **Approach:** Give both CTAs stable ids or `data-testid`s if missing; in the dashboard render function (alongside `editPlayerLink` / `viewResultsLink`), set `href` to `./S4-video-capture.html?playerId=` + encoded id when `player.id` is present. Leave bare S4 href only if no player id (should be rare on this screen).
- **Patterns to follow:** `editPlayerLink.href = './S5-player-edit.html?playerId=' + encodeURIComponent(player.id)` in the same file.
- **Test scenarios:**
  - Happy path: Covers AE1. Submit New Clip / Submit a Clip href matches `/S4-video-capture\.html\?playerId=/`.
  - Happy path: Covers AE2. No-stats empty-state Submit a Clip also includes `playerId` for the resolved player.
- **Verification:** Playwright href assertions pass; manual click from S2 shows query string.

### U2. S4 auto-selects Player from playerId query

- **Goal:** S4 selects the matching player option when `playerId` is in the URL.
- **Requirements:** R2, R3, R4, R5, AE1, AE3
- **Dependencies:** U1 (for end-to-end proof); can implement S4 independently with direct URL tests
- **Files:**
  - Modify: `docs/ux/mockup/S4-video-capture.html`
  - Modify: `tests/playwright/s2-player-dashboard.spec.js` and/or `tests/playwright/s4-video-capture.spec.js`
- **Approach:** Parse `playerId` from `URLSearchParams` / location search. After `refreshPlayers()` / `populatePlayerSelect`, if an option with that value exists, set `playerSelect.value`. Prefer a small helper `applyPlayerIdFromQuery(playerSelect)` called from initial load (and optionally from `refreshPlayers`). Invalid id → leave placeholder.
- **Patterns to follow:** S6 assessment list query preselection; S2’s own `playerId` URL parsing for avatar upload.
- **Test scenarios:**
  - Happy path: Covers AE1. From S2 click Submit → URL has `playerId` → `#player` selected value equals that id (or selected option text is the dashboard player name).
  - Happy path / edge: Covers AE3. Direct `/S4-video-capture.html` → `#player` value is empty.
  - Edge: `/S4-video-capture.html?playerId=does-not-exist` → `#player` remains empty; page usable.
- **Verification:** Playwright S2→S4 flow asserts selection; S4 direct-load regression still passes.

## Verification Contract

- Playwright: extend `tests/playwright/s2-player-dashboard.spec.js` “provides actions to view results and submit clips” (or adjacent test) to assert `playerId` query + selected player on S4.
- Optional: `tests/playwright/s4-video-capture.spec.js` direct `?playerId=` case.
- Manual: open S2 for a known player → Submit a Clip → confirm Player dropdown pre-filled.

## Definition of Done

- U1–U2 complete; R1–R5 satisfied.
- Both S2 clip CTAs pass `playerId` when a player is known.
- S4 auto-selects that player when the option exists.
- Playwright covers the handoff; no API/schema churn.
