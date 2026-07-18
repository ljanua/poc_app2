# Production deployment checklist

Use this before shipping mockup/API code that depends on Postgres schema under `apps/api/src/db/`.

**Authority:** apply migrations manually against the production `DATABASE_URL` from repo-root **`.env_prod`**. There is no automatic migrate-on-deploy and no migration-history table. Confirm with `information_schema` (or a known failing query), then apply missing SQL files in number order.

Related: `docs/solutions/database-issues/serve-mockup-500-birth-month-column-not-applied.md` (schema shipped in git but never applied → `42703` / HTTP 500).

### Load production `DATABASE_URL` from `.env_prod`

Repo-root file `.env_prod` holds production secrets (`DATABASE_URL=...`). Keep it gitignored / uncommitted.

**PowerShell (repo root):**

```powershell
Get-Content .\.env_prod | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
  $name, $value = $_ -split '=', 2
  Set-Item -Path "Env:$($name.Trim())" -Value $value.Trim().Trim('"').Trim("'")
}
# Confirm loaded (prints length only — not the secret):
if (-not $env:DATABASE_URL) { throw 'DATABASE_URL missing from .env_prod' }
"DATABASE_URL loaded ($($env:DATABASE_URL.Length) chars)"
```

**bash:**

```bash
set -a
# shellcheck disable=SC1091
source .env_prod
set +a
test -n "$DATABASE_URL" || { echo 'DATABASE_URL missing from .env_prod'; exit 1; }
```

Use this session’s `$env:DATABASE_URL` / `$DATABASE_URL` for every `psql`, verify query, and bootstrap step below. Do **not** fall back to `.env` (local) for production applies.

---

## 0. Preconditions

- [ ] Working tree / release commit is the intended `main` tip (or the exact commit you will run in prod).
- [ ] Repo-root `.env_prod` exists and contains `DATABASE_URL` for production. Load it per the section above. **Do not commit** `.env_prod`.
- [ ] Confirmed you are **not** using local `.env` for this session.
- [ ] `psql` is on PATH, **or** you can run SQL via a one-off `pg.Client` (same pattern as the solutions doc).
- [ ] App process that will serve the new code is identified (e.g. `node scripts/serve-mockup.js` host) so you can restart after schema + code land.
- [ ] You know whether this release is **schema-only**, **code-only**, or **both**. Prefer **schema first**, then code restart, when new columns/tables are required.

---

## 1. Identify required migrations

Migrations live in `apps/api/src/db/migrations/` (`NNN_*.sql`, sorted by filename).

- [ ] List migration files introduced since the last successful production schema apply.
- [ ] For each file, skim the SQL: prefer `IF NOT EXISTS` / idempotent forms; note any `DROP CONSTRAINT` / `SET NOT NULL` that need extra care.

### Baseline since Users bottom-nav plan (2026-07-17-005)

Plan `docs/plans/2026-07-17-005-fix-users-bottom-nav-all-screens-plan.md` was **UI-only** (no DB). Schema that typically still needs applying on a prod DB that was last updated around that time:

| Order | File | What it adds |
|------:|------|----------------|
| 1 | `025_skill_abbreviation.sql` | Skill abbreviation (if not already present) |
| 2 | `026_users_role_club_admin.sql` | `ClubAdmin` on `users.role` CHECK |
| 3 | `027_clip_link_ingest.sql` | Clip link-ingest columns + `ytdlp_path` config |
| 4 | `028_player_skill_ratings_history.sql` | `player_skill_ratings.updated_by` + `player_skill_ratings_history` |
| 5 | `029_games_and_game_performance.sql` | `games`, `game_substitutions`, `game_performance` |
| 6 | `030_sports_duration_players.sql` | `sports.duration_minutes`, `sports.number_of_players` |
| 7 | `031_clubs_default_sport.sql` | `clubs.default_sport_id` |

Skip any row already verified present on production. Apply remaining files **in the order above**.

Later releases: append new `NNN_*.sql` rows to this table (or a dated subsection) when they ship.

---

## 2. Verify current production schema (before apply)

Connect with `DATABASE_URL` loaded from `.env_prod`. Record results (yes/no) for each check you care about.

Example (PowerShell, after loading `.env_prod`):

```powershell
psql $env:DATABASE_URL -c "SELECT current_database(), inet_server_addr();"
```

Confirm the database name matches production before applying anything.

### 028 — assessment history

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'player_skill_ratings'
  AND column_name = 'updated_by';

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'player_skill_ratings_history';
```

### 029 — games

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('games', 'game_substitutions', 'game_performance')
ORDER BY table_name;
```

### 030 — sport presets

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sports'
  AND column_name IN ('duration_minutes', 'number_of_players');
```

### 031 — club default sport

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'clubs'
  AND column_name = 'default_sport_id';
```

### 027 — link ingest (if in scope)

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'clips'
  AND column_name IN (
    'source_url', 'source_start_ms', 'source_duration_ms',
    'find_player', 'find_player_matched_ms'
  );
