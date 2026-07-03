# feat: Coach player development and situational video plan

## Summary
Deliver an initial coach-facing platform that unifies player development, match time, and performance tracking with fast situational video capture and AI skill assessment. Phase 1 explicitly includes both coaches-growth capabilities and internal JWT authentication with role control (SystemAdmin and Coach). The first release will prioritize internal coaching workflows and a lightweight evidence-capture path while preserving the longer-term ideation direction of structured coach exchange and scout interest.

## Source documents
- `docs/ideation/2026-07-02-coach-player-development-exchange-platform.html`
- `docs/brainstorms/2026-07-01-coaches-growth-match-time-performance-requirements.md`
- `docs/brainstorms/2026-07-02-situational-video-assessment-requirements.md`
- `docs/brainstorms/2026-07-02-internal-jwt-auth-and-role-control-requirements.md`

## Problem
Coaches currently work across disconnected tools and notes to answer whether players are developing, receiving enough match time, and performing well. They also lack a lightweight in-field way to capture short player moments for later assessment, so key observations are lost or hard to act on.

## Goals and success criteria
- Give coaches one place to review player growth, match time, and performance trends.
- Enable coaches to capture short situational videos with minimal friction.
- Deliver clear AI assessment summaries for reviewed clips.
- Preserve the ideation platform direction by keeping coach exchange and scout interest as a future wave.

Success criteria
- Coaches can open a player profile and see growth indicators, match time history, and performance trends together.
- Coaches can record or upload a short clip, attach player and situation metadata, and submit it for assessment.
- Submitted clips enter an asynchronous review pipeline and return coach-friendly ratings.
- Missing or partial data is surfaced clearly instead of being hidden.

## Primary users
- Head coaches
- Assistant coaches
- Performance staff
- Team managers
- Scouts (future wave)

---

## Scope
### In scope
- Player development dashboard for coaches with:
  - growth indicators and milestones
  - match time history, minutes, appearances, substitutions
  - performance metric summaries and trend status markers
  - basic comparison across players or time periods
- Situational video capture/upload workflow for coach-facing devices
- Metadata tagging for player, situation, and skill context
- Backend submission pipeline for asynchronous AI assessment
- Viewing assessed clips with score summaries and supporting context
- Ingestion of structured external indicator reports for player growth data

### Deferred for later
- Full coach-to-coach or coach-to-scout exchange workspace
- External scout interest onboarding and anonymized signal distribution
- Advanced scouting or talent evaluation workflows
- Predictive performance forecasting
- AI-generated coaching recommendations
- Real-time video analysis during capture
- Motion tracking, tactical clipping editors, or multi-clip storyboards
- Full integration with sports analytics platforms beyond initial report ingestion

### Out of scope
- Formal transfer offer workflows and market pricing
- Scout-facing marketplace features in the first release
- Dedicated back-office recruiting workflow

---

## Key technical approach
Build this as a coach-first product anchored on a player profile and video submission flow.

- Start with a player development model that combines time-based metrics, performance scores, and growth status.
- Surface those metrics in a coach dashboard built for quick scanning rather than deep analytics.
- Add a mobile-friendly situational clip capture path that accepts short video files, key metadata, and submits jobs to an assessment queue.
- Keep assessment asynchronous: capture experience is fast, and rated results appear later in a curated review view.
- Design permissions so coaches and performance staff can view development detail, while future scout access is explicitly separated and controlled.

## Implementation units

### U1. Player development data model and ingestion APIs
**Goal:** Define the backend data structures and APIs required to store player development, match time, performance metrics, and external report ingestion.

**Requirements:** supports coach dashboard metrics; enables report ingestion; preserves incomplete data visibility.

**Files:** likely backend model files, API contract files, ingestion service files, and unit tests in existing backend modules.

**Approach:**
- Add or extend player profile entities to record development milestones, match minutes, performance scores, and report provenance.
- Create ingestion APIs or background import services for structured external indicator reports such as Playmaker sensor exports.
- Ensure the model supports sparse data and can mark fields as missing rather than hiding them.

**Patterns to follow:** existing domain model and ingestion patterns in the repository.

**Test scenarios:**
- Save a player’s development metrics and verify they are persisted with source metadata.
- Ingest an external report and verify the parsed values are stored correctly.
- Verify a player profile can be retrieved when some metrics are missing and that missing fields are represented clearly.
- Verify invalid or malformed report payloads are rejected cleanly.

**Verification:** backend data structures support the coach dashboard and report ingestion without losing partial results.

---

### U2. Coach player development dashboard
**Goal:** Build the coach-facing dashboard that presents growth, match time, and performance trends for a player.

**Requirements:** player profile view, growth indicators, time history, performance summary, trend status markers.

**Dependencies:** U1.

**Files:** frontend dashboard screens, API client calls, dashboard tests, relevant UI components.

**Approach:**
- Implement a player profile page showing key growth indicators, match minutes, appearance history, and performance summaries.
- Add trend badges or status indicators for improvement, plateau, and decline.
- Support coach scanning with compact visual summaries and optional drill-down details.
- Include a comparison view for selecting a second player or time window.

**Test scenarios:**
- A coach opens a player profile and sees metrics for growth, match time, and performance.
- Trend indicators update correctly when the latest data shows improvement versus decline.
- The comparison view shows a second player or period side by side.
- Missing data is surfaced with clear messaging rather than blank spaces.

**Verification:** coaches can review a player’s progress in one place and identify trend direction without spreadsheets.

---

### U3. Situational video capture and submission flow
**Goal:** Add the coach workflow to capture or upload short situational clips and submit them for later assessment.

**Requirements:** short video upload, metadata entry, mobile-friendly capture, asynchronous submission.

**Dependencies:** U1.

