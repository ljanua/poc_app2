---
origin: (direct request)
date: 2026-07-05
---

# feat: Player Avatar Upload

## Summary

Coaches and SystemAdmins can click the player icon on the S2 dashboard to upload a player photo. The image URL is stored on the player record and the updated avatar renders on every page that shows the player card — S1 player list, S2 dashboard, and S5 edit page.

## Problem Frame

The player card currently shows a static ⚽ emoji for every player. There is no way to personalize a player's identity visual or distinguish同名 players on the same team without reading the name. The fix requires an upload interaction, a storage field, and a render path across all surfaces that show the player card.

## Key Decisions

- **URL reference, not base64.** The real system stores a URL/path string on the player record. The local/offline mock stores a data-URL as a stand-in for the same shape so the offline path is structurally equivalent.
- **Single PATCH on the player identity, not a separate upload endpoint.** `PATCH /v1/players/{playerId}` gains an optional `avatarUrl` field, keeping avatar changes in the same transaction as other player identity edits.
- **Hover overlay affordance.** The current ⚽ emoji gets a camera-icon overlay on hover so the clickable affordance is self-evident without a separate label or button.
- **5 MB max, 100×100 JPEG conversion.** File input accepts `image/*`. After the file is read, it is drawn to an off-screen `<canvas>` at 100×100 pixels using high-quality JPEG compression (quality 0.85), and that converted blob is used for storage and upload. The 5 MB check applies to the original file before conversion.

## Requirements

- R1. Clicking the player avatar on S2 opens a file picker.
- R2. Accepted file types are image formats only (`image/jpeg`, `image/png`, `image/webp`, `image/gif`).
- R3. Files larger than 5 MB are rejected with a user-visible error before any processing occurs.
- R4. After a successful upload, the image is converted to 100×100 JPEG and renders immediately on the S2 dashboard; the converted avatar persists across page reloads.
- R5. The avatar renders correctly on S1 player cards and S5 edit page for the same player.
- R6. A player with no avatar set continues to show the ⚽ emoji (no broken-image state).
- R7. The upload is available to any authenticated user (Coach or SystemAdmin); no additional permission beyond authenticated access.

## Implementation Units

### U1. OpenAPI: add `avatarUrl` to player identity and PATCH contract

**Goal:** Declare the new field in the schema and extend the PATCH request to accept it.

**Files:**
- `openapi/v1/schemas/players.yaml`
- `openapi/v1/openapi.yaml`

**Approach:** Add `avatarUrl` as a nullable string to the `Player` schema. Add it as an optional property to `UpdatePlayerProfileRequest`. Document it in the PATCH `/players/{playerId}` summary.

**Test scenarios:**
- The `Player` schema accepts `avatarUrl` as nullable string.
- `UpdatePlayerProfileRequest` lists `avatarUrl` as optional.
- PATCH `/players/{playerId}` accepts a payload with `avatarUrl` set.

---

### U2. Backend: persist `avatarUrl` on player record

**Goal:** Store the avatar URL on the players table and return it on every player read.

**Files:**
- `apps/api/src/db/schema.sql` (or the applicable migration)
- `scripts/serve-mockup.js`

**Approach:** Add a `player_avatar_url` column (text, nullable) to the `players` table via a new migration. Update `scripts/serve-mockup.js` to read and return the column. Modify the PATCH handler to accept and persist `avatarUrl` in the same update. In offline/local mode, the client already converts the image to a 100×100 JPEG data URL before calling the API; `scripts/serve-mockup.js` stores and returns this data URL directly without further processing.

**Pattern to follow:** The `teamName` and `position` field update pattern in the existing PATCH handler — read from payload, validate, persist in the same transaction.

**Test scenarios:**
- A player with no avatar has `avatarUrl: null` in API responses.
- PATCH with `avatarUrl: "https://example.com/player.jpg"` persists and returns the URL on subsequent GET.
- Offline mock stores and returns a base64 data URL for the same player's avatar.

---

### U3. S2 dashboard: avatar click-to-upload and render

**Goal:** Replace the static ⚽ emoji with a responsive avatar element that shows the uploaded image or falls back to emoji, and triggers the file picker on click.

**Files:**
- `docs/ux/mockup/S2-player-dashboard.html`

**Approach:** Change the player-card avatar container from `<div class="player-avatar">⚽</div>` to a `<div>` containing both the avatar `<img>` (hidden when no URL) and the ⚽ fallback (shown when no URL), with a hover overlay showing a camera icon. A hidden `<input type="file" accept="image/*">` is the file-picker trigger; clicking the avatar programmatically clicks the input. On file selection: first validate the original file is ≤ 5 MB; if not, show an error. Then read the file, draw it to an off-screen `<canvas>` scaled to 100×100, export as a JPEG blob at quality 0.85, convert to a base64 data URL, call `MockupApi.updatePlayerAvatar(playerId, avatarDataUrl)`, and update the `<img src>` on success.

