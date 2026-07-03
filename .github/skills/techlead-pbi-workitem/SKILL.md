---
name: techlead-pbi-workitem
description: >
  Use when generating the tasks (work items) from a PBI or change description.
  Produces three artifacts in order: (1) PBI technical notes with business rules,
  flow diagram, acceptance criteria, out-of-scope, dependencies, and DoD;
  (2) Developer implementation guide with step-by-step instructions and full code
  snippets; (3) Board tasks list with descriptions. 
  Triggers: "create work items"
---

---  This skill expects at least one PBI doc to be available at  `docs/WorkItems/` 

#   Dev Guide / Board Tasks Generator

## Language Rules

**ALL generated content must be in ENGLISH regardless of conversation language.**
- Markdown headings, descriptions, acceptance criteria, task titles: English only
- Code snippets: English only
- Even when the user writes in Portuguese, always output English documents

---

## Execution Workflow

Always produce **three artifacts in this exact order**:

```
1. PBI Document          → docs/WorkItems/PBI-<slug>.md
2. Developer Guide       → docs/WorkItems/DEV-GUIDE-<slug>.md
3. Board Tasks           → Shown inline in chat (not a file)
```

Where `<slug>` is a kebab-case summary of the feature (e.g., `add-requestpayment-validation-rules`).

---

## Step 0 — Context Gathering (MANDATORY before writing)

Before generating anything, read the following files to understand the codebase pattern used by the affected area. Read in parallel.

### For any API endpoint change or new endpoint

| File | Why |
|---|---|
| `src/Request.Api/Controllers/V1/*.cs` | Controller pattern |
| `src/Service.Request/Implementation/V1/*.cs` | Service template method pattern |
| `src/Data.Request/Repository/V1/*.cs` | Repository + SP call pattern |
| `src/Database/dbo/Stored Procedures/` | Pick the closest SP as template |

### For all PBIs

| File | Why |
|---|---|
| `src/Core.Api/Exceptions/*.cs` | Error response contract |
| `src/Core.Api/Exceptions/*.cs` | ErrorType enum values |
| `src/Core.Api/Exceptions/*.cs` | How exceptions are thrown |
| `docs/WorkItems/` | At least one existing PBI for style reference |

### Confirm before writing

- What HTTP endpoint is created or modified?
- What service method is added or changed?
- What DB tables/SPs are involved?
- What is the error response pattern for failures?
- Is this a **new endpoint** or a **modification of an existing one**?

---

## Artifact 1 — PBI Document

**File:** `docs/WorkItems/PBI-<slug>.md`

### Mandatory Sections (in this order)

```markdown
# PBI – <Title>

**Type:** User Story
**Endpoint affected:** <HTTP Method + path, or "N/A">

---

## Description

As a **<role>**, <user story in one paragraph>.
Include Stripe API reference if applicable (show the raw HTTP call).

### Business Rules

Bulleted list of named business rules.
- Each rule must be testable.
- Mark optional fields clearly.

---

## Flow

ASCII/text flow diagram showing the chain:
Controller → Service → [DB steps] → [Provider steps] → [DB steps]
Use └─►, ├─►, and indentation.

---

## Acceptance Criteria

One section per AC, numbered AC-1, AC-2, …
Each AC must include:
- The exact file path to create or modify.
- The exact class/method name.
- A table for new contracts (field | type | required | description).
- Code block for new or modified signatures where relevant.

---

## Error Response Contract

Show JSON example of the `ApiError` structure returned on failure.
Include the `detail` field with the specific message.

---

## Out of Scope

Bulleted list. Be specific.

---

## Dependencies

Table: Dependency | Detail

---

## Definition of Done

Checkbox list aligned with the ACs.
```

### PBI Quality Rules

- Every acceptance criterion must reference an **exact file path**.
- Business validation failures return `400 Bad Request` with `ApiError` and a named error code constant.
- Provider (Stripe) failures return `502 Bad Gateway`.
- All new fields are **opt-in** (nullable or defaulted) unless the business rule requires them — document this explicitly.
- Include the `CorrelationId` pattern: auto-generated as GUID if not provided.