```

### 026 — ClubAdmin role (if in scope)

```sql
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'users_role_check';
```

Expect the definition to include `ClubAdmin`.

- [ ] Gap list written down (only missing migrations will be applied).

---

## 3. Apply missing migrations

**Do not** assume `npm run db:bootstrap` is safe on an already-provisioned production DB. Bootstrap runs `deploy.sql` then **every** migration; older migrations (e.g. non-idempotent constraint adds) can abort the run before later files apply. Prefer **direct apply of missing files**.

From repo root, **after loading `.env_prod`** (section above):

```powershell
# PowerShell
psql $env:DATABASE_URL -f apps/api/src/db/migrations/028_player_skill_ratings_history.sql
psql $env:DATABASE_URL -f apps/api/src/db/migrations/029_games_and_game_performance.sql
psql $env:DATABASE_URL -f apps/api/src/db/migrations/030_sports_duration_players.sql
psql $env:DATABASE_URL -f apps/api/src/db/migrations/031_clubs_default_sport.sql
```

```bash
# bash
psql "$DATABASE_URL" -f apps/api/src/db/migrations/028_player_skill_ratings_history.sql
psql "$DATABASE_URL" -f apps/api/src/db/migrations/029_games_and_game_performance.sql
psql "$DATABASE_URL" -f apps/api/src/db/migrations/030_sports_duration_players.sql
psql "$DATABASE_URL" -f apps/api/src/db/migrations/031_clubs_default_sport.sql
```

Adjust the file list to your gap list; always keep **numeric order**.

- [ ] `.env_prod` was loaded into this shell before any `psql`.
- [ ] Each `psql -f` exited 0 (or equivalent Node `client.query` succeeded).
- [ ] Re-run section 2 verify queries — gaps closed.

### Optional: fresh / empty database only

Load `.env_prod` first so `scripts/db-bootstrap.js` picks up production `DATABASE_URL` via `process.env` (it also calls `dotenv.config()` for `.env` — ensure this shell’s env already has the prod URL, or temporarily avoid a conflicting `.env`).

```powershell
# PowerShell — .env_prod already loaded into Env:
npm run db:bootstrap
```

Creates the DB if missing, applies `apps/api/src/db/schema/deploy.sql` (fallback `tables.sql`), then all migrations. **Not** the default path for an existing production database.

---

## 4. Data / ops scripts (opt-in only)

These are **not** schema migrations. Run only with an explicit prod decision:

| Script | Effect |
|--------|--------|
| `scripts/purge-qa-skills.js` | Deletes QA leftover skills (destructive) |
| `scripts/purge-soccer-position-orphans.js` | Cleans Soccer position orphans |

- [ ] Skipped by default, **or** run intentionally with prod URL after backup/approval.

---

## 5. Deploy application code

- [ ] Deploy / sync the release commit that matches the schema you just applied.
- [ ] Restart the mockup/API process so it loads new handlers and SQL.
- [ ] Confirm the running process uses the **same** production DB as `.env_prod` (`DATABASE_URL`).
- [ ] If link ingest / video processing is in scope: confirm `yt-dlp` (or `processing_config.ytdlp_path`) is available on the host.

---

## 6. Smoke test (production)

Log in as the roles you care about; check only features this release touches.

| Area | Check |
|------|--------|
| Auth / club session | Multi-club user sees club select; header shows active club |
| S9 Assessment history | Open a player assessment path; history loads without 500 |
| S10 Games | List/create fixture; open Game Sheet; ratings persist after reopen |
| S8 Skills | Sport filter / club default sport behave as expected |
| S4 link ingest | Link mode UI/API if 027 was applied |
| Users nav | SystemAdmin/ClubAdmin see Users; Coach does not |

- [ ] No new `42703` / undefined_column / undefined_table errors in server logs (`log/` or host logs).
- [ ] Critical happy paths above pass.

---

## 7. Rollback / mitigation

| Situation | Action |
|-----------|--------|
| New code 500s with missing relation/column | Re-check section 2; apply the missing migration file; restart if needed |
| Migration applied but feature unwanted | Prefer code rollback first. Schema DDL is mostly additive; dropping tables/columns is a separate, explicit ops decision |
| Wrong database targeted | Stop immediately; rotate credentials if needed; do not continue applies |

There is no automated down-migration in this repo.

---

## 8. Post-deploy record

- [ ] Note date, commit SHA, migrations applied, who applied them.
- [ ] Note any skipped opt-in scripts.
- [ ] If something failed mid-apply, leave a short note for the next deploy (which file failed, error text).

---

## Quick reference

| Task | Command / location |
|------|--------------------|
| Prod credentials | Repo-root `.env_prod` (`DATABASE_URL=...`) — load into shell before ops |
| Bootstrap (fresh DB) | Load `.env_prod`, then `npm run db:bootstrap` → `scripts/db-bootstrap.js` |
| Apply one migration | `psql $env:DATABASE_URL -f apps/api/src/db/migrations/NNN_name.sql` (after `.env_prod`) |
| Canonical schema | `apps/api/src/db/schema/deploy.sql` (+ keep in sync with migrations) |
| Migration files | `apps/api/src/db/migrations/` |
