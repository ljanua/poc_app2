---
title: S2 avatar upload PATCH rejected by UpdatePlayerProfile validator
date: 2026-07-06
category: docs/solutions/integration-issues/
module: S2 Player Dashboard / avatar upload
problem_type: integration_issue
component: service_object
severity: medium
symptoms:
  - Uploading a JPG avatar in S2 returns HTTP 400 validation error
  - Server message reads "Player name must be 2-60 chars and use letters, spaces, apostrophe, or hyphen."
  - Failure occurs for an existing player (Carter) whose name is already valid in the system
  - Error reproduces consistently on every avatar upload via the canvas-resize path
  - LocalStorage-seeded and in-memory avatar tests pass while the live backend path fails
root_cause: wrong_api
resolution_type: code_fix
tags:
  - s2-player-dashboard
  - avatar-upload
  - mockup-api-client
  - patch-v1-players
  - openapi-validation
  - client-contract
---

# S2 avatar upload PATCH rejected by UpdatePlayerProfile validator

## Problem

Uploading a JPG avatar on the S2 player dashboard returned a 400 validation error citing a name-length rule, even though the player's name was already valid and persisted. The avatar-only PATCH was being rejected by a payload validator that expected every required profile field on every update.

## Symptoms

- HTTP 400 `validation error` with message: `"Player name must be 2-60 chars and use letters, spaces, apostrophe, or hyphen."` when uploading an avatar for an existing player (e.g., Carter).
- Occurred immediately after `uploadPlayerAvatar` completed client-side canvas resizing and called `updatePlayerAvatar` (`docs/ux/mockup/js/mockup-api-client.js:1174`).
- Reproducible in live backend mode; did not reproduce under offline / `__USE_BACKEND__ = false`.

## What Didn't Work

- The existing Playwright avatar-upload test in `tests/playwright/s2-player-dashboard.spec.js` (scenario "uploading an avatar updates the avatar preview immediately on S2") kept passing even though the bug shipped. It seeded `localStorage.playerAvatars[10]` directly and never invoked the live PATCH endpoint, so the validator was never exercised.
- The BDD scenario "Uploading a player photo updates the avatar across surfaces" in `tests/bdd/features/coach-player-development-dashboard.feature` was implemented in `step_definitions/coach-development-video-source.steps.js:138-153` to mutate an in-memory profile object only; it also never hit `PATCH /api/v1/players/{id}`.
- Both suites ran under offline mode (`__USE_BACKEND__ = false`) where the offline validator at `mockup-api-client.js:1068` is only reachable through `updatePlayerProfile`, not `updatePlayerAvatar`, so the regression hid behind the wrong test surface.
- Patching only the validator to make `name` optional would have lied about the contract enforced by `openapi/v1/schemas/players.yaml:283-293`, which declares every field of `UpdatePlayerProfileRequest` as required. The backend was faithfully enforcing the OpenAPI schema.

## Solution

Read-then-merge on the client so a partial PATCH carries the full payload the contract requires (commit `39365c2`):

- `docs/ux/mockup/js/mockup-api-client.js` — `updatePlayerAvatar` (backend branch) now reads the current profile via `getPlayerProfile(playerId)`, merges `avatarUrl` into a full payload, and PATCHes the merged body. If the existing player is not found, it surfaces a 404 instead of silently sending a stub.
- `tests/playwright/s2-player-avatar-backend.spec.js` — new regression spec with two tests:
  1. `uploadPlayerAvatar` persists without validation errors.
  2. The uploaded avatar URL is readable back through `getPlayerProfile`.
- `scripts/serve-mockup.js` — `ensureDatabase` retrofits the `player_avatar_url` column on startup with an idempotent `ADD COLUMN IF NOT EXISTS`, so fresh databases inherit the column without an explicit migration script.
- `tests/playwright/s1..s6` specs — coach-login updates so the live-mode specs reach an authenticated session.
- `docs/ux/mockup/js/mockup-api-client.js` — restored the orphan `listClips(filters)` signature that had been lost; without it, every `MockupApi` load threw `Unexpected identifier 'store'`.

## Why This Works

The root cause was a contract mismatch between two intents sharing one endpoint. The schema at `openapi/v1/schemas/players.yaml:283-293` requires `[name, teamName, position, trend]` on every `UpdatePlayerProfileRequest`. The avatar upload path at `mockup-api-client.js:1114-1117` was sending `{ avatarUrl: dataUrl }` only, which `parseUpdateProfilePayload` (`scripts/serve-mockup.js:971-976` and `scripts/serve-mockup.js:1796-1805`) then validated; `toTitleCase(undefined)` reduced to an empty string via `normalizeLookup(undefined) -> String(undefined || '').trim()` and the `!name` guard fired.

Read-then-merge on the client restores every required field, so the server-side validator sees a coherent profile and the partial update is allowed by the existing schema. Surfacing a 404 when the player lookup fails prevents the old failure mode from silently shipping a stub. The idempotent `ADD COLUMN IF NOT EXISTS` in `ensureDatabase` means a fresh database picks up `player_avatar_url` without relying on a separate migration that might be skipped.

## Prevention

- Drive the live backend for any PATCH endpoint in regression tests. Avatar updates, profile edits, and any partial update must reach `PATCH /api/v1/players/{id}` (and analogous routes) with a real authenticated session — seeding `localStorage` or mutating in-memory objects only verifies the offline stub, not the contract the backend enforces.
- Treat `openapi/v1/schemas/*.yaml` as the authoritative contract. When a client intends a partial PATCH, either:
  - update the OpenAPI schema to mark only the fields the endpoint actually mutates as required (preferred when the endpoint semantics truly are partial), or
  - read-then-merge on the client so the request satisfies the existing schema.
  Do not loosen the server validator to mask a contract drift.
- Prefer migration-bootstrap retrofits (idempotent `ADD COLUMN IF NOT EXISTS` inside `ensureDatabase`) over out-of-band migration scripts for column additions, so the same omission cannot recur on a fresh database.
- Keep Playwright and BDD scenarios aligned on the same backend mode flag. A suite that asserts an offline path should be labeled as such; suites that claim "uploads persist" must run with `__USE_BACKEND__ = true` and hit the real PATCH.

## Related Issues

- `docs/ux/mockup/js/mockup-api-client.js:1068` — offline validator reachable only through `updatePlayerProfile`; relevant to any future offline-mode test design.
- `scripts/serve-mockup.js:971-976`, `scripts/serve-mockup.js:1796-1805` — server-side payload parsing and PATCH handler.
- `openapi/v1/schemas/players.yaml:283-293` — `UpdatePlayerProfileRequest` required fields.
- `step_definitions/coach-development-video-source.steps.js:138-153` — in-memory BDD avatar step that bypassed the live PATCH.
- `docs/plans/2026-07-05-002-feat-player-avatar-upload-plan.md` — the plan that introduced the avatarUrl extension on PATCH /v1/players/{playerId}; root-cause sibling (high overlap with the new doc).
- `docs/plans/2026-07-04-006-feat-s2-edit-player-profile-plan.md` — the plan that originally defined the `UpdatePlayerProfileRequest` contract this bug violated (high overlap).
- `docs/ux/mockup/API-Mockup-Mapping.md` — documents the PATCH /v1/players/{playerId} operation; refresh candidate to surface the partial-body hazard.