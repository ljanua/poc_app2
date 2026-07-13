---
id: 008
title: Audit trail for player data changes
status: done
created: 2026-07-10
updated: 2026-07-13
closed: 2026-07-13
plan: docs/plans/2026-07-13-005-feat-player-data-change-audit-plan.md
source: user
tags: [audit, players, logging]
---

# 008 — Audit trail for player data changes

## Idea

Add a feature to **track an audit of who changed player profile data, skill's rating and when** (actor + timestamp for player-data mutations).

## Why it matters

Supports accountability and troubleshooting when player profiles, assignments, or related fields are edited.
Most critically, since skills are subjective, we must be able to track in history the last time skill was changed and who made the change.

## Outcome (closed)

Shipped as Feature **036**:

- Append-only DB table `player_data_audits` for profile, team assignment, and skill rating changes
- Manual coach edits and clip→skill sync (system actor) audited with old/new values
- S2 Change History UI for Coach + SystemAdmin; hidden from guests
- Complements Feature 022 file logging (not a substitute)

## Plan

- `docs/plans/2026-07-13-005-feat-player-data-change-audit-plan.md`
