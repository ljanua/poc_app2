---
title: feat: Add mockup-side logout exit-icon button on protected surfaces
date: 2026-07-06
type: feat
---

# feat: Add mockup-side logout exit-icon button on protected surfaces

## Summary

Add a small icon-only `exit` button in the topbar of every protected coach mockup surface (S1, S2, S3, S4, S5, S6, S7) that calls the existing `MockupApi.logout()` to clear the local session key, then navigates to `S0-login.html`. The button mirrors the existing `.back-btn` icon-only shape so it reads as a quiet chrome element rather than a primary action.

## Problem Frame

The S0 login flow issues a JWT and writes `vantageiq_current_user_email` to `localStorage`, and every protected surface reads that key to resolve the actor. There is currently no way to clear the session from the UI — a user who wants to switch identity has to manually clear `localStorage` in DevTools. The mockup's `MockupApi` already exposes a `logout()` method (line 1527 in `mockup-api-client.js`) that clears the session email, but no surface renders it. The brainstorm (`docs/brainstorms/2026-07-02-internal-jwt-auth-and-role-control-requirements.md`) defers "canonical logout behavior expectation for token invalidation in v1" (Outstanding Question 2); the v1 token is short-lived and has no refresh-token flow, so client-side clear-and-redirect is the only v1-grade option and aligns with the brainstorm's "short-lived JWT, no refresh" posture.

## Key Decisions

- **Client-side only, redirect to S0.** The v1 logout is `MockupApi.logout()` (clears `SESSION_KEY`) + `window.location.href = './S0-login.html'`. No token revocation API, no `POST /v1/logout` route — the short-lived JWT expires on its own and the client's session email is the only thing that grants UI access. This matches the brainstorm's v1 scope.
- **Reuse `.back-btn` icon-only shape for the exit button.** Every protected surface already renders a topbar `<header>` with optional `.back-btn` (the `.back-btn` class is defined in `docs/ux/mockup/style/site.css:164-183` as a `42px × 42px` icon-only square with hover-lift). The new `.exit-btn` extends the same shape, with `font-size` tightened so a "✕" glyph reads as the small "exit" icon the user asked for. Anchors beside the role badge in each topbar — same treatment everywhere.
- **Glyph choice is `✕` (U+2715).** Unicode multiplication-X is universally available without a font dependency and reads as "close / exit" without text. No SVG icon library required; the rest of the mockup is text-glyph based (see `.back-btn` which uses `←`).
- **`MockupApi.logout()` stays a single-line helper.** It already exists at line 1527 and the implementer does not need to extend it. The new topbar widget is the only additive change.

## Requirements

- R1. Every protected coach surface (S1, S2, S3, S4, S5, S6, S7) renders a small `exit` icon button in the topbar.
- R2. Clicking the button clears the actor session (via `MockupApi.logout()`) and navigates to `S0-login.html`.
- R3. After logout, navigating back to a protected surface via the URL bar redirects to `S0-login.html` because the session email key is absent (each protected surface already calls `MockupApi.currentUser()` early in render and bounces to login when null — the user has not raised a regression here, and the existing bounce logic continues to apply).
- R4. The button reads as a chrome element, not a primary action: same size as `.back-btn`, similar surface-1 background, no label text.
- R5. The button has a stable test selector (`data-testid="exit-button"` or `class="exit-btn"`) for Playwright coverage.

## Implementation Units

### U1. Add `.exit-btn` styling that mirrors `.back-btn` with a tighter glyph

**Goal:** Define a single CSS class for the icon-only exit button so all seven surfaces style it identically without per-page overrides.

**Files:**
- `docs/ux/mockup/style/site.css`

**Approach:** Add a new `.exit-btn` rule directly under the existing `.back-btn` block (`docs/ux/mockup/style/site.css:164-183`). Copy the geometry (`width: 42px; height: 42px; display: grid; place-items: center;`) and the `.back-btn` surface-1 background + border. Differ on `:hover` direction (`:hover { transform: translateX(2px); }` mirrors the back button's `-2px`). Use `cursor: pointer; color: var(--text);` consistent with `.back-btn`. Set `font-size: 1.1rem` (slightly smaller than the back button's `1.25rem`) so the `✕` glyph reads as the requested small "exit" icon. Include a `:focus-visible` outline mirroring `.back-btn`'s implicit focus (use `outline: 2px solid rgba(198, 255, 58, 0.6); outline-offset: 2px;`).

**Test scenarios:**
- `.exit-btn` applies a `42px × 42px` box on a rendered topbar.
- Hovering raises the appropriate color/border.
- No layout regression: the existing topbar still aligns to the same `display: flex; gap: 1rem;` header row.

---

### U2. Add the exit-button widget to each protected surface's topbar

**Goal:** Place the icon button in the same relative position on every protected surface (S1, S2, S3, S4, S5, S6, S7) so the user always finds logout in the same spot.

**Files:**
- `docs/ux/mockup/S1-player-list.html`
- `docs/ux/mockup/S2-player-dashboard.html`
- `docs/ux/mockup/S3-team-management.html`
- `docs/ux/mockup/S4-video-capture.html`
- `docs/ux/mockup/S5-player-edit.html`
- `docs/ux/mockup/S6-assessment-list.html`
- `docs/ux/mockup/S7-admin-user-management.html`

