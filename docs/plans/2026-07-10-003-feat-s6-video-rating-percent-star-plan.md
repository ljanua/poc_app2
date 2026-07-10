---
title: feat — S6 video rating as percent with star threshold
date: 2026-07-10
type: feat
classification: software
feature: 023
slug: feat-s6-video-rating-percent-star
product_contract_source: ce-plan-bootstrap
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
origin: docs/backlog/002-s6-video-rating-percent-star.md — scope confirmed 2026-07-10 (“go ahead”); score treated as 0–1 fraction → percent; missing score → N/A; star bright only when percent > 80.
---

# Feature 023 — S6 Video Rating Percent + Star Threshold

## Goal Capsule

- **Objective:** On `S6-assessment-list`, show completed clip scores as **0%–100%** (not `x / 5.0`), and make the star **bright only when percent > 80**; otherwise gray.
- **Authority:** Mockup UI `docs/ux/mockup/S6-assessment-list.html` + `docs/ux/mockup/style/site.css`; align offline seed scores in `mockup-api-client.js` if needed for consistent display; Playwright `tests/playwright/s6-assessment-list.spec.js`.
- **Done when:** Complete cards show percent labels; star bright/gray follows `> 80`; null score shows **N/A** with gray star; Playwright covers bright vs gray and percent formatting.
- **Out:** Changing video-processing score computation; per-skill rows on the card (backlog 003); “View Results” → “Back” (003); thumbnails (006); DB migration of historical scores.

### Summary

Display-only S6 change: format `clip.score` as a percent, brighten the star only above 80%, and show N/A when score is missing — with a small display helper that tolerates legacy 1–5 offline seed values.

## Product Contract

### Problem Frame

S6 labels completed clips as `score / 5.0` with an always-lime star. Pipeline scores are already **0.00–0.99** fractions (Feature 018), so the `/ 5.0` label is misleading. Coaches need a clear **percent** and a simple visual cue for strong clips (**> 80%**).

### Actors

- A1. **Coach / SystemAdmin** — browses S6 cards and reads score + star at a glance.

### Key Flows

- F1. Complete clip with score 0.82 → card shows **82%**; star bright.
- F2. Complete clip with score 0.75 → card shows **75%**; star gray.
- F3. Complete clip with `score: null` → card shows **N/A**; star gray.
- F4. Pending/failed cards unchanged (no percent row for pending/failed beyond today’s behavior).

### Acceptance Examples

- AE1. Score `0.81` → `81%`, star has bright/active class.
- AE2. Score `0.80` → `80%`, star remains gray (threshold is **strictly greater than** 80).
- AE3. Score `null` on a complete clip → `N/A`, gray star.
- AE4. No remaining ` / 5.0` text on S6 complete cards.
- AE5. Offline/local seed clips still render a sensible percent (not broken `420%`).

### Requirements

#### Display

- R1. For complete/assessed clips, replace `score / 5.0` with a **percent** label (e.g. `82%`).
- R2. Percent is derived from `clip.score` treated primarily as a **0–1 fraction**: `Math.round(score * 100)`.
- R3. Star is bright only when **percent > 80**; otherwise gray (including exactly 80).
- R4. When `clip.score` is null/undefined on a complete clip, show **N/A** and keep the star gray.
- R5. Pending and failed card score areas keep current non-percent behavior (awaiting / empty).

#### Compatibility

- R6. Offline seed data in `mockup-api-client.js` currently uses 1–5-ish values (e.g. `4.2`). Either normalize those seeds to 0–1 **or** teach the display helper: if `score > 1`, treat as 1–5 (`percent = round(score / 5 * 100)`). Prefer updating seeds to 0–1 **and** keeping a defensive `score > 1` branch so old localStorage stores do not show absurd percents.
- R7. Do not change `computeOverallScore` / DB write path in this feature.

#### Tests / docs

- R8. Extend Playwright S6 coverage for percent text and star bright/gray classes (or equivalent `data-testid` / class assertions).
- R9. Optional one-line note in `API-Mockup-Mapping.md` that S6 displays clip score as percent from the 0–1 fraction.

### Scope Boundaries

#### In scope

- `docs/ux/mockup/S6-assessment-list.html` (score markup + small format helper)
- `docs/ux/mockup/style/site.css` (`.rating-star` bright vs muted)
- `docs/ux/mockup/js/mockup-api-client.js` (seed score normalization as needed)
- `tests/playwright/s6-assessment-list.spec.js`
- Optional mapping doc note

#### Deferred

- Backlog 003 (Back label + all skill ratings on card)
- Backlog 006 (thumbnails)
- Recomputing or migrating production DB scores
- Changing S2 dashboard average score presentation

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Score meaning | 0–1 fraction → percent | Matches Feature 018 / analyzer; fixes wrong `/ 5.0` UI |
| Threshold | Strictly `> 80` | User: “more than 80%” |
| Missing score | `N/A` + gray star | Confirmed default on “go ahead” |
| Legacy seeds | Normalize + defensive `> 1` branch | Offline seeds still use ~1–5 |

