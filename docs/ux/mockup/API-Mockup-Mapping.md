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
- docs/plans/2026-07-06-010-feat-s8-manage-skills-per-position-plan.md
- docs/plans/2026-07-07-012-feat-s3-team-sport-and-s5-player-position-plan.md
- docs/plans/2026-07-08-015-feat-s2-s5-player-skill-ratings-plan.md

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
| S1-player-list.html | Team-scoped player list | List players | GET /v1/players?teamName=&query=&actorEmail=&onlyMine= | 200 OK with filtered players (each entry includes `avatarUrl`; null when no avatar uploaded; Feature 038 also includes `anySkillRatings` — Any Position skills with `abbreviation` + `rating` for the card strip; Feature 040 also includes `skillRatingsById` — sport-linked skill ratings map for Advanced Filter sort). When `actorEmail` resolves to an active Coach, the list is **always** club-scoped via `coach_clubs`. When `onlyMine=true`, further narrow to teams the coach leads (`lead_coach_user_id`). SystemAdmin actors always see the full roster regardless of `onlyMine` | 400 validation_error |
| S1-player-list.html | Add player with explicit create confirm | Create player or assign existing | POST /v1/players | 201 created for confirmed no-match, 200 for strict move assign | 400 validation_error, 409 conflict |
| S1-player-list.html | Preview create-on-no-match | Preview create | POST /v1/players/preview-create | 200 OK with normalized name preview and duplicate marker | 400 validation_error |
| S1-player-list.html | Duplicate quick action | Assign existing player | POST /v1/players/{playerId}/assign | 200 OK with move/no-op state | 400 validation_error, 404 not_found |
| S2-player-dashboard.html | Load player development dashboard | Get player development dashboard | GET /v1/players/dashboard?playerName=&actorEmail= | 200 OK with growth status, match/performance stats, per-metric change indicators, and `skillRatings: [{ skillId, skillName, rating, positionId, positionName }]` for the player's current position. **Coach** (lead-coach scoped) or **SystemAdmin** (any player). | 403 forbidden, 404 not_found |
| S2-player-dashboard.html | Edit Player action (toolbar) | Navigation to S5 edit page | (client-side link to `S5-player-edit.html?playerId=`) | Opens S5 for the viewed player (shown even in the no-stats-yet state) | n/a |
| S2-player-dashboard.html | Share link (toolbar) | Create / revoke guest share | POST /v1/players/{playerId}/share ; DELETE /v1/players/{playerId}/share ; GET status | 200 with one-time `{ token, url }` (hash stored); replace-on-create; Coach lead-coach or SystemAdmin | 403 forbidden, 404 not_found |
| S2-player-dashboard.html | Guest open `?share=` | Guest read-only dashboard | GET /v1/share/{token}/dashboard ; GET /v1/share/{token}/clips ; GET /v1/share/{token}/clips/{id}/media | 200 dashboard + clips for bound player only; Video Assessments Play uses share media URL; **View Results** active → S6 with `share=`; other write CTAs visible but inert | 404 not_found (unknown/revoked/mismatch) |
| S6-assessment-list.html | Guest open `?share=` | Guest read-only assessment list | GET /v1/share/{token}/dashboard ; GET /v1/share/{token}/clips ; share media + thumbnail | Bound player clips only; Pre-Selected/team locked; play via share URLs; Back → S2 with `share=`; nav inert | 404 → guest-share-unavailable notice |
| S2-player-dashboard.html | Upload player avatar (click icon) | Upload avatar | PATCH /v1/players/{playerId}?actorEmail= with `{ avatarUrl }` | 200 OK with updated `{ player, stats }`; `player.avatarUrl` set | 400 validation_error, 403 forbidden, 404 not_found |
| S5-player-edit.html | Load editable player profile | Get player profile | GET /v1/players/{playerId}/profile?actorEmail= | 200 OK with `{ player, stats, skillRatings }` (full editable identity + `PlayerDashboardStats` + position-scoped skill ratings) | 403 forbidden, 404 not_found |
| S5-player-edit.html | Save Player | Update full player profile | PATCH /v1/players/{playerId}?actorEmail= | 200 OK with updated `{ player, stats, skillRatings }`; when `position` changes, server replaces all `player_skill_ratings` rows for the new position as null; `missingDataMessage` cleared only when at least one Development Progress rating is recorded | 400 validation_error, 403 forbidden, 404 not_found, 409 conflict |
| S5-player-edit.html | Save Player (skill ratings) | Update player skill ratings | PUT /v1/players/{playerId}/skill-ratings?actorEmail= | 200 OK with `{ skillRatings }` after partial upsert/delete of listed skills | 400 validation_error, 403 forbidden, 404 not_found |
| S2-player-dashboard.html / S5-player-edit.html | Read skill ratings only | List player skill ratings | GET /v1/players/{playerId}/skill-ratings?actorEmail= | 200 OK with `{ skillRatings }` for the player's current position (null ratings included) | 403 forbidden, 404 not_found |
| S2-player-dashboard.html | Change History section | List player data audits | GET /v1/players/{playerId}/audits?actorEmail= | 200 OK with `{ audits }` (profile / team / skill changes; Coach scoped or SystemAdmin). Hidden for guest share. | 403 forbidden |
| S8-skills.html | Add Sport modal submit | Create sport | POST /v1/sports | 201 Created with sanitized sport object (`status: 'active'`) | 400 validation_error, 403 forbidden, 409 conflict |
|| S8-skills.html | Rename Sport modal submit | Update sport | PATCH /v1/sports/{sportId} | 200 OK with updated sport | 400 validation_error, 403 forbidden, 404 not_found, 409 conflict |
|| S8-skills.html | Sport Deactivate / Reactivate action | Set sport status | PATCH /v1/sports/{sportId}/status | 200 OK with updated status | 400 validation_error, 403 forbidden, 404 not_found |
|| S8-skills.html | Add Position modal submit | Create position | POST /v1/positions | 201 Created with new position (requires `sportId`) | 400 validation_error, 403 forbidden, 404 not_found, 409 conflict |
|| S8-skills.html | Rename Position modal submit | Update position | PATCH /v1/positions/{positionId} | 200 OK with updated position | 400 validation_error, 403 forbidden, 404 not_found, 409 conflict |
|| S8-skills.html | Position Deactivate / Reactivate action | Set position status | PATCH /v1/positions/{positionId}/status | 200 OK with updated status | 400 validation_error, 403 forbidden, 404 not_found |
|| S8-skills.html | Add Skill modal submit | Create skill | POST /v1/skills | 201 Created with sanitized skill object (`status: 'active'`) | 400 validation_error, 403 forbidden, 409 conflict |
|| S8-skills.html | Rename Skill modal submit | Update skill | PATCH /v1/skills/{skillId} | 200 OK with updated skill | 400 validation_error, 403 forbidden, 404 not_found, 409 conflict |
|| S8-skills.html | Delete Skill action | Delete skill | DELETE /v1/skills/{skillId} | 204 No Content when no `position_skills` row references the skill | 403 forbidden, 404 not_found, 409 conflict (when assignments exist) |
|| S8-skills.html | Assign Skills picker save (per newly-checked skill) | Assign skill to position (idempotent) | POST /v1/positions/{positionId}/skills | 201 Created on first add, 200 OK on idempotent re-add | 400 validation_error, 403 forbidden, 404 not_found, 409 conflict |
|| S8-skills.html | Position Skills row `Remove` action | Remove skill from position | DELETE /v1/positions/{positionId}/skills/{skillId} | 204 No Content on success | 403 forbidden, 404 not_found |

