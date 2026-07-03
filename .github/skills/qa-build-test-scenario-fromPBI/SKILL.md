# Test Scenarios Generation Instruction file (UI and API)

## Purpose
This document provides instructions for generating test scenarios in Gherkin format for a specific Product Backlog Item (PBI).

## Inputs
Use GitHub Copilot (Agent Mode) and choose one of the following options to provide the required inputs:

### Option 1
1. Manually retrieve the **Description** and **Acceptance Criteria** from Azure DevOps (ADO) using the **PBI number**.
2. Copy and paste these details into the prompt.
3. Run the prompt in GitHub Copilot to generate the Gherkin test scenarios.

### Option 2
1. Given a user is having valid **PAT (Personal Access Token)** and the **PBI number**.
2. GitHub Copilot will connect to ADO using **PAT** and automatically retrieve the **Description** and **Acceptance Criteria** for the specified PBI.
3. Run the prompt in GitHub Copilot using above information mentioned in points 1 and 2 to generate the Gherkin test scenarios.

## Additional Information
For detailed prompt templates and usage examples, refer to the following SharePoint document:

https://rydertruck.sharepoint.com/sites/EnterpriseQATesting/SitePages/Test-scenarios-generation-instruction-file.aspx


## Outputs
- A single Gherkin `.feature` file (UTF-8) containing both UI and API scenarios named:  
  `Feature_<PBI_NUMBER>.feature`

## Constraints & Guardrails
- **Framework:** Gherkin + SpecFlow conventions.
- **Coverage:** Include positive, negative, boundary, and meaningful edge cases.
- **Techniques:** Equivalence partitioning, boundary value analysis, decision tables, state transitions, and use case testing, **as applicable**.
- **Data-Driven:** Use `Scenario Outline` and `Examples` for multi-dataset cases.
- **Clarity:** Descriptive scenario titles; precise Given/When/Then.
- **Reusability:** Keep steps generic enough to enable reuse across features.
- **Consistency:** Match acceptance criteria faithfully. Avoid adding behavior not implied by ACs.
- **Tags:** Introduce tags like `@ui`, `@api`, `@negative`, `@edge` as appropriate.

## Deterministic Procedure
1. **Fetch ACs:** Call Azure DevOps Work Item API to get Acceptance Criteria for `PBI_NUMBER`. Normalize bullets, tables, and checklists into a structured list of requirements.
2. **Derive Behaviors:** From ACs, enumerate **intended behaviors** and **constraints**; identify **inputs**, **preconditions**, **state**, **transitions**, and **expected outcomes**.
3. **Test Design:** For each behavior/constraint:
   - Create **positive** scenario(s).
   - Create **negative** scenario(s) (invalid inputs, forbidden state transitions).
   - Add **boundary** or **edge** scenario(s) where inputs or limits exist.
   **Techniques:** Equivalence partitioning, boundary value analysis, decision tables, state transitions, and use case testing, **as applicable**.
   - Consider decision-table coverage when rules combine.
4. **Consolidate Data-Driven Cases:** Convert similar scenarios into `Scenario Outline` with an `Examples` table.
5. **Tagging:** Tag scenarios by layer (`@ui`/`@api`), type (`@positive`, `@negative`, `@edge`) and feature domain tags as needed.
6. **Lint Gherkin:** Validate syntax (Given/When/Then), no duplicates, consistent phrasing, compile for readability.
7. **Output File:** Emit one `.feature` with clear `Feature:` and (optional) `Background:` for shared preconditions.

## Example (abbreviated)
```gherkin
Feature: Account lockout after failed logins (PBI-12345)
  As a user security stakeholder
  I want the system to lock accounts after failed attempts
  So that brute force attacks are mitigated

  @ui @positive
  Scenario: Lockout after N failed attempts
    Given a user "alpha" exists and is active
    And the maximum failed attempts is 5
    When the user "alpha" attempts to login with invalid credentials 5 times
    Then the account for "alpha" becomes locked
    And a lockout message is displayed

  @ui @negative @boundary
  Scenario Outline: Failed attempts below lock threshold do not lock account
    Given a user "<username>" exists and is active
    And the maximum failed attempts is <maxAttempts>
    When the user "<username>" attempts to login with invalid credentials <failedAttempts> times
    Then the account for "<username>" remains unlocked
    And a remaining-attempts message is displayed

    Examples:
      | username | maxAttempts | failedAttempts |
      | alpha    | 5           | 1              |
      | alpha    | 5           | 4              |

## Below example is only for GET API

  @api @positive
  Scenario Outline: API correcly returns line item count
    Given User pass resource path "<ResourcePathForFlow>"
    And User set the request headers "<HeaderValues>" 
    When User submit the "<MethodForLogin>" request
    Then User should get "<ResponseStatusCode>" as status code in the response
    Then User verify number of Lineitem "<ExpectedLineItemCount>" in the response

    Examples:
      |  ResourcePathForFlow | HeaderValues          | MethodForLogin | ResponseStatusCode | ExpectedLineItemCount |
      |  /flow1              | application/json      | GET           | 200                | 3                     |
      |  /flow2              | application/json      | GET           | 200                | 5                     |
