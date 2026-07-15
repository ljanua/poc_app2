---
title: 'refactor: Remove Current Snapshot from S3a team update'
date: 2026-07-14
type: refactor
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
origin: user request (S3a snapshot removable; editable fields only)
---

# refactor: Remove Current Snapshot from S3a team update

## Goal Capsule

- **Objective:** Remove the Current Snapshot read-only panel from S3a so the screen is only the editable team fields already present.
- **Authority:** Confirmed scoping (2026-07-14): drop Snapshot entirely, including player count (still available on S3). Supersedes KTD2 / R2 from `docs/plans/2026-07-14-002-feat-s3a-full-team-update-fields-plan.md` for snapshot UX only.
- **Stop when:** Snapshot markup and fill logic are gone; edit form + header title remain; docs/tests updated if they mention Snapshot; Definition of Done passes.

---

## Product Contract

### Summary

S3a duplicates every editable field in a Current Snapshot card. With name and age group now editable, Snapshot is redundant. Remove it and leave a single Edit form; do not re-surface player count on this screen.

### Requirements

- R1. Remove the Current Snapshot section (`#snapshotCard` and snapshot rows) from `docs/ux/mockup/S3a-team-update.html`.
- R2. Remove snapshot DOM bindings and `init` assignments for snapshot fields; keep form prefills, save/cancel, missing-team notice, and page title `Update <team name>`.
- R3. Player count is not shown on S3a (S3 table retains it).
- R4. Update mapping/docs that describe S3a Current Snapshot / Sport snapshot row so they match the form-only screen.
- R5. Existing update behavior and Playwright paths that exercise Save remain green. An assertion that Snapshot is absent is allowed; update any specs that still target snapshot elements (e.g. `#snapshotSport`).

### Scope Boundaries

#### In scope

- S3a HTML/JS cleanup; mapping doc touch-ups; Playwright updates for Snapshot removal (including `team-sport.spec.js` if it asserts snapshot nodes).

#### Out of scope

- API/schema changes; changing which fields are editable; redesign of Save/Cancel or nav.

---

## Planning Contract

### Assumptions

- Header title is enough identity once Snapshot is gone.
- “Edit” card heading can stay or become a lighter heading; form-only layout is the goal.

### Key Technical Decisions

- KTD1. Delete Snapshot rather than hide it — no dead markup.
- KTD2. No replacement Players readout on S3a.

### Product Contract preservation

Bootstrap plan; supersedes snapshot-keeping decisions in the 002 S3a full-fields plan for UX only (APIs unchanged).

---

## Implementation Units

### U1. Strip Snapshot UI and bindings from S3a

**Goal:** Form-only S3a page.

**Requirements:** R1–R3

**Dependencies:** None

**Files:**

- `docs/ux/mockup/S3a-team-update.html`
- `docs/ux/mockup/API-Mockup-Mapping.md` (Team Update / S3a sections mentioning Snapshot)

**Approach:**

- Delete `#snapshotCard` markup and all `snapshot*` element refs / assignments in `init`.
- Keep `#updateCard` form fields and submit path unchanged.
- Optionally rename the form heading from “Edit” to something simpler if it reads oddly alone — default: keep “Edit” or drop the H2 if the page title already says Update.
- Search-replace mapping text that says Snapshot shows Sport / read-only identity.

**Patterns to follow:** Other form-first mockup pages (e.g. S5 edit without a parallel snapshot card).

**Test scenarios:**

- Happy path: open S3a for a seeded team → no “Current Snapshot” text; name/age/coach/etc. inputs still prefilled and Save still works (existing `team-update.spec.js` coverage).
- Edge: missing `teamId` still shows missing notice; update form stays hidden.

**Verification:** Visual/manual or Playwright: page has no Snapshot; existing update specs pass.

### U2. Guard regression in Playwright

**Goal:** Lock Snapshot removal and keep related S3a specs green.

**Requirements:** R5

**Dependencies:** U1

**Files:**

- `tests/playwright/team-update.spec.js`
- `tests/playwright/team-sport.spec.js`

**Approach:**

- In `team-update.spec.js`, assert `getByText('Current Snapshot')` is absent and the update name input remains visible with a seed value.
- In `team-sport.spec.js`, replace `#snapshotSport` (or any Snapshot assertions) with form-side checks (e.g. `#updateSportSelect` preselect), matching existing Sport coverage intent.

**Test scenarios:**

- Open `/S3a-team-update.html?teamId=t_u19` → no Current Snapshot; update name input visible with seed value.
- Sport update path still proves current sport is preselected on the form Select after Snapshot removal.

**Verification:** `team-update.spec.js` and `team-sport.spec.js` green.

---

## Verification Contract

- `npx playwright test tests/playwright/team-update.spec.js tests/playwright/team-sport.spec.js`

---

## Definition of Done

- R1–R5 satisfied; no Snapshot markup or fill logic; player count not reintroduced on S3a; both Playwright suites above green.
)