Player persistence mode notes:
- S1 runs backend mode by default (`window.__USE_BACKEND__ = true`) so create/assign operations target `/api/v1/players*`.
- Local-only persistence is allowed for offline regression runs only when `window.__USE_MOCK_LOCAL__ = true` is explicitly set.
- S2's dashboard read falls back to `mockup-api-client.js`'s offline/local snapshot whenever the backend is unavailable or `DATABASE_URL` is unset, which is the case in CI. The fallback always returns the same JSON shape as the backend (same keys under `stats`/`metrics`); for the four named seed players (Messi, Ronaldo, Neymar Jr, Mbappe) it also returns the exact same metric-change values as the Postgres-backed path, and for any other player it returns the same genuine "no stats yet" shape described below (never a generic trend-based approximation borrowed from another player).

Dashboard metric-change indicators:
- `PlayerDashboardStats`/`metrics` now return `currentLevelChange`, `fitnessChange`, and `skillProgressChange` objects (`{ label, trend }`), replacing the static "Up 5%" / "Stable" / "Up 3%" markup previously hardcoded in the S2 mockup.
- `trend` is one of `improving`, `plateau`, or `declining` and drives the badge arrow/color; `label` is the human-readable delta text (e.g. "Up 5%", "Stable").
- Backed by new `player_stats` columns (`current_level_change_label`/`_trend`, `fitness_change_label`/`_trend`, `skill_progress_change_label`/`_trend`) added in `apps/api/src/db/migrations/009_player_stats_metric_change_indicators.sql`.
- All three change fields are `nullable: true` in the OpenAPI schema and return `null` (not a placeholder object) whenever the underlying player has no real stats recorded.

Player birth date + derived age (`Player.birthMonth`, `Player.birthYear`, `Player.age`):
- The `players` table carries two nullable `SMALLINT` columns (`birth_month`, `birth_year`) added in `apps/api/src/db/migrations/017_players_birth_month_year.sql`. Both null = no birth date known. **Year-only** (`birth_year` set, `birth_month` null) is allowed; **month-only** is a `400 validation_error` (`Birth month cannot be set without a birth year.`). `birthMonth` is bounded 1-12, `birthYear` 1960-current year (CHECK constraints + OpenAPI `minimum`/`maximum`).
- `Player` (in every read path: `GET /v1/players`, `GET /v1/players/dashboard`, `GET /v1/players/{playerId}/profile`, and the `CreateOrAssignResponse.player` shape) now exposes `birthMonth`, `birthYear`, and a derived `age` (integer or null). `age` is `readOnly` in the OpenAPI schema and is computed at read time in `toPlayerPayload` / `toDashboardPayload` (server) and `enrichPlayerWithAge` / `computeAge` (offline/local). When `birthMonth` is null and `birthYear` is set, age assumes **January 1** of that year.
- The S2 dashboard meta line renders `Position • Age N` when `age` is non-null, and just the position when it is null. The S1 inline add-player panel prefills Birth Year from the selected team’s Age Group (`currentYear − digits(ageGroup)`); Birth month may stay unset. The S5 edit form accepts the same year-only rule.
- `CreatePlayerRequest` (POST `/v1/players`) and `UpdatePlayerProfileRequest` (PATCH `/v1/players/{playerId}`) both accept the same fields. Both `scripts/serve-mockup.js` (`parseBirthFields`) and the offline client mirror enforce the same rule; the offline dashboard reads the same `age` value the backend would surface.
- **S4 Skill Focus** — optional checkboxes are built from `GET /v1/players/{playerId}/skill-ratings` (same Any Position + role `position_skills` union as S2 Skill Ratings). Checkbox values are skill **names**; the list refreshes when the selected player changes.

