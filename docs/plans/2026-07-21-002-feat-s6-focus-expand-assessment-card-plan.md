---
title: feat — S6 focus expand hides other cards for wide comment view
date: 2026-07-21
type: feat
classification: software
feature: 044
slug: feat-s6-focus-expand-assessment-card
product_contract_source: ce-plan-bootstrap
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
origin: User request 2026-07-21 — On S6 expand must hide other cards, expand horizontally for comment visibility, and collapse restores the full grid.
---

# Feature 044 — S6 focus expand (single-card wide view)

## Goal Capsule

- **Objective:** When a user expands assessment details on S6, switch to a **focus layout**: hide all other clip cards, show only the selected card **full-width / horizontal** so scout comments and skills are easy to read; **Collapse** restores the normal multi-card grid.
- **Authority:** `docs/ux/mockup/S6-assessment-list.html`, `docs/ux/mockup/style/site.css`, `tests/playwright/s6-assessment-list.spec.js`, `docs/ux/mockup/API-Mockup-Mapping.md`.
- **Done when:** Expand hides siblings and widens the active card; collapse shows all cards again; guest parity; Playwright covers focus + restore; no API changes.
- **Out:** Modal overlay; persisting focus across visits (`localStorage`); changing clip data or processing pipeline.

### Summary

Replace Feature 042’s “inline accordion beside neighbors” with a **single-card focus mode** for expanded assessments — better readability for long SWOT comments without scrolling a cramped grid cell.

## Product Contract

### Problem Frame

Feature 042 added inline expand inside each grid card. Long STRENGTHS / WEAKNESSES / OPPORTUNITIES text is still squeezed beside a thumbnail in a ~340px column. Users want a **reading mode**: one assessment at a time, using the full content width.

### Actors

- A1. **Coach / ClubAdmin / SystemAdmin** — expand one assessment into focus view; collapse back to the list.
- A2. **Guest (share)** — same focus expand/collapse (read-only actions unchanged).

### Key Flows

- F1. Default S6 grid — all matching cards visible (current compact cards).
- F2. User clicks **Expand details** on a card → that card enters **focus mode** (full details visible + wide layout); **all other cards hidden**; toggle reads **Collapse details**.
- F3. User clicks **Collapse details** → focus mode ends; **all cards visible** again in the normal grid; expanded card returns to compact preview state.
- F4. User expands card A, then expands card B → A collapses and hides; B becomes the sole focus card (exclusive focus).
- F5. Filter/team change or `render()` refresh while focused → exit focus mode and redraw the grid (session-only state; same as Feature 042).

### Acceptance Examples

- AE1. Grid with 3+ cards → expand one → exactly **one** `.result-card` visible in `#resultsGrid`.
- AE2. Focused card spans usable horizontal width; full `comments` (pre-wrap) and skill list readable without a narrow column.
- AE3. Collapse → card count matches pre-expand filter; previously hidden cards reappear.
- AE4. Guest share S6: same hide/show + collapse behavior.
- AE5. Play / Back / Delete / Re-process on the focused card still work.

### Requirements

#### Focus expand behavior

- R1. **Exclusive focus** — at most one card in focus-expanded state; expanding another card replaces focus (supersedes Feature 042 AE5 multi-open).
- R2. On expand: add grid-level class (e.g. `assessment-focus-mode` on `#resultsGrid`) and card-level class (e.g. `is-focus-expanded` on the active `.result-card`); set `aria-expanded="true"` on its toggle; show `assessment-details` (reuse Feature 042 details region).
- R3. On expand: **hide** all sibling `.result-card` elements (CSS `display: none` or equivalent — prefer CSS over DOM removal so collapse is instant).
- R4. On collapse: remove focus classes from grid and card; hide `assessment-details`; restore sibling visibility; toggle back to **Expand details**.
- R5. Collapsing must restore the **same** filter/team/status selection and card set (no navigation away from S6).

#### Layout (horizontal / wide)

- R6. In focus mode, the active card uses a **wide horizontal layout**: thumbnail + metadata on the left (or top on very narrow viewports), assessment text + skills using **full content width** (e.g. grid `grid-template-columns: 1fr` and card `flex` row with `flex: 1` on text column).
- R7. Preserve existing compact card layout when **not** in focus mode.
- R8. Comment body keeps `white-space: pre-wrap` and sectioned SWOT from Feature 042.

#### Scope / roles

- R9. Same renderer for signed-in and guest; no new API fields.
- R10. Pending cards: no expand toggle (unchanged). Failed cards: expand only when details exist (unchanged).

#### Tests / docs

- R11. Playwright: expand hides other cards; collapse restores count; switching focus between two cards.
- R12. Update `API-Mockup-Mapping.md` S6 expand bullet — focus mode hides siblings.

### Scope Boundaries

**In scope:** S6 HTML toggle logic, CSS focus layout, tests, mapping note.

**Out of scope:** Backend; modal; URL hash for focused clip; localStorage; animating card transitions (optional polish only if trivial).

### Success Criteria

