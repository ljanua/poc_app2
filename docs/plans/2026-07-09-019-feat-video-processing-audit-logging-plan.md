---
title: feat — video processing audit logging
date: 2026-07-09
type: feat
classification: software
feature: 019
slug: feat-video-processing-audit-logging
product_contract_source: ce-plan-bootstrap
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
origin: user request in chat on 2026-07-09 — audit logging for the video processing service; persist log lines to backend_logging.txt.
---

# Feature 019 — Video Processing Audit Logging

## Goal Capsule

- **Objective:** Add structured audit logging across the Feature 018 video processing pipeline. Every significant lifecycle event (upload, queue claim, segment assessment, completion, failure) appends a line to **`backend_logging.txt`** at the repository root.
- **Authority:** `scripts/video-processing/` modules only; no UI or API contract changes.
- **Done when:** A clip upload → process → complete/fail cycle produces a readable, timestamped audit trail in `backend_logging.txt`; existing `console.log`/`console.error` behavior preserved; log file gitignored; unit tests cover the logger.
- **Out:** Centralized log aggregation (Datadog, etc.); DB-backed audit table; log rotation UI; logging clip video bytes or base64 frame payloads.

## Product Contract

### Problem Frame

Video processing runs asynchronously with external dependencies (ffmpeg, Ollama). When a clip stalls or fails, operators only have sparse `console.error` output tied to the terminal session. A durable file audit log makes it possible to trace what happened to each clip without replaying the server console.

### Actors

- A1. **Operator / developer** — reads `backend_logging.txt` after a failed or slow assessment.
- A2. **Video processing pipeline** — emits audit events at state transitions.

### Key Flows

- F1. Server starts with `DATABASE_URL` → queue start event logged to `backend_logging.txt`.
- F2. S4 multipart upload succeeds → `clip.submitted` event with clip id, player id, file metadata.
- F3. Queue claims clip → `clip.claimed` (`submitted` → `in_progress`).
- F4. `processClip` runs → `clip.processing.started`, per-segment `clip.segment.assessed`, optional `clip.assessment.early_stop`, then `clip.complete` or `clip.failed`.
- F5. Ollama call per segment → `ollama.request` / `ollama.response` (duration, model; no image payloads).

### Acceptance Examples

- AE1. After one successful clip assessment, `backend_logging.txt` contains at least: `queue.started`, `clip.submitted`, `clip.claimed`, `clip.processing.started`, `clip.segment.assessed`, `clip.complete`.
- AE2. Ollama failure → log line `clip.failed` with error message; no uncaught logger exceptions.
- AE3. Restarting the server appends new lines without truncating prior history (append-only).
- AE4. Log lines do not contain base64 image data or full video file contents.

### Requirements

#### Logger module

- R1. New module `scripts/video-processing/audit-logger.js` exports `logAuditEvent(event, details)`.
- R2. Default log path: `path.join(process.cwd(), 'backend_logging.txt')` — overridable via env `VIDEO_PROCESSING_AUDIT_LOG_PATH` for tests.
- R3. Each line format: ISO-8601 timestamp, event name, JSON-serialized details object, newline-terminated. Example:
  ```
  2026-07-09T21:30:00.123Z clip.claimed {"clipId":"c_123","playerId":"p_10"}
  ```
- R4. Append-only writes (`fs.appendFileSync` or equivalent); create file if missing.
- R5. Logger failures (disk full, permissions) must not crash processing — catch, fall back to `console.error`, continue pipeline.

#### Events to log

- R6. **Queue** (`queue.js`): `queue.started`, `queue.tick.error`, `clip.claimed`, `clip.dispatch.error`, `clip.unhandled_error`.
- R7. **Upload** (`clip-upload.js`): `clip.submitted` (clipId, playerId, filename, mimeType, fileSizeBytes, skillFocus count).
- R8. **Processing** (`process-clip.js`): `clip.processing.started` (clipId, playerName, sportType, skillFocus list length), `clip.processing.no_video`, `clip.segment.assessed` (clipId, segmentIndex, ratedSkillCount, earlyStop), `clip.complete` (clipId, score, ratedSkillCount), `clip.failed` (clipId, error message).
- R9. **Ollama** (`ollama-client.js`): `ollama.request` (model, skillCount), `ollama.response` (model, durationMs, parsedRatingCount), `ollama.error` (model, status/error).

#### Non-sensitive content

- R10. Do **not** log: video file buffers, base64 frames, full LLM response bodies, player birth dates (age number is OK), passwords/tokens.
- R11. Situation text may be truncated to 200 chars in log details.

#### Repository hygiene

- R12. Add `backend_logging.txt` to `.gitignore`.
- R13. Keep existing `console.log` / `console.error` calls (audit log supplements, does not replace).

### Scope Boundaries

#### In scope

- `scripts/video-processing/audit-logger.js` (new)
- Wire calls in `queue.js`, `clip-upload.js`, `process-clip.js`, `ollama-client.js`
- `.gitignore` update
- Vitest unit tests for logger
- Short note in `docs/plans/2026-07-09-018-feat-s4-video-processing-service-plan.md` appendix (cross-reference) optional; note in Feature 019 only is sufficient

#### Deferred

