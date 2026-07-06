---
title: feat: Manage clubs — new clubs table, coach_clubs join, club-aware S3 team management
date: 2026-07-06
type: feat
---

# feat: Manage clubs — new clubs table, coach_clubs join, club-aware S3 team management

## Summary

Add a first-class `clubs` entity: a `clubs` table plus a `coach_clubs` join table (M:N coach ↔ club), add a non-null `club_id` FK to `teams`, and reshape S3 team management so admins see every team across every club with a club-filter dropdown while coaches see only teams in their assigned clubs (with an "only my clubs" checkbox that defaults on). Server-side filtering is the source of truth — the S3 surface hands filter params to `GET /v1/teams` and the API resolves role-scoped visibility.

## Problem Frame

Teams today live in a flat namespace and have no notion of "club." As the platform multi-clubs (or even stands up a second club inside the same deployment) the coach-team ownership currently encoded in `teams.lead_coach_user_id` is a single-coach-per-team relationship, not a coach-can-work-across-clubs relationship. The product needs (a) a top-level entity that owns teams and coaches, (b) a many-to-many coach↔club assignment so a coach can oversee teams across more than one club (and S3 must hide clubs they aren't part of), and (c) a backend filter contract the UI can rely on without re-implementing role-aware logic client-side. There is no existing brainstorm or requirement doc for clubs — this plan captures the data-model and S3 surface decisions end-to-end.

## Key Decisions

- **M:N `coach_clubs` join table, not a single `users.home_club_id`.** A coach may be assigned across more than one club (e.g., a head coach who oversees both U19 and Senior squads at two clubs). A single home-club column would force one club per coach. `coach_clubs(user_id, club_id, PRIMARY KEY(user_id, club_id))` is the more flexible shape and still queries well — `WHERE club_id IN (SELECT club_id FROM coach_clubs WHERE user_id = $1)` for the Coach view.
- **Server-side filter is authoritative; S3 UI is a thin pass-through.** The `GET /v1/teams` handler reads query params `?clubId=` (exact club filter for both roles) and `?scope=mine` (Coach-only narrowing to clubs the coach is assigned to via `coach_clubs`). The UI does not pre-filter rows client-side beyond what those params return, so the role-split is enforced by the live backend. This mirrors the existing "Coach actor identity is derived from session context" pattern in `API-Mockup-Mapping.md` line 75.
- **No dedicated `Manage Clubs` admin screen in this iteration.** Admins need to assign clubs to teams (already implicit via `teams.club_id`) and assign coaches to clubs (admin function, but exposed through the existing team-create + change-coach modals in S3 plus a new admin coach-assignment surface would balloon scope). The v1 surface ships: a club picker on the team-create modal (admin path) and a club picker on the change-coach modal (admin) so the coach-club join can be maintained indirectly by re-attaching the coach's team. The `coach_clubs` rows are seeded from a migration backfill so existing coach↔team parity is preserved without an admin UI.
- **Seed a single default club ("VantageIQ Club") so S3 doesn't render empty for the Coach view.** All three seeded teams (`t_u17`, `t_u19`, `t_senior`) belong to this club; all three seeded coaches (`u_coach_ana`, `u_coach_joao`, `u_coach_maria`) get a `coach_clubs` row for it. Adds an immediate "club: VantageIQ Club" column on S3 and demonstrates the filter without requiring a multi-club migration story.
- **Backend handler changes live in `scripts/serve-mockup.js`'s live `GET /v1/teams`, `POST /v1/teams`, and `POST /v1/teams/coach`.** No `apps/api/src/modules/teams/` controllers yet (verified — only players / users / auth modules); the team endpoints are owned by `serve-mockup.js` and the live tests run through it. The DB migration runs through the existing migration-numbering scheme at `apps/api/src/db/migrations/012_*.sql`.
- **Tests run end-to-end against the live backend.** The avatar-upload plan established this norm (`tests/playwright/s2-player-avatar-backend.spec.js`); the new scenarios follow the same `addInitScript`-free shape, hitting `GET /api/v1/teams` directly with `actorEmail` for the Coach path.

## Requirements

- R1. A `clubs` entity exists with an `id`, `name`, and timestamps; `teams.club_id` references `clubs.id` (NOT NULL).
- R2. A `coach_clubs(user_id, club_id)` join table exists, with a coach able to belong to more than one club.
- R3. `GET /v1/teams?clubId=` returns only teams in that club for both roles.
- R4. `GET /v1/teams?actorEmail=<coach>` returns only teams in clubs the coach is assigned to (joins through `coach_clubs`); admins calling the same endpoint see every team.
- R5. S3 admin view shows all teams with a club-filter dropdown; selecting a club narrows the table.
- R6. S3 Coach view shows teams in the coach's clubs only, with an "only my clubs" checkbox that defaults **on** and, when on, hides clubs the coach isn't part of (which can mean the table is empty for a coach with no club assignments; a "No clubs assigned" notice handles that state).
- R7. The Team payload returned by every `GET /v1/teams` / `POST /v1/teams` / `POST /v1/teams/coach` response includes `clubId` and `clubName` so the S3 column renders without a second lookup.
- R8. The team-create modal (admin path) requires a `clubId` selection; existing coach-self-assign path (Coach actor) inherits the acting coach's first assigned club.
- R9. A new `GET /v1/clubs` endpoint lists all clubs (admin) or the coach's assigned clubs (Coach); S3 uses it to populate the dropdown.
- R10. Existing S3 tests continue to pass under the migrated schema with the same fixture counts (3 teams seeded, default club covers them all).

## Implementation Units

### U1. DB migration: `clubs`, `coach_clubs`, and `teams.club_id` with backfill

**Goal:** Land the source-of-record schema and the seed-time backfill so the rest of the work has data to render against.

**Files:**
- `apps/api/src/db/migrations/012_clubs_and_coach_assignments.sql`

**Approach:** Create `clubs(id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`. Create `coach_clubs(user_id TEXT NOT NULL REFERENCES users(id), club_id TEXT NOT NULL REFERENCES clubs(id), PRIMARY KEY(user_id, club_id))` and an index on `club_id` for the `WHERE user_id IN (coach_ids of this club)` reverse lookup. Add `teams.club_id TEXT REFERENCES clubs(id)` (nullable initially so the existing seeded teams don't reject the migration; the backfill fills them in the same SQL). Backfill: `INSERT INTO clubs (id, name) VALUES ('c_default', 'VantageIQ Club')` on conflict do nothing; `UPDATE teams SET club_id = 'c_default' WHERE club_id IS NULL`; `INSERT INTO coach_clubs SELECT u.id, 'c_default' FROM users u WHERE u.role IN ('Coach','SystemAdmin') AND u.status = 'active' ON CONFLICT DO NOTHING`. Add an index on `teams.club_id`. Document the migration in `apps/api/src/db/schema/tables.sql` (canonical source of record) and append the club + coach_clubs + clubs index definitions to that file's `clubs`/`coach_clubs`/`teams` blocks.

**Test scenarios:**
- Migration is idempotent (running it twice leaves the row count unchanged).
- After migration, every existing team has `club_id = 'c_default'`.
- After migration, every active Coach and the SystemAdmin has a `coach_clubs` row for `'c_default'`.
- A new club + new coach + new coach_clubs row + new team referencing the new club survives a roundtrip select.

---

### U2. Update `scripts/serve-mockup.js` team endpoints + add `/clubs`

**Goal:** Make the live backend honor `?clubId=`, `?actorEmail=` (Coach scope), and expose a `/clubs` endpoint — and make every team payload carry `clubId` and `clubName`.

**Files:**
- `scripts/serve-mockup.js`

**Approach:** In the `GET /v1/teams` handler (line 1126) join `clubs` onto the existing select, expose `clubId` and `clubName` on the returned payload (extend `toTeamPayload`), and add two WHERE-arms: `?clubId=<id>` filters to one club; `?actorEmail=<coach>` and role derived from the `users` row filters to `club_id IN (SELECT club_id FROM coach_clubs WHERE user_id = $1)`. Admins bypass the coach_clubs narrowing unless they pass `?scope=mine`. The response always selects the joined columns so the payload stays uniform. Update `POST /v1/teams` to require a `clubId` in the payload for SystemAdmin path, default to the coach's first `coach_clubs` row for Coach path (the `actorEmail → clubs` lookup is already implicit via `resolveActorContext`). Update `POST /v1/teams/coach` to also update `coach_clubs` when the team changes clubs (i.e., the team stays in its club but the coach is now assigned to that club if not already). Add a new `GET /v1/clubs` handler that lists all clubs (admin) or `coach_clubs`-filtered (Coach) following the same role-split pattern. Extend `toTeamPayload` to include the joined `clubId`/`clubName` keys.

**Patterns to follow:** The existing role-aware narrowing in `GET /v1/players/dashboard` (line 1063) and in `POST /v1/teams` (line 1147) uses `actorUser.role` derived from a `users` row keyed by email. The coach-club filter follows the same shape. The new `/clubs` endpoint mirrors `GET /v1/players` query structure.

**Test scenarios:**
- `GET /api/v1/teams` as admin returns every team with `clubName = 'VantageIQ Club'`.
- `GET /api/v1/teams?actorEmail=joao@vantageiq.club` returns only teams in clubs the coach is in (all 3 seeded).
- `GET /api/v1/teams?clubId=c_default&actorEmail=joao@vantageiq.club` returns the same 3 teams (intersection).
- `GET /api/v1/teams?actorEmail=joao@vantageiq.club` after removing `coach_clubs` for that user returns zero teams and an empty `data` array (not an error).
- `GET /api/v1/clubs?actorEmail=maria@vantageiq.club` returns every club; same call with `actorEmail=joao@vantageiq.club` returns only the coach's clubs.
- A `POST /v1/teams` from Coach without `clubId` defaults to the coach's first club; the same POST with `clubId = 'c_default'` from admin succeeds and the response carries `clubId`.
- A `POST /v1/teams/coach` updating the lead coach inserts a `coach_clubs` row if the coach wasn't already in the team's club (idempotent on conflict).

---

### U3. Extend `MockupApi` with clubs + club-aware team list

**Goal:** Make `MockupApi.listTeamSummary()`, `MockupApi.createTeam()`, and `MockupApi.reassignTeamCoach()` carry club data through the offline path so S3 renders consistently when `__USE_BACKEND__ = false`.

**Files:**
- `docs/ux/mockup/js/mockup-api-client.js`
- `docs/ux/mockup/js/mockup-api-client.js` seed (`createSeed`)

**Approach:** Extend the seed `teams` objects with `clubId: 'c_default'`. Add a `clubs: [{ id: 'c_default', name: 'VantageIQ Club' }]` to the seed. Add a `coachClubs: [{ userId: 'u_coach_joao', clubId: 'c_default' }, ...]` map mirroring the migration backfill (one row per active Coach and the SystemAdmin). Extend the offline `listTeams()` / `listTeamSummary()` to project the new fields onto the returned shape. Add `MockupApi.listClubs(actorRole, actorEmail)` mirroring the backend role-split. Update offline `createTeam` and `reassignTeamCoach` to keep the offline `coachClubs` map consistent (insert on conflict do nothing). All paths must produce the same response shape as the live backend so the UI doesn't branch.

**Test scenarios:**
- After seeding, `MockupApi.listClubs('SystemAdmin')` returns one club.
- `MockupApi.listClubs('Coach', 'joao@vantageiq.club')` returns one club.
- `MockupApi.listTeamSummary()` returns three teams each with `clubId: 'c_default'`.
- `MockupApi.createTeam(..., 'Coach', 'joao@vantageiq.club')` succeeds with no `clubId` in the payload and the response includes `clubId: 'c_default'`.

---

### U4. S3 UI: club column + club filter + Coach "only my clubs" toggle

**Goal:** Render the club column on every row, expose the admin club filter, and wire the Coach "only my clubs" toggle that defaults **on** and gates the visible teams.

**Files:**
- `docs/ux/mockup/S3-team-management.html`
- `docs/ux/mockup/style/site.css` (only if a new control shape is needed; reuse `.pill-select` and a custom checkbox if already shipped)

**Approach:** Add a new `<th>Club</th>` column to the table head, populate each row with `team.clubName` (or "—" if null). Add a club-filter `<select class="pill-select" id="clubFilter">` to the toolbar above the table — populated from `MockupApi.listClubs(...)` on render. In admin mode, the filter is visible and defaults to "All Clubs"; changing it re-fetches `listTeamSummary({ clubId })`. In Coach mode, render a checkbox above the table labeled "Only show my clubs" (`<input type="checkbox" id="onlyMyClubs" checked>`); when checked (default), the table is filtered to clubs from the `coach_clubs` join (already enforced server-side, so the API call passes `actorEmail` and discards rows for clubs the coach isn't in). Wire the checkbox change to re-render the table. Add a "No clubs assigned — contact your admin to be added to a club." notice (`<div class="notice" id="clubEmpty" hidden>`) that toggles visible when the Coach table renders empty. Pass the right context to `MockupApi.listTeamSummary` based on the coach's session — use `MockupApi.getCurrentUser().email` as `actorEmail` for Coach actors (mirrors the dashboard handler at line 1106).

**Patterns to follow:** The team filter pill (`<select id="teamFilter">`) on S1 (line 19) and the player-filter pill on S6 are the existing chip/select pattern; reuse `.pill-select`. The checkbox row mirrors the inline-actions pattern at S3 line 244.

**Test scenarios:**
- Admin S3 sees the club-filter dropdown with "All Clubs" as the default plus one club; selecting a club narrows the rows to that club's teams only.
- Coach S3 sees the "Only show my clubs" checkbox checked by default; the table shows the same teams as the backend's coach-scoped list.
- A Coach with no `coach_clubs` rows sees the "No clubs assigned" notice and an empty table.
- The Club column is visible on every row and shows "VantageIQ Club" for the seeded teams.

---

### U5. S3 admin team-create modal: add club picker

**Goal:** Let admins choose a club when creating a team so new teams don't end up orphaned from clubs.

**Files:**
- `docs/ux/mockup/S3-team-management.html`

**Approach:** In `#createTeamModal`, after the existing `teamCoachSelect` wrap, add a `#teamClubSelect` wrap mirroring the coach picker (`hidden` for Coach actor, visible for SystemAdmin). Populate it from `MockupApi.listClubs('SystemAdmin')` in `prepareCreateTeamModal`. On submit, send `clubId: teamClubSelect.value` as part of the create payload and validate that admin actors must select a club (server-side already enforced by U2). Without this picker the admin create flow leaves the new team's `club_id` null, which the API would reject after the migration lands (this is the intended upstream guard).

**Test scenarios:**
- Admin opens the Create Team modal and sees the Club select dropdown populated with all clubs.
- Admin submits a create with no club selected and the form blocks the submit with the existing error message.
- Admin submits with a club selected, the new team is returned with `clubId: club-select-value`.
- Coach actor does not see the Club select (the wrap stays hidden), and the coach's create flow defaults `clubId` to the coach's assigned club.

---

### U6. Playwright end-to-end coverage for both role views

**Goal:** Lock in the role-split S3 experience with live-backend round-trip coverage so a regression in the new filter params surfaces immediately.

**Files:**
- `tests/playwright/manage-club.spec.js` (new)

**Approach:** Create a new Playwright spec with three scenarios. **Scenario A (Admin):** log in as SystemAdmin via `MockupApi.login` (`maria@vantageiq.club`), navigate to `/S3-team-management.html`, assert the table has three rows each with `VantageIQ Club` in the Club cell, change the club-filter dropdown to "VantageIQ Club", assert rows still = 3, then run a direct API call `await page.evaluate(() => fetch('/api/v1/teams?clubId=c_default').then(r => r.json()))` and assert `data.length === 3` and each has `clubId: 'c_default'`. **Scenario B (Coach "only my clubs" default on):** log in as Coach (`joao@vantageiq.club`), navigate to `/S3-team-management.html`, assert `#onlyMyClubs` is checked by default, assert the table shows the coach's clubs' teams (3 rows), uncheck the box and assert the table widens to *every* team across *every* club for an admin-equivalent request (note: unchecking for a Coach should call the backend without `actorEmail`, which returns the coach's-clubs-only list anyway since the server enforces it — assert behavior matches the coach-scoped list, not the admin-scoped list, and that the toggle is purely a UI courtesy). **Scenario C (Coach with no club assignment):** programmatically remove the `coach_clubs` row via `await page.evaluate(() => fetch('/api/v1/teams?actorEmail=joao@vantageiq.club').then(r => r.json()))` returning `data.length === 0`, then reload S3, assert the "No clubs assigned" notice is visible and the table is empty. Mirror the live-mode pattern from `tests/playwright/s2-player-avatar-backend.spec.js` (no `__USE_BACKEND__ = false`, login via `MockupApi.login`, then `addInitScript`-free API hits).

**Test scenarios:**
- Admin lands on S3 with the club-filter dropdown and 3 rows in the table.
- Coach lands on S3 with "Only show my clubs" checked and the table populated to 3 rows.
- A Coach with no `coach_clubs` rows sees the empty-state notice on S3.
- Direct `GET /api/v1/teams` calls return the expected role-scoped shape.

---

### U7. OpenAPI schema updates + `API-Mockup-Mapping.md` refresh

**Goal:** Document the new entity and the new filter params so the contract is unambiguous, and update the mapping doc so the next iteration surfaces the surface from one place.

**Files:**
- `openapi/v1/schemas/teams.yaml` (add `clubId`/`clubName` to `Team`, add `?clubId` and `?scope` on list, add `clubId` to `CreateTeamRequest`)
- `openapi/v1/schemas/clubs.yaml` (new — `Club`, `ClubListResponse`)
- `openapi/v1/openapi.yaml` (register the new schema path and add `GET /v1/clubs`)
- `docs/ux/mockup/API-Mockup-Mapping.md` (add club-row entry, update S3 row, add `/clubs` row)

**Approach:** Update `Team.required` to include `clubId`, `Team.properties` with `clubId` (string) and `clubName` (string, read-only). Update `CreateTeamRequest` to include `clubId` (required when `actorRole === 'SystemAdmin'`). Add `clubs.yaml` declaring the `Club` schema (id, name, timestamps) and a `ClubListResponse`. In `openapi.yaml` register the path, add `GET /v1/clubs` (no body) returning `ClubListResponse`, and update the `teams` `GET` to declare the new query params. In `API-Mockup-Mapping.md` add a `Club / list clubs` row under S3, update the `List teams` row to mention `?clubId=` and `?actorEmail=` narrowing, and add the new `Club` column note to the S3 mapping paragraph.

**Test scenarios:**
- OpenAPI schemas parse (existing `apps/api/tests/contract/openapi.*.spec.ts` style).
- `docs/ux/mockup/API-Mockup-Mapping.md` mentions the club filter on at least one row.
- The new `clubs.yaml` declares `Club` with the expected required keys.

## Dependencies

- U2 depends on U1 (every handler reads `teams.club_id` and `coach_clubs`; U1 must be migrated first).
- U3 depends on U1 (offline seed must mirror the migrated DB shape).
- U4 depends on U2 and U3 (S3 UI calls `listTeams` / `listClubs`; both paths must return the same payload).
- U5 depends on U4 (the create modal's club picker is wired against the same `listClubs` that populates the dropdown).
- U6 depends on U4 and U5 (the live-backend tests run against the new API surface and the new UI).
- U7 depends on all of the above (schema reflects the final surface; mapping doc reflects the final behavior).

## Verification

- `npx playwright test tests/playwright/manage-club.spec.js --reporter=line` — all three scenarios pass.
- `npx playwright test tests/playwright/s3-team-management.spec.js --reporter=line` — existing S3 scenarios still pass against the migrated schema.
- Manual smoke: load `/S3-team-management.html` as SystemAdmin → club dropdown populated → rows = 3, all "VantageIQ Club". Switch to Coach `joao@vantageiq.club` → "Only my clubs" checked → rows = 3.
- `node scripts/db-bootstrap.js` is idempotent against the new migration (running it twice leaves the row count unchanged and the schema unchanged).

## Deferred to Follow-Up Work

- **Dedicated Manage Clubs admin screen** (S8 or a sub-page in S7) for creating clubs, renaming clubs, and re-assigning coaches between clubs through a UI instead of via SQL migrations.
- **Per-coach club-level role distinction** (e.g., head coach vs. assistant) — current model treats every coach in a club equally.
- **Audit log** for club-membership changes (when the surface grows beyond v1's SQL-driven backfill).
- **Club-scoped S3 KPIs** (count of teams per club, players per club) — out of scope for v1; current KPIs stay global.

## Related Artifacts

- `apps/api/src/db/migrations/005_teams_and_coach_assignment.sql` — current `teams` schema (single-coach-per-team) the new migration extends.
- `apps/api/src/db/migrations/006_players_teams_source_of_record.sql` — `player_team_assignments` shape that the team join already follows; the new `teams.club_id` slot mirrors that style.
- `scripts/serve-mockup.js:1126-1218` — existing `GET /v1/teams` and `POST /v1/teams` handlers the migration touches.
- `docs/ux/mockup/S3-team-management.html` — the surface this plan reshapes.
- `openapi/v1/schemas/teams.yaml` — current `Team` shape the migration extends.
- `tests/playwright/s2-player-avatar-backend.spec.js` — live-backend pattern U6 mirrors.
- `tests/playwright/s3-team-management.spec.js` — existing scenarios that must continue passing under the migrated schema.
