# BDD Test Suite

This folder contains behavior-first BDD assets aligned to all features defined under docs/plans.

## Structure
- features/: Gherkin feature files
- steps/: Cucumber step definitions
- support/: world state and hooks

## Covered behavior
- SystemAdmin can create users, change roles, and change passwords.
- SystemAdmin can deactivate users and block subsequent login.
- Coach is forbidden from user-management operations.
- Duplicate-email and validation errors use consistent API error codes/messages.
- JWT login flow and protected-resource denial for expired or missing token.
- Deactivated users are denied login.
- Player list team filtering shows only players assigned to the selected team.
- Add Player flow supports typed name matching and team assignment updates.
- Coach dashboard shows growth, match time, performance, and trend direction.
- Missing development metrics are shown with explicit messaging.
- Clip submission validates format/length, queues assessment, and supports status filtering.
- Source-of-record flow covers strict move reassignment, confirmed create-on-no-match, and duplicate quick-action assign-existing.
- Role-aware team creation flow where Coach auto-assigns as lead coach.
- SystemAdmin can create teams by selecting active coaches and reassign coach ownership for any team.

## Suggested run command
From repository root:
- npm install
- npm run bdd:smoke
- npm run bdd:test

Run only admin feature:
- npm run bdd:test:admin

## credentials for demo and test
SystemAdmin
Email: maria@vantageiq.club
Password: SecurePass123

Coach
Email: joao@vantageiq.club
Password: SecurePass123