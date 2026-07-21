---
title: feat — elite scout Video Assessment prompt + structured SWOT JSON
date: 2026-07-20
type: feat
classification: software
feature: 036
slug: feat-video-assessment-elite-scout-prompt
product_contract_source: ce-plan-bootstrap
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
origin: User request 2026-07-20 — replace video-assessment Ollama prompt with elite soccer scout / Player Assessment Profile structure (Position or CoreSkill, situation, age, skills + Strengths/Weaknesses/Opportunities). Response storage confirmed option 2 (expand JSON with strengths/weaknesses/opportunities + ratings; map into comments for current UI).
---

# Feature 036 — Elite scout assessment prompt + structured analysis JSON

## Goal Capsule

- **Objective:** Change the backend video-processing AI assessment prompt to the elite soccer scout / Player Assessment Profile structure, and expand the model response contract to include **`ratings` plus `strengths` / `weaknesses` / `opportunities`**, formatted into clip `comments` for existing UI.
- **Authority:** `scripts/video-processing/ollama-client.js` (prompt + parse), `scripts/video-processing/process-clip.js` (pass position / core skill into context), light updates to `analyzer.js` if summary formatting needs the new narrative; optional unit/selftest; mapping note.
- **Done when:** Each segment review uses the new prompt text; responses with structured SWOT fields parse successfully; clip `comments` contain Strengths/Weaknesses/Opportunities for S6; skill ratings + early-stop behavior remain intact.
- **Out:** Redesigning S2/S6 UI for separate SWOT sections (map into `comments` only for now); changing find-player prompts; non-soccer sport-specific prompt variants; DB schema migrations for new columns.

### Summary

Replace `buildAssessmentPrompt` with the scout profile prompt (Position or CoreSkill fallback), require expanded JSON (`ratings` + SWOT), and fold SWOT into stored `comments` while keeping numeric ratings as today.

## Product Contract

### Problem Frame

Today’s prompt is a short generic “review this video for sport…” request with only `ratings` + brief `comments`. Coaches need a richer scout-style profile (strengths, weaknesses, development opportunities) grounded in position/situation/age/skills.

### Actors

- A1. **Coach** — submits clips; reads assessment comments on S6 / player views.
- A2. **Video processing worker** — builds prompt, calls Ollama, parses JSON, persists ratings + comments.

### Key Flows

- F1. Clip processing loads player **position**, **situation**, **age**, **skill focus** → builds new scout prompt → sends with segment frames.
- F2. Model returns expanded JSON → parser extracts ratings + SWOT → ratings merge as today; SWOT formatted into `comments`.
- F3. Clip complete → S6 shows comments containing Strengths / Weaknesses / Opportunities sections.

### Acceptance Examples

- AE1. Prompt text includes “Act as an elite soccer scout and tactical analyst” and the Strengths / Weaknesses / Opportunities instructions.
- AE2. When player position is set (not empty / not “Position not set”), prompt line is `Position: {position}`.
- AE3. When position is missing/unassigned, prompt uses `Position: {coreSkill}` where coreSkill is the first skill-focus name (or `General`).
- AE4. Valid model JSON with `ratings`, `strengths`, `weaknesses`, `opportunities` yields focused skill ratings and a multi-section `comments` string.
- AE5. Legacy responses with only `comments` (string) still parse ratings; SWOT sections may be empty without failing the clip.

### Requirements

#### Prompt content

- R1. Replace `buildAssessmentPrompt` output with the user-provided structure (elite soccer scout / Player Assessment Profile), including the three analysis categories and professional tone close.
- R2. Include situation, age, and skills list as specified (`{situation}`, `{ageOfPlayer}`, `{skills}`).
- R3. **Position line:** use player `position` when assigned; otherwise use **core skill only** (first entry of `skillFocusList`, else `General`). Treat unassigned as null/blank/`Position not set` (case-insensitive), matching existing roster defaults.
- R4. Pass `position` (and derived display label) into assessment context from `process-clip.js` (`clip.position` is already loaded).
- R5. Prompt must still instruct the model to return **JSON only** with the expanded shape (so the worker can parse reliably), while the narrative instructions for SWOT remain in the prompt body.

#### Response contract (option 2)

- R6. Expected JSON shape (directional):

```json
{
  "ratings": [{"skill": "Skill Name", "rating": 0.75}],
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "opportunities": ["...", "..."],
  "comments": "optional short overall note"
}
```

- R7. Accept `strengths` / `weaknesses` / `opportunities` as **arrays of strings** or a single string; normalize to arrays of trimmed non-empty strings.
- R8. Keep existing rating parsing (0.00–0.99, skill-focus filtering) unchanged in spirit.
- R9. Map SWOT (+ optional `comments`) into the clip **`comments`** field as a readable multi-section text block, e.g.:

```text
STRENGTHS:
- …
WEAKNESSES:
- …
OPPORTUNITIES:
- …
```

- R10. Do **not** require a DB migration; do not change `skill_ratings` column shape beyond today’s skill→number map.
- R11. Rich UI for separate SWOT widgets is **deferred**; current S6 `comments` display is enough for this feature.

#### Tests / docs

- R12. Add/extend a small Node selftest (or vitest if already used nearby) for `buildAssessmentPrompt` (position vs core-skill) and SWOT→comments formatting / JSON parse helpers.
- R13. Brief note in `docs/ux/mockup/API-Mockup-Mapping.md` that video assessment comments may include Strengths/Weaknesses/Opportunities sections from the scout prompt.

### Scope Boundaries

