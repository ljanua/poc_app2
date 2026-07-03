# Situational Video Capture and AI Skill Assessment

## Summary
Enable coaches to record or upload short situational videos of players, then have an AI backend assess key skill dimensions later. The feature should make it easy to capture context in the moment and return clear, coach-friendly ratings without requiring manual scorekeeping.

## Problem
Coaches often observe player actions in training or games but lack a lightweight way to preserve those moments for later review. Manual note-taking is inconsistent, and existing video workflows are too heavy for quick situational captures.

## Primary Users
- Coaches
- Assistant coaches
- Performance analysts
- Scouts

## Goals
- Make it easy to capture short videos of player actions in context
- Connect captured clips with later AI-backed skill assessment
- Give coaches a concise summary of AI ratings after review
- Reduce friction in turning live observations into actionable insight

## Core Experience
Coaches should be able to:
- record or upload short clip(s) from a phone or tablet for a player
- tag the clip with a situation, player, and optionally a skill focus
- submit the clip for later AI assessment
- receive a summary of skill ratings and observations after processing

The experience should prioritize speed and simplicity, avoiding a heavy editing workflow.

## Scope
### Included
- Short video capture/upload flow for coach-facing devices
- Metadata entry for player, situation, and skill context
- backend submission pipeline for later AI assessment
- display of AI-rated skill scores and summary feedback
- ability to browse assessed clips and their ratings

### Deferred for later
- real-time video analysis during capture
- full motion-tracking or tactical clipping tools
- extended coach commentary collaboration workflows
- multi-clip storyboards or timeline editors

## Success Criteria
- Coaches can record or attach short situational videos with minimal steps
- Captured clips are submitted for AI review without manual scoring
- Coaches see a clear skills summary for each assessed clip
- The feature fits into a fast, on-field or training-side workflow

## Constraints and Assumptions
- Clips are short and purpose-specific, not full match recordings
- AI assessment is performed asynchronously after submission
- The product should not require coaches to be video-editing experts
- The feature should support common mobile capture devices

## Open Questions
- What maximum clip length should the first version support?
- Which skill dimensions should the AI rate first (e.g., decision-making, technique, positioning)?
- Should coaches be able to request an assessment at capture time, or only post-upload?
