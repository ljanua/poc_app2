-- Migration 018: add player_skill_ratings.
--
-- Per-player skill ratings (0–100%, nullable for "not yet rated") keyed by
-- (player_id, skill_id). Skills are sourced from the player's current position
-- via position_skills; this table only stores the rating values.
--
-- Idempotent: CREATE TABLE / INDEX IF NOT EXISTS. No seed rows — every player
-- starts with an empty ratings set and coaches fill them in via S5.

CREATE TABLE IF NOT EXISTS player_skill_ratings (
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  rating SMALLINT CHECK (rating IS NULL OR (rating BETWEEN 0 AND 100)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_player_skill_ratings_skill_id ON player_skill_ratings(skill_id);