**Test scenarios:**
- Player with no avatar shows ⚽ emoji and no broken image icon.
- Player with an avatar URL shows the image, not the emoji.
- Hovering the avatar shows the camera overlay.
- Selecting a file > 5 MB shows an error and does not update the avatar.
- Selecting a valid image updates the avatar immediately and persists after reload.

---

### U4. S1 player list: render avatar on player cards

**Goal:** Show each player's avatar (or ⚽ fallback) on the S1 player list cards.

**Files:**
- `docs/ux/mockup/S1-player-list.html`
- `docs/ux/mockup/js/mockup-api-client.js`

**Approach:** Extend `MockupApi.listPlayers` to include `avatarUrl` in the returned player objects (from localStorage in offline mode, from the player record in backend mode). Update the `renderPlayers` function in S1 to render `<img src="...">` or ⚽ fallback inside each card's `.player-image` div, matching the same pattern as S2.

**Test scenarios:**
- A player with an uploaded avatar shows the image on their S1 card.
- A player without an avatar shows the ⚽ emoji on their S1 card.

---

### U5. S5 player edit: show avatar with upload option

**Goal:** Display the player's current avatar on the S5 edit page, with a re-upload option using the same click-to-upload pattern as S2.

**Files:**
- `docs/ux/mockup/S5-player-edit.html`

**Approach:** Add an avatar section at the top of the Identity block (before or inside it), mirroring the S2 click-to-upload pattern — avatar container, hidden file input, camera hover overlay. On successful re-upload, update the displayed image. The upload goes through `MockupApi.updatePlayerAvatar`, consistent with S2.

**Test scenarios:**
- S5 shows the player's current avatar (or ⚽ if none) at the top of the form.
- Re-uploading a new image updates the preview immediately.
- The avatar update is reflected on S1 and S2 after navigating there.

---

### U6. Regression coverage

**Goal:** Ensure the new avatar field is covered by tests and documentation.

**Files:**
- `tests/playwright/s2-player-dashboard.spec.js`
- `tests/bdd/features/coach-player-development-dashboard.feature`
- `tests/bdd/features/step_definitions/coach-development-video-source.steps.js`
- `docs/ux/mockup/API-Mockup-Mapping.md`

**Approach:**
- Add a Playwright test for the avatar upload flow on S2 (click avatar, select file, assert image updates and persists).
- Add a Playwright test for avatar display on S1 (player with avatar shows image, player without shows ⚽).
- Add a BDD scenario: uploading an avatar updates the player card on S1 and S2.
- Update `API-Mockup-Mapping.md` to document the new `PATCH /v1/players/{playerId}` avatar field and the `playerAvatars` localStorage key.

**Test scenarios:**
- Uploading an avatar on S2 persists and renders on S2 after reload.
- Uploading an avatar on S2 renders on S1 after navigating there.
- Uploading an avatar on S5 persists and renders on S2 after navigating there.
- Rejecting a non-image file shows an error without crashing.
- Rejecting a > 5 MB file shows a size error without uploading.
- The stored avatar is a JPEG data URL at approximately 100×100 resolution.

## Key Technical Decisions

- **KTD1: `avatarUrl` is a nullable string on the `Player` entity, not a separate resource.** A separate `/players/{playerId}/avatar` sub-resource would add unnecessary routing complexity for a single-field update. Extending the existing PATCH keeps avatar changes alongside other identity edits.
- **KTD2: local/offline mode uses `localStorage` as the avatar store.** `playerAvatars[playerId]` holds the base64 data URL. This is structurally a URL reference — the key lookup IS the "URL" — and the rendering path checks `playerAvatars[playerId]` before falling back to ⚽, identical to how the backend path checks the DB column.
- **KTD3: Client-side canvas conversion at 100×100 JPEG.** The browser reads the selected file, draws it to an off-screen `<canvas>` scaled to 100×100 (using `drawImage` with width/height constraints to maintain aspect ratio, centering the crop), then exports as a JPEG blob at quality 0.85. This converted blob is what gets stored and uploaded. The conversion runs before storage in both offline and backend modes, so the backend always receives a small, consistent-format payload. This eliminates a separate ingest-time resize step and keeps the local/offline and backend paths structurally identical.

## Dependencies

- U2 requires U1 (the schema must exist before the backend can use it).
- U3, U4, and U5 each require U2 (the API must accept and return `avatarUrl` before the UI can use it).

## Deferred to Follow-Up Work

- Avatar deletion (removing an uploaded avatar reverts to ⚽) — not needed for initial release.
- Crop/rotate tooling on upload — nice to have, not in scope.
- Default avatar assignment on player creation — new players get ⚽ initially.
