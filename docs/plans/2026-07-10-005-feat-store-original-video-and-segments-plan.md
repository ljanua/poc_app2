---
title: feat — durable video originals and segments under c:/vantageiq_videos
date: 2026-07-10
type: feat
classification: software
feature: 025
slug: feat-store-original-video-and-segments
product_contract_source: ce-plan-bootstrap
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
origin: docs/backlog/004-store-original-video-and-segments.md — user required root c:/vantageiq_videos and a path attribute for retrieval; scope confirmed 2026-07-10; defaults structured originals/ + segments/{clipId}/; path on original clip plus per-segment paths.
---

# Feature 025 — Store Original Video and Segments under c:/vantageiq_videos

## Goal Capsule

- **Objective:** Persist **original uploads and ffmpeg segments** under **`c:/vantageiq_videos`**, keep segments after processing (not temp-only), and expose a durable **`path`** on each stored video (original + each segment) for later retrieval.
- **Authority:** `scripts/video-processing/` (upload, process, config) + Postgres migration; clip/segment API response fields; gitignore/docs notes. No cloud object store in this feature.
- **Done when:** New uploads land under `c:/vantageiq_videos/originals/`; processing writes segments under `c:/vantageiq_videos/segments/{clipId}/` and records their paths; clip responses include `path` for the original; segment paths are queryable; temp working dirs may still be used for frames but segment MP4s are retained.
- **Out:** Skill-linked player-in-action cuts (backlog 005); S6 thumbnail UI (006); S3/GCS; automatic migration/copy of every historical file under `data/clip-videos/` (optional best-effort note only); serving HTTP video streaming UI.

### Summary

Move durable video storage to `c:/vantageiq_videos` with `originals/` and `segments/{clipId}/`, keep segment files after assessment, and expose `path` on the original clip plus each segment record for retrieval.

## Product Contract

### Problem Frame

Today originals go to repo-local `data/clip-videos/` via `video_storage_path`, while ffmpeg segments live only under a **temp** directory and are deleted when processing finishes. Operators cannot reliably re-open originals or segments later.

### Actors

- A1. **Coach** — uploads via S4; later needs playback/retrieval by path.
- A2. **Video processing worker** — writes originals and segments to the durable root.
- A3. **Operator / developer** — inspects disk + DB paths for debugging/reprocess.

### Key Flows

- F1. S4 multipart upload → original file written to `c:/vantageiq_videos/originals/{clipId}_{filename}` → clip row stores that location → API exposes `path`.
- F2. Queue processes clip → ffmpeg segments written to `c:/vantageiq_videos/segments/{clipId}/segment_NNN.mp4` → each segment row/record stores `path` → assessment continues (frames may still use temp).
- F3. Processing completes/fails → segment files remain on disk; temp frames/dirs cleaned as today.
- F4. Client/API reads clip → `path` for original; list of segments each with `path` (and index).

### Acceptance Examples

- AE1. After upload, file exists under `c:/vantageiq_videos/originals/` and clip payload includes `path` equal to that absolute (or normalized) path.
- AE2. After a successful process of a multi-segment video, `c:/vantageiq_videos/segments/{clipId}/` contains one or more `.mp4` files that remain after the worker finishes.
- AE3. Each persisted segment has a retrievable `path` in the data model / API.
- AE4. Default root is `c:/vantageiq_videos` (Windows path); override via env still works for tests.
- AE5. Repo `data/clip-videos/` is no longer the default write target for new uploads.

### Requirements

#### Storage root and layout

- R1. Default durable root: **`c:/vantageiq_videos`** (normalize with `path.resolve` / `path.normalize` on Windows).
- R2. Layout:
  - originals: `{root}/originals/`
  - segments: `{root}/segments/{clipId}/`
- R3. Env override e.g. `VANTAGEIQ_VIDEO_ROOT` (or extend existing storage env) for tests/CI; when set, same `originals/` + `segments/` layout under that root.
- R4. Create directories on write if missing.

#### Path attribute

- R5. Every **original** video has a **`path`** attribute available to API consumers (clip list/detail/upload response).
- R6. Every **segment** video has its own **`path`** attribute.
- R7. `path` values are the filesystem locations used to open the file later (absolute paths under the configured root).
- R8. Prefer mapping DB `video_storage_path` → API `path` for the original (keep column or add alias); do not leave path only in opaque server logs.

