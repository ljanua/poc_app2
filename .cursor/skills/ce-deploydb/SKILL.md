---
name: ce-deploydb
description: >-
  Prepare and run production deploys using a timestamped checklist under
  docs/deployment/production-checklist-YYYYMMDD-HHMM.md. Creates or refreshes
  that checklist from current migrations and .env_prod, then requires an
  explicit human review before applying schema or restarting prod. Use when
  the user says deploy, production deploy, /ce-deploy, /ce-deploydb, ship to
  prod, or apply migrations to production.
argument-hint: "[optional: schema-only | code-only | full]"
---

# /ce-deploydb

Production deploy workflow for this repo. **Never apply migrations, restart prod, or run destructive ops scripts until the user has reviewed the checklist and explicitly approved deployment.**

Downstream / related:

- Checklist path pattern: `docs/deployment/production-checklist-YYYYMMDD-HHMM.md` (local time, 24-hour `HHMM`)
- Legacy untimestamped path (migrate away): `docs/deployment/production-checklist.md`
- Credentials: repo-root `.env_prod` (`DATABASE_URL`) — never commit
- Migrations: `apps/api/src/db/migrations/`
- Bootstrap (fresh DB only): `npm run db:bootstrap` → `scripts/db-bootstrap.js`
- Prefer `main`; do not create branches unless the user asks (see project rule `prefer-main-no-auto-branches`)

## Checklist filename

Every deploy run uses a **new or current-session** checklist file named:

```text
docs/deployment/production-checklist-YYYYMMDD-HHMM.md
```

Examples: `production-checklist-20260720-1741.md`

Rules:

1. At the start of Phase 1, compute `STAMP` as local time `yyyyMMdd-HHmm` (PowerShell: `Get-Date -Format 'yyyyMMdd-HHmm'`; bash: `date +%Y%m%d-%H%M`).
2. Set `CHECKLIST_PATH=docs/deployment/production-checklist-${STAMP}.md`.
3. Use that path for create/refresh/review/handoff for the rest of the run. Do **not** write deploy updates back to a bare `production-checklist.md`.
4. If a legacy `docs/deployment/production-checklist.md` exists and no timestamped file is being seeded yet, **copy or move** its content into the new `CHECKLIST_PATH`, then prefer deleting or leaving the legacy file untouched (do not keep dual sources of truth for the active run). Prefer **rename/move** when this is the first migration to the stamped naming.
5. If the user points at an existing stamped checklist, refresh **that** file in place instead of minting a second stamp in the same conversation turn (unless they ask for a fresh stamped copy).

## Usage

```text
/ce-deploydb                 # Full path: ensure checklist → refresh → review gate → deploy if approved
/ce-deploydb schema-only     # Schema/migrations only after review
/ce-deploydb code-only       # App restart / code sync only (still review checklist smoke section)
/ce-deploydb full            # Schema then code (default when unspecified)
```

## Hard rules

1. **Review gate is mandatory.** After the checklist is current, stop and ask the user to review it. Do not run `psql`, bootstrap, purge scripts, or prod restarts until they approve (e.g. “approved”, “deploy”, “go”).
2. **Create checklist if missing.** If `CHECKLIST_PATH` does not exist, create `docs/deployment/` if needed and write the file from `references/checklist-template.md` in this skill directory, then customize for the repo’s current migrations and `.env_prod` convention. Seed from the newest existing `production-checklist-*.md` or legacy `production-checklist.md` when available.
3. **Keep the checklist up to date** before every review gate (see Refresh below).
4. **Use `.env_prod` only** for production `DATABASE_URL`. Never use `.env` for prod applies. Do not print connection strings or secrets.
5. **Do not create git branches** unless the user explicitly asks.
6. **Do not commit `.env_prod`.** Prefer leaving deploy artifacts uncommitted unless the user asks to commit checklist updates.

## Workflow

### Phase 1 — Resolve stamped checklist path

1. Resolve repo root.
2. Compute `STAMP=yyyyMMdd-HHmm` (local) and `CHECKLIST_PATH=docs/deployment/production-checklist-${STAMP}.md` (unless the user named an existing stamped checklist to reuse).
3. Ensure `docs/deployment/` exists.
4. If `CHECKLIST_PATH` is missing:
   - If legacy `docs/deployment/production-checklist.md` exists, **rename/move** it to `CHECKLIST_PATH` (preferred first migration to stamped names).
   - Else if other `docs/deployment/production-checklist-*.md` files exist, copy the **newest by filename stamp** into `CHECKLIST_PATH`.
   - Else create `CHECKLIST_PATH` from this skill’s `references/checklist-template.md`, fill migrations from Phase 2, and confirm `.env_prod` load instructions match the template (PowerShell + bash).