Dashboard "no stats yet" contract (player found, but `player_stats` has no real data):
- `missingDataMessage` (surfaced at `data.performance.missingDataMessage`, mirrored onto `PlayerDashboardStats.missingDataMessage`) is the single authoritative signal that this player has no genuinely recorded growth/performance stats yet. On S2 it hides **Development Progress**, **Match Time History**, and **Recent Performance**, and shows a single notice next to the player identity card (name, team, position, trend badge remain visible).
- **Video Assessments exception:** that section is **not** hidden solely because of `missingDataMessage`. S2 loads live clips via `MockupApi.listClips({ playerId })` (same source as S6 / `GET /v1/clips?playerId=`). When at least one clip exists (any status), Video Assessments stays visible and lists each clip with an S6-style status badge. When there are no live clips, Video Assessments stays hidden in the no-stats state. Do not gate this on cached `dashboard.clipStats` / `player_stats.clip_*_count`.
- **Skill Ratings exception:** that section is **not** hidden solely because of `missingDataMessage` when at least one skill has a non-null rating (coach-entered or video-synced into `player_skill_ratings`). With no recorded ratings, Skill Ratings stays hidden in the no-stats state.
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
- Clips carry `comments` (LLM video observation on successful assessment; on failure the same text as `error_message`). `GET /api/v1/clips` and upload responses include `comments`. S6 assessment cards render `comments` **above** the rating row when present.
- **S6 score display** — clip `score` is a 0–1 fraction from video processing. S6 shows it as a **0%–100%** label; the star is bright only when percent **> 80** (otherwise muted/gray). Missing scores show **N/A**.
- **S6 card skills + Back** — complete cards list assessment skills from `skillFocus` ∪ `skillRatings` keys, each as percent or **N/A**. The card action that returns to S2 is labeled **Back** (S2’s deep-link into S6 remains **View Results**).
- **S2 → S6 View Results** — the Video Assessments **View Results** control deep-links to `S6-assessment-list.html?playerId=&playerName=&teamName=` for the dashboard player. Guest S2 also appends `share=<token>`; guest S6 loads via share-scoped clip/media APIs and locks Pre-Selected/team. S6 shows a toggleable **Pre-Selected Player** checkbox (`[data-testid="preselected-player-filter"]`) that defaults **ON** when those params are present (OFF / hidden when opening S6 without player context; always on+locked for guests). Team defaults to the player's `teamName` when it appears in the allowed team list. Coaches load teams via `GET /v1/teams?actorEmail=` (club-scoped); **All Teams** means all teams in the coach's club(s). SystemAdmin keeps a broader team list. `GET /v1/clips` accepts optional `playerId` / `playerName` in addition to `teamName` and `status`.
- **S1 → S6 video icon** — each S1 `.player-card` shows `[data-testid="player-card-video-link"]` in the **top-right action cluster** (with the trend arrow; video farthest right) **only when** live `MockupApi.listClips` (optionally team-scoped) includes ≥1 clip for that `playerId` (any status; not `clipStats`). Click uses the same S6 query params as S2 View Results and must not open S2.

## S1 player card redesign (Feature 038)

Source plan: `docs/plans/2026-07-13-007-feat-s1-player-card-redesign-plan.md`.

### UI

- Entire `.player-card` opens S2 (`?player=` name); **View** button removed; “Updated …” meta removed.
- Top-right: trend arrow-only (green ↗ / yellow ↘ / gray →) + optional video link farthest right.
- Bottom two lines: Any Position skill abbreviations + percent ratings (`—` when unrated).

### API

- `GET /v1/players` includes `anySkillRatings: [{ skillId, skillName, abbreviation, rating }]` for the player’s sport Any Position skills.

### Test traceability

- `tests/playwright/s1-player-list.spec.js`
- `apps/api/tests/integration/players/players-list-scoping.spec.ts` (listPlayers body still scopes; enrichment helper present in serve-mockup)

## S1 overall Any-position rating (Feature 039)

Source plan: `docs/plans/2026-07-13-008-feat-s1-overall-any-rating-plan.md`.

### UI

- On the team-chip row, far right: unlabeled bright yellow overall rating (`[data-testid="player-card-overall-rating"]`).
- Value = `Math.round` average of `anySkillRatings` entries with numeric rating **> 0**; otherwise `—`. `aria-label`/`title` may say “Overall rating” without visible label text.

### Test traceability

- `tests/playwright/s1-player-list.spec.js`

## S1 Advanced Filter (Feature 040)

Source plan: `docs/plans/2026-07-13-009-feat-s1-advanced-filter-plan.md`.

### UI

- Coach / SystemAdmin only: toolbar **Advanced Filter** (`[data-testid="advanced-filter-toggle"]`) opens Filter by Position|Skill, value select, Sort by Highest|Lowest (default Highest).
- Position mode: exact roster `position` match + sort by Feature 039 overall.
- Skill mode: sort by `skillRatingsById[skillId]`; unrated (missing/null/non-finite) last for Highest / first for Lowest; `0` is a rated key.
- Layers on team / search / Only Mine; Clear restores name ASC for the visibility set.
- Skill value options load via union of `GET /v1/positions/{id}/skills` across the sport’s active positions (catalog read; not SystemAdmin-gated).

### API

- `GET /v1/players` also includes `skillRatingsById: { [skillId]: number|null }` for skills linked to any position of the player’s team sport (offline `listPlayers` mirrors).

