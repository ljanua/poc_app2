---
title: feat — S6 assessment cards expand for full comments and skill ratings
date: 2026-07-20
type: feat
classification: software
feature: 042
slug: feat-s6-expand-assessment-details
product_contract_source: ce-plan-bootstrap
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
origin: User request 2026-07-20 — S6 allow expand each video assessment to show complete comments and all skills rated. Scope confirmed proceed with inline accordion; collapsed = comment snippet + overall %; expanded = full comments + full skill list. Guest expand allowed (read-only).
---

# Feature 042 — S6 expandable assessment details

## Goal Capsule

- **Objective:** On S6 Video Assessments, each complete (and failed-with-message) card is **compact by default** and can be **expanded** to show the **full `comments` text** and the **complete rated-skills list** with percentages.
- **Authority:** `docs/ux/mockup/S6-assessment-list.html`, `docs/ux/mockup/style/site.css`, Playwright `tests/playwright/s6-assessment-list.spec.js` (and guest share specs if they assert comment/skill visibility), `docs/ux/mockup/API-Mockup-Mapping.md`. Clip payload already carries `comments` + `skillRatings` via `GET /v1/clips` / share clips.
- **Done when:** Collapsed cards show overall score + a short comment preview (no full skill list); Expand reveals full comments (preserve newlines / STRENGTHS–WEAKNESSES–OPPORTUNITIES) and all assessment skills with scores; guest mode can expand; tests cover toggle + content.
- **Out:** New API fields; editing comments; reprocessing UX changes; persisting expand state across visits; modal-only details UI.

### Summary

Collapse S6 assessment detail behind an inline expand control so the list stays scannable while full scout comments and every rated skill remain one click away.

## Product Contract

### Problem Frame

Complete assessments now carry long scout-style `comments` (STRENGTHS / WEAKNESSES / OPPORTUNITIES) and multi-skill `skillRatings`. Showing everything on every card makes the grid hard to scan. Users need a compact list with optional full detail.

### Actors

- A1. **Coach / ClubAdmin / SystemAdmin** — expand any assessment card they can see on S6.
- A2. **Guest (share link)** — same expand for read-only cards (no edit actions).

### Key Flows

- F1. Open S6 → complete cards show header/meta, **overall score**, **comment snippet**, and an **Expand** control; skill rows hidden.
- F2. User expands a card → full `comments` (multiline) + full skill rating list appear; control becomes **Collapse** (`aria-expanded` toggles).
- F3. Pending / in-progress cards have no assessment detail to expand (status message only; unchanged).
- F4. Failed cards: if error/`comments` text exists, expand shows full error/comment text; no skill list when none rated.

### Acceptance Examples

- AE1. Complete card collapsed: overall rating visible; full STRENGTHS block not fully visible; `.result-skills` not in the collapsed body (or hidden).
- AE2. Expand → full comments text visible including section headings when present; every key in `skillFocus ∪ skillRatings` listed with % or N/A.
- AE3. Collapse again restores compact state.
- AE4. Guest S6 can expand a complete card the same way.
- AE5. Multiple cards may be expanded independently (no “only one open” accordion rule).

### Requirements

#### Collapsed vs expanded

- R1. For complete assessments, default **collapsed**.
- R2. Collapsed shows: existing card chrome (player, situation, status, meta, actions) + **overall score** + **comment preview** (truncate long text, e.g. ~120 chars or ~2 lines with ellipsis) when comments exist.
- R3. Collapsed does **not** show the full skill list.
- R4. Expanded shows **complete** `comments` (or failure message) with readable multiline formatting (`white-space: pre-wrap` or equivalent) and the **full** skill list (reuse existing `buildSkillListMarkup` / `assessmentSkills` behavior).
- R5. Toggle control with stable test ids (e.g. `data-testid="assessment-expand-toggle"`) and `aria-expanded` / `aria-controls` pointing at the details region (`data-testid="assessment-details"`).
- R6. Failed cards: expand only when there is comment/error text; otherwise omit toggle.
- R7. Pending / in_progress: no expand for assessment details.

#### Scope / roles

- R8. Works for signed-in and guest share S6 (same card renderer).
- R9. Expand does not change Play / Back / Delete / Re-process behavior.

#### Data

- R10. Use existing clip `comments` and `skillRatings` (and `skillFocus` for ordering). No new backend endpoint required unless mapping notes a gap (verify list payload already includes both — it does today).

#### Tests / docs

