---
id: 018
title: Video link ingest with start time and player ID
status: done
created: 2026-07-17
updated: 2026-07-17
source: user
tags: [video, capture, ingest, player-matching]
---

# 018 — Video link ingest with start time and player ID

## Idea

Support ingesting a **video from a link** (URL), with a **starting minute** (and related timing info) so the app can extract the desired portion of the video. When extracting / processing, allow identifying the target player either by **uploading a picture** of the player or by **selecting an existing player** the app should look for.

## Why it matters

Coaches often have game or training footage already online; they need to point the app at a clip start and tell it who to find, without re-uploading a full file or guessing the player.

## Notes

- Related: `docs/backlog/004-store-original-video-and-segments.md`, `docs/backlog/005-skill-linked-player-action-segments.md`, S4 video capture / processing pipeline
- Resolved at plan time (2026-07-17):
  - Sources: direct downloadable URLs **and** YouTube/hosted (yt-dlp).
  - Timing: Start `mm:ss`; Duration `mm:ss` default `01:00`, max `02:00`.
  - Player ID: use **current roster avatar**; checkbox **Find player** defaults ON when avatar exists.
  - Find player ON: seek to Start, begin extract only when player is found, keep for requested Duration; fail if never found.
- Plan: `docs/plans/2026-07-17-006-feat-s4-video-link-ingest-find-player-plan.md`
- Implemented: S4 link mode UI, migration `027_clip_link_ingest.sql`, `link-ingest.js` / `find-player.js`, process-clip extract stage.