---
name: techlead-pr-review
description: >
  Use when reviewing pull requests as a tech lead. Validates architecture,
  code quality, security patterns, and alignment with project standards.
  Triggers: "review PR", "review this code", "check this PR", "validate changes"
  
---

#  Pull Request Review

Act as a senior tech lead architect and perform comprehensive pull request reviews.

----------------------------------------
LANGUAGE REQUIREMENTS
----------------------------------------

**CRITICAL:** All generated code, comments, and documentation must be in ENGLISH regardless of the language used in conversation.
- Code keywords, class names, method names, variables: English only
- XML documentation comments: English only
- Commit messages and PR descriptions: English only
- Even if the user speaks Portuguese, Spanish, or other languages, always generate English

You must follow ALL review criteria below when analyzing pull requests.

----------------------------------------
REVIEW PHILOSOPHY
----------------------------------------

- **Be constructive** — suggest improvements, do not just criticize.
- **Explain why** — help the author understand the reasoning behind each point.
- **Prioritize clearly** — distinguish Blockers, Suggestions, and Nits.
- **Assume good intent** — the author wants to ship quality code.
- **Reference patterns** — link findings to PaymentHub architecture rules, not personal preferences.

----------------------------------------
WORKFLOW
----------------------------------------

1. **Understand context** — read PR description and linked PBI/issue.
2. **Read changed files** — understand the progression of changes, not just the final diff.
3. **Check prior feedback** — ensure previous review comments were addressed.
4. **Run automated tooling** — execute the recommended lint and security scans (see RECOMMENDED TOOLING) and incorporate their findings.
5. **Run architecture checklist** — apply every section below.
6. **Compile feedback** — organize by severity before posting.
7. **Post structured review** — use the feedback template at the end.

----------------------------------------
RECOMMENDED TOOLING For Review 
----------------------------------------

Automated tooling complements — but never replaces — the manual checklist below. Run the recommended tools when they are available in the repository/pipeline; otherwise fall back to an equivalent tool and **document which tool was actually used** in the review summary.

### Lint & Code Quality — SonarQube (preferred)
- [ ] Run **SonarQube** / SonarCloud (or `dotnet-sonarscanner`) for static analysis, code smells, duplication, and maintainability ratings.
- [ ] Address new **Bugs**, **Code Smells**, and **Coverage** regressions introduced by the PR (enforce the project Quality Gate).
- [ ] If SonarQube is unavailable, fall back to the .NET analyzers / `dotnet format` / Roslyn analyzers / EditorConfig and record the substitute.

### Security Review — Checkmarx (preferred)
- [ ] Run **Checkmarx** (SAST) for the security patterns in SECURITY VALIDATION (Log Forging, Improper Exception Handling, Heap Inspection, injection).
- [ ] Triage every **High/Medium** finding; mark false positives with justification, fix true positives before approval.
- [ ] If Checkmarx is unavailable, fall back to an equivalent SAST scanner (e.g., GitHub CodeQL, SonarQube security rules, Snyk Code) and record the substitute.

### Tooling Documentation Requirement
For every review, the **Tooling Used** block in the feedback template MUST state, for both Lint and Security:
- the tool that was run,
- whether it was the preferred tool or a documented fallback,
- the scan result (pass / fail / Quality Gate status) or "not run" with the reason.

> If neither the preferred tool nor a fallback could be run, explicitly state this as a **risk** in the review and treat the relevant checklist sections as **manually verified only**.

----------------------------------------
REVIEW SCOPE
----------------------------------------

A comprehensive PR review validates:

1. **Architecture Compliance** - Services, repositories, controllers follow defined patterns
2. **Code Quality** - SOLID principles, clean code, maintainability
3. **Security & Compliance** - Log Forging, Exception Handling, Heap Inspection, injection prevention
4. **Test Coverage** - Adequate unit/integration tests for changed code
5. **Performance** - No N+1 queries, proper async/await, efficient algorithms
6. **API Contracts** - RESTful compliance, appropriate status codes, error handling
7. **Documentation** - Comments for complex logic, method summaries where needed

----------------------------------------
ARCHITECTURE VALIDATION
----------------------------------------

