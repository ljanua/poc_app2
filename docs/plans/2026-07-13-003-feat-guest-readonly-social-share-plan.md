---
title: feat — Guest read-only social share links for S2
date: 2026-07-13
type: feat
classification: software
feature: 034
slug: feat-guest-readonly-social-share
product_contract_source: ce-plan-bootstrap
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
origin: docs/backlog/007-guest-readonly-social-share.md — Guest read-only via tokenized link; S2 one-player view; copy/paste only; editors = Coach + SystemAdmin. Confirmed: never time-expire (revoke only); guest Video Assessments + play; write CTAs visible but inert; SA can create/revoke shares.
---

# Feature 034 — Guest Read-Only Social Share (S2)

## Goal Capsule

- **Objective:** Let **Coach** (assigned player) and **SystemAdmin** create a **copyable tokenized link** from S2 for **one player**. Anyone with the link views that player’s S2 **read-only** (no login), including **Video Assessments + play**. Links **never time-expire**; **revoke** kills access.
- **Authority:** Opaque share token is the only guest credential. Bind each token to one `player_id`. Store **hash only**. Guest reads go through **share-scoped APIs**, not trusting a free `playerId` in the URL. Editors create/revoke from S2; guests open `S2-player-dashboard.html?share=<token>`.
- **Done when:** Editor can create + copy + revoke; guest sees identity/skills/assessments + play and cannot use write actions; revoked/unknown tokens fail closed; Coach session S2 unchanged for writes; mapping + Playwright/API tests cover the flows.
- **Out:** Social network buttons; standing guest accounts; multi-player/club shares; guest S1/S6/club admin; time-based expiry; locking down all unauthenticated clip/media routes for non-guest traffic (deferred).

---

## Product Contract

### Summary

Editors share a single-player S2 view via a never-expiring opaque link. Guests browse and play that player’s assessments read-only; revoke is the only kill switch. Copy/paste only — no social network integrations.

### Problem Frame

Coaches need to distribute a player’s results externally without creating accounts or exposing write surfaces. Today S2 requires a Coach session (`actorEmail`); SystemAdmin cannot open S2 at all; clips/media GETs are unauthenticated by clip id. There is no share-token model.

### Actors

- A1. **Coach** — lead coach for the player’s team; creates/revokes share links from S2; keeps full edit UX when signed in.
- A2. **SystemAdmin** — can open S2 for any player and create/revoke share links (editor parity per backlog).
- A3. **Guest** — anonymous holder of a valid share token; read-only S2 for the bound player only.

### Key Flows

- F1. Editor on S2 → Create share link → API returns raw token once → UI shows copyable absolute/relative URL → clipboard.
- F2. Guest opens `S2-player-dashboard.html?share=<token>` → resolve token → load that player’s dashboard + clips via share APIs → write CTAs visible but inert; no session required.
- F3. Guest plays a Video Assessment → modal streams media via share-scoped media URL for a clip belonging to the bound player.
- F4. Editor revokes active share → subsequent guest resolve/media return the same failure as unknown token.
- F5. Editor creates a new link after revoke → new token works; old token stays dead.

### Acceptance Examples

- AE1. Coach on a roster player creates a link, copies it, opens in a private window → S2 shows that player; Edit/Submit/avatar remain visible but do nothing; Video Assessments list + play work.
- AE2. SystemAdmin opens S2 for a player, creates and revokes a share; revoked link no longer loads the dashboard.
- AE3. Guest with player A’s token cannot load player B’s dashboard or play B’s clips even with guessed ids.
- AE4. Signed-in Coach S2 without `share` param still allows Edit / Submit / avatar as today.

### Requirements

- R1. Tokenized URL for a **single player**; guest sees **only S2** for that player (no S1/S6/club as guest surfaces).
- R2. Editors = anyone who can Edit Player on S2 today **by product intent**: **Coach** (lead-coach scoped) and **SystemAdmin** (any player). Implement SA S2 access as part of this feature.
- R3. Create share from S2; return a **copy/paste** URL only (no social network buttons).
- R4. Links **never time-expire**; **revoke** is required and available to editors on S2 for that player’s active share(s).
- R5. Guest view is read-only: **Edit Player, Submit Clip, avatar upload, and other write nav stay visible but inert** (no navigation/upload).
- R6. Guest sees the same S2 read content as an editor would for that player, including **Video Assessments list and play**.
- R7. Persist shares server-side (hash, player binding, creator, revoked_at); raw token shown only at create time.
- R8. Document APIs and S2/guest UX in `docs/ux/mockup/API-Mockup-Mapping.md`.

