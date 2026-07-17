---
title: "fix: Add Users bottom-nav on all missing screens"
date: 2026-07-17
type: fix
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
origin: docs/backlog/017-s3-bottom-nav-users.md
---

# fix: Add Users bottom-nav on all missing screens

## Goal Capsule

Restore bottom-nav **Users** on every mockup screen that currently omits it, gated to **SystemAdmin** and **ClubAdmin** only (same markup and role gate as S1 / S7). Coaches must never see Users. Stop when missing pages carry the link, role visibility matches the existing pattern, and Playwright covers show/hide + navigation from at least S3 plus one other previously missing page.

**Authority:** this plan; origin `docs/backlog/017-s3-bottom-nav-users.md`; user confirmed scope expands beyond S3-only to all screens missing Users.

## Product Contract

### Summary

Admins stuck on team management (and other screens) cannot reach user management from the bottom nav because **Users** is missing. Add the same role-gated nav item everywhere it is absent.

### Requirements

- R1. Every bottom-nav screen that currently lacks Users must include a Users item linking to `S7-admin-user-management.html`.
- R2. Users is visible only for active **SystemAdmin** and **ClubAdmin** sessions via `data-role-visible-to="SystemAdmin,ClubAdmin"` + existing `MockupApi.applyRoleGatedNav`.
- R3. Coaches (and any non-allowed role) never see Users; the control ships `hidden` in markup before JS runs.
- R4. On S7 itself, Users remains the active nav item (already correct — do not regress).

### Actors

- A1. SystemAdmin — sees Users on all bottom-nav screens.
- A2. ClubAdmin — sees Users on all bottom-nav screens; does not see Clubs/Skills (unchanged).
- A3. Coach — never sees Users.

### Scope Boundaries

**In scope:** Markup parity for missing screens; Playwright coverage for role visibility and navigation; short mapping-doc note.

**Out of scope:** Changing `applyRoleGatedNav` logic; toolbar Admin Users links; Clubs/Skills gating; Coach access to S7.

**Deferred to follow-up:** None.

### Acceptance Examples

- AE1. ClubAdmin on S3: Users visible; click opens S7.
- AE2. Coach on S3: Users absent / hidden.
- AE3. SystemAdmin on a previously missing screen (e.g. S4): Users visible.

## Planning Contract

### Key Technical Decisions

- KTD1. **Copy the S1 Users nav fragment verbatim** (href, icon, label, `data-role-visible-to`, `data-testid="nav-users"`, `hidden`) into each missing page, inserted immediately before the Clubs item. Rationale: identical gating and test hooks; `applyRoleGatedNav` already runs on these pages.
- KTD2. **Touch only screens that lack Users today** — do not rewrite S1 / S7 / S7a / S8. Rationale: avoid churn on already-correct markup.
- KTD3. **No JS changes** unless a page somehow fails to call `applyRoleGatedNav` (research shows all targets already call it).

### Assumptions

- Role strings remain exactly `SystemAdmin` and `ClubAdmin` (comma-separated, no spaces issues handled by existing trim).
- Guest / share modes that inert bottom-nav keep working; adding a hidden Users link does not change guest behavior.

### Screens to update (missing Users)

| Screen | File |
|--------|------|
| Player dashboard | `docs/ux/mockup/S2-player-dashboard.html` |
| Team management | `docs/ux/mockup/S3-team-management.html` |
| Team update | `docs/ux/mockup/S3a-team-update.html` |
| Video capture | `docs/ux/mockup/S4-video-capture.html` |
| Player edit | `docs/ux/mockup/S5-player-edit.html` |
| Assessment list | `docs/ux/mockup/S6-assessment-list.html` |

**Already correct (leave alone):** `S1-player-list.html`, `S7-admin-user-management.html`, `S7a-clubs.html`, `S8-skills.html`.

### Patterns to follow

