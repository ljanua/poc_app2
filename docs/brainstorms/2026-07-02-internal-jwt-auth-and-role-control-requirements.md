---
date: 2026-07-02
topic: internal-jwt-auth-and-role-control
---

# Internal JWT Authentication and Role Control

## Summary
Add internal authentication and authorization for the coach platform using JWT and two roles: SystemAdmin and Coach. SystemAdmin manages users and role assignment. Coach can access player/team/video workflows but cannot manage users.

---

## Problem Frame
Access control is currently not defined as a first-class product capability for internal operations. Without explicit authentication and role boundaries, planning and implementation risk inconsistent access behavior across dashboards, team management, and video workflows.

---

## Key Decisions
- Internal identity only for v1. No external identity provider integration is required in this release.
- Two-role model for v1: SystemAdmin and Coach.
- User and role administration is restricted to SystemAdmin.
- JWT access tokens are short-lived and v1 does not include refresh-token flow.
- The first SystemAdmin account is seeded through deployment/configuration, not self-service bootstrap.

---

## Actors
- A1. SystemAdmin
  - Creates, updates, and deactivates users.
  - Assigns role access.
  - Accesses all coach-facing product capabilities.
- A2. Coach
  - Authenticates and accesses authorized product features.
  - Uses player, team, dashboard, and video assessment capabilities.
  - Cannot create, edit, or assign users/roles.

---

## Requirements

**Authentication and session access**
- R1. The system must require authenticated login before accessing protected product features.
- R2. The system must issue a JWT access token after successful authentication.
- R3. The JWT access token must be short-lived and v1 must not require refresh tokens.
- R4. Access to protected routes and actions must be denied when the token is missing, invalid, or expired.

**Authorization and roles**
- R5. The system must support at least two roles: SystemAdmin and Coach.
- R6. The system must enforce role-based authorization on protected routes and actions.
- R7. SystemAdmin must be authorized to manage users and role assignments.
- R8. Coach must be prohibited from user and role administration actions.

**User lifecycle and bootstrap**
- R9. The first SystemAdmin account must be created through deployment/configuration bootstrap.
- R10. User management capabilities in v1 must include create, update, deactivate, and role assignment for SystemAdmin.
- R11. Deactivated users must not be able to authenticate or access protected features.

---

## Key Flows
- F1. Coach login and authorized access
  - **Trigger:** Coach submits valid credentials.
  - **Actors:** A2.
  - **Steps:** System validates credentials, issues JWT, and grants access only to Coach-authorized features.
  - **Outcome:** Coach can use player/team/dashboard/video capabilities but cannot manage users.

- F2. SystemAdmin user provisioning
  - **Trigger:** SystemAdmin creates a new user account.
  - **Actors:** A1.
  - **Steps:** SystemAdmin creates user, assigns role, and saves active status.
  - **Outcome:** New user can authenticate with permissions tied to assigned role.

- F3. Unauthorized access attempt
  - **Trigger:** Authenticated user attempts an action outside role permissions or token is invalid/expired.
  - **Actors:** A1, A2.
  - **Steps:** Authorization check fails and action is blocked.
  - **Outcome:** Protected action is not executed.

---

## Acceptance Examples
- AE1.
  - **Covers R2, R3, R4.**
  - **Given:** A valid Coach account.
  - **When:** The Coach logs in and later uses an expired token on a protected endpoint.
  - **Then:** Login returns a JWT, and expired-token access is denied.

- AE2.
  - **Covers R6, R7, R8.**
  - **Given:** A Coach account and a SystemAdmin account are both authenticated.
  - **When:** Both attempt to open user management actions.
  - **Then:** SystemAdmin is allowed and Coach is denied.

- AE3.
  - **Covers R10, R11.**
  - **Given:** SystemAdmin deactivates a user.
  - **When:** The deactivated user attempts to log in.
  - **Then:** Authentication fails and access is denied.

---

## Success Criteria
- Coaches and SystemAdmin users can authenticate through internal login and receive role-appropriate access.
- User and role administration is fully restricted to SystemAdmin in v1.
- Unauthorized role actions and expired/invalid token access are consistently blocked across protected features.

---

## Scope Boundaries
### Deferred for later
- Password reset workflows.
- Account lockout and advanced brute-force protections.
- Refresh-token lifecycle and token rotation.
- Audit log UI and session-revocation UI.
- External identity provider integration.

### Outside this release
- Coach-managed user administration.

---

## Dependencies / Assumptions
- Internal credential storage and validation are available in the product backend.
- Environment/deployment process can securely seed the initial SystemAdmin account.
- Existing player/team/video features are integrated behind the same protected access model.

---

## Outstanding Questions
### Resolve Before Planning
- OQ1. What exact access-token lifetime should v1 use?
- OQ2. What is the canonical logout behavior expectation for token invalidation in v1?

### Deferred to Planning
- OQ3. What minimum password policy should be enforced in v1?

---

## Sources / Research
- docs/brainstorms/2026-07-01-coaches-growth-match-time-performance-requirements.md
- docs/brainstorms/2026-07-02-situational-video-assessment-requirements.md
- docs/plan/scope/project-scope-plan.md
- docs/plans/2026-07-02-001-feat-coach-player-development-plan.md