### Scope Boundaries

#### In scope

- Share table + `ensureDatabase` / migration
- Create / revoke / resolve APIs and share-scoped dashboard, clips, media (and thumbnail if used on S2)
- SystemAdmin can GET S2 dashboard (and create/revoke shares) for any player
- S2 UI: share create/copy/revoke; guest mode from `?share=`
- In-page play on S2 for guest Video Assessments (reuse S6 modal pattern)
- Playwright + API/unit tests; mapping docs

#### Out of scope

- Native share sheet / Facebook / WhatsApp / etc.
- Guest accounts, magic email links, OAuth
- Sharing S6 list, whole team, or club
- Time-based `expires_at`
- Rate limiting / abuse dashboards (beyond basic opaque tokens)

#### Deferred to Follow-Up Work

- Requiring auth or share token on **all** existing `GET /clips`, `/media`, `/thumbnail` (today world-readable by id) — guest feature uses **separate share-scoped routes** so secrecy does not depend on that lockdown
- Multiple concurrent shares per player UX polish (MVP uses one active share via replace-on-create — KTD7)
- Club-admin role share parity (`docs/backlog/009-…`)

---

## Planning Contract

### Assumptions

- “Expire in 0 days” in the backlog means **no time expiry** (confirmed).
- Product “editor” includes SystemAdmin even though code today returns **403** for SA on `GET /players/dashboard` — this plan **fixes that gap** for dashboard + share.
- Coach scope for create/revoke remains **lead-coach** on the player’s team (same as current S2 dashboard), not `coach_clubs` roster breadth.
- S2 signed-in Video Assessments today **list** clips but do not play; guest R6 requires **adding play on S2** at least in guest mode (implementers may enable the same play control for signed-in editors for consistency).
- MVP: at most **one active (non-revoked) share per player**; creating a new link revokes the previous active one, or create is rejected until revoke — prefer **replace**: create revokes prior active then issues new token (simpler UX).

### Key Technical Decisions

- KTD1. **Opaque token, hashed at rest** — `crypto.randomBytes(32)` → base64url in the URL; persist `sha256(raw)` only; lookup by hash; never log raw token or full share URLs.
- KTD2. **URL shape** — Guest opens `docs/ux/mockup/S2-player-dashboard.html?share=<rawToken>` (opaque query). Do not put enumerable `playerId` as the capability.
- KTD3. **Share-scoped guest APIs** — e.g. `POST /api/v1/players/{id}/share`, `DELETE /api/v1/players/{id}/share` (or revoke by share id), `GET /api/v1/share/{token}/dashboard`, `GET /api/v1/share/{token}/clips`, `GET /api/v1/share/{token}/clips/{clipId}/media` (+ thumbnail if needed). Existing unauthenticated clip routes stay for coach/demo flows this iteration.
- KTD4. **Auth for create/revoke** — Coach via `resolveCoachActor` + existing lead-coach player check; SystemAdmin via `assertSystemAdminActor` with **no** lead-coach restriction. Extend `GET /players/dashboard` the same way so SA can reach S2.
- KTD5. **Guest write CTAs** — Keep controls in the DOM for layout familiarity; strip `href`, block clicks, skip avatar file picker, omit `actorEmail` session use when `share` is present.
- KTD6. **Failure uniformity** — Unknown, revoked, and player-mismatch → same client-visible failure (no “revoked” oracle).
- KTD7. **Replace-on-create** — Creating a share for a player revokes any existing active share for that player, then inserts the new row.

### High-Level Technical Design

```mermaid
sequenceDiagram
  participant Editor as Editor S2
  participant API as serve-mockup API
  participant DB as Postgres
  participant Guest as Guest browser

  Editor->>API: POST share (actorEmail, playerId)
  API->>DB: revoke prior active; insert token_hash + player_id
  API-->>Editor: { url, token } once
  Editor->>Editor: copy URL

  Guest->>API: GET share/{token}/dashboard
  API->>DB: hash lookup; revoked_at IS NULL
  API-->>Guest: player dashboard DTO
  Guest->>API: GET share/{token}/clips
  API-->>Guest: clips for bound player only
  Guest->>API: GET share/{token}/clips/{id}/media
  API->>DB: clip.player_id == share.player_id
  API-->>Guest: media stream
```

### Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Existing open `/clips/*/media` bypasses share secrecy | Document clearly; guest UI only uses share-scoped URLs; defer global lockdown |
| SA S2 access expands attack surface | Still require active SystemAdmin; no anonymous SA |
| Token in query string leaks via Referer | Prefer path segment if easy; set referrer policy on guest S2; redact logs |
| Playwright historically forces offline S2 | Add a backend-mode guest/share spec path (mirror avatar backend spec patterns) |

### System-Wide Impact

- **Editors / guests:** New external distribution path for player PII and video — treat tokens as secrets.
- **Ops:** After deploy, restart `scripts/serve-mockup.js`; no video reprocess required.
- **Security debt:** Unauthenticated legacy clip/media routes remain until a follow-up lockdown.

### Sources & Research

- Origin: `docs/backlog/007-guest-readonly-social-share.md`
- Local: `scripts/serve-mockup.js` (Coach-only dashboard; open clips/media); `docs/ux/mockup/S2-player-dashboard.html`; `docs/ux/mockup/js/mockup-api-client.js`
- External (load-bearing): opaque 32-byte tokens, hash-at-rest, revoke via `revoked_at`, bind to `player_id`, scope media to binding, uniform 404, no raw-token logging

---

## Implementation Units

### U1. Share persistence and token helpers

**Goal:** Durable `player_share_links` (name flexible) with hash, player FK, creator, timestamps, `revoked_at`.
**Requirements:** R4, R7
**Dependencies:** None
**Files:**
- `scripts/serve-mockup.js` (`ensureDatabase`)
- `apps/api/src/db/migrations/` (new numbered SQL)
- `apps/api/tests/` or colocated Vitest for hash/lookup helpers if extracted
**Approach:** TEXT id PK consistent with repo; `token_hash` unique; `player_id` FK; `created_by_user_id`; `revoked_at` nullable. Helpers: generate raw token, hash, constant-time compare via hash equality lookup.
**Patterns to follow:** `player_skill_ratings` / other `ensureDatabase` tables — TEXT ids + `TIMESTAMPTZ DEFAULT NOW()`.
**Test scenarios:**
- Happy: generate → hash → store → lookup by re-hash finds row
- Edge: revoked row not returned by “active” lookup
- Error: unknown hash → empty
**Verification:** Migration + bootstrap create the table; helper unit tests pass.

### U2. Create / revoke share APIs (Coach + SystemAdmin)

**Goal:** Authenticated create (replace-on-create) and revoke for a player.
**Requirements:** R2, R3, R4, R7
**Dependencies:** U1
**Files:**
- `scripts/serve-mockup.js`
- `docs/ux/mockup/js/mockup-api-client.js`
- `apps/api/tests/integration/` (or new vitest against share handlers)
**Approach:** POST creates share after authz; response includes one-time raw token + full mockup-relative URL. DELETE/POST revoke sets `revoked_at`. Coach: lead-coach player. SA: any player.
**Patterns to follow:** `resolveCoachActor` / `assertSystemAdminActor` gating on admin routes.
**Test scenarios:**
- Happy: Coach creates → 200 with token; SA creates for any player
- Edge: second create revokes first (only latest works)
- Error: Coach for non-lead player → 403; unauthenticated → 401/403; revoke unknown → uniform failure
**Verification:** API tests cover Coach/SA success and Coach 403; revoke stops resolve (U3).

### U3. Guest resolve + share-scoped dashboard / clips / media

**Goal:** Token resolves to read-only dashboard payload and scoped clip/media access.
**Requirements:** R1, R6, R7
**Dependencies:** U1, U2
**Files:**
- `scripts/serve-mockup.js`
- `docs/ux/mockup/js/mockup-api-client.js`
**Approach:** Resolve hash → player; reuse dashboard DTO assembly without requiring Coach actor. Clips list filtered to bound `player_id`. Media/thumbnail only if clip belongs to that player. No write endpoints accept share token.
**Execution note:** Start with failing API tests for resolve + media player-mismatch before wiring handlers.
**Test scenarios:**
- Happy: valid token → dashboard for bound player; clips list only that player; media 200 for own clip
- Edge: revoked/unknown → same error shape
- Error: valid token + other player’s clipId → deny
- Integration: create → resolve → revoke → resolve fails
**Verification:** Guest can load data only for the bound player; mismatch denied.

