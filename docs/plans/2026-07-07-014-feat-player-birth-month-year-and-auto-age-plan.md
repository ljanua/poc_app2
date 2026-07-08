# feat: Add birth month and year to player profile; auto-calculate age

## Summary

Give every player a real birthdate — captured as a **paired** `birthMonth` (1-12) + `birthYear` (1960-2026) — and have the S2 player dashboard show the **auto-calculated age** derived from those fields. Coaches can set or clear the pair when **creating** a player (S1 inline add-player panel) and when **updating** a player (S5 edit form). The mockup server, the OpenAPI contract, the offline/local fallback client, and the migration test base all learn the same shape.

This plan unblocks the deferred `Age field on player` item from `docs/plans/2026-07-04-006-feat-s2-edit-player-profile-plan.md` (Section "Deferred to follow-up work"): *"S2 still displays a placeholder age string; no new `players.age` column in this plan."* Age is not stored — it is computed at read time so the value is always current without ever needing to be re-saved.

## Problem Frame

The S2 dashboard currently displays `Forward • Left Wing • Age 24` for every player because the meta-line string is hardcoded in `docs/ux/mockup/S2-player-dashboard.html:201`. Plan 006 explicitly deferred introducing a real age field because no profile update path existed. With plan 006's `GET /v1/players/{id}/profile` + `PATCH /v1/players/{id}` now landed, and the S1 add-player inline panel now accepting `position` (plan 012), the deferred item is finally unblocked and the requester wants it delivered.

There is no birth-date in the seed, the schema, the API, or the UI today. Coaches have no way to record when a player was born; downstream features (age-band filtering, U17/U19/Senior roster fit) cannot be derived without it.

## Origin

- User request (this session): *"Add Birth month and year to player profile. Make these fields available when creating or updating a player to assign the player age. And when Birth month and year are set, auto calculate player age, to show it on player profile."*
- Confirmed scope decisions:
  - **S1 add-player panel grows birth month + year fields** alongside the existing name/position/team — the user said "when creating **or** updating", and S1 is the only create path in the mockup.
  - **S5 edit form gains the same pair** in its Identity section.
  - **Auto-calculated age is shown on the S2 dashboard meta line** in place of the hardcoded `Age 24`. S1 player cards do not show age in this plan (not requested).
- Related prior work:
  - `docs/plans/2026-07-04-006-feat-s2-edit-player-profile-plan.md` — source of the deferred item; provides the `PATCH /v1/players/{id}` and `UpdatePlayerProfileRequest` schema this plan extends.
  - `docs/plans/2026-07-04-005-fix-s2-dashboard-missing-stats-default-player-plan.md` — established the S2 read path this plan's age computation slots into.
  - `docs/plans/2026-07-07-012-feat-s3-team-sport-and-s5-player-position-plan.md` — added `position` to the same create/update flow; same pattern of "one nullable column + UI field + test".

---

## Requirements Trace

- Every player record has two optional columns: `birth_month SMALLINT` and `birth_year SMALLINT`. Both null means "no birth date known"; both set means the coach recorded it; setting one without the other is rejected as invalid.
- **POST `/v1/players`** accepts `birthMonth` (integer 1-12) and `birthYear` (integer 1960-2026) in the request body. The pair (or absence of both) is persisted; nothing else about the create flow changes.
- **PATCH `/v1/players/{id}`** accepts the same pair. Saving an empty pair clears the stored values; saving both writes both. Same transactional atomicity guarantees as the rest of the profile update.
- **OpenAPI** documents the new fields on `Player`, `CreatePlayerRequest`, `UpdatePlayerProfileRequest`, `PlayerResponse`, `PlayerProfileResponse`. A derived `age` (integer, nullable) is added to `Player`.
- **S2 dashboard meta line** renders the position, separator, and — when `birthMonth` and `birthYear` are present — the computed age as `Age {N}`. When the birth date is not known, the age segment is omitted (the line shows only the position).
- **Age is computed at read time** in the backend response (`toPlayerPayload`) and again in the offline mockup client for `localStorage`-only mode. The same formula runs in both paths so dashboards always show the same number.
- **Migration `017_players_birth_month_year.sql`** introduces the two nullable `SMALLINT` columns with `CHECK` constraints; `tables.sql` and `deploy.sql` mirror the new columns so fresh databases match migrating ones.
- **Regression coverage**: migration sync test, contract test (schema includes new fields), integration tests (POST/PATCH persistence + age derivation + validation errors), Playwright (S5 round-trip + S2 dashboard shows new age), BDD scenario.

