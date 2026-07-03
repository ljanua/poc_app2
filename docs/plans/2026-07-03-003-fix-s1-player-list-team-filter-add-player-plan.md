# fix: S1 team view should honor selected team

## Summary
Fix the S3 to S1 team navigation path so clicking a team action opens S1 already scoped to that team, and S1 renders only players assigned to that selected team on first load and subsequent interactions.

## Problem Frame
From Team Management, the View Team experience currently lands on S1 with all players visible. This breaks the coach workflow because the selected team context is lost during navigation, forcing manual re-filtering and creating a mismatch between intended and displayed roster context.

## Origin
- docs/brainstorms/2026-07-01-coaches-growth-match-time-performance-requirements.md

## Requirements Trace
- S1 must show only players assigned to the selected team when navigating from a team-specific action.
- Team context must persist through navigation from S3 team actions into S1.
- S1 list status and empty-state messaging must reflect the resolved selected team context.
- Regression coverage must verify both initial-load filtering and manual filter changes still work.

## Scope Boundaries
### In scope
- Team-aware navigation link updates from S3 into S1.
- S1 initialization logic to resolve selected team from navigation context.
- Regression tests for navigation-driven filtering and existing team filter behavior.

### Deferred to follow-up work
- Shared route-state utility for all mockup pages.
- URL contract standardization for other cross-page filters beyond team selection.

### Out of scope
- Backend API changes.
- Team assignment business logic changes in MockupApi.
- UI redesign of S1 or S3 layouts.

## Key Technical Decisions
- Carry selected team via URL query string from S3 actions so the state is explicit and deep-linkable.
- Resolve selected team at S1 boot with validation against available team options; fallback safely to all when query value is invalid.
- Keep filtering source-of-truth in existing S1 state.selectedTeam so init path and manual dropdown path converge on the same render logic.

## Implementation Units

### U1. Add team-scoped S3 to S1 navigation links
**Goal:** Preserve team context when launching S1 from Team Management actions.

**Requirements:** Team context must persist through navigation from S3 team actions into S1.

**Dependencies:** none.

**Files:**
- docs/ux/mockup/S3-team-management.html
- tests/playwright/s3-team-management.spec.js

**Approach:**
- Update row-level View and Assign actions to include team identifier in the S1 URL query string.
- Keep link generation centralized in the existing row-render branch to avoid divergent action behavior.

**Patterns to follow:**
- Existing inline row rendering pattern in docs/ux/mockup/S3-team-management.html.

**Test scenarios:**
- Happy path: clicking View for Senior Squad opens S1 with URL containing the Senior Squad team value.
- Happy path: clicking Assign for U19 Prime opens S1 with URL containing the U19 Prime team value.
- Edge case: team names with spaces remain correctly encoded and decode to the intended team.
- Integration: each rendered team row maps its own team value into both actions without cross-row leakage.

**Verification:**
- Team action links always include the row's team and route to S1 with that context.

### U2. Initialize S1 filter from route team context
**Goal:** Ensure S1 initial render is filtered to the requested team when provided.

**Requirements:** S1 shows only players for selected team from navigation; status and empty-state reflect that team.

**Dependencies:** U1.

**Files:**
- docs/ux/mockup/S1-player-list.html
- tests/playwright/s1-player-list.spec.js

**Approach:**
- Parse team query parameter during bootstrap and validate it against available team options.
- Set both state.selectedTeam and the team dropdown value before first render.
- Reuse existing renderPlayers and renderSuggestions path so initialization and manual changes remain behaviorally consistent.

**Patterns to follow:**
- Existing state-driven render pattern and team change handler in docs/ux/mockup/S1-player-list.html.

**Test scenarios:**
- Happy path: loading S1 with team=Senior Squad displays only Cristiano Ronaldo and Kylian Mbappe.
- Happy path: loading S1 with team=U17 Elite displays only Neymar Jr.
- Edge case: loading S1 with unknown team value falls back to all teams without breaking add-player controls.
- Error path: malformed or empty team query value does not throw and defaults to all teams.
- Integration: after query-driven initialization, changing teamFilter manually still updates list and status text correctly.

**Verification:**
- First paint and subsequent interactions always reflect the same selectedTeam source-of-truth.

### U3. Add focused regression coverage for team-context handoff
**Goal:** Prevent recurrence of all-players render when opening S1 from team actions.

**Requirements:** Regression coverage verifies navigation-driven filtering and manual filter behavior.

**Dependencies:** U1, U2.

**Files:**
- tests/playwright/s1-player-list.spec.js
- tests/playwright/s3-team-management.spec.js
- tests/bdd/features/player-source-of-record-and-confirmed-create.feature

**Approach:**
- Add one cross-page Playwright scenario starting in S3 and asserting filtered S1 result after click-through.
- Extend S1 suite with query-param initialization checks and fallback behavior checks.
- Add a BDD scenario that states expected team-scoped read behavior through UI navigation wording, aligned with source-of-record constraints.

**Patterns to follow:**
- Existing Playwright state reset and deterministic localStorage setup in tests/playwright/s1-player-list.spec.js.
- Existing BDD source-of-record phrasing in tests/bdd/features/player-source-of-record-and-confirmed-create.feature.

**Test scenarios:**
- Happy path: from S3, selecting View on Senior Squad lands in S1 showing only Senior Squad players.
- Happy path: from S3, selecting Assign on U19 Prime lands in S1 with U19 Prime status text and roster.
- Edge case: direct S1 navigation with invalid team query shows all players and no console errors.
- Integration: query-scoped load followed by add-player action still enforces selected-team constraints.

**Verification:**
- Playwright and BDD coverage fail if S1 regresses to all-player initial render for team-driven navigation.

## Risks and Dependencies
- Risk: query parameter name drift between S3 and S1 can silently break context handoff.
  - Mitigation: keep a single agreed parameter key and cover it in cross-page tests.
- Risk: fallback-to-all logic can mask invalid team values during debugging.
  - Mitigation: include explicit invalid-query regression assertions and clear status text expectations.

## Open Questions
- Should S1 preserve the query-selected team in URL during manual dropdown changes, or only use it as initial state?

## Implementation-Time Unknowns
- Exact query parameter key naming may be finalized during implementation if a broader mockup URL convention is introduced.
