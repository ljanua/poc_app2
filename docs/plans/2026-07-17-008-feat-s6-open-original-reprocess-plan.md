---
title: "feat: S6 open source URL and re-process failed clips"
date: 2026-07-17
type: feat
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
origin: conversation (S6 assessment list)
---

# feat: S6 open source URL and re-process failed clips

## Goal Capsule

On S6 clip cards: when `source_url` is present, show a control that opens the original external video in a **new tab**; when status is `failed`, show **Re-process** for Coach / ClubAdmin / SystemAdmin that resets the clip and runs processing again. Guests never see Re-process. Stop when list API exposes `sourceUrl`, retry API works, and Playwright covers visibility + actions.

**Authority:** this plan; user answers (2026-07-17): new tab; editors only; reset status and run.

## Product Contract

### Summary

Coaches need to review the original linked video and recover from failed processing without CLI.

### Requirements

- R1. If a clip has a non-empty `source_url` / `sourceUrl`, S6 shows an **Open original** (or equivalent) button that opens that URL in a **new browser tab** (`target="_blank"` + `rel="noopener noreferrer"`).
- R2. Open original is available for any viewer who can see the card (including when status is failed/complete/pending), as long as `sourceUrl` is set. Guest share views: show Open original if `sourceUrl` is returned for that share-scoped clip (same new-tab behavior).
- R3. If status is `failed`, S6 shows a **Re-process** button for signed-in **Coach**, **ClubAdmin**, and **SystemAdmin** only. Hidden for guests and any non-editor role.
- R4. Re-process resets the clip (clear error, reset completion fields as needed, set status so processing runs) and **runs** the pipeline (same outcome as `scripts/video-processing/retry-clip.js`: status → process again). Prefer: set `submitted` (or `in_progress` then invoke `processClip` / trigger queue) so the existing queue or an explicit retry endpoint completes the run.
- R5. After Re-process is accepted, the card reflects pending/in-progress (refresh list or optimistic update); no silent no-op on failure of the retry request.
- R6. List/GET clip payloads must include `sourceUrl` (and keep `errorMessage` for failed cards if already shown).

### Actors

- A1. Coach / ClubAdmin / SystemAdmin — Open original + Re-process on failed.
- A2. Guest (share) — Open original only if URL present; no Re-process.

### Acceptance Examples

- AE1. Link-ingested clip with `sourceUrl` → Open original opens that URL in a new tab.
- AE2. Failed clip as Coach → Re-process visible; click → clip leaves `failed` and processing runs; eventually complete or failed again with new error.
- AE3. Guest on share S6 → no Re-process button even if failed.
- AE4. Upload clip with null `sourceUrl` → no Open original button.

### Scope Boundaries

**In scope:** S6 card actions; expose `sourceUrl` on list responses; `POST` (or similar) retry endpoint; Playwright; mapping note.

**Out of scope:** Playing external URL inside the S6 modal; changing Find player / fps pipeline; SystemAdmin processing_config UI (019).

## Planning Contract

### Key Technical Decisions

- KTD1. **Open original** = plain link/button to `sourceUrl` with `window.open` or `<a target="_blank">` — no proxy download of the remote original for this control.
- KTD2. **Re-process API** `POST /api/v1/clips/{clipId}/reprocess` (name flexible): requires active Coach|ClubAdmin|SystemAdmin (+ club scope for Coach/ClubAdmin matching other clip access). Only allowed when current status is `failed`. Implementation mirrors `retry-clip.js`: clear `error_message`, set `status` to `in_progress` (or `submitted` + `triggerVideoProcessing`), clear `processing_completed_at`, then ensure the queue/process runs. Prefer **submitted + triggerVideoProcessing** if concurrent `in_progress` claim is already owned by the queue, OR reuse CLI pattern (`in_progress` + `processClip`) if that is more reliable for immediate run — pick one and document; recommended: **reset to `submitted`, clear errors, `triggerVideoProcessing(pool)`** so max-parallel rules stay consistent.
- KTD3. Ensure `GET /v1/clips` SELECT includes `c.source_url AS "sourceUrl"` and `toClipResponse` already maps it (verify list path, not only `selectClipById`).

