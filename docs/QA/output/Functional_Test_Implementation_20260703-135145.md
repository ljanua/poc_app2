# Functional Test Implementation - RUN_ID 20260703-135145

## Framework and config
- Framework: Playwright Test (@playwright/test)
- Config file: playwright.config.js
- Base URL: http://127.0.0.1:5500
- Web server command: node scripts/serve-mockup.js (reuseExistingServer enabled)
- Trace/screenshot/video: retained on failure

## Test script files
- tests/playwright/s1-player-list.spec.js

## Test design notes
- Uses stable selectors tied to S1 controls and state output:
  - #teamFilter
  - #toggleAddPlayer button text Add Player
  - #addPlayerInput
  - #addPlayerHint
  - #playerListStatus
  - .player-card .player-name
- Assertions focus on user-observable outcomes instead of implementation internals.

## Implemented scenarios
1. Team-scoped visibility after team selection.
2. Add-player flow via name lookup and reassignment behavior.
3. Invalid lookup add-block flow with validation hint.

## NPM integration
- package.json scripts:
  - pw:test
  - pw:test:s1
- Added dev dependency:
  - @playwright/test
