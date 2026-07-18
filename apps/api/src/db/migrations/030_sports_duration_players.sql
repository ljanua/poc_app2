-- Migration 030: sport match presets (duration + number of players).
-- Used by S10 Games create Duration default and Game Sheet max starters.

ALTER TABLE sports
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 90
    CHECK (duration_minutes >= 1 AND duration_minutes <= 180);

ALTER TABLE sports
  ADD COLUMN IF NOT EXISTS number_of_players INTEGER NOT NULL DEFAULT 11
    CHECK (number_of_players >= 1 AND number_of_players <= 30);

UPDATE sports
SET duration_minutes = 90
WHERE duration_minutes IS NULL;

UPDATE sports
SET number_of_players = 11
WHERE number_of_players IS NULL;
