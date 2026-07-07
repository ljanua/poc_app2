# API to Mockup Mapping

## Scope
This mapping aligns SystemAdmin user lifecycle actions in the mockup with the phase-1 OpenAPI contract direction from the latest plans.

Source plans:
- docs/plans/2026-07-03-001-feat-openapi-postgresql-architecture-plan.md
- docs/plans/2026-07-03-002-feat-system-admin-user-management-plan.md
- docs/plans/2026-07-03-007-feat-persist-mock-data-plan.md
- docs/plans/2026-07-04-005-fix-s2-dashboard-missing-stats-default-player-plan.md
- docs/plans/2026-07-04-006-feat-s2-edit-player-profile-plan.md
- docs/plans/2026-07-05-002-feat-player-avatar-upload-plan.md
- docs/plans/2026-07-06-005-feat-manage-club-table-and-s3-filter-plan.md
- docs/plans/2026-07-06-007-feat-team-update-screen-plan.md
- docs/plans/2026-07-06-008-feat-s7-user-club-assignment-and-s7a-clubs-page-plan.md
- docs/plans/2026-07-06-009-feat-s1-coach-scope-clubs-main-menu-plan.md

## Screen mapping

| Screen | UI action | OpenAPI operation | Method and path | Success response | Error responses |
|---|---|---|---|---|---|
| S7-admin-user-management.html | Create User modal submit | Create user | POST /v1/users | 201 Created with sanitized user object | 400 validation_error, 403 forbidden, 409 conflict |
| S7-admin-user-management.html | Change Role modal submit | Change user role | PATCH /v1/users/{userId}/role | 200 OK with updated role | 400 validation_error, 403 forbidden, 404 not_found |
| S7-admin-user-management.html | Change Password modal submit | Change user password | PATCH /v1/users/{userId}/password | 204 No Content | 400 validation_error, 403 forbidden, 404 not_found |
| S7-admin-user-management.html | Deactivate action | Deactivate user | PATCH /v1/users/{userId}/status | 200 OK with inactive status | 403 forbidden, 404 not_found |
| S7-admin-user-management.html | Reactivate action | Reactivate user | PATCH /v1/users/{userId}/status | 200 OK with active status | 403 forbidden, 404 not_found |
| S7-admin-user-management.html | Filter by role/status/search | List users | GET /v1/users | 200 OK with paged list | 403 forbidden |
| S3-team-management.html | Create Team (Coach actor) | Create team (coach auto-assigned) | POST /v1/teams | 201 Created with lead coach set to actor | 400 validation_error, 403 forbidden, 409 conflict |
| S3-team-management.html | Create Team (SystemAdmin actor) | Create team (selected active coach) | POST /v1/teams | 201 Created with selected coach as lead coach | 400 validation_error, 403 forbidden, 409 conflict |
| S3-team-management.html | Change Coach (SystemAdmin only) | Reassign team coach | PATCH /v1/teams/{teamId}/coach | 200 OK with updated team coach | 400 validation_error, 403 forbidden, 404 not_found |
| S1-player-list.html | Team-scoped player list | List players | GET /v1/players?teamName=&query=&actorEmail=&onlyMine= | 200 OK with filtered players (each entry includes `avatarUrl`; null when no avatar uploaded). When `actorEmail` resolves to an active Coach and `onlyMine=true`, the list is scoped to players on teams belonging to that coach's clubs (joined via `coach_clubs`); SystemAdmin actors always see the full roster regardless of `onlyMine` | 400 validation_error |
| S1-player-list.html | Add player with explicit create confirm | Create player or assign existing | POST /v1/players | 201 created for confirmed no-match, 200 for strict move assign | 400 validation_error, 409 conflict |
| S1-player-list.html | Preview create-on-no-match | Preview create | POST /v1/players/preview-create | 200 OK with normalized name preview and duplicate marker | 400 validation_error |
| S1-player-list.html | Duplicate quick action | Assign existing player | POST /v1/players/{playerId}/assign | 200 OK with move/no-op state | 400 validation_error, 404 not_found |
| S2-player-dashboard.html | Load player development dashboard | Get player development dashboard | GET /v1/players/dashboard?playerName=&actorEmail= | 200 OK with growth status, match/performance stats, and per-metric (Current Level, Fitness, Skill Progress) change indicators | 403 forbidden, 404 not_found |
| S2-player-dashboard.html | Edit Player action (toolbar) | Navigation to S5 edit page | (client-side link to `S5-player-edit.html?playerId=`) | Opens S5 for the viewed player (shown even in the no-stats-yet state) | n/a |
| S2-player-dashboard.html | Upload player avatar (click icon) | Upload avatar | PATCH /v1/players/{playerId}?actorEmail= with `{ avatarUrl }` | 200 OK with updated `{ player, stats }`; `player.avatarUrl` set | 400 validation_error, 403 forbidden, 404 not_found |
| S5-player-edit.html | Load editable player profile | Get player profile | GET /v1/players/{playerId}/profile?actorEmail= | 200 OK with `{ player, stats }` (full editable identity + `PlayerDashboardStats`) | 403 forbidden, 404 not_found |
| S5-player-edit.html | Save Player | Update full player profile | PATCH /v1/players/{playerId}?actorEmail= | 200 OK with updated `{ player, stats }`; `missingDataMessage` cleared only when at least one Development Progress rating (Current Level, Fitness, or Skill Progress) is recorded | 400 validation_error, 403 forbidden, 404 not_found, 409 conflict |

