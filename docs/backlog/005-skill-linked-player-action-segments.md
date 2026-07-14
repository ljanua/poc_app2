---
id: 005
title: Skill-linked player-action video segments
status: open
created: 2026-07-10
updated: 2026-07-10
source: user
tags: [video, processing, segments, skills, assessment]
---

# 005 — Skill-linked player-action video segments

## Idea

Break uploaded video into segments that cover **only the parts where the target player is in action**, and that are **related to the skills being observed**.

Each segment must keep a reference to:

- the **Skill** being assessed
- the **Recommendation** for that segment

One video upload may generate **multiple small video segments**, each with its **own assessment**.

## Why it matters

Turns a single long capture into focused, skill-specific clips coaches can review and rate independently, instead of one blob assessment for the whole upload.

## Notes

- Related backlog: `docs/backlog/004-store-original-video-and-segments.md` (storage of originals + segments)
- Related existing work: S4 video-processing / ffmpeg segmentation and LLM analysis (`scripts/video-processing/`, plan `docs/plans/2026-07-09-018-feat-s4-video-processing-service-plan.md`)
- Open: detection approach for “target player in action” (vision model, manual markers, heuristics)
- Open: data model — segment rows vs clip children; how Skill + Recommendation are stored and shown on S6
- Interpreted “New a solution” as **Need a solution**