**Approach:** In each file's topbar `<header>`, immediately after the existing role/header-meta element, append a `<button class="exit-btn" type="button" data-testid="exit-button" aria-label="Log out" title="Log out">✕</button>`. On S7 (admin), the exit button sits next to the role badge; on S1 it sits after the role badge and before the search bar's far edge. Bind a single click handler in each surface's existing inline IIFE: `document.querySelector('[data-testid="exit-button"]').addEventListener('click', () => { MockupApi.logout(); window.location.href = './S0-login.html'; });`. Bind only on protected surfaces — `S0-login.html` and `index.html` stay unchanged. On S5 where the topbar carries `.back-btn + .header-title + .header-meta`, place the exit button after `.header-meta`. On S1 where the topbar carries `.header-title + .search-bar + .role-badge`, place it after `.role-badge`.

**Patterns to follow:** The `data-testid="exit-button"` selector follows the same convention used by `tests/playwright/s2-player-avatar-backend.spec.js` for S2 widgets (`data-player-id`, `data-testid`). The IIFE handler pattern matches every existing protected surface's per-page script block (grep-verified: each surface's IIFE binds its DOM listeners after the script's first read step).

**Test scenarios:**
- Each of the seven protected surfaces includes exactly one `[data-testid="exit-button"]` element inside its `<header>`.
- The element renders the `✕` glyph and an `aria-label="Log out"`.
- Clicking it on a sample surface (S1, S2, S7) sets `localStorage.vantageiq_current_user_email` to absent and ends on `S0-login.html`.

---

### U3. Playwright coverage for the logout click-to-login path

**Goal:** Lock in the behavior the user asked for with one regression scenario per layout archetype — one surface with role badge, one with header-meta, and the admin surface.

**Files:**
- `tests/playwright/logout.spec.js` (new file)

**Approach:** Create a new Playwright spec with three scenarios. Each logs in first via `MockupApi.login` then `localStorage.setItem(SESSION_KEY, ...)` (mirroring the established `loginAsCoach` helper in `tests/playwright/s2-player-avatar-backend.spec.js:14-21`) and navigates to the target surface via `page.goto`. Scenario A: load `S1-player-list.html`, click `[data-testid="exit-button"]`, assert the URL is `S0-login.html` and `localStorage.getItem('vantageiq_current_user_email')` returns null. Scenario B: same flow against `S6-assessment-list.html` (which uses `header-meta` instead of `role-badge`). Scenario C: same flow against `S7-admin-user-management.html` for the SystemAdmin path. Use `addInitScript` only for the session-key seeding (do not force `__USE_MOCK_LOCAL__`; the logout is a pure client-side operation that doesn't hit the backend).

**Execution note:** Verify against the existing S0-login flow shape (which is the only login-state-loading infrastructure today) — log in fresh per test, do not rely on shared state.

**Test scenarios:**
- Coach session → S1 → exit click → on S0 with no session email stored.
- Coach session → S6 → exit click → on S0 with no session email stored.
- SystemAdmin session → S7 → exit click → on S0 with no session email stored.
- The three buttons each render the `✕` glyph and `aria-label="Log out"`.

---

### U4. Update `API-Mockup-Mapping.md` and `docs/ux/mockup/README.md` to reflect the new topbar affordance

**Goal:** Document the new logout affordance so the next browser pass picks it up.

**Files:**
- `docs/ux/mockup/API-Mockup-Mapping.md`
- `docs/ux/mockup/README.md`

**Approach:** Add a brief note to each topbar's screen description in `API-Mockup-Mapping.md` ("Topbar carries an icon-only `exit` button — clicking it calls `MockupApi.logout()` and navigates to `S0-login.html`"). If `README.md` enumerates screens, add a one-line entry under the protected-screen list. Skip heavy rewrites — these are orientation docs, not design specs.

**Test scenarios:**
- `API-Mockup-Mapping.md` mentions the exit button on at least one protected surface row.
- `README.md` (if it lists screens) includes the new widget.

## Dependencies

- U2 depends on U1 (the `.exit-btn` class must exist before per-surface markup references it).
- U3 depends on U1 and U2 (the widget and its class must render before the Playwright scenario can target it).
- U4 depends on U3 (the doc refresh references the now-shipping behavior).

## Verification

- `npx playwright test tests/playwright/logout.spec.js --reporter=line` — all three scenarios pass.
- Manual smoke: open `docs/ux/mockup/S1-player-list.html`, log in, click the new exit button → lands on `S0-login.html` with the session cleared. Repeat for `S7-admin-user-management.html`.
- The exit button is visually quiet — same height as the back-button on each surface, sits next to the role badge or header-meta without shifting other topbar contents.

## Deferred to Follow-Up Work

- **Server-side token revocation / `POST /v1/logout` route.** Out of v1 scope per the brainstorm's short-lived-JWT-no-refresh posture; revisit if audit log UI or token rotation is added in a later release.
- **Confirmation dialog before logout.** Not requested; the click action is reversible (re-login takes the same shape).
- **Visible "Logged out" toast on the login screen after a redirect.** Cosmetic; can be added when wider post-action toasts land.

## Related Artifacts

- `docs/brainstorms/2026-07-02-internal-jwt-auth-and-role-control-requirements.md` — Outstanding Question 2 ("canonical logout behavior expectation for token invalidation in v1") resolves to the client-side clear-and-redirect this plan implements.
- `docs/ux/mockup/js/mockup-api-client.js:1527-1529` — existing `MockupApi.logout()` helper called by the new widget.
- `docs/ux/mockup/style/site.css:164-183` — existing `.back-btn` rules that `.exit-btn` extends.
