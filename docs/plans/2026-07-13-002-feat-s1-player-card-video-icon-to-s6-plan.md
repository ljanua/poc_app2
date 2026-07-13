---
title: feat — S1 player-card video icon deep-links to S6
date: 2026-07-13
type: feat
classification: software
feature: 033
slug: feat-s1-player-card-video-icon-to-s6
product_contract_source: ce-plan-bootstrap
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
origin: user request 2026-07-13 — video icon lower-right on S1 player card only when a video is assigned; click opens S6-assessment-list with that playerId to show the player’s videos.
---

# Feature 033 — S1 Player-Card Video Icon → S6

## Goal Capsule

- **Objective:** On `S1-player-list`, show a **video** control at the **lower right** of each player card **only when that player has ≥1 clip**. Clicking it opens `S6-assessment-list.html` filtered to that player (same deep-link shape as S2 View Results).
- **Authority:** Gate on live `MockupApi.listClips` (any status), not cached `clipStats`. Deep-link with `playerId` (+ `playerName` / `teamName` when available) so S6 Pre-Selected Player turns on.
- **Done when:** Cards with clips show the icon; cards without do not; click lands on S6 for that player; Playwright covers present/absent/click; API-Mockup-Mapping notes the S1 entry.
- **Out:** Changing S6 sort/layout; new list-players API fields; using unreliable `player_stats.clip_*` counts; Reporting spider chart (`docs/backlog/013-…`).

---

## Product Contract

### Summary

Give coaches a one-click path from a roster card to that player’s video assessments whenever the player already has at least one submitted clip.

### Problem Frame

S1 cards only offer **View** → S2. Coaches who already know a player has videos must open the dashboard and then View Results. Clip presence is known to the system (`clips` table / offline `store.clips`) but is not surfaced on the roster card.

### Actors

- A1. **Coach** — on S1, sees which players have videos and jumps straight to S6 for that player.

### Key Flows

- F1. Player has ≥1 clip (any status) → video icon visible lower-right on card → click → S6 with Pre-Selected Player on for that `playerId`.
- F2. Player has 0 clips → no video icon.
- F3. Team/search filter changes → icon visibility re-evaluates for the rendered roster (still based on live clips for those players).

### Acceptance Examples

- AE1. Seeded Lionel Messi (offline id `10`, has clips) shows the video icon; click URL includes `playerId=10` (and name/team when known); S6 shows Pre-Selected Player checked and Messi’s clips.
- AE2. A player with no clips in the store/DB shows no video icon.
- AE3. View → S2 still works; video icon does not replace View.

### Requirements

- R1. Render a video affordance on the **lower-right** of `.player-card` when the player has ≥1 clip.
- R2. Hide the affordance when the player has zero clips.
- R3. Clip presence comes from **live clips** (`MockupApi.listClips`), any status (`submitted`, `in_progress`, `complete`, `failed`, etc.), not from `dashboard.clipStats` / `player_stats.clip_*`.
- R4. Click navigates to `S6-assessment-list.html?playerId=…` and include `playerName` / `teamName` when available (mirror S2 View Results).
- R5. Do not break existing View → S2 behavior or card layout for players without videos.
- R6. Document the S1 → S6 entry in `docs/ux/mockup/API-Mockup-Mapping.md`.

### Scope Boundaries

#### In scope

- `docs/ux/mockup/S1-player-list.html` — icon + clip-set gating + link
- `docs/ux/mockup/style/site.css` — lower-right positioning
- `docs/ux/mockup/API-Mockup-Mapping.md`
- `tests/playwright/s1-player-list.spec.js`

#### Out of scope

- Enriching `GET /v1/players` with clip flags
- S6 UI changes (filter/sort already handle `playerId`)
- Icon on S2/S5
- Only-complete / only-assessed gating (any assigned clip counts)

#### Deferred to Follow-Up Work

- Server-side `hasClips` on list payload if roster size makes client `listClips` costly

---

## Planning Contract

### Product Contract preservation

Bootstrap from user request; no upstream brainstorm file.

### Assumptions

- “Video is actually assigned” means ≥1 row in `clips` for that `playerId` (any status).
- “Latest videos” is satisfied by existing S6 player filter (no new sort requirement stated).
- One roster-scoped `listClips` call (optionally narrowed by current team filter) is acceptable for POC roster sizes.

### Key Technical Decisions

