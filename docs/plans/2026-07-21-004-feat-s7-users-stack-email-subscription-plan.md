---
title: feat — S7 Users list stacks Email under Name and Subscription under Role
date: 2026-07-21
type: feat
classification: software
feature: 046
slug: feat-s7-users-stack-email-subscription
product_contract_source: ce-plan-bootstrap
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
origin: User request 2026-07-21 — In S7-admin-user-management Users list view, move Subscription under Role and Email under Name.
---

# Feature 046 — S7 Users stacked Name/Email and Role/Subscription

## Goal Capsule

- **Objective:** On the S7 **Users** table, show **Email under Name** in one column and **Subscription under Role** in one column (stacked cell layout), reducing horizontal clutter while keeping the same data and actions.
- **Authority:** `docs/ux/mockup/S7-admin-user-management.html`, `docs/ux/mockup/style/site.css`, `tests/playwright/s7-admin-user-management.spec.js`, `docs/ux/mockup/API-Mockup-Mapping.md` (brief UI note if present).
- **Done when:** Users thead has no separate Email or Subscription headers; each data row stacks email under name and subscription under role; Change Subscription and other actions unchanged; Playwright updated; no API changes.
- **Out:** Approvals / Join requests / Tiers tab table layouts; Create User / Change Role / Change Subscription modals; ClubAdmin vs SystemAdmin permission rules (Feature 037).

### Summary

Collapse four identity columns into two stacked columns so the Users list reads more densely on one line of headers: **Name** (with email subline), **Role** (with subscription subline), then Status / Clubs / Actions.

## Product Contract

### Problem Frame

The Users table currently uses separate columns for Name, Email, Role, and Subscription. That spreads identity across four headers and crowds the table on smaller widths. The desired reading order is hierarchical: primary label (name / role) with secondary detail (email / subscription) directly beneath.

### Actors

- A1. **SystemAdmin** — Users list with stacked cells; still sees Change Subscription.
- A2. **ClubAdmin** — same stacked layout; still sees subscription text, no Change Subscription.
- A3. **Coach** — no S7 Users access (unchanged).

### Key Flows

- F1. Open S7 Users → headers are **Name | Role | Status | Clubs | Actions** (no Email / Subscription column headers).
- F2. Each row: name on first line, email muted under it; role chip on first line, subscription label muted under it.
- F3. SystemAdmin Change Subscription still works; subscription subline updates after change.
- F4. Row lookups by `data-name` / visible name+email still work for existing create-user tests.

### Acceptance Examples

- AE1. `getByRole('columnheader', { name: 'Email' })` count is 0 on Users tab; same for standalone **Subscription** header (or header is removed / renamed to Role-only).
- AE2. Maria’s row shows `Maria Alves` and `maria@vantageiq.club` in the same Name cell (email secondary).
- AE3. Joao’s row shows role chip `Coach` and subscription text (e.g. `Professional` / tier display) in the same Role cell; `data-testid="subscription-cell"` remains findable (on the stacked cell or inner span).
- AE4. ClubAdmin still sees subscription subline; no Change Subscription button.
- AE5. Static HTML seed rows in `tbody` (if still present before JS render) match the stacked structure, or are overwritten on first `renderUsers` without flash of old 4-column markup.

### Requirements

#### Table structure

- R1. Users table `<thead>`: remove separate **Email** and **Subscription** `<th>` columns. Keep **Name**, **Role**, **Status**, **Clubs**, **Actions**.
- R2. Each data row: **one** Name cell containing name + email; **one** Role cell containing role + subscription.
- R3. Preserve `data-name`, `data-email`, `data-role`, `data-status` on `<tr>` for existing selectors.
- R4. Preserve `data-testid="subscription-cell"` on the element that exposes the subscription text (Role cell or an inner `.user-subscription` span). Prefer keeping the testid on a dedicated inner span so role chip and subscription stay distinct for assertions.
- R5. Preserve `data-testid="subscription-column-header"` only if a subscription header remains; **preferred:** remove the header testid with the column — update Playwright to stop asserting that column header (or assert Role header instead).
- R6. Static placeholder rows in the HTML `tbody` must match the new cell count (5 data columns + actions → 5 `<td>`s) so pre-JS markup does not break table layout.

#### Visual / a11y

- R7. Stack with a small vertical stack utility (e.g. `.cell-stack` > `.cell-primary` + `.cell-secondary`): primary = name / role chip; secondary = email / subscription, muted, slightly smaller.
- R8. Optional `title` on the Name cell or email line for long emails; do not truncate so aggressively that email becomes unreadable on desktop.
- R9. Screen reader: Name cell should expose both name and email (natural text order is enough); Role cell exposes role then subscription. Do not hide email with `display:none`.

#### Scope / permissions

- R10. No API or `listUsers` payload changes.
- R11. Change Subscription / Change Role / Assign / Deactivate behavior and SA-only gating unchanged.
- R12. Approvals and Join-requests tables keep separate Name / Email columns (out of scope).

#### Tests / docs

