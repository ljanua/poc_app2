# feat: Back the S2 dashboard metric change badges with real per-player data

## Summary
The S2 player dashboard renders three "change" badges under Current Level, Fitness, and Skill Progress (e.g. "↑ Up 5%", "→ Stable", "↑ Up 3%"). These are hardcoded in the mockup markup today and are identical for every player regardless of their actual data. This plan adds a real, per-player-backed source for those three badges so every field currently defined in the S2 mockup is driven by persisted data rather than static HTML.

## Problem Frame
A review of `docs/ux/mockup/S2-player-dashboard.html` against the current schema found that nearly every visible field is already backed by a database column: player identity and trend live on `players`, and growth/match-time/performance/clip summary values live on `player_stats` (added by the most recent player-stats plan). The one remaining gap is the three metric-status badges rendered next to Current Level, Fitness, and Skill Progress — the dashboard's `<script>` block never touches these elements, so they always show the values baked into the HTML file no matter which player is loaded.

This plan closes that specific gap: it adds a persisted value and trend indicator for each of the three badges, threads it through both runtime data paths (Postgres-backed and the offline/local fallback), and binds the S2 markup to the real values.

## Origin
- docs/ux/mockup/S2-player-dashboard.html (target mockup)
- docs/plans/2026-07-04-003-feat-s2-player-dashboard-player-stats-source-of-record-plan.md (established the `player_stats` table this plan extends)
- docs/brainstorms/2026-07-01-coaches-growth-match-time-performance-requirements.md (origin requirements for the dashboard's growth/match-time/performance summary)

## Scope Decisions (confirmed with requester)
- `player_stats` remains the canonical home for dashboard summary metrics; the `players` table is not restructured to absorb stats fields. No fields were found missing from `players` itself once Age was ruled out of scope.
- Age is explicitly out of scope for this change — it stays hardcoded in the mockup and is not modeled.
- Of the remaining wiring gaps found during review (last-match score/summary binding, timeline progress bars, metric-change badges), only the metric-change badges are in scope for this plan. The Last Match card's reuse of `averageScore`/generic text and the static timeline bars are left as-is.

## Requirements Trace
- Every data-bearing field visible on S2 must be backed by a real, per-player value rather than static markup, for the fields confirmed in scope (Current Level / Fitness / Skill Progress change badges).
- The change badges must reflect the same three-state vocabulary (`improving` / `plateau` / `declining`) already used elsewhere on the dashboard, so badge styling stays consistent.
- The Postgres-backed path and the offline/local fallback path must produce equivalent shapes so the page behaves the same in both modes.
- Existing dashboard behavior (coach-only access, missing-data handling, all currently-passing sections) must not regress.

## Scope Boundaries
### In scope
- New persisted columns on `player_stats` for the three metric-change badges (label + trend per metric).
- Backfill/seed values for existing players, including the exact literal values the mockup already shows for the reference player (Messi).
- Default derivation for new players and any player without an explicit backfilled row.
- API payload changes (`scripts/serve-mockup.js`, `openapi/v1/schemas/players.yaml`) to expose the new values.
- Mockup client and S2 markup/script changes to bind the badges to real data in both backend and local-fallback modes.
- Regression coverage (schema/migration checks, API/service checks, Playwright, BDD, mapping doc).

### Deferred to follow-up work
- Computing true period-over-period deltas from historical snapshots (there is no time-series of `current_level`/`fitness`/`skill_progress` values to diff against yet).
- Fixing the Last Match card's score/summary binding.
- Making the timeline progress bars data-driven.
- Modeling Age or any other identity field on `players`.

### Out of scope
- Any restructuring of `players` vs `player_stats` table boundaries.
- Authentication/authorization changes.
- Visual redesign of the S2 layout beyond adding `id` attributes needed to bind the badges.

## Key Technical Decisions
- **Extend `player_stats`, not `players`.** The change badges are metric-shaped values that only make sense alongside a stats snapshot, matching the existing `growth_status`/`trend` pattern on the same table — consistent with the decision to keep `player_stats` as the single home for dashboard summary metrics.
- **Reuse the existing `improving` / `plateau` / `declining` enum** for each badge's trend/direction instead of introducing a new `up` / `down` / `stable` vocabulary, so one enum maps to the same CSS badge classes (`badge-improving`, `badge-plateau`, `badge-declining`) everywhere on the dashboard.
- **Store a label plus a trend per metric**, e.g. `current_level_change_label = 'Up 5%'` and `current_level_change_trend = 'improving'`, rather than a raw numeric delta — there's no baseline snapshot to compute a numeric percentage-point change from today, and the mockup only ever displays a short label string.
- **Seed deterministically, reusing the existing trend-branch pattern.** `scripts/serve-mockup.js` already has trend-based default branches (`buildDefaultDashboardStats`, `buildNewPlayerDashboardStats`, `getSeedDashboardStats`); the new fields are added to those same branches instead of a parallel lookup, and the reference player (Lionel Messi) keeps the exact literal values the mockup already renders ("Up 5%"/improving, "Stable"/plateau, "Up 3%"/improving).
- **Expose the new fields under `metrics`** in the dashboard payload (alongside `currentLevel`, `fitness`, `skillProgress`), since `metrics` is already the UI-facing shape S2 binds directly, and also mirror them in `stats` for API completeness/contract symmetry with the other stat fields.
- **Update both runtime paths together.** `scripts/serve-mockup.js` (Postgres-backed) and `docs/ux/mockup/js/mockup-api-client.js`'s `buildDashboardSnapshot` (local/offline fallback) must both emit the new fields so fallback mode doesn't regress to static badges when the backend is unavailable.

## Implementation Units

### U1. Add persisted metric-change columns to `player_stats`
**Goal:** Give each of the three dashboard badges a real, queryable value per player.

**Requirements:** persisted per-player badge data; reuse of the existing trend vocabulary; deterministic seed values.

**Dependencies:** none.

**Files:**
- apps/api/src/db/migrations/009_player_stats_metric_change_indicators.sql
- apps/api/src/db/schema/tables.sql
- apps/api/src/db/schema/deploy.sql
- apps/api/tests/integration/db/schema-bootstrap.spec.ts

**Approach:**
- Add six nullable columns to `player_stats`: `current_level_change_label`, `current_level_change_trend`, `fitness_change_label`, `fitness_change_trend`, `skill_progress_change_label`, `skill_progress_change_trend`, with each `*_trend` column constrained to `improving` / `plateau` / `declining`.
- Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` so the migration is idempotent on rerun, matching the style of `apps/api/src/db/migrations/007_mockup_clips_and_user_status.sql`.
- Backfill the four existing seeded players (`p_10`–`p_13`) with concrete values: Messi (`p_10`) gets the exact mockup values; the other three get values consistent with their existing `trend` field, following the same trend-to-badge mapping already used for `growth_status`.
- Mirror the new columns into `apps/api/src/db/schema/tables.sql` and `apps/api/src/db/schema/deploy.sql` so the one-shot deploy and canonical schema files stay in sync with the migration, matching how `player_stats` itself was added in both places by migration 008.

**Patterns to follow:**
- Idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` plus `DO $$ ... $$` guard style in apps/api/src/db/migrations/007_mockup_clips_and_user_status.sql.
- Backfill/seed shape in apps/api/src/db/migrations/008_player_stats_source_of_record.sql.

**Test scenarios:**
- Happy path: the migration file adds all six new columns with the correct trend `CHECK` constraint.
- Happy path: `tables.sql` and `deploy.sql` both declare the six new columns on `player_stats`.
- Edge case: rerunning the migration does not error or duplicate columns (idempotency via `IF NOT EXISTS`).
- Edge case: a player with no backfilled row still resolves to `NULL` values rather than a query error (verified indirectly through U2's default-branch handling).

**Verification:**
- The `player_stats` table has six new columns, backfilled for existing players, mirrored across schema files.

### U2. Serve the new fields from the Postgres-backed dashboard read path
**Goal:** Return the new badge data through `/api/v1/players/dashboard`.

**Requirements:** backend exposes real per-player badge data; new players and defaults stay consistent with existing trend-based derivation.

**Dependencies:** U1.

**Files:**
- scripts/serve-mockup.js
- openapi/v1/schemas/players.yaml
- apps/api/tests/integration/players/players-api.spec.ts

**Approach:**
- Extend the `player_stats` SELECT in the dashboard read handler to fetch the six new columns (aliased to camelCase, matching the existing column-alias convention in that query).
- Extend `toDashboardPayload` to add a `currentLevelChange` / `fitnessChange` / `skillProgressChange` object (`{ label, trend }`) to both `stats` and `metrics`, defaulting to `{ label: 'N/A', trend: row.trend || 'plateau' }`-style fallback when a value is `NULL`, consistent with how other missing stats already fall back to `'N/A'`.
- Extend `upsertPlayerStats`'s INSERT/UPDATE column list and parameter binding to include the six new fields.
- Extend `buildDefaultDashboardStats`, `buildNewPlayerDashboardStats`, and `getSeedDashboardStats` to return the new fields alongside the existing trend-branch values they already compute, so newly created players and the default fallback branch get sensible badge values immediately.
- Add the new fields to the `PlayerDashboardStats` schema and to the `metrics` object schema in `openapi/v1/schemas/players.yaml`, matching the additive, backward-compatible style already used for the existing stat fields.

**Patterns to follow:**
- Existing trend-branch functions and `toDashboardPayload` shape in scripts/serve-mockup.js.
- Existing additive schema extension style in openapi/v1/schemas/players.yaml.

**Test scenarios:**
- Happy path: fetching the dashboard for a coach-visible player with a backfilled row returns all three change badges with the mockup's expected label/trend.
- Happy path: `metrics` and `stats` both carry the same badge values for a given player.
- Edge case: a player created via `POST /v1/players` (no explicit stats row beyond the default branch) still returns non-null badge values from the trend-derived defaults.
- Edge case: a player whose `player_stats` row predates this change (all six new columns `NULL`) returns the documented fallback shape instead of `undefined`/missing keys.
- Integration: the dashboard payload continues to satisfy the existing required fields in `PlayerDashboardResponse` (no regression to already-passing dashboard reads).

**Verification:**
- `/api/v1/players/dashboard` returns real, trend-consistent badge data for every seeded player and for newly created players.

### U3. Update the local/offline fallback path to match
**Goal:** Keep the cached/offline dashboard path in sync with the backend shape so fallback mode doesn't regress.

**Requirements:** fallback parity with the backend-first path; no regression to existing fallback behavior when the backend is unavailable.

**Dependencies:** U2 (mirrors its output shape).

**Files:**
- docs/ux/mockup/js/mockup-api-client.js

**Approach:**
- Extend `buildDashboardSnapshot` to compute `currentLevelChange` / `fitnessChange` / `skillProgressChange` using the same trend-branch logic already used for `currentLevel`/`fitness`/`skillProgress` in that function, so the local/offline fallback produces the same shape as the backend path.
- Add the three objects to both the `stats` and `metrics` sub-objects returned by `buildDashboardSnapshot`, mirroring U2's payload shape exactly so `S2-player-dashboard.html`'s binding code does not need branch logic for backend-vs-fallback mode.

**Patterns to follow:**
- Existing trend-branch derivation already inline in `buildDashboardSnapshot` in docs/ux/mockup/js/mockup-api-client.js.

**Test scenarios:**
- Happy path: with the backend unreachable, the dashboard still shows trend-consistent badge values instead of the old static text.
- Integration: the shape returned by `buildDashboardSnapshot` matches the shape returned by the backend path exactly (same keys under `metrics`).
- Test expectation: covered functionally through U4's Playwright/BDD coverage rather than a dedicated unit test, since this module has no existing unit test harness.

**Verification:**
- Toggling `window.__USE_BACKEND__ = false` still renders real, trend-consistent badges rather than the pre-change static text.

### U4. Bind the S2 markup to the real badge data and lock in regression coverage
**Goal:** Make the dashboard actually render the persisted values, and prevent regression back to static badges.

**Requirements:** S2 badges reflect persisted data; regression coverage for the new fields; documentation stays accurate.

**Dependencies:** U2, U3.

**Files:**
- docs/ux/mockup/S2-player-dashboard.html
- tests/playwright/s2-player-dashboard.spec.js
- tests/bdd/features/coach-player-development-dashboard.feature
- docs/ux/mockup/API-Mockup-Mapping.md

**Approach:**
- Add `id` attributes to the three `<span class="badge ...">` elements under Current Level, Fitness, and Skill Progress.
- Extend the dashboard `<script>` block with a small helper (mirroring the existing `trendArrow`/`trendClass` computation already used for the header trend badge) to map each `{ label, trend }` pair to an arrow prefix, badge class, and label text, then set `className`/`textContent` on the three new elements.
- Extend the Playwright spec to assert the three badges render non-static, trend-appropriate text for the loaded player.
- Extend the BDD feature with a scenario (or table column) asserting the change-badge trend for at least one player profile, following the existing Background/Scenario table shape.
- Update `docs/ux/mockup/API-Mockup-Mapping.md` to note the dashboard read operation now also returns the three metric-change indicators.

**Patterns to follow:**
- Existing `trendArrow`/`trendClass`/`trendBadge` binding block already in docs/ux/mockup/S2-player-dashboard.html.
- Existing Playwright assertions in tests/playwright/s2-player-dashboard.spec.js.
- Existing Background/Scenario table shape in tests/bdd/features/coach-player-development-dashboard.feature.

**Test scenarios:**
- Happy path: loading the dashboard for Lionel Messi shows "↑ Up 5%" (improving), "→ Stable" (plateau), and "↑ Up 3%" (improving) for the three badges respectively.
- Happy path: loading the dashboard for a player with a different trend shows badge classes/arrows consistent with that player's stored values, not copies of Messi's.
- Edge case: a player whose stats row has `NULL` change columns still renders a clear fallback badge rather than blank/undefined text.
- Integration: the existing "shows key development, match time, and performance sections" Playwright test still passes unmodified alongside the new assertions.
- Error path: non-coach dashboard access remains forbidden (existing BDD scenario stays green, proving this change didn't touch access control).

**Verification:**
- Opening S2 for any seeded player shows badge text and color driven by that player's real data, in both backend and offline-fallback modes, with all existing dashboard tests still passing.

## Dependencies and Sequencing
- U1 creates the persisted columns everything else depends on.
- U2 and U3 both consume U1's schema and must agree on output shape; U3 depends on U2's shape being finalized first.
- U4 binds the UI last, once both data paths (U2, U3) emit the same shape, and closes the loop with regression coverage.

## Risks and Mitigations
- Risk: the backend and offline-fallback paths drift in shape over time (one gets updated, the other doesn't).
  - Mitigation: U3 explicitly mirrors U2's payload shape, and U4's Playwright coverage exercises the rendered output rather than one code path in isolation.
- Risk: seeding the wrong badge values for non-Messi players makes the dashboard look inconsistent with their actual trend.
  - Mitigation: derive all non-Messi seed values from the same trend-branch functions already used for `growth_status`/`currentLevel`, rather than inventing new per-player numbers.
- Risk: adding required-looking fields to the OpenAPI schema breaks existing consumers.
  - Mitigation: add the new fields as optional/nullable additions to `PlayerDashboardStats`/`metrics`, not new required fields, keeping the change additive.

## Open Questions
- Should the change badges eventually be computed from real historical snapshots instead of static seed labels? (Deferred — no time-series data model exists yet.)
- Should the Last Match card's score/summary binding bug and the static timeline bars be picked up in a follow-up plan, since they were identified but explicitly excluded from this scope?
