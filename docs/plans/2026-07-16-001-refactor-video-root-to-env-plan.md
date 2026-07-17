---
title: 'refactor: Move video root value into .env'
date: 2026-07-16
type: refactor
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# refactor: Move video root value into .env

## Goal Capsule

- **Objective:** The `C:\vantageiq_videos` path value comes from `.env` (`VANTAGEIQ_VIDEO_ROOT`) instead of being hardcoded in `scripts/video-processing/config.js`, while a code-level default fallback remains.
- **Authority:** User request 2026-07-16 (Option A — keep `DEFAULT_VIDEO_ROOT` as a safety fallback).
- **Stop when:** `.env` sets `VANTAGEIQ_VIDEO_ROOT=C:\vantageiq_videos`, the app resolves the root from it, the code fallback still works when the var is absent, and the existing video-storage test suite is green.

## Product Contract

### Summary

`scripts/video-processing/config.js` already reads `process.env.VANTAGEIQ_VIDEO_ROOT` first and falls back to a hardcoded `DEFAULT_VIDEO_ROOT = 'C:\\vantageiq_videos'`. This change makes the deployed value live in `.env` (which is tracked in git in this repo) so operators configure it there, and keeps the hardcoded constant purely as a last-resort default. No runtime behavior changes when `.env` carries the same value it does today.

### Requirements

- R1. `.env` defines `VANTAGEIQ_VIDEO_ROOT=C:\vantageiq_videos`.
- R2. The video root continues to resolve from `VANTAGEIQ_VIDEO_ROOT` at runtime (existing `getVideoRoot()` behavior).
- R3. `DEFAULT_VIDEO_ROOT` remains in `config.js` as the fallback when the env var is unset/blank; the "defaults when env unset" test stays valid.
- R4. The variable is discoverable — documented so a fresh clone/operator knows to set it.

### Actors

- A1. Operator / developer configuring where uploaded videos and segments are stored.

### Key Flows

- F1. App starts → dotenv loads `.env` → `VANTAGEIQ_VIDEO_ROOT` is set → `getVideoRoot()` returns that path → originals/segments/thumbnails resolve under it.
- F2. App starts with no `VANTAGEIQ_VIDEO_ROOT` → `getVideoRoot()` falls back to `DEFAULT_VIDEO_ROOT`.

### Acceptance Examples

- AE1. With `VANTAGEIQ_VIDEO_ROOT` set in `.env`, `getVideoRoot()` returns `path.resolve(<that value>)`.
- AE2. With the var deleted from the environment, `getVideoRoot()` returns `path.resolve(DEFAULT_VIDEO_ROOT)`.

### Scope Boundaries

#### In scope

- `.env` — add `VANTAGEIQ_VIDEO_ROOT`
- Discoverability note (README or a committed `.env.example`)
- No logic change required in `config.js` (it already reads the var); confirm only

#### Out of scope / deferred

- Removing `DEFAULT_VIDEO_ROOT` from code (that was Option B).
- Changing the actual storage location value.
- Migrating `.env` out of git / secret-handling cleanup.
- Moving other hardcoded defaults (Ollama URL, ffmpeg path, etc.).

## Planning Contract

### Assumptions

- Entry points already call `require('dotenv').config(...)` before using `config.js` (e.g. `serve-mockup.js`, `retry-clip.js`), so `.env` is loaded in every process that touches the video root.
- `.env` is tracked in git in this repo, so the value is shared with the team by committing `.env`.

### Key Technical Decisions

- KTD1. Reuse the existing `VANTAGEIQ_VIDEO_ROOT` mechanism — no new env name, no `config.js` logic change.
- KTD2. Keep `DEFAULT_VIDEO_ROOT` exactly as-is so `getVideoRoot()` and the unset-env test are unaffected.
- KTD3. Add a `.env.example` (committed) with `VANTAGEIQ_VIDEO_ROOT=C:\vantageiq_videos` as the discoverability anchor, since there is no example file today.

### Product Contract preservation

Bootstrap from confirmed scope (Option A: value to `.env`, keep code fallback).

## Implementation Units

### U1. Set the video root in `.env` and document it

**Goal:** The path value lives in `.env`; the variable is discoverable.

**Requirements:** R1, R4; AE1

**Dependencies:** None

**Files:**

- `.env`
- `.env.example` (new)
- `README` or existing docs note (optional, if a suitable file exists)

**Approach:**

- Add `VANTAGEIQ_VIDEO_ROOT=C:\vantageiq_videos` to `.env`.
- Create `.env.example` capturing the same key (placeholder value acceptable) so a fresh clone knows the variable exists.

**Test scenarios:**

- Test expectation: none — configuration/doc change with no new behavior; covered indirectly by U2's confirmation of `getVideoRoot()`.

**Verification:** Start the mockup server; confirm it reads the configured root (log/startup) and video upload still lands under it.

### U2. Confirm resolution + fallback still hold

**Goal:** Verify the env-driven value and the code fallback both work.

**Requirements:** R2, R3; AE1, AE2

**Dependencies:** U1

**Files:**

- `apps/api/tests/integration/video-processing/video-storage-path.spec.ts` (existing — confirm/keep)
- `scripts/video-processing/config.js` (read-only confirm; no change expected)

**Approach:**

- Re-run the existing video-storage-path suite: it already covers "resolves under configured root" and "defaults to `DEFAULT_VIDEO_ROOT` when env unset".
- No code edit expected in `config.js`; if any drift is found, keep the constant and env-first order intact.

**Test scenarios:**

- Covers AE1. Configured root resolves originals/segments under it.
- Covers AE2. Env unset → falls back to `DEFAULT_VIDEO_ROOT`.

**Verification:** `video-storage-path` vitest suite green.

## Verification Contract

- Vitest: `apps/api/tests/integration/video-processing/video-storage-path.spec.ts`
- Manual: mockup server starts and stores/reads a clip under the configured root.

## Definition of Done

- R1–R4 and AE1–AE2 satisfied; U1–U2 complete; existing video-storage tests green; `DEFAULT_VIDEO_ROOT` retained as fallback.
