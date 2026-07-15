---
id: 009
title: New Club Admin role
status: in_progress
created: 2026-07-10
updated: 2026-07-15
source: user
tags: [auth, roles, clubs]
plan: docs/plans/2026-07-14-001-feat-club-admin-role-plan.md
---

# 009 — New Club Admin role

## Idea

Add a new **Club Admin** role (distinct from existing roles such as Coach and System Admin).

## Why it matters

Gives club-scoped administrative control without granting full system-admin powers.

## Notes

- Related existing work: user/club assignment and manage-club flows (e.g. S7 / S7a, S3 team management)
- Original plan (`docs/plans/2026-07-14-001-feat-club-admin-role-plan.md`): Club = Coach ops for all club teams + Users mgmt within club; many per club; no S7a/S8
- **Superseded for create/change-role:** ClubAdmin may assign **Coach or ClubAdmin** (not SystemAdmin) per `docs/plans/2026-07-15-002-feat-clubadmin-assign-coach-clubadmin-roles-plan.md`