Player persistence mode notes:
- S1 runs backend mode by default (`window.__USE_BACKEND__ = true`) so create/assign operations target `/api/v1/players*`.
- Local-only persistence is allowed for offline regression runs only when `window.__USE_MOCK_LOCAL__ = true` is explicitly set.
- S2's dashboard read falls back to `mockup-api-client.js`'s offline/local snapshot whenever the backend is unavailable or `DATABASE_URL` is unset, which is the case in CI. The fallback always returns the same JSON shape as the backend (same keys under `stats`/`metrics`); for the four named seed players (Messi, Ronaldo, Neymar Jr, Mbappe) it also returns the exact same metric-change values as the Postgres-backed path, and for any other player it returns the same genuine "no stats yet" shape described below (never a generic trend-based approximation borrowed from another player).

Dashboard metric-change indicators:
- `PlayerDashboardStats`/`metrics` now return `currentLevelChange`, `fitnessChange`, and `skillProgressChange` objects (`{ label, trend }`), replacing the static "Up 5%" / "Stable" / "Up 3%" markup previously hardcoded in the S2 mockup.
- `trend` is one of `improving`, `plateau`, or `declining` and drives the badge arrow/color; `label` is the human-readable delta text (e.g. "Up 5%", "Stable").
- Backed by new `player_stats` columns (`current_level_change_label`/`_trend`, `fitness_change_label`/`_trend`, `skill_progress_change_label`/`_trend`) added in `apps/api/src/db/migrations/009_player_stats_metric_change_indicators.sql`.
- All three change fields are `nullable: true` in the OpenAPI schema and return `null` (not a placeholder object) whenever the underlying player has no real stats recorded.

