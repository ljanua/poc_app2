---
title: 'feat: Make all S3a team fields updatable including name and age group'
date: 2026-07-14
type: feat
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
origin: user request (S3a unfinished; all fields updatable)
---

# feat: Make all S3a team fields updatable including name and age group

## Goal Capsule

- **Objective:** Finish S3a so every create-time team field (name, age group, lead coach, club, status, sport) can be edited and persisted; keep player count display-only.
- **Authority:** Confirmed scoping synthesis (2026-07-14): keep Current Snapshot; add name/age inputs under Edit; cascade offline `player.teamName` on rename. Prefer extending `updateTeamCoachAndClub` + `POST /teams/:id/update` over a new endpoint.
- **Stop when:** Name and age group save end-to-end (live + offline); unique-name conflicts surface inline; offline roster survives rename; Playwright covers the new fields; Definition of Done checks pass.

---

## Product Contract

### Summary

S3a today edits coach, club, status, and sport while name and age group remain snapshot-only, which leaves team update unfinished vs create on S3. This plan makes name and age group editable on the same form, wires them through the existing update API, and keeps role/club scoping for Coach and ClubAdmin.

### Requirements

- R1. S3a Edit form exposes required **Team name** and **Age group** inputs prefilled from the loaded team, alongside existing coach/club/status/sport controls.
- R2. Current Snapshot stays on the page (including name, age group, and computed player count); player count remains non-editable.
- R3. Save persists name, ageGroup, coachEmail, clubId, status, and sportId in one request via the existing team-update path.
- R4. Team name validation matches create: trimmed/title-cased, minimum length, and unique across teams (same id may keep its name; clash with another team → conflict / inline error).
- R5. Age group is required non-empty text (same shape as create); no cascade into player birth years in this work.
- R6. Offline: when name changes, update every `player.teamName` that matched the previous name so the roster and counts stay with the team. Live DB assignments use `team_id` — no player-row cascade.
- R7. Role and club scope unchanged: SystemAdmin any team; Coach and ClubAdmin only within `coach_clubs` (include ClubAdmin in offline update scoping where Coach is already enforced).
- R8. On success, redirect to S3 with the usual toast; on validation/conflict/forbidden, stay on S3a with inline error.

### Actors

- A1. SystemAdmin — can update any team's full field set.
- A2. Coach — club-scoped team updates (existing).
- A3. ClubAdmin — club-scoped team updates (existing live; offline scope aligned in this work).

### Key Flows

- F1. Editor opens S3a for a team → form prefilled including name/age → edits name and/or age → Save → S3 shows updated values.
- F2. Editor renames a team to an existing other team's name → Save fails with conflict message; team unchanged.
- F3. Offline rename of a team that has players → those players still list under the new name / team player count.

### Acceptance Examples

- AE1. Coach opens U19 Prime on S3a, sets name to a unique value and age group to `U18`, saves; S3 row shows the new name and age group; restore/teardown leaves seeded teams intact for other tests.
- AE2. Attempting to rename to `Senior Squad` while editing another team shows an inline error and does not navigate away.
- AE3. Offline mode: after rename, players previously on the old team name still count toward that team.

### Scope Boundaries

#### In scope

- S3a form fields + submit payload.
- `MockupApi.updateTeamCoachAndClub` and `POST /api/v1/teams/:id/update`.
- Offline player `teamName` cascade on rename.
- Offline ClubAdmin club-scope parity on update.
- Playwright + mapping docs; Vitest/API client shape locks if present for update body.

#### Out of scope / deferred

- Recomputing player `birth_year` from age group.
- New screens or redesign that removes Current Snapshot.
- Renaming the `updateTeamCoachAndClub` API method (keep name for callers; payload grows).
- Club create / sport catalog changes.

---

## Planning Contract

### Assumptions

- “All fields” means the create-time team identity and assignment fields, not derived metrics (player count).
- Create-side name uniqueness (`LOWER(name)` / offline `findTeamByName`) is the conflict model for update.
- Improving the create conflict message (“user…”) is optional nicety if touched; prefer a clear team-name conflict string when adding update conflicts.

### Key Technical Decisions

- KTD1. Extend the existing update endpoint and `updateTeamCoachAndClub` rather than a PATCH to a new resource — one save, one auth/scope path. Rationale: S3a already commits through this call; create already knows name/ageGroup validation.
- KTD2. Keep Current Snapshot + editable inputs under Edit (not a single merged form). Rationale: matches confirmed UX; snapshot remains the at-a-glance truth including player count.
- KTD3. Cascade offline `player.teamName` on rename only; live persistence relies on `player_team_assignments.team_id`. Rationale: offline store is name-keyed; DB is id-keyed.
- KTD4. Treat age-group-only edits as first-class (no forced rename); uniqueness check only when the new name differs (case-insensitive) from another team's name.
- KTD5. While touching offline update scope, align ClubAdmin with Coach club checks so ClubAdmin cannot move a team to a foreign club offline.

### Patterns to follow

- Create form fields in `docs/ux/mockup/S3-team-management.html` (`#teamNameInput`, `#teamAgeGroupInput`).
- Unique-name check in `MockupApi.createTeam` / serve-mockup `POST /teams`.
- Existing S3a error + redirect patterns and `tests/playwright/team-update.spec.js` restore helpers (extend restore to include original name/ageGroup).

### Product Contract preservation

Product Contract authored in this bootstrap run; no upstream brainstorm IDs to preserve.

---

## Implementation Units

### U1. Persist name and ageGroup on team update (API + client)

**Goal:** Live and offline update paths accept and store name + ageGroup with uniqueness and offline rename cascade; ClubAdmin club-scoped offline.

**Requirements:** R3, R4, R5, R6, R7

**Dependencies:** None

**Files:**

