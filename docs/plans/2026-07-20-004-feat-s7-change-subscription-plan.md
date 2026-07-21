---
title: feat — S7 show subscription; SystemAdmin Change Subscription (+ role sync)
date: 2026-07-20
type: feat
classification: software
feature: 037
slug: feat-s7-change-subscription
product_contract_source: ce-plan-bootstrap
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
origin: User request 2026-07-20 — S7 Users table shows subscription level to anyone with page access; only SystemAdmin can Change Subscription. Scope confirmed option 2 (changing subscription also updates role via roleForTierCode).
---

# Feature 037 — S7 subscription visibility + SystemAdmin Change Subscription

## Goal Capsule

- **Objective:** On S7 User & Role Management, show each user’s **subscription level** to every role that can open the page (SystemAdmin and ClubAdmin), and give **SystemAdmin only** a **Change Subscription** action that updates the user’s tier and syncs **role** via `roleForTierCode`.
- **Authority:** `docs/ux/mockup/S7-admin-user-management.html`, `docs/ux/mockup/js/mockup-api-client.js`, `scripts/serve-mockup.js` (`GET /users` enrichment + new admin mutate API), Playwright `tests/playwright/s7-approvals-tiers.spec.js` and/or `s7-admin-user-management.spec.js`, mapping note.
- **Done when:** Users table shows tier display name (or code) for SA and ClubAdmin viewers; ClubAdmin cannot change subscription; SystemAdmin can pick an active tier, persist `subscription_tier_id`, and role updates per `roleForTierCode`; tests cover visibility + permission + role sync.
- **Out:** Redesigning the Tiers catalog tab; letting ClubAdmin edit tiers; billing/payment; changing Approvals pending-tier display (already shows tier).

### Summary

Surface subscription on the S7 users list for all page viewers; add SystemAdmin-only Change Subscription that sets tier and aligns role with the tier mapping.

## Product Contract

### Problem Frame

Subscription lives on `users.subscription_tier_id` and appears on Approvals for pending users, but the main Users table does not show it and there is no admin path to change an existing user’s plan. ClubAdmins who manage users in their club also cannot see which subscription applies.

### Actors

- A1. **SystemAdmin** — sees subscription on Users; can Change Subscription (and role syncs).
- A2. **ClubAdmin** — sees subscription on Users in their club scope; cannot change it (no action / API forbidden).
- A3. **Coach** — no access to S7 Users (unchanged).

### Key Flows

- F1. Open S7 Users → each row shows subscription level (display name preferred).
- F2. SystemAdmin clicks **Change Subscription** → choose active tier → confirm → user tier updated; role set via `roleForTierCode(tier.code)` (professional → Coach; free / club_* → ClubAdmin); table refreshes.
- F3. ClubAdmin opens S7 Users → sees Subscription column; no Change Subscription control; direct API call returns 403.
- F4. SystemAdmin changing subscription on a SystemAdmin target: define safe behavior (see R8).

### Acceptance Examples

- AE1. SystemAdmin Users table includes a Subscription column with e.g. `Free Tier` / `Professional`.
- AE2. ClubAdmin Users table shows the same column for club-scoped users; no Change Subscription button.
- AE3. SystemAdmin Change Subscription to `professional` updates tier and sets role to `Coach`.
- AE4. SystemAdmin Change Subscription to `club_basic` (or `free`) sets role to `ClubAdmin` (per `roleForTierCode`).
- AE5. ClubAdmin cannot successfully call the change-subscription API (403).

### Requirements

#### Visibility

- R1. Add a **Subscription** column on the S7 Users table (between Role and Status, or after Role — pick one consistent place).
- R2. Show `tierDisplayName` when available, else `tierCode`, else `—`.
- R3. Visible to **all roles that can access the Users tab** (SystemAdmin and ClubAdmin). Do not gate the column on SystemAdmin-only.
- R4. `GET /users` (and offline `listUsers` mirror) must return `subscriptionTierId`, `tierCode`, and `tierDisplayName` (join `subscription_tiers`) for listed users. Today backend mapping strips tier fields in the client — fix that.

#### Change Subscription (SystemAdmin only)

- R5. Add **Change Subscription** action on each user row for SystemAdmin only (hide for ClubAdmin; same pattern as other SA-gated controls if any).
- R6. UI allows selecting among **active** subscription tiers (reuse list from `GET /admin/subscription-tiers` or a lightweight read of tiers already used by Tiers tab).
- R7. Persist new `users.subscription_tier_id` via a dedicated admin API, e.g. `POST /api/v1/admin/users/{userId}/subscription` with `{ tierId | tierCode, actorEmail }` — SystemAdmin gate required.
- R8. On successful tier change, also set `users.role` to `roleForTierCode(newTier.code)`. **Exception:** do not demote/overwrite an existing **SystemAdmin** target’s role (keep SystemAdmin); still update their tier. Document this in the plan implementation notes.
- R9. ClubAdmin (and Coach) attempting the mutate endpoint get **403 forbidden**.
- R10. Refresh the users table after a successful change; toast on success/error.

#### Tests / docs

- R11. Playwright: SA sees column + Change Subscription; ClubAdmin sees column without the action; SA change to professional yields Coach role (or assert API payload/UI after change).
- R12. Mapping note in `API-Mockup-Mapping.md` for the new endpoint and column.

### Scope Boundaries

**In scope:** Users table column; SA Change Subscription UI; listUsers enrichment; new admin API + client method; role sync with SystemAdmin exception; Playwright; mapping.