### Test traceability

- `tests/playwright/s1-player-list.spec.js`

---

## Prior S1 notes (unchanged)

- **S6 play / media** — `GET /v1/clips` includes original `path` and `segments: [{ index, path }]`. S6 card play (`[data-testid="clip-play-button"]`) opens a modal player and sets `<video src>` to `GET /api/v1/clips/{clipId}/media?source=first|original` (first segment when any exist; otherwise original). The media route resolves the file from the DB only, rejects paths outside `VANTAGEIQ_VIDEO_ROOT` / `c:/vantageiq_videos`, and streams `video/mp4` (Range supported). If neither source is available, the modal shows an unavailable notice.
- **S6 thumbnails** — on successful process-clip, a JPEG poster is written to `{videoRoot}/thumbnails/{clipId}.jpg` from the first segment (else original). S6 cards load `GET /api/v1/clips/{clipId}/thumbnail` into `[data-testid="clip-thumbnail"]` inside `.result-thumbnail`; `onerror` removes the img so the emoji/gradient placeholder remains. Offline seed keeps the placeholder (no binary images).
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
- `POST /v1/teams/:teamId/update` body `{ name?, ageGroup?, coachEmail, clubId, status, sportId?, actorRole, actorEmail }`. Atomic transaction (BEGIN/UPDATE teams/UPSERT coach_clubs/COMMIT). Returns the refreshed `Team` payload with `status`.
    - Optional `name` / `ageGroup`: when omitted, current values are preserved (compat). When sent, name is title-cased (min length 2) and age group is required non-empty; duplicate team name → `409 conflict` (`A team with this name already exists.`).
    - Coach / ClubAdmin: must hold a `coach_clubs` row for the team's current club AND the new club. Violation → `403 forbidden_scope`.
    - `status` must be `active` or `inactive`. Unknown team → `404 not_found`. Unknown coach/club → `400 validation_error`.

### Client

- `MockupApi.updateTeamCoachAndClub(teamId, payload)` — online wraps `POST /v1/teams/:teamId/update`; offline/local writes through to `vantageiq_mockup_v2` with the same role-scoping guard. Offline rename cascades `player.teamName` for players on the previous name.
- `MockupApi.listTeamSummary` and `MockupApi.getTeamById(teamId)` expose `status`.
- Seeded offline teams carry `status: 'active'` from `createSeed()`; older local stores fall back to `active` on read (`team.status || 'active'`).
- S3a Edit form (`#updateNameInput`, `#updateAgeGroupInput`) always submits name and age group alongside coach/club/status/sport.

### Roles

- **SystemAdmin** can edit any team's coach, club, status, sport, name, and age group. Club dropdown lists every club.
- **Coach** / **ClubAdmin** can edit teams in their own clubs (`coach_clubs`). Club dropdown is pre-narrowed; the server enforces the same guard.

See `docs/plans/2026-07-06-007-feat-team-update-screen-plan.md` and `docs/plans/2026-07-14-002-feat-s3a-full-team-update-fields-plan.md`.

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
- UI integration: tests/playwright/s8-skills.spec.js
- UI integration: tests/playwright/team-sport.spec.js
- UI integration: tests/playwright/s5-position.spec.js
- UI integration: tests/playwright/s1-add-player-position.spec.js
- Contract: apps/api/tests/contract/openapi.skills-admin.spec.ts
- Schema/migration: apps/api/tests/integration/db/skills-migration.spec.ts
- API integration: apps/api/tests/integration/skills/skills-api-mockup.spec.ts
- API integration: apps/api/tests/integration/skills/mockup-api-client.spec.ts
- React unit: apps/web/tests/unit/features/admin-skills/skills-page.spec.tsx
- React integration: apps/web/tests/integration/admin-skills/skill-lifecycle-flow.spec.tsx
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

## Skills Admin (S8) + per-position skill catalog

