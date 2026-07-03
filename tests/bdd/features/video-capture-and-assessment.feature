Feature: Situational video capture and assessment review
  In order to evaluate player skills from real moments
  As a Coach
  I want to submit clips for asynchronous assessment and review results reliably

  Background:
    Given I am authenticated as "Coach"
    And clip upload supports formats:
      | format |
      | mp4    |
      | mov    |
      | webm   |
    And maximum clip length in seconds is 120

  Scenario: Coach submits a valid clip and receives queued status
    When I submit a clip with filename "messi-turn.mp4", player "Lionel Messi", situation "1v1 dribble", and length 45
    Then the operation status should be 202
    And the clip submission status should be "queued"

  Scenario: Unsupported clip format is rejected
    When I submit a clip with filename "messi-turn.avi", player "Lionel Messi", situation "1v1 dribble", and length 45
    Then the operation status should be 400
    And the API error code should be "validation_error"

  Scenario: Assessment result becomes available for a submitted clip
    Given I submit a clip with filename "messi-shot.mp4", player "Lionel Messi", situation "finishing", and length 30
    When assessment is completed for the latest clip with summary "Strong decision speed" and score 8.7
    Then the latest clip review should show status "assessed"
    And the latest clip review should show summary "Strong decision speed"

  Scenario: Review list can be filtered by player and status
    Given the following assessed clips exist:
      | id | player            | status   | summary                    |
      | 1  | Lionel Messi      | assessed | Quick footwork and balance |
      | 2  | Neymar Jr         | pending  |                            |
      | 3  | Lionel Messi      | assessed | Accurate first touch       |
    When I filter clip review list by player "Lionel Messi" and status "assessed"
    Then review list should include clip ids:
      | id |
      | 1  |
      | 3  |

  Scenario: Failed assessment displays clear support message
    Given I submit a clip with filename "neymar-sprint.mp4", player "Neymar Jr", situation "transition", and length 25
    When assessment fails for the latest clip
    Then the latest clip review should show status "failed"
    And the clip action message should be "Assessment failed. Try again or contact support."