---

## Scope Boundaries

### In scope

- Migration `017_players_birth_month_year.sql` plus mirrored DDL in `apps/api/src/db/schema/tables.sql` and `apps/api/src/db/schema/deploy.sql`.
- OpenAPI schema additions: `Player.birthMonth`, `Player.birthYear`, `Player.age`, plus the same on `CreatePlayerRequest` and `UpdatePlayerProfileRequest`.
- `scripts/serve-mockup.js`:
  - `POST /api/v1/players` accepts and persists the pair (or absence).
  - `PATCH /api/v1/players/{id}` accepts and persists the pair through `parseUpdateProfilePayload`.
  - `toPlayerPayload` reads the columns and computes `age`.
  - A single `computeAge(birthMonth, birthYear, now = new Date())` helper near the other payload mappers.
- `docs/ux/mockup/js/mockup-api-client.js`:
  - Mirror the same pair through `createPlayer`/`addPlayerFlow`, `updatePlayerProfile`, and `getDashboardPlayer`.
  - Local-mode store entries include `birthMonth` and `birthYear`.
  - Same `computeAge` helper (duplicated or extracted) used by `getDashboardPlayer` for offline dashboards.
- `docs/ux/mockup/S1-player-list.html`: add birth month + year inputs to the inline add-player panel; persist them via the existing `addPlayerFlow` payload extension.
- `docs/ux/mockup/S5-player-edit.html`: add birth month + year fields in the Identity section; bind on load and on save.
- `docs/ux/mockup/S2-player-dashboard.html`: replace the hardcoded `Age 24` segment with a derived value from `player.birthMonth`/`player.birthYear`.
- `createSeed()` in `mockup-api-client.js`: seed birth month + year for the four named players so the dashboard is meaningful on first load.
- Tests across three layers (migration, contract/integration, Playwright/BDD) and a one-line mapping doc note.

### Deferred to follow-up work

- **Player-list age display on S1 cards.** Coaches can see age on S2; surfacing it on the S1 list cards is a one-line follow-up if asked.
- **Read-only age hint on S5.** Showing `Age {N}` right under the birth fields on the edit page is a small UX nicety but not requested. The S5 form simply shows the two inputs.
- **Bulk-edit / import of birth dates.** Same posture as plan 006 — coach enters one at a time.
- **Audit trail for birth-date edits.** Not requested.
- **U17/U19/Senior age-band filtering.** A future plan can derive age-group fit from `birthYear` and team `ageGroup`.

### Out of scope

- Replacing the existing hardcoded `Age 37` markup in `S2-player-dashboard.html:38` (initial-render HTML) is incidental and stays as-is — the live binding script (line 201) overwrites it on load.
- Date-of-birth parsing (no day-of-month; month + year only). Day-of-month would require a calendar picker; the user explicitly asked for month + year only.
- Age-based access control or visibility rules.
- Localized date formatting (always `Age {integer}`).

---

## Key Technical Decisions

