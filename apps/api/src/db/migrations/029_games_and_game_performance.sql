-- Migration 029: games ledger + substitutions + game_performance.
--
-- Event-sourced match participation for coaches: fixtures on a team,
-- substitution timeline, and per-player minutes/rating rows.

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
