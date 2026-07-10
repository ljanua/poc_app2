---
id: 001
title: Structured logging fields (functionality, timestamp, user)
status: planned
created: 2026-07-10
updated: 2026-07-10
source: user
tags: [logging, audit]
---

# 001 — Structured logging fields (functionality, timestamp, user)

## Idea

Logging must include:

1. **Functionality name** — which feature/operation produced the log entry
2. **Timestamp** — when the event occurred
3. **Logged-in user id** — when a user session is available; omit or leave unset when not available

## Why it matters

Makes audit and debug logs attributable and searchable across features, without requiring a user id on every unauthenticated or system path.

## Notes

- Plan: `docs/plans/2026-07-10-002-feat-structured-logging-fields-plan.md` (Feature 022)
- Related existing work: video-processing audit log (`scripts/video-processing/audit-logger.js`, `backend_logging.txt`) and plan `docs/plans/2026-07-09-019-feat-video-processing-audit-logging-plan.md`
- Resolved in plan: shared mockup-server logger; destination `log/`; curated mutations + lifecycle; background jobs leave userId unset in v1
