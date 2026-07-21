---
title: feat — video processing DEBUG env logs Ollama JSON
date: 2026-07-21
type: feat
classification: software
feature: 043
slug: feat-video-processing-debug-ai-json-log
product_contract_source: ce-plan-bootstrap
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
origin: User request 2026-07-21 — in process-clip.js add DEBUG from .env (default false); when ON, save AI model JSON output in logAuditEvent.
---

# Feature 043 — Video processing DEBUG AI JSON audit log

## Goal Capsule

- **Objective:** Add an opt-in **`DEBUG`** env flag (default **off**) so operators can trace what the Ollama assessment model returned during clip processing. When enabled, each segment review writes the model’s JSON (raw + parsed) to the structured audit log via `logAuditEvent`.
- **Authority:** `scripts/video-processing/config.js`, `scripts/video-processing/process-clip.js`, `scripts/video-processing/ollama-client.js`, `.env.example`. No DB schema, API, or UI changes.
- **Done when:** `DEBUG` unset or `false` → no change to today’s log volume; `DEBUG=true` (or equivalent truthy) → `ollama.response.debug` lines appear in the structured log with clip/segment correlation and model JSON; selftest covers env parsing.
- **Out:** Persisting debug payloads to Postgres; logging base64 frames; enabling DEBUG in production by default; log rotation UI.

### Summary

Wire a `.env`-driven debug switch so video assessment troubleshooting can inspect Ollama JSON in `backend_logging.txt` without changing normal production logging behavior.

## Product Contract

### Problem Frame

When assessments produce unexpected `comments` / SWOT (e.g. prose-only instead of sectioned arrays), operators must guess what the model returned. Feature 019 audit logs record counts (`strengthCount`, etc.) but not the response body. A debug flag makes prompt/parse issues diagnosable from the log file alone.

### Actors

- A1. **Developer / operator** — toggles `DEBUG` in local `.env`, re-processes a clip, reads structured log.
- A2. **Video processing worker** — emits debug audit events only when debug is on.

### Key Flows

- F1. Server starts with `DEBUG` unset → processing unchanged; no `ollama.response.debug` events.
- F2. Operator sets `DEBUG=true` in `.env`, restarts `serve-mockup.js`, re-processes clip → each `reviewSegment` call logs raw model text + parsed JSON object.
- F3. SWOT retry path → log both initial and retry responses when debug is on (distinct `attempt` field).

### Acceptance Examples

- AE1. `DEBUG` missing from `.env` → `isVideoProcessingDebugEnabled()` is false; no new audit events.
- AE2. `DEBUG=true` → after one segment assessment, log contains `ollama.response.debug` with `clipId`, `segmentIndex`, `model`, `rawContent`, and `parsed` (ratings + SWOT fields).
- AE3. `DEBUG=false` explicitly → same as unset (no debug events).
- AE4. Debug log lines never include base64 frame data (only model text/JSON).

### Requirements

#### Env flag

- R1. Read **`DEBUG`** from `process.env` (loaded via existing `dotenv` in `scripts/serve-mockup.js`). Default **false** when unset, empty, or unrecognized.
- R2. Truthy values: `1`, `true`, `yes`, `on` (case-insensitive). Everything else → false.
- R3. Expose `isVideoProcessingDebugEnabled()` from `scripts/video-processing/config.js` (single parser; do not duplicate parsing in `process-clip.js` / `ollama-client.js`).

#### Where to log (important)

- R4. Raw Ollama content is only available in **`ollama-client.js`** (`reviewSegment` / `callOllamaChat`). Debug logging belongs there, not by re-fetching from `process-clip.js`.
- R5. **`process-clip.js`** enriches `assessmentContext` passed into `reviewSegment` with **`clipId`** and per-loop **`segmentIndex`** so debug lines correlate to a clip/segment.
- R6. When debug is on, call `logAuditEvent('ollama.response.debug', { … })` after each successful Ollama parse attempt (initial + retry if retry runs).

#### Payload shape

- R7. Include: `clipId`, `segmentIndex`, `model`, `attempt` (`initial` | `retry`), `swotRetry` (boolean, on final path), `rawContent` (string), `parsed` (object: `ratings`, `strengths`, `weaknesses`, `opportunities`, `comments` — same shape returned by `parseRatingsFromResponse`, without frame images).
- R8. Truncate `rawContent` to a safe max length (e.g. **8192** chars) before logging to avoid runaway log files; append `…` when truncated.
- R9. Do **not** log when debug is off (preserve Feature 019 non-sensitive default).

#### Docs / hygiene

- R10. Document `DEBUG=false` in `.env.example` with a one-line comment (local troubleshooting only; keep off in prod).
- R11. No commit of real `.env` / `.env_prod` values.

#### Tests

- R12. Extend `scripts/video-processing/ollama-client.selftest.js` (or add a tiny `config.selftest.js`) to assert env parsing for `DEBUG` true/false/unset cases.

### Scope Boundaries

**In scope:** Env helper, context enrichment, conditional `logAuditEvent`, `.env.example`, selftest.

**Out of scope:** UI toggle; DB `clips` debug column; changing Feature 019 default `ollama.response` shape; logging find-player Ollama calls (can be a follow-up).

