---
title: feat — S3 team sport assignment + S5 player position dropdown
date: 2026-07-07
classification: software
feature: 012
slug: feat-s3-team-sport-and-s5-player-position
---

# Feature 012 — S3 team sport assignment + S5 player position dropdown

## 1. Problem

Two related gaps exist in the team-and-player model:

1. **`S3-team-management` has no notion of "sport" on a team.** Coaches / SystemAdmins can create and update a team, but cannot record which sport it plays. The downstream `S5-player-edit` page therefore has no principled way to filter its position dropdown — every team could be picking positions from any sport.
2. **`S5-player-edit` uses a free-text "Position" field.** It accepts whatever string the user types. There is no relationship to the `positions` table that was introduced by feature 010 (Manage Skills per Position), no validation, and the data is inconsistent across the roster.

Both gaps are closed by introducing a small **sport** dimension on teams and a **position dropdown** on players that is sourced from the database and filtered by the team's sport.

This is a planning-only document. Implementation units (U1–U5) live in §6 and are executed by `ce-work`.

## 2. Goal

1. Every team has a `sport_id` pointing at a row in the `sports` table.
2. By default, new teams are assigned to `Soccer`.
3. The Create Team and Update Team pages both surface a Sport dropdown sourced from `/api/v1/sports` (active sports only).
4. Existing teams in the database are backfilled to `sport_id = sport_soccer` if `sport_id` is null.
5. The `S5-player-edit` page replaces the free-text Position field with a `<select>` dropdown whose options come from `/api/v1/positions?sportId=<teamSport>` — filtered to active positions for the team's sport.
6. Existing players whose `position` is null / `'Position not set'` / empty are backfilled to the seeded **Striker** position (the one named `ST – Striker` in the seed data — see §4 for the spelling clarification).
7. The Create Player and Bulk Assign Players flows also surface the same sport-filtered position dropdown — every UI that writes `players.position` uses the dropdown, not a free-text input.

## 3. Non-goals

- No full FK migration of `players.position` to `positions.id` in v1. `players.position` stays `TEXT NOT NULL` and stores the **position name** (e.g. `ST – Striker`) — the same string the dropdown option's text content carries. This keeps the existing write/read paths in `serve-mockup.js` and `mockup-api-client.js` untouched at the SQL level. A future feature can introduce a true FK + ID exchange if downstream reporting needs it.
- No sport change in the seed data — `Soccer` stays the only seeded sport.
- No new admin UI for sports beyond what already exists in S8 (SystemAdmin) — sports remain an SystemAdmin-managed entity.
- No change to the React web app in `apps/web/` — scope is **mockup-only** unless a unit explicitly says otherwise (none of U1–U5 do).

## 4. Key clarifications

These are pinned assumptions surfaced during planning. They will be confirmed with the user via `AskQuestion` before any unit is executed.

| # | Question | Resolution |
|---|---|---|
| C1 | **Player position contract.** The seeded Striker row is `ST – Striker` (en-dash). The user's request wrote `ST - Stricker` (hyphen, typo). | **Use the seeded string verbatim:** `ST – Striker`. The existing seed in migration `015_skills_positions_sports.sql` matches the user-approved soccer position list. We do not rename the seeded position. |
| C2 | **Dropdown sends position name or position ID?** | **Position name (the display label).** This avoids changing `players.position` from TEXT to a foreign key in this feature. The dropdown's `<option>` carries the exact name string the DB stores, so round-tripping is lossless for the seeded data. |
| C3 | **Scope of the dropdown.** | **Every UI that writes `players.position` gets the dropdown.** That is S5 (Edit Player), the Create Player modal, and the Bulk Assign Players flow. Anywhere the player-creation form or the per-player edit form asks for Position, it is a sport-filtered `<select>` sourced from `positions`, never a free-text input. |
| C4 | **What if the team's sport is not `Soccer`?** | The dropdown must filter to positions whose `sport_id` matches the team's `sport_id`. If no positions exist for that sport yet, the select is disabled with a helper notice: *“No positions are defined for this team's sport yet. Add them in Manage Skills (S8).”* |
| C5 | **SystemAdmin creating a player on a non-Soccer team** | Same dropdown contract — they pick from positions for the team's sport. No special SystemAdmin override. |
| C6 | **Pre-existing data.** Teams without a sport get `Soccer`. Players with `position = 'Position not set'` (or empty) get `ST – Striker`. Players with any other non-null position are left alone — we never overwrite explicit user input. | n/a |
| C7 | **Default sport in the Create Team form.** | `<select>` with Soccer pre-selected; if a Coach is creating, the option list is still every active sport (SystemAdmin manages sports). |

