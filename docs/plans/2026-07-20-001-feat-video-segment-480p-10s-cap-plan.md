---
title: feat — 480p 10s segments (no audio), max 3, start window UX (30s analyzed)
date: 2026-07-20
type: feat
classification: software
feature: 034
slug: feat-video-segment-480p-10s-cap
product_contract_source: ce-plan-bootstrap
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
origin: User request 2026-07-20 — lower saved segments to 480p / 10s / max 3, strip audio; S4 upload+link must collect start and alert that only max 30 seconds will be analyzed. Scope confirmed option 2 (both Upload File and From Link). Audio removal added same day.
---

# Feature 034 — Video segments at 480p / 10s / max 3 (no audio) + 30s analysis window UX

## Goal Capsule

- **Objective:** Persist and process at most **three 10-second 480p video-only segments** per clip (≤ **30 seconds** analyzed, **no audio**), and require coaches on **both** S4 source modes to set a **start** (and duration ≤ 30s) with clear warning that only max 30 seconds of video will be analyzed.
- **Authority:** `scripts/video-processing/` (ffmpeg segment/extract, link ingest caps, clip upload + process), S4 mockup + client (`docs/ux/mockup/`), Playwright `tests/playwright/s4-video-capture.spec.js`, mapping note in `docs/ux/mockup/API-Mockup-Mapping.md`.
- **Done when:** New processing writes ≤3 segment MP4s at ~480p and 10s each **with audio stripped**; file and link uploads both persist start+duration with server max **30s**; S4 shows the analysis-window alert; existing early-stop may still exit before 3 segments but never processes more than 3.
- **Out:** Changing AI model prompts / frame count policy beyond fps math tied to segment length; raising or removing early-stop; cloud transcoding; reprocessing historical clips already on disk; changing storage root layout; stripping audio from the durable **original** upload (only working/segment outputs used for AI).

### Summary

Cap AI analysis to a coach-chosen ≤30s window starting at an explicit start time on both upload modes; segment that window into at most three 10s clips re-encoded at 480p with audio removed.

## Product Contract

### Problem Frame

Today segments are **30s** stream-copied (full source resolution), link ingest allows up to **120s** (~4 segments), and **file upload has no start/duration** — the whole normalized file is segmented. That burns storage/CPU and does not set a clear “what we analyze” contract with the coach.

### Actors

- A1. **Coach** — picks start of the action and a short window on S4 (file or link).
- A2. **Video processing worker** — trims to the window, writes ≤3 durable 480p **video-only** segments, runs assessment (early-stop allowed within that set).
- A3. **Operator / developer** — validates caps via selftests and Playwright.

### Key Flows

- F1. S4 **Upload File**: coach selects file, enters **Start** + **Duration** (default/max 30s), sees alert that only max 30 seconds will be analyzed → multipart includes start/duration → server stores `source_start_ms` / `source_duration_ms` → worker trims then segments.
- F2. S4 **From Link**: same start/duration fields and alert; server max duration drops from 120s → **30s**; default duration **30s**.
- F3. Worker: working media = start+duration extract (both modes) → `segmentVideo` at **10s**, **480p** re-encode, **audio removed** → persist/assess **at most 3** segments → early-stop may stop sooner.
- F4. Validation rejects duration > 30s or missing/invalid start on either mode.

### Acceptance Examples

- AE1. After processing a clip with a 30s window, `segments/{clipId}/` has **≤ 3** `.mp4` files; each is ~10s (last may be shorter), height ≈ **480** (even width, aspect preserved), and **has no audio stream**.
- AE2. Link or file submit with duration `00:31` (or >30s) returns **400** with a clear max-30s message.
- AE3. File upload without start returns **400**; with `startMmSs=00:10` and `durationMmSs=00:30`, DB stores those ms values and processing uses that window (not the whole file).
- AE4. S4 (both modes) shows visible copy that the coach must set the **start of the action** and that **only max 30 seconds** of video will be analyzed.
- AE5. Default duration UI + server default is **00:30** (not 01:00 / 60s). Prior “max 02:00” / “max 60 seconds” file hints are updated.

### Requirements

