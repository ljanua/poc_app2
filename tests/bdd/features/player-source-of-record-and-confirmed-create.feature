Feature: PostgreSQL-backed player source of record and confirmed add-player flow
  In order to keep player assignment durable and consistent across pages
  As a Coach
  I want strict move reassignment, duplicate quick-action, and explicit confirmed create-on-no-match

  Background:
    Given I am authenticated as "Coach"
    And the following teams exist in source of record:
      | id | name         |
      | 1  | U19 Prime    |
      | 2  | Senior Squad |
      | 3  | U17 Elite    |
    And the following players exist in source of record:
      | id | name              | normalizedName     | team         |
      | 10 | Lionel Messi      | lionel messi       | U19 Prime    |
      | 11 | Cristiano Ronaldo | cristiano ronaldo  | Senior Squad |
      | 12 | Neymar Jr         | neymar jr          | U17 Elite    |

  Scenario: Team-scoped read returns only assigned players for selected team
    When I read players for team "Senior Squad" from source of record
    Then visible players should be:
      | name              |
      | Cristiano Ronaldo |

  Scenario: No-match create requires explicit confirmation and preview
    Given I prepare add-player lookup "  Lamine   Yamal  " for team "U19 Prime"
    When I preview no-match create confirmation
    Then the confirmation preview should show team "U19 Prime"
    And the confirmation preview should show normalized player name "Lamine Yamal"
    When I submit no-match create without explicit confirmation
    Then the operation status should be 400
    And the API error code should be "validation_error"
    When I confirm no-match create explicitly
    And I submit confirmed no-match create
    Then the operation status should be 201
    And team "U19 Prime" should include player "Lamine Yamal"

  Scenario: Duplicate detection returns assign-existing quick-action
    Given I prepare add-player lookup "  lionel    messi " for team "Senior Squad"
    When I submit confirmed no-match create
    Then the operation status should be 409
    And the duplicate quick-action should target existing player "Lionel Messi"
    When I assign existing matched player from duplicate quick-action
    Then the operation status should be 200
    And team "Senior Squad" should include player "Lionel Messi"
    And team "U19 Prime" should not include player "Lionel Messi"

  Scenario: Invalid new player name is rejected by minimum validation rules
    Given I prepare add-player lookup "x" for team "U19 Prime"
    When I preview no-match create confirmation
    Then the operation status should be 400
    And the API error code should be "validation_error"

  Scenario: Same-team reassignment is treated as no-op with clear feedback
    When I strictly move player "Cristiano Ronaldo" to team "Senior Squad"
    Then the operation status should be 200
    And the move operation message should be "Player is already assigned to this team."
