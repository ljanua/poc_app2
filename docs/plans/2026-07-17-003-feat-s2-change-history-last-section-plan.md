---
title: 'feat: S2 move Change History to last section'
date: 2026-07-17
type: feat
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# feat: S2 move Change History to last section

## Goal Capsule

- **Objective:** On S2, relocate the "Change History" section so it is always the **last** dashboard section, sitting directly above the bottom action buttons ("Compare Player" / "Submit a Clip").
- **Authority:** User request 2026-07-17 — "move section 'Change History' as always be the last one. just above the action buttons to 'Compare Player', etc."
- **Stop when:** Change History renders after all other stats sections and immediately before the final `.cta-buttons`, with all existing behavior (collapse, guest-hide, empty/populated states) intact and the S2 Playwright suite green.

## Product Contract

### Summary

In `docs/ux/mockup/S2-player-dashboard.html`, the `data-section="change-history"` block currently renders **second** — right after Skill Ratings and before Development Progress, Match Time, Recent Performance, and Video Assessments. The user wants it to be the **last** section, just above the final `.cta-buttons` action row. This is a DOM-ordering change only: the inline script references the section exclusively through `[data-section="change-history"]` selectors and iterates `.stats-section` order-independently, so moving the markup does not require script changes.

### Requirements

- R1. The Change History section (`[data-testid="change-history-section"]`, `data-section="change-history"`) is the **last** `.section` in the dashboard, positioned immediately before the final `.cta-buttons` row that holds "Compare Player" and "Submit a Clip".
- R2. All existing Change History behavior is preserved: default-collapsed, per-player collapse persistence, guest-hidden (`isGuest`), empty-state message, and populated-table rendering.
- R3. The order of the other sections (Skill Ratings, Development Progress, Match Time, Recent Performance, Video Assessments) is otherwise unchanged; Skill Ratings now directly precedes Development Progress.

### Actors

- A1. Coach/ClubAdmin/SystemAdmin viewing a player dashboard (sees Change History).
- A2. Guest (share-token) viewer — Change History stays hidden as today.

### Key Flows

- F1. Coach opens S2 → scrolls past all stats sections → Change History is the final section, then the action buttons.

### Acceptance Examples

- AE1. In the rendered DOM, `[data-section="change-history"]` is the last element matching `.section`, and the next sibling (or nearest following block) is the `.cta-buttons` row containing "Compare Player".
- AE2. Change History still defaults collapsed and still hides for guest viewers.
- AE3. No other section changed relative order (Development Progress → Match Time → Recent Performance → Video Assessments order preserved; Skill Ratings first).

### Scope Boundaries

#### In scope

- `docs/ux/mockup/S2-player-dashboard.html` (move the markup block only)
- `tests/playwright/s2-player-dashboard.spec.js` (assert new ordering)
- `docs/ux/mockup/API-Mockup-Mapping.md` (update the S2 section-order note if present)

#### Out of scope

- Any change to Change History content, collapse persistence, guest logic, or the action buttons themselves.
- Any change to the other sections' content or behavior.
- Restyling the sections or the action row.

## Planning Contract

### Assumptions

- "Action buttons to 'Compare Player', etc." refers to the final page-level `.cta-buttons` row (`Compare Player` + `Submit a Clip`), not the `.cta-buttons` nested inside the Video Assessments section (`View Results` / `Submit New Clip`). Change History goes above the page-level row, after Video Assessments.
- The inline script's section handling is position-independent (selectors by `data-section`, `.stats-section` iteration), so relocating the block needs no JS edits. Verified against the visibility branches (`missingStats` and non-missing), the collapse init, and the change-history render/hide logic.

### Key Technical Decisions

- KTD1. Cut the entire `<div class="section stats-section is-collapsed" ... data-section="change-history"> … </div>` block from its current location (after Skill Ratings) and paste it after the Video Assessments section's closing `</div>` and before the final `<div class="cta-buttons">` that contains "Compare Player".
- KTD2. Preserve the block verbatim (ids, testids, `is-collapsed`, toggle, body, table). No attribute or handler changes.
- KTD3. No script changes; confirm by inspection that no code relies on Change History's DOM index.

## Implementation Units

### U1. Relocate the Change History section markup

**Goal:** Change History becomes the last section, just above the final action buttons.

**Requirements:** R1, R2, R3; AE1, AE2, AE3

**Dependencies:** None

**Files:**

- `docs/ux/mockup/S2-player-dashboard.html`

**Approach:**

- Move the `data-section="change-history"` `.section` block from directly after the Skill Ratings section to directly after the Video Assessments `.section` and immediately before the page-level `<div class="cta-buttons">` (Compare Player / Submit a Clip).
- Do not modify the block's markup, ids, or the inline script.

**Test scenarios:**

- Covers AE1. Assert `[data-section="change-history"]` is the last `.section` and precedes the `.cta-buttons` with "Compare Player".
- Covers AE3. Assert Development Progress now immediately follows Skill Ratings (change-history no longer between them).
- Covers AE2 (regression). Change History still defaults collapsed; existing guest-hide and collapse-persistence tests still pass.

**Verification:** Updated S2 Playwright green; manual scroll check that Change History is the final section above the action buttons.

### U2. Update Playwright + mapping doc

**Goal:** Tests assert the new order; docs reflect it.

**Requirements:** R1, R3 (verification); AE1, AE3

**Dependencies:** U1

**Files:**

- `tests/playwright/s2-player-dashboard.spec.js`
- `docs/ux/mockup/API-Mockup-Mapping.md`

**Approach:**

- Add an ordering assertion: the last `.section` in `#... dashboard container` is `[data-section="change-history"]`, and the following `.cta-buttons` contains "Compare Player".
- Keep existing change-history tests (guest-hide, collapse) working.
- Update `API-Mockup-Mapping.md` if it enumerates S2 section order to reflect Change History as last.

**Test scenarios:**

- Covers AE1, AE3 as assertions.

**Verification:** `tests/playwright/s2-player-dashboard.spec.js` green.

## Verification Contract

- Playwright: `tests/playwright/s2-player-dashboard.spec.js` (updated) green.
- Manual: S2 as coach — Change History is the final section directly above the "Compare Player" / "Submit a Clip" row; guest view still hides it.

## Definition of Done

- R1–R3 and AE1–AE3 satisfied.
- U1–U2 complete; Change History is the last section above the action buttons; no behavior or other-section ordering changed.
- S2 Playwright suite updated and green.
