---
title: 'feat: Mask S0 login password field'
date: 2026-07-15
type: feat
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# feat: Mask S0 login password field

## Goal Capsule

- **Objective:** On S0 login, typed password characters are masked (not shown as clear text).
- **Authority:** User request 2026-07-15.
- **Stop when:** `#password` uses `type="password"`; login still works; focused Playwright still green.

## Product Contract

### Summary

S0 currently uses `<input id="password" type="text">`, so the password is visible while typing. Change it to a standard masked password input. No show/hide toggle in this change.

### Requirements

- R1. S0 password field masks input (browser password masking).
- R2. Existing login submit behavior and Playwright fills continue to work (`#password` / Password label unchanged).

### Actors

- A1. Coach / ClubAdmin / SystemAdmin signing in on S0.

### Key Flows

- F1. User types a password on S0 → characters appear masked → Sign In still authenticates as today.

### Acceptance Examples

- AE1. `#password` has `type="password"` (not `text`).
- AE2. Filling the field and submitting still reaches the role-appropriate landing page.

### Scope Boundaries

#### In scope

- `docs/ux/mockup/S0-login.html` password input `type`
- Light Playwright assert for `type="password"` if cheap

#### Out of scope / deferred

- Show/hide password toggle
- Autocomplete / password-manager attribute tuning beyond the type change
- Non-S0 password fields (e.g. S7 create-user)

## Planning Contract

### Assumptions

- Native `type="password"` is sufficient; no CSS or JS change required.
- Playwright `page.fill('#password', …)` and `getByLabel('Password')` remain valid after the type change.

### Key Technical Decisions

- KTD1. Single attribute change: `type="text"` → `type="password"` on `#password`.
- KTD2. Prefer adding one visibility assert in `tests/playwright/s0-auth-entry.spec.js` rather than a new spec file.

### Product Contract preservation

Bootstrap from confirmed scope (mask only; no toggle).

## Implementation Units

### U1. Mask password input + assert type

**Goal:** Password field is masked; login regression covered.

**Requirements:** R1, R2; AE1, AE2

**Dependencies:** None

**Files:**

- `docs/ux/mockup/S0-login.html`
- `tests/playwright/s0-auth-entry.spec.js`

**Approach:**

- Set `#password` to `type="password"`.
- In the existing S0 shell test, assert `toHaveAttribute('type', 'password')` (alongside current label visibility).
- Rely on existing login navigation tests for AE2.

**Test scenarios:**

- Covers AE1. Password control is visible and has `type="password"`.
- Covers AE2 / regression. Existing “navigates to coach and admin landing pages from login” still passes with filled password.

**Verification:** Focused `s0-auth-entry` Playwright green; optional manual check that typed chars are bullets/dots.

## Verification Contract

- Playwright: `tests/playwright/s0-auth-entry.spec.js`

## Definition of Done

- R1–R2 and AE1–AE2 satisfied; U1 complete.
