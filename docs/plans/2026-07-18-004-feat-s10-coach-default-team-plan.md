---
title: "feat: S10 Games Team filter defaults to coach’s first assigned team"
date: 2026-07-18
type: feat
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# feat: S10 Games Team filter defaults to coach’s first assigned team

## Goal Capsule

On `S10-games.html`, when the signed-in user is a **Coach**, pre-select the Team filter to the **first team they lead** (same lead-coach email/name match as S4 / S1 Only mine). Stop when Coach open lands on that team without the U19 Prime hardcode; ClubAdmin / SystemAdmin keep a non-coach default; Playwright covers Coach Joao → U19 Prime.

**Authority:** this plan; user confirmation (2026-07-18): assigned = lead coach (call-out 1). Multi-team coaches: first after filter in `listTeams` order (assumed).

**Product Contract preservation:** N/A (ce-plan-bootstrap).

---

## Product Contract

### Summary

S10 currently hardcodes Team to “U19 Prime” after filling options. Coaches should instead default to a team they are assigned to as lead coach so Create / list start in their context.

### Requirements

- R1. When `MockupApi.getCurrentUser()` is an active Coach, after `fillTeams()` populates `#teamFilter` / `[data-testid="games-team-filter"]`, set the selected value to the first team in `listTeams()` order that matches the coach as lead (`leadCoachEmail` case-insensitive, else `leadCoach` name case-insensitive — same rules as S4 `getAvailableTeamsForActor`).
- R2. If the Coach has no matching lead team, fall back to the first option in the select (or leave empty if no teams).
- R3. When the user is ClubAdmin or SystemAdmin (or not a Coach), do **not** apply lead-coach filtering for the default; select the first team in the populated list (remove the U19 Prime hardcode for everyone).
- R4. Changing the Team filter still reloads the fixtures list as today.

### Actors

- A1. Coach — default Team = first lead-assigned team.
- A2. ClubAdmin / SystemAdmin — default Team = first team in list.

### Key Flows

- F1. Coach Joao opens S10 → Team shows U19 Prime (his lead team) without hardcoding that name.
- F2. Coach with two lead teams → Team shows the first of those two in `listTeams` order.

### Acceptance Examples

- AE1. Offline login as `joao@vantageiq.club` → S10 → `[data-testid="games-team-filter"]` selected option is U19 Prime (team id of that team).
- AE2. Coach with no lead teams → first option in the dropdown is selected (or empty list handled without throw).

### Scope Boundaries

**In scope:** `fillTeams()` default selection logic on S10; Playwright assertion for Coach Joao.

**Out of scope:** Narrowing the Team dropdown to only lead teams; persisting last-selected team; ClubAdmin “assigned” semantics beyond first-in-list; backend API changes.

### Deferred to Follow-Up Work

- Optionally restrict Coach Team dropdown options to lead teams only (parity with S4 capture filter).

---

## Planning Contract

### Assumptions

- “Assigned” means lead coach of the team (email, then name), not first club-scoped `listTeams` row.
- When a Coach leads multiple teams, “first” = first match in the array returned by `MockupApi.listTeams()` (current sort / order, typically name ASC from API).
- `MockupApi.getCurrentUser()` is available on S10 the same way other mockup screens use it.

### Key Technical Decisions

- KTD1. **Reuse S4 match rules** inline or via a small shared helper in `S10-games.html` (prefer mirroring S4’s email/name checks rather than inventing a new assignment model).
- KTD2. **Replace U19 hardcode** entirely; Coach path uses lead filter; non-Coach uses `teams[0]`.
- KTD3. **No API change** — selection is client-only after existing `listTeams()`.

### Patterns to follow

- `docs/ux/mockup/S4-video-capture.html` — `getAvailableTeamsForActor` lead-coach filter
- `docs/ux/mockup/S1-player-list.html` — Only mine lead-email match
- `docs/ux/mockup/S10-games.html` — current `fillTeams()`

### Risks

- Backend `listTeams` may return club-wide teams for Coach; default must still filter by lead, not assume the list is already lead-only.
- Demo seed: Joao → U19 Prime; Ana inactive — keep AE1 tied to Joao offline seed.

---

## Implementation Units

### U1. Coach-aware Team default on S10

**Goal:** Pre-select Team for Coaches by first lead-assigned team; remove U19 hardcode.

**Requirements:** R1–R4

**Dependencies:** None

**Files:**
- Modify: `docs/ux/mockup/S10-games.html` (`fillTeams`)
- Modify: `tests/playwright/s10-games.spec.js`

**Approach:** After building `<option>`s from `listTeams()`, resolve `currentUser` via `MockupApi.getCurrentUser()`. If role is Coach, find first team where lead email/name matches; set `teamFilter.value`. Else set to `teams[0]` when present. Then existing `renderList()` on init continues to use the selected value.

**Patterns to follow:** S4 `getAvailableTeamsForActor` match predicates.

**Test scenarios:**
- Happy (AE1): Joao offline → S10 → team filter selected text/value is U19 Prime.
- Edge (AE2): evaluate store so session Coach has no lead teams → fillTeams does not throw; first option selected if any.
- Regression: Create game still uses `teamFilter.value` (existing create test remains green).

**Verification:** Playwright S10 suite passes; manual Coach open shows lead team selected.

---

## Verification Contract

- `npx playwright test tests/playwright/s10-games.spec.js`
- Manual: login as Joao → S10 → Team = U19 Prime without relying on the old hardcode.

## Definition of Done

- U1 complete; AE1 covered in Playwright; U19 Prime hardcode removed from `fillTeams`.