### Success Criteria

- Operators can flip `DEBUG=true`, re-process one clip, and read the model JSON from the structured log without attaching a debugger.

## Planning Contract

### Key Technical Decisions

- KTD1. **Config centralization** — `isVideoProcessingDebugEnabled()` in `config.js` matches existing env patterns (`VANTAGEIQ_VIDEO_ROOT`, `FFMPEG_PATH`).
- KTD2. **Log in `ollama-client.js`** — only module with `payload.message.content`; `process-clip.js` supplies correlation ids via context.
- KTD3. **Separate event name** — `ollama.response.debug` keeps normal `ollama.response` metrics unchanged and makes grep easy.
- KTD4. **Opt-in overrides Feature 019 R10** — full LLM bodies are intentionally logged only when `DEBUG` is on; default remains no response bodies.
- KTD5. **Parsed + raw** — log both so operators can see parse failures (invalid JSON) vs model non-compliance (valid JSON missing SWOT).

### Technical Design

```
process-clip.js
  assessmentContext = { …, clipId, segmentIndex }   // segmentIndex set in loop
  reviewSegment(pool, assessmentContext, frames)

ollama-client.js — reviewSegment
  content = callOllamaChat(...)
  parsed = parseRatingsFromResponse(content, …)
  if (isVideoProcessingDebugEnabled()) {
    logAuditEvent('ollama.response.debug', {
      clipId: context.clipId,
      segmentIndex: context.segmentIndex,
      model,
      attempt: 'initial' | 'retry',
      rawContent: truncate(content),
      parsed: { ratings, strengths, weaknesses, opportunities, comments }
    })
  }
  // existing swot retry + ollama.response unchanged
```

### Assumptions

- A1. Generic `DEBUG` in `.env` is acceptable for this POC (only read by video-processing config). If it later conflicts with other tooling, rename to `VANTAGEIQ_VIDEO_DEBUG` in a follow-up.
- A2. `serve-mockup.js` already loads `.env` before the queue starts; CLI scripts (`retry-clip.js`) that load dotenv themselves will also pick up `DEBUG`.

### Dependencies and Sequencing

1. U1 — `isVideoProcessingDebugEnabled()` + `.env.example`.
2. U2 — Context enrichment + debug audit events in Ollama path.
3. U3 — Selftest.

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Large log files when DEBUG left on | Default off; truncate `rawContent`; document “disable after debugging” |
| Accidental prod enable | `.env.example` warns; deploy checklist note optional |
| User asked for `process-clip.js` only | Plan documents split: correlation in process-clip, payload in ollama-client |

### Open Questions

- None blocking. Follow-up: same pattern for `find-player.js` Ollama calls if needed.

## Implementation Units

### U1. DEBUG env helper

**Goal:** Single boolean gate for debug logging.

**Requirements:** R1–R3, R10

**Files:**
- Modify: `scripts/video-processing/config.js`
- Modify: `.env.example`

**Approach:**
- Add `parseEnvBoolean(value, defaultFalse)` and `isVideoProcessingDebugEnabled()` reading `process.env.DEBUG`.
- Export from `config.js` module.exports.

**Test scenarios:**
- Unset / `false` / `0` / `no` → false.
- `true` / `1` / `ON` → true.

### U2. Wire debug audit events

**Goal:** Log model JSON when debug is on.

**Requirements:** R4–R9

**Files:**
- Modify: `scripts/video-processing/process-clip.js`
- Modify: `scripts/video-processing/ollama-client.js`

**Approach:**
- In `process-clip.js` segment loop, set `assessmentContext.segmentIndex = index` and `assessmentContext.clipId = clipId` before `reviewSegment`.
- In `reviewSegment`, after each `callOllamaChat` + `parseRatingsFromResponse`, if debug enabled emit `ollama.response.debug` with truncated raw + parsed snapshot.
- On SWOT retry, log retry attempt with `attempt: 'retry'`.

**Test scenarios:**
- Manual: `DEBUG=true`, re-process clip, grep `ollama.response.debug` in structured log.
- Regression: `DEBUG` off → no new event type in log during process.

### U3. Selftest

**Goal:** Lock env parsing behavior.

**Requirements:** R12

**Files:**
- Modify: `scripts/video-processing/ollama-client.selftest.js` (import config helper) or add `scripts/video-processing/config.selftest.js`

**Test scenarios:**
- Save/restore `process.env.DEBUG` around assertions.

## Verification Contract

- `node scripts/video-processing/ollama-client.selftest.js` (and config selftest if split).
- Manual: set `DEBUG=true`, restart mockup server, Re-process one complete clip, confirm `ollama.response.debug` in `STRUCTURED_LOG_PATH` / `log/backend_logging.txt`.

## Definition of Done

- R1–R12 satisfied; U1–U3 complete.
- Default behavior unchanged; debug JSON visible when flag is on.

## Appendix

### Baseline

- `ollama.response` logs counts only (`parsedRatingCount`, `strengthCount`, …).
- Feature 019 explicitly avoids full LLM bodies unless this debug flag is on.
- File name is **`process-clip.js`** (singular), not `process-clips.js`.

### Product Contract preservation

- New solo plan (`product_contract_source: ce-plan-bootstrap`).