- Coaches can read full scout comments in a wide single-card view, then one click returns to the full video list.

## Planning Contract

### Key Technical Decisions

- KTD1. **CSS-driven hide** — `#resultsGrid.assessment-focus-mode .result-card:not(.is-focus-expanded) { display: none; }` keeps collapse simple and avoids re-fetching clips.
- KTD2. **Extend Feature 042 toggle** — same `[data-testid="assessment-expand-toggle"]`; expand/collapse text unchanged; behavior change is focus + hide siblings.
- KTD3. **Centralize focus state in click handler** — on expand, remove `is-focus-expanded` / collapse details on any prior focused card before focusing the new one.
- KTD4. **Reset on `render()`** — do not persist focus across filter changes (call `clearAssessmentFocus()` at start of `render()` or omit focus classes when rebuilding DOM).
- KTD5. **Horizontal layout** — focus card uses wider thumbnail (optional ~160–200px) and `result-content` grows; `assessment-details` not constrained by grid minmax(340px).

### Technical Design

```
#resultsGrid                    // default: multi-column grid
  .result-card                   // compact preview

#resultsGrid.assessment-focus-mode
  .result-card:not(.is-focus-expanded)  → hidden
  .result-card.is-focus-expanded
    flex-direction: row (or column @mobile)
    width: 100%
    .assessment-details            → visible
    .result-comment--preview       → hidden (existing)
```

**Toggle handler (directional):**

1. Expand click → if another card is focused, collapse it first.
2. Show details, add `is-focus-expanded` on card, `assessment-focus-mode` on grid.
3. Collapse click → hide details, remove focus classes from card + grid.

### Assumptions

- A1. Exclusive focus is acceptable (replaces Feature 042 independent multi-open).
- A2. “Expand horizontally” means full-width card in the content area, not a new page or modal.
- A3. Mobile: stacked layout is OK if horizontal row is too tight (&lt;640px → column).

### Dependencies and Sequencing

1. U1 — Focus mode JS (toggle + clear on render).
2. U2 — CSS wide layout + hide siblings.
3. U3 — Playwright + mapping.

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Existing tests expect multiple expanded cards | Update specs for exclusive focus + hidden siblings |
| `render()` after delete while focused | `render()` rebuilds DOM — focus naturally clears |
| Guest / signed-in drift | Same `render()` path |

### Open Questions

- None blocking. Optional follow-up: scroll focused card into view on expand.

## Implementation Units

### U1. Focus mode toggle logic

**Goal:** Expand hides siblings; collapse restores grid.

**Requirements:** R1–R5, R9–R10, KTD2–KTD4

**Files:**
- Modify: `docs/ux/mockup/S6-assessment-list.html`

**Approach:**
- Add `clearAssessmentFocus()` removing `assessment-focus-mode` and all `is-focus-expanded` (used before `render()` and when collapsing).
- Refactor expand click handler: on expand, collapse any other focused card; set grid + card classes; on collapse, call `clearAssessmentFocus()` for that card.
- At top of `render()`, call `clearAssessmentFocus()` (no-op if grid empty).

**Test scenarios:** Covered in U3.

### U2. Wide horizontal focus layout

**Goal:** Readable full-width comments in focus mode.

**Requirements:** R6–R8, KTD5

**Files:**
- Modify: `docs/ux/mockup/style/site.css`

**Approach:**
- `#resultsGrid.assessment-focus-mode { grid-template-columns: 1fr; }`
- `.result-card.is-focus-expanded { width: 100%; max-width: none; }` — larger gap, optional wider thumbnail.
- Ensure `.assessment-details` and `.result-comment--full` use available width; keep responsive stack under ~640px if needed.

**Test scenarios:** Visual + Playwright visibility of full comment in focus mode.

### U3. Playwright + mapping

**Goal:** Regression coverage and docs.

**Requirements:** R11–R12

**Files:**
- Modify: `tests/playwright/s6-assessment-list.spec.js`
- Modify: `docs/ux/mockup/API-Mockup-Mapping.md`

**Test scenarios:**
- Happy: 3 cards visible → expand Messi → 1 card visible, full comment + skills visible.
- Happy: collapse → 3 cards visible again, details hidden.
- Happy: expand A then B → only B visible, A collapsed.
- Regression: play / delete still reachable on focused card (or collapse first if actions hidden — document actual UX).
- Guest: same if guest fixture has expandable clip (optional single test).

## Verification Contract

- `npx playwright test tests/playwright/s6-assessment-list.spec.js`
- Manual: S6 with 3+ assessments → expand → only one wide card; collapse → grid returns.

## Definition of Done

- R1–R12 satisfied; U1–U3 complete.
- Focus expand improves comment readability; collapse restores the full list.

## Appendix

### Baseline (Feature 042)

- Inline expand inside grid cell; multiple cards may stay expanded independently.
- Toggle: `assessment-expand-toggle` / `assessment-details`; compact preview + full SWOT in details region.

### Product Contract preservation

- Builds on Feature 042 data and markup; **changes** expand UX from multi-open accordion to exclusive focus-wide view.
