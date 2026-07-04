-- Add missing source-of-record fields for mockup parity and clip persistence.

ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS password_plaintext TEXT,
  ADD COLUMN IF NOT EXISTS last_login_label TEXT;

ALTER TABLE IF EXISTS users
  DROP CONSTRAINT IF EXISTS users_status_check;

ALTER TABLE IF EXISTS users
  ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'inactive'));

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
