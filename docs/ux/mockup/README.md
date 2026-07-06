# Mockup Local Server

This folder can be served locally for end-to-end browser walkthroughs.

## Commands
From repository root:
- npm install
- npm run build
- npm run e2e:up

If PowerShell blocks npm scripts due execution policy, run through cmd:
- cmd /c npm install
- cmd /c npm run build
- cmd /c npm run e2e:up

## URLs
- http://127.0.0.1:5500/
- http://127.0.0.1:5500/S0-login
- http://127.0.0.1:5500/S1-player-list
- http://127.0.0.1:5500/S2-player-dashboard
- http://127.0.0.1:5500/S3-team-management
- http://127.0.0.1:5500/S4-video-capture
- http://127.0.0.1:5500/S6-assessment-list
- http://127.0.0.1:5500/S7-admin-user-management

## Optional environment variables
- MOCKUP_HOST (default: 127.0.0.1)
- MOCKUP_PORT (default: 5500)

## Topbar session control
Every protected screen (S1, S2, S3, S4, S5, S6, S7) renders an icon-only `exit` button in the topbar (`[data-testid="exit-button"]`). Clicking it calls `MockupApi.logout()` and navigates to `S0-login.html`.

## Testing
The Playwright suite (under `tests/playwright/`) runs against a long-lived dev Postgres and does **not** truncate between runs. The single invariant the suite enforces is **at least 3 teams must be available** — the seeded `Senior Squad` / `U19 Prime` / `U17 Elite` are guaranteed by `scripts/serve-mockup.js`. Tests assert on these three named rows or on `>= 3` counts; any extras beyond those three (from prior runs or new admin-created teams) are accepted silently. Tests that create rows use timestamped unique names (via `tests/playwright/_fixture-utils.js`) so the create step does not 409 on a polluted DB. Tests that mutate shared state (e.g. role changes on `Joao Lima`) snap the row back via `restoreCoachRole` before the test ends, so a re-run sees the original seeded state. See `docs/plans/2026-07-06-006-test-plan-resilient-to-growing-teams.md` for the full policy.
