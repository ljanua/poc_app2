---
title: 'feat: Assign club on S7 create user'
date: 2026-07-15
type: feat
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
origin: docs/backlog/015-create-user-assign-club.md
---

# feat: Assign club on S7 create user

## Goal Capsule

- **Objective:** When creating a user on S7, set club membership in the same flow so Coach/ClubAdmin users land with a club on day one, and Club Admins cannot place users outside their clubs.
- **Authority:** `docs/backlog/015-create-user-assign-club.md` + confirmed scoping (2026-07-15): club **optional** when the *created* role is SystemAdmin; club **required** when creating Coach or ClubAdmin. SystemAdmin actor may omit club only for SystemAdmin creates. ClubAdmin actor: auto-select sole club, or picker limited to their clubs.
- **Stop when:** Create modal + live/offline createUser enforce the rules; Playwright covers SystemAdmin optional/required and ClubAdmin auto/picker paths; Definition of Done passes.

---

## Product Contract

### Summary

S7 create-user today has no club control. ClubAdmin creating Coach silently gets the first `coach_clubs` row; SystemAdmin creates get no membership until a separate Assign Club modal. This plan makes club part of create: required for Coach/ClubAdmin targets, optional for SystemAdmin targets, with ClubAdmin UI auto-fill or scoped picker.

### Requirements

- R1. Create User modal exposes a Club control populated from clubs the actor may assign (`listClubs` scoped by actor).
- R2. When the selected **created role** is `Coach` or `ClubAdmin`, Club is required in the UI (`required` / asterisk); after ClubAdmin sole-club defaulting (R4/KTD4), server returns `400 validation_error` if still missing/invalid.
- R3. When the selected **created role** is `SystemAdmin`, Club is optional; omit or empty → create with no `coach_clubs` row.
- R4. **ClubAdmin actor:** if they belong to exactly one club, that club is selected automatically (control can be read-only/hidden); if multiple, picker lists only their clubs; create always results in membership to a chosen owned club (fail if none).
- R5. **SystemAdmin actor:** picker lists all clubs (or active clubs consistent with existing `listClubs`); optional only when creating SystemAdmin; required when creating Coach or ClubAdmin.
- R6. `POST /api/v1/users` and offline `MockupApi.createUser` accept `clubId`, insert `coach_clubs` when provided/required, reject ClubAdmin assigning a club they do not own (`403 forbidden_scope`), reject missing club for Coach/ClubAdmin creates after sole-club defaulting (`400 validation_error`).
- R7. Changing create-role in the UI toggles Club required/optional and clears invalid picks.
- R8. Existing post-create Assign Club flow remains for adding further clubs; this plan does not remove it.
- R9. ClubAdmin still may create **Coach only** (unchanged role allowlist from Club Admin work).

### Actors

- A1. SystemAdmin — creates any role; club optional only for SystemAdmin targets.
- A2. ClubAdmin — creates Coach only; club always required via auto or scoped picker.

### Key Flows

- F1. SystemAdmin creates Coach with a club → user row + `coach_clubs` membership.
- F2. SystemAdmin creates SystemAdmin with no club → user exists with empty clubIds.
- F3. ClubAdmin with one club creates Coach → club auto-set; create succeeds with that membership.
- F4. ClubAdmin with multiple clubs picks one of theirs → membership to that club; foreign club rejected if forged.
- F5. Create Coach/ClubAdmin without club → inline error / 400; no orphan user preferred (validate before insert or transactional roll-back).

### Acceptance Examples

- AE1. SystemAdmin opens Create User, selects Coach, must pick a club before Save succeeds; resulting user shows that club on S7.
- AE2. SystemAdmin creates SystemAdmin without club → success; clubIds empty / no chips.
- AE3. ClubAdmin Rita (single club `c_default`) opens Create User → Club fixed/auto to VantageIQ Club; created Coach is on `c_default`.
- AE4. Forged `clubId` outside ClubAdmin’s clubs → forbidden_scope; user not created (or not left without intended membership — prefer reject before insert).

