---
id: 007
title: Guest read-only users and social share links
status: done
created: 2026-07-10
updated: 2026-07-13
closed: 2026-07-13
plan: docs/plans/2026-07-13-003-feat-guest-readonly-social-share-plan.md
plan_s6_followon: docs/plans/2026-07-13-004-feat-guest-s6-share-view-plan.md
source: user
tags: [auth, sharing, guest, social]
---

# 007 — Guest read-only users and social share links

## Idea

Add a **guest (read-only) anonymous user** capability, and allow **editor** users to **share a link** so recipients can view content as guests (read-only) without credentials, using a unique tokenized URL.

## Why it matters

Lets coaches/editors distribute results or dashboards externally while keeping the product safe from unauthorized changes.

## Outcome (closed)

Shipped as Feature **034** (guest S2) + Feature **035** (guest S6):

- **Visibility:** Guest with a valid share token can open S2 player dashboard and S6 assessment list for that **bound player only**, including play media/thumbnails via share-scoped APIs.
- **Share model:** Opaque tokenized URL; hash stored in `player_share_links`; no time expiry — **revoke** is the kill switch; replace-on-create.
- **Share UX:** Copy/paste link only (no social network buttons).
- **Editors:** Coach (lead-coach for the player’s team) and SystemAdmin — same roles that can edit the player on S2.
- **Write posture:** Write/nav CTAs stay visible but inert for guests; View Results is active and carries `share=` to S6.

## Plans

- `docs/plans/2026-07-13-003-feat-guest-readonly-social-share-plan.md`
- `docs/plans/2026-07-13-004-feat-guest-s6-share-view-plan.md`
