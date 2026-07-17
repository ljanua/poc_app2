---
title: 'feat: S1 trim toolbar and move Only My Players into Advanced Filter'
date: 2026-07-17
type: feat
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# feat: S1 trim toolbar and move Only My Players into Advanced Filter

## Goal Capsule

- **Objective:** Simplify the S1 player-list toolbar: remove the top-of-page "Manage Teams" and "Admin Users" buttons (navigation stays in the bottom nav), and move the "Only My Players" control from the toolbar into the Advanced Filter panel, leaving only "Advanced Filter" and "Add Player" as toolbar buttons.
- **Authority:** User request 2026-07-17.
- **Stop when:** The toolbar shows only the team filter dropdown plus the "Advanced Filter" and "Add Player" buttons; "Only My Players" lives inside the Advanced Filter panel with its Coach-only visibility and default-ON behavior intact; the S1 Playwright suite (updated) is green.

## Product Contract

### Summary

`docs/ux/mockup/S1-player-list.html` currently renders a toolbar with: the team filter `<select>`, the "Only My Players" checkbox (Coach-only, default ON), "Add Player", "Advanced Filter", "Manage Teams", and "Admin Users". This plan removes the two navigation buttons ("Manage Teams" → `S3`, "Admin Users" → `S7`) from the toolbar — both are already reachable from the bottom nav (`Teams`, `Users`) — and relocates the "Only My Players" checkbox into the Advanced Filter panel. After the change the toolbar's action buttons are just "Advanced Filter" and "Add Player" (the team filter dropdown remains).

### Requirements

- R1. Remove the top-of-page "Manage Teams" button (`<a href="./S3-team-management.html">`) from the S1 toolbar.
- R2. Remove the top-of-page "Admin Users" button (`<a href="./S7-admin-user-management.html">`) from the S1 toolbar.
- R3. Move the "Only My Players" control (`#onlyMineWrap` / `#onlyMineToggle`) out of the toolbar and into the Advanced Filter panel (`#advancedFilterPanel`).
- R4. Preserve all existing "Only My Players" behavior: Coach-only visibility (hidden for SystemAdmin/ClubAdmin/Guest), default **ON** for active Coaches, and its change handler (re-scope team options + re-render players). Keep `id="onlyMineToggle"` and `data-testid="only-mine-toggle"`.
- R5. After the change, the toolbar's visible buttons are exactly "Advanced Filter" (`#toggleAdvancedFilter`) and "Add Player" (`#toggleAddPlayer`); the team filter `<select>` (`#teamFilter`) remains.
- R6. Navigation to Team Management and Admin User Management remains available via the bottom nav (`Teams` → `S3`, `Users` → `S7`, role-gated as today).

### Actors

- A1. Coach (active) — sees "Only My Players" (now inside Advanced Filter), default ON.
- A2. SystemAdmin / ClubAdmin — no "Only My Players"; Advanced Filter and Add Player available; Admin Users still in bottom nav.

### Key Flows

- F1. Coach loads S1 → toolbar shows team dropdown + "Advanced Filter" + "Add Player"; default player scope is still "only my players" (ON by default). Opening Advanced Filter reveals the "Only My Players" toggle.
- F2. Coach toggles "Only My Players" inside Advanced Filter → team options and player list re-scope exactly as before.
- F3. Any role → uses the bottom nav to reach Teams / Users.

### Acceptance Examples

- AE1. The S1 toolbar contains no link to `S3-team-management.html` or `S7-admin-user-management.html`.
- AE2. `#onlyMineWrap` is a descendant of `#advancedFilterPanel`, not of `.toolbar`.
- AE3. For an active Coach, "Only My Players" defaults checked and scoping behaves as before (toggling re-renders team options + players).
- AE4. For SystemAdmin/ClubAdmin, "Only My Players" is not shown; "Advanced Filter" and "Add Player" render.
- AE5. Bottom nav still links to `S3` (Teams) and `S7` (Users, role-gated).

### Scope Boundaries

#### In scope

- `docs/ux/mockup/S1-player-list.html` (toolbar markup, Advanced Filter panel markup; JS only as needed for the relocated element)
- `tests/playwright/s1-player-list.spec.js` (update/verify toolbar + Only My Players location)
- `docs/ux/mockup/API-Mockup-Mapping.md` (update S1 toolbar description if present)

#### Out of scope

- Any change to the Only My Players scoping logic, `getAvailableTeams`, or the backend `onlyMine` query param.
- Any change to the bottom nav, `S3`, or `S7`.
- Advanced Filter's existing Filter by / Value / Sort / Clear controls.
- Restyling beyond what's needed to place the toggle cleanly in the panel.

## Planning Contract

### Assumptions

