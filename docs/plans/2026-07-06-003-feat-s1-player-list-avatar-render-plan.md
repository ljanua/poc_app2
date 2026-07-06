---
origin: (direct request)
date: 2026-07-06
---

# feat: Render assigned player avatar in the S1 player-list card

## Summary

Each S1 player card shows the assigned player's uploaded image in the avatar slot when one exists, and keeps the ⚽ fallback when it doesn't. The offline `MockupApi.listPlayers` already returns `avatarUrl`, but the live `GET /v1/players` handler's `toPlayerPayload` mapper drops it — so this plan lands a one-line backend fix to return `avatarUrl` from the list endpoint, the S1 render template (with a `data-player-id` test handle and a `has-avatar` CSS modifier), the test selector fix for the currently failing regression scenario, and a new live-backend round-trip test that proves an avatar uploaded on S2 renders on S1.

## Problem Frame

The S1 player list renders a ⚽ emoji for every player regardless of whether an avatar has been uploaded. The `2026-07-05-002-feat-player-avatar-upload-plan.md` plan extended `Player` with `avatarUrl`, added `player_avatar_url` to the database, and shipped `updatePlayerAvatar` + the S2/S5 upload surfaces — but did not prove the S1 read-and-render path actually works. The new Playwright scenario `shows uploaded avatar image on player card when avatarUrl is set` (`tests/playwright/s1-player-list.spec.js:135`) is currently failing, and the existing offline-only scenario at `:128` is the only coverage. The offline `MockupApi.listPlayers` returns `avatarUrl`, but the live `GET /v1/players` handler in `scripts/serve-mockup.js` maps through `toPlayerPayload` which drops `avatarUrl` — so the live list endpoint silently omits the field the OpenAPI `Player` schema already promises. The fix is bounded to a one-line backend mapper change, the mockup render template (with `data-player-id` and `has-avatar` modifier), a CSS adjustment for the image case, the regression test, and a new live-backend scenario. The recent solution doc `docs/solutions/integration-issues/s2-player-avatar-patch-rejected-by-profile-validator.md` shipped the symmetric write path; this plan ships the read/render path.

## Key Decisions

- **`data-player-id` on every card.** Each `.player-card` carries `data-player-id="<id>"` so tests can target a single card without walking `.name` → `..` (the current brittle chain that broke the new scenario). Future avatar scenarios reuse the same handle.
- **`has-avatar` modifier class on `.player-image`.** When `player.avatarUrl` is present, add `has-avatar` so the CSS drops the radial-gradient background (the gradient is meaningful behind an emoji but visually noisy under an opaque JPEG at 58×58).
- **Build the avatar wrapper via `createElement` so `className` and `dataset` are first-class.** The current `renderPlayers` (`docs/ux/mockup/S1-player-list.html:219-247`) assembles the card via `card.innerHTML = string-concat`, which makes `.className`/`dataset` mutations impossible on the inner `.player-image` div. Build the `.player-image` wrapper with `document.createElement('div')` and `className = 'player-image' + (player.avatarUrl ? ' has-avatar' : '')`, then splice it into the card template via a placeholder token. The card's outer `innerHTML` keeps the rest of the markup intact.
- **Backend mapper fix in `scripts/serve-mockup.js`'s `toPlayerPayload`.** The mapper (lines 60-70) currently drops `avatarUrl` even though `listPlayers`'s SQL aliases `p.player_avatar_url AS "avatarUrl"`. Add `avatarUrl: row.avatarUrl || null` to the returned object so the live `GET /v1/players` honors the OpenAPI `Player` schema. No DB or schema migration required.

## Requirements

- R1. A player with an uploaded avatar shows that image in the S1 card avatar slot.
- R2. A player with no uploaded avatar continues to show the ⚽ emoji with no broken-image marker.
- R3. The image renders correctly in both offline/local mode (`__USE_BACKEND__ = false`) and live-backend mode (`__USE_BACKEND__ = true`).
- R4. The image renders correctly across browsers and viewports at the existing 58×58 card-avatar size.
- R5. Regression coverage in Playwright proves the offline/local path renders the image.
- R6. Regression coverage in Playwright proves the live-backend path renders the image after an avatar write on S2.

