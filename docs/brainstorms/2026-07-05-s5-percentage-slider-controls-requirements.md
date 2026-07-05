---
date: 2026-07-05
topic: s5-percentage-slider-controls
---

# S5 Edit Player — slider controls for ratings and scores

## Summary

Replace S5's free-text percentage inputs for the Development Progress ratings (Current Level, Fitness, Skill Progress) and the 0–10 performance scores (Average Score, Last Match Score) with a slider paired to a synced numeric box, plus a per-metric "not recorded" toggle so an unrecorded metric stays genuinely empty instead of reading as a real 0.

## Problem Frame

On `docs/ux/mockup/S5-player-edit.html`, ratings are entered as free text with placeholders like `e.g. 92%`. Nothing constrains the value, so a coach can type an out-of-range or malformed string, and there is no fast way to nudge a value up or down. Every Development Progress rating is a 0–100% measure and the two performance scores are bounded 0–10, so a bounded drag control fits the data far better than an open text box.

The subtlety is the no-stats-yet state. A newly added or unrecorded player has null ratings, and the S2 dashboard depends on those nulls (via `missingDataMessage`) to show the identity card only. A bare slider always rests at some value, which would erase the difference between "not recorded" and "genuinely 0%". The control therefore has to represent absence as a first-class state, not collapse it into zero.

## Key Decisions

- **Slider + synced number box + per-metric "not recorded" toggle.** The slider gives quick coarse setting and range affordance; the number box gives exact entry; the toggle carries the null state. Dragging the slider or editing the box keeps the other in sync. Chosen over a bare slider (can't express null) and over slider+box alone (empty box is ambiguous).
- **"Not recorded" is the null state.** Toggle off = the metric is stored as null / `N/A` and its slider+box are disabled. Toggle on = a real recorded value, including a deliberate `0`. This is the only way the control preserves the no-stats-yet contract.
- **The friendlier control covers scores too, not just percentages.** The same slider+box+toggle pattern applies to Average Score and Last Match Score on a 0–10 range with a finer step, since those fields are also bounded and nullable.
- **Ranges and steps by field type.** Ratings use 0–100 in whole-number steps and display as `N%`. Scores use 0–10 in 0.1 steps and display as one decimal. Typed values outside the range are corrected to the nearest bound rather than rejected.
- **A save clears the no-stats notice only once a rating is recorded.** The prior always-clear-on-save behavior changes: with per-metric toggles a coach could save with everything unrecorded, which would wrongly show empty sections on S2. The `missingDataMessage` notice now persists until at least one Development Progress rating (Current Level, Fitness, or Skill Progress) is recorded.

## Requirements

### Development Progress ratings

- R1. Current Level, Fitness, and Skill Progress are each entered with a slider bound to a synced numeric box over a 0–100 range in whole-number steps.
- R2. Moving the slider updates the numeric box and vice versa; the two never disagree.
- R3. Each rating has a "not recorded" control. When off, the rating is saved as null (surfaced as `N/A` on the dashboard) and its slider and box are disabled. When on, the rating is saved as the shown value, and `0` is a valid recorded value distinct from "not recorded".
- R4. A saved rating continues to display as `N%` on the S2 dashboard, unchanged from today.

### Performance scores

- R5. Average Score and Last Match Score are entered with the same slider + numeric box + "not recorded" control over a 0–10 range in 0.1 steps.
- R6. An unrecorded score is saved as null (surfaced as `N/A` / `-` on the dashboard), consistent with today's nullable score behavior.

### Load, validation, and save

- R7. Opening the edit page sets each control from the player's current profile: a recorded value shows the value with its toggle on; a null/`N/A` value shows the toggle off with the input disabled.
- R8. A value typed into a numeric box outside its field's range is corrected to the nearest bound before save.
- R9. A save clears the S2 no-stats notice (`missingDataMessage`) only once at least one Development Progress rating is recorded; saving with all ratings still "not recorded" leaves the notice in place.

### Out of scope for this control (unchanged fields)

- R10. The metric-change badges (`"Up 5%"` label + trend) keep their existing text-label-plus-trend inputs; they are signed deltas, not absolute ratings.
- R11. Recent Avg, Total Minutes, Appearances, and the clip counts keep their current inputs; they are not 0–100 ratings.

## Acceptance Examples

- AE1. Recorded rating round-trip. **Covers R1, R2, R4.** **Given** a player with Current Level `92%`, **when** the coach opens S5, **then** the Current Level toggle is on, slider and box read `92`; **when** they drag the slider to `85` and save, **then** the box reads `85` and S2 shows `85%`.
- AE2. Not-recorded stays empty and notice persists. **Covers R3, R7, R9.** **Given** a no-stats player, **when** the coach opens S5, **then** every rating toggle is off with disabled inputs; **when** they save without turning any on, **then** those ratings persist as null, S2 shows `N/A` (not `0%`), and the no-stats notice remains.
- AE6. Recording one rating clears the notice. **Covers R9.** **Given** a no-stats player, **when** the coach turns on Current Level and sets `70%` and saves, **then** the no-stats notice is gone and S2 shows the stats sections.
- AE3. Zero is a real value. **Covers R3.** **Given** a rating toggle turned on and its value set to `0`, **when** the coach saves, **then** the rating is stored as `0`/`0%`, distinct from a not-recorded rating.
- AE4. Score round-trip on the 0–10 range. **Covers R5, R6.** **Given** Average Score recorded at `7.5`, **when** the coach opens S5, **then** the score control reads `7.5` on a 0–10 range; **when** they clear it via "not recorded" and save, **then** the score persists as null and S2 shows `N/A`.
- AE5. Out-of-range typed value. **Covers R8.** **Given** a coach types `140` into a rating box, **when** focus leaves or they save, **then** the value is corrected to `100`.

## Outstanding Questions

### Deferred to planning

- Whether ratings continue to be stored as `N%` strings or move to numeric storage with formatting on display — an implementation choice as long as R4's display is preserved.
- Exact disabled-state styling and toggle affordance (checkbox vs switch), within the existing mockup design language.

## Sources / Research

- `docs/ux/mockup/S5-player-edit.html` — current free-text rating inputs (`fieldCurrentLevel`, `fieldFitness`, `fieldSkillProgress`) and 0–10 score inputs (`fieldAverageScore`, `fieldLastMatchScore`), plus the metric-change and non-percentage fields that stay unchanged.
- `docs/ux/mockup/S2-player-dashboard.html` — consumes `missingDataMessage` to drive whole-section visibility; the null/not-recorded state feeds this.
- `docs/ux/mockup/API-Mockup-Mapping.md` — "no stats yet" and edit-player contracts, including the current always-clear-on-save behavior of `missingDataMessage`.
- `docs/plans/2026-07-04-006-feat-s2-edit-player-profile-plan.md` — the plan that introduced the S5 edit page these controls modify.
