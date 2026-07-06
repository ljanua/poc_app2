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
