---
id: 015
title: Assign club when creating a user
status: in_progress
plan: docs/plans/2026-07-15-001-feat-s7-create-user-assign-club-plan.md
created: 2026-07-14
updated: 2026-07-15
source: user
tags: [auth, roles, clubs, s7]
---

# 015 — Assign club when creating a user

## Idea

When creating a new user on S7, always set club membership as part of the create flow:

- **SystemAdmin** must have an option to assign a club.
- **ClubAdmin** must assign a club that is one of their own clubs. If the Club Admin belongs to only one club, that club is set automatically. If they belong to more than one club, the picker shows only those clubs.

## Why it matters

New users (especially Coaches) need a club on day one so club-scoped lists and permissions work; Club Admins must not be able to place users outside their clubs.

## Notes

- Related: `docs/backlog/009-club-admin-role.md`, plan `docs/plans/2026-07-14-001-feat-club-admin-role-plan.md` (Club Admin may already auto-assign first club server-side — this item is the explicit UI option and SystemAdmin required pick).
- Touches S7 create-user modal + `POST /users` / offline `createUser` + `coach_clubs`.
- Plan: `docs/plans/2026-07-15-001-feat-s7-create-user-assign-club-plan.md`.
