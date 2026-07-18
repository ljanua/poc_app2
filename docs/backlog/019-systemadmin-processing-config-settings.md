---
id: 019
title: SystemAdmin processing_config settings page
status: open
created: 2026-07-17
updated: 2026-07-17
source: user
tags: [admin, settings, processing-config, system-admin]
---

# 019 — SystemAdmin processing_config settings page

## Idea

Add a new **settings page** managed only by **SystemAdmin** to view and edit **all attributes** in the `processing_config` table (e.g. `ytdlp_path`, `ffmpeg_path`, Ollama URL/model, max parallel video processes).

## Why it matters

Operators currently need SQL or env/server access to change processing paths and related knobs (such as pointing `yt-dlp` at a known install folder). A gated admin UI would make those changes safe and discoverable without touching the database by hand.

## Notes

- Table: `processing_config` (`key`, `value`, `description`, `updated_at`)
- Related: video processing pipeline (`scripts/video-processing/`), S4 link ingest / `ytdlp_path`
- Open: new screen id (e.g. S9), nav placement (SystemAdmin-only bottom nav vs link from S7/S8), whether keys can be created/deleted or only edit existing rows
