-- Migration 014: add clubs.status (active/inactive) and supporting index.
--
-- Mirrors the teams.status declaration (apps/api/src/db/schema/tables.sql)
-- and the users.status shape used by migration 004. Idempotent: a re-run is
-- a no-op thanks to IF NOT EXISTS and the DEFAULT clause. Backfill: the
-- DEFAULT 'active' clause fires for every existing row at column-add time,
-- so no separate UPDATE is required. This guarantees all clubs carry a
-- valid status the moment the column exists.
--
-- The new index covers S7a's search-and-filter combined query:
--   WHERE status = ? AND name LIKE ?

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'inactive'));

CREATE INDEX IF NOT EXISTS idx_clubs_status_name ON clubs(status, name);