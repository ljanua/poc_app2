-- Migration 034: registration create/join intent + ClubAdmin join queue support.

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
CREATE INDEX IF NOT EXISTS idx_registration_intents_pending_club_name
  ON registration_intents (LOWER(proposed_club_name))
  WHERE intent = 'create' AND status IN ('pending_sa', 'pending_join');
