---
title: 'feat: Remove S0 SystemAdmin quick login'
date: 2026-07-15
type: feat
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# feat: Remove S0 SystemAdmin quick login

## Goal Capsule

- **Objective:** Remove the S0 mockup “Quick Sign-In as SystemAdmin” shortcut so SystemAdmin must sign in with email/password like other roles.
- **Authority:** User request 2026-07-15 (confirmed: button + handler only; password login unchanged).
- **Stop when:** Button and click handler are gone; `s0-auth-entry.spec.js` no longer depends on quick admin sign-in and still proves SystemAdmin login via credentials; DoD passes.

---

## Product Contract

### Summary

S0 currently exposes `#quickAdminSignIn` (“Quick Sign-In as SystemAdmin”), which logs in as `maria@vantageiq.club` / `SecurePass123` without typing credentials. Remove that control and its script; keep the normal Sign In form, including SystemAdmin password login and landing redirect to S7.

### Requirements

- R1. Remove the Quick Sign-In as SystemAdmin button from `S0-login.html`.
- R2. Remove the `#quickAdminSignIn` click handler (and unused references).
- R3. Email/password Sign In for SystemAdmin (and Coach/ClubAdmin) remains unchanged, including SystemAdmin → S7 redirect.
- R4. Playwright `tests/playwright/s0-auth-entry.spec.js` updated: do not assert or click the quick button; SystemAdmin flows use form credentials instead.
- R5. Demo notice / subtitle copy may stay as-is unless already tied only to the quick button (out of scope to rewrite).

### Actors

- A1. Mockup users on S0 — no one-click SystemAdmin shortcut.
- A2. Playwright suites that previously clicked the quick button — use form login.

### Key Flows

- F1. Open S0 → Sign In and fields visible; no Quick Sign-In as SystemAdmin.
- F2. Sign in as `maria@vantageiq.club` / `SecurePass123` → S7 with Create User available.
- F3. Coach email/password login → S1 unchanged.

### Acceptance Examples

- AE1. S0 has no control named “Quick Sign-In as SystemAdmin” / no `#quickAdminSignIn`.
- AE2. Filling Maria’s credentials and Sign In reaches S7 and can open Teams with SystemAdmin badge (replaces former quick-login coverage).

### Scope Boundaries

#### In scope

- `docs/ux/mockup/S0-login.html`
- `tests/playwright/s0-auth-entry.spec.js`
- Optional one-line mapping note if S0 auth section mentions quick admin sign-in

#### Out of scope / deferred

- Changing subtitle/demo notice copy.
- Removing SystemAdmin role or seeded Maria credentials.
- Auth API / JWT changes.
- ClubAdmin-specific quick login (none exists today).

---

## Planning Contract

### Assumptions

- Other Playwright files already use `fill('#email')` / password or `loginAs(...)` for Maria — no bulk suite churn beyond `s0-auth-entry.spec.js`.

### Key Technical Decisions

- KTD1. Delete button markup + listener only; leave form submit path intact.
- KTD2. In specs, replace quick-click with the same email/password Sign In used for Coach.

### Product Contract preservation

Bootstrap from confirmed user scope.

---

## Implementation Units

### U1. Remove quick admin control from S0

**Goal:** Markup and JS no longer offer SystemAdmin one-click login.

**Requirements:** R1–R3, R5

**Dependencies:** None

**Files:**

- `docs/ux/mockup/S0-login.html`
- `docs/ux/mockup/API-Mockup-Mapping.md` (only if it documents the quick button)

**Approach:** Delete `#quickAdminSignIn` button; remove `quickAdminSignIn` variable and click listener.

**Test scenarios:** covered under U2.

**Verification:** Grep shows no `quickAdminSignIn` / “Quick Sign-In as SystemAdmin” in S0.

---

### U2. Update S0 Playwright entry specs

**Goal:** Specs prove normal SystemAdmin login without the shortcut.

**Requirements:** R4; AE1–AE2

**Dependencies:** U1

**Files:**

- `tests/playwright/s0-auth-entry.spec.js`

**Approach:**

- Drop visibility assert for the quick button.
- Coach login test stays; SystemAdmin landing / Teams tests fill Maria email+password and Sign In.

**Test scenarios:**

- Covers AE1. Quick Sign-In button not present.
- Covers AE2. Credential login → S7 → Teams SystemAdmin controls.
- Regression: Coach Sign In still reaches S1.

**Verification:** `s0-auth-entry.spec.js` green.

---

## Verification Contract

- Playwright: `tests/playwright/s0-auth-entry.spec.js`
- Manual: S0 shows no admin quick button; Maria password login still works.

---

## Definition of Done

- R1–R5 and AE1–AE2 satisfied.
- U1–U2 complete; no remaining references to `#quickAdminSignIn` in mockup S0.