---

## Artifact 2 — Developer Implementation Guide

**File:** `docs/WorkItems/DEV-GUIDE-<slug>.md`

### Mandatory Sections (in this order)

```markdown
# Developer Implementation Guide – <Title>

**PBI:** <PBI title>
**Endpoint:** <HTTP method + path>
**Estimated files:** X created, Y modified

---

## Prerequisites

Table of files to read BEFORE writing any code, with a "Why" column.

---

## Implementation Order

Single line: DB → Data contracts → Repository → [Error codes] → Service → API contracts → Controller → DI → Tests

---

## Step N — <Layer name>: <Action>

For each step:
- State the file path to CREATE or MODIFY.
- Provide FULL code snippets (no placeholders like "// existing code").
- Call out the exact insertion point (e.g., "before _repo.CreateAsync(...)").
- Add a "Note:" when the snippet requires adjustment based on an interface
  the developer must verify first.

Steps follow the Implementation Order above.
Last two steps are always:
- DI Registration
- Tests (controller tests + service tests)

---

## Files Summary

Table: Action (Create/Modify) | File path
```

### Dev Guide Quality Rules

- Code must compile — use actual class names found in the codebase, not invented ones.
- Use the **constructor primary parameter** syntax (C# 12) matching existing files.
- SP calls use `SqlParameter[]` arrays matching `PaymentIntentRepository` pattern.
- Validation failures throw `CustomHttpRequestException(HttpStatusCode.BadRequest)` with `Data["ErrorCode"]` populated.
- Always note that the developer must verify `IFastStoredProcedureExecutor` method signatures before finalizing repo code.
- Inform which **existing tests must be updated** when a constructor changes (e.g., add NSubstitute substitute for new dependency).

---

## Artifact 3 — Board Tasks

**Format:** Inline in chat (never a file). **Minimum 10, maximum 15 tasks.**

### Task Template

```
### Task N — <Short imperative title>

**Type:** Development | Testing | Database
**Estimate:** Xh

<2-3 sentence description. Must include:>
- The exact file to create or modify.
- The specific class, method, or SP to change.
- The expected outcome (what passes/works after this task is done).
```

### Mandatory Task Coverage

Every PBI must generate tasks that cover ALL of the following areas (merge or split as needed):

| Area | Typical task count |
|---|---|
| SSDT stored procedure(s) | 1 per SP |
| Data contracts (result/params DTOs) | 1 |
| Repository interface + implementation | 1-2 |
| Error codes constants class | 1 |
| API request/response contracts | 1 |
| Service implementation (business logic) | 1-2 |
| Controller creation or modification | 1 |
| DI registration | 1 |
| Unit tests — service | 1 |
| Unit tests — controller | 1 |
| Existing tests update (if constructor changed) | 1 (only if needed) |
| QA / integration / end-to-end | 1 |

---

## PaymentHub Architectural Patterns (Reference)

These patterns MUST be reflected in all generated code snippets.

### Service Template (BasePaymentService)

```
BasePaymentService<TResult, TContext>
  └─► InitializeAsync(input, ...) → TContext
  └─► ExecuteAsync(context, ...)
        ├─► RegisterRequestAsync     ← DB insert + validation guard
        ├─► BuildProviderRequest
        ├─► RegisterAuditOutRequestAsync
        ├─► CallProviderAsync        ← Stripe HTTP call
        ├─► HandleSuccessAsync       ← DB outcome + audit
        └─► HandleFailureAsync       ← throws CustomHttpRequestException(502)
```

Insert **business validation** in `RegisterRequestAsync`, before the DB insert call.  
Pattern: `if (!string.IsNullOrWhiteSpace(context.Field)) { var result = await _repo.ValidateAsync(...); if (!result.IsValid) throw ... }`

### Error Handling Pattern

```csharp
// Business validation (400)
throw new CustomHttpRequestException(System.Net.HttpStatusCode.BadRequest)
{
    Data =
    {
        ["ErrorCode"]     = errorCode,
        ["ErrorMessage"]  = errorMessage,
        ["CorrelationId"] = context.CorrelationId
    }
};

// Provider failure (502) — already in BasePaymentService.HandleFailureAsync
```

### Repository SP Pattern

```csharp
SqlParameter[] parameters =
[
    new("@ParamName", SqlDbType.VarChar, 100) { Value = value },
    new("@Amount",    SqlDbType.Decimal)      { Value = amount, Precision = 12, Scale = 2 },
    new("@OutputId",  SqlDbType.Int)          { Direction = ParameterDirection.Output }
];
```

### SQL SP Pattern

```sql
CREATE PROCEDURE [dbo].[ProcedureName]
(
    @Param1 VARCHAR(100),
    @OutputId INT OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        -- logic
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
```

Read-only SPs (SELECT only): omit `SET XACT_ABORT ON`, `BEGIN TRANSACTION`, and `TRY/CATCH`.

### Error Code Pattern

```csharp
// src/Service.Request/Helpers/<Feature>ErrorCodes.cs
public static class <Feature>ErrorCodes
{
    public const string NotFound     = "<FEATURE>_NOT_FOUND";
    public const string InvalidState = "<FEATURE>_INVALID_STATE";
    // etc.
}
```

Error code strings must **exactly match** values returned by the corresponding SP.

### DI Registration (scoped)

```csharp
// src/Request.Api/Extensions/DependencyInjectionExtension.cs
_ = services.AddScoped<IMyRepository, MyRepository>();
```

### Test Patterns

| Project | Framework | Style |
|---|---|---|
| `Service.Request.Test` | xUnit + NSubstitute + Bogus | `Substitute.For<IInterface>()` |
| `Presentation.Request.Test` | xUnit + Moq | `new Mock<IInterface>(MockBehavior.Strict)` |

Test naming: `<MethodName><Scenario><ExpectedResult>` (PascalCase, no underscores).

---

## Example Outputs (Reference)

Existing PBIs and guides generated with this skill:

| Feature | PBI | Guide |
|---|---|---|
| Settlement event feed to Workday | `docs/WorkItems/GenerateSettlementWorkday/PBI-settlement-event-feed-workday.md` | `docs/WorkItems/GenerateSettlementWorkday/DEV-GUIDE-settlement-event-feed-workday.md` |
| Workday accept settlement event | `docs/WorkItems/WorkdayAcceptSettlement/PBI-workday-accept-settlement-event.md` | — |
| Implement RequestRefund API | `docs/WorkItems/ImplementRequestRefundAPI/PBI-implement-request-refund-api.md` | `docs/WorkItems/ImplementRequestRefundAPI/DEV-GUIDE-implement-request-refund-api.md` |
| Add RequestPayment validation rules | `docs/WorkItems/PBI-add-requestpayment-validation-rules.md` | `docs/WorkItems/DEV-GUIDE-add-requestpayment-validation-rules.md` |

Read one of these before generating to calibrate tone, depth, and section length.

---

## Quality Checklist (run before finalizing each artifact)

**PBI:**
- [ ] Every AC references an exact file path
- [ ] All error codes are named constants (not inline strings)
- [ ] Flow diagram reflects actual PaymentHub layers
- [ ] DoD checkbox list is complete and testable
- [ ] Out of Scope is explicit (no ambiguity)

**Dev Guide:**
- [ ] Steps follow DB → Data → Repository → Service → API → Controller → DI → Tests
- [ ] All code snippets use real class names from the codebase
- [ ] Existing test files that need updating are called out explicitly
- [ ] `IFastStoredProcedureExecutor` usage has a verification note
- [ ] Files summary table is complete

**Tasks:**
- [ ] Minimum 10 tasks
- [ ] Every task has a file path, class/SP name, and expected outcome
- [ ] One QA/integration task at the end
- [ ] Estimates are realistic (0.5h–3h range)
