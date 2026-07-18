---
title: "chore: Configure structured log path via .env"
type: chore
date: 2026-07-18
origin: user request
product_contract_source: ce-plan-bootstrap
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
---

# chore: Configure structured log path via .env

## Goal Capsule

- **Outcome:** Operators set the backend structured log file path in `.env` / `.env_prod` (documented in `.env.example`), using the existing `STRUCTURED_LOG_PATH` mechanism already honored by `scripts/logging/structured-logger.js`.
- **Authority:** User request (`/ce-plan move logfile path to .env`); existing logger path precedence.
- **Done when:** `.env.example` documents `STRUCTURED_LOG_PATH`; local/prod env samples can override the path; default remains `log/backend_logging.txt` when unset; no secret leakage; brief note in deploy checklist if useful.

## Product Contract

### Summary

The log destination is already overridable via `STRUCTURED_LOG_PATH`, but that is not listed in `.env.example`, so operators cannot discover or standardize it next to `DATABASE_URL`. Surface the variable in env files without changing default behavior when unset.

### Requirements

- R1. Document `STRUCTURED_LOG_PATH` in `.env.example` with a clear comment and a sensible example (repo-relative `log/backend_logging.txt` or an absolute path).
- R2. Keep logger precedence unchanged: `STRUCTURED_LOG_PATH` → legacy `VIDEO_PROCESSING_AUDIT_LOG_PATH` → default `log/backend_logging.txt` under `cwd`.
- R3. `scripts/serve-mockup.js` continues to load `.env` via `dotenv` before logging starts (already true); no new loader required for local.
- R4. Production may set the same key in `.env_prod` (gitignored); do not commit real prod paths with secrets, only the variable name in docs/examples.
- R5. Do not rename the env key in this change (avoid churn for any existing local overrides/tests).

### Scope Boundaries

- **In:** `.env.example` (and optional one-line deploy-checklist mention); confirm no code path ignores `.env` for the log path.
- **Out:** Changing log line format; rotating logs; writing to multiple files; removing the hardcoded default; forcing a required env var.

### Deferred to Follow-Up Work

- Drop legacy `VIDEO_PROCESSING_AUDIT_LOG_PATH` after confirming no callers.

## Planning Contract

### Assumptions

- User intent is **configuration discoverability** (path lives in `.env`), not a new logging system. `STRUCTURED_LOG_PATH` already implements the override.
- Default when unset should remain `log/backend_logging.txt` so clones work without copying `.env`.

### Key Technical Decisions

- KTD1. **Keep env name `STRUCTURED_LOG_PATH`** — already implemented and started in server console via `getLogPath()`; documenting it is enough.
- KTD2. **Example value** in `.env.example`: `STRUCTURED_LOG_PATH=log/backend_logging.txt` (relative; logger `path.resolve`s it) plus a commented absolute-path example for prod.
- KTD3. **No code change required** unless audit finds dotenv load order issues; if `structured-logger` is required before `dotenv.config()` anywhere, move config load earlier or load dotenv inside `getLogPath` once — verify during implementation.

## Implementation Units

### U1. Document STRUCTURED_LOG_PATH in env examples

**Goal:** Operators can set the log file path from `.env` / `.env_prod` without reading logger source.

**Requirements:** R1, R4, R5

**Dependencies:** None

**Files:**

- Modify: `.env.example`
- Optionally modify: `docs/deployment/production-checklist.md` (one bullet under preconditions or quick reference: set `STRUCTURED_LOG_PATH` in `.env_prod` if not using the default)

**Approach:** Add a commented section mirroring `DATABASE_URL` / `VANTAGEIQ_VIDEO_ROOT`. Do not edit real `.env` / `.env_prod` in the PR (gitignored); mention in verification that operators may add the key locally.

**Test expectation:** none — docs/config sample only.

**Verification:** `.env.example` contains `STRUCTURED_LOG_PATH` with comments; checklist note present if touched.

### U2. Confirm dotenv + logger wiring (fix only if broken)

**Goal:** Setting the key in `.env` actually changes `getLogPath()` when the mockup server runs.

**Requirements:** R2, R3

**Dependencies:** None

**Files:**

- Inspect: `scripts/serve-mockup.js`, `scripts/logging/structured-logger.js`, `apps/api/tests/integration/logging/structured-logger.spec.ts`
- Modify only if dotenv runs after first log write or is missing on a hot path

**Approach:** Confirm `dotenv.config({ path: …/.env })` runs at top of `serve-mockup.js` before queue/logging. Confirm startup already prints `Structured log file: …`. If another entrypoint writes logs without dotenv, add the same `.env` load or document that those entrypoints need the var in the process environment.

**Execution note:** Smoke: set `STRUCTURED_LOG_PATH` in a temp env or local `.env`, start server, confirm console path matches; unset and confirm default `log/backend_logging.txt`.

**Test scenarios:**

- Happy path: With `STRUCTURED_LOG_PATH` set to a temp absolute path, `getLogPath()` returns that resolved path.
- Edge: Unset env → default under `cwd/log/backend_logging.txt`.
- Compat: Legacy `VIDEO_PROCESSING_AUDIT_LOG_PATH` still wins only when primary unset.

**Verification:** Run existing Vitest `apps/api/tests/integration/logging/structured-logger.spec.ts` (covers `getLogPath` default and `STRUCTURED_LOG_PATH`); add legacy-path coverage there if missing; manual smoke optional.

## Verification Contract

- `.env.example` documents `STRUCTURED_LOG_PATH`.
- Precedence in `structured-logger.js` unchanged unless a load-order bug forces a minimal fix.
- Server start log line reflects the configured path when set.
- No secrets committed.

## Definition of Done

- U1 complete; U2 verified (code change only if needed).
- Operators know to put the log path in `.env` / `.env_prod` beside other runtime config.
