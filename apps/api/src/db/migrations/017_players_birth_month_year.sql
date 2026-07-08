-- Add nullable birth_month and birth_year columns to the players table so the S2
-- dashboard can show a real, auto-calculated age derived from the player's date of
-- birth. Both columns are nullable (the pair is optional) and bounded by CHECK
-- constraints so out-of-range values can never enter the table.

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS birth_month SMALLINT
    CHECK (birth_month IS NULL OR birth_month BETWEEN 1 AND 12);

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS birth_year SMALLINT
    CHECK (
      birth_year IS NULL
      OR (birth_year BETWEEN 1960 AND EXTRACT(YEAR FROM NOW())::SMALLINT)
    );