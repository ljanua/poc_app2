---
id: 004
title: Store original video and created segments
status: done
created: 2026-07-10
updated: 2026-07-10
source: user
tags: [video, storage, processing]
---

# 004 — Store original video and created segments

## Idea

Need a solution to **store the original uploaded video and the segments created** from it (e.g. processing cuts), so both the source file and derived segment artifacts are retained and retrievable.

## Why it matters

Without durable storage for originals and segments, reprocessing, audit, playback, and debugging depend on ephemeral or incomplete files.

## Notes

- Plan: `docs/plans/2026-07-10-005-feat-store-original-video-and-segments-plan.md` (Feature 025)
- Completed: root `c:/vantageiq_videos` with `originals/` + `segments/{clipId}/`; clip `path` + `clip_segments.path`; segments retained after processing
- Related: `docs/backlog/005-skill-linked-player-action-segments.md`
