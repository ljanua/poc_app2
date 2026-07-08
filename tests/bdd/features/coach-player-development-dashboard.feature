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

  Scenario: Saving stats for a no-stats player clears the notice and shows the full dashboard
    When I open the development dashboard for player "New Recruit"
    Then the dashboard should show only the player identity card with no stats
    When I save player "New Recruit" with growth status "on_track", match minutes 120, and performance score 7.5
    Then the operation status should be 200
    When I open the development dashboard for player "New Recruit"
    Then the dashboard should show growth status "on_track"
    And the dashboard should show match minutes 120
    And the dashboard should show performance score 7.5
    And the dashboard should not show a missing data message

  Scenario: Saving with no ratings recorded keeps the no-stats notice
    When I open the development dashboard for player "New Recruit"
    Then the dashboard should show only the player identity card with no stats
    When I save player "New Recruit" with no development ratings recorded
    Then the operation status should be 200
    When I open the development dashboard for player "New Recruit"
    Then the dashboard should show missing data message "Performance metrics are not available yet."
    And the dashboard should show only the player identity card with no stats

  Scenario: Non-coach role cannot save player profile changes
    Given I am authenticated as "SystemAdmin"
    When I save player "New Recruit" with growth status "on_track", match minutes 120, and performance score 7.5
    Then the operation status should be 403
    And the API error code should be "forbidden"

  Scenario: Coach can compare two players side by side
    Given I open the development dashboard for player "Lionel Messi"
    When I compare with player "Cristiano Ronaldo"
    Then the comparison should include player "Lionel Messi"
    And the comparison should include player "Cristiano Ronaldo"

  Scenario: Uploading a player photo updates the avatar across surfaces
    Given I am authenticated as "Coach"
    And the following player development profiles exist:
      | player            | growthStatus | matchMinutes | performanceScore | trend     | missingData |
      | New Recruit       |             | 0            |                 | plateau   | all         |
    When I upload player "New Recruit" avatar with image data "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q=="
    Then the operation status should be 200
    And the player's avatar URL should be stored

  Scenario: Non-coach role is denied dashboard access
    Given I am authenticated as "SystemAdmin"
    When I open the development dashboard for player "Lionel Messi"
    Then the operation status should be 403
    And the API error code should be "forbidden"

  Scenario: Coach records a player's birth date and the dashboard shows the derived age
    Given the following player development profiles exist:
      | player      | growthStatus | matchMinutes | performanceScore | trend | missingData |
      | Birth Test  |              | 0            |                  | plateau | all         |
    When I save player "Birth Test" with birth month 3 and birth year 2005
    Then the operation status should be 200
    When I open the development dashboard for player "Birth Test"
    Then the dashboard should show birth month 3 and birth year 2005
    And the dashboard should show a derived age matching the recorded birth date

  Scenario: Saving only a birth month (partial pair) returns 400 validation_error
    Given the following player development profiles exist:
      | player      | growthStatus | matchMinutes | performanceScore | trend | missingData |
      | Birth Test  |              | 0            |                  | plateau | all         |
    When I save player "Birth Test" with birth month 3 and no birth year
    Then the operation status should be 400
    And the API error code should be "validation_error"
