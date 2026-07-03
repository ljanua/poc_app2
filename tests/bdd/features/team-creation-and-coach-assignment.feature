Feature: Team creation and coach assignment by role
  In order to keep team ownership correct in the source of record
  As a Coach or SystemAdmin
  I want role-aware team creation and SystemAdmin coach reassignment controls

  Background:
    Given the following users exist:
      | name        | email                 | role        | status   |
      | Maria Alves | maria@vantageiq.club  | SystemAdmin | active   |
      | Joao Lima   | joao@vantageiq.club   | Coach       | active   |
      | Ana Costa   | ana@vantageiq.club    | Coach       | inactive |
      | Bruno Silva | bruno@vantageiq.club  | Coach       | active   |
    And the following teams with lead coaches exist:
      | name         | ageGroup | leadCoachEmail        |
      | U17 Elite    | U17      | joao@vantageiq.club   |
      | U19 Prime    | U19      | bruno@vantageiq.club  |
      | Senior Squad | 18+      | maria@vantageiq.club  |

  Scenario: Coach creates team and is auto-assigned as lead coach
    Given I am authenticated as "Coach" with email "joao@vantageiq.club"
    When I create a team named "U15 Rising" in age group "U15"
    Then the operation status should be 201
    And team "U15 Rising" should have lead coach email "joao@vantageiq.club"

  Scenario: SystemAdmin creates team selecting an active coach
    Given I am authenticated as "SystemAdmin" with email "maria@vantageiq.club"
    When I create a team named "U16 Select" in age group "U16" selecting coach email "bruno@vantageiq.club"
    Then the operation status should be 201
    And team "U16 Select" should have lead coach email "bruno@vantageiq.club"

  Scenario: SystemAdmin reassigns coach for an existing team
    Given I am authenticated as "SystemAdmin" with email "maria@vantageiq.club"
    When I reassign team "U17 Elite" to coach email "bruno@vantageiq.club"
    Then the operation status should be 200
    And team "U17 Elite" should have lead coach email "bruno@vantageiq.club"

  Scenario: Inactive coach selection is rejected and team ownership remains unchanged
    Given I am authenticated as "SystemAdmin" with email "maria@vantageiq.club"
    When I reassign team "U19 Prime" to coach email "ana@vantageiq.club"
    Then the operation status should be 400
    And the API error code should be "validation_error"
    And team "U19 Prime" should have lead coach email "bruno@vantageiq.club"

  Scenario: Coach is forbidden from reassigning any team coach
    Given I am authenticated as "Coach" with email "joao@vantageiq.club"
    When I reassign team "U17 Elite" to coach email "bruno@vantageiq.club"
    Then the operation status should be 403
    And the API error code should be "forbidden"

  Scenario: Team read reflects persisted coach assignment after create and reassign
    Given I am authenticated as "SystemAdmin" with email "maria@vantageiq.club"
    When I create a team named "U20 Elite" in age group "U20" selecting coach email "joao@vantageiq.club"
    And I reassign team "U20 Elite" to coach email "bruno@vantageiq.club"
    And I list teams from source of record
    Then listed teams should include:
      | name      | leadCoachEmail       |
      | U20 Elite | bruno@vantageiq.club |

  Scenario: Unauthenticated actor cannot create a team
    Given no token is currently active
    When I create a team named "U14 New" in age group "U14"
    Then the operation status should be 403
    And the API error code should be "forbidden"
