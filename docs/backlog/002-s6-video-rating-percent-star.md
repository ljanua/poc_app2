---
id: 002
title: S6 video rating as percent with star threshold
status: done
created: 2026-07-10
updated: 2026-07-10
source: user
tags: [s6, assessment-list, ratings, ux]
---

# 002 — S6 video rating as percent with star threshold

## Idea

Enhance `S6-assessment-list` so video ratings display as a **0%–100%** score instead of the current **1–5** scale.

The **star** icon should be bright only when the score is **greater than 80%**; otherwise keep the star gray.

## Why it matters

Gives coaches a clearer percentage read of clip quality and a simple visual cue for strong performances (>80%).

## Notes

- Plan: `docs/plans/2026-07-10-003-feat-s6-video-rating-percent-star-plan.md` (Feature 023)
- Completed: S6 shows 0%–100%; star bright only when percent > 80; N/A when missing; offline seeds normalized to 0–1
- Screen: `docs/ux/mockup/S6-assessment-list.html`
