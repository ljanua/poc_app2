---
title: Migration shipped but never applied to live DB caused 500 on every dashboard read
date: 2026-07-08
category: docs/solutions/database-issues/
module: apps/api/src/db/migrations
problem_type: database_issue
component: database
symptoms:
  - "GET /api/v1/players/dashboard returns HTTP 500"
  - "Postgres error SQLSTATE 42703: \"column p.birth_month does not exist\""
  - "Failure originates in scripts/serve-mockup.js near the players dashboard SELECT that projects p.birth_month and p.birth_year"
  - "SELECT column_name FROM information_schema.columns WHERE table_name='players' AND column_name IN ('birth_month','birth_year') returns zero rows on the live database"
  - "npm run db:bootstrap fails before it can apply 017 because migration 004 re-issues ADD CONSTRAINT users_email_unique against an already-existing constraint"
root_cause: missing_workflow_step
resolution_type: migration
severity: high
related_components:
  - scripts/serve-mockup.js
  - scripts/db-bootstrap.js
tags:
  - migration
  - postgres
  - serve-mockup
  - db-bootstrap
  - schema-drift
  - sqlstate-42703
  - live-database
---

# Migration shipped but never applied to live DB caused 500 on every dashboard read

## Problem

The live mockup server returned HTTP 500 with SQLSTATE 42703 (`column p.birth_month does not exist`) on every dashboard, profile, and list read that included the new `birth_month` / `birth_year` columns. The migration file `c:\Users\ljanu\OneDrive\Documents\code\poc_app2\apps\api\src\db\migrations\017_players_birth_month_year.sql` had been committed alongside feature 014's code, but the migration had never been run against the live database, so the schema the API queried did not match the schema the code referenced. Whoever first hit the dashboard after the deploy noticed immediately because every player-list endpoint was unavailable.

## Symptoms

- `SQLSTATE 42703` Postgres error code (`undefined_column`) wrapped at the API boundary as a generic 500.
- Log line shape (from `c:\Users\ljanu\OneDrive\Documents\code\poc_app2\mockup-server.out.log`):
  - `error: column "p.birth_month" does not exist` (or `"p.birth_year"`)
  - Often followed by `code: '42703'` and the offending SELECT, which references `players` aliased as `p`.
- HTTP 500 on any read endpoint that joined or selected from the `players` table with the new columns:
  - `GET /api/v1/players/dashboard`
  - `GET /api/v1/players/profile/:id`
  - `GET /api/v1/players` (list) when the response shape included age / birth fields
- Server stayed up; this was a per-request failure, not a crash. Health and non-player routes were unaffected.
- No 4xx (auth, validation) errors — the request reached the query layer, then died.

## What Didn't Work

The obvious one-command path was `npm run db:bootstrap`, which is the script this repo uses to apply every migration in `c:\Users\ljanu\OneDrive\Documents\code\poc_app2\apps\api\src\db\migrations\` to the live DB. Running it would have applied migration 017 and the dashboard would have come back green on its own.

It failed first on a separate, pre-existing idempotency bug in migration 004: the script's plain-SQL `ADD CONSTRAINT users_email_unique` does not guard against "constraint already exists," so on any database that has previously been bootstrapped (or partially bootstrapped) the script aborts before it ever reaches migration 017. Because bootstrap is all-or-nothing in its current shape, that single failure blocks every later migration — including the one we actually needed.

That pre-existing bug is **out of scope** for this doc. The point of recording it here is so that the next person who sees the 500 does not waste time re-deriving why "just run db:bootstrap" is not a real option on this DB. The fix below bypasses bootstrap and applies only the missing migration.

## Solution

Two steps: confirm the column is actually missing, then apply migration 017 directly.

### 1. Confirm the column is missing

Run this from `c:\Users\ljanu\OneDrive\Documents\code\poc_app2\apps\api\` (or any directory where `pg` and `dotenv` resolve and `.env` is loaded — usually the API package root):

```bash
node -e "const {Client}=require('pg');require('dotenv').config();(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();const r=await c.query(\"SELECT column_name FROM information_schema.columns WHERE table_name='players' AND column_name IN ('birth_month','birth_year')\");console.log(r.rows);await c.end();})()"
```

Expected output on a healthy DB: an array of two rows — one for `birth_month`, one for `birth_year`. Expected output on the broken live DB: an empty array. If you see the empty array, you've confirmed the schema is behind the code and the migration is the fix.

### 2. Apply migration 017 directly

The migration file is `c:\Users\ljanu\OneDrive\Documents\code\poc_app2\apps\api\src\db\migrations\017_players_birth_month_year.sql`. Its body is:

```sql
-- Add nullable birth_month and birth_year columns to the players table so the S2
-- dashboard can show a real, auto-calculated age derived from the player's date of
-- birth. Both columns are nullable (the pair is optional) and bounded by CHECK
-- constraints so out-of-range values can never enter the table.

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS birth_month SMALLINT
    CHECK (birth_month IS NULL OR birth_month BETWEEN 1 AND 12);

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS birth_year SMALLINT
    CHECK (
      birth_year IS NULL
      OR (birth_year BETWEEN 1960 AND EXTRACT(YEAR FROM NOW())::SMALLINT)
    );
