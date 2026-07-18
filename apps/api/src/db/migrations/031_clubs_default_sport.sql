-- Migration 031: clubs.default_sport_id (Default sport for S8 filter presets).

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS default_sport_id TEXT REFERENCES sports(id) ON DELETE RESTRICT;

UPDATE clubs
SET default_sport_id = 'sport_soccer'
WHERE default_sport_id IS NULL;

ALTER TABLE clubs
  ALTER COLUMN default_sport_id SET DEFAULT 'sport_soccer';

ALTER TABLE clubs
  ALTER COLUMN default_sport_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clubs_default_sport_id ON clubs(default_sport_id);