#### Segment extraction

- R1. Segment length constant: **10 seconds** (`SEGMENT_SECONDS = 10`).
- R2. When writing durable segments, **re-encode** (no stream copy) and scale to **480p** height (`scale=-2:480` or equivalent), preserving aspect ratio; even width.
- R2a. Durable segments (and the AI working extract used for segmentation, if re-encoded in the same graph) **must not include an audio track** — drop audio with ffmpeg `-an` (or equivalent: map video only, no audio encode).
- R3. Persist and assess **at most 3** segments per clip (`MAX_SEGMENTS = 3`), even if ffmpeg produces more.
- R4. Frame extraction fps math remains `FRAMES_PER_SEGMENT / SEGMENT_SECONDS` so three frames still span each 10s segment.
- R5. Existing `shouldStopAssessing` early-stop stays in place **within** the ≤3 segment set (may assess 1–2 only).

#### Analysis window (upload + link)

- R6. **Both** file upload and link ingest require a start time; persist `source_start_ms` and `source_duration_ms` for both.
- R7. `MAX_DURATION_SEC = 30`, `DEFAULT_DURATION_SEC = 30` (replace 120 / 60).
- R8. Worker always builds a working extract of `[start, start+duration]` (capped at 30s) before segmentation — file path must trim like link path does today, not segment the full original.
- R9. Keep API field names `startMmSs` / `durationMmSs` (mm:ss) for compatibility; messaging may speak in “seconds” (30s max) without requiring a raw integer-seconds input control.

#### S4 UX

- R10. Start + Duration controls are visible for **Upload File** and **From Link** (shared or duplicated panel; same `data-testid`s where practical).
- R11. Prominent alert / hint: coach must provide the **start point** of the action to analyze; **only a maximum of 30 seconds** of video will be analyzed.
- R12. Client validation mirrors server: start required; duration 1–30s; defaults `00:00` / `00:30`.
- R13. Update stale hints (“Max 60 seconds”, “Max 02:00”, default `01:00`) and `API-Mockup-Mapping.md` link-ingest note.

#### Tests / docs

- R14. Update `link-ingest.selftest.js` for new max/default.
- R15. Update Playwright S4 coverage for shared start/duration on upload mode, 30s cap messaging/validation, and reject >30s.
- R16. Mapping doc reflects 10s / 480p / no audio / max 3 / 30s window for both modes.

### Scope Boundaries

**In scope:** ffmpeg segment encode + caps + **strip audio**; upload/link validation + trim; S4 UI/client; selftest + Playwright; mapping doc.

**Out of scope:** Historical clip re-encode; changing early-stop thresholds; find-player model behavior beyond using the same ≤30s extract; mobile camera capture UX beyond the shared start/duration fields; muting or rewriting the original uploaded file on disk (originals may keep audio).

### Success Criteria

- New clips never store more than 3 durable segments for AI.
- New durable segments have no audio stream.
- Coaches cannot submit a window longer than 30s on either source mode.
- S4 clearly communicates start + 30s analysis limit before submit.

## Planning Contract

### Key Technical Decisions

- KTD1. **Re-encode segments at 480p with audio stripped (`-an`) instead of `-c copy`.** Stream copy cannot rescale or drop audio cleanly for the AI working set. Prefer libx264 video-only (no aac); do **not** keep an audio encode “for consistency” with older helpers.
- KTD2. **Enforce max 3 at the process loop** (`segmentPaths.slice(0, MAX_SEGMENTS)` or stop writing after 3), not only via “trim to 30s then hope.” Trim-to-30s is the primary guarantee; slice is the hard safety net.
- KTD3. **Unify analysis window on both modes via existing DB columns** `source_start_ms` / `source_duration_ms`. File upload today leaves them null — extend `createClipUpload` so non-link mode parses the same fields.
- KTD4. **Reuse link extract trim** for uploads where possible (shared helper: trim by start/duration → working mp4 under originals), then run fps normalize if still needed. Avoid two divergent ffmpeg graphs.
- KTD5. **Keep mm:ss inputs** (`startMmSs` / `durationMmSs`) to avoid API churn; product copy states the 30-second analysis limit explicitly.
- KTD6. **Do not change early-stop policy** in this feature; only bound the candidate segment set to ≤3 × 10s.