- Four new tables (`sports`, `positions`, `skills`, `position_skills`) land via `apps/api/src/db/migrations/015_skills_positions_sports.sql` (idempotent via `IF NOT EXISTS` and `ON CONFLICT DO NOTHING`). The migration is mirrored into `apps/api/src/db/schema/tables.sql` and `apps/api/src/db/schema/deploy.sql` so a fresh database (`scripts/db-bootstrap.js`) gets the catalog without re-running the migration.
- The `position_skills` table has a composite primary key `(position_id, skill_id)` plus a supporting index `idx_position_skills_skill_id` for the per-skill reverse lookup ("which positions is this skill in?"). Both FKs use `ON DELETE RESTRICT` so deleting a skill or position with assignments is blocked by the database — the API surfaces `409 conflict` (see below) before it ever reaches the FK violation.
- All Skills-Admin write endpoints (`POST /v1/sports`, `PATCH /v1/sports/{id}`, `PATCH /v1/sports/{id}/status`, `POST /v1/positions`, `PATCH /v1/positions/{id}`, `PATCH /v1/positions/{id}/status`, `POST /v1/skills`, `PATCH /v1/skills/{id}`, `DELETE /v1/skills/{id}`, `POST /v1/positions/{id}/skills`, `DELETE /v1/positions/{id}/skills/{skillId}`) are SystemAdmin-gated using the existing `resolveSystemAdminActor(payload.actorEmail)` + `assertSystemAdminActor(actor)` pattern from `scripts/serve-mockup.js`. Coach tokens receive `403 forbidden` for every write. Catalog **reads** (`GET /v1/sports`, `GET /v1/positions?sportId=`, `GET /v1/skills`, `GET /v1/positions/{id}/skills`) are open (Feature 040 Skill filter depends on ungated position-skill reads); mutation endpoints remain SystemAdmin-only.
- `POST /v1/positions/{positionId}/skills` is idempotent: it upserts the `position_skills` row and returns `201 Created` on first add and `200 OK` on a re-add, mirroring the S7a user-club pattern. The seed uses `ON CONFLICT DO NOTHING` on the same composite key. The picker modal fires one POST per newly-checked skill; uncheck fires one `DELETE /v1/positions/{positionId}/skills/{skillId}` per previously-assigned skill — there is no bulk-replace verb.
- `DELETE /v1/skills/{skillId}` is a soft-preconditioned hard-delete: the API checks for any `position_skills` row referencing the skill and returns `409 conflict` with message `'Cannot delete skill '<name>' because it is assigned to N position(s). Remove the assignments first.'` when assignments exist. The admin must remove the assignments first; once the row is unassigned, the hard `DELETE` returns `204 No Content`. Sports and positions are never hard-deleted — they use the `status: 'active' | 'inactive'` soft-disable shape matching `clubs`.
- The seed dataset on a fresh database is: 1 sport (`Soccer`), 13 positions (12 named Soccer positions plus the `Any Position` wildcard), 31 skills in the flat catalog, and 65 `position_skills` rows (5 skills per position). Seed counts and ID list per `docs/plans/2026-07-06-010-feat-s8-manage-skills-per-position-plan.md` § Seed Data. The migration uses `INSERT ... ON CONFLICT DO NOTHING` on every seed row keyed by natural name (`sports.name`, `(sport_id, name)`, `skills.name`), so re-running the migration is a no-op.
- `S8-skills.html` is reached via a new bottom-nav entry `🧠 Skills` with `data-role-visible-to="SystemAdmin"` and `data-testid="nav-skills"`, shipped `hidden` so coaches never see it before `MockupApi.applyRoleGatedNav` runs. The nav item mirrors the existing `data-testid="nav-clubs"` + `data-testid="nav-users"` pattern.
- Direct navigation to `S8-skills.html` while `MockupApi.getCurrentUser()` returns null OR `actorRole !== 'SystemAdmin'` renders the `403 forbidden` notice (`#roleNotice`) instead of the four admin panels. The page is built as four stacked panels (Sports → Positions → Skills → Position Skills) with KPI cards (`# Sports`, `# Active Positions`, `# Skills`, `# Assignments`) live-updated after every successful mutation.
- Mockup API client (`docs/ux/mockup/js/mockup-api-client.js`) keeps the offline store in lockstep: `sports`, `positions`, `skills`, and `positionSkills` keys are added to `createSeed`, and the new 12 methods (`listSports`, `createSport`, `updateSport`, `setSportStatus`, `listPositions`, `createPosition`, `updatePosition`, `setPositionStatus`, `listSkills`, `createSkill`, `updateSkill`, `deleteSkill`, `listPositionSkills`, `assignSkillToPosition`, `removeSkillFromPosition`) cover the same CRUD + assignment surface as the backend handlers. `assignSkillToPosition` returns the `200/201` status split; `deleteSkill` returns `204` or `409`.

## Club Admin role (2026-07-14-001)

- Third role `ClubAdmin` (seed `rita@vantageiq.club`) on `coach_clubs` like Coach.
- Club-scoped players/teams/clubs lists; no Only My Players lead narrowing.
- Users nav: `data-role-visible-to="SystemAdmin,ClubAdmin"`; Clubs/Skills remain SystemAdmin-only.
- User writes resolve `actorEmail`; Club Admin may manage Coach users in shared clubs only.
- Team create/update allow `ClubAdmin` with club membership checks.

## S1 Coach Scoping + Clubs Main Menu (2026-07-06-009)

### API

- `GET /v1/players` accepts two new query parameters:
  - `actorEmail` (string, optional): when the email resolves to an active user, that user's role drives the scoping decision.
  - `onlyMine` (boolean, optional, default `false`): for an active Coach, further narrow club-scoped results to teams the coach leads. Ignored for SystemAdmin.
- Coach scoping rule: when `actorEmail` resolves to an active Coach, the response is **always** narrowed via `teams.club_id IN (SELECT club_id FROM coach_clubs WHERE user_id = $actor)`. When `onlyMine=true`, also require `teams.lead_coach_user_id = $actor`. SystemAdmin actors and unknown/missing actors receive the full roster regardless of `onlyMine`.

### Client

- `MockupApi.listPlayers(options)` accepts `actorEmail` and `onlyMine` in `options`. In backend mode both fields are forwarded as query parameters. In offline mode the same rule is mirrored: active Coaches are always club-scoped; `onlyMine` further filters to lead-coach teams.
- `MockupApi.getCurrentUser()` and `MockupApi.applyRoleGatedNav(currentUser)` are the new entry points used by every mockup page:
  - `applyRoleGatedNav` walks every `[data-role-visible-to]` element and toggles `hidden` + `display: none` based on the current user's role and `status === 'active'`.
  - The Clubs and Users nav items carry `data-role-visible-to="SystemAdmin"` so coaches never see admin-only chrome.

### UI