- **Two nullable SMALLINT columns, not a single DATE.** The user asked for month + year; storing a `DATE` would force a fake day-of-month and is a worse match for the input UX (two separate form fields).
- **Strict pair validation.** `birthMonth` set without `birthYear`, or vice versa, returns `400 validation_error`. The pair is the unit; partials are not a useful state. Clearing means both null together (omitting both keys, sending nulls, or sending empty strings all map to null).
- **Age is derived, never persisted.** A derived column or trigger would still need a `now()` reference; storing an `age` field would go stale the moment it was written. Compute in `toPlayerPayload` and in the offline client.
- **Single shared helper for the age formula.** `computeAge(birthMonth, birthYear, now)` lives once in `serve-mockup.js` (server path) and is duplicated as a tiny pure function in `mockup-api-client.js` (client path for offline dashboards). Both must use the same logic — covered by a small Vitest unit test on the offline client copy and an integration assertion on the server path.
- **Bounded `birthYear`.** `1960 <= birthYear <= extract(year from now())` keeps the input plausible (no 1900 birth dates; no future years). Range is generous enough for an adult and a brand-new-born in the same form.
- **Add the fields to the S1 inline panel.** The user explicitly framed this as "when creating **or** updating". Adding to S1 keeps the create and edit paths symmetric — coaches don't have to create a player, navigate to S5, and then come back to confirm the birth date is right.
- **No new endpoint.** Both endpoints already exist (`POST /v1/players` and `PATCH /v1/players/{id}`); this plan extends their payloads only.
- **Seed data is plausible, not exact.** The four named reference players get birth years that produce believable but non-shipping ages (e.g. Messi 1987 → ~38 today; Ronaldo 1985 → ~40 today). The values exist for demo realism and to exercise the derived-age code path; the dashboard isn't asserting on a specific number for them in tests.

---

## High-Level Technical Design

```mermaid
flowchart TD
    S1[S1 inline panel] -->|name, position, team, birthMonth, birthYear| Create[POST /v1/players]
    S5[S5 edit form] -->|name, position, team, birthMonth, birthYear, stats| Patch[PATCH /v1/players/{id}]
    Create --> Persist1[INSERT players WITH birth_month, birth_year]
    Patch --> Persist2[UPDATE players SET birth_month, birth_year]
    Persist1 --> Read1[toPlayerPayload reads columns]
    Persist2 --> Read2[toPlayerPayload reads columns]
    Read1 --> Age1[computeAge → age]
    Read2 --> Age2[computeAge → age]
    Age1 --> S2[S2 dashboard]
    Age2 --> S2
    S2 -->|meta line| Display[Position • Age N or Position only]
```

---

## Implementation Units

### U1. Migration and schema parity for birth month / year

**Goal:** Add `birth_month` and `birth_year` columns to the `players` table with proper `CHECK` constraints and mirror them in the canonical schema files.

**Requirements:** Migration test parity; fresh-db parity with migrating-db; bounded values.

**Dependencies:** none

**Files:**
- `apps/api/src/db/migrations/017_players_birth_month_year.sql` (new)
- `apps/api/src/db/schema/tables.sql`
- `apps/api/src/db/schema/deploy.sql`
- `apps/api/tests/integration/db/schema-bootstrap.spec.ts` (extend)
- `apps/api/tests/integration/db/players-birth-migration.spec.ts` (new)

**Approach:**
- Migration: `ALTER TABLE players ADD COLUMN IF NOT EXISTS birth_month SMALLINT CHECK (birth_month BETWEEN 1 AND 12);` plus a parallel `birth_year SMALLINT CHECK (birth_year BETWEEN 1960 AND EXTRACT(YEAR FROM NOW())::SMALLINT);`. Both nullable.
- Add the same two columns (without the `IF NOT EXISTS` guard) inside the `CREATE TABLE IF NOT EXISTS players` block in `tables.sql` and `deploy.sql`, right after the existing `position` column.
- Extend `schema-bootstrap.spec.ts` with one assertion that both files contain `birth_month` and `birth_year`.
- New `players-birth-migration.spec.ts`: assert that on an up-to-date test DB the columns exist, are nullable, accept valid pairs, reject out-of-range months (`0`, `13`), reject out-of-range years (`1959`, `2100`), and accept the upper bound equal to the current year.

**Patterns to follow:**
- Existing migration `009_player_stats_metric_change_indicators.sql` for column-add shape.
- `011_add_player_avatar_url.sql` for the smallest-possible migration.

**Test scenarios:**
- Migration applies on a fresh DB and on a DB that already has the `players` table.
- `CHECK` constraints reject `birth_month = 0` and `birth_month = 13`.
- `CHECK` constraints reject `birth_year < 1960` and `birth_year > current_year`.
- Both columns nullable; rows with both null are valid.

**Verification:**
- `npx vitest run apps/api/tests/integration/db/schema-bootstrap.spec.ts` passes.
- `npx vitest run apps/api/tests/integration/db/players-birth-migration.spec.ts` passes.

