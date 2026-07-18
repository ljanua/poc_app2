-- Migration 028: skill ratings history + updated_by on live ratings.
--
-- Adds text actor stamp on player_skill_ratings and an append-only
-- player_skill_ratings_history table so each Assessment (manual or video)
-- can be reconstructed as a single event via shared assessed_at.

ALTER TABLE player_skill_ratings
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

CREATE TABLE IF NOT EXISTS player_skill_ratings_history (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 0 AND 100),
  updated_by TEXT NOT NULL,
  assessed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_skill_ratings_history_player_assessed
  ON player_skill_ratings_history(player_id, assessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_skill_ratings_history_skill_id
  ON player_skill_ratings_history(skill_id);
