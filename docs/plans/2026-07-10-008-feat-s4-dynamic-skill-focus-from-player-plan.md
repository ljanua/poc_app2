---
title: feat — S4 Skill Focus from player Any Position + role skills
date: 2026-07-10
type: feat
classification: software
feature: 028
slug: feat-s4-dynamic-skill-focus-from-player
product_contract_source: ce-plan-bootstrap
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
origin: user request 2026-07-10 — S4 Skill Focus options must match S2 skill list for the selected player (Any Position basics + position_skills for assigned position).
---

# Feature 028 — Dynamic S4 Skill Focus from Player Skills

## Goal Capsule

- **Objective:** Replace S4’s hard-coded Skill Focus checkboxes with a **dynamic list** for the selected player: the same skills S2 shows — **Any Position** skills for the player’s sport **plus** skills from `position_skills` for the player’s assigned position (role-unique only; no duplicate Any Position skills).
- **Authority:** Reuse existing `listSkillsForPlayer` / `MockupApi.listPlayerSkillRatings` (already powers S2 `dashboard.skillRatings`); S4 UI rebuilds checkboxes on player change.
- **Done when:** Selecting a player on S4 renders Skill Focus options from that API/helper (skill names); changing player refreshes the list; no player → empty/hint state; submit still posts `skillFocus` as skill **names**; Playwright covers the dynamic list.
- **Out:** Changing S2/S5 skill-rating UX; new skill catalog APIs; requiring Skill Focus (stays optional); grouping checkboxes into Any vs Role sections (flat list is enough unless cheap).

### Summary

Drive S4 Skill Focus from the same player skill set as S2 (Any Position + assigned-position skills via `position_skills`), refreshing whenever the selected player changes.

## Product Contract

### Problem Frame

S4 Skill Focus is four static labels (`Decision-making`, `Technical Skill`, …) that do not match the sport/position skill catalog used on S2. Coaches tagging a clip cannot focus the assessment on the skills the product already tracks for that player.

### Actors

- A1. **Coach** — on S4, picks a player (including via `?playerId=` from S2) and optionally checks Skill Focus skills that belong to that player’s tracked set.

### Key Flows

- F1. Coach selects player → Skill Focus checkboxes rebuild from that player’s skill list (Any Position ∪ role-unique position skills).
- F2. Coach changes player → previous checks clear; new skill list appears.
- F3. No player selected (or player with no resolvable skills) → no skill checkboxes (or a short hint); submit still works with empty `skillFocus`.
- F4. Submit → `skillFocus` array uses **skill names** (same strings S2/S6/assessment use), not legacy short codes (`decision`, `pace`).

### Acceptance Examples

- AE1. Player on Soccer with position **Any Position** → Skill Focus shows the Any Position skill names (e.g. Ball Control, Passing, Game Awareness, Fitness, Speed) and not the old hard-coded four.
- AE2. Player assigned **Goalkeeper** (or another role) → list includes Any Position skills **plus** GK-only skills from `position_skills`, without duplicating skills already on Any Position.
- AE3. Changing from player A to player B replaces the checkbox set to B’s skills.
- AE4. With no player selected, Skill Focus has no skill checkboxes (hint optional).

### Requirements

- R1. Skill Focus options for a selected player MUST be the same skill set S2 uses for that player: Any Position skills for the team’s sport + skills assigned to the player’s position via `position_skills`, excluding duplicates already on Any Position.
- R2. Prefer calling the existing client/API surface (`MockupApi.listPlayerSkillRatings(playerId)` → `{ skillId, skillName, … }`) rather than inventing a parallel skill-resolution path.
- R3. Rebuild the checkbox group when the Player `<select>` changes and after initial `playerId` query auto-select.
- R4. Checkbox **label and value** use `skillName` (human-readable); submit payload `skillFocus` / primary `skill` continue to use those names.
- R5. Skill Focus remains optional; empty selection is valid.
- R6. Remove the static four hard-coded checkboxes from S4 markup (container stays; filled by script).

### Scope Boundaries

#### In scope