Dashboard "no stats yet" contract (player found, but `player_stats` has no real data):
- `missingDataMessage` (surfaced at `data.performance.missingDataMessage`, mirrored onto `PlayerDashboardStats.missingDataMessage`) is the single authoritative signal that this player has no genuinely recorded stats yet. It drives **whole-section visibility** in S2, not just a note under "Recent Performance": when set, the mockup hides the "Development Progress", "Match Time History", "Recent Performance", and "Video Assessments" sections as one unit and shows a single notice next to the player identity card (name, team, position, trend badge remain visible).
- `syncDefaultDashboardStats` in `scripts/serve-mockup.js` (and the equivalent branch in `mockup-api-client.js`'s `buildDashboardSnapshot`) only ever applies curated demo data to the four named reference profiles (`lionel messi`, `cristiano ronaldo`, `neymar jr`, `kylian mbappe`). Every other player defaults to this genuine "no stats yet" state — including on server restart — rather than a fabricated archetype profile borrowed from one of the four named players.
- This is distinct from the "player not found" case (bad/stale `playerName`, no roster match at all): that returns `404 not_found` and the mockup hides the entire page behind a generic notice, unchanged by this contract.
- `apps/api/src/db/migrations/010_reset_fabricated_player_stats.sql` is a one-time remediation migration that resets any already-corrupted non-named `player_stats` rows back to this genuine "no stats yet" shape; it does not need to run again after the corresponding code fix lands.

Avatar upload contract (`S2-player-dashboard.html` and `S5-player-edit.html`, `PATCH /v1/players/{playerId}` with `{ avatarUrl }`):
- The `avatarUrl` field is stored on the `players` table (`player_avatar_url` column) and returned on every player read (`GET /v1/players`, `GET /v1/players/dashboard`, `GET /v1/players/{playerId}/profile`). Null means no avatar uploaded; the mockup renders ⚽ as the default.
- The upload interaction is: file picker → client-side canvas conversion to 100×100 JPEG at quality 0.85 → base64 data-URL sent as `avatarUrl` in the PATCH body. Both offline (`mockup-api-client.js`) and backend modes send the same payload shape.
- The same PATCH that updates `avatarUrl` can also carry other identity fields; all updates are atomic. **The backend validator requires every field of `UpdatePlayerProfileRequest` on every PATCH, so an avatar-only write must read-then-merge the existing profile (`mockup-api-client.js` `updatePlayerAvatar`) rather than send `{ avatarUrl }` alone** — otherwise the missing-`name` branch in `parseUpdateProfilePayload` returns `400 validation_error` (`docs/solutions/integration-issues/s2-player-avatar-patch-rejected-by-profile-validator.md`).
- `playerAvatars` in `localStorage` (`mockup-api-client.js`) stores the base64 avatar keyed by player id, checked by `buildDashboardSnapshot` and `listPlayers` before falling back to `player.avatarUrl`.

Edit player contract (`S5-player-edit.html`, `PATCH /v1/players/{playerId}`):
- The edit page loads once via `GET /v1/players/{playerId}/profile` and saves the full profile via `PATCH /v1/players/{playerId}`. Both are Coach-only and roster-scoped to a team led by the acting coach (same join as the dashboard read); non-coach actors get `403 forbidden` and players outside the coach's roster get `404 not_found`.
- Editable fields cover identity (name, team, position, trend), all development ratings (growth status, current level, fitness, skill progress) plus the three metric-change badges (`{ label, trend }` or `null`), match time (total minutes, appearances, recent avg), performance (average/last-match score, last-match summary), and clip counts.
- A successful PATCH clears `missing_data_message` (`missingDataMessage = null`) **only when at least one Development Progress rating (Current Level, Fitness, or Skill Progress) is recorded** (non-null). Saving with all three ratings not-recorded leaves the notice in place, so S2 still shows the identity-card-only state. This prevents a save that only records scores (or leaves all ratings as "not recorded") from prematurely hiding the no-stats notice. Both the backend (`scripts/serve-mockup.js` `parseUpdateProfilePayload`) and the offline client mirror (`mockup-api-client.js`) apply the same gate so the two modes agree.
- Startup sync (`syncDefaultDashboardStats`) is now **insert-only for every player** (named reference profiles included) via `ensurePlayerStatsRowExists`, so coach edits survive server restart and are never overwritten by seed data.
- Clip counts (`clip_submitted_count` / `clip_assessed_count` / `clip_pending_count`) are a **coach-editable write-through cache**. They are intentionally not reconciled against the live `clips` table on save; manual overrides are accepted as-is. Deriving these from `clips` is deferred follow-up work.
- Name changes reuse create-time normalization/validation and return `409 conflict` when the normalized name collides with another player. The PATCH response returns the updated player name, which S5 uses to redirect back to `S2-player-dashboard.html?player=<name>`.
- The offline/local fallback client (`mockup-api-client.js`) mirrors this via `getPlayerProfile`/`updatePlayerProfile`, persisting a coach-saved override in a `playerStats` map keyed by player id so edits round-trip through the dashboard read without `DATABASE_URL`.

## Authorization rules
- SystemAdmin role is required for all S7 user-management operations.
- Coach role receives forbidden responses for all write operations in this screen.
- Mockup coach-view toggle represents a forbidden-path simulation and should map to 403 in API integration tests.
- Coach role cannot execute team coach reassignment actions in Team Management.
- SystemAdmin team create/reassign operations must only accept active Coach users as lead coach targets.
- Team create and team-reassign actor identity is derived from authenticated session context first (session user is source-of-truth).
- Direct navigation without a valid authenticated session must be treated as unauthenticated and return 403 for protected writes.

## Clubs and team-club scoping (Manage Club feature)

- New entity tables (`clubs`, `coach_clubs`) and `teams.club_id` FK land via `apps/api/src/db/migrations/012_clubs_and_coach_assignments.sql` (idempotent, includes the `c_default = VantageIQ Club` backfill and `coach_clubs` rows for every active Coach plus SystemAdmin).
- `GET /v1/teams` now accepts `clubId=` (exact club filter for both roles) and `actorEmail=` (Coach-only narrowing to that coach's assigned clubs via `coach_clubs`). Admin actors see every team when `actorEmail` is omitted; supplying `actorEmail` for a Coach narrows to `club_id IN (SELECT club_id FROM coach_clubs WHERE user_id = $1)`. Unknown or non-Coach actors with `actorEmail` return an empty list rather than leaking the unfiltered result.
- Every team payload returned by `GET /v1/teams`, `POST /v1/teams`, and `POST /v1/teams/coach` now includes `clubId` and `clubName` so S3 can render the column without a second lookup.
- `POST /v1/teams` requires `clubId` for SystemAdmin actors and inherits the acting Coach's first assigned club from `coach_clubs` when `clubId` is omitted. A successful admin create also upserts the assigned coach into `coach_clubs` so the lead coach immediately becomes a member of the new club.
- `POST /v1/teams/coach` (admin reassignment) upserts the new lead coach into `coach_clubs` for the team's club, keeping the coach-club M:N in sync as coaches move between teams.
- New `GET /v1/clubs` returns every club for SystemAdmin or only the coach's assigned clubs (joined through `coach_clubs`) for Coach. S3 uses it to populate the admin's club-filter dropdown.
- S3 admin view (`S3-team-management.html`) shows every team with a `Filter by club` dropdown sourced from `MockupApi.listClubs`. The coach view hides the dropdown and shows an `Only show my clubs` checkbox that defaults on; when on, the table only renders teams whose `clubId` is in the coach's `state.assignedClubIds` (sourced from `listClubs`). An empty result renders the `club-empty` notice.
- The team-create modal surfaces a `Club` picker for admin (`#teamClubSelect`, `[data-testid="team-club-select"]`) and inherits the coach's first club when the actor is a Coach.
- Mockup API client (`docs/ux/mockup/js/mockup-api-client.js`) keeps an offline seed in lockstep: `clubs` and `coachClubs` are added to `createSeed`, `listClubs` consults `coachClubs` for the offline Coach path, and `createTeam` / `reassignTeamCoach` extend the offline store with `clubId` / `clubName` while mirroring the coach-club join upsert.

## Session entry behavior
- S0 login provides authenticated entry for both Coach and SystemAdmin paths.
- Quick admin entry in mockup must perform real login semantics (session established) before redirecting to admin screen.
- Every protected surface (S1, S2, S3, S4, S5, S6, S7) renders an icon-only `exit` button (`[data-testid="exit-button"]`, aria-label "Log out") in the topbar. Clicking it calls `MockupApi.logout()` (clears `vantageiq_current_user_email` from `localStorage`) and navigates to `S0-login.html`. Logout is client-side only — the v1 short-lived JWT expires on its own and there is no server-side revocation endpoint in this release.

## Validation expectations
- Create user: name, email, role, and initial password required.
- Change role: role must be one of SystemAdmin or Coach.
- Change password: minimum 10 characters, at least one numeric character, and confirm-match enforced in UI and API.
- Add player: team required (not all), normalized name 2-60 chars, allowed characters are letters, spaces, apostrophe, and hyphen.
- Create-on-no-match: explicit confirmation required before persistence.

## Telemetry events
- user_create_success
- user_create_failed
- user_role_change_success
- user_role_change_failed
- user_password_change_success
- user_password_change_failed
- user_admin_forbidden_attempt

## Team Update (S3a) + team status (active/inactive)

A new `teams.status` column (`active` / `inactive`) lands via migration `apps/api/src/db/migrations/013_teams_status.sql`. Every existing seeded team backfills to `active`. The S3 teams table grows two checkboxes: **Show active** (default ON, hides `inactive` rows) and **Only my teams** (default OFF, replaces the prior "Only show my clubs" wording — Coach-only narrowing by `coach_clubs`). A new S3a screen (`docs/ux/mockup/S3a-team-update.html`) is reached from each S3 row's `Update` action.

### Endpoints

- `GET /v1/teams?status=active|inactive|all` (default `active`). Admin sees the requested status; Coach actor (with `?actorEmail=<coach>`) sees their filtered set.
- `POST /v1/teams/:teamId/update` body `{ coachEmail, clubId, status, actorRole, actorEmail }`. Atomic transaction (BEGIN/UPDATE teams/UPSERT coach_clubs/COMMIT). Returns the refreshed `Team` payload with `status`.
    - Coach actor: must hold a `coach_clubs` row for the team's current club AND the new club. Violation → `403 forbidden_scope`.
    - `status` must be `active` or `inactive`. Unknown team → `404 not_found`. Unknown coach/club → `400 validation_error`.

### Client

- `MockupApi.updateTeamCoachAndClub(teamId, payload)` — online wraps `POST /v1/teams/:teamId/update`; offline/local writes through to `vantageiq_mockup_v2` with the same role-scoping guard.
- `MockupApi.listTeamSummary` and `MockupApi.getTeamById(teamId)` expose `status`.
- Seeded offline teams carry `status: 'active'` from `createSeed()`; older local stores fall back to `active` on read (`team.status || 'active'`).

### Roles

- **SystemAdmin** can edit any team's coach, club, and status. Club dropdown lists every club.
- **Coach** can edit teams in their own clubs (`coach_clubs`). Club dropdown is pre-narrowed; the server enforces the same guard.

See `docs/plans/2026-07-06-007-feat-team-update-screen-plan.md` for full requirements, schema design, and test scenarios.

## Test traceability

The Playwright suite enforces a single invariant: **at least 3 teams must be available**. The seeded `Senior Squad` / `U19 Prime` / `U17 Elite` are guaranteed by `scripts/serve-mockup.js`'s `INSERT INTO teams … ON CONFLICT DO NOTHING` step. Tests assert on these three named rows or on `>= 3` counts; any extras beyond those three (from prior runs or new admin-created teams) are accepted silently. The suite does **not** truncate the dev DB between runs. Shared-state mutations (e.g. role flips on `Joao Lima`) are restored before the test ends via `restoreCoachRole` in `tests/playwright/_fixture-utils.js`. See `docs/plans/2026-07-06-006-test-plan-resilient-to-growing-teams.md` for the full policy.

- Contract: apps/api/tests/contract/openapi.user-admin.spec.ts
- Contract: apps/api/tests/contract/openapi.players.spec.ts
- Contract: apps/api/tests/contract/openapi.clubs-admin.spec.ts
- API integration: apps/api/tests/integration/users/user-admin.api.spec.ts
- API integration: apps/api/tests/integration/players/players-api.spec.ts
- API integration: apps/api/tests/integration/clubs/clubs-api-mockup.spec.ts
- API integration: apps/api/tests/integration/clubs/mockup-api-client.spec.ts
- API integration: apps/api/tests/integration/db/clubs-status-migration.spec.ts
- UI integration: tests/playwright/s1-player-list.spec.js
- UI integration: tests/playwright/s2-player-dashboard.spec.js
- UI integration: tests/playwright/logout.spec.js
- UI integration: tests/playwright/manage-club.spec.js
- UI integration: tests/playwright/team-update.spec.js
- UI integration: tests/playwright/s7a-clubs.spec.js
- UI integration: tests/playwright/s7-user-club-assignment.spec.js
- BDD: tests/bdd/features/player-source-of-record-and-confirmed-create.feature
- BDD: tests/bdd/features/coach-player-development-dashboard.feature
- Schema/migration: apps/api/tests/integration/db/schema-bootstrap.spec.ts
- RBAC regression: apps/api/tests/integration/users/user-admin-rbac-regression.spec.ts

## Clubs Admin (S7a) + S7 per-user club assignment

- `clubs.status` (`active` / `inactive`) lands via `apps/api/src/db/migrations/014_clubs_status.sql`; every existing seeded club backfills to `active`.
- The `GET /v1/users` payload now includes `clubIds` (array of `coach_clubs` club ids) so the S7 inline badge list can render without a second lookup.
- `GET /v1/clubs?status=active|inactive|all` defaults to `active` for both roles; SystemAdmin sees every matching club, Coach sees only their `coach_clubs` set.
- All clubs-admin mutations (`POST /v1/clubs`, `PATCH /v1/clubs/{id}`, `PATCH /v1/clubs/{id}/status`, `POST /v1/clubs/{id}/coaches`, `POST /v1/clubs/{id}/teams`) are SystemAdmin-gated and surface `403 forbidden` for any other actor.
- `POST /v1/users/{userId}/clubs` and `POST /v1/clubs/{id}/coaches` are idempotent: `coach_clubs(user_id, club_id)` is the unique key, so retries return `200` on a re-insert and `201` on a first add. The seed uses `ON CONFLICT (user_id, club_id) DO NOTHING` in both the SQL and the offline client.
- `DELETE /v1/users/{userId}/clubs/{id}` is the explicit removal verb used by S7's per-row `×` chip and the S7a Assign Coach modal; returns `204` on success and `404` if the row was never there.
- `POST /v1/clubs/{id}/teams` wraps `POST /v1/teams/{teamId}/update` inside a single transaction: the team is moved to the new club and the new lead coach is upserted into `coach_clubs` for the new club atomically. Coach mutation surface never sees a partial state.
- Both `clubs.status = 'inactive'` and `users.status = 'inactive'` are preconditions enforced by the API: an inactive user cannot be assigned to a club and an inactive club cannot accept new members. Inactive clubs retain their existing `coach_clubs` rows and team assignments so `PATCH /v1/clubs/{id}/status` is fully reversible.
- Mockup API client (`docs/ux/mockup/js/mockup-api-client.js`) keeps the offline store in lockstep: `clubs` items in `createSeed` gain `status: 'active'`, `listClubs` accepts a status filter and returns `coachCount`/`teamCount`, and the new methods (`createClub`, `updateClub`, `setClubStatus`, `listUserClubs`, `assignUserToClub`, `removeUserFromClub`, `assignTeamToClub`) cover the same lifecycle in the offline fallback.
- S7a-clubs.html is reached from S7's "View List of Clubs" page action and from the bottom-nav Users link; the page is SystemAdmin-only and shows the full club roster with KPI cards (Active Clubs / Inactive / Total Coaches / Total Teams) plus the four CRUD verbs (Add, Update, Assign Coach(s), Assign Team(s), Deactivate/Reactivate).
- S7-admin-user-management.html renders a per-user Clubs column with the user's existing `coach_clubs` rows as removable chips plus an "Assign" button that opens the picker modal. The picker calls `MockupApi.assignUserToClub` and `MockupApi.removeUserFromClub` so the chip × button does an explicit `DELETE`, matching the API contract.

## S1 Coach Scoping + Clubs Main Menu (2026-07-06-009)

### API

- `GET /v1/players` accepts two new query parameters:
  - `actorEmail` (string, optional): when the email resolves to an active user, that user's role drives the scoping decision.
  - `onlyMine` (boolean, optional, default `false`): when `true`, the response is narrowed to players whose team belongs to one of the actor's clubs.
- Coach scoping rule: when `actorEmail` resolves to an active Coach, the response is narrowed via `teams.club_id IN (SELECT club_id FROM coach_clubs WHERE user_id = $actor)`. SystemAdmin actors and unknown/missing actors receive the full roster regardless of `onlyMine`.
- `onlyMine` is honored only when an active actor was resolved AND that actor is a Coach. SystemAdmin actors always see the full roster (the `onlyMine` flag is accepted for API completeness but ignored for them).

### Client

- `MockupApi.listPlayers(options)` accepts `actorEmail` and `onlyMine` in `options`. In backend mode both fields are forwarded as query parameters. In offline mode the same rule is mirrored: when `actor` resolves to an active Coach and `onlyMine` is truthy, the result is filtered to players whose team name is in the set of team names belonging to that coach's clubs (`coach_clubs` ∩ `teams.club_id`).
- `MockupApi.getCurrentUser()` and `MockupApi.applyRoleGatedNav(currentUser)` are the new entry points used by every mockup page:
  - `applyRoleGatedNav` walks every `[data-role-visible-to]` element and toggles `hidden` + `display: none` based on the current user's role and `status === 'active'`.
  - The Clubs and Users nav items carry `data-role-visible-to="SystemAdmin"` so coaches never see admin-only chrome.

### UI

- `S1-player-list.html` gains a Coach-only "Only My Players" checkbox in the toolbar. It is `hidden` and unchecked by default; for active Coach actors it is `hidden=false` and `checked=true`. Unchecking it disables coach scoping (the roster returns to the full set on the same actor). The checkbox is shipped `hidden` in markup so coaches never see a flash of admin-only chrome before JS hydrates the role.
- `S1-player-list.html` reads `actorEmail` and `onlyMine` from the actor context on every call to `MockupApi.listPlayers`. The status banner switches between "Showing X players in your clubs." (Coach + Only My Players ON) and the existing "Showing all assigned players (N)" / "Showing N players assigned to <team>" strings.
- Every bottom-nav page (`S1`, `S2`, `S3`, `S3a`, `S4`, `S5`, `S6`, `S7`, `S7a`) now carries a `Clubs` nav entry gated to `SystemAdmin`. The entry links to `S7a-clubs.html` and is shipped `hidden` so coaches never see it before `MockupApi.applyRoleGatedNav` runs.

### Player-Club Invariant

- Every player is reachable only via a team, and every team must belong to a club. The team-create path (`POST /v1/teams`) rejects requests without a non-empty `clubId` with a `400 validation_error` ("Please select a club for this team."), and Coach actors without an explicit `clubId` fall back to their first `coach_clubs` row in creation order. If neither is resolvable, the response is also `400`.
- `apps/api/tests/contract/openapi.players.spec.ts` (Player-club invariant block) locks the rejection text and the `coach_clubs` fallback path on the serve-mockup side, so a future refactor cannot silently relax the invariant.
