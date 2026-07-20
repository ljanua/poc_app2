-- Migration 033: configurable subscription tiers, user approval, OAuth identities.

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

INSERT INTO subscription_tiers (
  id, code, display_name, max_teams, max_coaches, max_club_admins,
  videos_per_day, max_videos_per_team, active, sort_order
) VALUES
  ('tier_free', 'free', 'Free Tier', 1, 1, 0, 2, 11, TRUE, 10),
  ('tier_professional', 'professional', 'Professional', 3, 3, 0, 2, 11, TRUE, 20),
  ('tier_club_basic', 'club_basic', 'Club Basic', 5, 10, 1, 11, 33, TRUE, 30),
  ('tier_club_premium', 'club_premium', 'Club Premium', 10, 10, 10, 11, 55, TRUE, 40)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS subscription_tier_id TEXT REFERENCES subscription_tiers(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'users'
      AND constraint_name = 'users_approval_status_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_approval_status_check
      CHECK (approval_status IN ('pending', 'active', 'rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_approval_status ON users(approval_status);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier_id ON users(subscription_tier_id);

UPDATE users
SET approval_status = 'active',
    subscription_tier_id = COALESCE(
      subscription_tier_id,
      (SELECT id FROM subscription_tiers WHERE code = 'free' LIMIT 1)
    )
WHERE approval_status IS NULL
   OR subscription_tier_id IS NULL;

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