- `S1-player-list.html` gains a Coach-only "Only My Players" checkbox in the toolbar. It is `hidden` and unchecked by default; for active Coach actors it is `hidden=false` and `checked=true`. Unchecking it keeps club scoping and expands from lead teams to all teams in the coach's clubs. The checkbox is shipped `hidden` in markup so coaches never see a flash of admin-only chrome before JS hydrates the role.
- `S1-player-list.html` reads `actorEmail` and `onlyMine` from the actor context on every call to `MockupApi.listPlayers`. The status banner switches between "Showing X players on teams you lead." (Coach + Only My Players ON), "Showing X players in your clubs." (Coach + OFF), and the existing team-specific / admin full-roster strings.
- Every bottom-nav page (`S1`, `S2`, `S3`, `S3a`, `S4`, `S5`, `S6`, `S7`, `S7a`) now carries a `Clubs` nav entry gated to `SystemAdmin`. The entry links to `S7a-clubs.html` and is shipped `hidden` so coaches never see it before `MockupApi.applyRoleGatedNav` runs.
### Player-Club Invariant

- Every player is reachable only via a team, and every team must belong to a club. The team-create path (`POST /v1/teams`) rejects requests without a non-empty `clubId` with a `400 validation_error` ("Please select a club for this team."), and Coach actors without an explicit `clubId` fall back to their first `coach_clubs` row in creation order. If neither is resolvable, the response is also `400`.
- `apps/api/tests/contract/openapi.players.spec.ts` (Player-club invariant block) locks the rejection text and the `coach_clubs` fallback path on the serve-mockup side, so a future refactor cannot silently relax the invariant.

## S3 Team Sport + S5 / S1 Sport-Filtered Position Dropdown (2026-07-07-012)

### Schema

- `apps/api/src/db/migrations/016_teams_sport.sql` adds a NOT NULL `teams.sport_id TEXT REFERENCES sports(id) ON DELETE RESTRICT` column with `DEFAULT 'sport_soccer'`. Every existing team backfills to `sport_soccer` (the only seeded sport, from migration `015_skills_positions_sports.sql`) before the column is locked `NOT NULL`. The DDL is mirrored into `apps/api/src/db/schema/tables.sql` and `apps/api/src/db/schema/deploy.sql` so fresh databases pick it up without re-running the migration.
- `apps/api/tests/integration/db/teams-sport-migration.spec.ts` locks the migration file contents (FK + backfill + NOT NULL ordering + default + supporting index) and the mirrored DDL in `tables.sql` / `deploy.sql`.

### API

- `POST /api/v1/teams` accepts `sportId` in the body. Omitted → defaults to `sport_soccer`. Unknown or inactive `sportId` → `400 validation_error`. The handler validates against `SELECT id FROM sports WHERE id = $1 AND status = 'active'` before persisting; `toTeamPayload` returns `sportId` and `sportName` (LEFT JOIN sports) on every create/list response.
- `POST /api/v1/teams/:id/update` accepts `sportId`; the same validation runs and the persisted `sportId` reflects the new value. A request that omits `sportId` preserves the team's current sport.
- `GET /api/v1/teams` and `GET /api/v1/clubs/:clubId/teams` include `sportId` and `sportName` on every row via `LEFT JOIN sports s ON s.id = t.sport_id`.
- `POST /api/v1/players` accepts an optional `position` field. When set, the handler validates the value against `positions` filtered by the target team's `sport_id` and `status = 'active'`; a name that does not match an active position for the team's sport falls back to `'Position not set'` so a malicious or stale UI value cannot poison the row.
- `apps/api/tests/integration/teams/teams-sport-api-mockup.spec.ts` and `apps/api/tests/integration/teams/mockup-api-client.spec.ts` lock the handler body shapes and the `MockupApi.createTeam` / `MockupApi.updateTeamCoachAndClub` / `MockupApi.listTeamSummary` client shape changes.

### Client

- `MockupApi.listSports(actorRole, actorEmail, statusFilter)` and `MockupApi.listPositions(actorRole, actorEmail, sportId, statusFilter)` are reused from feature 010 unchanged. The `sports` and `positions` keys in `createSeed()` ship with every seeded team on `sport_soccer`.
- `MockupApi.createTeam` forwards `sportId` in both backend (`POST /v1/teams` body) and offline modes; offline-created rows persist `sportId` + `sportName` via a `resolvedSport` lookup that falls back to `sport_soccer` / `Soccer` when the requested sport is missing.
- `MockupApi.updateTeamCoachAndClub` carries `sportId` through both modes. Offline branch updates the team's `sportId` / `sportName` only when the requested sport exists in the offline store; unknown sport → `400 validation_error` (`'The selected sport could not be found.'`).
- `MockupApi.listTeamSummary` exposes `sportId` and `sportName` on every team row (backend LEFT JOIN or offline `store.sports` lookup), so S3 can render the column without a second lookup.
- `MockupApi.addPlayerFlow` accepts an optional `position` in the payload, forwards it on backend `POST /v1/players`, and persists it offline only when it matches an active position for the target team's sport. Mismatched values fall back to `'Position not set'` (server-side enforcement already happens in `serve-mockup.js`).

### UI

