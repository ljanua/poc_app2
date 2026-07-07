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
  club_id TEXT REFERENCES clubs(id),
  sport_id TEXT NOT NULL DEFAULT 'sport_soccer' REFERENCES sports(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_lead_coach_user_id ON teams(lead_coach_user_id);
CREATE INDEX IF NOT EXISTS idx_teams_club_id ON teams(club_id);
CREATE INDEX IF NOT EXISTS idx_teams_sport_id ON teams(sport_id);
CREATE INDEX IF NOT EXISTS idx_teams_status_club ON teams(status, club_id);

CREATE TABLE IF NOT EXISTS clubs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clubs_name ON clubs(name);
CREATE INDEX IF NOT EXISTS idx_clubs_status_name ON clubs(status, name);

CREATE TABLE IF NOT EXISTS coach_clubs (
  user_id TEXT NOT NULL REFERENCES users(id),
  club_id TEXT NOT NULL REFERENCES clubs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, club_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_clubs_club_id ON coach_clubs(club_id);
CREATE INDEX IF NOT EXISTS idx_coach_clubs_user_id ON coach_clubs(user_id);

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

CREATE TABLE IF NOT EXISTS player_stats (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  growth_status TEXT,
  current_level TEXT,
  fitness TEXT,
  skill_progress TEXT,
  total_minutes INTEGER NOT NULL DEFAULT 0,
  appearances INTEGER NOT NULL DEFAULT 0,
  recent_avg TEXT,
  average_score NUMERIC(4,2),
  trend TEXT NOT NULL CHECK (trend IN ('improving', 'plateau', 'declining')),
  last_match_score NUMERIC(4,2),
  last_match_summary TEXT,
  clip_submitted_count INTEGER NOT NULL DEFAULT 0,
  clip_assessed_count INTEGER NOT NULL DEFAULT 0,
  clip_pending_count INTEGER NOT NULL DEFAULT 0,
  missing_data_message TEXT,
  current_level_change_label TEXT,
  current_level_change_trend TEXT CHECK (current_level_change_trend IN ('improving', 'plateau', 'declining')),
  fitness_change_label TEXT,
  fitness_change_trend TEXT CHECK (fitness_change_trend IN ('improving', 'plateau', 'declining')),
  skill_progress_change_label TEXT,
  skill_progress_change_trend TEXT CHECK (skill_progress_change_trend IN ('improving', 'plateau', 'declining')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_stats_trend ON player_stats(trend);

CREATE TABLE IF NOT EXISTS sports (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sports_name ON sports(name);
CREATE INDEX IF NOT EXISTS idx_sports_status_name ON sports(status, name);

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sport_id TEXT NOT NULL REFERENCES sports(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sport_id, name)
);

CREATE INDEX IF NOT EXISTS idx_positions_sport_id ON positions(sport_id);
CREATE INDEX IF NOT EXISTS idx_positions_status_name ON positions(status, name);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
CREATE INDEX IF NOT EXISTS idx_skills_status_name ON skills(status, name);

CREATE TABLE IF NOT EXISTS position_skills (
  position_id TEXT NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (position_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_position_skills_skill_id ON position_skills(skill_id);
