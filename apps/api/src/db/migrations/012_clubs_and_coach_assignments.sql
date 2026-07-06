-- Clubs and coach_clubs entities, plus teams.club_id FK.
-- This is the source-of-record migration for the Manage Club feature.
-- Backfill lands in a single SQL so a partial state cannot persist between the
-- club insert and the teams/coach_clubs update.

CREATE TABLE IF NOT EXISTS clubs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clubs_name ON clubs(name);

CREATE TABLE IF NOT EXISTS coach_clubs (
  user_id TEXT NOT NULL REFERENCES users(id),
  club_id TEXT NOT NULL REFERENCES clubs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, club_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_clubs_club_id ON coach_clubs(club_id);
CREATE INDEX IF NOT EXISTS idx_coach_clubs_user_id ON coach_clubs(user_id);

-- teams.club_id is additive (nullable during backfill). The schema source of
-- record will be tightened to NOT NULL in a follow-up once we are confident
-- every deployment has been migrated.
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS club_id TEXT REFERENCES clubs(id);

CREATE INDEX IF NOT EXISTS idx_teams_club_id ON teams(club_id);

-- Backfill: seed the default club, attach every team to it, and assign every
-- active Coach plus the SystemAdmin to it.
INSERT INTO clubs (id, name)
VALUES ('c_default', 'VantageIQ Club')
ON CONFLICT (id) DO NOTHING;

UPDATE teams
SET club_id = 'c_default'
WHERE club_id IS NULL;

INSERT INTO coach_clubs (user_id, club_id)
SELECT u.id, 'c_default'
FROM users u
WHERE u.role IN ('Coach', 'SystemAdmin')
  AND u.status = 'active'
ON CONFLICT (user_id, club_id) DO NOTHING;