- **S3** (`docs/ux/mockup/S3-team-management.html`) gains a `Sport` `<select>` (`#teamSportSelect`, `[data-testid="team-sport-select"]`) inside the Create Team modal, sourced from `MockupApi.listSports(...)` with `sport_soccer` preselected. The teams table gains a `Sport` column between `Age Group` and `Players`, rendered from `team.sportName` with a `data-testid="row-sport"` cell for spec hooks. The Create Team submit handler forwards `sportId` to `MockupApi.createTeam`.
- **S3a** (`docs/ux/mockup/S3a-team-update.html`) gains a `Sport` `<select>` (`#updateSportSelect`, `[data-testid="update-sport-select"]`) on the update form, sourced from `MockupApi.listSports(...)` with the team's current sport preselected. The `Current Snapshot` panel grows a `Sport` row rendered from `team.sportName`. The submit handler forwards `sportId` to `MockupApi.updateTeamCoachAndClub`; omitting it preserves the team's current sport.
- **S5** (`docs/ux/mockup/S5-player-edit.html`) replaces the free-text `#fieldPosition` with a sport-filtered `<select>` (`[data-testid="field-position"]`) sourced from `MockupApi.listPositions(...)` against the **team's** sport (resolved from `MockupApi.listTeams()` → `team.sportId`). A `#fieldPositionEmpty` helper notice is shown — *"No positions are defined for this team's sport yet. Add them in Manage Skills (S8)."* — and the select is `disabled` whenever the resolved list is empty. Changing `#fieldTeam` reloads the position dropdown against the new team's sport and preserves the prior value only when it still exists in the new options; otherwise it falls back to the seeded `Any Position` (the wildcard for the team's sport) or the first available position. The submit handler writes `position: <option value>` (the position **name**) into the PATCH payload, since `players.position` remains `TEXT NOT NULL` in v1.
- **S1** (`docs/ux/mockup/S1-player-list.html`) grows a `Position` `<select>` (`#addPlayerPosition`, `[data-testid="add-player-position"]`) inside the `addPlayerPanel`, sourced from `MockupApi.listPositions(...)` against the **team filter's** sport. The default first option is `Position not set` so existing flows that don't care about position still work. Changing `#teamFilter` reloads the dropdown; the helper notice is shown when the team has no positions for its sport. The submit handler forwards `position` to `MockupApi.addPlayerFlow`, which writes it on the new player row.
- **Bulk Assign Players flow** — the plan's §5.6 mentions a per-row position `<select>` for a bulk-assign table that does not yet exist as UI in S1 (the only current "assign existing player" path is the inline `#duplicateAction` quick action, which does not write a position). The per-row bulk-assign dropdown is deferred to a future feature; today's inline assign preserves the existing player's position by design.

### Acceptance

- Every UI that writes `players.position` (S5 edit, S1 create) uses a sport-filtered `<select>` sourced from `MockupApi.listPositions(...)`. There is no free-text position input left in the mockup.
- Switching the team's sport reloads every position dropdown against the new sport without page reload (handled on `#fieldTeam` / `#teamFilter` change handlers).
- When the team's sport has no positions, the dropdown is disabled and a helper notice tells the coach to add positions in S8.
- See `docs/plans/2026-07-07-012-feat-s3-team-sport-and-s5-player-position-plan.md` for full requirements, schema design, and rollback notes.

## Player Skill Ratings (S2/S5)

Source plans:
- `docs/plans/2026-07-08-015-feat-s2-s5-player-skill-ratings-plan.md`
- `docs/plans/2026-07-08-016-feat-any-position-baseline-skill-ratings-plan.md`

### Schema

- Migration `apps/api/src/db/migrations/018_player_skill_ratings.sql` adds `player_skill_ratings (player_id, skill_id, rating, created_at, updated_at)` with `PRIMARY KEY (player_id, skill_id)`, `rating SMALLINT NULL OR 0–100`, `ON DELETE CASCADE` from players, `ON DELETE RESTRICT` from skills. Mirrored in `tables.sql` / `deploy.sql`.
- No seed rows: every player starts unrated. Skills in scope are the sport's **Any Position** `position_skills`, plus role-unique skills when the player is assigned to a non–Any Position role (overlaps appear only under Any Position).

### API

- `GET /v1/players/dashboard` and `GET /v1/players/{playerId}/profile` return additive `skillRatings: [{ skillId, skillName, rating, positionId, positionName }]` (Any first, then role-unique).
- `GET /v1/players/{playerId}/skill-ratings` returns the same array alone.
- `PUT /v1/players/{playerId}/skill-ratings` accepts `{ ratings: [{ skillId, rating }] }` (partial replace). `rating: null` deletes the row; skills outside the Any∪role-unique set return `400 validation_error` with the S8 guidance message.
- `PATCH /v1/players/{playerId}` on position change **preserves** Any Position skill ratings, deletes other ratings, and inserts null rows for new role-unique skills.

### Client

- `MockupApi.listPlayerSkillRatings(playerId)` / `MockupApi.updatePlayerSkillRatings(playerId, payload)` dual-mode (backend + offline `store.playerSkillRatings`).
- Offline seed includes `playerSkillRatings: []`; `loadStore()` requires the array or reseeds.
- Offline list/replace mirrors the Any∪role-unique and preserve-Any rules.

### UI

- **S2** — `[data-testid="skill-ratings-section"]` before Development Progress with `[data-testid="skill-ratings-any-section"]` first and optional `[data-testid="skill-ratings-role-section"]` second; empty helper only when no team/sport baseline exists.
- **S2 collapsible sections** — each stats block title (`Skill Ratings`, `Development Progress`, `Match Time History`, `Recent Performance`, `Video Assessments`) is a `[data-testid="dashboard-section-toggle-*"]` button that toggles `is-collapsed` on the parent `.stats-section` (body hidden via `.section-body`). Default **collapsed** on first visit; expanded/collapsed state persists per player in `localStorage` key `vantageiq_s2_dashboard_sections` (`{ [playerId]: { [sectionSlug]: true|false } }`, `true` = expanded).
- **S5** — same two subsections; per-skill `buildSliderControl` (0–100 + Record toggle); save runs profile PATCH then skill-ratings PUT (Any-only filter when position just changed so same-save baseline edits are kept).

