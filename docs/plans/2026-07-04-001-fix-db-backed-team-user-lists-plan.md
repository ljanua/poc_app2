# fix: Make team and user lists read from database-backed API

## Summary
The app currently serves team and user lists from the mockup client local store, which bypasses the database-backed source of record. This plan switches those read paths to the API so team management and admin user management reflect persisted database state.

## Problem Frame
- Team management and admin user management UI still read from local mock storage instead of the database-backed API.
- The current server only exposes player-related persistence endpoints, so team and user data cannot be fetched from the backend.

## Scope
- Add backend endpoints for listing teams and users.
- Update the mockup client to request team and user data from the backend when backend mode is enabled.
- Preserve local fallback behavior when backend mode is disabled.

## Implementation Units

### U1. Expose database-backed team and user APIs
- **Goal:** Make the mockup server return teams and users from PostgreSQL.
- **Files:** apps/api/src/db/schema/tables.sql, scripts/serve-mockup.js
- **Approach:** Add GET handlers for /api/v1/teams and /api/v1/users that query the users, teams, and player_team_assignments tables and return serialized payloads compatible with the UI.
- **Test scenarios:**
  - Happy path: requesting teams returns rows with team name, age group, lead coach, and player count.
  - Happy path: requesting users returns rows with name, email, role, status, and last login metadata.
  - Error path: when no DATABASE_URL is configured, the API returns a service-unavailable response.

### U2. Route the mockup client through the backend for team and user reads
- **Goal:** Make the UI consume database-backed data for team and user lists.
- **Files:** docs/ux/mockup/js/mockup-api-client.js
- **Approach:** Update listTeams, listActiveCoaches, listTeamSummary, listUsers, and related team/user flows to use backend requests when backend mode is enabled, while keeping the existing local store fallback intact for mock-only mode.
- **Test scenarios:**
  - Happy path: team management renders data returned by the backend.
  - Happy path: admin user management renders data returned by the backend.
  - Fallback path: when backend mode is off, the local store behavior remains unchanged.

## Verification
- Verify syntax for the updated server and client scripts.
- Confirm the new API routes are wired to the existing mockup pages without regressions to the player flow.
