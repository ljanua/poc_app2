-- Canonical source-of-record schema for current mockup and API flows.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('SystemAdmin', 'Coach')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  password_hash TEXT,
  password_plaintext TEXT,
  last_login_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users(updated_at DESC);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  age_group TEXT NOT NULL,
  lead_coach_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_lead_coach_user_id ON teams(lead_coach_user_id);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  position TEXT NOT NULL DEFAULT 'Position not set',
  trend TEXT NOT NULL DEFAULT 'plateau' CHECK (trend IN ('improving', 'plateau', 'declining')),
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

CREATE TABLE IF NOT EXISTS clips (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  situation TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'assessed')),
  score NUMERIC(4,2),
  summary TEXT,
  submitted_at_label TEXT,
  skill TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clips_player_id ON clips(player_id);
CREATE INDEX IF NOT EXISTS idx_clips_status ON clips(status);
