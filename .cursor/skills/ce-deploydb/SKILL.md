---
name: ce-deploydb
description: >-
  Prepare and run production deploys using docs/deployment/production-checklist.md.
  Creates or refreshes that checklist from current migrations and .env_prod,
  then requires an explicit human review before applying schema or restarting
  prod. Use when the user says deploy, production deploy, /ce-deploy, ship to
  prod, or apply migrations to production.
argument-hint: "[optional: schema-only | code-only | full]"
---

# /ce-deploy

Production deploy workflow for this repo. **Never apply migrations, restart prod, or run destructive ops scripts until the user has reviewed the checklist and explicitly approved deployment.**

Downstream / related:

- Checklist path: `docs/deployment/production-checklist.md`
- Credentials: repo-root `.env_prod` (`DATABASE_URL`) — never commit
- Migrations: `apps/api/src/db/migrations/`
- Bootstrap (fresh DB only): `npm run db:bootstrap` → `scripts/db-bootstrap.js`
- Prefer `main`; do not create branches unless the user asks (see project rule `prefer-main-no-auto-branches`)

## Usage

```text
/ce-deploy                 # Full path: ensure checklist → refresh → review gate → deploy if approved
/ce-deploy schema-only     # Schema/migrations only after review
/ce-deploy code-only       # App restart / code sync only (still review checklist smoke section)
/ce-deploy full            # Schema then code (default when unspecified)
```

## Hard rules

1. **Review gate is mandatory.** After the checklist is current, stop and ask the user to review it. Do not run `psql`, bootstrap, purge scripts, or prod restarts until they approve (e.g. “approved”, “deploy”, “go”).
2. **Create checklist if missing.** If `docs/deployment/production-checklist.md` does not exist, create `docs/deployment/` and write the file from `references/checklist-template.md` in this skill directory, then customize for the repo’s current migrations and `.env_prod` convention.
3. **Keep the checklist up to date** before every review gate (see Refresh below).
4. **Use `.env_prod` only** for production `DATABASE_URL`. Never use `.env` for prod applies. Do not print connection strings or secrets.
5. **Do not create git branches** unless the user explicitly asks.
6. **Do not commit `.env_prod`.** Prefer leaving deploy artifacts uncommitted unless the user asks to commit checklist updates.

## Workflow

### Phase 1 — Ensure checklist exists

1. Resolve repo root.
2. If `docs/deployment/production-checklist.md` is missing:
   - Create `docs/deployment/` if needed.
   - Copy structure from this skill’s `references/checklist-template.md`.
   - Fill migration table from current `apps/api/src/db/migrations/*.sql` (see Phase 2).
   - Confirm `.env_prod` load instructions match the template (PowerShell + bash).
3. If the file exists, proceed to Phase 2 (do not recreate from scratch; refresh in place).

### Phase 2 — Refresh checklist (always)

Before asking for review, make the checklist match the repo:

1. List `apps/api/src/db/migrations/*.sql` sorted by name. Note the highest `NNN`.
2. Open `docs/deployment/production-checklist.md`.
3. Update the **migration baseline / order table** so every migration that may still be pending on prod is listed (at minimum include any `NNN` newer than the last row already documented; keep earlier rows that are still relevant as a historical baseline).
4. For each newly added migration file, add a short “what it adds” blurb from the SQL header comments (do not invent columns).
5. Ensure sections still cover: load `.env_prod`, preconditions, verify queries (add verify SQL for new tables/columns when obvious from the migration), apply commands, optional data scripts, code deploy/restart, smoke tests, rollback, quick reference.
6. Keep smoke tests aligned with features those migrations unlock (Games, assessment history, club default sport, etc.).
7. If `.gitignore` does not ignore `.env_prod`, add it.
8. Summarize for the user: path to checklist, migrations added/changed in this refresh, mode (`schema-only` / `code-only` / `full`).

### Phase 3 — Review gate (blocking)

Present a short summary:

- Checklist path (repo-relative + absolute if helpful)
- Deploy mode
- Migrations that appear in the checklist apply list for this run
- Reminder: credentials come from `.env_prod`

Then ask (blocking question tool if available; otherwise numbered options in chat):

**“Please review `docs/deployment/production-checklist.md`. Approve deployment?”**

Options:

1. **Approved — proceed with deploy** (mode from argument / default `full`)
2. **Edit checklist first** — user will say what to change; apply edits, re-run Phase 2 summary, ask again
3. **Cancel** — stop; no prod changes

Do **not** proceed on silence. If the user only says they “looked at it” without approving, ask again for explicit approval.

### Phase 4 — Deploy (only after approval)

Follow the checklist. Default order for `full`:

1. Load `.env_prod` into the shell (per checklist). Confirm `DATABASE_URL` is set by printing **length only**, never the value.
2. Identity check: `psql`/`query` `current_database()` (and server addr if available) — show the user the **database name** and get a quick confirm if it looks wrong.
3. Run verify queries from the checklist; build the gap list.
4. Apply **only missing** migration files in numeric order via `psql $env:DATABASE_URL -f …` (or bash equivalent).
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
- Whether checklist file was created or updated (paths only)

Do not push to remote or delete branches unless the user asks.

## Refresh heuristics

| Signal | Action |
|--------|--------|
| New `NNN_*.sql` not in checklist table | Add row + verify snippet if useful |
| Checklist missing `.env_prod` load section | Restore from template |
| Checklist still says “generic prod env file” | Replace with `.env_prod` |
| User names a baseline plan (e.g. Users bottom-nav) | Keep as historical note; still list all later migrations |

## Anti-patterns

- Applying migrations “to save a round trip” before review approval
- Using `.env` or echoing secrets
- Creating `feat/` / `fix/` branches for deploy
- Running `npm run db:bootstrap` on an existing prod DB without calling out the checklist warning and getting explicit approval for bootstrap
- Running `purge-qa-skills.js` / orphan purge on prod without a separate explicit ask

## References

- Checklist template (create path): `references/checklist-template.md`
- Existing live checklist (when present): `docs/deployment/production-checklist.md`