## Implementation Units

### U0. Backend: include `avatarUrl` in the live `GET /v1/players` response

**Goal:** Stop the live list endpoint from dropping the `avatarUrl` field that the SQL alias `p.player_avatar_url AS "avatarUrl"` already produces, so the S1 read path renders the uploaded image through the real backend.

**Files:**
- `scripts/serve-mockup.js`

**Approach:** In `toPlayerPayload` (`scripts/serve-mockup.js:60-70`), add `avatarUrl: row.avatarUrl || null` to the returned object. No other handler changes are needed — `listPlayers` already selects the aliased column and routes rows through this mapper; the `GET /api/v1/players` handler at `:1526-1532` returns `listPlayers(rows)` unchanged.

**Test scenarios:**
- A player with no avatar has `avatarUrl: null` in `GET /v1/players?teamName=all` responses.
- After a `PATCH /v1/players/{id}` with `{ avatarUrl: "data:image/jpeg;..." }`, the same player appears in `GET /v1/players` with `avatarUrl` matching the uploaded value.
- A new player (no avatar yet) still lists with `avatarUrl: null`, not missing key.

---

### U1. Add `data-player-id` + `has-avatar` modifier on each S1 card

**Goal:** Give every S1 player card a stable per-card test handle, and apply a CSS modifier when the avatar image is rendered so the gradient background doesn't bleed through.

**Files:**
- `docs/ux/mockup/S1-player-list.html`
- `docs/ux/mockup/style/site.css`

**Approach:** Refactor the avatar wrapper construction inside `renderPlayers` (`docs/ux/mockup/S1-player-list.html:219-247`) to use `document.createElement` for the `.player-image` div, since the surrounding `card.innerHTML` string-concat pattern makes `className`/`dataset` mutations impossible on the inner div. Build it as: `const imgWrap = document.createElement('div'); imgWrap.className = 'player-image' + (player.avatarUrl ? ' has-avatar' : ''); imgWrap.style.overflow = 'hidden'; imgWrap.innerHTML = avatarHtml;` then splice it into the card template via a `__AVATAR_WRAPPER__` placeholder token that is replaced with `imgWrap.outerHTML` after the innerHTML is assigned. Set `card.dataset.playerId = String(player.id)` on the outer card before appending. In `site.css`, add a `.player-image.has-avatar` override that resets `background: none` so the JPEG renders on a flat surface; keep the emoji fallback path untouched.

**Patterns to follow:** The `has-avatar` modifier is the same conditional-theming pattern other surfaces in the repo apply (verify with a quick scan during implementation). The `data-player-id` convention matches the implicit-id selector style already used by `MockupApi` (the `find` calls key by `entry.id`).

**Test scenarios:**
- A rendered S1 card has `data-player-id="<player.id>"` for each player in the list.
- A card whose player has an `avatarUrl` carries the `has-avatar` class on its `.player-image` element.
- A card whose player has no `avatarUrl` does not carry the `has-avatar` class and instead shows the ⚽ span.

---

### U2. Fix the failing offline regression scenario and add a stable-selector assertion

**Goal:** Replace the brittle `.player-card .player-name` → `..` chain with the new `data-player-id` handle and assert the image renders for the seeded player.

**Files:**
- `tests/playwright/s1-player-list.spec.js`

**Approach:** Update the failing scenario `shows uploaded avatar image on player card when avatarUrl is set` (`tests/playwright/s1-player-list.spec.js:135`) to use `[data-player-id="10"]` as the card locator instead of `.player-card .player-name:has-text("Lionel Messi") >> .. >> .player-image`. Keep the existing seed step (`playerAvatars[10] = data:image/jpeg;...`) and the reload. Assert two things on the Messi card: an `<img>` exists with a non-empty `src` matching `^data:image/`, and no `⚽` text appears inside `.player-image`. Also extend the sibling scenario `shows emoji avatar for players without an uploaded photo` (`:128`) to assert the `has-avatar` class is absent on the first card.