**Out of scope:** Editing tier quota limits (existing Tiers tab); payment; auto-adjusting club free-tier flags beyond what roleForTierCode already implies; Approvals tab changes.

### Success Criteria

- Any S7 Users viewer can see subscription level.
- Only SystemAdmin can change it, and non-SystemAdmin targets get role aligned to the new tier.

## Planning Contract

### Key Technical Decisions

- KTD1. **Column on Users tab**, not a new tab — matches “visible for any user with access to the page.”
- KTD2. **Dedicated mutate endpoint** rather than overloading Change Role — keeps permission matrix clear.
- KTD3. **Role sync via `roleForTierCode`** (user choice 2), with **SystemAdmin role preserved** when the target is already SystemAdmin.
- KTD4. Reuse active tiers from existing admin tiers list API for the picker.
- KTD5. Offline mock path: store `subscriptionTierId` / tier fields on users if present; tolerate missing offline tier catalog by showing `—` until backend mode.

### Technical Design

```
GET /users → join subscription_tiers → { …, tierCode, tierDisplayName, subscriptionTierId }

S7 renderUsers:
  Subscription cell = tierDisplayName || tierCode || '—'
  if SystemAdmin: Actions += Change Subscription

POST /admin/users/:id/subscription { tierId|tierCode, actorEmail }
  requireSystemAdmin
  update subscription_tier_id
  if target.role !== 'SystemAdmin':
    role = roleForTierCode(tier.code)
  return updated user payload
```

### Assumptions

- A1. Tier identity for the picker uses active rows from `subscription_tiers` (codes already seeded: free, professional, club_basic, club_premium).
- A2. ClubAdmin visibility remains club-scoped via existing `listUsers` filtering; no extra subscription ACL beyond “can see the user row.”
- A3. Changing subscription does not rewrite registration intents or club memberships.

### Dependencies and Sequencing

1. U1 — API list enrichment + change-subscription endpoint.
2. U2 — Client methods + S7 UI column/action/modal or prompt.
3. U3 — Playwright + mapping.

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Role sync surprises operators | Toast includes new role; R8 preserves SystemAdmin |
| ClubAdmin UI still shows button via CSS mistake | Gate on `state.viewRole === 'SystemAdmin'`; API 403 as backstop |
| Offline mode lacks tiers | Show `—`; Change Subscription requires backend or seeded tiers |

### Open Questions

- None blocking.

## Implementation Units

### U1. Backend: expose tier on listUsers + change subscription API

**Goal:** Return tier fields on user list; allow SystemAdmin to set tier (+ role sync).

**Requirements:** R4, R7–R9

**Files:**
- Modify: `scripts/serve-mockup.js`
- Possibly reuse: `scripts/tiers/quota.js` (`roleForTierCode`)

**Approach:**
- Extend `GET /users` SQL/select to LEFT JOIN `subscription_tiers` and include tier fields in `toUserPayload` or list mapper.
- Add `POST /admin/users/:userId/subscription` with SystemAdmin gate; update tier; sync role unless target is SystemAdmin.
- Validate tier exists and `active = TRUE`.

**Test scenarios:**
- Happy: SA sets `professional` → tier + Coach role.
- Happy: SA sets `club_premium` on ClubAdmin → tier + ClubAdmin role.
- Edge: target SystemAdmin → tier updates, role stays SystemAdmin.
- Error: ClubAdmin actor → 403.
- Error: unknown/inactive tier → 400.

### U2. S7 UI + mockup client

**Goal:** Show Subscription; SA Change Subscription flow.

**Requirements:** R1–R3, R5–R6, R10

**Files:**
- Modify: `docs/ux/mockup/S7-admin-user-management.html`
- Modify: `docs/ux/mockup/js/mockup-api-client.js` (`listUsers` mapping; `changeUserSubscription` / similar)

**Approach:**
- Table header + cell; `data-testid` for column/button/picker.
- Change Subscription: simple modal or `prompt`/`select` pattern consistent with Change Role UX on the same page.
- Hide action unless SystemAdmin (including when “Switch to Coach View” if that mode exists — follow existing action gating).

**Test scenarios:** Covered in U3.

### U3. Playwright + mapping

**Goal:** Regression coverage and docs.

**Requirements:** R11–R12

**Files:**
- Modify: `tests/playwright/s7-approvals-tiers.spec.js` and/or `tests/playwright/s7-admin-user-management.spec.js`
- Modify: `docs/ux/mockup/API-Mockup-Mapping.md`

**Test scenarios:**
- Happy: SA sees Subscription + Change Subscription.
- Happy: ClubAdmin sees Subscription, no Change Subscription.
- Happy: SA change professional → role Coach (when target not SystemAdmin).
- Error: optional API 403 as ClubAdmin via evaluate fetch.

## Verification Contract

- Playwright targeted S7 suites for Users + approvals/tiers access.
- Manual: as Maria (SA) change Joao’s subscription; as ClubAdmin confirm read-only subscription column.

## Definition of Done

- R1–R12 satisfied; U1–U3 complete.
- ClubAdmin cannot mutate subscription; SA can, with role sync rules above.

## Appendix

### Baseline

- Approvals pending rows already show `tierDisplayName`.
- Users table has Role / Status / Approval / Clubs / Actions (Change Role, Change Password, Deactivate) — no Subscription.
- `listUsers` client mapping currently omits tier fields even if API returned them.
- `roleForTierCode`: professional → Coach; otherwise ClubAdmin.
