---
title: feat — shared structured logging (functionality, timestamp, user) under log/
date: 2026-07-10
type: feat
classification: software
feature: 022
slug: feat-structured-logging-fields
product_contract_source: ce-plan-bootstrap
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
origin: docs/backlog/001-structured-logging-fields.md — scope option 2 (shared mockup-server logger); confirmed 2026-07-10 including log/ folder destination; unanswered call-outs resolved as KTDs (curated mutations + lifecycle; background jobs leave userId unset in v1).
---

# Feature 022 — Shared Structured Logging Fields

## Goal Capsule

- **Objective:** Introduce a shared structured logger used by the mockup server and video-processing pipeline. Every log line includes **functionality name**, **timestamp**, and **logged-in user id when available**. Persist files under **`log/`** (not repo root). Migrate Feature 019 video audit logging onto this logger.
- **Authority:** New shared module under `scripts/`; wire from `scripts/serve-mockup.js` and `scripts/video-processing/*`; keep `backend_logging.txt` semantics via path change to `log/backend_logging.txt`.
- **Done when:** Shared logger writes required fields; video events and curated API/lifecycle events append to `log/`; root `backend_logging.txt` no longer the default; Vitest covers field contract and path; gitignore covers `log/`.
- **Out:** Log aggregation (Datadog, etc.); DB audit tables; player-data / skill-rating history (backlog 008/012); log viewer UI; logging every read/GET; persisting `submitted_by` on clips for background attribution (deferred).

### Summary

Shared structured logger for the mockup server and video pipeline: required fields (functionality, timestamp, optional user id), files under `log/`, curated mutation/lifecycle coverage, Feature 019 audit logger migrated onto the shared module.

## Product Contract

### Problem Frame

Feature 019 already appends timestamped event lines for video processing, but lines lack a first-class **user id**, live at the **repo root**, and are **not shared** with the rest of the mockup API. Operators need one attributable, searchable log contract across request-path and background work.

### Actors

- A1. **Operator / developer** — reads files under `log/` to debug API and video-processing behavior.
- A2. **Logged-in user (Coach / SystemAdmin / etc.)** — identity may appear as `userId` on request-path events when the actor is known.
- A3. **Video processing pipeline** — emits lifecycle events; often has no session (user id unset unless a request-path event already carried it).

### Key Flows

- F1. Authenticated mutating API call with resolvable actor → log line with functionality name, ISO timestamp, and `userId`.
- F2. Unauthenticated or system path (no actor) → same fields, `userId` omitted or null.
- F3. Video upload / queue / process / complete → same shared logger and `log/` file; existing event names preserved where practical.
- F4. Server restart → append-only continues under `log/` without truncating prior history.

### Acceptance Examples

- AE1. After login + a mutating API call with known actor, `log/backend_logging.txt` contains a line with ISO timestamp, functionality name, and that user's id.
- AE2. `queue.started` / `clip.processing.started` lines include timestamp + functionality name and omit `userId` (or set null) when no session exists.
- AE3. Successful clip cycle still produces the Feature 019 event sequence via the shared logger into `log/backend_logging.txt`.
- AE4. Default log path is under `log/` (not repo-root `backend_logging.txt`); env override still works for tests.
- AE5. Logger I/O failure does not crash request handling or video processing.

### Requirements

#### Required fields

- R1. Every structured log entry includes **functionality name** (stable operation/event identifier).
- R2. Every structured log entry includes an **ISO-8601 timestamp**.
- R3. Every structured log entry includes **logged-in user id when available**; omit or set null when not available.
- R4. Do not invent a user id for background jobs in v1 when no session/actor is present.

#### Shared logger and destination

- R5. Provide a shared logger module usable from `scripts/serve-mockup.js` and `scripts/video-processing/`.
- R6. Default log file path is under folder **`log/`** (e.g. `log/backend_logging.txt` at repo root relative to `process.cwd()`).
- R7. Create `log/` if missing on write.
- R8. Env override for log path remains available for tests (prefer a shared env name; keep temporary compatibility with `VIDEO_PROCESSING_AUDIT_LOG_PATH` if needed during migration).
- R9. Append-only writes; logger failures must not crash callers (catch + `console.error` fallback).

#### Coverage (curated)

- R10. Migrate all existing Feature 019 `logAuditEvent` call sites to the shared logger (same event coverage).
- R11. Wire curated mockup-server events: server start, auth login success/failure, and mutating API operations (POST/PATCH/PUT/DELETE) where an actor can reasonably be resolved from query/body — not every GET/list read.
- R12. Preserve Feature 019 non-sensitive content rules (no video bytes, base64 frames, full LLM bodies, passwords/tokens).