## 5. Technical design

### 5.1 Schema changes (one new migration)

`teams` gains a nullable `sport_id TEXT REFERENCES sports(id) ON DELETE RESTRICT` column. Backfill: set `sport_id = 'sport_soccer'` for every team where `sport_id IS NULL`. The migration makes the column non-nullable at the end **only if** the backfill is exhaustive — it will be, since the seeded sport row exists.

```sql
-- 016_teams_sport.sql
ALTER TABLE teams ADD COLUMN IF NOT EXISTS sport_id TEXT REFERENCES sports(id) ON DELETE RESTRICT;

UPDATE teams SET sport_id = 'sport_soccer' WHERE sport_id IS NULL;

ALTER TABLE teams ALTER COLUMN sport_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_teams_sport_id ON teams(sport_id);
```

The same DDL is appended to `apps/api/src/db/schema/tables.sql` and `apps/api/src/db/schema/deploy.sql`.

`players.position` is **unchanged** — still `TEXT NOT NULL DEFAULT 'Position not set'`.

### 5.2 API surface

The endpoints already exist for sports/positions (added in feature 010). No new endpoints. The Team create/update handlers gain a `sportId` payload field. The Team read endpoints gain a `sportId` / `sportName` column on the response row.

**`POST /api/v1/teams`** — accepts `sportId` in payload. If omitted, defaults to `sport_soccer`. If provided, must reference an active row in `sports`. Validation errors return `400`.

**`POST /api/v1/teams/:id/update`** — accepts `sportId`. Same validation.

**`GET /api/v1/teams`** and **`GET /api/v1/clubs/:clubId/teams`** — include `sportId` and `sportName` (LEFT JOIN sports) in each row.

**`GET /api/v1/sports?status=active`** — already exists from feature 010. Reused.

**`GET /api/v1/positions?sportId=<id>&status=active`** — already exists from feature 010. Reused.

### 5.3 Mockup client (`docs/ux/mockup/js/mockup-api-client.js`)

- `MockupApi.createTeam(payload, actorRole, actorEmail)` — payload gains `sportId`. Backend body shape: `{ name, ageGroup, coachEmail, clubId, sportId, actorRole, actorEmail }`.
- `MockupApi.updateTeam(teamId, payload, actorRole, actorEmail)` — payload gains `sportId`.
- `MockupApi.listTeams(...)` — row mapping gains `sportId`, `sportName`.
- `MockupApi.listSports(actorRole, actorEmail, statusFilter)` — already exists from feature 010; reused.
- `MockupApi.listPositions(actorRole, actorEmail, sportId, statusFilter)` — already exists from feature 010; reused.

The offline-store path (`createSeed()`, `loadStore()`) is updated so seeded teams carry `sportId: 'sport_soccer'` and seeded players with no position get the strikter label applied at seed time. Position dropdowns that fail to fetch from the backend in offline mode are populated from the in-memory store filtered by sport.

### 5.4 S3 (`docs/ux/mockup/S3-team-management.html`)

- Create Team modal (`#createTeamModal`) gains a Sport `<select>` field (`#teamSportSelect`, `data-testid="team-sport-select"`) under the Age Group field. Populated by `MockupApi.listSports(...)` on modal open. Default value `'sport_soccer'`.
- The teams table gains a Sport column between Age Group and Players. Render `sportName`; render `—` if null (should never happen post-migration, but defensive).
- The submit handler forwards `sportId` in the create payload.
- Existing `kpiActiveTeams` etc. are unchanged.

### 5.5 S3a (`docs/ux/mockup/S3a-team-update.html`)

