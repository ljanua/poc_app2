---
id: 010
title: Track who made player skill assessments
status: open
created: 2026-07-10
updated: 2026-07-10
source: user
tags: [assessment, skills, audit, video-processing]
---

# 010 — Track who made player skill assessments

## Idea

Track **who made the assessment** for player skills. When the assessment was produced by the **backend video processor**, use a distinct **"video assessment"** identifier (not a normal user id).

## Why it matters

Separates human coach ratings from automated video-pipeline assessments so history, UI, and audit can show the true source.

## Notes

- Related backlog: `docs/backlog/008-player-data-change-audit.md` (general player-data change audit); `docs/backlog/001-structured-logging-fields.md`
- Related existing work: video-processing pipeline and clip skill ratings / comments
- Open: storage shape (assessor user id vs `video assessment` sentinel / enum); display on S5 / S6
- Open: whether manual edits after a video assessment re-attribute the assessor