- `docs/ux/mockup/S4-video-capture.html` Skill Focus UI + wiring
- Playwright updates in `tests/playwright/s4-video-capture.spec.js`
- Light mapping note in `docs/ux/mockup/API-Mockup-Mapping.md` if S4 skill focus is documented

#### Out of scope

- New backend endpoints (reuse `GET /players/{playerId}/skill-ratings`)
- Changing how `listSkillsForPlayer` resolves Any vs role
- S2/S5 layout changes
- Requiring at least one skill focus

## Planning Contract

### Assumptions

- Product Contract preservation: N/A (ce-plan-bootstrap).
- `listPlayerSkillRatings` / `listSkillsForPlayer` already implement the Any Position + role-unique union described by the user.
- Flat checkbox list (no Any/Role section headers on S4) is acceptable; order follows API sort (Any first, then role, by name).

### Key Technical Decisions

- KTD1. **Reuse `listPlayerSkillRatings`** — same source as S2 dashboard `skillRatings` rows; ignore `rating` for checkbox rendering.
- KTD2. **Values = `skillName`** — aligns clip `skillFocus` with assessment/Ollama skill strings and S6 display; do not submit legacy short codes.
- KTD3. **Empty container + `data-testid="skill-focus-group"`** — render checkboxes in JS; show a muted hint when no player / empty skill list.

### Risks & Dependencies

- Existing S4 Playwright submit flow may assume static labels — update to check a dynamic skill or leave skill focus unchecked.
- Offline vs backend: both already implement the same list via client/API; tests that need deterministic names should use offline mode or assert against `listPlayerSkillRatings` results.

## Implementation Units

### U1. Dynamic Skill Focus checkboxes on S4

- **Goal:** Populate Skill Focus from the selected player’s S2 skill set; refresh on player change.
- **Requirements:** R1–R6, AE1–AE4
- **Dependencies:** None (Feature 027 `playerId` auto-select already lands a selected player before refresh — call skill rebuild after that)
- **Files:**
  - Modify: `docs/ux/mockup/S4-video-capture.html`
  - Modify: `tests/playwright/s4-video-capture.spec.js`
  - Optionally modify: `docs/ux/mockup/API-Mockup-Mapping.md`
- **Approach:** Replace static checkbox markup with an empty `.checkbox-group` (testid). Add `renderSkillFocus(playerId)` that clears the group, calls `MockupApi.listPlayerSkillRatings(playerId)`, and appends one checkbox per row (`name="skill"`, `value`/`label` = `skillName`, `data-skill-id` = `skillId`). Call after player select `change`, after initial `applyPlayerIdFromQuery` / `refreshPlayers`, and clear/hint when player is blank. Keep submit handler reading `input[name="skill"]:checked` values.
- **Patterns to follow:** S2 consumption of `dashboard.skillRatings`; S8 assign-skills checklist rendering; existing S4 `applyPlayerIdFromQuery` timing.
- **Test scenarios:**
  - Happy path: Covers AE1. Offline Messi (or seeded Any Position player) → Skill Focus contains Any Position skill names (e.g. Ball Control / Passing); does not contain the old static-only set as the sole options.
  - Happy path: Covers AE2. Player with a non–Any Position role → at least one role-unique skill appears alongside Any Position skills when the seed assigns them.
  - Happy path: Covers AE3. Select player A then B → checkbox labels match B’s `listPlayerSkillRatings` names.
  - Edge: Covers AE4. No player selected → zero `input[name="skill"]` (or only hint text).
  - Integration: Submit with one skill checked still succeeds; `skillFocus` uses the skill name string.
- **Verification:** Playwright S4 specs pass; manual S4 with GK vs Any Position players shows different Skill Focus sets matching S2.

## Verification Contract

- Playwright: `tests/playwright/s4-video-capture.spec.js` (extend existing suite; offline mode for deterministic seed skills).
- Manual: open S2 Skill Ratings for a player, then S4 with that `playerId` — Skill Focus names should match the union of Any + role tables (names only).

## Definition of Done

- U1 complete; R1–R6 satisfied.
- Static four checkboxes gone; dynamic list matches S2 skill set for the selected player.
- Submit payload uses skill names; optional focus unchanged.
- Playwright covers empty, Any Position, and player-change cases (role case when seed allows).
