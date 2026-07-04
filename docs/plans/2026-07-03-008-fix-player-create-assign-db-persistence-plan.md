# fix: Ensure player create-and-assign persists to PostgreSQL source of record

## Summary
Fix the regression where creating a new player from S1 appears successful but does not persist to PostgreSQL. Route create/assign flows through a real API + DB write path by default, and keep local fallback only as explicit opt-in mock mode.

---

## Problem Frame
The current player flow returns success from in-memory or browser-local logic, so new players can disappear across sessions or runtimes. This violates source-of-record requirements and causes misleading manual tests (UI success toast without durable DB persistence).

Observed root cause:
- `apps/api/src/modules/players/repositories/player-repository.ts` stores player state in a process-local `Map` instead of PostgreSQL.
- `docs/ux/mockup/js/mockup-api-client.js` only uses backend when `window.__MOCK_API_BACKEND__` is injected; otherwise it silently runs local persistence.
- `scripts/serve-mockup.js` serves static files only and provides no `/api/v1/players` HTTP path.

---

## Origin
- docs/plans/2026-07-03-007-feat-persist-mock-data-plan.md
- docs/plans/2026-07-03-004-feat-postgresql-player-source-of-record-plan.md
- docs/brainstorms/2026-07-01-coaches-growth-match-time-performance-requirements.md

---

## Requirements
- R1: Creating a no-match player with explicit confirmation must insert into PostgreSQL.
- R2: Assigning or moving a player must persist assignment state in PostgreSQL.
- R3: S1 must use HTTP API endpoints by default in backend-enabled runs; local mode must be explicit.
- R4: API responses must remain compatible with current S1 behavior and error handling.
- R5: Regression tests must prove persisted state survives page reload and process restart assumptions.

---

## Scope Boundaries
### In scope
- PostgreSQL-backed repository implementation for players and assignments.
- Executable players HTTP route path used by S1 add/list/assign flows.
- Mockup API client backend-default behavior and explicit fallback gating.
- API integration and Playwright regression updates for persistence guarantees.

### Deferred to Follow-Up Work
- Migrating clips, assessments, and users to the same runtime API path.
- Multi-team membership and assignment history timeline.
- Background sync and websocket update propagation.

### Out of scope
- Authentication redesign.
- UI redesign beyond behavior required for persistence correctness.
- Changes to non-player domains unless needed for compile/runtime wiring.

---

## Key Technical Decisions
- Replace in-memory `PlayerRepository` persistence with PostgreSQL writes/reads when backend mode is active.
- Treat backend mode as default for manual/CI runs; local fallback is allowed only when explicit mock flag is set.
- Keep response envelopes (`status`, `code`, `message`, player payload shape) stable so S1 behavior remains unchanged.
- Introduce deterministic runtime startup checks for DB connectivity; do not silently degrade to local mode unless explicitly configured.

---

## High-Level Technical Design
```mermaid
flowchart LR
  A[S1 Add Player UI] --> B[mockup-api-client]
  B -->|default backend path| C[/api/v1/players endpoints]
  C --> D[Players service]
  D --> E[PostgreSQL players + assignment tables]

  B -->|explicit mock flag only| F[localStorage fallback]

  E --> G[API integration tests]
  E --> H[Playwright persistence assertions]
```

---

## Implementation Units

### U1. Introduce PostgreSQL players repository implementation
**Goal:** Make player create/list/assign operations write/read durable data from PostgreSQL.

**Requirements:** R1, R2.

**Dependencies:** none.

**Files:**
- apps/api/src/modules/players/repositories/player-repository.ts
- apps/api/src/db/schema/tables.sql
- apps/api/src/db/migrations/006_players_teams_source_of_record.sql
- apps/api/tests/integration/db/player-source-of-record-migration.spec.ts (new)

**Approach:**
- Replace process-local `Map` persistence in `player-repository.ts` with DB-backed query operations.
- Align repository fields with migration schema (`players`, `player_team_assignments`, team FK linkage).
- Ensure move/assign is atomic and enforces one active team per player.

**Patterns to follow:**
- Migration style in apps/api/src/db/migrations/005_teams_and_coach_assignment.sql.
- Error envelope semantics in apps/api/src/shared/errors/app-error.ts.

**Test scenarios:**
- Happy path: confirmed create inserts a player row and assignment row.
- Happy path: assign existing player persists strict move to target team.
- Edge case: same-team move returns no-op message without duplicate rows.
- Error path: non-existent team rejects write with validation/not-found envelope.
- Integration: create then separate read session returns persisted player.

**Verification:**
- DB queries confirm created player remains present across service instance restart.

### U2. Expose executable players HTTP API path
**Goal:** Provide a runnable `/api/v1/players` path that S1 can call during manual and automated tests.

**Requirements:** R1, R2, R4.

**Dependencies:** U1.