### Technical Design

```
Coach (S4 file|link)
  → startMmSs + durationMmSs (≤ 00:30)
  → clips.source_start_ms / source_duration_ms
  → prepare*: ffmpeg trim [start, start+dur] → working.mp4
  → segmentVideo(working): 10s, scale=-2:480, re-encode, -an (no audio)
  → keep first ≤3 paths → saveClipSegment + reviewSegment
  → early-stop may break early
```

**Constants (single source of truth):** prefer exporting `SEGMENT_SECONDS`, `MAX_SEGMENTS`, and aligning `MAX_DURATION_SEC = SEGMENT_SECONDS * MAX_SEGMENTS` from one module (or document the coupling in comments) so UI copy, validation, and ffmpeg stay aligned.

### Assumptions

- A1. 480p means **height 480**, not forcing 854×480; anamorphic / vertical clips keep aspect via `-2:480`.
- A2. Original full-resolution upload under `originals/` may remain (audio allowed there); **segments** are the downscaled **video-only** artifacts (and the analysis window extract may also be downscaled or left at source — prefer downscale + `-an` at segment step at minimum).
- A3. Last segment shorter than 10s is OK when duration is not a multiple of 10.
- A5. Assessment uses frame images only today; removing audio does not change AI inputs.
- A4. Offline mock without `DATABASE_URL` still shows the new UI fields; backend validation applies when API is live.

### Dependencies and Sequencing

1. U1 constants + segment encode (unblocks correct disk artifacts).
2. U2 server window validation + upload trim (unblocks correct analyze window).
3. U3 S4 UX + client (can parallel with U2 after field contract agreed).
4. U4 tests + mapping (after U1–U3).

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Re-encode slows processing | Bound to ≤30s input; keep encode preset fast (e.g. `veryfast`) |
| `-c copy` callers expect instant segments | Accept slower encode; log duration in audit |
| UI only on link panel misses file mode | Shared start/duration block outside mode panels or duplicated into upload panel |
| Tests still assert 02:00 max | Update selftest + Playwright in same PR |

### Open Questions

- None blocking. Deferred: whether the trimmed **working extract** should also be forced to 480p before segmentation (nice-to-have; segments already 480p satisfies R2).

## Implementation Units

### U1. Segment length, 480p encode, no audio, max 3 saved/processed

**Goal:** Durable segments are 10s, ~480p, **video-only**, and capped at 3.

**Requirements:** R1–R5 (including R2a)

**Files:**
- Modify: `scripts/video-processing/ffmpeg-utils.js`
- Modify: `scripts/video-processing/process-clip.js`
- Test: extend or add a small node selftest if one exists for ffmpeg; otherwise cover via process integration notes + Playwright/process audit expectations in U4

**Approach:**
- Set `SEGMENT_SECONDS = 10`, add `MAX_SEGMENTS = 3`, export both.
- Replace `-c copy` segment graph with video re-encode + `scale=-2:480` + **`-an`** (no audio stream). Do not map or encode audio.
- In `processClip`, after `segmentVideo`, take at most `MAX_SEGMENTS` paths before save/assess loop.

**Patterns to follow:** Existing `runCommand` / video encode args from `normalizeMaxFps` / link extract, but deliberately omit audio (unlike helpers that keep aac).

**Test scenarios:**
- Happy path: 30s working input → exactly 3 segment files under segments dir.
- Happy path: 15s working input → 2 segments; second may be <10s.
- Happy path: ffprobe (or equivalent) on a segment shows **no audio stream**.
- Edge: ffmpeg returns 4+ paths → only first 3 saved/assessed.
- Integration: `extractSegmentFrames` still yields 3 frames per segment with new `SEGMENT_SECONDS`.

### U2. 30s max window + start/duration for file and link

**Goal:** Server accepts ≤30s windows for both modes and trims file uploads before segmenting.

**Requirements:** R6–R9