### Test traceability

- `apps/api/tests/integration/db/player-skill-ratings-migration.spec.ts`
- `apps/api/tests/contract/openapi.players-skills.spec.ts`
- `apps/api/tests/integration/players/player-skill-ratings-api-mockup.spec.ts`
- `apps/api/tests/integration/players/mockup-api-client-skill-ratings.spec.ts`
- `apps/api/tests/integration/players/s2-s5-skill-ratings.spec.ts`
- `tests/playwright/player-skill-ratings.spec.js`

## Guest read-only share links (S2 + S6)

Source plans:
- Feature 034: `docs/plans/2026-07-13-003-feat-guest-readonly-social-share-plan.md` (S2)
- Feature 035: `docs/plans/2026-07-13-004-feat-guest-s6-share-view-plan.md` (S6 follow-on)
- Backlog: `docs/backlog/007-guest-readonly-social-share.md`

### Schema

- Migration `apps/api/src/db/migrations/023_player_share_links.sql` — `player_share_links (id, player_id, token_hash UNIQUE, created_by_user_id, created_at, revoked_at)`. Raw token never stored. Mirrored in `tables.sql` / `deploy.sql` / `ensureDatabase`.

### API

- `POST /v1/players/{playerId}/share` `{ actorEmail }` — replace-on-create; returns one-time `{ token, url, shareId, playerId }`. Coach lead-coach or SystemAdmin.
- `DELETE /v1/players/{playerId}/share` — sets `revoked_at` on active rows.
- `GET /v1/players/{playerId}/share?actorEmail=` — `{ active, shareId, createdAt }` (no token).
- Guest: `GET /v1/share/{token}/dashboard`, `/clips`, `/clips/{id}/media`, `/clips/{id}/thumbnail`. Unknown/revoked/mismatch → uniform 404.
- `GET /v1/players/dashboard` also allows SystemAdmin (any player).

### UI

- S2 toolbar Share / Revoke + copyable URL row for editors.
- Guest S2: `S2-player-dashboard.html?share=<token>` — Guest View; **View Results** active and carries `share` (+ player context) to S6; other write CTAs visible but inert; Video Assessments **Play** via share-scoped media URL.
- Guest S6: `S6-assessment-list.html?share=<token>` — lists/plays bound player only via share APIs; Pre-Selected Player + team filter locked; bottom nav / Exit inert; assessed **Back** → guest S2 with same `share`. Invalid/revoked → `[data-testid="guest-share-unavailable"]`.
- Copy/paste only — no social network buttons.
- Coach/SystemAdmin S6 without `share` unchanged (open `listClips` / coach media URLs).

### Test traceability

- `apps/api/tests/integration/players/player-share-links.spec.ts`
- `tests/playwright/s2-guest-share.spec.js` (S2 guest + Feature 035 View Results → guest S6)
- `tests/playwright/s6-guest-share.spec.js` (coach S6 without share regression)

## Player data change audit (Feature 036)

Source plan: `docs/plans/2026-07-13-005-feat-player-data-change-audit-plan.md` (backlog 008).

### Schema

- Migration `apps/api/src/db/migrations/024_player_data_audits.sql` — append-only `player_data_audits` (entity profile | team_assignment | skill_rating; actor_kind user | system; nullable actor_user_id for clip sync). Mirrored in `tables.sql` / `deploy.sql` / `ensureDatabase`.

### API / writes

- Side effect on `PATCH /v1/players/{id}`, `PUT .../skill-ratings`, and clip→skill sync upserts (diff-only).
- `GET /v1/players/{id}/audits?actorEmail=` — Coach (scoped) or SystemAdmin; newest first.

### UI

- S2 collapsible **Change History**; hidden for guest share views.

### Test traceability

- `apps/api/tests/integration/db/player-data-audits-migration.spec.ts`
- `apps/api/tests/integration/players/player-data-audits-api.spec.ts`
- `apps/api/tests/integration/video-processing/sync-player-skill-ratings-from-clip.spec.ts`
- `tests/playwright/player-data-audit.spec.js`

## Skill abbreviations (Feature 037)

Source plan: `docs/plans/2026-07-13-006-feat-skill-abbreviation-plan.md`.

### Schema

- Migration `apps/api/src/db/migrations/025_skill_abbreviation.sql` — `skills.abbreviation` (1–3 chars, NOT NULL after backfill). Duplicates allowed. Fixed backfill: Ball Control→BCN, Fitness→FIT, Game Awareness→AWR, Passing→PAS, Speed→SPD; algorithm for remaining catalog rows. Mirrored in `tables.sql` / `deploy.sql` / `ensureDatabase`.

### API / writes

- `GET/POST /v1/skills` and `PATCH /v1/skills/{id}` include `abbreviation` (required on write; coerced uppercase; suggest from name when omitted). Shared helper: `scripts/skills/suggest-abbreviation.js`.

### UI

- **S8:** Abbreviation column; Add Skill auto-suggests from name (dirty-flag preserves manual edits); Rename/Update editable abbreviation.
- **S6:** Assessed card per-skill rows show abbreviation with `title` = full skill name (catalog lookup); unknown names keep full label.

### Test traceability

- `apps/api/tests/integration/db/skills-abbreviation-migration.spec.ts`
- `apps/api/tests/integration/skills/skills-api-mockup.spec.ts`
- `apps/api/tests/integration/skills/mockup-api-client.spec.ts`
- `tests/playwright/s8-skills.spec.js`
- `tests/playwright/s6-assessment-list.spec.js`
