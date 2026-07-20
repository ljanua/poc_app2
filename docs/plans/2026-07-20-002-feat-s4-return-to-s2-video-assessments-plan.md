---
title: feat — S4 return to S2 Video Assessments after submit/cancel
date: 2026-07-20
type: feat
classification: software
feature: 035
slug: feat-s4-return-to-s2-video-assessments
product_contract_source: ce-plan-bootstrap
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
origin: User request 2026-07-20 — when coach opens S4 from S2 with a player assigned, redirect back to that S2 dashboard with the player selected and Video Assessments open. Scope confirmed option 2 (successful submit and Cancel).
---

# Feature 035 — S4 return to S2 Video Assessments (submit + cancel)

## Goal Capsule

- **Objective:** When a coach opens S4 from the S2 player dashboard with a player already assigned, **successful submit** and **Cancel** both return them to that player's S2 dashboard with the **Video Assessments** section expanded.
- **Authority:** Mockup UX only — `docs/ux/mockup/S2-player-dashboard.html`, `docs/ux/mockup/S4-video-capture.html`, optional mapping note; Playwright `tests/playwright/s2-player-dashboard.spec.js` and/or `tests/playwright/s4-video-capture.spec.js`.
- **Done when:** S2→S4 deep links carry an explicit return marker; after submit success or Cancel confirm, navigation lands on S2 for that player with Video Assessments open; S4 entry without the marker keeps today's submit-reset / Cancel-back behavior.
- **Out:** Changing bottom-nav destinations; browser Back button rewriting; guest share flows; backend API changes; forcing Video Assessments open on unrelated S2 visits.

### Summary

Mark S2→S4 entry with `from=s2` + `playerId`, then on submit success or Cancel navigate to `S2-player-dashboard.html?player=<name>&section=video-assessments` and expand that section on load.

## Product Contract

### Problem Frame

S2 already deep-links to S4 with `playerId`, and S4 preselects the player, but after submit S4 resets the form in place, and Cancel uses `history.back()`. Coaches lose the dashboard context and often find Video Assessments still collapsed. S2 also sets `referrer-policy: no-referrer`, so return cannot rely on `document.referrer`.

### Actors

- A1. **Coach** — submits or cancels a clip started from a player's S2 dashboard.
- A2. **Coach (other entry)** — opens S4 from bottom nav / hub without S2 context; must not be forced onto S2.

### Key Flows

- F1. S2 **Submit a Clip** / **Submit New Clip** → S4 with `playerId` + `from=s2` → player preselected.
- F2. Successful submit (from that entry) → dismiss success alert → navigate to S2 for that player with Video Assessments **open** (new clip visible when list refreshes).
- F3. Cancel confirmed (from that entry) → navigate to same S2 return URL (no clip created).
- F4. S4 without `from=s2` → submit still resets form; Cancel still `history.back()` (current behavior).

### Acceptance Examples

- AE1. From S2 Messi dashboard, click Submit a Clip → URL includes `playerId` and `from=s2` → player select matches Messi.
- AE2. Complete a valid submit → after success alert, land on S2 for Messi with Video Assessments expanded (`aria-expanded="true"` / not `is-collapsed`).
- AE3. Same entry, click Cancel and confirm → land on S2 for Messi with Video Assessments expanded.
- AE4. Open S4 from bottom nav (no `from=s2`) → Cancel does not force S2; submit does not navigate to S2.
- AE5. Return URL selects the correct player (same identity as the S4 selection), not the default/first roster player.

### Requirements

#### Entry marking (S2 → S4)

- R1. Both S2 clip CTAs (`submit-clip-link`, `submit-new-clip-link`) include `playerId` (already) and an explicit **`from=s2`** query param.
- R2. Do not use `document.referrer` (S2 uses `no-referrer`).

#### Return navigation (S4 → S2)

- R3. When `from=s2` is present and a player is selected (or was provided via `playerId`), **successful submit** navigates to S2 after the success alert.
- R4. When `from=s2` is present, **Cancel** (after confirm) navigates to the same S2 return URL instead of only `history.back()`.
- R5. Return URL uses the established S2 player selector: `S2-player-dashboard.html?player=<encoded player name>` (matches S1/S5/S9). Prefer the selected option's display name on S4; if needed, also accept resolving by `playerId` on S2 as a hardening step.
- R6. Return URL includes a section open signal, e.g. **`section=video-assessments`**.
- R7. Without `from=s2`, preserve current submit (reset in place) and Cancel (`history.back()`) behavior.

#### S2 section open

- R8. On S2 load, if `section=video-assessments` (or agreed equivalent) is present and that section is visible, expand it (remove `is-collapsed`, set toggle `aria-expanded="true"`).
- R9. Persist that expanded state into the existing per-player section localStorage (`vantageiq_s2_dashboard_sections`) so a refresh still shows it open.
- R10. Prefer applying the query override **after** (or instead of) the saved collapsed default for that slug on this visit.

#### Tests / docs

