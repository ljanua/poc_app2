-- Canonical source-of-record schema for current mockup and API flows.

CREATE TABLE IF NOT EXISTS subscription_tiers (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  max_teams INT NOT NULL CHECK (max_teams >= 0),
  max_coaches INT NOT NULL CHECK (max_coaches >= 0),
  max_club_admins INT NOT NULL CHECK (max_club_admins >= 0),
  videos_per_day INT NOT NULL CHECK (videos_per_day >= 0),
  max_videos_per_team INT NOT NULL CHECK (max_videos_per_team >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('SystemAdmin', 'Coach', 'ClubAdmin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  approval_status TEXT NOT NULL DEFAULT 'active' CHECK (approval_status IN ('pending', 'active', 'rejected')),
  subscription_tier_id TEXT REFERENCES subscription_tiers(id),
  password_hash TEXT,
  password_plaintext TEXT,
  last_login_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_approval_status ON users(approval_status);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier_id ON users(subscription_tier_id);

CREATE TABLE IF NOT EXISTS user_oauth_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'apple', 'facebook')),
  provider_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_oauth_identities_user_id ON user_oauth_identities(user_id);

CREATE TABLE IF NOT EXISTS auth_handoff_codes (
  code TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_handoff_codes_user_id ON auth_handoff_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_handoff_codes_expires_at ON auth_handoff_codes(expires_at);

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
  default_sport_id TEXT NOT NULL DEFAULT 'sport_soccer',
  is_free_tier BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clubs_name ON clubs(name);
CREATE INDEX IF NOT EXISTS idx_clubs_status_name ON clubs(status, name);
CREATE INDEX IF NOT EXISTS idx_clubs_default_sport_id ON clubs(default_sport_id);

CREATE TABLE IF NOT EXISTS coach_clubs (
  user_id TEXT NOT NULL REFERENCES users(id),
  club_id TEXT NOT NULL REFERENCES clubs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, club_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_clubs_club_id ON coach_clubs(club_id);
CREATE INDEX IF NOT EXISTS idx_coach_clubs_user_id ON coach_clubs(user_id);

CREATE TABLE IF NOT EXISTS registration_intents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  intent TEXT NOT NULL CHECK (intent IN ('create', 'join')),
  status TEXT NOT NULL CHECK (status IN (
    'pending_sa',
    'pending_join',
    'completed',
    'sa_rejected',
    'join_rejected'
  )),
  proposed_club_name TEXT,
  proposed_team_name TEXT,
  target_club_id TEXT REFERENCES clubs(id) ON DELETE SET NULL,
  target_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registration_intents_user_id ON registration_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_registration_intents_status ON registration_intents(status);
CREATE INDEX IF NOT EXISTS idx_registration_intents_target_club ON registration_intents(target_club_id);


CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  position TEXT NOT NULL DEFAULT 'Position not set',
  trend TEXT NOT NULL DEFAULT 'plateau' CHECK (trend IN ('improving', 'plateau', 'declining')),
  birth_month SMALLINT CHECK (birth_month IS NULL OR birth_month BETWEEN 1 AND 12),
  birth_year SMALLINT CHECK (
    birth_year IS NULL
    OR (birth_year BETWEEN 1960 AND EXTRACT(YEAR FROM NOW())::SMALLINT)
  ),
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

CREATE TABLE IF NOT EXISTS clip_segments (
  id TEXT PRIMARY KEY,
  clip_id TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  segment_index INT NOT NULL,
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (clip_id, segment_index)
);

CREATE INDEX IF NOT EXISTS idx_clip_segments_clip_id ON clip_segments(clip_id);

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
  duration_minutes INTEGER NOT NULL DEFAULT 90 CHECK (duration_minutes >= 1 AND duration_minutes <= 180),
  number_of_players INTEGER NOT NULL DEFAULT 11 CHECK (number_of_players >= 1 AND number_of_players <= 30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sports_name ON sports(name);
CREATE INDEX IF NOT EXISTS idx_sports_status_name ON sports(status, name);

-- clubs.default_sport_id references sports; sports is created after clubs.
DO $$
BEGIN
  ALTER TABLE clubs
    ADD CONSTRAINT clubs_default_sport_id_fkey
    FOREIGN KEY (default_sport_id) REFERENCES sports(id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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
  abbreviation TEXT NOT NULL CHECK (char_length(abbreviation) >= 1 AND char_length(abbreviation) <= 3),
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

CREATE TABLE IF NOT EXISTS player_skill_ratings (
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  rating SMALLINT CHECK (rating IS NULL OR (rating BETWEEN 0 AND 100)),
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_player_skill_ratings_skill_id ON player_skill_ratings(skill_id);

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

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  kickoff_at TIMESTAMPTZ NOT NULL,
  opponent TEXT NOT NULL,
  home_away TEXT NOT NULL DEFAULT 'home' CHECK (home_away IN ('home', 'away')),
  duration_minutes SMALLINT NOT NULL DEFAULT 90 CHECK (duration_minutes > 0 AND duration_minutes <= 180),
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'complete')),
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_team_kickoff
  ON games(team_id, kickoff_at DESC);

CREATE INDEX IF NOT EXISTS idx_games_status_kickoff
  ON games(status, kickoff_at DESC);

CREATE TABLE IF NOT EXISTS game_substitutions (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  seq SMALLINT NOT NULL,
  minute SMALLINT NOT NULL CHECK (minute >= 0),
  player_out_id TEXT NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  player_in_id TEXT NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_game_substitutions_game_id
  ON game_substitutions(game_id);

CREATE TABLE IF NOT EXISTS game_performance (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  started BOOLEAN NOT NULL DEFAULT FALSE,
  minutes SMALLINT NOT NULL DEFAULT 0 CHECK (minutes >= 0),
  rating NUMERIC(3,1) CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_game_performance_player_id
  ON game_performance(player_id);

CREATE TABLE IF NOT EXISTS player_share_links (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_player_share_links_player_id ON player_share_links(player_id);
CREATE INDEX IF NOT EXISTS idx_player_share_links_active
  ON player_share_links(player_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS player_data_audits (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  entity TEXT NOT NULL CHECK (entity IN ('profile', 'team_assignment', 'skill_rating')),
  field_key TEXT NOT NULL,
  skill_id TEXT REFERENCES skills(id) ON DELETE SET NULL,
  old_value TEXT,
  new_value TEXT,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('user', 'system')),
  source TEXT NOT NULL,
  clip_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_data_audits_player_created
  ON player_data_audits(player_id, created_at DESC);

