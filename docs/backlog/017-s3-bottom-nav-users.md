---
id: 017
title: S3 bottom nav missing Users
status: done
created: 2026-07-17
updated: 2026-07-17
source: user
tags: [s3, navigation, users]
---

# 017 — S3 bottom nav missing Users

## Idea

On `S3-team-management`, the bottom navigation does not show a **Users** option. It should be available there (consistent with other screens that expose Users in the bottom menu).

## Why it matters

Coaches/admins on team management cannot jump to user management from the bottom nav and have to leave the page another way.

## Notes

- Screen: `docs/ux/mockup/S3-team-management.html`
- Related: Admin Users / user management flow (e.g. S7); confirm which roles should see Users on S3 when planning.
- Scope expanded at plan time: add Users on **every** bottom-nav screen missing it; gate to **SystemAdmin,ClubAdmin** only.
- Plan: `docs/plans/2026-07-17-005-fix-users-bottom-nav-all-screens-plan.md`
- Implemented: Users nav on S2, S3, S3a, S4, S5, S6 (parity with S1/S7/S7a/S8).