- R11. Playwright covers S2→S4 `from=s2`, then Cancel → S2 with section open; and submit success → S2 with section open (dialog accept as today's S4 suite does).
- R12. Brief note in `docs/ux/mockup/API-Mockup-Mapping.md` (or adjacent UX note) for the return query contract.

### Scope Boundaries

**In scope:** S2 outbound links; S4 submit/cancel return; S2 `section=` handling; Playwright; short mapping note.

**Out of scope:** Bottom-nav / exit button specially returning to S2; changing Cancel confirm copy; auto-opening other sections; guest `?share=` dashboards; server-side redirects.

### Success Criteria

- Coaches who start clip capture from S2 always land back on that player's dashboard with Video Assessments open after submit or cancel.
- Other S4 entry points are unchanged.

## Planning Contract

### Key Technical Decisions

- KTD1. **Explicit `from=s2` marker** rather than inferring from `playerId` alone — other tests/deep links use `playerId` without intending an S2 return.
- KTD2. **Return with `player=<name>`** to match existing S2 `getDashboardPlayer(selectedPlayer)` contract; optional follow-up to also honor `playerId` on S2 if name encoding proves fragile.
- KTD3. **`section=video-assessments`** query param drives open state; slug matches `data-section` already on the Video Assessments block.
- KTD4. **Submit path:** keep success `alert`, then `window.location.href = returnUrl` (no form reset needed when leaving the page).
- KTD5. **Cancel path:** keep confirm dialog; on OK, if return context → S2 URL; else `history.back()`.

### Technical Design

```
S2 CTA href:
  ./S4-video-capture.html?playerId={id}&from=s2

S4 on submit success | Cancel confirm:
  if params.from === 's2' && playerName:
    → ./S2-player-dashboard.html?player={name}&section=video-assessments
  else:
    → existing reset / history.back()

S2 initDashboardSectionToggles:
  if params.section === 'video-assessments':
    force expand + saveSectionExpanded('video-assessments', true)
```

### Assumptions

- A1. "Video Assessment" in the request means the S2 section titled **Video Assessments** (`data-section="video-assessments"`).
- A2. Success alert remains; navigation happens after the user dismisses it (synchronous `alert` then assign location).
- A3. If the coach changes the player dropdown on S4 after arriving from S2, return uses the **currently selected** player (not the original inbound id only).

### Dependencies and Sequencing

1. U1 — S2 outbound `from=s2` + S2 `section=` expand.
2. U2 — S4 return on submit + Cancel.
3. U3 — Playwright + mapping note.

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Player name with special characters breaks return | `encodeURIComponent`; Playwright with a normal and a spaced name (Messi already covered) |
| Section hidden for no-stats/no-clips players | Still set expanded state; if section `hidden`, expand when it becomes visible if already in DOM — document that empty Video Assessments may stay hidden until a clip exists (post-submit it should show) |
| `from=s2` lost if user switches source mode | Marker is on the page URL, not form fields — survives mode toggles |

### Open Questions

- None blocking.

## Implementation Units

### U1. S2 outbound marker + honor `section=video-assessments`

**Goal:** S2 links advertise return intent; S2 opens Video Assessments when asked.

**Requirements:** R1–R2, R5–R6, R8–R10

**Files:**
- Modify: `docs/ux/mockup/S2-player-dashboard.html`

**Approach:**
- Extend `submitClipHref` to append `&from=s2` (when `playerId` present).
- In `initDashboardSectionToggles` (or immediately after), read `section` from `URLSearchParams`; if `video-assessments`, force expand and `saveSectionExpanded`.

**Test scenarios:** Covered in U3; manual: open S2 with `?player=Lionel%20Messi&section=video-assessments` → section expanded.

### U2. S4 return on successful submit and Cancel

**Goal:** Leave S4 back to S2 when entry was from the dashboard.

**Requirements:** R3–R4, R7

**Files:**
- Modify: `docs/ux/mockup/S4-video-capture.html`

**Approach:**
- Helper `buildS2ReturnUrl()` from current `#player` selected option text + fixed `section=video-assessments`.
- Helper `shouldReturnToS2()` → `from=s2` in query and a resolvable player name.
- Submit success branch: if should return → `location.href = buildS2ReturnUrl()` after alert; else existing reset.
- `handleCancel`: on confirm, if should return → navigate; else `history.back()`.

**Test scenarios:** Covered in U3.

### U3. Playwright + mapping note

**Goal:** Lock the round-trip and document the query contract.

**Requirements:** R11–R12

**Files:**
- Modify: `tests/playwright/s2-player-dashboard.spec.js` and/or `tests/playwright/s4-video-capture.spec.js`
- Modify: `docs/ux/mockup/API-Mockup-Mapping.md` (short bullet)

**Approach:**
- Extend existing S2 “submit clips” test: assert `from=s2` on href; Cancel path → S2 URL with `section=video-assessments` and toggle expanded.
- Add submit-success return case (file stub + dialog accept) asserting S2 + open section.
- Negative: S4 without `from=s2` Cancel does not require S2 (optional light assert).

**Test scenarios:**
- Happy: S2 CTA href includes `from=s2` and `playerId`.
- Happy: Cancel from that entry → S2 with player + Video Assessments open.
- Happy: Submit success from that entry → same return.
- Regression: S4 without `from=s2` does not redirect to S2 on submit.

## Verification Contract

- Playwright: targeted S2/S4 specs covering the round-trip (`npx playwright test tests/playwright/s2-player-dashboard.spec.js tests/playwright/s4-video-capture.spec.js` or the narrower files touched).
- Manual: S2 → Submit New Clip → Cancel → confirm Video Assessments open; repeat with a real/offline submit stub.

## Definition of Done

- R1–R12 satisfied; U1–U3 complete.
- Round-trip works for submit and Cancel; unmarked S4 entry unchanged.

## Appendix

### Baseline

- S2 CTAs: `./S4-video-capture.html?playerId={id}` only.
- S4 submit: alert + form reset; Cancel: confirm + `history.back()`.
- S2 sections default collapsed unless per-player localStorage says expanded; no `section` query handling today.
