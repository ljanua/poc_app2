-- Migration 032: free-tier flag on clubs (public landing signup).

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS is_free_tier BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_clubs_is_free_tier ON clubs(is_free_tier)
  WHERE is_free_tier = TRUE;