5. Proceed to Phase 2 with `CHECKLIST_PATH` as the only active checklist for this run.

### Phase 2 — Refresh checklist (always)

Before asking for review, make **`CHECKLIST_PATH`** match the repo:

1. List `apps/api/src/db/migrations/*.sql` sorted by name. Note the highest `NNN`.
2. Open `CHECKLIST_PATH`.
3. Update the **migration baseline / order table** so every migration that may still be pending on prod is listed (at minimum include any `NNN` newer than the last row already documented; keep earlier rows that are still relevant as a historical baseline).
4. For each newly added migration file, add a short “what it adds” blurb from the SQL header comments (do not invent columns).
5. Ensure sections still cover: load `.env_prod`, preconditions, verify queries (add verify SQL for new tables/columns when obvious from the migration), apply commands, optional data scripts, code deploy/restart, smoke tests, rollback, quick reference.
6. Keep smoke tests aligned with features those migrations unlock (Games, assessment history, club default sport, etc.).
7. If `.gitignore` does not ignore `.env_prod`, add it.
8. Summarize for the user: **stamped checklist path**, migrations added/changed in this refresh, mode (`schema-only` / `code-only` / `full`).

### Phase 3 — Review gate (blocking)

Present a short summary:

- Checklist path (`CHECKLIST_PATH`, repo-relative + absolute if helpful)
- Deploy mode
- Migrations that appear in the checklist apply list for this run
- Reminder: credentials come from `.env_prod`

Then ask (blocking question tool if available; otherwise numbered options in chat):

**“Please review `docs/deployment/production-checklist-YYYYMMDD-HHMM.md`. Approve deployment?”**
(use the real stamped filename)

Options:

1. **Approved — proceed with deploy** (mode from argument / default `full`)
2. **Edit checklist first** — user will say what to change; apply edits to `CHECKLIST_PATH`, re-run Phase 2 summary, ask again
3. **Cancel** — stop; no prod changes

Do **not** proceed on silence. If the user only says they “looked at it” without approving, ask again for explicit approval.

### Phase 4 — Deploy (only after approval)

Follow the checklist at `CHECKLIST_PATH`. Default order for `full`:

1. Load `.env_prod` into the shell (per checklist). Confirm `DATABASE_URL` is set by printing **length only**, never the value.
2. Identity check: `psql`/`query` `current_database()` (and server addr if available) — show the user the **database name** and get a quick confirm if it looks wrong.
3. Run verify queries from the checklist; build the gap list.
4. Apply **only missing** migration files in numeric order via `psql $env:DATABASE_URL -f …` (or bash / Node `pg` equivalent when `psql` is unavailable).
5. Re-verify gaps closed.
6. Skip purge / data scripts unless the user explicitly asked for them in this session.
7. For `code-only` or `full`: remind or assist with app restart / deploy of the intended `main` commit; confirm the running process uses the same DB as `.env_prod`.
8. Walk smoke-test section; note failures.

If `schema-only`, stop after migration verify. If `code-only`, skip migration apply unless verify shows a hard blocker — then stop and report rather than applying without a new approval.

### Phase 5 — Handoff

Report:

- What was applied (migration filenames)
- What was skipped
- Smoke results / follow-ups
- Checklist path created or updated (`CHECKLIST_PATH` only)

Do not push to remote or delete branches unless the user asks.

## Refresh heuristics

| Signal | Action |
|--------|--------|
| New `NNN_*.sql` not in checklist table | Add row + verify snippet if useful |
| Checklist missing `.env_prod` load section | Restore from template |
| Checklist still says “generic prod env file” | Replace with `.env_prod` |
| User names a baseline plan (e.g. Users bottom-nav) | Keep as historical note; still list all later migrations |
| Legacy `production-checklist.md` still present | Migrate content into a stamped file on next `/ce-deploydb` run |

## Anti-patterns

- Applying migrations “to save a round trip” before review approval
- Using `.env` or echoing secrets
- Creating `feat/` / `fix/` branches for deploy
- Writing deploy refreshes to untimestamped `production-checklist.md`
- Running `npm run db:bootstrap` on an existing prod DB without calling out the checklist warning and getting explicit approval for bootstrap
- Running `purge-qa-skills.js` / orphan purge on prod without a separate explicit ask

## References

- Checklist template (create path): `references/checklist-template.md`
- Active checklist pattern: `docs/deployment/production-checklist-YYYYMMDD-HHMM.md`