- The team filter `<select>` (`#teamFilter`, "All Teams") **stays** in the toolbar — the user's "only 2 options" refers to the action buttons (Advanced Filter, Add Player), not the primary team filter. (Flag: confirm if the team dropdown should also move/hide.)
- "Move into Advanced Filter" means the checkbox renders inside the `#advancedFilterPanel` grid (visible when the panel is open). Default scoping still applies without opening the panel because `state.onlyMine` is initialized in the hydrate step, independent of the panel's open state.
- Coaches have Advanced Filter available (`canAdvancedFilter` is true for Coach), so the relocated toggle is reachable.

### Key Technical Decisions

- KTD1. Delete the two `<a class="btn btn-secondary">` toolbar links (`S3`, `S7`) at `docs/ux/mockup/S1-player-list.html:31-32`. No JS references them, so no script change.
- KTD2. Move the `#onlyMineWrap` label block (currently toolbar lines 25-28) into `#advancedFilterPanel`'s grid as its own cell. Keep the same element ids/testids and the `data-role-visible-to="Coach"` gate so `applyRoleGatedNav`/hydrate visibility logic is unchanged. The existing `onlyMineToggle.addEventListener('change', …)` and the hydrate block that sets `onlyMineWrap.hidden` / `onlyMineToggle.checked` continue to work by id — no handler rewrite needed.
- KTD3. Place the toggle sensibly in the panel grid (e.g., its own `<div>` cell alongside Filter by / Value / Sort, or in the `.inline-actions` row next to Clear). Presentation choice; must not break the Coach-only hide (the wrap keeps its `hidden` default until hydrate shows it for coaches).
- KTD4. Do not alter the panel's open/close logic; the toggle is simply part of the panel content now.

### Product Contract preservation

Direct planning from the user request (`product_contract_source: ce-plan-bootstrap`).

## Implementation Units

### U1. Trim toolbar and relocate Only My Players

**Goal:** Toolbar shows only team dropdown + Advanced Filter + Add Player; Only My Players lives in the Advanced Filter panel with unchanged behavior.

**Requirements:** R1–R6; AE1–AE5

**Dependencies:** None

**Files:**

- `docs/ux/mockup/S1-player-list.html`

**Approach:**

- Remove the "Manage Teams" and "Admin Users" `<a>` buttons from `.toolbar`.
- Cut the `#onlyMineWrap` label (checkbox + span) from `.toolbar` and paste it into `#advancedFilterPanel` (a new grid cell or the `.inline-actions` row). Preserve `id`, `data-testid`, and `data-role-visible-to="Coach"`.
- Leave the JS untouched except where an element must be re-looked-up (it is queried by id, so no change expected). Verify the hydrate block (`onlyMineWrap.hidden` / `onlyMineToggle.checked`) and the change handler still resolve the elements.

**Test scenarios:**

- Covers AE1. Assert `.toolbar` has no `a[href*="S3-team-management"]` and no `a[href*="S7-admin-user-management"]`.
- Covers AE2. Assert `#onlyMineWrap` is inside `#advancedFilterPanel`.
- Covers AE3. As a Coach: `#onlyMineToggle` defaults checked; toggling it still re-renders the list (existing scoping test still passes).
- Covers AE4/AE5. Advanced Filter + Add Player buttons present; bottom nav still links to `S3` and `S7`.
- Regression: opening Advanced Filter still shows Filter by / Value / Sort / Clear and they work.

**Verification:** Updated S1 Playwright green; manual check of the toolbar and the toggle inside Advanced Filter as Coach and as SystemAdmin.

### U2. Update Playwright + mapping doc

**Goal:** Tests reflect the new toolbar/filter layout; docs updated.

**Requirements:** R1–R6 (verification); AE1–AE5

**Dependencies:** U1

**Files:**

- `tests/playwright/s1-player-list.spec.js`
- `docs/ux/mockup/API-Mockup-Mapping.md`

**Approach:**

- Update any test asserting the toolbar contains Manage Teams / Admin Users, or that Only My Players is in the toolbar; move those assertions to the new location.
- Keep the Only My Players scoping tests green (behavior unchanged); they may need to open the Advanced Filter panel first to interact with the toggle.
- Update `API-Mockup-Mapping.md` S1 toolbar description if it enumerates these controls.

**Test scenarios:**

- Covers AE1–AE5 as assertions.
- Regression: existing onlyMine scoping coverage still passes (open panel → toggle → assert scope).

**Verification:** `tests/playwright/s1-player-list.spec.js` green.

## Verification Contract

- Playwright: `tests/playwright/s1-player-list.spec.js` (updated) green.
- Manual: S1 as Coach — toolbar shows team dropdown + Advanced Filter + Add Player; Only My Players is inside Advanced Filter, default ON, scoping works. As SystemAdmin — no Only My Players; Admin Users reachable via bottom nav.

## Definition of Done

- R1–R6 and AE1–AE5 satisfied.
- U1–U2 complete; toolbar trimmed to team dropdown + Advanced Filter + Add Player; Only My Players relocated with unchanged behavior; navigation preserved in the bottom nav.
- S1 Playwright suite updated and green; no change to scoping logic or the backend `onlyMine` contract.
