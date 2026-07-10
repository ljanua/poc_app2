---
title: feat — S6 Back label and per-skill ratings on cards
date: 2026-07-10
type: feat
classification: software
feature: 024
slug: feat-s6-back-and-skill-ratings
product_contract_source: ce-plan-bootstrap
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
origin: docs/backlog/003-s6-back-and-skill-ratings.md — scope confirmed 2026-07-10 (“proceed”); clip assessment skill set only; per-skill values as percent; rename card “View Results” → “Back”.
---

# Feature 024 — S6 Back Label + Per-Skill Ratings on Cards

## Goal Capsule

- **Objective:** On `S6-assessment-list`, rename the card action that returns to S2 from **View Results** to **Back**, and show **all skills from the clip’s assessment** with each rating as a **percent** (or **N/A** when missing). Keep the overall percent + star from Feature 023.
- **Authority:** `docs/ux/mockup/S6-assessment-list.html` + CSS; offline clip payloads in `mockup-api-client.js` (include `skillFocus` / `skillRatings`); Playwright `tests/playwright/s6-assessment-list.spec.js`. API already returns `skillRatings` / `skillFocus` on `GET /clips` in DB mode.
- **Done when:** Card link reads **Back** and still navigates to S2; complete cards list assessment skills with percent or N/A; Playwright covers rename + skill list; offline seeds expose skill ratings for local mode.
- **Out:** Full position skill catalog beyond the clip assessment; thumbnails (006); changing S2’s “View Results” deep-link to S6; changing video-processing score computation.

### Summary

Rename S6 card “View Results” → “Back”, and render each clip’s assessment skills with percent (or N/A), using `skillFocus` ∪ `skillRatings` keys — complementary to the overall percent/star from Feature 023.

## Product Contract

### Problem Frame

S6 card actions say **View Results** even though they navigate **back** to the player dashboard. Cards also hide the per-skill breakdown already stored on clips (`skill_ratings` / `skillFocus`), so coaches only see the overall score.

### Actors

- A1. **Coach / SystemAdmin** — reviews S6 cards, reads per-skill ratings, returns to S2 via **Back**.

### Key Flows

- F1. Complete clip with `skillFocus: ["Pace", "Finishing"]` and ratings `{ Pace: 0.84 }` → card lists Pace **84%**, Finishing **N/A**, plus overall percent/star.
- F2. Complete clip with only `skillRatings` keys (no `skillFocus`) → list those keys; missing values N/A.
- F3. Pending/failed cards → no skill-rating list (or empty); action remains Pending/Failed (not Back).
- F4. Click **Back** on a complete card → navigates to S2 for that player (same href behavior as today’s View Results).

### Acceptance Examples

- AE1. Complete card action label is **Back** (not View Results / Show Results); link still opens S2 for that player.
- AE2. Complete card shows a skill row for each assessment skill; rated skills show `N%`; unrated show `N/A`.
- AE3. Overall percent + star from Feature 023 remain visible on complete cards.
- AE4. Offline/local mode shows skill rows when seeds include `skillFocus` / `skillRatings`.
- AE5. Playwright no longer depends on the “View Results” link name.

### Requirements

#### Back label

- R1. Rename the complete-card action from **View Results** to **Back** (backlog said “Show Results”; current UI is “View Results” — same control).
- R2. Preserve navigation to `S2-player-dashboard.html?player=<playerName>` (existing behavior).
- R3. Do not rename S2’s **View Results** control that deep-links into S6.

#### Per-skill list

- R4. On complete/assessed cards, show all skills in the **clip assessment set**: union of `skillFocus` (array) and keys of `skillRatings` (object), stable sorted or focus-order then extras.
- R5. For each skill, if `skillRatings[skill]` is null/undefined, display **N/A**; otherwise display as **percent** using the same 0–1 (with legacy `> 1` → /5) rules as Feature 023’s `formatClipScore` (reuse or share helper).
- R6. Do **not** expand to the player’s full position skill catalog in this feature.
- R7. Pending/failed cards do not require a skill list.
- R8. Place the skill list near the overall rating (below comments / with or under the overall percent row — implementer picks a clear layout that does not hide the overall score).

#### Data / offline

- R9. DB `GET /clips` already exposes `skillRatings` (and `skillFocus` where stored) — use them; no schema change required unless a field is missing from the list response (verify and add if absent).
- R10. Offline `listClips` must include `skillFocus` and `skillRatings` on returned rows; update seed clips with realistic focus + partial ratings so N/A is demonstrable.

#### Tests / docs

- R11. Update Playwright: Back link; skill list with at least one percent and one N/A under offline mode.
- R12. Short note in `API-Mockup-Mapping.md` for S6 Back + per-skill display.

### Scope Boundaries

#### In scope

- `docs/ux/mockup/S6-assessment-list.html`
- `docs/ux/mockup/style/site.css` (skill list styles)
- `docs/ux/mockup/js/mockup-api-client.js` (offline list + seeds)
- `scripts/serve-mockup.js` only if `skillFocus` is missing from clip list SELECT
- `tests/playwright/s6-assessment-list.spec.js`
- `docs/ux/mockup/API-Mockup-Mapping.md`