- Update form gains a Sport `<select>` field (`#updateSportSelect`, `data-testid="update-sport-select"`). Populated on open; current team sport preselected.
- The submit handler forwards `sportId` in the update payload.

### 5.6 Player-edit / create / bulk-assign — position dropdown

Every surface that accepts a Position for a player must use a `<select>` sourced from `positions` filtered by the team's sport. Free-text position inputs are removed.

- **`S5-player-edit.html`** (`#fieldPosition`, `data-testid="field-position"`) — replace `<input id="fieldPosition" type="text">`. Populated via `MockupApi.listPositions(actorRole, actorEmail, teamSportId, 'active')` filtered to the **team's** sport (the player's `player_team_assignments.team_id`).
- **`S1-player-list.html`** Create Player modal and any inline create form — same `<select>` populated from the same call. On Create Player the team select is the upstream control; the position select is reloaded whenever the team changes.
- **`S1-player-list.html`** Bulk Assign Players flow — the per-row position select is a `<select>` filtered to each row's team's sport.
- If `teamSportId` is missing or no positions exist for that sport, the select is disabled with a helper notice: *“No positions are defined for this team's sport yet. Add them in Manage Skills (S8).”*
- The Save / submit handler writes `position: <option value>` — the position **name** — exactly as today, since `players.position` is TEXT.
- When the user changes the team select, the position select is reloaded with positions for the new team's sport, and the current value is preserved only if it still exists in the new options.

### 5.7 Tests

| Layer | File | New assertions |
|---|---|---|
| Vitest — migration sync | `apps/api/tests/integration/db/teams-sport-migration.spec.ts` (new) | Migration file exists, has `ALTER TABLE teams ADD COLUMN sport_id`, references `sports(id)`, runs backfill `UPDATE teams SET sport_id = 'sport_soccer' WHERE sport_id IS NULL`, sets `NOT NULL`, creates index; `tables.sql` and `deploy.sql` carry the same DDL. |
| Vitest — API handlers | `apps/api/tests/integration/teams/teams-sport-api-mockup.spec.ts` (new) | `POST /api/v1/teams` accepts `sportId` in payload, defaults to `sport_soccer` when missing, rejects unknown sportId with `400`, persists to `teams.sport_id`. `POST /api/v1/teams/:id/update` accepts `sportId`. `GET /api/v1/teams` and `GET /api/v1/clubs/:id/teams` include `sportId`/`sportName`. |
| Vitest — client | `apps/api/tests/integration/players/mockup-api-client.spec.ts` (extended) | `createTeam` body shape includes `sportId`; `updateTeam` body shape includes `sportId`; `listTeams` row mapping includes `sportId`/`sportName`. |
| Vitest — HTML structure | `apps/api/tests/integration/players/mockup-api-client.spec.ts` (extended) | S3 has a `team-sport-select`; S3a has an `update-sport-select`; S5's `#fieldPosition` is a `<select>` (not `<input>`); S1's Create Player modal and Bulk Assign rows have a position `<select>` (not `<input>`). |
| Playwright | `tests/playwright/team-sport.spec.js` (new), `tests/playwright/s5-position.spec.js` (new), `tests/playwright/s1-create-player-position.spec.js` (new), `tests/playwright/s1-bulk-assign-position.spec.js` (new) | Create team with explicit `Sport: Soccer` default; update team to a different sport; S5 position dropdown shows only Soccer positions; Create Player and Bulk Assign position selects show only the assigned team's sport positions; existing players show `ST – Striker` after backfill. |

## 6. Implementation units

Units are ordered so each is independently testable and mergeable.

### U1 — Schema migration + backfill

**Files:** `apps/api/src/db/migrations/016_teams_sport.sql` (new), `apps/api/src/db/schema/tables.sql`, `apps/api/src/db/schema/deploy.sql`, `apps/api/tests/integration/db/teams-sport-migration.spec.ts` (new).

**Acceptance:** Vitest migration-sync spec is green; manual `psql $DATABASE_URL -f apps/api/src/db/migrations/016_teams_sport.sql` succeeds; post-migration `SELECT sport_id, COUNT(*) FROM teams GROUP BY sport_id` shows every team on `sport_soccer`.

