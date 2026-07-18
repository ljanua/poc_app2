---
title: "feat: Assessment History per-event average rating"
date: 2026-07-18
type: feat
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
origin: conversation (S2 Assessment History average)
---

# feat: Assessment History per-event average rating

## Goal Capsule

Show a bright-yellow, right-aligned average rating on each S2 Assessment History event, using the same formula and visual treatment as Skill Ratings position-group averages. Stop when each history event displays that average (or `—`) and Playwright + mapping cover it.

**Authority:** this plan; user request (2026-07-18).

**Product Contract preservation:** N/A (ce-plan-bootstrap).

---

## Product Contract

### Summary

Each Assessment History event already lists Date, Time, User, and Any-Position skill strips. Editors need a single glanceable average for that event’s displayed skills, matching the Skill Ratings group average (yellow `#facc15`, right-aligned).

### Requirements

- R1. Each Assessment History event shows an average rating for that event’s **displayed** Any-Position (`coreSkills`) ratings.
- R2. Average formula matches Skill Ratings / S1: mean of numeric ratings **> 0**, rounded to a whole percent; show `—` when no qualifying rating.
- R3. Visuals match Skill Ratings group averages: bright yellow (`#facc15` / `.position-group-average`), right-aligned on the event header row (meta line), not competing with Date/Time/User.
- R4. Guests remain unchanged (section still hidden); empty history unchanged.

### Actors

- A1. Coach / ClubAdmin / SystemAdmin — see averages on Assessment History events.
- A2. Guest — no change (section hidden).

### Acceptance Examples

- AE1. Seeded Messi video-assessment event (Ball Control 85, Passing 82) shows average **84%** in yellow on the right of the event meta row.
- AE2. Event with only null/zero-or-missing qualifying ratings shows `—`.
- AE3. Skill Ratings Any/Role averages remain unchanged.

### Scope Boundaries

**In scope:** S2 Assessment History event UI + CSS reuse/extension; Playwright assertion; mapping note.

**Out of scope:** Backend average field; averaging role-unique skills not shown in history; changing Skill Ratings formula; section-level (not per-event) average.

### Deferred to Follow-Up Work

- Optional API-computed `average` on history events (client-side is enough for v1).

---

## Planning Contract

### Assumptions

- Average inputs = `event.coreSkills` only (what the strip shows), not full assessment payload including role-only skills.
- Reuse existing `.position-group-average` styles (or equivalent class on the history average span) rather than inventing a new color token.

### Key Technical Decisions

- KTD1. **Client-side compute** in `renderAssessmentHistory` using the same `computeGroupAverage` logic already on S2 for Skill Ratings (extract shared helper in-page or duplicate the small function next to history render — prefer one local helper used by both if trivial).
- KTD2. **Placement:** add `<span class="position-group-average" data-testid="assessment-history-average">` inside `.assessment-history-meta`, with flex layout so meta labels stay left and average sits `margin-left: auto` on the right (mirror `.position-toggle` + `.position-group-average`).
- KTD3. **No API change** for v1.

### Patterns to follow

- `computeGroupAverage` / `setGroupAverage` in `docs/ux/mockup/S2-player-dashboard.html` (Skill Ratings)
- `.position-group-average` in `docs/ux/mockup/style/site.css` (`color: #facc15; margin-left: auto`)
- Mapping note for Skill Ratings averages in `docs/ux/mockup/API-Mockup-Mapping.md`

### Risks

- Meta row wrap on narrow screens: ensure average still right-aligns (flex-wrap OK; average on its own end).

---

## Implementation Units

### U1. Per-event average on Assessment History

**Goal:** Each history event header shows a Skill Ratings–style average for its `coreSkills`.

**Requirements:** R1–R4, AE1–AE3

**Dependencies:** None

**Files:**
- Modify: `docs/ux/mockup/S2-player-dashboard.html`
- Modify: `docs/ux/mockup/style/site.css` (only if meta flex needs a tweak so average right-aligns)
- Modify: `docs/ux/mockup/API-Mockup-Mapping.md`
- Modify: `tests/playwright/s2-player-dashboard.spec.js` and/or `tests/playwright/s9-assessment.spec.js`

**Approach:** When building each assessment-history event card, compute average from `event.coreSkills` with the Skill Ratings formula; render yellow right-aligned `N%` or `—` with `data-testid="assessment-history-average"`. Adjust `.assessment-history-meta` to `display: flex; width: 100%; align-items: center` (keep existing gap) so `margin-left: auto` on the average works.

**Execution note:** Prefer Playwright smoke on seeded Messi history (offline) over new unit helpers.

**Test scenarios:**
- Covers AE1: expand Assessment History for Lionel Messi; first event average text is `84%` (or matches Ball Control 85 + Passing 82 mean).
- Happy: after a new Assessment save that rates only one Any skill > 0, that event’s average equals that rating.
- Edge: event with empty `coreSkills` shows `—`.
- Covers AE3: Skill Ratings averages still present / unchanged visually (smoke assert any-average still visible when expanded).

**Verification:** Offline S2 Assessment History shows yellow right-aligned averages; mapping documents the formula and testid; Playwright passes.

---

## Verification Contract

- Seeded video-assessment history average matches formula.
- Visual class/color matches Skill Ratings group average.
- Guests still hide Assessment History.

## Definition of Done

- Every Assessment History event shows right-aligned bright-yellow average (or `—`).
- Formula matches Skill Ratings (`> 0` mean, rounded).
- Tests and mapping updated.