- Canonical fragment: `docs/ux/mockup/S1-player-list.html` Users `nav-item` (before Clubs).
- Role hydration: `MockupApi.applyRoleGatedNav` in `docs/ux/mockup/js/mockup-api-client.js`.
- Existing ClubAdmin nav assertion: `tests/playwright/club-admin-role.spec.js` (S1 `nav-users` visible).

## Implementation Units

### U1. Add Users nav markup on all missing screens

**Goal:** Insert the role-gated Users bottom-nav item on every screen listed above.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Modify: `docs/ux/mockup/S2-player-dashboard.html`
- Modify: `docs/ux/mockup/S3-team-management.html`
- Modify: `docs/ux/mockup/S3a-team-update.html`
- Modify: `docs/ux/mockup/S4-video-capture.html`
- Modify: `docs/ux/mockup/S5-player-edit.html`
- Modify: `docs/ux/mockup/S6-assessment-list.html`

**Approach:** Before each page’s Clubs `nav-item`, insert the Users anchor matching S1. Do not mark Users `active` except on S7 (unchanged). Preserve existing active states on Teams / Capture / etc.

**Test scenarios:** Covered in U2 (markup alone is not feature-complete without role assertions).

**Verification:** Spot-check DOM on each file: Users sits between My Clips and Clubs; attributes match S1.

### U2. Playwright coverage for Users on previously missing screens

**Goal:** Prove ClubAdmin/SystemAdmin see Users from S3 (origin screen) and at least one other fixed screen; prove Coach does not.

**Requirements:** R2, R3, AE1–AE3

**Dependencies:** U1

**Files:**
- Modify: `tests/playwright/s3-team-management.spec.js` and/or `tests/playwright/club-admin-role.spec.js`
- Optionally modify: another page’s existing Playwright file if a lighter home for a second-screen assertion already exists

**Approach:** Prefer extending `club-admin-role.spec.js` (already logs in as ClubAdmin Rita and asserts `nav-users` on S1) with: navigate to S3 → Users visible → click → S7; navigate to one other missing page (e.g. S4) → Users visible. In `s3-team-management.spec.js` (Coach Joao beforeEach), assert `nav-users` is hidden. Avoid duplicating full login harnesses.

**Test scenarios:**
- Happy path: ClubAdmin on S3 sees `[data-testid="nav-users"]` and click lands on S7.
- Happy path: ClubAdmin (or SystemAdmin) on S4 (or S2/S5/S6) sees Users.
- Edge: Coach on S3 — `nav-users` hidden / not visible.
- Integration: After opening Users from S3, S7 shows Users as active (existing S7 behavior).

**Verification:** New/updated tests pass under the repo’s Playwright mockup config.

### U3. Mapping doc note

**Goal:** Document that Users is now on every bottom-nav page for SystemAdmin/ClubAdmin.

**Requirements:** R1, R2

**Dependencies:** U1

**Files:**
- Modify: `docs/ux/mockup/API-Mockup-Mapping.md`

**Approach:** Update the ClubAdmin / bottom-nav notes that currently imply Users only on some pages; state parity with Clubs (Users on all bottom-nav pages, gated `SystemAdmin,ClubAdmin`).

**Test expectation:** none — docs only.

**Verification:** Mapping text matches implemented markup.

## Verification Contract

- Playwright: run the touched specs (`s3-team-management`, `club-admin-role`) against the mockup server when executing (unless the user opts out of tests).
- Manual smoke (optional): login as Rita → S3 → Users → S7; login as Joao → S3 → no Users.

## Definition of Done

- All six previously missing screens include Users with the S1 attribute pattern.
- ClubAdmin and SystemAdmin see Users; Coach does not (tests cover S3 coach hide + admin show/navigate).
- Mapping doc updated; backlog `017` marked planned with link to this plan.
- No changes to role-gate JS unless a missing `applyRoleGatedNav` call is discovered (then fix that page only).

## Appendix

### Origin

- `docs/backlog/017-s3-bottom-nav-users.md`
- User expansion (2026-07-17): any screen missing Users; show only for ClubAdmin and SystemAdmin.