- R11. Playwright: collapsed vs expanded assertions; update specs that assumed full `.result-comment` / `.result-skills` always visible.
- R12. Mapping note for S6 expand behavior.

### Scope Boundaries

**In scope:** S6 card collapse/expand UI + CSS; guest parity; Playwright + mapping.

**Out of scope:** API changes; localStorage persistence of expand state; exclusive single-open accordion; redesign of thumbnail/play modal.

### Success Criteria

- Users can scan the list without long scout text, then expand any assessment for full comments and all rated skills.

## Planning Contract

### Key Technical Decisions

- KTD1. **Inline accordion on the card** (not a modal) — matches S2 `is-collapsed` / `aria-expanded` patterns; keeps Play/actions in context.
- KTD2. **Collapsed preview** = truncated comment + overall % only; skills only when expanded.
- KTD3. **Independent expand** — any number of cards open; no exclusive accordion (simpler, better for compare-two).
- KTD4. **Session-only expand state** — lost on re-render/filter change is acceptable; do not persist to `localStorage` in this feature.
- KTD5. **No API work** — `listClips` / share clips already return `comments` and `skillRatings`.

### Technical Design

```
.result-card
  …header, meta, score…
  .result-comment--preview (truncated)     // collapsed
  [Expand details] button
  .assessment-details[hidden]             // expanded body
     .result-comment (full, pre-wrap)
     .result-skills (all rows)
```

Reuse `buildCommentMarkup` / `buildSkillListMarkup` inside the details region; add a truncated preview helper for collapsed.

### Assumptions

- A1. Truncation length ~120 characters (or CSS line-clamp 2) is enough for preview; implementer may tune.
- A2. Existing tests that require visible full comments/skills will expand first or assert preview + expand path.
- A3. Offline seed clips with short comments still show Expand when there is any detail (comment and/or skills); if neither, omit toggle.

### Dependencies and Sequencing

1. U1 — S6 card markup/CSS/toggle behavior.
2. U2 — Playwright + mapping.

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Specs fail expecting always-visible comments/skills | Update S6 specs; guest specs if they assert the same |
| Filter re-render closes expanded cards | Document as expected (KTD4) |
| Long comments without pre-wrap look broken | Require `pre-wrap` (or equivalent) on full comment |

### Open Questions

- None blocking.

## Implementation Units

### U1. S6 card expand/collapse UI

**Goal:** Compact cards with expandable full comments + skills.

**Requirements:** R1–R10, KTD1–KTD5

**Files:**
- Modify: `docs/ux/mockup/S6-assessment-list.html`
- Modify: `docs/ux/mockup/style/site.css`

**Approach:**
- Split comment into preview vs full; move skill list into a details region default-hidden.
- Add toggle button; wire click to toggle class/`hidden` + `aria-expanded`.
- Preserve guest and editor action rows outside the collapsing region.
- Pattern reference: S2 section toggles (`is-collapsed`, `aria-expanded`).

**Test scenarios:** Covered in U2.

### U2. Playwright + mapping

**Goal:** Regression coverage and docs.

**Requirements:** R11–R12

**Files:**
- Modify: `tests/playwright/s6-assessment-list.spec.js`
- Modify as needed: `tests/playwright/s6-guest-share.spec.js` (only if assertions break)
- Modify: `docs/ux/mockup/API-Mockup-Mapping.md`

**Test scenarios:**
- Happy: collapsed complete card shows rating; skills list not visible; expand shows full comment + skill rows.
- Happy: collapse restores compact state.
- Happy: guest can expand (if guest fixture has comments/skills).
- Edge: pending card has no expand toggle.
- Regression: play / delete / reprocess still work on expanded or collapsed cards.

## Verification Contract

- `npx playwright test tests/playwright/s6-assessment-list.spec.js` (and guest share S6 file if touched).
- Manual: open S6 with a complete clip that has long scout comments → expand → confirm STRENGTHS/WEAKNESSES/OPPORTUNITIES and all skill %s.

## Definition of Done

- R1–R12 satisfied; U1–U2 complete.
- Collapsed list is scannable; expanded detail shows complete comments and all rated skills.

## Appendix

### Baseline

- Today S6 always renders full `.result-comment` and `.result-skills` on complete cards (no truncate CSS).
- Clip API already returns `comments` and `skillRatings`.
- S2 already uses collapsible `is-collapsed` + `aria-expanded` patterns to mirror.

### Product Contract preservation

- New solo plan (`product_contract_source: ce-plan-bootstrap`); no upstream brainstorm file.