- `processing_config` row for log path (env override is enough for v1)
- Log rotation / max file size
- Structured JSON-per-line log shipping
- Audit log viewer in S6 or admin UI

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Log destination | Single file `backend_logging.txt` at repo root | Explicit user request |
| Write mode | Append-only | Preserve history across restarts |
| Format | `timestamp event {json}` | Human-readable + machine-parseable |
| Failure mode | Swallow logger errors | Processing must not fail because logging failed |
| Sensitive data | Exclude frames/video/LLM bodies | Audit trail without storage bloat or leakage |

## Planning Contract

### Key Technical Decisions

- KTD1. **Logger API:**

```javascript
// scripts/video-processing/audit-logger.js
logAuditEvent('clip.claimed', { clipId, playerId });
```

- KTD2. **Ollama timing:** wrap `fetch` with `Date.now()` before/after; log duration in `ollama.response`.
- KTD3. **Early stop:** log `clip.segment.assessed` with `earlyStop: true` on the segment that triggers `shouldStopAssessing`.
- KTD4. **Test isolation:** tests set `process.env.VIDEO_PROCESSING_AUDIT_LOG_PATH` to a temp file under `os.tmpdir()`.

### Risks

- **Concurrent writes:** multiple clips could append simultaneously. Mitigation: Node `appendFileSync` is atomic enough for single-process server; document that multi-process deployment needs a different sink.
- **Log growth:** unbounded file size. Deferred: rotation in a follow-up.

### Dependencies

- Feature 018 video processing modules (shipped).

## Implementation Units

### U1. Audit logger module

**Goal:** Central append-only file logger.

**Requirements:** R1–R5, R12.

**Files:**
- `scripts/video-processing/audit-logger.js` (new)
- `.gitignore`

**Approach:**
- `getLogPath()` reads env or default `backend_logging.txt`
- `logAuditEvent(event, details)` formats line and appends
- Export `getLogPath` for tests

**Test scenarios:**
- Appends two lines to temp path; second line preserves first
- Invalid path does not throw (falls back to console.error)

**Verification:** Vitest `audit-logger.spec.ts`

---

### U2. Wire queue and upload events

**Goal:** Log submission and queue lifecycle.

**Requirements:** R6, R7.

**Files:**
- `scripts/video-processing/queue.js`
- `scripts/video-processing/clip-upload.js`

**Approach:**
- Replace or supplement key `console.error` sites with `logAuditEvent`
- `queue.started` on `startVideoProcessingQueue`
- `clip.submitted` after successful INSERT in `createClipUpload`
- `clip.claimed` after transaction commit in `claimNextSubmittedClip`

**Verification:** Manual smoke — upload clip, inspect `backend_logging.txt`

---

### U3. Wire processing and Ollama events

**Goal:** Log assessment pipeline internals.

**Requirements:** R8, R9, R10, R11.

**Files:**
- `scripts/video-processing/process-clip.js`
- `scripts/video-processing/ollama-client.js`

**Approach:**
- Log at start, each segment, complete, failed
- Ollama request/response with timing; truncate situation in started event

**Verification:** Manual smoke with one clip; verify no base64 in log file

---

### U4. Tests

**Goal:** Lock logger contract.

**Requirements:** R1–R5.

**Files:**
- `apps/api/tests/integration/video-processing/audit-logger.spec.ts` (new)

**Approach:**
- Temp log path per test
- Assert line format regex and event names

**Verification:**
```bash
npx vitest run apps/api/tests/integration/video-processing/audit-logger.spec.ts
```

---

## Verification Contract

```bash
npx vitest run apps/api/tests/integration/video-processing/audit-logger.spec.ts
npx vitest run apps/api/tests/integration/video-processing/analyzer.spec.ts
```

**Manual:**
1. Start server with `DATABASE_URL`
2. Submit clip via S4 (or curl multipart)
3. Confirm `backend_logging.txt` contains `clip.submitted` through `clip.complete` or `clip.failed`

## Definition of Done

- R1–R13 satisfied
- `backend_logging.txt` gitignored
- No sensitive payloads in log lines
- Feature 018 processing behavior unchanged

## Appendix

### Event catalog

| Event | Module | When |
|---|---|---|
| `queue.started` | queue.js | `startVideoProcessingQueue` |
| `clip.submitted` | clip-upload.js | After DB insert |
| `clip.claimed` | queue.js | After status → `in_progress` |
| `clip.processing.started` | process-clip.js | Start of `processClip` |
| `clip.processing.no_video` | process-clip.js | Missing `video_storage_path` |
| `clip.segment.assessed` | process-clip.js | After each Ollama segment |
| `clip.complete` | process-clip.js | After `markClipComplete` |
| `clip.failed` | process-clip.js | Catch block / no-video path |
| `ollama.request` | ollama-client.js | Before fetch |
| `ollama.response` | ollama-client.js | After successful parse |
| `ollama.error` | ollama-client.js | On fetch/parse failure |
| `queue.tick.error` | queue.js | Poll tick catch |
| `clip.unhandled_error` | queue.js | `processClip` promise rejection |

### Cross-reference

- Parent feature: `docs/plans/2026-07-09-018-feat-s4-video-processing-service-plan.md`