#### Deferred

- Full position skill set on cards
- Thumbnails (006)
- Renaming S2 → S6 “View Results”
- Assessor attribution (010) / assessment history (012)

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Label source | Rename card **View Results** → **Back** | Matches backlog intent; current copy is View Results |
| Skill set | Clip assessment only (`skillFocus` ∪ `skillRatings`) | Confirmed default on “proceed” |
| Per-skill format | Percent (same as overall) | Confirmed default; consistent with Feature 023 |
| Missing rating | **N/A** | Explicit backlog requirement |

## Planning Contract

### Key Technical Decisions

- KTD1. **Skill set builder:**

```javascript
// Directional
function assessmentSkills(clip) {
  const focus = Array.isArray(clip.skillFocus) ? clip.skillFocus : [];
  const rated = clip.skillRatings && typeof clip.skillRatings === 'object'
    ? Object.keys(clip.skillRatings) : [];
  const seen = new Set();
  const ordered = [];
  focus.concat(rated).forEach(function (name) {
    const key = String(name || '').trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    ordered.push(key);
  });
  return ordered;
}
```

- KTD2. **Reuse** `formatClipScore` (or extract shared formatter) for each skill value and for overall — N/A when null.
- KTD3. **Markup:** e.g. `<ul class="result-skills" data-testid="result-skills">` with `<li data-testid="result-skill-row">` containing skill name + value.
- KTD4. **Offline seeds:** e.g. Messi clip `skillFocus: ['Decision-making', 'Composure']`, `skillRatings: { 'Decision-making': 0.84 }` so Composure → N/A.
- KTD5. **Playwright:** `getByRole('link', { name: 'Back' })`; assert skill list contains a `%` row and an `N/A` row under `__USE_MOCK_LOCAL__`.

### Assumptions

- Confirmed unanswered call-outs: assessment skill set only; percent display.
- Feature 023 overall percent/star already shipped and must remain.

### Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Offline list omits `skillRatings` today | R10 — extend map + seeds |
| Empty assessment set on old clips | Show no skill list (or only overall); do not invent skills |
| Card height grows with many skills | Compact list CSS; no accordion required in v1 |

### Dependencies and Sequencing

1. Confirm/fix clip list payload (`skillFocus` + `skillRatings`) offline (+ server if needed)
2. S6 Back label + skill list UI
3. Playwright + mapping note

## Implementation Units

### U1. Clip skill payload for S6 (offline + verify API)

**Goal:** Ensure S6 can read `skillFocus` and `skillRatings` in both modes.

**Requirements:** R9, R10

**Files:**
- Modify: `docs/ux/mockup/js/mockup-api-client.js`
- Modify if needed: `scripts/serve-mockup.js` (clips SELECT already has `skill_ratings`; confirm `skill_focus` / `skillFocus` is selected)

**Approach:**
- Add fields to offline `listClips` mapping and seed data with partial ratings.
- Grep server clip list response; add `skillFocus` to SELECT/alias if missing.

**Test scenarios:**
- Offline listClips row includes `skillFocus` array and `skillRatings` object for seeded complete clips.
- (Covered further in U2 Playwright.)

**Verification:** Manual inspect or Playwright offline path in U2.

### U2. S6 Back label + skill list UI

**Goal:** Rename action to Back; render per-skill percent/N/A on complete cards.

**Requirements:** R1–R8, R11, R12

**Files:**
- Modify: `docs/ux/mockup/S6-assessment-list.html`
- Modify: `docs/ux/mockup/style/site.css`
- Modify: `tests/playwright/s6-assessment-list.spec.js`
- Modify: `docs/ux/mockup/API-Mockup-Mapping.md`

**Approach:**
- Replace View Results label with Back.
- Build skill list from KTD1; format values via shared percent helper.
- Update Playwright assertions; document in mapping.

**Test scenarios:**
- Back link visible; click reaches S2.
- Offline Messi (or seeded) card: skill list has one `N%` and one `N/A`.
- Overall rating row still present on complete cards.
- No “View Results” text on S6 complete-card actions.

**Verification:**

```bash
npx playwright test tests/playwright/s6-assessment-list.spec.js
```

## Verification Contract

### Automated

- Playwright S6 suite including Back + skill-list cases.

### Manual smoke

1. Open S6 (DB or offline): complete cards show Back + skill rows.
2. Confirm overall percent/star still correct.
3. Click Back → S2 for that player.

### Quality gates

- S2 “View Results” → S6 deep-link unchanged.
- No full position skill expansion.

## Definition of Done

- [ ] Card action label is **Back**
- [ ] Complete cards list assessment skills with percent or N/A
- [ ] Offline seeds/API expose skillFocus/skillRatings
- [ ] Playwright updated and green
- [ ] `docs/backlog/003-s6-back-and-skill-ratings.md` marked planned (then done after ship)

## Appendix

### Origin

- `docs/backlog/003-s6-back-and-skill-ratings.md`

### Related

- Feature 023: `docs/plans/2026-07-10-003-feat-s6-video-rating-percent-star-plan.md`
- Feature 021 S2→S6 deep-link (S2 keeps “View Results”)