#### Repository hygiene

- R13. Gitignore `log/` contents (and stop relying on root `backend_logging.txt` as the default destination; keep ignoring root file if still present locally).
- R14. Update backlog item `docs/backlog/001-structured-logging-fields.md` to `planned` with a link to this plan when implementation starts or when this plan is accepted (planner may mark planned on write).

### Scope Boundaries

#### In scope

- Shared logger module under `scripts/` (e.g. `scripts/logging/` or equivalent)
- Thin compatibility shim or migration of `scripts/video-processing/audit-logger.js`
- Wiring in `scripts/serve-mockup.js` for curated events + actor resolution helpers already used (`actorEmail` → user id)
- `.gitignore` for `log/`
- Vitest updates/extension for the shared field contract and default path under `log/`
- Short cross-reference note vs Feature 019 plan (optional appendix)

#### Deferred to Follow-Up Work

- Persist `submitted_by` on clips and stamp processing events with that user id
- Log every API request including GETs
- Log rotation / max size
- Centralized shipping / aggregation
- DB-backed audit / player change history / skill rating history (backlog 008, 010, 012)
- Admin UI log viewer

#### Outside this product's identity

- Replacing `console.log` for all developer diagnostics
- Client-side browser logging

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Scope | Shared mockup-server + video logger | User chose option 2 |
| Destination | `log/` folder | Explicit user request |
| Coverage | Curated mutations + lifecycle (not all GETs) | Confirmed scope; unanswered call-out default |
| Background `userId` | Unset/null in v1 | Avoid schema change; deferred carry-forward |
| Format | Keep Feature 019 line shape; put required fields in envelope | Minimal churn for operators already reading the file |

## Planning Contract

### Key Technical Decisions

