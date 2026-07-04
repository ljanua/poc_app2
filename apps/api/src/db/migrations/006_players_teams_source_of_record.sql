-- Player source-of-record schema aligned with strict single-team assignment.

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  position TEXT NOT NULL DEFAULT 'Position not set',
  trend TEXT NOT NULL DEFAULT 'plateau',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_normalized_name ON players(normalized_name);

CREATE TABLE IF NOT EXISTS player_team_assignments (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_team_assignments_team_id ON player_team_assignments(team_id);