#### Persist segments

- R9. Stop using the processing temp dir as the **only** home for segment MP4s; write durable segment files under `{root}/segments/{clipId}/`.
- R10. Record segment metadata (at least `clipId`, `segmentIndex`, `path`) in Postgres so paths survive process restarts.
- R11. Temp dirs may still hold extracted frames; clean those up after processing as today. Do **not** delete durable segment MP4s in the success/failure `finally` path.

#### Upload / processing wiring

- R12. Update `clip-upload.js` (and any `VIDEO_STORAGE_ROOT`) to write originals under `{root}/originals/`.
- R13. Update `process-clip.js` / `ffmpeg-utils.js` callers to output segments into the durable segment folder for that clip.
- R14. Structured audit log may include paths (no file bytes).

#### Non-goals

- R15. No requirement to stream video over HTTP in this feature (path retrieval is enough).
- R16. No skill/recommendation fields on segments (backlog 005).

### Scope Boundaries

#### In scope

- Migration for segment persistence (new table or equivalent JSONB — see KTD)
- `scripts/video-processing/clip-upload.js`, `process-clip.js`, `ffmpeg-utils.js` / config as needed
- `toClipResponse` (+ segment list in responses or a dedicated list endpoint — prefer include on clip detail/list when cheap)
- Tests for path root, original write location, segment persistence after process (unit/integration with temp override root)
- Docs: backlog 004 → planned; note in Feature 018 appendix or mapping if useful
- `.gitignore` does not need to ignore `c:/vantageiq_videos` (outside repo); keep ignoring `data/clip-videos/`

#### Deferred

- Backlog 005 skill-linked segments
- Backlog 006 thumbnails
- Bulk migrate existing `data/clip-videos/*` into the new root (optional one-off script later)
- Object storage / CDN
- HTTP `/media` static serving

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Root | `c:/vantageiq_videos` | Explicit user requirement |
| Layout | `originals/` + `segments/{clipId}/` | Confirmed default on “confirmed” |
| Path model | Clip `path` + per-segment `path` | User: path on each video; segments are separate files |
| Segment retention | Keep after processing | Core backlog need |

## Planning Contract

### Key Technical Decisions

- KTD1. **Config helper** in `scripts/video-processing/` (e.g. extend `config.js`):

```javascript
// Directional
function getVideoRoot() {
  const configured = process.env.VANTAGEIQ_VIDEO_ROOT;
  if (configured && String(configured).trim()) {
    return path.resolve(String(configured).trim());
  }
  return path.resolve('C:/vantageiq_videos');
}
function originalsDir() { return path.join(getVideoRoot(), 'originals'); }
function segmentsDirForClip(clipId) { return path.join(getVideoRoot(), 'segments', String(clipId)); }
```

- KTD2. **Original `path`:** continue storing absolute path in `clips.video_storage_path`; expose as **`path`** in `toClipResponse` (and keep `videoStoragePath` only if something internal still needs it — prefer single public `path` field for API clarity).
- KTD3. **Segment table** (preferred over JSONB-only):

```sql
-- Directional migration sketch
CREATE TABLE IF NOT EXISTS clip_segments (
  id TEXT PRIMARY KEY,
  clip_id TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  segment_index INT NOT NULL,
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (clip_id, segment_index)
);
```

- KTD4. **Processing:** before segment loop, `mkdir` durable segment dir; pass that dir to `segmentVideo`; after each segment file exists, upsert `clip_segments` with `path`; on reprocess, replace rows for that clip (delete prior segment rows + optionally prior files).
- KTD5. **API:** include `path` on clip; include `segments: [{ index, path }]` on list/detail responses when segments exist (empty array otherwise).
- KTD6. **Tests:** set `VANTAGEIQ_VIDEO_ROOT` to `os.tmpdir()/…`; assert original under `originals/`, mock or light ffmpeg path if available; assert segment rows + files not deleted by `removeDirRecursive(tempRoot)`.

### Assumptions

- Confirmed unanswered call-outs: structured folders; path on original + each segment.
- Windows path `c:/vantageiq_videos` is acceptable as default on this project’s primary machine; env override covers other hosts.
- Backlog 005 may later add skill/recommendation columns to `clip_segments` — keep the table minimal now.

### Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Disk full / permissions on `C:\` | Logger + fail clip with clear `error_message`; ensure mkdir errors surface |
| Old clips still under `data/clip-videos/` | Processing continues to read whatever `video_storage_path` already stores; only new writes use new root |
| Large segment retention | Accept for v1; retention policy deferred |
| Path leakage in client | Paths are local absolute; fine for mockup/ops; do not log file bytes |

### Dependencies and Sequencing

1. Migration `clip_segments` + config root helpers
2. Upload writes to `originals/` + API `path`
3. Processing writes durable segments + DB rows; stop deleting them
4. Tests with overridden root
5. Update backlog 004 to planned/done when shipped

## Implementation Units

### U1. Video root config + original path under originals/

**Goal:** New uploads store under `c:/vantageiq_videos/originals/` and expose `path`.

**Requirements:** R1–R5, R7–R8, R12

**Files:**
- Modify: `scripts/video-processing/config.js` and/or new small storage helper
- Modify: `scripts/video-processing/clip-upload.js`
- Modify: `toClipResponse` in `clip-upload.js`
- Test: unit/integration under `apps/api/tests/…` for path resolution + upload path shape (multipart may be mocked)

**Approach:**
- Centralize `getVideoRoot` / `originalsDir`.
- Replace `data/clip-videos` default.
- Map response `path: row.videoStoragePath`.

**Test scenarios:**
- Default root resolves to `C:\vantageiq_videos` (or normalized equivalent).
- With env override, originals path joins `{override}/originals/…`.
- `toClipResponse` includes `path`.

**Verification:** Vitest for config + response mapping.

### U2. Persist segments with path records

**Goal:** Write segment MP4s under `{root}/segments/{clipId}/`, store paths in DB, keep files after processing.

**Requirements:** R2, R6, R9–R11, R13–R14

**Files:**
- Create: `apps/api/src/db/migrations/021_clip_segments.sql` (number = next available)
- Mirror schema in `tables.sql` / `deploy.sql` if that is project convention
- Modify: `scripts/video-processing/process-clip.js`
- Modify: ensureDatabase / serve-mockup if migrations are applied there
- Modify: clip API responses to include `segments: [{ index, path }]`

**Approach:**
- Create durable segment dir per clip; run ffmpeg into it.
- Upsert `clip_segments` rows.
- Ensure `finally` only removes temp frame root, not durable segment dir.
- On reprocess, clear prior segment rows (and files under that clip’s segment folder) before rewrite.

**Test scenarios:**
- After process (or a unit that simulates segment write + DB insert), files exist under `segments/{clipId}/` and rows match paths.
- Temp cleanup does not delete durable segment files.
- Clip response includes `segments` array with `path`.

**Verification:** Vitest with `VANTAGEIQ_VIDEO_ROOT` temp; optional manual smoke upload+process.

## Verification Contract

### Automated

```bash
npx vitest run apps/api/tests/integration/video-processing/
```

(Add focused specs for storage root + segments as implemented.)

### Manual smoke

1. Ensure `C:\vantageiq_videos` is writable (or set `VANTAGEIQ_VIDEO_ROOT`).
2. Upload a clip from S4 → confirm file under `originals/` and API `path`.
3. Wait for processing → confirm `segments/{clipId}/` files remain; DB/API lists segment paths.
4. Confirm structured log has no video bytes.

### Quality gates

- Default root is `c:/vantageiq_videos`.
- No dependency on repo `data/clip-videos` for new writes.
- Backlog 005 not implemented here.

## Definition of Done

- [ ] Originals written under `{root}/originals/`
- [ ] Segments retained under `{root}/segments/{clipId}/`
- [ ] Clip API exposes `path`; segments expose `path`
- [ ] Migration for segment records applied via existing ensure/migrate path
- [ ] Tests cover root override + persistence behavior
- [ ] `docs/backlog/004-store-original-video-and-segments.md` marked planned (then done after ship)

## Appendix

### Origin

- `docs/backlog/004-store-original-video-and-segments.md`

### Related

- Feature 018: `docs/plans/2026-07-09-018-feat-s4-video-processing-service-plan.md`
- Follow-on: `docs/backlog/005-skill-linked-player-action-segments.md`
