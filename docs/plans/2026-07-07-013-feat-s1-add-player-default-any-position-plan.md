---
title: feat — S1 add-player defaults to Any Position
type: feat
date: 2026-07-07
classification: software
feature: 013
slug: feat-s1-add-player-default-any-position
origin: docs/plans/2026-07-07-012-feat-s3-team-sport-and-s5-player-position-plan.md
---

# Feature 013 — S1 add-player defaults to Any Position

## Summary

When a coach opens the S1 add-player panel for a team whose sport exposes an `Any Position` row, the Position `<select>` should land on `Any Position` by default. When the team's sport has no `Any Position` row, the current default of `Position not set` stands. This is a one-line change to the dropdown's default-selection branch in `renderAddPlayerPositions` plus a Playwright scenario that locks in both branches.

## Problem Frame

Feature 012 added the sport-filtered Position `<select>` to the S1 `addPlayerPanel` and seeded an `Any Position` row for Soccer. Today the dropdown's default selection is `Position not set`, which means a coach who just wants to register a new player in the standard `Any Position` slot has to make a deliberate click on `Any Position` even though that is almost always the right answer for an unassigned player. Defaulting to `Any Position` when it is a valid option removes one mandatory click per add-player flow. Coaches whose team's sport does not seed an `Any Position` row see no behavior change.

## Requirements

### Default selection

- R1. After `renderAddPlayerPositions` populates the options, the `<select>`'s `value` is the name `Any Position` whenever one of the populated options has that name.
- R2. When no populated option is named `Any Position`, the `<select>`'s `value` is the empty string, corresponding to the `Position not set` option that the function prepends.
- R3. The default-selection rule applies on every render — including the first render and every subsequent render triggered by a change to `state.selectedTeam`. A user-selected value (i.e. the previous value) is preserved exactly as today when the previous value is still in the new option set; the new rule only changes the fallback when the previous value is missing from the new set.

### Surface stability

- R4. The dropdown's option list keeps the `Position not set` entry as the first option, ahead of the sport-filtered positions. R3 only changes the *default selection*, not the option list.
- R5. The `addPlayerFlow` payload contract is unchanged: the empty string and `Any Position` are both valid position values the backend already accepts.

## Key Technical Decisions

- KTD-1. **Default by option name, not by id.** The function already maps positions to `<option>` elements with `value = position.name` (line 425 of `S1-player-list.html`). Matching on the rendered option name `Any Position` keeps the default-selection rule independent of how the offline store names the seed row (`pos_any`) and is robust to the backend returning a position whose `id` differs.
- KTD-2. **Mirror the S5 fallback shape.** `S5-player-edit.html:601-606` already implements the "preserve previous; otherwise prefer `Any Position` (by id); otherwise first position" pattern. The S1 change is a smaller cousin — same preserve-previous behavior, but the fallback target is the `Position not set` option (the `value=""` first option) when `Any Position` is missing, not the first sport position. This keeps the S1 user-visible default consistent with the existing inline panel contract (R4) while borrowing the S5 fallback idiom.
- KTD-3. **No backend or schema change.** `players.position` is `TEXT NOT NULL DEFAULT 'Position not set'` per plan 012. The new default selection writes `Any Position` to that column for the common case, which is the same string the existing S5 edit flow already persists.

## Implementation Units

### U1. Default-position rule in S1 add-player dropdown + regression test

- **Goal:** When the S1 add-player panel populates the Position `<select>`, prefer `Any Position` as the default selection when it is in the option list; otherwise keep the current `Position not set` default.
- **Files:**
  - `docs/ux/mockup/S1-player-list.html` (modify `renderAddPlayerPositions` default-selection branch)
  - `tests/playwright/s1-add-player-position.spec.js` (extend with two scenarios: default = `Any Position` for U19 Prime, default = `Position not set` for a sport without an `Any Position` row)
- **Approach:** In the existing `else` branch of `renderAddPlayerPositions` (`S1-player-list.html:431-433`), replace the unconditional `addPlayerPosition.value = ''` with a two-step lookup: first try to set `addPlayerPosition.value = 'Any Position'` if any of the freshly built options has that text; otherwise leave `addPlayerPosition.value = ''`. The `previous`-preservation branch (lines 429-430) is untouched. The function continues to call `MockupApi.listPositions(null, null, sportId, 'active')` exactly as today.
- **Patterns to follow:** `S5-player-edit.html:601-606` for the same fallback idiom on a different surface; the existing Playwright spec `tests/playwright/s1-add-player-position.spec.js` for the offline-mode + addInitScript pattern.
- **Test scenarios:**
  - On U19 Prime (Soccer, seeded with `Any Position`), after opening the add-player panel, `[data-testid="add-player-position"]` reports its selected option text as `Any Position`, and the dropdown's count of options is unchanged (i.e. `Position not set` still appears, just not as the default).
  - On a team whose sport has no `Any Position` row (achieved by mutating the offline store to remove the `pos_any` entry, or by adding a synthetic sport with no `Any Position` row), the same panel's default selection is the empty string (`Position not set`).
  - When the coach picks a non-default value (e.g. `CM – Central Midfielder`) and then changes the team to another team that still has that position, the prior value is preserved — the new default-selection rule does not clobber an explicit user choice.
- **Verification:** `npx playwright test tests/playwright/s1-add-player-position.spec.js --reporter=list` reports the new scenarios as passing; the three existing scenarios in the same spec continue to pass. A manual check in the running mockup server (`http://127.0.0.1:5500/S1-player-list.html`) shows U19 Prime's add-player panel opening with `Any Position` preselected.

## Scope Boundaries

- **In scope:** the default-selection rule for `#addPlayerPosition` in `S1-player-list.html`; the two new test scenarios.
- **Deferred for later:** changing the default-selection rule on S5 player-edit (already defaults to `Any Position` via its own fallback); defaulting the team filter or any other `<select>` to a non-default value; replacing the `Position not set` first option with a no-position affordance on the S1 dropdown; surfacing `Any Position` as a distinct visual treatment.
- **Outside this feature's identity:** any backend, OpenAPI, or schema change; any change to the `addPlayerFlow` payload contract; the S1 bulk-assign per-row position select (still deferred per plan 012, §5.6).

## References

- `docs/ux/mockup/S1-player-list.html:391-434` — `renderAddPlayerPositions` is the single site of the change.
- `docs/ux/mockup/S5-player-edit.html:601-606` — the S5 fallback this unit's default rule mirrors.
- `docs/ux/mockup/js/mockup-api-client.js:62` — the seed row `{ id: 'pos_any', name: 'Any Position', sportId: 'sport_soccer' }` that makes R1 a user-visible change for Soccer teams today.
- `docs/plans/2026-07-07-012-feat-s3-team-sport-and-s5-player-position-plan.md` — the origin plan; this unit lands as a follow-up to its U4.
- `tests/playwright/s1-add-player-position.spec.js` — the spec to extend; existing scenarios must stay green.
