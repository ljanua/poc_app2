-- Migration 024: player_data_audits — append-only history for profile,
-- team assignment, and skill rating changes (Feature 036 / backlog 008).
--
-- actor_user_id is nullable for system/clip-sync rows. Diff-only inserts are
-- enforced in application code. No UPDATE/DELETE of rows.
--
-- Idempotent: CREATE TABLE / INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS player_data_audits (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  entity TEXT NOT NULL CHECK (entity IN ('profile', 'team_assignment', 'skill_rating')),
  field_key TEXT NOT NULL,
  skill_id TEXT REFERENCES skills(id) ON DELETE SET NULL,
  old_value TEXT,
  new_value TEXT,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('user', 'system')),
  source TEXT NOT NULL,
  clip_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_data_audits_player_created
  ON player_data_audits(player_id, created_at DESC);
