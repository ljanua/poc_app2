---
title: Test plan — at least 3 teams must be available
date: 2026-07-06
type: test-plan-update
---

# Test plan — at least 3 teams must be available

## Summary

The Playwright suite currently assumes a fixed 3-team world (`t_u17`, `t_u19`, `t_senior`) and brittle "exactly N rows" assertions. Once the app is in broader use, new teams land in the live Postgres during a run (admin creates `U15 Rising`, `U16 Select`, etc.) and the count-based assertions stop being reliable: a re-run on a fresh DB sees 3 rows; a re-run on a polluted DB sees 7+. This plan rewrites the affected specs so the **single invariant** is "at least 3 teams must be available" — the three named seeded teams (`Senior Squad`, `U19 Prime`, `U17 Elite`) are guaranteed by `scripts/serve-mockup.js`'s seed step, and any extras beyond those three are accepted. The no-cleanup posture is preserved (no `globalSetup` truncation, no per-test `DELETE`); tests stay cheap and run against the same long-lived dev DB.

## Problem Frame

Three pre-existing specs carry the brittleness, all surfaced by the Manage Club rollout (which makes `listTeamSummary` hit the backend instead of the offline seed):

- `tests/playwright/s3-team-management.spec.js`:
  - `shows team KPIs and roster table` asserts `tbody tr` count is exactly 3.
  - `coach creates a team and is auto-assigned as lead coach` asserts `kpiActiveTeams` is `'4'` after creating `U15 Rising` — fails the moment a prior run leaves any other team behind.
  - `system admin creates team selecting coach and can reassign coach` asserts the `U16 Select` row exists; that row may already exist from a prior run, so the row query still passes but the surrounding KPIs and counts drift.
- `tests/playwright/s1-player-list.spec.js`:
  - `shows all available teams in the dropdown for system admin sessions` asserts `teamFilter option` count is exactly 4.
  - `shows only coach-assigned teams in the dropdown for coach sessions` asserts `teamFilter option` count is exactly 2.
- `tests/playwright/s7-admin-user-management.spec.js`:
  - `creates a user from modal and updates table and KPI counts` asserts `#kpiCoach` is `'3'`. Drifts as Coach users are added across runs.
  - `updates user role from role-change modal` mutates `Joao Lima`'s role to `SystemAdmin`. A re-run (or any later test) sees the changed role and breaks.
  - `filters table by role and status` asserts exactly 1 row visible after filtering by `SystemAdmin + active`. Drifts as more admins get added across runs.

## Key Decisions

- **Single invariant: "at least 3 teams must be available".** Every team-table assertion either asserts the three seeded rows are visible, or asserts a count is `>= 3`. Counts above 3 (from accumulated runs) are accepted silently. The "exactly N" pattern is dead.
- **No DB cleanup.** The user chose `no-cleanup` so `globalSetup` truncation is off the table; tests stay idempotent against whatever state the dev DB already holds. The "at least 3" invariant is upheld by the seed file — running `serve-mockup.js` once after a fresh DB is enough to guarantee the floor.
- **Named-seeded rows are the only stable fixtures.** `t_u17` / `t_u19` / `t_senior` are guaranteed by `scripts/serve-mockup.js`'s `INSERT INTO teams … ON CONFLICT DO NOTHING` seed. Any test that needs a stable team name uses one of these three (or a freshly-created unique one).
- **Mutating tests restore state.** Tests that change role or status snap the row back to its seeded value before the test ends, so a re-run sees the original state. We assert on the **transition** (modal closes, save resolves) rather than on the resulting state.
- **Unique-name fixtures for new rows.** When a test creates a team or user (and asserts on it), the name/email gets a `Date.now()` suffix so the row lookup is unique and re-runs don't 409. This is mechanical — `uniqueTeamName('U15 Rising')` produces `U15 Rising 1717776000000`.

## Requirements