- R13. Update `tests/playwright/s7-admin-user-management.spec.js`: drop “Subscription column header” assertion if header removed; assert subscription via `subscription-cell` inside the Role-stacked cell; create-user row still findable by name+email text.
- R14. Brief `API-Mockup-Mapping.md` note under S7: Users list stacks email under name and subscription under role (UI-only).

### Scope Boundaries

**In scope:** S7 Users tab markup, row renderer, CSS stack utility, Playwright, short mapping note.

**Out of scope:** Other S7 tabs; mobile card redesign; sorting/filtering; renaming Actions buttons.

### Success Criteria

- Users table is narrower and easier to scan: identity (name+email) and access (role+plan) each occupy one column.
- No regression in subscription change or club assignment flows.

## Planning Contract

### Key Technical Decisions

- KTD1. **Collapse columns** (not reorder alone) — user said “move X under Y”, which means stacked in the same cell, not merely swapping column order while keeping four headers.
- KTD2. **Reuse Role header** for the role+subscription stack; do not invent a “Role / Subscription” dual header unless visual review asks for it.
- KTD3. **CSS class pair** `.cell-stack` / `.cell-secondary` in `site.css` scoped enough for S7 (or generic under `.data-table`) so Approvals can adopt later without using it now.
- KTD4. **Update static seed rows** in HTML to 5-column shape so first paint matches post-`renderUsers` structure.

### Technical Design

```
<thead>
  Name | Role | Status | Clubs | Actions

<tbody tr>
  td.cell-stack
    .cell-primary  → user.name
    .cell-secondary → user.email
  td.cell-stack
    .cell-primary  → role chip
    .cell-secondary[data-testid=subscription-cell] → tierDisplayName | tierCode | —
  td → status badge
  td → clubs
  td → actions
```

### Assumptions

- A1. “Move Subscription under Role” and “Email under Name” means **stacked in-cell**, not a second row spanning the table.
- A2. Approvals tab layout is intentionally unchanged.
- A3. Secondary lines use muted styling consistent with existing `.muted-text`.

### Dependencies and Sequencing

1. U1 — HTML thead + static tbody + `renderUsers` markup.
2. U2 — CSS stack styles.
3. U3 — Playwright + mapping.

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Tests look for `columnheader` Subscription | Update assertions to `subscription-cell` |
| `filter({ hasText: email })` still works | Email remains visible text in Name cell |
| ClubAdmin missing subscription | Subline still rendered for all viewers |

### Open Questions

- None blocking. Optional follow-up: stack Approvals Name/Email the same way for consistency.

## Implementation Units

### U1. Users table stacked cells

**Goal:** Headers and row markup stack Email under Name and Subscription under Role.

**Requirements:** R1–R6, R10–R12, KTD1–KTD2, KTD4

**Files:**
- Modify: `docs/ux/mockup/S7-admin-user-management.html`

**Approach:**
- Edit Users `<thead>` to five headers (Name, Role, Status, Clubs, Actions).
- Fix static `<tbody>` seed rows to match (name+email stack; role only or role+placeholder subscription; drop obsolete “last login” column residue if still present in static markup).
- In `renderUsers` `row.innerHTML`, build stacked Name and Role cells; keep `subscription-cell` testid on subscription subline.

**Test scenarios:** Covered in U3.

### U2. Cell stack CSS

**Goal:** Readable primary/secondary hierarchy in stacked cells.

**Requirements:** R7–R9, KTD3

**Files:**
- Modify: `docs/ux/mockup/style/site.css`

**Approach:**
- Add `.data-table .cell-stack { display: flex; flex-direction: column; gap: 0.15rem; }`
- `.cell-secondary` / `.muted-text` for email and subscription sublines (smaller font, muted color).

**Test scenarios:** Visual check on S7 Users.

### U3. Playwright + mapping

**Goal:** Specs match new layout; docs note UI change.

**Requirements:** R13–R14

**Files:**
- Modify: `tests/playwright/s7-admin-user-management.spec.js`
- Modify: `docs/ux/mockup/API-Mockup-Mapping.md` (short bullet)

**Test scenarios:**
- Happy: SA Users — no Email/Subscription column headers; Joao row has subscription-cell text; Change Subscription still works.
- Happy: create user — row findable by name and email text.
- Regression: ClubAdmin sees subscription subline without Change Subscription (if covered in existing suite).

## Verification Contract

- `npx playwright test tests/playwright/s7-admin-user-management.spec.js`
- Manual: open S7 Users as SystemAdmin — confirm stacks; change subscription — subline updates.

## Definition of Done

- R1–R14 satisfied; U1–U3 complete.
- Users list shows Email under Name and Subscription under Role without separate columns.

## Appendix

### Baseline (Feature 037)

- Separate Subscription column between Role and Status; `data-testid="subscription-column-header"` and `subscription-cell`.

### Product Contract change

- **Supersedes** Feature 037’s “dedicated Subscription column” presentation only; visibility and Change Subscription behavior unchanged.