## Planning Contract

### Key Technical Decisions

- KTD1. **Helper in S6 page script** (no new shared package required):

```javascript
// Directional — not implementation lock-in
function formatClipScore(score) {
  if (score == null || score === '' || Number.isNaN(Number(score))) {
    return { label: 'N/A', percent: null, bright: false };
  }
  const n = Number(score);
  const percent = n > 1 ? Math.round((n / 5) * 100) : Math.round(n * 100);
  const clamped = Math.max(0, Math.min(100, percent));
  return { label: clamped + '%', percent: clamped, bright: clamped > 80 };
}
```

- KTD2. **Markup:** keep `.result-rating` / `.rating-star`; add a muted class e.g. `.rating-star--muted` when not bright (or `.rating-star--bright` when bright — pick one convention and use it consistently).
- KTD3. **CSS:** muted star uses a gray/dim token already in the design system (`--text-dim` or similar); bright keeps current lime (`var(--lime)`).
- KTD4. **Seeds:** update offline `store.clips` sample scores to 0–1 fractions consistent with API (e.g. `0.84` instead of `4.2`) so local mode matches DB mode.
- KTD5. **Playwright:** assert on a known complete card (offline seed or fixture) for label regex `/\d+%/` or `N/A`, and class presence for bright vs muted; cover one case ≤80 and one >80 if seeds allow, or inject via `__USE_MOCK_LOCAL__` / DOM setup.

### Assumptions

- Confirmed unanswered call-outs: 0–1 → percent; missing → N/A.
- Related backlog 003 is separate and must not be pulled into this plan.

### Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Stale localStorage still has 1–5 scores | Defensive `score > 1` branch (R6 / KTD1) |
| Rounding edge at 80.4 → 80 | Use `Math.round`; threshold on rounded percent so UI matches label |
| Playwright depends on live DB scores | Prefer offline mock local mode with controlled seeds |

### Dependencies and Sequencing

1. Helper + S6 markup + CSS
2. Seed normalization
3. Playwright assertions
4. Optional mapping doc note

## Implementation Units

### U1. S6 percent display + star threshold

**Goal:** Render percent / N/A and bright-vs-gray star on complete cards.

**Requirements:** R1–R5, R7

**Files:**
- Modify: `docs/ux/mockup/S6-assessment-list.html`
- Modify: `docs/ux/mockup/style/site.css`

**Approach:**
- Add `formatClipScore` (or equivalent) in the S6 script.
- Replace score markup to use `label` and conditional star class from KTD2.
- Style muted vs bright stars.

**Test scenarios:**
- Unit-like: if helper is extractable, pure function cases for `0.81`, `0.80`, `null`, `4.2` (legacy).
- Otherwise covered by U2 Playwright.

**Verification:** Visual/manual on S6 + U2 tests.

### U2. Offline seed alignment + Playwright

**Goal:** Offline clips use 0–1 scores; automated proof of percent + star behavior.

**Requirements:** R6, R8, R9

**Files:**
- Modify: `docs/ux/mockup/js/mockup-api-client.js`
- Modify: `tests/playwright/s6-assessment-list.spec.js`
- Optional: `docs/ux/mockup/API-Mockup-Mapping.md`

**Approach:**
- Normalize seed `score` values to 0–1 with at least one `> 0.80` and one `≤ 0.80` complete clip for assertions.
- Add Playwright cases under offline/local mode for bright star + percent and gray star + percent (and optionally N/A if a complete null-score fixture is added).

**Test scenarios:**
- Complete high score → text matches `%\s*$` / includes `%`; star has bright class (not muted).
- Complete mid/low score (≤80%) → percent shown; star muted.
- No `/ 5.0` substring in rating row.
- Optional: complete + null score → `N/A` + muted.

**Verification:**

```bash
# With Playwright browsers path set as in prior S6 runs
npx playwright test tests/playwright/s6-assessment-list.spec.js
```

## Verification Contract

### Automated

- Playwright S6 suite (new/updated cases above).
- Optional: tiny pure-helper test only if the helper is moved to a shared `.js` module; not required if kept inline in S6.

### Manual smoke

1. Open S6 with complete clips (DB or offline).
2. Confirm percent labels and star colors for >80 vs ≤80.
3. Confirm no `/ 5.0` remains.

### Quality gates

- Display-only; no API contract change required for `score` field type.
- Backlog 003 items not implemented here.

## Definition of Done

- [ ] Complete cards show `N%` or `N/A`
- [ ] Star bright iff percent > 80
- [ ] Offline seeds aligned / defensive branch present
- [ ] Playwright covers bright and gray cases
- [ ] `docs/backlog/002-s6-video-rating-percent-star.md` marked `planned` (then `done` after ship)

## Appendix

### Origin

- `docs/backlog/002-s6-video-rating-percent-star.md`

### Related

- Feature 018 score semantics: `docs/plans/2026-07-09-018-feat-s4-video-processing-service-plan.md` (R16: score 0.00–0.99)
- Adjacent backlog: `docs/backlog/003-s6-back-and-skill-ratings.md`
