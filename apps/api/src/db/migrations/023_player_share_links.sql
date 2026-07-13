-- Migration 023: player_share_links for guest read-only S2 share tokens.
--
-- Stores only the SHA-256 hash of the opaque URL token. One logical “active”
-- share per player is enforced in application code (replace-on-create sets
-- revoked_at on prior rows). Links never time-expire; revoke sets revoked_at.
--
-- Idempotent: CREATE TABLE / INDEX IF NOT EXISTS.

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