```

Note the `IF NOT EXISTS` guards and the `CHECK` constraints — applying this to a DB that already has the columns is a safe no-op, so re-running it later is fine.

Apply it against the live DB with `psql` (using the same `DATABASE_URL` the API uses):

```bash
psql "$DATABASE_URL" -f c:/Users/ljanu/OneDrive/Documents/code/poc_app2/apps/api/src/db/migrations/017_players_birth_month_year.sql
```

If `psql` is not on PATH, run the same SQL through a one-off `pg.Client` script (same shape as the verification one-liner above) — open a client, `await c.query(fs.readFileSync(migrationPath, 'utf8'))`, log any error, close.

### 3. Verify

Re-run the confirmation one-liner from step 1. It should now return both rows. Then re-issue the failing request:

```bash
curl -i http://localhost:<mockup-port>/api/v1/players/dashboard
```

Expected: `HTTP/1.1 200 OK` with a JSON body that includes the dashboard shape (and any players with birth data now show a real, age-derived field). Any 500 with `42703` after this point means either a different column is missing or a different migration also wasn't applied — re-run the verification one-liner with a broader `column_name IN (...)` list.

## Why This Works

Root cause: feature 014 (plan at `c:\Users\ljanu\OneDrive\Documents\code\poc_app2\docs\plans\2026-07-07-014-feat-player-birth-month-year-and-auto-age-plan.md`) introduced two new columns on the `players` table, with the code path that reads them going live in the same change set. The migration file was committed, but the deploy step that applies migrations to the live DB was skipped (or failed silently) for this change, so the running API was querying columns that did not exist in the running schema. Postgres responded with `42703 undefined_column`, the API surfaced it as a 500, and every read that touched the new columns was broken.

The bootstrap path that would normally catch this — `npm run db:bootstrap` — is the canonical mitigation, but it was independently broken on migration 004's non-idempotent `ADD CONSTRAINT users_email_unique`. Because bootstrap is one transaction, the pre-existing failure short-circuited the run and migration 017 was never reached. The direct apply bypasses the bootstrap script's failure mode and only does the minimum work needed to bring the schema back in line with the code.

## Prevention

Concrete changes to make sure the next "schema is behind the code" miss is caught before a human notices via 500s:

- **Integration test for bootstrap.** Add a test that runs `db:bootstrap` against an ephemeral Postgres (testcontainers or a CI-managed throwaway), then queries `information_schema.columns` for every column declared in every `apps/api/src/db/migrations/*.sql` file and asserts each one is present. This catches both "migration never applied" and "migration applied but column list is wrong."
- **Boot-time schema check in `serve-mockup.js`.** On startup, the mockup server should query `information_schema.columns` for the columns the code expects (at minimum: `players.birth_month`, `players.birth_year`, plus any other recently-added columns) and fail fast with a clear "run db:bootstrap or apply migration NNN" error if any are missing. A loud, immediate startup failure is much cheaper to triage than a 500 on every dashboard read.
- **Make `db:bootstrap` fully idempotent.** Either introduce a `schema_migrations` ledger table and only apply migrations not in it, or wrap each `ADD CONSTRAINT` / `CREATE INDEX` / `ALTER TABLE ADD COLUMN` in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`. This is the fix for the sibling bootstrap bug noted above and would have let us solve this incident with a single `npm run db:bootstrap`.
- **CI smoke test.** Add a CI job that, on every PR that touches `apps/api/src/db/migrations/` or `apps/api/src/**`:
  1. Spins up Postgres.
  2. Runs `npm run db:bootstrap`.
  3. Starts `serve-mockup.js`.
  4. `curl`s `/api/v1/players/dashboard` and asserts a 200 with a non-empty body.
  This guarantees that any PR which adds a migration also proves the API can run against a freshly-bootstrapped DB — the exact condition that broke in this incident.
- **Pre-commit / pre-merge check.** A small script that diffs the set of `ADD COLUMN` statements in committed `migrations/*.sql` against the columns actually referenced by the API's SQL/ORM layer, and fails the commit if the migration set is a strict subset. This catches the "code references a column the migration doesn't add" direction of the same class of bug.

## Related Issues

- Feature 014 plan that introduced the columns and the code that read them: `c:\Users\ljanu\OneDrive\Documents\code\poc_app2\docs\plans\2026-07-07-014-feat-player-birth-month-year-and-auto-age-plan.md`. The plan is correct on its own; the gap was purely in the deploy step.
- Existing migration contract tests (file-content assertions, not DB-state assertions): `c:\Users\ljanu\OneDrive\Documents\code\poc_app2\apps\api\tests\integration\db\players-birth-migration.spec.ts`, `c:\Users\ljanu\OneDrive\Documents\code\poc_app2\apps\api\tests\integration\db\schema-bootstrap.spec.ts`. These pin the SQL file shape but do not run it against Postgres, so they would not have caught "migration never applied to live DB."
- Sibling, **out of scope** bug: `db:bootstrap` is not idempotent on migration 004 (`ADD CONSTRAINT users_email_unique`). It throws on a second run against any DB where the constraint already exists, which short-circuits the rest of the bootstrap and blocks applying later migrations. Tracked separately — fix is to make bootstrap idempotent (see Prevention), but it is not part of this incident's resolution.