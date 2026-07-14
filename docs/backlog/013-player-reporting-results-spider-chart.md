---
id: 013
title: Player Reporting Results spider chart
status: open
created: 2026-07-13
updated: 2026-07-13
source: user
tags: [reporting, player-card, skill-ratings, s1]
---

# 013 — Player Reporting Results spider chart

## Idea

Add a **Reporting Results** view for each player. From the Player Card, users can choose a **Reporting** option that opens a view with a spider-web (radar) diagram of the player’s skill ratings. The position dropdown defaults to **Any Position** and can be changed to any other available position; the chart then shows only skills related to the selected position.

## Why it matters

Gives coaches a visual, position-scoped snapshot of a player’s skill profile beyond the tabular Skill Ratings on S2/S5.

## Notes

- Entry point: **Reporting** on the Player Card (likely S1 player list / card actions).
- Chart: spider web / radar of skill ratings.
- Position control: default **Any Position**; other positions via dropdown; graph filters to skills for the selected position.
- Likely reuses existing skill/position catalog and `player_skill_ratings` (same Any∪role patterns as S2/S5).
- Open: which exact screen hosts the view (new page vs modal), which roles can open it, and what to show for unrated skills.

## Out of scope (for now)

- Assessor attribution / rating history (see `docs/backlog/010-skill-assessment-assessor.md`, `docs/backlog/012-skill-rating-assessment-history.md`) unless later tied in.
