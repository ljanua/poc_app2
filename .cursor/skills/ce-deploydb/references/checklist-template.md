# Production deployment checklist

**Filename:** write each deploy run to `docs/deployment/production-checklist-YYYYMMDD-HHMM.md` (local time). Do not use an untimestamped `production-checklist.md` as the active checklist.

Use this before shipping mockup/API code that depends on Postgres schema under `apps/api/src/db/`.

**Authority:** apply migrations manually against the production `DATABASE_URL` from repo-root **`.env_prod`**. There is no automatic migrate-on-deploy and no migration-history table. Confirm with `information_schema` (or a known failing query), then apply missing SQL files in number order.

Related: `docs/solutions/database-issues/serve-mockup-500-birth-month-column-not-applied.md` (when present).

### Load production `DATABASE_URL` from `.env_prod`

Repo-root file `.env_prod` holds production secrets (`DATABASE_URL=...`). Keep it gitignored / uncommitted.

**PowerShell (repo root):**

```powershell
Get-Content .\.env_prod | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
  $name, $value = $_ -split '=', 2
  Set-Item -Path "Env:$($name.Trim())" -Value $value.Trim().Trim('"').Trim("'")
}
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
- [ ] `psql` is on PATH, **or** you can run SQL via a one-off `pg.Client`.
- [ ] App process that will serve the new code is identified so you can restart after schema + code land.
- [ ] Deploy mode known: **schema-only** | **code-only** | **full**. Prefer **schema first**, then code restart, when new columns/tables are required.

---

## 1. Identify required migrations

Migrations live in `apps/api/src/db/migrations/` (`NNN_*.sql`, sorted by filename).

- [ ] List migration files introduced since the last successful production schema apply.
- [ ] For each file, skim the SQL: prefer `IF NOT EXISTS` / idempotent forms; note any `DROP CONSTRAINT` / `SET NOT NULL` that need extra care.

### Migration apply order (keep current)

<!-- ce-deploy: replace/extend this table from apps/api/src/db/migrations/*.sql -->

| Order | File | What it adds |
|------:|------|----------------|
| 1 | `(populate from migrations)` | |

Skip any row already verified present on production. Apply remaining files **in numeric order**.

---

## 2. Verify current production schema (before apply)

Connect with `DATABASE_URL` loaded from `.env_prod`. Record results (yes/no).

```powershell
psql $env:DATABASE_URL -c "SELECT current_database(), inet_server_addr();"
```

Confirm the database name matches production before applying anything.

Add verify SQL for each pending migration (tables/columns from the migration file headers). Example shape:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('/* pending tables */');
```

- [ ] Gap list written down (only missing migrations will be applied).

---

## 3. Apply missing migrations

**Do not** assume `npm run db:bootstrap` is safe on an already-provisioned production DB. Prefer **direct apply of missing files**.

```powershell
# After loading .env_prod — example; use your gap list in numeric order:
psql $env:DATABASE_URL -f apps/api/src/db/migrations/NNN_name.sql
```

- [ ] `.env_prod` was loaded into this shell before any `psql`.
- [ ] Each `psql -f` exited 0.
- [ ] Re-run section 2 verify queries — gaps closed.

### Optional: fresh / empty database only

Load `.env_prod` first. Bootstrap also calls `dotenv.config()` for `.env` — ensure this shell already has the prod URL.

```powershell
npm run db:bootstrap
```

**Not** the default path for an existing production database.

---

## 4. Data / ops scripts (opt-in only)

Not schema migrations. Run only with an explicit prod decision:

| Script | Effect |
|--------|--------|
| `scripts/purge-qa-skills.js` | Deletes QA leftover skills (destructive) |
| `scripts/purge-soccer-position-orphans.js` | Cleans Soccer position orphans |

- [ ] Skipped by default, **or** run intentionally after backup/approval.

---

## 5. Deploy application code

- [ ] Deploy / sync the release commit that matches the schema you just applied.
- [ ] Restart the mockup/API process so it loads new handlers and SQL.
- [ ] Confirm the running process uses the **same** production DB as `.env_prod`.
- [ ] If video/link processing is in scope: confirm `yt-dlp` / `processing_config` as needed.

---

## 6. Smoke test (production)

| Area | Check |
|------|--------|
| Auth / club session | Expected login / club picker behavior |
| Core screens | No new 500s on primary coach/admin paths |
| Features unlocked by this migration set | Exercise each once |

- [ ] No new `42703` / undefined_column / undefined_table errors in server logs.
- [ ] Critical happy paths above pass.

---

## 7. Rollback / mitigation

| Situation | Action |
|-----------|--------|
| New code 500s with missing relation/column | Re-check verify queries; apply missing migration; restart if needed |
| Migration applied but feature unwanted | Prefer code rollback first; schema drops are a separate ops decision |
| Wrong database targeted | Stop immediately; rotate credentials if needed |

There is no automated down-migration in this repo.

---

## 8. Post-deploy record

- [ ] Note date, commit SHA, migrations applied, who applied them.
- [ ] Note any skipped opt-in scripts.
- [ ] If something failed mid-apply, note which file failed and the error text.

---

## Quick reference

| Task | Command / location |
|------|--------------------|
| Prod credentials | Repo-root `.env_prod` (`DATABASE_URL=...`) |
| Bootstrap (fresh DB) | Load `.env_prod`, then `npm run db:bootstrap` |
| Apply one migration | `psql $env:DATABASE_URL -f apps/api/src/db/migrations/NNN_name.sql` |
| Canonical schema | `apps/api/src/db/schema/deploy.sql` |
| Migration files | `apps/api/src/db/migrations/` |
