-- Add sport_id to teams. Feature 012 (S3 team sport + S5 player position).
-- sport_soccer is the seeded default from migration 015, so every existing team
-- is backfilled atomically before the column is locked NOT NULL.

ALTER TABLE teams ADD COLUMN IF NOT EXISTS sport_id TEXT REFERENCES sports(id) ON DELETE RESTRICT;

UPDATE teams SET sport_id = 'sport_soccer' WHERE sport_id IS NULL;

ALTER TABLE teams ALTER COLUMN sport_id SET NOT NULL;
ALTER TABLE teams ALTER COLUMN sport_id SET DEFAULT 'sport_soccer';

CREATE INDEX IF NOT EXISTS idx_teams_sport_id ON teams(sport_id);