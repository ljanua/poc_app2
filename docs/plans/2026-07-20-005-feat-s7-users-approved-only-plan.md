---
title: feat — S7 Users tab approved-only list; drop Approval column; last login on Status tooltip
date: 2026-07-20
type: feat
classification: software
feature: 041
slug: feat-s7-users-approved-only
product_contract_source: ce-plan-bootstrap
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
origin: User request 2026-07-20 — S7 Users tab only Approved users (remove Approval column); Subscription visible/updatable for SystemAdmin (keep prior work); Last login as Status tooltip. Scope confirmed (rejected stay off Users; native title tooltip).
---

# Feature 041 — S7 Users tab approved-only + Status last-login tooltip

## Goal Capsule

- **Objective:** Make the S7 **Users** tab an approved-account roster only: hide pending/rejected rows, remove the redundant **Approval** column, keep **Subscription** visible (and SystemAdmin Change Subscription), and surface **Last login** as a hover tooltip on **Status** instead of its own column.
- **Authority:** `docs/ux/mockup/S7-admin-user-management.html`, `docs/ux/mockup/js/mockup-api-client.js`, `scripts/serve-mockup.js` (`GET /users`), Playwright `tests/playwright/s7-admin-user-management.spec.js` / `s7-approvals-tiers.spec.js`, `docs/ux/mockup/API-Mockup-Mapping.md`. Prior subscription work: `docs/plans/2026-07-20-004-feat-s7-change-subscription-plan.md`.
- **Done when:** Users tab shows only `approval_status = active` users; no Approval or Last Login columns; Status badge exposes last login via native `title` tooltip; Subscription column + SA Change Subscription remain; tests cover approved-only visibility and tooltip/column shape.
- **Out:** Approvals tab redesign; rejected-user recovery UI; custom styled tooltips; ClubAdmin Change Subscription; reworking Tiers catalog.

### Summary

Users becomes the approved roster; pending stay on Approvals; last login moves onto Status hover; subscription UX from plan `2026-07-20-004` is kept.

## Product Contract

### Problem Frame

After self-registration, pending (and rejected) users still appear on the main Users table beside an Approval column that is always “Approved” for the interesting cases—or confuses operators when mixed statuses appear. Last login is low-value as a full column. Subscription visibility and SystemAdmin updates already exist and should remain.

### Actors

- A1. **SystemAdmin** — Users tab shows approved users only; sees Subscription; can Change Subscription; Status tooltip shows last login.
- A2. **ClubAdmin** — Same approved-only Users list (club-scoped); sees Subscription; cannot change it.
- A3. **Coach** — no S7 Users access (unchanged).

### Key Flows

- F1. Open S7 Users → only approved users; columns include Subscription; no Approval; no Last Login column.
- F2. Hover Status (Active/Inactive) → tooltip shows last login label (e.g. `Last login: Yesterday`).
- F3. Pending registrant appears on Approvals, not on Users, until approved.
- F4. SystemAdmin Change Subscription continues to work on approved rows (unchanged behavior).

### Acceptance Examples

- AE1. After registering a pending user, Users table has no row for that email; Approvals still lists them.
- AE2. Users table header has no Approval or Last Login columns; Subscription remains.
- AE3. Status cell has `title` containing the user’s last login text (or `Unknown`).
- AE4. ClubAdmin Users list is approved-only and still shows Subscription without Change Subscription.
- AE5. SystemAdmin can still open Change Subscription on an approved user (smoke / existing coverage).

### Requirements

#### Approved-only Users list

- R1. Users tab lists only users with `approvalStatus` / `approval_status` of `active` (UI label “Approved”).
- R2. Pending and rejected users must not appear on Users (rejected have no alternate list beyond staying off Users — confirmed).
- R3. Prefer filtering at `GET /users` (and offline `listUsers` mirror) so KPIs and filters match the roster; Approvals continues to use `GET /admin/pending-users`.
- R4. Remove the **Approval** column from the Users table header and row render (including static seed markup if present).

#### Subscription (preserve)

- R5. Keep Subscription column visible to SA and ClubAdmin.
- R6. Keep SystemAdmin-only Change Subscription (+ role sync rules from prior plan). Do not regress.

#### Last login tooltip

- R7. Remove the **Last Login** column.
- R8. Put last login on the Status badge/cell via native HTML `title` (e.g. `Last login: {lastLogin}`), with a stable `data-testid` on the Status cell or badge for asserts.
- R9. Accessibility: Status control remains readable; tooltip text is supplementary (native `title` is acceptable per confirmed scope).

#### Tests / docs

- R10. Playwright: pending user absent from Users; columns/tooltips as above; ClubAdmin subscription visibility unchanged.
- R11. Mapping note for approved-only `GET /users` list semantics and Users column shape.

### Scope Boundaries

**In scope:** Approved-only Users filter; drop Approval + Last Login columns; Status `title` tooltip; preserve subscription UX; Playwright + mapping.

**Out of scope:** Rejected-user admin UI; custom tooltip component; Approvals redesign; billing; changing Change Subscription permission matrix.

### Success Criteria

- Operators opening Users never see pending/rejected rows or a redundant Approval column.
- Last login remains discoverable on Status hover.
- Subscription visibility/update behavior from the prior S7 subscription feature still works.

