---
id: 003
title: S6 rename Back and show all skill ratings
status: done
created: 2026-07-10
updated: 2026-07-10
source: user
tags: [s6, assessment-list, ratings, ux]
---

# 003 — S6 rename Back and show all skill ratings

## Idea

On `S6-assessment-list`:

1. Rename the **"Show Results"** control/label to **"Back"**.
2. On each video result card, show **all skills assessed** with the rating provided for each.
3. For skills with **no rating**, display **"N/A"**.

## Why it matters

Makes navigation wording match the action, and gives a full per-skill breakdown on each clip card instead of a partial view.

## Notes

- Plan: `docs/plans/2026-07-10-004-feat-s6-back-and-skill-ratings-plan.md` (Feature 024)
- Completed: card action **Back**; per-skill percent/N/A from `skillFocus` ∪ `skillRatings`; offline seeds updated
- Screen: `docs/ux/mockup/S6-assessment-list.html`
- Related: `docs/backlog/002-s6-video-rating-percent-star.md`
