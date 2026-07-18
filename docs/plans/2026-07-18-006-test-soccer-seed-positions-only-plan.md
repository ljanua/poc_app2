---
title: "test: keep Soccer positions to seeded allowlist only"
date: 2026-07-18
type: test
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# test: keep Soccer positions to seeded allowlist only

## Goal Capsule

Stop automated tests from creating extra positions under sport **Soccer**, and remove any Soccer `positions` rows (plus dependent `position_skills`) whose ids are outside the seeded allowlist. Stop when Playwright no longer inserts non-seed Soccer positions, leftover QA rows are purged from the test DB, and S8 “Add Position” still has coverage via a disposable non-Soccer sport.

**Authority:** this plan; user confirmation (2026-07-18): Add Position under a throwaway QA sport; purge non-allowlisted Soccer rows (SQL/script + prevent recurrence).

**Product Contract preservation:** N/A (ce-plan-bootstrap).

---

## Product Contract

### Summary

Live Postgres used by Playwright has accumulated `QA Position …` rows under `sport_soccer` because `tests/playwright/s8-skills.spec.js` creates positions there with no teardown. Soccer’s catalog must stay exactly the seeded thirteen positions. Tests must not add more; existing orphans must be deleted.

### Requirements

- R1. No Playwright (or integration) test creates a new position with `sportId: 'sport_soccer'` / Soccer.
- R2. The “Add Position” happy path still exists: create under a **disposable QA sport** created in the same test (unique name), then assert the position appears under that sport’s filter — not under Soccer.
- R3. Soccer positions remaining in the DB after cleanup are **only** this allowlist (ids): `pos_any`, `pos_cam`, `pos_cb`, `pos_cdm`, `pos_cf`, `pos_cm`, `pos_gk`, `pos_rb_lb`, `pos_rf_lf`, `pos_rm_lm`, `pos_rw_lw`, `pos_rwb_lwb`, `pos_st`.
- R4. Purge deletes `position_skills` for non-allowlisted Soccer positions first, then those `positions` rows (`ON DELETE RESTRICT` on the join).
- R5. A shared allowlist + purge helper is available so future runs can re-purge orphans without hand-writing SQL (used at least from the S8 position create test’s teardown / afterEach, and as a one-shot script or documented SQL for current pollution).

### Actors

- A1. Test author / CI — runs Playwright against long-lived Postgres.
- A2. Implementer — rewrites S8 position create coverage and cleans DB.

### Key Flows

- F1. S8 Add Position test creates QA sport → creates position on that sport → asserts row → teardown purges any non-allowlisted Soccer leftovers (and optionally the QA sport’s positions if needed for hygiene).
- F2. One-shot purge removes existing `QA Position %` (and any other non-allowlisted) Soccer positions from the dev DB.

### Acceptance Examples

- AE1. `s8-skills` “Add Position” test does not call create with `sport_soccer`; grepping the suite finds no new `createPosition`/`POST /positions` under Soccer.
- AE2. After purge, `SELECT id FROM positions WHERE sport_id = 'sport_soccer'` returns exactly the 13 allowlisted ids (order irrelevant).
- AE3. Existing Soccer-read tests (`s5-position`, S8 seed catalog ≥13, `pos_gk` skill assign) still pass.

### Scope Boundaries

**In scope:** Playwright S8 position-create rewrite; shared Soccer position allowlist + purge helper/script; one-shot cleanup of current DB pollution; mapping/doc note if useful.

**Out of scope:** Product DELETE-position API or S8 UI hard-delete; changing the migration 015 seed; truncating teams/skills/users; “at least N” resilience for position *counts* beyond Soccer pollution (see related team resilience plan).

### Deferred to Follow-Up Work

- Optional: enforce allowlist in `POST /positions` when `sportId === sport_soccer` (product guard) — not required for this test-hygiene plan.

---

## Planning Contract

### Assumptions

- Confirmed: Add Position coverage moves to a **throwaway QA sport**, not dropped.
- Confirmed: Purge is **hard delete** via SQL (no public DELETE position API); soft-deactivate alone is insufficient.
- Allowlist matches migration 015 seed ids (user-supplied list = same 13).
- Prior “no-cleanup” posture for *teams* (`docs/plans/2026-07-06-006-test-plan-resilient-to-growing-teams.md`) does **not** apply to Soccer position orphans — user explicitly requires removal here.

### Key Technical Decisions