**Files:**
- Modify: `scripts/video-processing/link-ingest.js` (`MAX_DURATION_SEC`, `DEFAULT_DURATION_SEC`)
- Modify: `scripts/video-processing/clip-upload.js` (parse start/duration for non-link)
- Modify: `scripts/video-processing/process-clip.js` (`prepareUploadNormalizeIfNeeded` / shared trim)
- Modify: `scripts/video-processing/link-ingest.selftest.js`

**Approach:**
- Cap duration at 30; default 30.
- File mode: require valid `startMmSs`; resolve duration like link; set `source_start_ms` / `source_duration_ms`.
- Before segmenting uploads, trim to that window (reuse extract helper used by link), then optional fps normalize.
- Error copy mentions max `00:30`.

**Patterns to follow:** Current link branch in `createClipUpload`; `prepareLinkSourceIfNeeded` extract path.

**Test scenarios:**
- Happy path: file upload with start/duration stores ms columns.
- Happy path: link with `00:30` accepted; default empty duration → 30.
- Error: duration `00:31` or `02:00` → 400.
- Error: file mode missing start → 400.
- Edge: duration `00:01` still valid (min 1s).

### U3. S4 UX — start/duration on both modes + 30s alert

**Goal:** Coaches see and must provide start; know only max 30s is analyzed.

**Requirements:** R10–R13

**Files:**
- Modify: `docs/ux/mockup/S4-video-capture.html`
- Modify: `docs/ux/mockup/js/mockup-api-client.js` (always send start/duration for both modes)
- Modify: `docs/ux/mockup/API-Mockup-Mapping.md`

**Approach:**
- Lift or duplicate Start/Duration into upload panel (or shared section under source mode toggle).
- Default duration `00:30`; hints/alert text for start-of-action + max 30s analyzed.
- Client validation + FormData for upload mode include `startMmSs` / `durationMmSs`.
- Update mapping: max duration 30s; segment policy 10s / 480p / no audio / max 3; file mode window fields.

**Test scenarios:** Covered primarily in U4 Playwright; manual smoke: both modes show alert and fields.

### U4. Playwright + selftest alignment

**Goal:** Regression coverage for caps and UX.

**Requirements:** R14–R16

**Files:**
- Modify: `tests/playwright/s4-video-capture.spec.js`
- Modify: `scripts/video-processing/link-ingest.selftest.js`
- Modify: `docs/ux/mockup/API-Mockup-Mapping.md` (if not finished in U3)

**Approach:**
- Replace assertions that expect max `02:00` / default `01:00`.
- Assert upload mode exposes start/duration and analysis alert copy.
- Assert client/server validation path for >30s where the suite already exercises validation.

**Test scenarios:**
- Happy path: start/duration visible in upload mode; defaults 00:00 / 00:30.
- Happy path: alert/hint mentions max 30 seconds analyzed.
- Error: duration over 30s blocked (UI and/or API expectation already in suite).
- Regression: link mode still submits start/duration fields.

## Verification Contract

- Node: `node scripts/video-processing/link-ingest.selftest.js` (or project’s usual selftest runner for that file).
- Playwright: `npx playwright test tests/playwright/s4-video-capture.spec.js` (or repo script equivalent).
- Manual smoke (when ffmpeg + worker available): submit a short file with start `00:00` duration `00:30` and confirm ≤3 segment files at ~480p **without audio** under `c:/vantageiq_videos/segments/{clipId}/` (or `VANTAGEIQ_VIDEO_ROOT`).

## Definition of Done

- All R1–R16 (including R2a) satisfied; U1–U4 complete.
- No launch-blocking open questions.
- Selftest + S4 Playwright green for updated expectations.
- Mapping doc matches shipped caps.

## Appendix

### Current baseline (pre-change)

- `SEGMENT_SECONDS = 30` with `-c copy` in `scripts/video-processing/ffmpeg-utils.js`.
- `MAX_DURATION_SEC = 120`, `DEFAULT_DURATION_SEC = 60` in `scripts/video-processing/link-ingest.js`.
- File uploads: fps normalize only; no start/duration persistence.
- S4 start/duration UI only inside link panel; file hint still says max 60 seconds.