### U2 — API handlers: team create/update/list return sportId

**Files:** `scripts/serve-mockup.js` (extend three handlers), `apps/api/tests/integration/teams/teams-sport-api-mockup.spec.ts` (extend with handler assertions), `openapi/v1/schemas/teams.yaml` (add `sportId`/`sportName` to team responses), `openapi/v1/openapi.yaml` (no path changes).

**Acceptance:** Vitest contract + handler specs are green. Manual curl round-trip:
```
curl -X POST .../api/v1/teams -d '{"name":"QA Sport Team","ageGroup":"U10","sportId":"sport_soccer",...}'
```
returns 201 with `sportId: "sport_soccer"`.

### U3 — Mockup client: createTeam/updateTeam/listTeams carry sportId + offline store

**Files:** `docs/ux/mockup/js/mockup-api-client.js`, `apps/api/tests/integration/players/mockup-api-client.spec.ts`.

**Acceptance:** Static analysis spec green. Manual smoke: in the mockup, opening S3 with a fresh offline store still shows `Soccer` as each team's sport.

### U4 — Mockup pages: S3 + S3a sport dropdowns, S5 + S1 position dropdowns

**Files:** `docs/ux/mockup/S3-team-management.html`, `docs/ux/mockup/S3a-team-update.html`, `docs/ux/mockup/S5-player-edit.html`, `docs/ux/mockup/S1-player-list.html` (Create Player modal + Bulk Assign rows), `docs/ux/mockup/style/site.css` (no change expected — re-use existing form styles), `tests/playwright/team-sport.spec.js` (new), `tests/playwright/s5-position.spec.js` (new), `tests/playwright/s1-create-player-position.spec.js` (new), `tests/playwright/s1-bulk-assign-position.spec.js` (new).

**Acceptance:** All four Playwright specs green; manual smoke shows Soccer preselected in Create Team, current sport preselected in Update Team, and every player-edit/create/bulk-assign position select shows 13 Soccer positions when the team is Soccer and is disabled with a helper notice when no positions exist for the team's sport.

### U5 — Documentation

**Files:** `docs/ux/mockup/API-Mockup-Mapping.md` (new section “S3/S5 Sport & Position”), commit message and PR description.

**Acceptance:** Mapping doc lists the new payload fields and references U1–U4 for traceability.

## 7. Verification

Before the final commit, the following must all pass from the repo root:

```powershell
# Unit / contract / static-analysis
npx vitest run --config apps/api/vitest.config.mjs apps/api/tests/integration/db/teams-sport-migration.spec.ts
npx vitest run --config apps/api/vitest.config.mjs apps/api/tests/integration/teams/teams-sport-api-mockup.spec.ts
npx vitest run --config apps/api/vitest.config.mjs apps/api/tests/integration/players/mockup-api-client.spec.ts
npx vitest run --config apps/api/vitest.config.mjs apps/api/tests/contract

# End-to-end (mockup server must be running on port 5500)
npx playwright test tests/playwright/team-sport.spec.js tests/playwright/s5-position.spec.js
```

Manual smoke (one round trip per item):

1. `POST /api/v1/teams` with `sportId` omitted → row's `sport_id` is `sport_soccer`.
2. `POST /api/v1/teams` with `sportId: "sport_soccer"` → row's `sport_id` is `sport_soccer`.
3. `POST /api/v1/teams` with `sportId: "sport_bogus"` → `400`.
4. Update team to a different active sport → row reflects new `sport_id`.
5. Open S5 on a Soccer team → position select has 13 options, none missing.
6. Open S5 on a player without a position → preset value is `ST – Striker` (from backfill).
7. Confirm offline store seeds teams with `sportId: "sport_soccer"`.

## 8. Rollback

- Migration `016` is **NOT reversible** because it ends with `SET NOT NULL`. If we need to back out, we drop the column with `ALTER TABLE teams DROP COLUMN sport_id;` and replace the migration file with an empty stub. No data is lost because the column is derivable from seed defaults.
- Code-level rollback: revert U2–U5 commits. The schema migration is the only sticky artifact and can be wiped independently of the code.