**Files:**
- apps/api/src/modules/players/controllers/players.controller.ts
- apps/api/src/modules/players/services/players.service.ts
- apps/api/src/modules/players/index.ts
- scripts/serve-mockup.js
- openapi/v1/openapi.yaml
- openapi/v1/schemas/players.yaml
- apps/api/tests/integration/players/players-api.spec.ts

**Approach:**
- Wire players controller/service to DB-backed repository operations.
- Add HTTP handlers in runtime server path so `/api/v1/players`, `/api/v1/players/preview-create`, and `/api/v1/players/{id}/assign` are executable in local manual runs.
- Keep current response shape expected by S1.

**Patterns to follow:**
- Controller/service boundaries in apps/api/src/modules/users/controllers/users.controller.ts.
- Existing OpenAPI schema grouping in openapi/v1/openapi.yaml.

**Test scenarios:**
- Happy path: POST create returns `201` and persisted player payload.
- Happy path: POST assign returns `200` and updated team assignment.
- Edge case: GET list by team shows newly created player in target team only.
- Error path: unconfirmed no-match create returns `400 validation_error`.
- Integration: API write followed by independent API read confirms persistence.

**Verification:**
- Manual curl-style API call sequence produces durable DB state.

### U3. Make S1 backend path default and fallback explicit
**Goal:** Eliminate silent local-mode success when backend persistence is expected.

**Requirements:** R3, R4.

**Dependencies:** U2.

**Files:**
- docs/ux/mockup/js/mockup-api-client.js
- docs/ux/mockup/S1-player-list.html
- tests/playwright/s1-player-list.spec.js

**Approach:**
- Default `MockupApi` player operations to HTTP calls against `/api/v1/players*` in backend-enabled runs.
- Keep local fallback only when explicit mock switch (`window.__USE_MOCK_LOCAL__===true`) is set.
- Surface backend-unavailable state clearly instead of silently persisting only to local storage.

**Patterns to follow:**
- Existing S1 add-player validation and UX messages in docs/ux/mockup/S1-player-list.html.

**Test scenarios:**
- Happy path: create player in S1 persists and remains after page reload.
- Happy path: assign existing player move persists and reflects in team filters.
- Edge case: explicit mock mode still enables local flow for offline demos.
- Error path: backend unreachable in backend-default mode shows explicit error path.
- Integration: S1 create + API read confirms same persisted player ID/name.

**Verification:**
- Browser flow in backend-default mode cannot report success without DB-backed write confirmation.

### U4. Strengthen regression and traceability for persistence contract
**Goal:** Prevent recurrence of false-positive “created” behavior with non-durable storage.

**Requirements:** R5.

**Dependencies:** U2, U3.

**Files:**
- tests/bdd/features/player-source-of-record-and-confirmed-create.feature
- tests/bdd/features/step_definitions/coach-development-video-source.steps.js
- tests/playwright/s1-player-list.spec.js
- docs/ux/mockup/API-Mockup-Mapping.md
- apps/api/tests/contract/openapi.players.spec.ts

**Approach:**
- Update BDD and Playwright assertions to require durable post-create read behavior.
- Add mapping notes that backend-default mode is required for source-of-record claims.
- Keep contract checks aligned with runtime behavior so docs and implementation do not drift.

**Patterns to follow:**
- Existing BDD style in tests/bdd/features/player-source-of-record-and-confirmed-create.feature.
- Existing Playwright style in tests/playwright/s1-player-list.spec.js.

**Test scenarios:**
- Happy path: created player is visible in subsequent independent list calls.
- Happy path: strict move removes player from prior team and shows in target team.
- Edge case: duplicate path returns conflict with assign-existing metadata.
- Error path: create without confirmation returns expected validation error code.
- Integration: test fails if create succeeds without durable DB row.

**Verification:**
- Regression suite fails if implementation reverts to non-durable local-only success semantics in backend-default runs.

---

## Dependencies and Sequencing
- U1 -> U2 -> U3 -> U4.
- U1 and U2 establish the actual persistence path; U3 updates client behavior; U4 locks regression coverage.

---

## Risks and Mitigations
- Risk: introducing DB-backed operations without robust connection handling can fail manual test runs.
  - Mitigation: add explicit startup/config validation and clear runtime errors when DB is unavailable.
- Risk: response-shape drift breaks S1 behavior.
  - Mitigation: preserve existing envelope keys and backstop with Playwright assertions.
- Risk: fallback logic reintroduces silent local writes.
  - Mitigation: require explicit mock-only flag and test negative path.

---

## Open Questions
- Should backend-default mode be always on for local runs, or only when a `DATABASE_URL` is present?
- Should backend-unavailable mode block Add Player entirely, or allow user-opted switch to explicit mock mode in UI?

---

## Implementation-Time Unknowns
- Final runtime host for executable players API in local manual runs (embedded in `serve-mockup.js` vs separate API process) can be selected during implementation as long as S1 calls a real DB-backed endpoint.
- Exact SQL query shape and index tuning may be adjusted once integration tests run against the real DB.