**Files:** frontend capture screen, metadata form, upload client, backend submission endpoint, upload validation tests.

**Approach:**
- Provide a simple coach-facing clip form that accepts file upload or capture, player selection, situation description, and optional skill focus.
- Enforce clip limits and supported formats for the initial release.
- Submit clips into a backend queue or job model for asynchronous assessment.
- Show a confirmation screen after submission with the next expected status.

**Test scenarios:**
- A coach uploads a short video with player and situation metadata and receives a success confirmation.
- Invalid clip formats or lengths are rejected with clear validation errors.
- The submission creates a queued assessment record in the backend.
- The coach can reopen the clip submission page and see the status of previously submitted clips.

**Verification:** coaches can capture or upload clips quickly and the system accepts submissions for later processing.

---

### U4. AI assessment results and clip review experience
**Goal:** Build the review experience for assessed clips and coach-friendly rating summaries.

**Requirements:** assessment result display, clip browsing, rating summaries, context for each reviewed clip.

**Dependencies:** U3.

**Files:** frontend review list, assessment detail page, backend result storage, review tests.

**Approach:**
- Create a clip review page that lists submitted clips and shows assessment status.
- When results arrive, display skill ratings, observations, and clip metadata.
- Keep summaries concise and coach-friendly; avoid raw AI outputs.
- Support filtering or sorting by status and player.

**Test scenarios:**
- A coach sees a submitted clip move from pending to assessed.
- Assessment results show the expected score categories and summary text.
- The review list filters clips by player and status.
- Absent or failed assessments show a clear retry or help message.

**Verification:** assessed clips are visible with digestible ratings and clip context.

---

### U5. Permissions, coach-user roles, and data boundaries
**Goal:** Establish clear access rules for coaches, assistants, performance staff, and future scout boundaries.

**Requirements:** coach/internal access to development data, explicit separation of scout-facing signals, clear privacy guardrails.

**Dependencies:** U1, U2, U3, U4.

**Files:** authorization policy files, role definitions, protected API tests.

**Approach:**
- Define role-based access for coach/internal users versus external or scout access.
- Ensure development metrics and clip detail are only visible to authorized coach roles in the initial release.
- Reserve scout interest and exchange features for a later wave.
- Document the permission model and any future scope for scout-specific channels.

**Test scenarios:**
- A coach role can access player development pages and clip review results.
- A non-coach role is denied access to the same pages.
- The API rejects unauthorized access to clip submissions and assessment results.
- Role changes do not expose assessment data without explicit authorization.

**Verification:** the product enforces the intended privacy and access boundaries for the initial release.

---

### U6. Internal JWT authentication and role administration
**Goal:** Implement internal authentication with JWT and role-based access control so SystemAdmin can manage users/roles and Coach can access only authorized product capabilities.

**Requirements:** internal login and JWT issuance; role-based route protection; SystemAdmin user/role administration; Coach blocked from user management.

**Dependencies:** U1, U2.

**Files:** backend authentication module, authorization policy layer, user/role management endpoints, login/session frontend entry points, and auth-focused tests.

**Approach:**
- Add internal credential authentication and issue short-lived JWT access tokens.
- Enforce role checks on protected routes and actions using SystemAdmin and Coach roles.
- Restrict user lifecycle and role assignment actions to SystemAdmin.
- Ensure coach dashboard, team/player flows, and clip workflows are protected under the same authorization model.

**Patterns to follow:** existing protected route middleware/policy patterns and repository user-domain conventions.

**Test scenarios:**
- Valid Coach login returns JWT and grants access to authorized coach features.
- Missing/invalid/expired token denies access to protected APIs and screens.
- SystemAdmin can create, update, deactivate users, and assign roles.
- Coach is denied user/role administration actions.
- Deactivated user authentication is blocked.

**Verification:** role-appropriate access is consistently enforced across dashboard, team/player, and clip-related protected surfaces.

---

## Phased delivery
### Phase 1 — Coach insight MVP
- Coaches-growth domain in first phase:
  - U1: data model and ingestion.
  - U2: coach player development dashboard.
- Internal JWT auth domain in first phase:
  - U6: internal JWT authentication and role administration.
  - U5: permissions and role boundaries.

### Phase 2 — Video capture and submission
- U3: situational clip capture and submission.
- U5: extend permissions for submission roles.

### Phase 3 — Assessment review and future exchange readiness
- U4: assessment result review experience.
- Reserve the coach exchange board and scout interest form for a later phase once the core coach workflow is validated.

## Dependencies
- Video storage and upload infrastructure.
- Asynchronous job or queue processing for assessment.
- AI assessment service integration.
- External report ingestion format documentation.

## Risks and mitigation
- Data quality risk: incomplete metrics may mislead coaches.
  - Mitigation: show missing values clearly, avoid over-aggregating incomplete inputs.
- Adoption risk: coaches may reject a complex dashboard.
  - Mitigation: keep the interface focused on quick scans and high-value trend signals.
- Video upload risk: large or unsupported clips may fail.
  - Mitigation: enforce clip limits, supported codecs, and clear validation.
- Scope creep risk: exchange and scout features could grow the project too large.
  - Mitigation: defer coach exchange and scout-interest features to a later phase.

## Assumptions and open questions
- Clips are short and purpose-specific, not full match recordings.
- AI assessment is asynchronous, not real-time.
- The first release focuses on internal coach workflows; scout-facing exchange is future work.
- The team will validate the coach dashboard with an early coaching group before adding exchange features.

Open questions
- What maximum clip length should the first version support?
- Which performance metrics are most valuable in the first release?
- Should the first release support one team or multiple teams/programs?
- Which skill dimensions should the AI assessment rate first?
- Should coaches be able to request an assessment at capture time, or only post-upload?
