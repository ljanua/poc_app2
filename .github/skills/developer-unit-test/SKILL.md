---
name: developer-unit-test
description: Use when creating, refactoring or executing unit tests  (AcceptanceTest, CoreTest, DataAccessTest, DataStoreMock, IntegrationTest, PresentationTest, ServiceTest) with xUnit and project-specific patterns.
---

Act as a senior .NET developer test engineer generating and running a separate set of code for unit tests

----------------------------------------
LANGUAGE REQUIREMENTS
----------------------------------------

**CRITICAL:** All generated code, comments, and documentation must be in ENGLISH regardless of the language used in conversation.
- Code keywords, class names, method names, variables: English only
- XML documentation comments: English only
- Commit messages and PR descriptions: English only
- Even if the user speaks Portuguese, Spanish, or other languages, always generate English

You must follow ALL rules below when creating or refactoring tests.

----------------------------------------
GLOBAL TEST STANDARDS
----------------------------------------

- Use xUnit (`[Fact]`, `[Theory]`) for all test types.
- Keep deterministic tests (no flaky timing/random behavior without fixed seed).
- Use explicit typing over `var` where it improves readability and consistency with this repository.
- Prefer AAA pattern (Arrange, Act, Assert), with concise sections.
- For async methods, always use `async Task` and `await`.
- Never use `.Result`, `.Wait()`, or `.GetAwaiter().GetResult()`.
- Assert behavior, not implementation details.
- Add `[ExcludeFromCodeCoverage]` only where this repository already uses that pattern (utility/test-base/mocks).

----------------------------------------
FRAMEWORKS AND TOOLS (REPO-ALIGNED)
----------------------------------------

Use only frameworks already present in PaymentHub test projects:

- xUnit
- Moq
- NSubstitute
- FakeItEasy
- FluentAssertions
- Bogus (with deterministic seed)
- Microsoft.Data.Sqlite (in-memory)

Pick the mocking library that matches the target project existing style:

- `Service.Request.Test` and many request projects: Moq and/or NSubstitute
- `Core.Test`: NSubstitute appears frequently
- Acceptance/Presentation/DataStoreMock: Moq + FakeItEasy + FluentAssertions are available

Do not introduce a new test framework unless explicitly requested.

----------------------------------------
PROJECT-SPECIFIC TEST RECIPES
----------------------------------------

1) ACCEPTANCE TEST
Projects:
- `test/Acceptance.Request.Test`
- `test/Acceptance.Confirmation.Test`

Use for:
- End-to-end use-case behavior through application boundaries
- High-level success/failure scenarios with realistic dependency wiring

Guidelines:
- Focus on business outcome and contract behavior.
- Avoid over-mocking internals; mock only external boundaries when needed.
- Verify relevant status/result payloads and key side effects.

Template:
```csharp
[Fact]
public async Task FeatureNameScenarioExpectedOutcome()
{
    // Arrange
    CancellationToken cancellationToken = CancellationToken.None;
    // setup DI/test input

    // Act
    ResultType result = await sut.ExecuteAsync(input, cancellationToken);

    // Assert
    result.Should().NotBeNull();
    result.Status.Should().Be("expected");
}
```

2) CORE TEST
Projects:
- `test/Core.Test/Core.Test`
- `test/Core.Test/Core.Api.Tests`

Use for:
- Core utilities, middleware, base controllers, shared infrastructure

Guidelines:
- Validate formatting, parsing, and utility logic with edge cases.
- For base controller and middleware tests, assert framework results and payload shape.
- NSubstitute is common for logger and lightweight mocks.

Template:
```csharp
[Fact]
public void ContextReturnsExpectedFormat()
{
    TestController controller = new();

    string result = controller.Context("TestMethod");

    Assert.Contains("TestController.TestMethod", result);
}
```

3) DATA ACCESS TEST
Projects:
- `test/DataAccess.Request.Test`
- `test/DataAccess.Confirmation.Test`

Use for:
- Repository and SQL behavior validation
- Mapping and parameterized query behavior

Guidelines:
- Prefer in-memory SQLite where feasible.
- Create schema and seed explicitly in test setup.
- Verify query result and mapping integrity.

Template:
```csharp
[Fact]
public void CanQuerySeededUsers()
{
    using SqliteCommand command = _connection.CreateCommand();
    command.CommandText = "SELECT Name FROM Users ORDER BY Id";
    using SqliteDataReader reader = command.ExecuteReader();

    List<string> names = [];
    while (reader.Read())
    {
        names.Add(reader.GetString(0));
    }

    Assert.Equal(new[] { "Alice", "Bob" }, names);
}
```

4) DATA STORE MOCK TEST
Projects:
- `test/DataStore.Request.Mock`
- `test/DataStore.Confirmation.Mock`

Use for:
- Mocked data-store adapters and helper executors
- ADO-like execution seams and mapper behavior

Guidelines:
- Keep tests focused on adapter contract and parameter flow.
- For mapper tests, validate expected converted value types.
- Use in-memory SQLite for lightweight DB simulation when needed.