- KTD1. **Shared module API** — export something like `logEvent({ functionality, userId, details })` (names flexible) that always writes timestamp + functionality + optional userId. Video code may keep calling `logAuditEvent(event, details)` via a thin wrapper that maps `event` → functionality and merges `userId` from details when present.
- KTD2. **Line format** — preserve human-readable prefix style from Feature 019:
  `ISO_TIMESTAMP FUNCTIONALITY_NAME {json}`
  where JSON always includes `userId` key when known, and may omit it or use `null` when unknown. Functionality name is the second token (same role as today's event name).
- KTD3. **Default path** — `path.join(process.cwd(), 'log', 'backend_logging.txt')`. Env override: `STRUCTURED_LOG_PATH` (primary); if unset, fall back to `VIDEO_PROCESSING_AUDIT_LOG_PATH` for one release of compatibility.
- KTD4. **Video shim** — `scripts/video-processing/audit-logger.js` re-exports/wraps the shared logger so existing requires keep working; implementation lives in the shared module.
- KTD5. **Mockup wiring** — add a small helper near API handlers that resolves `userId` from `actorEmail` (query or JSON body) when already loaded, and logs mutating routes + login + server listen. Do not require a full middleware rewrite of `serve-mockup.js` in v1; prefer a helper called at handler entry/exit for curated paths.
- KTD6. **Tests** — extend/replace `apps/api/tests/integration/video-processing/audit-logger.spec.ts` (or add sibling) to assert: default path contains `/log/`, required fields present, missing userId allowed, append + non-throwing failure behavior.

### Assumptions

- Confirmed unanswered call-outs: curated coverage; background jobs leave `userId` unset in v1.
- Existing Feature 019 event names remain valid functionality names for video events.
- `log/` is local/dev artifact storage (like `data/clip-videos/`), not committed.

### Risks and Mitigations

| Risk | Mitigation |
|---|---|
| `serve-mockup.js` is large; easy to miss mutation routes | Start with login + a representative set of POST/PATCH handlers; document remaining routes as follow-up if time-boxed |
| Operators still look at root `backend_logging.txt` | Note path change in plan DoD; gitignore both; optional one-line console hint on server start with log path |
| Dual env vars confuse tests | Document precedence in module header comment; tests set `STRUCTURED_LOG_PATH` |

### Dependencies and Sequencing

1. Shared logger + path under `log/` + tests
2. Video shim / migrate Feature 019 callers (should be no-op if shim preserves API)
3. Mockup curated wiring + gitignore
4. Smoke: server start + one API mutation + one video event land in `log/`

## Implementation Units

### U1. Shared structured logger + `log/` destination

**Goal:** Create the shared logger with required fields and default path under `log/`.

**Requirements:** R1–R9, R12–R13

**Files:**
- Create: `scripts/logging/structured-logger.js` (or equivalent under `scripts/logging/`)
- Modify: `.gitignore`
- Test: `apps/api/tests/integration/logging/structured-logger.spec.ts` (new) and/or update existing audit-logger spec

**Approach:**
- Implement append-only writer with ISO timestamp, functionality name, JSON details including optional `userId`.
- Default to `log/backend_logging.txt`; honor env override precedence (KTD3).
- Swallow write errors; fall back to `console.error`.

**Test scenarios:**
- Default `getLogPath()` resolves under `log/`.
- Written line matches timestamp + functionality + JSON; includes `userId` when provided; omits/null when not.
- Two appends produce two lines; invalid path does not throw.

**Verification:** Vitest for the new/updated logger spec.

### U2. Migrate video-processing audit logger onto shared module

**Goal:** Feature 019 call sites keep working while writing through the shared logger into `log/`.

**Requirements:** R10, R4, R12

**Files:**
- Modify: `scripts/video-processing/audit-logger.js`
- Touch as needed only if imports must change: `queue.js`, `clip-upload.js`, `process-clip.js`, `ollama-client.js`
- Update: `apps/api/tests/integration/video-processing/audit-logger.spec.ts`

**Approach:**
- Turn `audit-logger.js` into a thin wrapper around the shared module mapping `logAuditEvent(event, details)` → shared `logEvent`.
- Prefer zero churn at call sites; pass through `details.userId` if ever present.
- Update tests to use `STRUCTURED_LOG_PATH` (and/or legacy env) and assert compatibility.

**Test scenarios:**
- Existing audit-logger tests still pass against temp path.
- `logAuditEvent('clip.claimed', { clipId: 'c_1' })` produces functionality `clip.claimed` without requiring `userId`.

**Verification:** Vitest audit-logger + structured-logger specs.

### U3. Wire curated mockup-server structured logs

**Goal:** Emit structured logs for server lifecycle, auth login, and mutating API operations with user id when resolvable.

**Requirements:** R3, R11, R12

**Files:**
- Modify: `scripts/serve-mockup.js`
- Optional note: `docs/ux/mockup/API-Mockup-Mapping.md` or Feature 019 plan appendix cross-link

**Approach:**
- Import shared logger.
- On successful listen, log functionality such as `server.started` (no userId).
- On `POST /api/v1/auth/login`, log success/failure with `userId` when login resolves a user.
- For curated mutating handlers, after actor resolution, log functionality named from method+route or a stable operation name, including `userId` when known.
- Keep existing `console.log('API request', …)` unless trivially replaced; structured log supplements it.

**Test scenarios:**
- Prefer unit-level coverage of any pure helper that builds the log payload from actor + route.
- Manual smoke acceptable for full HTTP path: start server, login, one PATCH/POST, confirm lines in `log/backend_logging.txt`.

**Verification:** Helper unit tests if extracted; otherwise manual smoke checklist in Verification Contract.

## Verification Contract

### Test commands

```bash
npx vitest run apps/api/tests/integration/logging/structured-logger.spec.ts
npx vitest run apps/api/tests/integration/video-processing/audit-logger.spec.ts
```

(Adjust paths if implementer colocates tests differently; keep them under `apps/api/tests/`.)

### Manual smoke

1. Start mockup server with `DATABASE_URL` set.
2. Confirm console or filesystem shows writes under `log/` (file created on first event).
3. Login via S0; confirm login-related structured line includes `userId` when applicable.
4. Perform one mutating API action (e.g. update player/team) and confirm functionality + `userId`.
5. Trigger or observe a video queue event; confirm line in same `log/` file without requiring `userId`.

### Quality gates

- No secrets/tokens/video payloads in log details.
- `.gitignore` includes `log/` (and still covers stray root `backend_logging.txt` if desired).

## Definition of Done

- [ ] Shared logger implements functionality + timestamp + optional userId
- [ ] Default destination is under `log/`
- [ ] Video-processing audit events use the shared logger
- [ ] Curated mockup-server events are wired
- [ ] Vitest coverage for logger field contract and path
- [ ] Manual smoke checklist passed
- [ ] `docs/backlog/001-structured-logging-fields.md` marked `planned` with link to this plan

## Appendix

### Origin backlog

- `docs/backlog/001-structured-logging-fields.md`

### Related plans

- `docs/plans/2026-07-09-019-feat-video-processing-audit-logging-plan.md`

### Confirmed scope dialogue

- Shared logger for whole mockup server (option 2)
- Persist under `log/` folder
- Defaults for unanswered call-outs: curated mutations/lifecycle; background `userId` unset in v1
