Feature: Coach player development dashboard
  In order to review player progress in one place
  As a Coach
  I want to see growth, match time, and performance trends with clear handling for missing data

  Background:
    Given I am authenticated as "Coach"
    And the following player development profiles exist:
      | player            | growthStatus | matchMinutes | performanceScore | trend       | missingData |
      | Lionel Messi      | on_track     | 540          | 8.8              | improving   | none        |
      | Cristiano Ronaldo | watch        | 420          | 7.1              | declining   | none        |
      | Neymar Jr         | at_risk      | 0            |                  | plateau     | performance |
      | New Recruit       |              | 0            |                  | plateau     | all         |
    And the following metric change indicators exist:
      | player            | metric        | label  | trend     |
      | Lionel Messi      | currentLevel  | Up 5%  | improving |
      | Lionel Messi      | fitness       | Stable | plateau   |
      | Lionel Messi      | skillProgress | Up 3%  | improving |

  Scenario: Coach opens a player profile and sees growth, match time, and performance
    When I open the development dashboard for player "Lionel Messi"
    Then the operation status should be 200
    And the dashboard should show growth status "on_track"
    And the dashboard should show match minutes 540
    And the dashboard should show performance score 8.8

  Scenario: Dashboard trend indicator reflects latest data direction
    When I open the development dashboard for player "Cristiano Ronaldo"
    Then the dashboard should show trend indicator "declining"

  Scenario: Development metrics show real per-metric change indicators instead of static badges
    When I open the development dashboard for player "Lionel Messi"
    Then the dashboard should show metric change for "currentLevel" with label "Up 5%" and trend "improving"
    And the dashboard should show metric change for "fitness" with label "Stable" and trend "plateau"
    And the dashboard should show metric change for "skillProgress" with label "Up 3%" and trend "improving"

  Scenario: Missing metrics are shown clearly
    When I open the development dashboard for player "Neymar Jr"
    Then the dashboard should show missing data message "Performance metrics are not available yet."

  Scenario: Player with no recorded stats shows identity card only, never another player's borrowed data
    When I open the development dashboard for player "New Recruit"
    Then the operation status should be 200
    And the dashboard should show missing data message "Performance metrics are not available yet."
    And the dashboard should show only the player identity card with no stats

  Scenario: Coach can compare two players side by side
    Given I open the development dashboard for player "Lionel Messi"
    When I compare with player "Cristiano Ronaldo"
    Then the comparison should include player "Lionel Messi"
    And the comparison should include player "Cristiano Ronaldo"

  Scenario: Non-coach role is denied dashboard access
    Given I am authenticated as "SystemAdmin"
    When I open the development dashboard for player "Lionel Messi"
    Then the operation status should be 403
    And the API error code should be "forbidden"