Template:
```csharp
[Fact]
public void MapperReturnsExpectedValue()
{
    Mock<IUnitOfWork> unitOfWorkMock = new();
    unitOfWorkMock.Setup(static u => u.Connection).Returns(new SqlConnection());

    // assert mapper/adapter behavior
}
```

5) INTEGRATION TEST
Projects:
- `test/Integration.Request.Test`
- `test/Integration.Confirmation.Test`

Use for:
- Integration between application layers and real composition roots

Guidelines:
- Prefer real wiring where practical (DI, config, mapping).
- Mock only true external systems (provider API, non-local dependencies).
- Validate full flow and key persistence/audit side effects.

Template:
```csharp
[Fact]
public async Task ExecuteAsyncIntegratedFlowReturnsExpectedResult()
{
    // Arrange full composition

    // Act
    IntegrationResult result = await sut.ExecuteAsync(input, CancellationToken.None);

    // Assert
    result.Should().NotBeNull();
}
```

6) PRESENTATION TEST
Projects:
- `test/Presentation.Request.Test`
- `test/Presentation.Confirmation.Test`

Use for:
- Controller and presentation contract tests

Guidelines:
- Assert HTTP result type (`OkObjectResult`, `BadRequestObjectResult`, etc.).
- Assert response DTO shape and important fields.
- Verify status code and error contract for invalid inputs.

Template:
```csharp
[Fact]
public async Task PostInvalidRequestReturnsBadRequest()
{
    // Arrange

    // Act
    IActionResult result = await controller.Post(request, CancellationToken.None);

    // Assert
    BadRequestObjectResult badRequest = Assert.IsType<BadRequestObjectResult>(result);
    Assert.Equal(400, badRequest.StatusCode);
}
```

7) SERVICE TEST
Projects:
- `test/Service.Request.Test`
- `test/Service.Confirmation.Test`

Use for:
- Service orchestration, business-rule enforcement, and provider handling

Guidelines:
- Match existing strict mock style when present (`MockBehavior.Strict` in Moq).
- Cover null/invalid input, config errors, repo errors, provider success/failure.
- Verify external client invocation contracts (arguments and call count).
- Verify repository status updates and audit calls in success/failure paths.



----------------------------------------
EXCEPTION HANDLING IN TESTS
----------------------------------------

Tests must properly handle exceptions and cleanup:

**Pattern: Test exception behavior with try-finally cleanup**
```csharp
[Fact]
public async Task CreateAsyncInvalidInputThrowsArgumentNullException()
{
    // Arrange
    CreatePaymentIntentInput? nullInput = null;
    CancellationToken cancellationToken = CancellationToken.None;

    // Act & Assert
    ArgumentNullException exception = await Assert.ThrowsAsync<ArgumentNullException>(
        () => _sut.CreateAsync(nullInput, "POST", "endpoint", "", cancellationToken));

    Assert.Equal("request", exception.ParamName);
}
```

**For tests with database setup (IDisposable):**
```csharp
[Fact]
public async Task RepositoryCreateAsyncSucceeds()
{
    SqliteConnection connection = new("Data Source=:memory:");
    try
    {
        connection.Open();
        // ... test logic
    }
    finally
    {
        if (connection.State != ConnectionState.Closed)
        {
            connection.Close();
        }
        connection.Dispose();
    }
}
```

**Rules:**
- Always catch specific exception types in Assert.ThrowsAsync
- Verify exception message or ParamName when available
- Use try-finally to guarantee cleanup of resources (connections, files, streams)
- Call GC.Collect() in cleanup if test involves sensitive data (memory inspection tests)

----------------------------------------
NAMING CONVENTIONS
----------------------------------------

Follow existing repository style, examples:

- Class names:
  - `PaymentIntentServiceTests`
  - `TerminalServiceTest`
  - `BaseControllerTests`

- Method names:
  - `MethodNameConditionExpectedResult`
  - Examples:
    - `CreateAsyncNullInputThrowsNullReferenceException`
    - `CreateConnectionTokenInvalidClientSystemProviderThrowsCustomHttpRequestException`
    - `ContextReturnsExpectedFormat`

Keep method names explicit and behavior-driven.

----------------------------------------
MOCKING AND ASSERTION RULES
----------------------------------------

- Prefer strict mocks when project already follows strict behavior.
- Verify important interactions:
  - external provider/client calls
  - repository create/update calls
  - logger call where behavior contract depends on it

- Use one assertion style consistently per file:
  - xUnit `Assert.*` OR
  - FluentAssertions (`Should()`) if file/project already uses it

- For exception tests:
  - Assert exception type
  - Assert key message/status/code/data fields where applicable


----------------------------------------
DO NOTs
----------------------------------------

- Do NOT mix multiple unrelated behaviors in one test.
- Do NOT rely on test execution order.
- Do NOT assert every internal detail; assert contract-critical behavior.
- Do NOT create slow integration tests for logic that belongs in unit tests.
- Do NOT add new dependencies/frameworks unless explicitly requested.
