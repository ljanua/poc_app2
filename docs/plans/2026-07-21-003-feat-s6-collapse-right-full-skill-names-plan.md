---
title: feat — S6 right-align collapse toggle and full skill names in expanded list
date: 2026-07-21
type: feat
classification: software
feature: 045
slug: feat-s6-collapse-right-full-skill-names
product_contract_source: ce-plan-bootstrap
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
origin: User request 2026-07-21 — In S6-assessment-list, move Collapse to the right side of its line; show complete skill names (not abbreviation-only) for each assessed skill.
---

# Feature 045 — S6 collapse alignment + full skill names

## Goal Capsule

- **Objective:** Polish S6 assessment cards so the **Expand / Collapse details** control sits on the **right** of its row, and each skill row in the expanded details shows the **full skill name** from clip data (e.g. `Composure`), not the catalog abbreviation alone (e.g. `CMP`).
- **Authority:** `docs/ux/mockup/S6-assessment-list.html`, `docs/ux/mockup/style/site.css`, `tests/playwright/s6-assessment-list.spec.js`, `docs/ux/mockup/API-Mockup-Mapping.md`.
- **Done when:** Toggle is right-aligned in collapsed and focus-expanded states; skill rows display full names; Playwright updated; mapping note adjusted; no API changes.
- **Out:** Changing S1/S2/S8 abbreviation behavior (Feature 037); renaming `skillRatings` keys; backend skill catalog.

### Summary

Feature 037 intentionally showed abbreviations on S6 skill rows with full name in `title`. In focus-expanded reading mode (Feature 044), coaches need readable labels without hovering. Aligning Collapse to the right also matches common “done reading” affordance placement on wide cards.

## Product Contract

### Problem Frame

1. **Toggle placement** — `[data-testid="assessment-expand-toggle"]` is left-aligned below the comment preview (`text-align: left` in CSS). In focus mode the preview hides but the toggle remains left-aligned, which feels disconnected from the wide card layout.
2. **Skill labels** — `skillDisplayLabel()` maps catalog skills to 3-letter codes (`CMP`). Expanded assessment details are a reading surface; abbreviation-only labels force tooltip discovery and hurt scanability.

### Actors

- A1. **Coach / ClubAdmin / SystemAdmin** — expand/collapse assessment details; read per-skill ratings.
- A2. **Guest (share)** — same read-only expand/collapse and skill list.

### Key Flows

- F1. Collapsed card — comment preview (if any) on the left; **Expand details** aligned to the **right** of the same toolbar row.
- F2. Focus-expanded card — comment preview hidden; **Collapse details** on a **right-aligned** row above the full comment + skills block.
- F3. Expanded skill list — each row shows **full skill name** + percent or **N/A** (unchanged value column).
- F4. Unknown / non-catalog skill names (e.g. `Decision-making`) — still show the string from `skillFocus` / `skillRatings` keys (no regression).

### Acceptance Examples

- AE1. Collapsed Messi card: `.assessment-expand-toolbar` (or equivalent) is a flex row; toggle is flush right; preview remains left and clamped.
- AE2. Focus-expanded card: toggle text is **Collapse details**, right-aligned on its row; full SWOT comment and skills visible below.
- AE3. Skill row for catalog skill `Composure` shows visible text **Composure**, not **CMP**.
- AE4. Skill row for `Decision-making` still shows **Decision-making**.
- AE5. Guest share S6: same toggle alignment and skill naming.
- AE6. Playwright skill test updated: assert full name visible; remove abbreviation-only assertion.

### Requirements

#### Expand / collapse toolbar

- R1. Wrap the preview (when present) and toggle in a single row container (e.g. `.assessment-expand-toolbar`) in `assessmentExpandMarkup`.
- R2. Toolbar uses flex layout: preview `flex: 1; min-width: 0`; toggle `flex-shrink: 0; margin-left: auto` (or `justify-content: space-between` when preview exists).
- R3. **Both** **Expand details** and **Collapse details** are right-aligned (consistent placement).
- R4. When preview is empty (skills-only expand), toolbar still right-aligns the toggle.
- R5. Preserve existing toggle behavior from Features 042/044: `aria-expanded`, `aria-controls`, focus mode, exclusive expand, `clearAssessmentFocus()` on `render()`.
- R6. Remove `text-align: left` from `.assessment-expand-toggle`; move spacing to the toolbar (toggle may drop standalone `margin-top` in favor of toolbar margin).

#### Full skill names

- R7. In `buildSkillListMarkup`, render `skillName` as the visible `.result-skill-name` text (escaped).
- R8. Remove S6-only abbreviation lookup (`skillAbbrByName` / `skillDisplayLabel`) if no longer referenced.
- R9. Do **not** change clip API shape; keys remain full skill names in `skillRatings` / `skillFocus`.
- R10. Optional: omit `title` on `.result-skill-name` when visible text equals full name (no redundant tooltip). If abbreviation is kept as `title` for power users, that is optional polish — not required.

#### Tests / docs

- R11. Update `tests/playwright/s6-assessment-list.spec.js` — skill name assertions; optional layout assertion (toggle aligned right via class or computed style).
- R12. Update `API-Mockup-Mapping.md` S6 bullets: toggle toolbar right-aligned; expanded skills show **full names** (supersedes Feature 037 S6 abbreviation display note).

### Scope Boundaries

**In scope:** S6 HTML markup, CSS, Playwright, mapping doc.

**Out of scope:** S1 card abbreviations; S8 catalog; changing `skills.abbreviation` column; showing abbreviation alongside name unless a follow-up asks for `Name (CMP)` format.