- KTD1. **Shared constant** `SOCCER_SEED_POSITION_IDS` (13 ids) in a Playwright helper (e.g. `tests/playwright/_soccer-positions.js`) used by purge SQL builder and any assertion that Soccer must not grow.
- KTD2. **Purge SQL order:** `DELETE position_skills WHERE position_id IN (non-allowlisted soccer)` then `DELETE positions WHERE sport_id = 'sport_soccer' AND id NOT IN (allowlist)`.
- KTD3. **Rewrite** `tests/playwright/s8-skills.spec.js` Add Position test: `createSport` → `createPosition` with that sport’s id → filter UI/API by that sport; **afterEach** (or end of test) call purge helper against backend DB via a small Node script/`page.evaluate` fetch is insufficient — prefer `scripts/purge-soccer-position-orphans.js` using `DATABASE_URL` + call from Playwright `globalTeardown` **or** from the test file’s `afterAll` via `child_process`/`node` require of the script’s export. Prefer exporting `purgeSoccerPositionOrphans(pool)` from the script and invoking it from Playwright `afterAll` in s8-skills (and one-shot CLI).
- KTD4. **Do not** add a product DELETE `/positions` endpoint for this plan.

### Patterns to follow

- Unique timestamped names (`QA Sport …`, `QA Position …`) as in S8 sports/skills tests
- `createSportViaApi` / `createPositionViaApi` helpers already in `s8-skills.spec.js`
- FK-safe delete order from migration 015 (`position_skills` RESTRICT)
- Contrast: team resilience plan keeps extras; this plan **removes** Soccer position extras by explicit product ask

### Risks

- Players with `position` text equal to a deleted QA position name are fine (no FK); no player cleanup required.
- Running purge while UI has stale cache — Playwright reloads after purge if needed.
- Accidentally deleting a seed id if allowlist typos — keep the constant as the single source and assert length === 13 in a unit/smoke check.

---

## Implementation Units

### U1. Allowlist + purge helper/script

**Goal:** Canonical Soccer seed position ids and a function/CLI that deletes non-allowlisted Soccer positions and their `position_skills`.

**Requirements:** R3–R5, AE2

**Dependencies:** None

**Files:**
- Create: `tests/playwright/_soccer-positions.js` (or `scripts/purge-soccer-position-orphans.js` exporting both CLI and `purgeSoccerPositionOrphans`)
- Test: thin Node assert or Playwright hook that runs purge and checks count === 13 (optional smoke in same file’s `if require.main`)

**Approach:** Export `SOCCER_SEED_POSITION_IDS` and `purgeSoccerPositionOrphans({ pool })` running the two DELETEs in a transaction. CLI: `node scripts/purge-soccer-position-orphans.js` using `DATABASE_URL` / dotenv.

**Test scenarios:**
- Happy: DB with one orphan Soccer position → purge → orphan gone; 13 seeds remain.
- Edge: clean DB (only seeds) → purge is a no-op, still 13 rows.
- Error: missing `DATABASE_URL` → CLI exits non-zero with clear message.

**Verification:** One-shot CLI run on local DB leaves exactly 13 Soccer positions matching the allowlist.

---

### U2. Rewrite S8 Add Position test off Soccer + wire teardown

**Goal:** Stop creating positions under Soccer; keep Add Position coverage; purge orphans after S8 skills suite (or that test).

**Requirements:** R1, R2, AE1, AE3

**Dependencies:** U1

**Files:**
- Modify: `tests/playwright/s8-skills.spec.js`
- Modify: `docs/ux/mockup/API-Mockup-Mapping.md` (optional one-line note: tests must not add Soccer positions beyond seed)

**Approach:** Change *Add Position flow creates a position under sport_soccer* to create a unique sport first, then position with that `sportId`; assert via API response + S8 UI with sport filter set to the new sport. `afterAll`/`afterEach` invoke purge helper so any historical orphans and future mistakes are cleared. Grep suite for `createPosition` + `sport_soccer` — must be zero after change.

**Execution note:** Prefer updating the failing pollution path first (rewrite create), then run purge, then full S8 + s5-position Playwright.

**Test scenarios:**
- Covers AE1. No `sport_soccer` in position create payload in s8-skills.
- Happy: create sport + position → row visible when Positions filtered to that sport.
- Regression: Soccer seed catalog test still sees Soccer / ≥13 positions; `pos_gk` assign/delete skill flows unchanged.
- Covers AE3. `s5-position.spec.js` still passes against seeded Soccer names.

**Verification:** `npx playwright test tests/playwright/s8-skills.spec.js tests/playwright/s5-position.spec.js` green; SQL AE2 holds after suite.

---

## Verification Contract

- Run purge CLI once on the local/dev DB used by Playwright
- Playwright: `tests/playwright/s8-skills.spec.js`, `tests/playwright/s5-position.spec.js`
- Confirm with SQL (or script output): Soccer position ids === allowlist (13)
- Grep: no create of positions under `sport_soccer` in Playwright position-create tests

## Definition of Done

- U1–U2 complete; AE1–AE3 satisfied
- No test creates extra Soccer positions
- Non-allowlisted Soccer positions removed from the test DB; recurrence guarded by teardown purge
- Product DELETE-position API not introduced
