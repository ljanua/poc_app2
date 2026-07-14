-- Add ClubAdmin to users.role CHECK (Feature 041 / backlog 009).
-- CREATE TABLE IF NOT EXISTS does not replace an existing CHECK; drop + recreate.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('SystemAdmin', 'Coach', 'ClubAdmin'));