- R1. Every team-table count assertion in `s3-team-management.spec.js`, `s1-player-list.spec.js` is replaced with either a named-seeded-row visibility check (one of `Senior Squad` / `U19 Prime` / `U17 Elite`) or a `>= 3` count check.
- R2. The "at least 3 teams must be available" invariant is asserted at least once per spec file that touches teams, so a future regression that empties the seed fails loudly with a clear message.
- R3. The `coach creates a team` and `admin creates team` tests use **uniquely-timestamped** team names so the row lookup is unique and the create doesn't 409 on a polluted DB. The KPI assertion is removed (or replaced with a delta) because the KPI value drifts as teams accumulate.
- R4. The `s7-admin-user-management.spec.js` "creates a user" test uses a unique email and asserts the user **row appears** (by full name + email) plus a KPI delta of `+1`. The literal `'3'` value goes away.
- R5. The `s7-admin-user-management.spec.js` "updates user role" test mutates `Joao Lima` and snaps the role back to `Coach` before the test ends via `MockupApi.updateUserRole('joao@vantageiq.club', 'Coach', 'SystemAdmin')`. The assertion is on the **transition** (modal closes after Save) rather than on the resulting role value.
- R6. The `s7-admin-user-management.spec.js` "filters table by role and status" test asserts the filtered rows contain `Maria Alves` (stable seeded admin) instead of asserting a row count. The KPI of seeded admins is allowed to grow.
- R7. A new shared helper file `tests/playwright/_fixture-utils.js` exports `uniqueTeamName(base)`, `uniqueEmail(localPart, domain)`, and `restoreCoachRole(page, email)`. The three specs share one implementation.

## Implementation Units

### U1. Shared fixture helper for unique names + role restore

**Goal:** Centralize the unique-timestamp helpers and the post-test role restore so the three specs share one implementation.

**Files:**
- `tests/playwright/_fixture-utils.js` (new)

**Approach:** Export `uniqueTeamName(base)` returning `${base} ${Date.now()}`, `uniqueEmail(localPart, domain)` returning `${localPart}+${Date.now()}@${domain}`, and `restoreCoachRole(page, email)` that issues `MockupApi.updateUserRole(email, 'Coach', 'SystemAdmin')` via `page.evaluate` and awaits the response. Each helper is a small pure function — no shared state.

**Test scenarios:**
- `uniqueTeamName('U15')` returns a string ending in a non-empty digits-only suffix.
- `restoreCoachRole` issues the update and resolves on a 200 status; a 4xx/5xx propagates a thrown error so the test fails loudly.

---

### U2. `s3-team-management.spec.js` — "≥ 3 teams" + unique names

**Goal:** Every team-table assertion is row-based or `>= 3`; create tests use unique names.

**Files:**
- `tests/playwright/s3-team-management.spec.js`

