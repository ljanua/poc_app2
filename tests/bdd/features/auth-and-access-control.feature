Feature: Authentication and role-based access control
  In order to protect platform actions
  As an authenticated user
  I want JWT and role checks to enforce access boundaries

  Background:
    Given the following users exist:
      | name        | email                 | role        | status   |
      | Maria Alves | maria@vantageiq.club  | SystemAdmin | active   |
      | Joao Lima   | joao@vantageiq.club   | Coach       | active   |
      | Ana Costa   | ana@vantageiq.club    | Coach       | inactive |

  Scenario: Coach receives JWT on successful login
    Given no token is currently active
    When user "joao@vantageiq.club" logs in with password "SecurePass123"
    Then the operation status should be 200
    And a JWT token should be issued

  Scenario: Expired token denies protected access
    Given I am authenticated as "Coach"
    And my token is expired
    When I request a protected resource
    Then the operation status should be 403
    And the API error code should be "forbidden"

  Scenario: Deactivated user cannot authenticate
    Given no token is currently active
    When user "ana@vantageiq.club" logs in with password "SecurePass123"
    Then the operation status should be 403
    And the API error code should be "forbidden"
    And the API error message should be "You do not have permission to perform this action."
