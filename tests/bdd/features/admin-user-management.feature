Feature: SystemAdmin manages users and credentials
  In order to operate user access safely
  As a SystemAdmin
  I want to create users, change roles, and change passwords with strict authorization and validation

  Background:
    Given the following users exist:
      | name        | email                 | role        | status |
      | Maria Alves | maria@vantageiq.club  | SystemAdmin | active |
      | Joao Lima   | joao@vantageiq.club   | Coach       | active |

  Scenario: SystemAdmin creates a new Coach user
    Given I am authenticated as "SystemAdmin"
    When I create a user with name "Daniel Rocha", email "daniel@vantageiq.club", role "Coach", and password "SecurePass123"
    Then the operation status should be 201
    And the response should include user "daniel@vantageiq.club" with role "Coach"

  Scenario: SystemAdmin changes user role from Coach to SystemAdmin
    Given I am authenticated as "SystemAdmin"
    When I change role for email "joao@vantageiq.club" to "SystemAdmin"
    Then the operation status should be 200
    And the response should include user "joao@vantageiq.club" with role "SystemAdmin"

  Scenario: SystemAdmin password change fails policy validation
    Given I am authenticated as "SystemAdmin"
    When I change password for email "joao@vantageiq.club" to "weak" and confirm "weak"
    Then the operation status should be 400
    And the API error code should be "validation_error"
    And the API error message should be "Please review the form fields and try again."

  Scenario: Coach is forbidden from creating users
    Given I am authenticated as "Coach"
    When I create a user with name "Blocked User", email "blocked@vantageiq.club", role "Coach", and password "SecurePass123"
    Then the operation status should be 403
    And the API error code should be "forbidden"
    And the API error message should be "You do not have permission to perform this action."

  Scenario: SystemAdmin cannot create duplicate email
    Given I am authenticated as "SystemAdmin"
    When I create a user with name "Maria Duplicate", email "maria@vantageiq.club", role "Coach", and password "SecurePass123"
    Then the operation status should be 409
    And the API error code should be "conflict"
    And the API error message should be "A user with the same identifier already exists."

  Scenario: SystemAdmin deactivates a user and login is blocked
    Given I am authenticated as "SystemAdmin"
    When I deactivate user with email "joao@vantageiq.club"
    Then the operation status should be 200
    And the response should include user "joao@vantageiq.club" with status "inactive"
    Given no token is currently active
    When user "joao@vantageiq.club" logs in with password "SecurePass123"
    Then the operation status should be 403
    And the API error code should be "forbidden"
