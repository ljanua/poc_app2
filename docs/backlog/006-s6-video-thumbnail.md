---
id: 006
title: S6 video thumbnail on assessment cards
status: done
created: 2026-07-10
updated: 2026-07-13
source: user
tags: [s6, assessment-list, video, ux]
---

# 006 — S6 video thumbnail on assessment cards

## Idea

Show a **thumbnail of the video** on `S6-assessment-list` (on each assessment / video result card).

## Why it matters

Helps coaches recognize clips at a glance without opening playback.

## Notes

- Screen: `docs/ux/mockup/S6-assessment-list.html`
- Related backlog: `docs/backlog/004-store-original-video-and-segments.md`, `docs/backlog/005-skill-linked-player-action-segments.md` (which file the thumb comes from when multiple segments exist)
- Plan: `docs/plans/2026-07-13-001-feat-s6-video-thumbnail-plan.md` (Feature 032)
- Completed: process-time JPEG at `{videoRoot}/thumbnails/{clipId}.jpg` from first segment (else original); `GET /api/v1/clips/{id}/thumbnail`; S6 `[data-testid="clip-thumbnail"]` with emoji fallback