### U4. SystemAdmin S2 dashboard access

**Goal:** SA can open S2 (GET dashboard) for any player so they can use share UI.
**Requirements:** R2
**Dependencies:** None (can land before or with U2)
**Files:**
- `scripts/serve-mockup.js` (`GET /players/dashboard` and any profile GETs S2 needs)
**Approach:** Accept active SystemAdmin as well as Coach; Coach keeps lead-coach filter; SA skips lead-coach filter. Do not broaden Coach scope.
**Test scenarios:**
- Happy: SA + any playerId/name → 200 dashboard
- Happy: Coach + lead player → unchanged 200
- Error: Coach + non-lead → still 403; inactive user → deny
**Verification:** SA can load S2 in UI; Coach rules unchanged.

### U5. S2 UI — share controls, guest mode, play

**Goal:** Editor share create/copy/revoke; guest `?share=` mode with inert writes + assessment play.
**Requirements:** R3, R5, R6, AE1–AE4
**Dependencies:** U2, U3, U4
**Files:**
- `docs/ux/mockup/S2-player-dashboard.html`
- `docs/ux/mockup/style/site.css` (if needed)
- `docs/ux/mockup/js/mockup-api-client.js`
- Reuse play modal patterns from `docs/ux/mockup/S6-assessment-list.html`
**Approach:** Detect `share` query → guest load path (no session). Editor toolbar: Share / Copy / Revoke when session editor. Guest: keep Edit/Submit/avatar/nav chrome visible; strip `href`s, block clicks, and skip avatar picker (inert, not hidden). Add play on Video Assessment rows using share media URL in guest mode.
**Test scenarios:** Covered primarily in U6 Playwright.
**Verification:** Manual + Playwright: copy link works; guest inert writes; play works; coach write path intact without `share`.

### U6. Tests and API-Mockup-Mapping

**Goal:** Automated coverage + docs.
**Requirements:** R8, AE1–AE4
**Dependencies:** U1–U5
**Files:**
- `tests/playwright/s2-guest-share.spec.js` (new) and/or extend `tests/playwright/s2-player-dashboard.spec.js`
- `tests/playwright/s2-share-backend.spec.js` if backend-live pattern needed
- Vitest/integration files from U2–U4
- `docs/ux/mockup/API-Mockup-Mapping.md`
- `docs/backlog/007-guest-readonly-social-share.md` → status `planned`
**Approach:** Playwright: editor create → guest context open URL → assert read sections + inert write + play smoke; revoke → guest fails. Document Screen mapping rows + feature section.
**Test scenarios:**
- Happy: F1–F5 end-to-end in browser
- Edge: guest without token still cannot use editor APIs from UI
- Integration: SA create/revoke path
**Verification:** Specs green; mapping lists new routes and guest entry.

---

## Verification Contract

- API/unit: create/revoke/resolve/media mismatch; SA vs Coach authz on dashboard + share
- Playwright: guest S2 read + play; inert writes; revoke; coach non-share write path still works
- Mapping doc updated; backlog 007 marked planned
- Restart `scripts/serve-mockup.js` after route changes before manual checks

---

## Definition of Done

- [ ] U1–U6 complete with cited test scenarios passing
- [ ] Guest with valid link sees one-player S2 including Video Assessments + play
- [ ] Write CTAs visible but inert for guests; editors retain writes without `share`
- [ ] Revoke stops access; links do not time-expire
- [ ] Coach (lead) + SystemAdmin can create/revoke
- [ ] API-Mockup-Mapping documents share + guest flows
- [ ] No social network buttons; no guest S1/S6 entry points shipped

---

## Appendix

### Product Contract preservation

Product Contract derived from backlog 007 + planning confirmations (never-expire, guest play, inert CTAs, SA editors, revoke in MVP). No separate requirements-only unified plan existed (`product_contract_source: ce-plan-bootstrap`).
