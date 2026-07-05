# API to Mockup Mapping

## Scope
This mapping aligns SystemAdmin user lifecycle actions in the mockup with the phase-1 OpenAPI contract direction from the latest plans.

Source plans:
- docs/plans/2026-07-03-001-feat-openapi-postgresql-architecture-plan.md
- docs/plans/2026-07-03-002-feat-system-admin-user-management-plan.md
- docs/plans/2026-07-03-007-feat-persist-mock-data-plan.md

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
| S1-player-list.html | Team-scoped player list | List players | GET /v1/players?teamName=&query= | 200 OK with filtered players | 400 validation_error |
| S1-player-list.html | Add player with explicit create confirm | Create player or assign existing | POST /v1/players | 201 created for confirmed no-match, 200 for strict move assign | 400 validation_error, 409 conflict |
| S1-player-list.html | Preview create-on-no-match | Preview create | POST /v1/players/preview-create | 200 OK with normalized name preview and duplicate marker | 400 validation_error |
| S1-player-list.html | Duplicate quick action | Assign existing player | POST /v1/players/{playerId}/assign | 200 OK with move/no-op state | 400 validation_error, 404 not_found |
| S2-player-dashboard.html | Load player development dashboard | Get player development dashboard | GET /v1/players/dashboard?playerName=&actorEmail= | 200 OK with growth status, match/performance stats, and per-metric (Current Level, Fitness, Skill Progress) change indicators | 403 forbidden, 404 not_found |

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

## Authorization rules
- SystemAdmin role is required for all S7 user-management operations.
- Coach role receives forbidden responses for all write operations in this screen.
- Mockup coach-view toggle represents a forbidden-path simulation and should map to 403 in API integration tests.
- Coach role cannot execute team coach reassignment actions in Team Management.
- SystemAdmin team create/reassign operations must only accept active Coach users as lead coach targets.
- Team create and team-reassign actor identity is derived from authenticated session context first (session user is source-of-truth).
- Direct navigation without a valid authenticated session must be treated as unauthenticated and return 403 for protected writes.

## Session entry behavior
- S0 login provides authenticated entry for both Coach and SystemAdmin paths.
- Quick admin entry in mockup must perform real login semantics (session established) before redirecting to admin screen.

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

## Test traceability
- Contract: apps/api/tests/contract/openapi.user-admin.spec.ts
- Contract: apps/api/tests/contract/openapi.players.spec.ts
- API integration: apps/api/tests/integration/users/user-admin.api.spec.ts
- API integration: apps/api/tests/integration/players/players-api.spec.ts
- UI integration: tests/playwright/s1-player-list.spec.js
- UI integration: tests/playwright/s2-player-dashboard.spec.js
- BDD: tests/bdd/features/player-source-of-record-and-confirmed-create.feature
- BDD: tests/bdd/features/coach-player-development-dashboard.feature
- Schema/migration: apps/api/tests/integration/db/schema-bootstrap.spec.ts
- RBAC regression: apps/api/tests/integration/users/user-admin-rbac-regression.spec.ts
