-- Migration 013: add teams.status (active/inactive) and supporting index.
--
-- Mirrors the users.status declaration (apps/api/src/db/schema/tables.sql).
-- Idempotent: a re-run is a no-op thanks to IF NOT EXISTS and the DEFAULT clause.
-- Backfill: the DEFAULT 'active' clause fires for every existing row at column-add time,
-- so no separate UPDATE is required. This guarantees all rows carry a valid status the
-- moment the column exists.

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'inactive'));

CREATE INDEX IF NOT EXISTS idx_teams_status_club ON teams(status, club_id);
