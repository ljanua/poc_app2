---
title: feat — S1 overall Any-position rating on team row
date: 2026-07-13
type: feat
classification: software
feature: 039
slug: feat-s1-overall-any-rating
product_contract_source: ce-plan-bootstrap
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
origin: User 2026-07-13 — S1 overall rating = average of Any Position skills with rating > 0; show on team-label row far right; bright yellow; no label; — when none qualify.
---

# Feature 039 — S1 Overall Any-Position Rating

## Goal Capsule

- **Objective:** On each S1 player card, show an **overall rating** on the same row as the team chip, far right: the average of that player’s **Any Position** skill ratings that are numeric and **> 0**, rendered as a bright yellow percent with **no “Overall” (or other) label**.
- **Authority:** Reuse Feature 038 `anySkillRatings` already on the list payload / offline list; do not invent a separate ratings fetch.
- **Done when:** Team row shows yellow overall `%` or `—`; average excludes null/≤0; Playwright covers average + empty; mapping notes Feature 039.
- **Out:** Changing how individual skill cells are computed; storing a persistent overall column; S2/S5 overall meters.

---

## Product Contract

### Summary

Coaches see a compact overall score next to the team name on each roster card, derived only from rated Any-position skills (> 0).

### Problem Frame

Feature 038 exposed per-skill Any ratings on the card but left no single glanceable score aligned with the team row.

### Actors

- A1. **Coach / SystemAdmin** — scans S1 roster overall ratings.

### Key Flows

- F1. Card with one or more Any skills rated > 0 → right side of team row shows `round(avg)%` in bright yellow.
- F2. Card where every Any skill is null, missing, or ≤ 0 → right side shows `—` (same yellow style or muted variant of the same control — prefer same yellow for visual consistency).

### Acceptance Examples

- AE1. Ratings `{88, 84, 90, null, 76}` → average of 88, 84, 90, 76 → **84%** (or exact rounded integer from that set).
- AE2. All Any ratings null or 0 → display `—`.
- AE3. Value sits on the team-chip row, far right; no “Overall” / “Rating” text label visible.
- AE4. Text color is bright yellow (card palette).

### Requirements

- R1. Compute overall from `player.anySkillRatings` (Any Position only): include only ratings where `Number(rating)` is finite and **> 0**.
- R2. Display as integer percent string (`Math.round(avg) + '%'`) when at least one included rating exists; otherwise `—`.
- R3. Place the value on the **same row** as the team chip, **far right** of the card content (not under the skill strip).
- R4. Style with bright yellow text; **no visible label** beside or above the value (accessible name via `aria-label` / `title` is allowed, e.g. “Overall rating”).
- R5. Playwright + `API-Mockup-Mapping.md` updated.

### Scope Boundaries

#### In scope

- S1 `renderPlayers` + CSS for `.player-meta` layout
- Client-side average helper (pure function)
- Optional: mirror precomputed `overallAnyRating` on list payload for backend/offline parity (not required if UI computes from `anySkillRatings`)
- Tests + mapping

#### Out of scope

- Persisting overall rating in DB
- Including role-unique skills in the average
- Label copy or star iconography

---

## Planning Contract

### Assumptions

- Feature **039**; plan sequence **008** for 2026-07-13.
- Ratings remain 0–100 integers from Feature 016/038.
- Product Contract preservation: bootstrap; confirmed average rule (> 0 only) and yellow unlabeled display.

### Key Technical Decisions

- KTD1. **Compute in the S1 render path** from existing `anySkillRatings` (keep server enrichment optional). Prefer a shared tiny helper in the page (or exported from client) so Playwright offline and live agree.
- KTD2. **Rounding:** `Math.round` of the arithmetic mean of included values.
- KTD3. **Layout:** `.player-meta` becomes a flex row (`justify-content: space-between; align-items: center; width: 100%` within `.player-info`) with team chip left and `[data-testid="player-card-overall-rating"]` right.
- KTD4. **Color:** dedicated CSS class using a bright yellow (e.g. `#facc15` / `#eab308` — align with Feature 038 declining yellow if it reads well, or a brighter `#fde047`); do not reuse muted text muted.

### Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Meta row cramped with long team names | Truncate team chip; overall never wraps under strip |
| Stale localStorage without `anySkillRatings` | Empty array → `—`; Feature 038 already enriches list |

### Sources & Research

- User confirmed average rule and yellow unlabeled display
- Local: Feature 038 plan/code (`anySkillRatings`, `.player-meta`, skill strip)

---

## Implementation Units

### U1. Overall rating compute + team-row UI

**Goal:** Show yellow unlabeled overall on the team row from Any ratings > 0.
**Requirements:** R1–R4, AE1–AE4
**Dependencies:** None (Feature 038 already shipped)
**Files:**
- Modify: `docs/ux/mockup/S1-player-list.html`
- Modify: `docs/ux/mockup/style/site.css`
- Test: `tests/playwright/s1-player-list.spec.js`
**Approach:** Add `computeOverallAnyRating(anySkillRatings)` → number|null; format with existing percent/`—` style. Extend `player-meta` markup; CSS flex + yellow class. Keep `aria-label="Overall rating"` (or similar) without visible label text.
**Test scenarios:**
- Happy: Messi offline seed (mixed ratings + one null) shows expected rounded percent in yellow overall cell.
- Happy: no visible “Overall” label text in the meta row.
- Edge: player with no rated >0 Any skills shows `—`.
**Verification:** Playwright asserts `data-testid="player-card-overall-rating"` text and placement; DOM has no Overall label string.

### U2. Mapping doc

**Goal:** Trace Feature 039 in mockup mapping.
**Requirements:** R5
**Dependencies:** U1
**Files:**
- Modify: `docs/ux/mockup/API-Mockup-Mapping.md`
**Approach:** Note overall = client average of Any `anySkillRatings` > 0; UI on team row.
**Test expectation:** none — docs only.
**Verification:** Mapping mentions Feature 039 / overall rating.

---

## Verification Contract

- Playwright S1: overall percent and `—` cases; yellow/unlabeled documented via testid + absent label text
- Mapping updated

---

## Definition of Done

- [ ] U1–U2 complete
- [ ] Average uses only Any ratings > 0; else `—`
- [ ] Far-right team-row display; bright yellow; no visible label
- [ ] Mapping + Playwright updated

---

## Appendix

### Product Contract preservation

Bootstrap from user query; Product Contract records confirmed >0 average rule, yellow unlabeled display, and `—` when empty.