## Planning Contract

### Key Technical Decisions

- KTD1. **Server-side default filter** on `GET /users`: `u.approval_status = 'active'` AND-combined with existing email/club filters — single source of truth for mockup + any other list consumers of this endpoint.
- KTD2. **Offline parity:** client `listUsers` filters `approvalStatus === 'active'` (treat missing as active for older seed rows).
- KTD3. **Preserve subscription stack** — no redesign of Change Subscription modal/API; smoke-assert only if cheap.
- KTD4. **Native `title` tooltip** on Status badge (repo pattern: `title="…"` elsewhere in mockup HTML), not a custom popover.
- KTD5. **Email lookup on `GET /users?email=`** (used by session/bootstrap paths in the mockup client) also respects approved-only: logged-in users are already `active`; pending users are not directory users. Login/auth remain on dedicated auth endpoints.

### Technical Design

```
GET /users
  WHERE … AND u.approval_status = 'active'

S7 renderUsers:
  columns: Name | Email | Role | Subscription | Status(title=Last login: …) | Clubs | Actions
  (no Approval, no Last Login)

listUsers offline: filter active approval
```

### Assumptions

- A1. “Approved” means `approval_status = 'active'` (existing badge mapping).
- A2. Rejected users need no dedicated admin list in this feature.
- A3. Feature 004 subscription work is already on the branch/mainline and must not be ripped out.

### Dependencies and Sequencing

1. U1 — API + offline listUsers approved filter.
2. U2 — S7 table columns + Status tooltip (subscription left intact).
3. U3 — Playwright + mapping.

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Other caller expected pending users from `GET /users` | Grep consumers; Approvals uses pending-users endpoint; auth uses login |
| KPI counts change (drop pending from Active Users) | Expected; document in mapping |
| Tooltip hard to assert | `data-testid="user-status"` + `toHaveAttribute('title', /Last login/)` |

### Open Questions

- None blocking.

## Implementation Units

### U1. Filter listUsers / GET /users to approved only

**Goal:** Users directory returns only approved accounts.

**Requirements:** R1–R3, KTD1–KTD2, KTD5

**Files:**
- Modify: `scripts/serve-mockup.js` (`GET /users` WHERE clause)
- Modify: `docs/ux/mockup/js/mockup-api-client.js` (`listUsers` offline + tolerate backend already filtered)

**Approach:**
- Add `u.approval_status = 'active'` to the list query (AND with club/email filters).
- Offline path: filter mapped users the same way before ClubAdmin scoping.

**Test scenarios:**
- Happy: pending registrant not in `GET /users` data.
- Happy: approved seed users (Maria, Joao) still listed.
- Edge: rejected user not listed.
- Edge: ClubAdmin club-scoped list still approved-only.

### U2. S7 Users table column reshape + Status tooltip

**Goal:** Drop Approval and Last Login columns; Status carries last-login tooltip; keep Subscription + SA Change Subscription.

**Requirements:** R4–R9

**Files:**
- Modify: `docs/ux/mockup/S7-admin-user-management.html` (thead + `renderUsers`)

**Approach:**
- Update header order: Name, Email, Role, Subscription, Status, Clubs, Actions.
- Status cell: badge Active/Inactive with `title="Last login: …"` and `data-testid="user-status"`.
- Remove approval badge cell and last-login cell; leave Change Subscription gating unchanged.

**Test scenarios:** Covered in U3.

### U3. Playwright + mapping

**Goal:** Regression coverage and docs.

**Requirements:** R10–R11

**Files:**
- Modify: `tests/playwright/s7-approvals-tiers.spec.js` and/or `tests/playwright/s7-admin-user-management.spec.js`
- Modify: `docs/ux/mockup/API-Mockup-Mapping.md`

**Test scenarios:**
- Happy: pending user visible on Approvals, absent from Users (`tr` / email search).
- Happy: no Approval / Last Login headers; Subscription header present.
- Happy: Status `title` matches last login for a seeded user.
- Happy: ClubAdmin still sees Subscription, no Change Subscription (existing AE).
- Regression: SA Change Subscription smoke still passes if already covered.

## Verification Contract

- Targeted Playwright: `npx playwright test tests/playwright/s7-admin-user-management.spec.js tests/playwright/s7-approvals-tiers.spec.js`
- Manual: register pending user → confirm Users omits them; hover Status on Joao/Maria → last login tooltip; SA Change Subscription still opens.

## Definition of Done

- R1–R11 satisfied; U1–U3 complete.
- Users tab is approved-only; Approval and Last Login columns gone; Status tooltip present; subscription UX preserved.

## Appendix

### Baseline (current)

- Users table columns include Role, Subscription, Status, Approval, Clubs, Last Login, Actions.
- `GET /users` returns all approval statuses; Approvals uses `GET /admin/pending-users` with `approval_status = 'pending'`.
- Subscription column + Change Subscription already implemented (plan `2026-07-20-004`).
- Mockup already uses native `title=` for hover hints elsewhere.

### Product Contract preservation

- New solo plan (`product_contract_source: ce-plan-bootstrap`); carries forward subscription requirements from prior plan as R5–R6 without rewriting that contract.
