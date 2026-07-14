---
id: 014
title: S3 cold storage for videos
status: open
created: 2026-07-13
updated: 2026-07-13
source: user
tags: [video, storage, s3, cold-storage]
---

# 014 — S3 cold storage for videos

## Idea

Add **S3 cold storage** for videos (uploaded originals and/or derived segments) so media can live in durable, cost-efficient object storage rather than only on the local video root.

## Why it matters

Local disk (`c:/vantageiq_videos` / `VANTAGEIQ_VIDEO_ROOT`) does not scale or protect long-term retention; cold/archive-oriented S3 storage would keep historical clips available at lower cost.

## Notes

- Related completed local storage: `docs/backlog/004-store-original-video-and-segments.md` and plan `docs/plans/2026-07-10-005-feat-store-original-video-and-segments-plan.md`.
- Related: S6 media streaming (`GET /api/v1/clips/{id}/media`), thumbnails (`docs/backlog/006-s6-video-thumbnail.md`).
- Open: which objects go to cold storage (originals only vs segments too); lifecycle/tier (e.g. Glacier vs Infrequent Access); when to archive vs keep hot; how playback retrieves archived objects; credentials and bucket layout.

## Out of scope (for now)

- Changing assessment UX except as needed to load from S3.
- Replacing local processing working directories (ffmpeg temp) unless later decided.