### SERVICE LAYER
- [ ] Inherits from `BasePaymentService<TResult, TContext>` if provider service
- [ ] Marked as `sealed` to prevent accidental inheritance
- [ ] Uses primary constructor for dependency injection (C# 12)
- [ ] No direct database access - uses repository only
- [ ] Validates input before repository calls
- [ ] Logs at entry point with correlation ID and structured properties
- [ ] Exception handling: Specific → General, wraps with context, re-throws
- [ ] No HTTP concerns mixed with business logic
- [ ] Orchestration between multiple repositories is clear and explicit

### REPOSITORY LAYER
- [ ] Implements async/await for ALL database operations
- [ ] Uses `AsNoTracking()` for read-only queries
- [ ] Parameterized queries (EF Core automatic) - no string interpolation
- [ ] Proper exception handling: catches `DbUpdateException`, `DbUpdateConcurrencyException`
- [ ] No business logic or validation
- [ ] No DTOs - uses domain/persistence entities only
- [ ] Return patterns: `GetAllAsync → IEnumerable<T>`, `GetByIdAsync → T?`, `CreateAsync → T`
- [ ] Deterministic sorting for collections (OrderBy)

### CONTROLLER LAYER
- [ ] **Single dependency injection** — a controller may inject ONLY ONE service dependency.
  Adding a second injected service is a **BLOCKER**: it means the controller is doing
  orchestration that belongs in the service layer.

  ```csharp
  // ❌ BLOCKER: two services injected
  public sealed class RequestPaymentsController(
      IPaymentIntentService paymentIntentService,
      ISetupIntentService setupIntentService)   // ← NOT allowed

  // ✅ CORRECT: one service only
  public sealed class RequestPaymentsController(
      IPaymentIntentService paymentIntentService)
  ```

- [ ] Thin controller — delegates to service immediately, zero business logic
- [ ] No database access, validation logic, or Stripe/provider calls in the controller
- [ ] Auto-generates `CorrelationId` as GUID if not supplied by the caller
- [ ] Appropriate HTTP status codes: 200, 201, 204, 400, 401, 403, 404, 409, 502
- [ ] Validation errors return 400 with `ApiError` (structured error response)
- [ ] Uses `[ProducesResponseType]` attributes on every action
- [ ] Logs only controller-relevant metadata — never raw request payloads
- [ ] All actions are `async Task<IActionResult>` and accept `CancellationToken`

----------------------------------------
SECURITY VALIDATION (CHECKMARX PATTERNS)
----------------------------------------

### LOG FORGING PREVENTION
- [ ] No `$"string {userInput}"` interpolation in logs
- [ ] No logging of raw HTTP payloads or external data
- [ ] Webhook/API payload logs only include: size, presence, digest, never content
- [ ] Structured properties use safe metadata (IDs, counts, status)
- [ ] Correlation ID included in all service-level logs

**Example Issue:**
```csharp
// ❌ WRONG: Logs full payload
_logger.LogInformation($"Request: {rawPayload}");

// ✅ CORRECT: Logs only metadata
_logger.LogInformation("Request received", new { PayloadSize = rawPayload?.Length ?? 0 });
```

### IMPROPER EXCEPTION HANDLING
- [ ] No bare `catch { }` without action
- [ ] Exception order: Specific → General (not reversed)
- [ ] All exceptions logged BEFORE re-throw
- [ ] Cleanup code in catch block or finally (e.g., `_connection?.Dispose()`)
- [ ] Re-throw wraps exception with context: `throw new InvalidOperationException("...", ex)`
- [ ] Dispose methods: catch exceptions and log, but don't propagate

**Example Issue:**
```csharp
// ❌ WRONG: Generic catch first, no logging
catch (Exception ex) { throw; }
catch (ArgumentNullException) { }

// ✅ CORRECT: Specific first, logged, wrapped
catch (ArgumentNullException ex) {
    _logger.LogError("Validation failed", ex);
    throw new InvalidOperationException("Invalid input", ex);
}
catch (Exception ex) {
    _logger.LogError("Unexpected error", ex);
    throw;
}
```

### HEAP INSPECTION PREVENTION
- [ ] Sensitive strings are zeroed in finally blocks (SQL, test data)
- [ ] `GC.SuppressFinalize(this)` in Dispose pattern
- [ ] `GC.Collect()` + `GC.WaitForPendingFinalizers()` for memory cleanup (tests)
- [ ] No connection strings hardcoded - use configuration
- [ ] Test data cleared from memory after assertions

**Example Issue:**
```csharp
// ❌ WRONG: Data left in memory
string password = GetPassword();
_logger.LogInformation(password);

// ✅ CORRECT: Data cleared
string password = GetPassword();
try { _logger.LogInformation(maskedPassword); }
finally { password = string.Empty; }
```

### INJECTION & INPUT VALIDATION
- [ ] Constructor injection only, no service locator pattern
- [ ] All external inputs validated/sanitized before use
- [ ] FluentValidation used for business entity validation
- [ ] Guard clauses for null/invalid inputs at method entry
- [ ] No `ArgumentNullException.ThrowIfNull` without context message

### ASYNC CORRECTNESS
- [ ] No `.Result`, `.Wait()`, `.GetAwaiter().GetResult()`
- [ ] All database operations are `async Task<T>`
- [ ] All API actions are `async Task<IActionResult>`
- [ ] `CancellationToken` parameter required on all async methods
- [ ] `await` used consistently, not bypassed

----------------------------------------
CODE QUALITY VALIDATION
----------------------------------------

### NAMING & CONVENTIONS
- [ ] Class/interface names clear and descriptive (no abbreviations)
- [ ] Method names follow PaymentHub patterns: `CreateAsync`, `GetByIdAsync`, etc.
- [ ] Test method names: `MethodNameConditionExpectedResult` (PascalCase, no underscores)
- [ ] Variables: explicit types (no `var` in tests per CORE RULES)
- [ ] Constants in UPPER_SNAKE_CASE

### SOLID PRINCIPLES
- [ ] Single Responsibility - each class has one reason to change
- [ ] Open/Closed - open to extension, closed to modification
- [ ] Liskov Substitution - derived classes work where base expected
- [ ] Interface Segregation - small, focused interfaces
- [ ] Dependency Inversion - depends on abstractions, not concretions

### CODE STYLE
- [ ] No deep nesting (max 3 levels recommended)
- [ ] Guard clauses used for early returns
- [ ] Magic strings/numbers extracted to named constants
- [ ] Comments explain *why*, not *what* (code explains what)
- [ ] No dead code or commented-out logic
- [ ] Consistent indentation and formatting

### PERFORMANCE CONCERNS
- [ ] No N+1 query patterns in repositories
- [ ] No `ToList()` before filtering/sorting
- [ ] Pagination implemented for large result sets
- [ ] String concatenation uses `StringBuilder` for loops
- [ ] No unnecessary object allocation in hot paths

----------------------------------------
TEST COVERAGE VALIDATION
----------------------------------------

### TEST REQUIREMENTS
- [ ] All new public methods have unit tests
- [ ] All business logic paths tested (happy path + error cases)
- [ ] Integration tests for repository/service interactions
- [ ] Acceptance tests for new API endpoints
- [ ] Mock external dependencies appropriately
- [ ] Test names clearly describe scenario and expected outcome

### TEST QUALITY
- [ ] AAA pattern: Arrange → Act → Assert with clear sections
- [ ] Assertions test behavior, not implementation details
- [ ] Deterministic - no timing-dependent or random failures
- [ ] Isolated - each test runs independently
- [ ] Explicit typing (no `var` in PaymentHub tests)
- [ ] Proper cleanup: `IDisposable` or try-finally for resources

### TEST FRAMEWORKS
- [ ] xUnit for test structure (`[Fact]`, `[Theory]`)
- [ ] Appropriate mock library for project (Moq, NSubstitute, FakeItEasy)
- [ ] FluentAssertions for readable assertions
- [ ] In-memory SQLite for repository tests
- [ ] No external service calls in unit tests

----------------------------------------
API CONTRACT VALIDATION (REST)
----------------------------------------

### ENDPOINT DESIGN
- [ ] Routes use RESTful conventions: `/api/v{version}/[resource]`
- [ ] HTTP methods: GET (read), POST (create), PUT (replace), DELETE (remove)
- [ ] Status codes correct:
  - 200 OK - successful GET/PUT/POST
  - 201 Created - POST successful with Location header
  - 204 No Content - DELETE successful
  - 400 Bad Request - invalid input/validation failure
  - 401 Unauthorized - authentication required
  - 403 Forbidden - authenticated but insufficient permissions
  - 404 Not Found - resource doesn't exist
  - 409 Conflict - business rule violation
  - 500 Internal Server Error - unexpected server error

### ERROR RESPONSES
- [ ] Consistent error response format across endpoints
- [ ] Error response includes message and optional error code
- [ ] Validation errors include field names and error messages
- [ ] No sensitive information in error responses
- [ ] Correlation ID included in error context (for tracing)

### API VERSIONING
- [ ] New features go to new major version when backward incompatible
- [ ] Deprecated endpoints clearly marked and have sunset date
- [ ] API version in URL path: `/api/v1/`, `/api/v2/`

----------------------------------------
DOCUMENTATION VALIDATION
----------------------------------------

### CODE COMMENTS
- [ ] Complex algorithms have summary comments
- [ ] Why-comments explain unusual implementations
- [ ] No TODO comments left unfixed
- [ ] XML documentation for public methods (optional per project convention)
- [ ] Comments kept in sync with code changes

### README & CONTRIBUTING
- [ ] If adding new service/component, document setup
- [ ] Update CONTRIBUTING.md if workflow changed
- [ ] New skill files have clear YAML frontmatter

----------------------------------------
PR REVIEW CHECKLIST
----------------------------------------

Before approving:

- [ ] **Controller single dependency** — only ONE service injected per controller
- [ ] **Architecture** — service/repo/controller layer rules followed
- [ ] **Log Forging** — no user/external input in log messages
- [ ] **Exception Handling** — specific → general, logged, wrapped
- [ ] **Heap Inspection** — sensitive data cleared, no hardcoded secrets
- [ ] **Async** — no `.Result`/`.Wait()`, `CancellationToken` propagated end-to-end
- [ ] **Test coverage** — all new code paths have tests
- [ ] **Existing tests updated** — no broken tests from constructor changes
- [ ] **API contracts** — correct status codes, consistent `ApiError` format
- [ ] **No breaking changes** without explicit documentation
- [ ] **Solution builds** with zero errors and zero new warnings
- [ ] **PR description** explains the why/what/how

----------------------------------------
COMMON ISSUES TO LOOK FOR
----------------------------------------

| Issue | Severity | What to look for |
|---|---|---|
| Multiple services injected in one controller | **Blocker** | Constructor with >1 service parameter |
| Hardcoded secrets / API keys | **Blocker** | `"sk-"`, `"password"`, `"apiKey"` literals |
| Business logic in controller | **Blocker** | `if/else`, validation, DB calls inside action method |
| SQL injection / string interpolation in SP call | **Blocker** | `$"EXEC {proc}"` or string-built SQL |
| Raw payload in logs | **Blocker** | `_logger.Info($"... {rawBody}")` |
| Empty catch block | **High** | `catch (Exception) { }` |
| `.Result` / `.Wait()` on async | **High** | Deadlock risk |
| Missing `CancellationToken` | **High** | Async method without CT parameter |
| N+1 query | **High** | Loop calling `GetByIdAsync` on each iteration |
| Missing tests for new public method | **Medium** | New `public async Task` without test |
| `var` in test code | **Low** | Per PaymentHub test conventions |
| Magic string error code | **Low** | Inline string instead of constant class |
| TODO comment left in | **Low** | `// TODO:` in committed code |

----------------------------------------
REVIEW FEEDBACK TEMPLATE
----------------------------------------

```markdown
## Summary
[1-2 sentences: what the PR does and your overall assessment.]

## Tooling Used
- **Lint / Code Quality:** [SonarQube | fallback: <tool>] — [Quality Gate: pass/fail | not run: reason]
- **Security (SAST):** [Checkmarx | fallback: <tool>] — [result: pass/fail | not run: reason]

## Strengths
- [Positive patterns observed — be specific.]

## Blockers (must fix before merge)
- [ ] [File:Line] — Issue description. Suggested fix.

## Suggestions (should fix, not mandatory)
- [ ] [File:Line] — Issue description. Suggested alternative.

## Questions
- [Design decision or intent that needs clarification.]

## Nits (minor style/preference — optional)
- [Low-priority items.]
```

----------------------------------------
APPROVAL CRITERIA
----------------------------------------

Approve PR when:

- ✅ Controller has a single injected dependency
- ✅ All architecture patterns correctly followed
- ✅ Security review passed (no Log Forging, Exception, Heap issues)
- ✅ Test coverage adequate for the change complexity
- ✅ All existing tests still pass
- ✅ API contracts consistent with existing endpoints
- ✅ No hardcoded secrets or connection strings
- ✅ Solution builds with zero warnings
- ✅ All feedback items addressed

Request changes if:

- ❌ Controller injects more than one service
- ❌ Business logic present in controller
- ❌ Log Forging or improper exception handling detected
- ❌ New public code has no tests
- ❌ Constructor changed but existing tests not updated
- ❌ Breaking API change without documentation
- ❌ Architecture violations present in any layer
