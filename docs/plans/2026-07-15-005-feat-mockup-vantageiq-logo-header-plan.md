---
title: 'feat: Replace VantageIQ header text with logo image'
date: 2026-07-15
type: feat
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# feat: Replace VantageIQ header text with logo image

## Goal Capsule

- **Objective:** Show `data/img/VantagIQ_transp_300.png` instead of the visible “⚡ VantageIQ” brand text on the mockup surfaces that use that brand string today (S0 login, S1 player list, mockup index).
- **Authority:** User request 2026-07-15 (confirmed: brand headers only — not every page title; `<title>` tags stay text; index keeps a short “Mockup Flow” subtitle with the logo).
- **Stop when:** Those three headers render the PNG via a stable mockup URL; CSS sizes the logo; Playwright (or a light visual assert) confirms the image is present; DoD passes.

---

## Product Contract

### Summary

Today S0 uses `.auth-logo` with “⚡ VantageIQ”, and S1 / `index.html` use `.header-title` with “⚡ VantageIQ” / “⚡ VantageIQ Mockup Flow”. Other screens put the **page name** in `.header-title` (e.g. “Video Assessments”) and are **out of scope**. Replace only the brand-string headers with an `<img>` of the transparent logo, alt text for the brand, and serve the file from the mockup server.

### Requirements

- R1. S0 login brand area shows the logo image instead of “⚡ VantageIQ” text/emoji.
- R2. S1 player-list topbar brand shows the same logo instead of “⚡ VantageIQ”.
- R3. Mockup `index.html` brand shows the logo plus remaining “Mockup Flow” wording (or equivalent short subtitle), not the concatenated text-only brand string alone.
- R4. Document `<title>` strings that include “VantageIQ” stay as-is.
- R5. Page-title `.header-title` values on S2–S8 / S3a / S7a (non-brand strings) are unchanged.
- R6. Logo is reachable over HTTP from mockup pages (wire `scripts/serve-mockup.js` and/or a copy/symlink under the mockup static root so relative URLs work).
- R7. Shared CSS for brand image sizing (auth + topbar) so the logo is crisp on mobile and desktop without reclaiming the whole topbar.

### Actors

- A1. Mockup users landing on S0 / S1 / index — see logo branding.
- A2. Playwright / visual checks — assert `img` with brand alt (or testid).

### Key Flows

- F1. Open S0 → logo image visible; no “⚡ VantageIQ” text in the auth brand slot.
- F2. Open S1 logged in → topbar shows logo; page still usable.
- F3. Open mockup index → logo + Mockup Flow context.

### Acceptance Examples

- AE1. S0/S1/index brand nodes contain `<img … src="…VantagIQ_transp_300.png" alt="VantageIQ">` (or equivalent alt), not the lightning-text brand string.
- AE2. Requesting the logo URL returns `200` with `image/png`.
- AE3. S6 (and similar) still show “Video Assessments” (or their page title), not a forced brand-text swap.

### Scope Boundaries

#### In scope

- `docs/ux/mockup/S0-login.html`, `S1-player-list.html`, `index.html`
- `docs/ux/mockup/style/site.css` (`.auth-logo` / brand-img rules)
- `scripts/serve-mockup.js` (serve `data/img/…` or mockup-local asset path)
- Source asset remains `data/img/VantagIQ_transp_300.png` (prefer not duplicating unless serve path requires a mockup-relative file)
- Light Playwright update if an existing S0/S1 shell test asserts the old text

#### Out of scope / deferred

- Adding the logo beside every page-title topbar (S2–S8).
- Favicon / PWA / React app shell parity.
- Renaming the file to fix the “VantagIQ” typo in the filename.

---

## Planning Contract

### Assumptions

- Confirmed call-out: **brand-only** surfaces (S0, S1, index) — not all topbars.
- Transparent PNG works on existing auth/topbar backgrounds; no extra dark plate required unless contrast fails in QA.
- Prefer a single shared class (e.g. `.brand-logo` / `.header-title img`) rather than per-page inline styles.

### Key Technical Decisions

- KTD1. Markup: replace brand text with `<img class="brand-logo" src="…" alt="VantageIQ" data-testid="brand-logo">` (testid optional but useful for Playwright).
- KTD2. Asset URL: either (a) extend the mockup server to serve repo `data/img/*` under a path like `/data/img/…`, or (b) copy/reference a file under `docs/ux/mockup/…` — prefer (a) so the canonical asset stays in `data/img/`.
- KTD3. CSS: drop gradient text fill on `.auth-logo` when it wraps an image; constrain height (~28–40px topbar, larger on auth).
- KTD4. Index: logo + “Mockup Flow” text sibling; S0/S1: logo only in the brand slot.

### Product Contract preservation

Bootstrap from confirmed scope (brand-only; title tags unchanged).

---

## Implementation Units

### U1. Serve logo + CSS brand image styles

**Goal:** PNG is HTTP-reachable; CSS ready for auth + header usage.

**Requirements:** R6, R7

**Dependencies:** None

**Files:**

- `scripts/serve-mockup.js`
- `docs/ux/mockup/style/site.css`
- `data/img/VantagIQ_transp_300.png` (read-only source; no edit)

**Approach:**

- Allow serving PNG from repo `data/img` with correct `image/png` MIME and path traversal guards (same spirit as `isInsideRoot`).
- Add `.brand-logo` (and adjust `.auth-logo` / `.header-title` when they host an img) for height/width:auto, object-fit contain.

**Test scenarios:**

- Happy: GET logo URL → 200 image/png.
- Error: path outside allowed roots → 403/404.

**Verification:** Curl or Playwright `request` against logo URL succeeds.

---

### U2. Swap brand markup on S0, S1, index

**Goal:** Visible brand string replaced by logo on the three surfaces.

**Requirements:** R1–R5; AE1, AE3

**Dependencies:** U1

**Files:**

- `docs/ux/mockup/S0-login.html`
- `docs/ux/mockup/S1-player-list.html`
- `docs/ux/mockup/index.html`
- `tests/playwright/s0-auth-entry.spec.js` and/or `s1-player-list.spec.js` if they assert “⚡ VantageIQ”
- Optional mapping note only if branding is documented

**Approach:**

- Replace brand text nodes with `<img class="brand-logo" …>` pointing at the served path.
- Index keeps a short “Mockup Flow” label beside/under the logo.
- Update any Playwright asserts that looked for the old brand text string.

**Test scenarios:**

- Covers AE1. Brand logo testid/alt visible on S0 and S1; lightning brand text absent in those slots.
- Covers AE3. Non-brand page title (spot-check S6 or skip if untested) unchanged if a regression check is cheap.
- Regression: S0 Sign In / S1 shell still load.

**Verification:** Focused Playwright green.

---

## Verification Contract

- Playwright: updated S0 (and S1 if needed) assertions.
- Manual: S0/S1/index show logo; other pages keep page titles.

---

## Definition of Done

- R1–R7 and AE1–AE3 satisfied.
- U1–U2 complete; canonical asset path respected; no brand-text emoji header left on the three scoped surfaces.
