Feature: Player list team filter and add-player picker
  In order to manage squads quickly
  As a Coach
  I want the team filter to show assigned players only and add players with a name-matching dropdown

  Background:
    Given the following players are assigned to teams:
      | name              | team         |
      | Lionel Messi      | U19 Prime    |
      | Cristiano Ronaldo | Senior Squad |
      | Neymar Jr         | U17 Elite    |
      | Kylian Mbappe     | Senior Squad |
    And the player catalog includes:
      | name              |
      | Lionel Messi      |
      | Cristiano Ronaldo |
      | Neymar Jr         |
      | Kylian Mbappe     |
      | Erling Haaland    |

  Scenario: Team filter only shows players assigned to the selected team
    When I select team "Senior Squad"
    Then visible players should be:
      | name              |
      | Cristiano Ronaldo |
      | Kylian Mbappe     |

  Scenario: Add player from partial-name dropdown match
    Given I select team "Senior Squad"
    When I type player lookup "ney"
    Then matching suggestions should include:
      | name      |
      | Neymar Jr |
    When I add player "Neymar Jr" to the selected team
    Then team "Senior Squad" should include player "Neymar Jr"
    And team "U17 Elite" should not include player "Neymar Jr"

  Scenario: No matching suggestion blocks add action
    Given I select team "U19 Prime"
    When I type player lookup "zzz"
    Then there should be no matching suggestions
    When I try to add from current lookup
    Then add operation should be rejected with message "Choose a player from the dropdown matches."
