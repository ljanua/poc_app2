---
id: 012
title: Auditable skill rating assessment history
status: open
created: 2026-07-10
updated: 2026-07-10
source: user
tags: [assessment, skills, audit, history]
---

# 012 — Auditable skill rating assessment history

## Idea

Add **assessment history**: every time someone changes any skill rating, a separate **auditable** tracking history retains that change (append-only history of rating updates, not only the current value).

## Why it matters

Preserves a full trail of skill-rating edits for review, dispute, and compliance — current ratings alone are not enough.

## Notes

- Related backlog: `docs/backlog/010-skill-assessment-assessor.md` (who assessed, including “video assessment”); `docs/backlog/008-player-data-change-audit.md` (broader player-data audit — Feature 036 plan stores skill change rows; this item may focus on richer assessor UX later); `docs/backlog/001-structured-logging-fields.md`
- Open: per-skill event rows vs snapshot-per-save; fields retained (old/new value, actor, timestamp, clip/source)
- Open: UI to view history (S2 / S5 / S6) vs storage-only for now