- `scripts/serve-mockup.js` — `POST /api/v1/teams/:id/update`
- `docs/ux/mockup/js/mockup-api-client.js` — `updateTeamCoachAndClub` (and create uniqueness helpers as reused)
- `apps/api/tests/integration/teams/mockup-api-client.spec.ts` (and/or teams update shape specs) — update if they lock POST body keys

**Approach:**

- Parse `name` / `ageGroup` from the update body; validate with the same rules as create (title-case name, non-empty age group).
- Reject duplicate names (exclude current team id); map UNIQUE violation to 409.
- Extend SQL `UPDATE teams` to set `name`, `age_group` with coach/club/status/sport.
- Offline: apply fields; if name changed, rewrite matching `store.players[].teamName`; apply ClubAdmin to the club allowlist check used for Coach.
- Online body from client must forward `name` and `ageGroup`.

**Patterns to follow:** createTeam uniqueness; existing coach/club/status/sport update transaction.

**Test scenarios:**

- Happy path: update name + ageGroup on an existing team → 200; refreshed payload shows new values.
- Edge: name unchanged (same team) → 200 (no false conflict).
- Error: rename to another team's name → 409/conflict message; team row unchanged.
- Error: empty name or ageGroup → 400 validation.
- Integration (offline): rename team with players → those players’ `teamName` matches new name; playerCount on summary still correct.
- ClubAdmin offline: updating clubId to a club outside `coach_clubs` → 403 forbidden_scope.

**Verification:** Live update via mockup server persists name/ageGroup; offline store reflects rename + player cascade; ClubAdmin cannot escape club scope offline.

---

### U2. S3a form: editable name and age group

**Goal:** Expose and submit name/age fields on S3a without removing Current Snapshot.

**Requirements:** R1, R2, R3, R8

**Dependencies:** U1

**Files:**

- `docs/ux/mockup/S3a-team-update.html`
- `docs/ux/mockup/API-Mockup-Mapping.md` — Team Update section

**Approach:**

- Add `#updateNameInput` and `#updateAgeGroupInput` (with testids) under Edit; prefill from `state.team`; required.
- Submit includes `name` and `ageGroup` with existing fields.
- After load, snapshot rows continue to show current values (including player count).
- Document payload additions in the mapping doc.

**Patterns to follow:** S3 create modal labels/inputs; existing S3a selects and error display.

**Test scenarios:** covered under U3 (UI); unit itself verifies prefilling and payload wiring via Playwright.

**Verification:** Opening S3a shows prefilled name/age; Save sends them; success toast/redirect unchanged.

---

### U3. Playwright coverage and safe restore for rename tests

**Goal:** Lock happy path, conflict, and offline rename cascade; prevent seed pollution.

**Requirements:** R4, R6, R8; AE1–AE3

**Dependencies:** U1, U2

**Files:**

- `tests/playwright/team-update.spec.js`

**Approach:**

- Extend `restoreTeam` (or add a helper) to restore original name/ageGroup/sport for seeded teams after mutable tests.
- Prefer unique disposable names (timestamp suffix) for rename happy path, then restore.
- Add offline-mode case (`__USE_BACKEND__ = false` / mock local) that seeds or uses store players and asserts teamName cascade — mirror patterns from `club-admin-role.spec.js` offline login when needed.
- Keep existing coach/status/foreign-club cases green; they should pass name/age through as current values when those inputs become required.

**Execution note:** Prefer durable unique names + restore over mutating permanent seed labels without cleanup.

**Test scenarios:**

- Happy path: change name to unique value + age group; S3 shows both; restore succeeds.
- Conflict: set name to another seeded team's name → `#updateFormError` shown; stay on S3a.
- Offline rename: players stay associated with renamed team.
- Regression: existing coach status-flip / foreign-club tests still pass (form submits current name/age when unchanged).

**Verification:** `team-update.spec.js` green including new cases; seeded names restored for subsequent suites.

---

## Verification Contract

- Playwright: `tests/playwright/team-update.spec.js` (full file), plus spot-check `tests/playwright/s3-team-management.spec.js` if create path drifts.
- If Vitest shape locks exist: `apps/api/tests/integration/teams/mockup-api-client.spec.ts` (or sibling) after body key changes.
- Manual smoke (optional): live login → S3a rename → S1 team filter still lists players on that team.

---

## Definition of Done

- All Product Contract requirements R1–R8 satisfied.
- U1–U3 complete with listed test scenarios implemented or covered by equivalent assertions.
- Mapping doc documents `name` / `ageGroup` on team update.
- No seed-team leftover renames after Playwright runs.

---

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| Offline orphan roster after rename | U1 cascade + U3 offline test |
| UNIQUE / case collision | Reuse create `LOWER(name)` check; allow same-id |
| Seed pollution across Playwright | Unique names + restore name/ageGroup |
| Age group vs birth years drift | Explicitly out of scope; document in R5 |
| Offline ClubAdmin scope hole | Align with Coach in U1 |

---

## Sources & Research

- Origin gap: `docs/plans/2026-07-06-007-feat-team-update-screen-plan.md` treated name/ageGroup as read-only (R2/R3) — this plan supersedes that product choice for S3a.
- Patterns: `docs/ux/mockup/S3a-team-update.html`, `MockupApi.updateTeamCoachAndClub`, `POST /teams/:id/update` in `scripts/serve-mockup.js`, S3 create modal, `tests/playwright/team-update.spec.js`.
- Schema: `teams.name` UNIQUE (`apps/api/src/db/schema/tables.sql` / migration 005).
- Learnings: no solutions docs for team rename; avatar PATCH learning reminds live Playwright matters for persistence claims — prefer exercising live update for name persist and offline only for `teamName` cascade.
- External research: skipped — local create/update uniqueness and S3a patterns are sufficient.
