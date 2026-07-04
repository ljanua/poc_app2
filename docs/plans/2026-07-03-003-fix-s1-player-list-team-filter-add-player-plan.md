# fix: S1 team filter should honor current-user team scope

## Summary
Fix the S1 team-filter dropdown so it is populated from the current team source of record and reflects the signed-in actor's scope. Coaches should see only the teams assigned to them, while SystemAdmins should see every available team.

## Problem Frame
The S1 team filter currently uses a hard-coded set of options in the page shell. That makes the dropdown incomplete and role-blind, so it does not match the data the user can actually access. The bug appears as a mismatch between the visible filter choices and the teams the current actor should be allowed to work with.

## Origin
- User request: "Fix bug, S1-player-list team filter is not showing all available teams in the dropdown. For a coach, it must show all teams assigned to the coach, for a SystemAdmin, it must show all teams available"

## Requirements Trace
- The S1 team filter must be populated dynamically from the current team data source instead of static HTML options.
- Coaches must see only teams assigned to them in the dropdown.
- SystemAdmins must see all available teams in the dropdown.
- Existing team selection behavior must remain safe when the current selection is no longer in the available set.
- Regression coverage must verify both Coach and SystemAdmin dropdown population paths.

## Scope Boundaries
### In scope
- S1 team-filter option generation and initialization.
- Role-aware team option resolution based on the signed-in user and existing team data.
- Regression coverage for Coach and SystemAdmin dropdown behavior.

### Deferred to follow-up work
- Reusing the same role-scoped team option logic in other mockup screens.
- A server-side role-scoped team-list endpoint if broader product workflows need it later.

### Out of scope
- Team creation or assignment workflow changes.
- Visual redesign of the S1 team filter UI.
- Role-access enforcement outside the dropdown population flow.

## Key Technical Decisions
- Derive S1 team-filter options from the same team data used for player listing rather than from static HTML values.
- Resolve team scope from the signed-in user's role and identity, using existing team payload fields such as lead coach email or user id when available.
- Preserve the existing "All Teams" fallback and keep selection state valid even when the current team is no longer included in the resolved options.

## Implementation Units

### U1. Replace static S1 team-filter options with dynamic population
**Goal:** Stop relying on hard-coded team values and build the dropdown from current team data.

**Requirements:** The S1 team filter must be populated dynamically from the current team source of record.

**Dependencies:** none.

**Files:**
- docs/ux/mockup/S1-player-list.html
- docs/ux/mockup/js/mockup-api-client.js
- tests/playwright/s1-player-list.spec.js

**Approach:**
- Replace the hard-coded option list in the S1 page with a render step that builds options from the available teams returned by the existing team data layer.
- Keep the existing "All Teams" option and ensure the dropdown is repopulated on initial load and after relevant data refreshes.
- Reuse the current selected value when it is still present in the rebuilt options.

**Patterns to follow:**
- Existing state-driven rendering in docs/ux/mockup/S1-player-list.html.
- Existing team-list retrieval in docs/ux/mockup/js/mockup-api-client.js.

**Test scenarios:**
- Happy path: the dropdown contains the available team names after the page loads.
- Edge case: a previously selected team remains selected when it is still present after the options are rebuilt.
- Error path: an invalid or stale selection falls back to "All Teams" without breaking the page.
- Integration: the dropdown population and the player list both reflect the same team data source.

**Verification:**
- The team filter renders from live team data and no longer depends on static HTML option values.

### U2. Resolve team options from current-user role and identity
**Goal:** Ensure Coaches and SystemAdmins receive the correct team list scope.

**Requirements:** Coaches must see only their assigned teams; SystemAdmins must see all available teams.

**Dependencies:** U1.

**Files:**
- docs/ux/mockup/S1-player-list.html
- docs/ux/mockup/js/mockup-api-client.js
- tests/playwright/s1-player-list.spec.js

**Approach:**
- Determine the signed-in actor role and identity from the current user session data.
- For Coaches, filter the available teams to those assigned to that coach using the team payload's lead-coach fields.
- For SystemAdmins, return the full team list.
- Keep the role-to-team-scope mapping centralized so the logic is easy to reason about and reuse later.

**Patterns to follow:**
- Existing current-user lookup in docs/ux/mockup/js/mockup-api-client.js.
- Existing team payload shape used by the mockup client and server.

**Test scenarios:**
- Happy path: a Coach sees only the teams assigned to them in the dropdown.
- Happy path: a SystemAdmin sees all teams in the dropdown.
- Edge case: a missing or inactive current user falls back safely to the global team set or "All Teams" rather than breaking the page.
- Error path: missing lead-coach fields do not crash the option builder and still render a usable dropdown.

**Verification:**
- The resolved dropdown options match the current actor's team scope without exposing teams outside that scope.

### U3. Add regression coverage for role-based team-filter options
**Goal:** Prevent regression to hard-coded or incomplete dropdown behavior.

**Requirements:** Regression coverage verifies Coach and SystemAdmin dropdown contents and selection behavior.

**Dependencies:** U1, U2.

**Files:**
- tests/playwright/s1-player-list.spec.js

**Approach:**
- Add Playwright scenarios that seed a Coach session and a SystemAdmin session, then check the dropdown values after page load.
- Include assertions for the default selection fallback when the current team is no longer valid.
- Keep the scenarios aligned with the existing S1 flow and localStorage reset pattern.

**Patterns to follow:**
- Existing Playwright setup and assertions in tests/playwright/s1-player-list.spec.js.

**Test scenarios:**
- Happy path: a SystemAdmin sees every available team option in the dropdown.
- Happy path: a Coach sees only their assigned teams.
- Edge case: changing the current selection to a team that is no longer present triggers a safe fallback.
- Integration: selecting a visible team updates the player list and status text from the same team scope.

**Verification:**
- Playwright coverage fails if the dropdown once again becomes hard-coded or role-blind.

## Risks and Dependencies
- Risk: the current S1 page uses static HTML values, so the fix must preserve the existing "All Teams" option and query-string initialization semantics.
  - Mitigation: keep the selection logic explicit and test it alongside the option rendering.
- Risk: the current team payload may not expose a perfect coach identifier in every mode.
  - Mitigation: prefer the existing lead-coach fields and keep the fallback path safe when they are absent.

## Open Questions
- Should the same role-scoped team option logic be reused by any other mockup screens in a later pass, or is S1 the only immediate consumer?

## Implementation-Time Unknowns
- The exact team payload fields available in the current backend mode may influence whether the coach-scope check uses email or user id.