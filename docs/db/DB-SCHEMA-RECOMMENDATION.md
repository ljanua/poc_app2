# DB Schema Recommendation

## Problem Statement
The project currently mixes local storage, in-memory maps, and partial PostgreSQL schema coverage. This causes non-durable behavior for key flows (player create/assign, clip lifecycle, role-aware user state).

Target boundary:
- PostgreSQL is the source of record for users, teams, players, player assignments, and clips.
- Browser local storage remains optional mock-only fallback, not default persistence.

## Entity Model and Responsibilities
- `users`: application users and role/status/login metadata.
- `teams`: team definitions and lead coach ownership.
- `players`: canonical player profile and normalized name uniqueness.
- `player_team_assignments`: strict single-team assignment per player.
- `clips`: video/assessment submission records linked to players.

## Relationships
- `teams.lead_coach_user_id -> users.id` (many teams to one coach user)
- `player_team_assignments.player_id -> players.id` (one assignment per player)
- `player_team_assignments.team_id -> teams.id` (many players to one team)
- `clips.player_id -> players.id` (many clips to one player)

## Column-Level Constraints and Defaults
- `users.role` constrained to `SystemAdmin|Coach`.
- `users.status` constrained to `active|inactive`, default `active`.
- `players.normalized_name` unique to prevent duplicate identity creation.
- `players.trend` constrained to `improving|plateau|declining`.
- `clips.status` constrained to `pending|assessed`.
- Timestamps use `TIMESTAMPTZ` with `NOW()` defaults.

## Index Strategy
- `users(role, status)` and `users(updated_at)` for admin filtering and recency operations.
- `teams(lead_coach_user_id)` for coach ownership lookups.
- `players(normalized_name)` for duplicate detection.
- `player_team_assignments(team_id)` for team roster queries.
- `clips(player_id)` and `clips(status)` for clip listing and status filters.

## Migration Sequencing and Rollback
- Existing baseline migrations remain ordered: users (004), teams (005), players+assignment (006).
- Add migration 007 for missing user status/login fields and clips table.
- All changes are additive and idempotent (`IF EXISTS`/`IF NOT EXISTS`) to support re-runs.
- Rollback approach: deploy forward-fix migrations; avoid destructive rollback in shared environments.

## Data Integrity and Concurrency
- Referential integrity enforced with foreign keys.
- Single-team ownership enforced by PK on `player_team_assignments.player_id`.
- Assignment updates should run transactionally in service/runtime code.

## Risks and Mitigations
- Risk: local fallback can mask DB outages.
  - Mitigation: backend mode should fail explicitly when `DATABASE_URL` is missing.
- Risk: seeded IDs diverge from UI assumptions.
  - Mitigation: seed with deterministic IDs matching current mockup data shape.
- Risk: migration drift between canonical schema and runtime bootstrap.
  - Mitigation: centralize bootstrap to execute canonical schema/migrations.