**Execution note:** Start by re-running the failing scenario locally to confirm the failure mode matches the error context (`element(s) not found`), then land the selector fix as part of this unit rather than splitting it out.

**Test scenarios:**
- After seeding `playerAvatars[10]` and reloading, the `[data-player-id="10"]` card contains an `<img>` whose `src` starts with `data:image/`.
- The Messi card's `.player-image` does not contain the ⚽ glyph.
- A card with no avatar does not carry `has-avatar` and contains the ⚽ span.

---

### U3. Live-backend round-trip regression test (S2 write → S1 render)

**Goal:** Prove the avatar round-trip works through the real backend, not just the offline stub. This is the missing half of the recent solution doc and the regression guard for U0's `toPlayerPayload` fix.

**Files:**
- `tests/playwright/s1-player-list.spec.js`

**Approach:** Add a new scenario that runs in live-backend mode (do **not** set `__USE_MOCK_LOCAL__ = true` or `__USE_BACKEND__ = false` in `addInitScript`). Log in as coach via S0 (mirror `loginAsCoach` from `tests/playwright/s2-player-avatar-backend.spec.js:14-21`). On S1, identify the first player returned by `MockupApi.listPlayers({ teamName: 'all' })` and capture their `id`. Build the same tiny-JPEG fixture the existing live-backend test uses (`tests/playwright/s2-player-avatar-backend.spec.js:12`), wrap it as a `File`, and call `await window.MockupApi.uploadPlayerAvatar(target.id, file)` via `page.evaluate`. Then `await page.goto('/S1-player-list.html')` to force a fresh `GET /v1/players` round-trip, and assert the target's `[data-player-id="<id>"] .player-image img` is visible with `src` starting `data:image/`. If U0 is not landed, the assertion fails — that's the regression guard.

**Patterns to follow:** `tests/playwright/s2-player-avatar-backend.spec.js` — same login shape, same `TINY_JPEG_DATA_URL` fixture, same `page.evaluate` to call into `MockupApi` directly. The new scenario lives in the same S1 file but does not inherit the suite's `beforeEach` (which forces `__USE_BACKEND__ = false`) — wrap the live-mode logic in its own `test.describe` block with no offline-mode init script.

**Test scenarios:**
- After a real `uploadPlayerAvatar` call against the backend, navigating to S1 shows the uploaded image on the same player's card.
- The round-trip works without seeding `localStorage.playerAvatars`, so a backend regression that drops `avatarUrl` from the list response fails this scenario.
- The S1 render after the live write does not show the ⚽ glyph for that player.

---

### U4. Doc mapping refresh and verification log

**Goal:** Confirm the S1 row in `docs/ux/mockup/API-Mockup-Mapping.md` reflects the new read behavior, and capture a brief verification note tying this plan to the regression tests.

**Files:**
- `docs/ux/mockup/API-Mockup-Mapping.md`
- `docs/solutions/integration-issues/` (optional follow-up)

**Approach:** Update the S1 row in `API-Mockup-Mapping.md` (currently `S1-player-list.html | Team-scoped player list | List players | GET /v1/players?teamName=&query=`) to note that `avatarUrl` is included on each returned player and rendered in the card when present, with the same offline/localStorage fallback the S2/S5 paths already use. Optionally add a short solutions doc under `docs/solutions/` capturing the locator-fragility lesson and the `toPlayerPayload` mapper-gap lesson if it isn't already covered.

**Test scenarios:**
- `API-Mockup-Mapping.md` mentions the `avatarUrl` field on the S1 list read.
- The plan's regression coverage described under U2/U3 exists and passes under both `__USE_BACKEND__ = false` (offline, U2) and `__USE_BACKEND__ = true` (live, U3).

