-- U2: user password and role administration support
-- Safe migration for docs-first scaffold and future runtime implementation.

ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS users
  ADD CONSTRAINT users_email_unique UNIQUE (email);

CREATE INDEX IF NOT EXISTS idx_users_role_status ON users (role, deactivated_at);
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users (updated_at DESC);