**In scope:** Prompt rewrite; context fields; parse + format helpers; wire into `reviewSegment` / process-clip; selftest; mapping blurb.

**Out of scope:** S2/S6 SWOT layout redesign; find-player prompt; multi-sport scout variants; storing SWOT in new columns; changing early-stop thresholds or segment caps.

### Success Criteria

- New clips assessed with the scout prompt produce structured narrative in `comments` and numeric `skill_ratings` as before.
- Missing position falls back to core skill in the prompt without breaking processing.

## Planning Contract

### Key Technical Decisions

- KTD1. **Single user message** remains the Ollama pattern (prompt text + frame images); no new system-role channel unless already supported later.
- KTD2. **Soccer scout wording is intentional** for this prompt (user-provided), even though `sportType` exists on the clip — do **not** inject `{sportType}` into the scout opener unless product asks later.
- KTD3. **Expanded JSON + format into `comments`** (option 2) avoids schema migration while preserving parseability.
- KTD4. **Prefer last non-empty SWOT** across segments (same as today’s `lastComments`), or merge section lists uniquely — default: **last segment’s SWOT wins** if present, else keep prior (simple, matches current comments overwrite).
- KTD5. Explicit JSON schema instruction at end of prompt so models still return machine-parseable output despite long narrative instructions.

### Technical Design

```
processClip
  → assessmentContext = { situation, ageOfPlayer, skillFocusList, position, coreSkill }
  → buildAssessmentPrompt(context)
       positionLabel = assigned(position) ? position : coreSkill
  → reviewSegment → Ollama
  → parseRatingsFromResponse → { ratings, strengths, weaknesses, opportunities, comments }
  → formatAssessmentComments(...) → string for clip.comments
  → ratings merge / early-stop unchanged
```

**Prompt body (directional — implement as faithful multi-line or single joined string):** match the user’s scout structure; append JSON-only response contract for `ratings` + SWOT arrays.

### Assumptions

- A1. “CoreSkill” = first skill-focus checkbox value on the clip (primary skill), not a separate DB field.
- A2. Arrays of 3–4 / 2–3 / 3 items are guidance to the model, not hard validation failures if counts differ.
- A3. `buildSummary` may continue to prepend/append rating lines; SWOT lives primarily in `comments`.

### Dependencies and Sequencing

1. U1 — Prompt + context (position / core skill).
2. U2 — Parse SWOT + format comments; wire `reviewSegment` return value.
3. U3 — Selftest + mapping note.

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Longer prompt → slower / truncated model output | Keep JSON schema short at end; log parse failures |
| Model returns prose without JSON | Existing `extractJsonObject` + fail soft on SWOT; ratings may be empty → same as today |
| Soccer-only wording wrong for other sports | Deferred; document in Out / Assumptions |

### Open Questions

- None blocking. Deferred: dedicated SWOT UI on S6/S2.

## Implementation Units

### U1. Scout prompt + position / core-skill context

**Goal:** Generate the new assessment prompt with correct Position line.

**Requirements:** R1–R5

**Files:**
- Modify: `scripts/video-processing/ollama-client.js` (`buildAssessmentPrompt`)
- Modify: `scripts/video-processing/process-clip.js` (pass `position`, `coreSkill` / skillFocusList into context)

**Approach:**
- Implement `isPositionAssigned(position)` helper (reject empty / `Position not set`).
- Build prompt from the user structure; append JSON response instructions for expanded shape.
- Export helpers if useful for tests.

**Test scenarios:**
- Happy: assigned position → prompt contains `Position: Midfielder` (example).
- Happy: unassigned → prompt contains core skill name, not “Position not set”.
- Happy: prompt contains Strengths / Weaknesses / Opportunities section headers.

### U2. Parse expanded JSON + format comments

**Goal:** Persist SWOT via `comments` while keeping ratings.

**Requirements:** R6–R11

**Files:**
- Modify: `scripts/video-processing/ollama-client.js` (`parseRatingsFromResponse`, `extractComments` / new formatters)
- Modify: `scripts/video-processing/process-clip.js` if return shape of `reviewSegment` needs merging into `lastComments`

**Approach:**
- Parse SWOT fields; normalize string|array.
- `formatAssessmentComments({ strengths, weaknesses, opportunities, comments })` → sectioned text.
- `reviewSegment` returns ratings + formatted comments (and optionally raw SWOT for logging).

**Test scenarios:**
- Happy: full JSON → ratings map + comments with three sections.
- Edge: strengths as single string → one bullet/section line.
- Edge: missing SWOT keys → ratings still work; comments may be legacy `comments` only.
- Regression: rating clamp 0–0.99 still applied.

### U3. Selftest + mapping note

**Goal:** Lock prompt/parse behavior; document comments shape.

**Requirements:** R12–R13

**Files:**
- Add or extend: e.g. `scripts/video-processing/ollama-client.selftest.js` (mirror `link-ingest.selftest.js`)
- Modify: `docs/ux/mockup/API-Mockup-Mapping.md`

**Test scenarios:** Covered by U1/U2 scenarios in the selftest runner.

## Verification Contract

- `node scripts/video-processing/ollama-client.selftest.js` (or chosen selftest path).
- Optional manual: process one clip with Ollama and confirm S6 comments show SWOT sections + ratings persisted.

## Definition of Done

- R1–R13 satisfied; U1–U3 complete.
- No DB migration required.
- Existing segment/rating pipeline still completes clips.

## Appendix

### Current prompt (baseline)

Short “Review this video for sport: … Respond with JSON only …” in `buildAssessmentPrompt` — ratings + brief comments only; no position line; no SWOT structure.