### Scope Boundaries

#### In scope

- Mockup S7 create modal + `scripts/serve-mockup.js` POST `/users` + offline `createUser`.
- Mapping doc + Playwright (`club-admin-role`, `s7-admin-user-management`, and/or focused create-club cases).
- Link backlog 015 to this plan (`status: in_progress`).

#### Out of scope / deferred

- React `CreateUserForm` / Nest `UsersAdminService` parity (scaffold still SystemAdmin-leaning) — follow-up unless already required for CI.
- Multi-club select at create time (single `clubId` only).
- Changing ClubAdmin’s allowed create roles to include ClubAdmin.
- Removing or redesigning the separate Assign Club modal.

---

## Planning Contract

### Assumptions

- “All roles require a Club except SystemAdmin” applies to the **created** role, not the actor.
- ClubAdmin can only create Coach today; required-club + auto/picker still applies.
- Prefer validate club before INSERT user so failed creates do not leave orphan users.
- Active clubs list follows existing `listClubs` filtering.

### Key Technical Decisions

- KTD1. Extend `clubId` on create (already forwarded by client in backend mode) rather than a second assign call in the UI submit path — one atomic create+membership.
- KTD2. UI: show Club field for all creators; required attribute / asterisk driven by selected role; ClubAdmin single-club → disable or hide picker with hidden input value.
- KTD3. Live SystemAdmin create with clubId for Coach/ClubAdmin: insert membership after user insert; without clubId for SystemAdmin target: skip membership.
- KTD4. Replace silent ClubAdmin “first club if present” with explicit required membership (honor `clubId` when provided and owned; if single club and omitted, default to that club; if multiple and omitted → 400).
- KTD5. Mockup-first; React/Nest deferred per Scope Boundaries.

### Patterns to follow

- Assign Club modal club select + `MockupApi.listClubs(role, email)`.
- Existing ClubAdmin create Coach seed in `tests/playwright/club-admin-role.spec.js`.
- Club Admin plan `docs/plans/2026-07-14-001-feat-club-admin-role-plan.md` for role allowlists.

### Product Contract preservation

Bootstrap from backlog 015; confirmed call-outs recorded above.

---

## Implementation Units

### U1. Enforce club rules on create (API + offline client)

**Goal:** Live and offline createUser apply optional/required club and scope checks.

**Requirements:** R2–R6, R9; AE4

**Dependencies:** None

**Files:**

- `scripts/serve-mockup.js` — `POST /api/v1/users`
- `docs/ux/mockup/js/mockup-api-client.js` — `createUser`
- Shape locks under `apps/api/tests/integration/` if they grep createUser/POST users body (extend if present)

**Approach:**

- After role/email validation, resolve `clubId` from payload.
- If `role !== 'SystemAdmin'` and no usable clubId: 400 (ClubAdmin may default to sole owned club when omitted).
- If clubId set: verify club exists; if ClubAdmin actor, verify ownership; then insert `coach_clubs`.
- If SystemAdmin creating SystemAdmin: ignore empty club; if club provided, still allow membership (admin opted in) — optional attach is fine.
- Prefer club validation before user INSERT.

**Patterns to follow:** Current ClubAdmin insert block (~3584); offline `adminClubs[0]` path to be generalized.

**Test scenarios:**

- Happy: SystemAdmin + Coach + clubId → 201 + membership.
- Happy: SystemAdmin + SystemAdmin, no clubId → 201, no membership.
- Happy: ClubAdmin + Coach, omitted clubId, one owned club → 201 + that club.
- Error: Coach create, no club and no defaultable sole club → 400.
- Error: ClubAdmin + foreign clubId → 403 forbidden_scope; no user row (or no unscoped membership).

**Verification:** Live POST and offline createUser match rules; existing ClubAdmin create still works with auto club.

---