---

## Key Technical Decisions

- **KTD1: `data-player-id` is the per-card test handle.** The current `.player-card .player-name` → `..` chain is fragile because `.player-name`'s parent is `.player-info`, not `.player-card` (verified via the accessibility tree in the failing scenario's error context). Adding `data-player-id` is a one-line change that stabilizes this and any future per-card test.
- **KTD2: `has-avatar` modifier drops the gradient background only when needed.** The `.player-image` radial-gradient is a deliberate flourish behind the emoji but is visually noisy under an opaque JPEG; the modifier scopes the override without touching the emoji case. Mirrors how other surfaces in the repo apply conditional theming.
- **KTD3: One-line backend fix lands with this plan.** `toPlayerPayload` in `scripts/serve-mockup.js:60-70` drops `avatarUrl` even though the SQL alias in `listPlayers` produces it. The OpenAPI `Player` schema already promises this field on the list response, so the fix is a contract conformance fix, not a feature change. U0 lands it as a precondition for U3.
- **KTD4: Live-backend test runs against the real PATCH + GET chain.** Per the solution doc's prevention guidance, regression tests that claim "uploads persist" or "avatar renders across surfaces" must hit the live endpoint, not seed `localStorage`. U3 enforces that for the S1 read and is the regression guard for U0's mapper fix.

## Dependencies

- U1 depends on U0 (the live list endpoint must surface `avatarUrl` before U3 can assert it on the rendered card; U1 itself only needs the offline path).
- U2 depends on U1 (the `data-player-id` attribute and `has-avatar` class must exist before the new assertions can target them).
- U3 depends on U0 and U1 (the live list response carries `avatarUrl` and the render template exposes the `data-player-id` selector).
- U4 depends on U2 + U3 (the doc refresh references the regression tests).

## Verification

- `npx playwright test tests/playwright/s1-player-list.spec.js --reporter=line` — all S1 scenarios pass, including the previously failing `shows uploaded avatar image on player card when avatarUrl is set`.
- The same suite runs under live-backend mode (`__USE_BACKEND__ = true`, no `__USE_MOCK_LOCAL__`) with the new round-trip scenario passing.
- Manual smoke: load `docs/ux/mockup/S1-player-list.html` after seeding `playerAvatars[10]` in DevTools; the Messi card shows the seeded image and no emoji; other cards show the emoji.

## Deferred to Follow-Up Work

- **Avatar deletion UI.** Removing an uploaded avatar reverts to ⚽; not in scope and not requested.
- **Default avatar assignment on player creation.** Out of scope; new players still start with ⚽.
- **Crop/rotate tooling on upload.** Out of scope; the canvas already centers the crop automatically.

## Related Issues

- `docs/plans/2026-07-05-002-feat-player-avatar-upload-plan.md` — the parent plan that introduced `avatarUrl` and shipped the upload path; this plan completes its U4 ("S1 player list: render avatar on player cards") and adds the missing live-read plumbing that the parent's U2 ("persist `avatarUrl` on player record") did not cover in the list endpoint's response shape.
- `docs/solutions/integration-issues/s2-player-avatar-patch-rejected-by-profile-validator.md` — the recent solution doc whose prevention guidance (live-backend regression tests, `data-player-id`-style stable handles) shaped the KTDs here.
- `tests/playwright/s1-player-list.spec.js:135` — the failing scenario U2 fixes.
- `tests/playwright/s2-player-avatar-backend.spec.js` — the live-mode pattern U3 mirrors (login shape, fixture, `page.evaluate` flow).
- `scripts/serve-mockup.js:60-70` — `toPlayerPayload` mapper that U0 extends.
- `openapi/v1/schemas/players.yaml` — `Player` schema already declares `avatarUrl`; U0 brings the live list endpoint into conformance with this contract.