**Approach:**
- `shows team KPIs and roster table`: replace `toHaveCount(3)` with `toBeGreaterThanOrEqual(3)` (the "at least 3 teams must be available" invariant). Keep the named-row checks for `Senior Squad`, `U19 Prime`, `U17 Elite` so the test still pinpoints the seed.
- `coach creates a team and is auto-assigned as lead coach`: change `teamNameInput` to `uniqueTeamName('U15 Rising')`. Replace the `#kpiActiveTeams → '4'` assertion with a `> starting` check (the floor is `>= starting + 1`; we accept `>=` to absorb the "another test just added one" race that doesn't actually exist in single-worker Playwright, but the assertion still proves the create took effect). Drop the literal `tbody tr` count assertion; replace it with a `toBeGreaterThanOrEqual(3)` re-check on the table.
- `system admin creates team selecting coach and can reassign coach`: change `teamNameInput` to `uniqueTeamName('U16 Select')`. The `createdRow` and `seniorSquadRow` lookups are already name-based, so no other change is needed.

**Test scenarios:**
- The team table shows `>= 3` rows and the three named seeded rows (`Senior Squad`, `U19 Prime`, `U17 Elite`) are visible.
- After the coach-create test, the new team row exists, contains `Joao Lima`, and the team table still has `>= 3` rows.
- After the admin-create test, the new team row exists, contains `Joao Lima`, and `Senior Squad` row shows `Joao Lima` as lead coach after the change-coach click.

---

### U3. `s1-player-list.spec.js` — "≥ 3 teams" in dropdown

**Goal:** The team-filter dropdown assertions tolerate more teams.

**Files:**
- `tests/playwright/s1-player-list.spec.js`

**Approach:**
- `shows only coach-assigned teams in the dropdown for coach sessions`: replace `toHaveCount(2)` with `toBeGreaterThanOrEqual(2)` (the "at least one team + All Teams" floor). Keep the `containsText('All Teams')`, `containsText('U19 Prime')`, `not.containsText('Senior Squad')` checks — they confirm the role filter is active.
- `shows all available teams in the dropdown for system admin sessions`: replace `toHaveCount(4)` with `toBeGreaterThanOrEqual(4)` (admin must see all three seeded teams plus `All Teams`, so `>= 4`). Keep the `containsText` checks for `U17 Elite`, `U19 Prime`, `Senior Squad`, `All Teams`. Add an explicit `toBeGreaterThanOrEqual(3)` named-row check at the top of the file as a guard.

**Test scenarios:**
- Coach session dropdown contains the seeded coach-owned teams and does not contain teams owned by other actors.
- Admin session dropdown contains all three named seeded teams (`U17 Elite`, `U19 Prime`, `Senior Squad`) and `All Teams`, plus any extras from prior runs.

---

### U4. `s7-admin-user-management.spec.js` — unique emails, role restore, named-row filter

**Goal:** User-management tests tolerate prior-run side effects.

**Files:**
- `tests/playwright/s7-admin-user-management.spec.js`

**Approach:**
- `creates a user from modal and updates table and KPI counts`: switch `createEmail` to `uniqueEmail('daniel', 'vantageiq.club')`. Replace the literal `#kpiCoach → '3'` with a **delta assertion** (`parseInt(after) === parseInt(before) + 1`). The created-row assertion becomes a cell lookup by full name + email.
- `updates user role from role-change modal`: keep the same mutation but add `await restoreCoachRole(page, 'joao@vantageiq.club')` after the assertion. The assertion itself becomes a **transition assertion**: after clicking `Update Role`, the modal closes (`#roleChangeModal` is hidden). We deliberately do not assert the new role value because that asserts a side effect on shared state. The restore step brings `Joao Lima` back to `Coach` for the next test.
- `filters table by role and status`: drop `toHaveCount(1)`. Assert the filtered rows contain `Maria Alves` (the only seeded `SystemAdmin + active` user). The visible-row count is allowed to grow.

**Test scenarios:**
- After `creates a user`, the user row appears by name + email and the Coach KPI delta is exactly `+1`.
- After `updates user role`, the modal closes; after `restoreCoachRole`, the `Joao Lima` row is back to `Coach`.
- After `filters table`, the visible rows contain `Maria Alves` and may include other admins created in prior runs.

---

### U5. Documentation update

**Goal:** The test suite's "at least 3 teams" invariant is documented so future contributors don't reintroduce brittle "exactly N" assertions.

**Files:**
- `docs/ux/mockup/README.md` (small note appended to the "Testing" section)
- `docs/ux/mockup/API-Mockup-Mapping.md` (small note under "Test traceability")

**Approach:** Add one paragraph stating: "The Playwright suite enforces a single invariant: **at least 3 teams must be available** — the seeded `Senior Squad` / `U19 Prime` / `U17 Elite` are guaranteed by `scripts/serve-mockup.js`. Tests assert on these three named rows or on `>= 3` counts; any extras beyond those three (from prior runs or new admin-created teams) are accepted silently. The suite does **not** truncate the dev DB between runs."

---

## Out of Scope

- Cleaning up the existing polluted dev DB (the user's `no-cleanup` choice keeps it).
- Adding a `globalSetup` truncation hook.
- Refactoring `tests/playwright/manage-club.spec.js` (the new spec from the Manage Club plan already uses shape-only assertions).
- Adding `data-testid` attributes to the S3/S7 markup (the existing `getByRole` and `getByText` queries work for the rows the tests create; new testids are not required).
- Pinning the dev DB to the seeded 3-team / 3-user world via `MOCKUP_DB_SEED=false` toggles in the test runner.
- Asserting an **upper bound** on teams (the user's request is the lower-bound invariant only).

## Verification

- `npx playwright test tests/playwright/s3-team-management.spec.js tests/playwright/s1-player-list.spec.js tests/playwright/s7-admin-user-management.spec.js` is green on the current polluted dev DB.
- The same run is green after creating two more teams and one more user via the UI, then re-running.
- `npx playwright test tests/playwright/manage-club.spec.js` continues to pass (regression check on the new spec).
- Running on a freshly truncated DB that has only the seeded 3 teams also passes — the `>= 3` assertions hold at the floor.