### U2. S7 create modal club UX

**Goal:** Actors choose/auto-assign club on create.

**Requirements:** R1, R4, R5, R7, R8

**Dependencies:** U1

**Files:**

- `docs/ux/mockup/S7-admin-user-management.html`
- `docs/ux/mockup/API-Mockup-Mapping.md`

**Approach:**

- Add `#createClubSelect` (testid) to create modal; populate from `listClubs` on open and when role changes.
- ClubAdmin with one club: set value, disable/hide select, still submit that id.
- ClubAdmin with many: required select of their clubs only.
- SystemAdmin: when role is SystemAdmin, club not required (empty option “No club”); when Coach/ClubAdmin, required with all clubs.
- Submit passes `clubId` (or omit when empty) into `createUser`.
- Document in mapping.

**Test scenarios:** covered under U3.

**Verification:** Modal shows correct required/optional state per role; ClubAdmin single-club auto-set.

---

### U3. Playwright coverage

**Goal:** Lock AE1–AE4 style behavior.

**Requirements:** R1–R7; AE1–AE4

**Dependencies:** U1, U2

**Files:**

- `tests/playwright/club-admin-role.spec.js`
- `tests/playwright/s7-admin-user-management.spec.js` (and/or a focused new case file if cleaner)

**Approach:**

- Update `s7-admin-user-management.spec.js` “creates a user from modal…” — it currently creates Coach without a club and will fail once R2 lands; select a club (e.g. `c_default`) before Save.
- Extend ClubAdmin create Coach test: assert resulting user has `c_default` / club chip or membership.
- SystemAdmin: create Coach with club; create SystemAdmin without club (and optionally assert create Coach without club shows error).
- Multi-club ClubAdmin: optional offline seed of second `coach_clubs` row then assert picker options and forbid phantom option if forged via DOM like other specs.
- Prefer `data-testid="create-club-select"` on the create club control for stable hooks (Assign Club may keep id-only selectors).

**Execution note:** Prefer unique emails; restore or isolate club memberships if shared DB is polluted.

**Test scenarios:**

- ClubAdmin create Coach → user visible and bound to admin’s club.
- SystemAdmin create Coach without club → stays on modal / error; with club → success.
- SystemAdmin create SystemAdmin without club → success.
- ClubAdmin multi-club (offline) → only owned clubs in options; submit with phantom → error.

**Verification:** Named Playwright suites green.

---

### U4. Backlog status link

**Goal:** Track 015 against this plan.

**Requirements:** origin housekeeping

**Dependencies:** None (can land with first commit)

**Files:**

- `docs/backlog/015-create-user-assign-club.md`

**Approach:** Set `status: in_progress`, `plan:` to this file path, bump `updated`.

**Test expectation:** none — metadata only.

**Verification:** Frontmatter points at this plan.

---

## Verification Contract

- Playwright: `club-admin-role.spec.js`, `s7-admin-user-management.spec.js` (plus any new cases).
- Manual smoke: SystemAdmin optional vs required club; ClubAdmin Rita auto club.

---

## Definition of Done

- R1–R9 and AE1–AE4 satisfied.
- U1–U4 complete; create without required club cannot succeed for Coach/ClubAdmin.
- Backlog 015 linked and in progress.

---

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| Orphan user if membership fails after INSERT | Validate club before INSERT (KTD) |
| React/Nest drift | Explicitly deferred; note in mapping if mockup-only |
| ClubAdmin offline assignUserToClub SystemAdmin-only hole | Out of scope unless create path needs it — create uses createUser membership |

---

## Sources & Research

- Origin: `docs/backlog/015-create-user-assign-club.md`
- Related: `docs/plans/2026-07-14-001-feat-club-admin-role-plan.md`
- Patterns: S7 create/assign modals; `POST /users` ClubAdmin first-club insert; `MockupApi.createUser` / `assignUserToClub`
- External research: skipped — local create + club assign patterns sufficient
)