### Assumptions

- “Edit power” = Coach, ClubAdmin, SystemAdmin (same family as other write actions on mockup).
- User said “re-process the image” meaning the **failed clip / video assessment**, not a still image upload.

### Patterns to follow

- Card render: `docs/ux/mockup/S6-assessment-list.html`
- Clip API: `scripts/video-processing/clip-upload.js`, `scripts/serve-mockup.js` clips routes
- Retry reference: `scripts/video-processing/retry-clip.js`
- Playwright: `tests/playwright/s6-assessment-list.spec.js`

## Implementation Units

### U1. Expose sourceUrl on clip list + reprocess API

**Goal:** Clients receive `sourceUrl`; editors can POST reprocess for failed clips.

**Requirements:** R4, R6

**Dependencies:** None

**Files:**
- Modify: `scripts/serve-mockup.js` (GET clips SELECT; new POST reprocess route)
- Modify: `scripts/video-processing/clip-upload.js` if shared helper for retry lives there
- Optionally extract `reprocessClip(pool, clipId)` used by route and keep CLI calling it later (nice-to-have, not required)

**Approach:** Fix list query if `source_url` missing. Reprocess: auth via `actorEmail` (or session pattern used elsewhere), validate role + failed status + club scope, reset fields, trigger queue. Return updated clip payload.

**Test scenarios:**
- Happy: failed clip → 202/200 with status submitted or in_progress.
- Error: complete clip → 400/409.
- Error: Coach outside club scope → 403.
- Error: missing actor → 401/403 per existing conventions.

**Verification:** Manual or Playwright against backend when `DATABASE_URL` set.

### U2. S6 card UI — Open original + Re-process

**Goal:** Wire buttons on result cards per R1–R5.

**Requirements:** R1–R5, AE1–AE4

**Dependencies:** U1

**Files:**
- Modify: `docs/ux/mockup/S6-assessment-list.html`
- Modify: `docs/ux/mockup/js/mockup-api-client.js` (`reprocessClip` helper)
- Modify: `docs/ux/mockup/style/site.css` only if button row needs layout help

**Approach:** In card template, if `clip.sourceUrl`, add `[data-testid="open-original-link"]` anchor. If failed && !guest && editor role, replace disabled Failed button with Re-process `[data-testid="reprocess-clip"]`. On click, call API then `renderResults`/reload clips. Keep existing play button for processed media unchanged.

**Test scenarios:** Covered in U3.

**Verification:** Visual check on failed link clip + upload clip.

### U3. Playwright + mapping

**Goal:** Lock button visibility and open/reprocess wiring.

**Requirements:** AE1–AE4

**Dependencies:** U2

**Files:**
- Modify: `tests/playwright/s6-assessment-list.spec.js`
- Modify: `docs/ux/mockup/API-Mockup-Mapping.md`

**Approach:** Offline/mock fixtures where possible for Open original href; backend-gated test for reprocess if needed. Assert guest has no reprocess.

**Test scenarios:**
- Happy: card with sourceUrl shows open link with correct href and `target=_blank`.
- Edge: no sourceUrl → no open link.
- Happy/edge: failed + coach → reprocess control present; guest → absent.

**Verification:** Spec updates pass under Playwright mockup config.

## Verification Contract

- Playwright S6 updates for Open original + Re-process visibility.
- Backend smoke when `DATABASE_URL` available: POST reprocess on a failed clip.
- Mapping documents both actions.

## Definition of Done

- Open original new-tab for any clip with `sourceUrl`.
- Re-process for failed clips, editors only; resets and runs via queue/API.
- List API includes `sourceUrl`; docs + tests updated.