---

### U2. OpenAPI contract: Player.birthMonth / birthYear / age + request extensions

**Goal:** Document the new pair on the player schema and on both create/update requests.

**Requirements:** Schema documentation; downstream mockup and tests assert against it.

**Dependencies:** U1 (column shape)

**Files:**
- `openapi/v1/schemas/players.yaml`
- `apps/api/tests/contract/openapi.players.spec.ts` (extend)

**Approach:**
- Add to `Player` (and by extension `PlayerResponse` and `PlayerProfileResponse`'s nested `player`):
  - `birthMonth`: integer 1-12, nullable.
  - `birthYear`: integer 1960-2026, nullable.
  - `age`: integer, nullable, read-only, `description: >- Derived from birthMonth/birthYear at read time. Null when no birth date is recorded.`.
- Add the same `birthMonth` / `birthYear` pair to `CreatePlayerRequest` and `UpdatePlayerProfileRequest`, both as `nullable: true`.
- Mark `Player.birthMonth` and `Player.birthYear` as not required (the existing `required` array stays unchanged — the pair is optional).
- Contract spec: assert the new properties exist on `Player` and on the two requests; assert `age` has `readOnly: true`.

**Patterns to follow:**
- Existing `nullable`/`description` style on `Player.avatarUrl` and `PlayerDashboardStats.missingDataMessage`.
- Plan 006's additive, backward-compatible pattern for `UpdatePlayerProfileRequest`.

**Test scenarios:**
- Schema parses; `Player` exposes all three new properties; `CreatePlayerRequest` and `UpdatePlayerProfileRequest` both expose `birthMonth` and `birthYear`.
- `age` carries `readOnly: true` so consumers don't try to write it.

**Verification:**
- `npx vitest run apps/api/tests/contract/openapi.players.spec.ts` passes.

---

### U3. Server: persist + validate + derive age in `scripts/serve-mockup.js`

**Goal:** `POST /v1/players` and `PATCH /v1/players/{id}` accept and persist the pair; `toPlayerPayload` reads the columns and derives `age`.

**Requirements:** Pair-only semantics; validation errors; transactional writes; derived-age computation.

**Dependencies:** U1, U2

**Files:**
- `scripts/serve-mockup.js`
- `apps/api/tests/integration/players/players-api.spec.ts` (extend)
- `apps/api/tests/integration/players/mockup-list-players-scoping.spec.ts` (extend if necessary)

**Approach:**
- Add a `parseBirthFields(payload)` helper near `parseUpdateProfilePayload`:
  - Returns `{ birthMonth: null, birthYear: null }` when both keys are absent or both explicitly null/empty.
  - Returns the parsed integers when both are valid (month 1-12, year 1960-current).
  - Returns `{ error: 'Birth month and year must be set together, or both left blank.' }` when only one is set.
  - Returns `{ error: 'Birth month must be a number from 1 to 12.' }` or year-range error otherwise.
- Wire the helper into both the `POST /players` create path and `parseUpdateProfilePayload` (and the inline-assign path that re-uses create semantics).
- `INSERT INTO players (...)` adds `birth_month` and `birth_year` columns; the `UPDATE players SET ...` in the PATCH path writes the pair atomically with the rest of the update.
- `toPlayerPayload` selects `p.birth_month AS "birthMonth", p.birth_year AS "birthYear"` and adds `birthMonth`, `birthYear`, and the derived `age` to the returned object. Use a `computeAge(birthMonth, birthYear, now = new Date())` helper colocated with the other payload mappers.
- `computeAge` formula: `year - birthYear - (now.getMonth() + 1 < birthMonth ? 1 : 0)`. Returns `null` when either input is null.
- BDD: add a Vitest-level test in `players-api.spec.ts` asserting:
  - POST with `birthMonth: 6, birthYear: 1987` returns a player payload with those fields plus `age` matching a value computed from a fixed `Date` (use `vi.setSystemTime`).
  - POST with `birthMonth: 6` only returns 400.
  - PATCH that clears the pair (sends both null) results in both columns null on read.

**Patterns to follow:**
- `parseUpdateProfilePayload` for validation shape.
- Existing `toPlayerPayload` extension pattern from `player_avatar_url` (plan 011).

**Test scenarios:**
- Happy path: create with `birthMonth: 6, birthYear: 1987`; subsequent `GET /v1/players/{id}` returns both fields and a numeric `age`.
- Happy path: PATCH clears both; subsequent read returns both null and `age: null`.
- Edge case: only month set → 400 with the "set together" message.
- Edge case: month out of range → 400.
- Edge case: future year → 400.
- Happy path: create with no birth fields still succeeds (the pair is optional).

**Verification:**
- `npx vitest run apps/api/tests/integration/players/players-api.spec.ts` passes.
- Manual: curl POST → PATCH → GET; assert `age` is recomputed between two reads if you set `vi.setSystemTime`.

---

### U4. Offline client + UI: S1 panel, S5 form, S2 dashboard, mockup store

**Goal:** Coaches can enter birth month/year on S1 and S5; S2 shows the derived age; local-mode store round-trips the pair; local-mode dashboard derives the same age as the server.

**Requirements:** UI symmetry across create/update; local-mode parity; seed data exercises the new fields.

**Dependencies:** U1, U3 (server shape)

**Files:**
- `docs/ux/mockup/js/mockup-api-client.js`
- `docs/ux/mockup/S1-player-list.html`
- `docs/ux/mockup/S5-player-edit.html`
- `docs/ux/mockup/S2-player-dashboard.html`
- `tests/playwright/s5-player-edit.spec.js` (extend)
- `tests/playwright/s1-player-list.spec.js` (extend or new file)
- `tests/playwright/s2-player-dashboard.spec.js` (extend)
- `tests/bdd/features/coach-edit-player-profile.feature` (extend scenario)
- `docs/ux/mockup/API-Mockup-Mapping.md` (one-line note)

**Approach:**
- `mockup-api-client.js`:
  - Mirror `parseBirthFields` validation (same strict-pair rule) and reuse the local `computeAge(birthMonth, birthYear, now)` helper.
  - Extend `addPlayerFlow` to forward `birthMonth`/`birthYear` in both backend and local modes; the local-mode `createPlayer` writes the pair to `store.players[i]`.
  - Extend `updatePlayerProfile` (local mode) to write the pair; backend mode already passes through.
  - Extend `getDashboardPlayer` to compute `age` from the local store entry (server mode already carries it).
  - Extend `createSeed()` to include plausible `birthMonth`/`birthYear` for the four named players (e.g. Messi 1987-06, Ronaldo 1985-02, Neymar 1992-02, Mbappe 1998-12).
- `S1-player-list.html`:
  - In `#addPlayerPanel`, add two new fields below position: `#addPlayerBirthMonth` (select 1-12 with a blank "Not set" option) and `#addPlayerBirthYear` (number input, min=1960, max=current year, placeholder "Year").
  - `addPlayerFlow` invocation in the page passes the values when set.
- `S5-player-edit.html`:
  - Add `#fieldBirthMonth` and `#fieldBirthYear` to the Identity `form-grid`, right after `#fieldPosition`.
  - Bind on profile load: read `player.birthMonth` / `player.birthYear`; null/empty renders blank.
  - On save, include the pair in the payload assembled for `updatePlayerProfile`.
- `S2-player-dashboard.html`:
  - Replace the hardcoded `' • Age 24'` in the script (line 201) with `' • Age ' + computedAge` when birth fields are present, or empty string when they're absent.
  - Keep the static markup line 38 as-is — the binding script overwrites it on load.
- Tests:
  - Extend `s5-player-edit.spec.js`: scenario where the coach sets `#fieldBirthMonth` and `#fieldBirthYear`, saves, navigates to S2, asserts the meta line includes `Age {N}`.
  - Extend `s2-player-dashboard.spec.js`: regression that the existing seeded players show `Age 38` (or current computed) for Messi and the dashboard no longer shows the hardcoded `Age 24`.
  - Extend or add an S1 Playwright test: create a player from the inline panel with `birthMonth: 3, birthYear: 2005`; reload S2 to confirm the new player card surfaces the age on the dashboard meta line.
  - Extend the BDD scenario in `coach-player-development-dashboard.feature`: coach edits a player's birth year, saves, dashboard reflects the new age.
- API mapping doc: add one row noting `birthMonth` / `birthYear` / `age` on the S2 dashboard read.

**Patterns to follow:**
- Existing `addPlayerFlow` payload extension pattern from plan 012.
- Existing S5 field binding for `#fieldPosition` and friends.
- Existing `data-testid` conventions (`add-player-birth-month`, `field-birth-month`).

**Test scenarios:**
- Offline mode round-trip: edit S5 birth fields, save, navigate S2, meta line includes age.
- S1 inline panel creates with birth fields, dashboard reads the new player with age.
- Seeded players' ages are computed correctly (no `Age 24` literal).
- Validation: setting only month in S5 → save error notice, no network call.

**Verification:**
- `npx playwright test tests/playwright/s5-player-edit.spec.js tests/playwright/s2-player-dashboard.spec.js tests/playwright/s1-player-list.spec.js` passes.
- BDD scenario passes.

---

### U5. Mapping doc note + regression audit

**Goal:** Close the loop on documentation and confirm no remaining hardcoded `Age 24` strings.

**Requirements:** Documentation; regression sweep.

**Dependencies:** U1-U4

**Files:**
- `docs/ux/mockup/API-Mockup-Mapping.md`
- `tests/playwright/s2-player-dashboard.spec.js` (one assertion added in U4)

**Approach:**
- Add a one-paragraph note to the mapping doc under the S2 dashboard read row: `Player` now includes `birthMonth` (nullable 1-12), `birthYear` (nullable 1960-2026), and a derived `age` (nullable integer). Document the strict-pair rule and that `age` is computed at read time.
- Confirm via grep that no other S2 mockup file still references the literal `Age 24` (the only occurrence left should be the static markup line that the binding script overrides — that's acceptable for first paint).

**Patterns to follow:**
- Mapping doc style used for the existing `missingDataMessage` note.

**Test scenarios:**
- None new; this unit verifies documentation and grep cleanliness.

**Verification:**
- `Select-String -Path 'docs/ux/mockup/*.html' -Pattern 'Age 24'` returns only the static initial-paint markup line in `S2-player-dashboard.html`.

---

## Dependencies and Sequencing

- **U1** first (schema columns).
- **U2** parallel with U1 (schema doc) or right after — needs the column names.
- **U3** depends on U1 + U2 (validates against schema and persists to columns).
- **U4** depends on U3 (UI bound to the validated payload and the response shape).
- **U5** closes the loop after U4.

Recommended implementation order: **U1 → U2 → U3 → U4 → U5**.

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Strict-pair validation breaks existing callers that send one field only | U3 returns 400 with a clear message; both create and update paths share the helper so the rule is consistent |
| Age drifts if server and client use different formulas | Single `computeAge` formula specified in U3 and duplicated in U4 — covered by a Vitest unit assertion on the offline copy and an integration assertion on the server path |
| Migration `017` lands on a DB where some seeded player already has a `birth_month` without `birth_year` (impossible today, but defensive) | The `CHECK` constraints are independent per column; either column can be null. The strict-pair rule is enforced at the application layer, not the DB layer — that's correct because the DB layer should accept partials and the API should not |
| S1 inline panel grows visually crowded | Use compact selects for month/year, matching the position select's width; collapse the panel for very narrow viewports via existing CSS |
| `computeAge` clock-skew between server and dashboard reads | The dashboard derives age client-side in offline mode and server-side in backend mode. Both use `new Date()`. In tests, freeze time with `vi.setSystemTime` to make assertions deterministic |
| Static markup line 38 still says `Age 37` | Documented as out-of-scope (initial paint only; binding script overwrites it). The Playwright regression only asserts the bound value |

---

## Open Questions

- Should the S1 player-list card surface the age? Deferred — not requested; one-line follow-up if asked.
- Should we cap `birthYear` at `current_year` or `current_year + 1` (so a newborn whose birthday hasn't happened yet can still be recorded)? Plan chooses `current_year` upper bound in `CHECK` (matches the requested "year" interpretation); the form input client-side caps at current year for consistency. Revisit only if a coach reports a blocked edge case.