### Success Criteria

- Coaches see human-readable skill names in expanded assessments without hover.
- Collapse/expand control is visually anchored on the right of its row in both states.

## Planning Contract

### Key Technical Decisions

- KTD1. **Toolbar wrapper** — minimal DOM change: wrap existing `previewMarkup` + toggle button in `.assessment-expand-toolbar`; leave `assessment-details` sibling below the toolbar (unchanged).
- KTD2. **CSS-only alignment** — prefer flex on toolbar over absolute positioning so preview + toggle share one row responsively.
- KTD3. **Direct skill name** — delete abbreviation indirection in S6; Feature 037 remains valid for S1/S8.
- KTD4. **Focus mode** — when `.result-comment--preview` is hidden, toolbar collapses to a single right-aligned toggle row (no layout jump in details region).

### Technical Design

```
.result-content
  scoreMarkup
  .assessment-expand-toolbar          // display: flex; align-items: flex-start; gap
    .result-comment--preview (opt)     // flex: 1; min-width: 0; line-clamp
    .assessment-expand-toggle          // margin-left: auto; flex-shrink: 0
  .assessment-details
    .result-comment--full
    .result-skills
      .result-skill-row
        .result-skill-name  → full skillName (e.g. "Composure")
        .result-skill-value → "84%" | "N/A"
```

**Markup change (conceptual):**

```html
<div class="assessment-expand-toolbar">
  <!-- preview div when detail.text -->
  <button class="assessment-expand-toggle" …>Expand details</button>
</div>
<div class="assessment-details" hidden>…</div>
```

### Assumptions

- A1. Right-align applies to **both** expand and collapse labels (not collapse-only).
- A2. Full name only (no `Composure (CMP)` dual label) unless product requests otherwise.
- A3. Long skill names may wrap in `.result-skill-name`; existing `min-width: 0` on the name column is sufficient.

### Dependencies and Sequencing

1. U1 — Toolbar markup + CSS (R1–R6).
2. U2 — Skill name rendering cleanup (R7–R10).
3. U3 — Playwright + mapping (R11–R12).

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Feature 037 Playwright expects `CMP` | Update S6 spec to expect `Composure` |
| Narrow card column squeezes preview + toggle | Preview flexes/truncates; toggle stays `flex-shrink: 0` |
| Docs still say S6 uses abbreviations | Update mapping in U3 |

### Open Questions

- None blocking. Follow-up: show `Full name (ABR)` if coaches want both at once.

## Implementation Units

### U1. Right-aligned expand/collapse toolbar

**Goal:** Toggle on the right of its row in collapsed and focus-expanded states.

**Requirements:** R1–R6, KTD1–KTD2, KTD4

**Files:**
- Modify: `docs/ux/mockup/S6-assessment-list.html` (`assessmentExpandMarkup` string build)
- Modify: `docs/ux/mockup/style/site.css` (`.assessment-expand-toolbar`, adjust `.assessment-expand-toggle`)

**Approach:**
- Change `assessmentExpandMarkup` to wrap `previewMarkup` + toggle in `<div class="assessment-expand-toolbar">`.
- Add CSS: toolbar `display: flex; align-items: flex-start; gap: 0.5rem; margin-top: 0.55rem; width: 100%`.
- Toggle: `margin-left: auto; margin-top: 0; text-align: right;` (remove left-align block rule).

**Test scenarios:** Covered in U3; manual check collapsed + focus-expanded alignment.

### U2. Full skill names in expanded list

**Goal:** Show complete skill name in each `.result-skill-name`.

**Requirements:** R7–R10, KTD3

**Files:**
- Modify: `docs/ux/mockup/S6-assessment-list.html` (`buildSkillListMarkup`; remove `skillAbbrByName` / `skillDisplayLabel` if unused)

**Approach:**
- Replace `skillDisplayLabel(skillName)` with `skillName` in row markup.
- Remove `title` attribute when redundant, or leave unset.
- Delete dead abbreviation map (~15 lines) to avoid drift.

**Test scenarios:** Messi fixture — `Composure` visible; `Decision-making` unchanged.

### U3. Playwright + mapping

**Goal:** Regression coverage and contract doc.

**Requirements:** R11–R12

**Files:**
- Modify: `tests/playwright/s6-assessment-list.spec.js`
- Modify: `docs/ux/mockup/API-Mockup-Mapping.md`

**Test scenarios:**
- Happy: expand Messi → `.result-skill-name` with text `Composure` count ≥ 1; no visible `CMP` in skill name cells.
- Happy: `Decision-making` row still present.
- Optional: toggle has ancestor `.assessment-expand-toolbar`; or `toHaveCSS('margin-left', 'auto')` on toggle if stable across browsers.
- Regression: focus expand/collapse flow (Feature 044) unchanged.

## Verification Contract

- `npx playwright test tests/playwright/s6-assessment-list.spec.js`
- Manual: S6 local mock — collapsed card shows Expand on the right; focus mode shows Collapse on the right; skill rows show full names.

## Definition of Done

- R1–R12 satisfied; U1–U3 complete.
- S6 expanded reading experience uses full skill names and a right-aligned expand/collapse control.

## Appendix

### Baseline (Feature 037 + 044)

- S6 `skillDisplayLabel()` prefers `skills.abbreviation` with `title=fullName`.
- Feature 044 focus mode: exclusive wide card; toggle below score; left-aligned.

### Product Contract change

- **Supersedes** Feature 037’s S6-specific AE3 (“skill list shows abbreviations”) for the expanded details region only.
- S1 Any-skill strip and S8 catalog management unchanged.