- KTD1. **One `listClips` → Set of playerIds** — after loading players (or in parallel), call `listClips` once (pass `teamName` when S1 is not “all”), build `Set` of `String(clip.playerId)`, show icon iff set has the card’s id. Avoids N+1 and unreliable `clipStats`.
- KTD2. **Absolute lower-right control** — `position: absolute; right/bottom` on `.player-card` (card is already `position: relative`); keep `.view-btn` as the primary flex action.
- KTD3. **Deep-link parity with S2** — `playerId`, `playerName`, `teamName` query params; S6 Pre-Selected Player behavior unchanged.
- KTD4. **Accessible control** — `<a>` or `<button>` with clear `aria-label` (e.g. “View video assessments”) and a dedicated `data-testid` (e.g. `player-card-video-link`).

### High-Level Technical Design

```mermaid
flowchart TD
  load[listPlayers + listClips]
  set[Build Set of playerIds with clips]
  render[renderPlayers]
  has{playerId in Set?}
  icon[Show lower-right video link to S6]
  hide[No video icon]
  click[Navigate S6?playerId&playerName&teamName]

  load --> set --> render --> has
  has -->|yes| icon --> click
  has -->|no| hide
```

### Risks & Dependencies

- Stale icons if clips change without re-render — accept until next filter/load (same class of freshness as other mockup lists).
- Large unfiltered `listClips` — POC OK; defer list payload flag if needed.
- Don’t let the absolute icon overlap the View button on narrow cards — size/spacing in CSS; verify mobile.

---

## Implementation Units

### U1. S1 video icon + clip-gated render + S6 link

- **Goal:** Lower-right video control on cards that have clips; click opens S6 for that player.
- **Requirements:** R1–R6, AE1–AE3
- **Dependencies:** None
- **Files:**
  - Modify: `docs/ux/mockup/S1-player-list.html`
  - Modify: `docs/ux/mockup/style/site.css`
  - Modify: `docs/ux/mockup/API-Mockup-Mapping.md`
- **Approach:** In the S1 load/render path, fetch clips once (respect current team filter when not “all”). Build a playerId set. In `renderPlayers`, if the player is in the set, append an absolute-positioned link to S6 with encoded `playerId` / `playerName` / `teamName`. Use a simple video glyph (emoji or existing icon style consistent with the mockup — not a new asset pipeline). Recompute the set whenever the roster is reloaded/re-filtered.
- **Patterns to follow:** S2 View Results href construction; S1 `data-player-id` on cards; Feature 029 live `listClips` gating (not `clipStats`).
- **Test scenarios:** Covered in U2.
- **Verification:** Manual: Messi shows icon → S6 filtered; clip-less player has no icon; View still opens S2.

### U2. Playwright coverage for icon visibility and deep-link

- **Goal:** Lock presence/absence and S6 landing params.
- **Requirements:** AE1–AE3
- **Dependencies:** U1
- **Files:**
  - Modify: `tests/playwright/s1-player-list.spec.js`
- **Approach:** Offline mode. Assert Messi (or seeded clip owner) has `[data-testid="player-card-video-link"]`. Add/remove a player with no clips and assert absence. Click icon → expect S6 URL with `playerId` and Pre-Selected Player checked (or at least player-filtered results).
- **Execution note:** Prefer `__USE_MOCK_LOCAL__` for deterministic clip seeding.
- **Test scenarios:**
  - Happy: player with seeded clip → icon visible; href contains `playerId=` for that player.
  - Edge: player with zero clips → icon count 0 on that card.
  - Integration: click → S6 loads with preselected player filter on / player’s assessment visible.
  - Regression: View link still targets S2 for the same card.
- **Verification:** `npx playwright test tests/playwright/s1-player-list.spec.js` green.

---

## Verification Contract

- Playwright S1 suite green including new video-icon cases.
- Spot-check: player with clips → icon → S6; player without → no icon.

## Definition of Done

- R1–R6 and AE1–AE3 satisfied.
- U1–U2 complete.
- No new backend list field unless implementation proves client `listClips` is insufficient (then stop and confirm before expanding scope).

## Appendix

### Sources & Research

- User request 2026-07-13.
- Local: S1 `renderPlayers` / `.player-card`; S2→S6 deep-link; `MockupApi.listClips`; Feature 029 live-clips gate; plan `2026-07-13-001` is Feature 032.
- Institutional learnings: none specific to S1 video icon.
