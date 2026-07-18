---
id: 020
title: Guest video URL link from player
status: open
created: 2026-07-18
updated: 2026-07-18
source: user
tags: [guest, video, url, games, practice]
---

# 020 — Guest video URL link from player

## Idea

Allow **guest users** to add a **URL link to a video** from the player context (rather than only uploading/capturing in-app). Optionally, let them **assign** that linked video to a **game** or a **practice date**.

## Why it matters

Guests who already have share access to a player may hold useful external footage (phone uploads elsewhere, team cloud links, etc.). Capturing a link—and tying it to when it was filmed—keeps contributions lightweight without requiring full upload or coach credentials.

## Notes

- Related existing backlog: `docs/backlog/018-video-link-ingest-player-id.md` (URL ingest + timing + player ID for processing)—this item is guest-facing contribution + optional game/practice assignment, not the same as full ingest pipeline.
- Related shipped guest read-only / share: `docs/backlog/007-guest-readonly-social-share.md` (guests are currently read-only write-inert)—this idea implies some guest write path for video links.
- Open questions: which guest entry surface (S2 / share flow / other); which URL hosts are allowed; whether assignment is required or optional; whether coaches must approve before the link appears in assessments/history; how practice dates relate to existing Games / Match History models.

## Out of scope (for now)

Full video download/processing pipeline details (see 018). Coach-side bulk import. Non-guest roles unless decided later.
