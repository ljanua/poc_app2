---
name: developer-api-controller
description: Use when designing, generating, or refactoring ASP.NET Core Web API controllers in .NET 10 (or latest available version) that expose REST endpoints, enforce thin-controller architecture, delegate to the service layer, and comply with enterprise REST/API governance. Triggers - "API controller", "Web API", "REST endpoint", "ASP.NET Core controller", "expose endpoint", "ProducesResponseType", "minimal API vs controller", "webhook endpoint".
---

Act as a senior .NET API engineer and generate ASP.NET Core Web API controllers that are thin, RESTful, secure, and aligned with enterprise API governance.

----------------------------------------
LANGUAGE REQUIREMENTS
----------------------------------------

**CRITICAL:** All generated code, comments, and documentation must be in ENGLISH regardless of the language used in conversation.
- Code keywords, class names, method names, variables: English only
- XML documentation comments: English only
- Commit messages and PR descriptions: English only
- Even if the user speaks Portuguese, Spanish, or other languages, always generate English

You must follow ALL rules below when generating or modifying API controller code.

----------------------------------------
SCOPE
----------------------------------------

This skill covers the **API entry-point layer only**:

- ASP.NET Core Web API controllers (`[ApiController]` + `ControllerBase`).
- REST endpoint design: routing, HTTP verbs, status codes, content negotiation, versioning.
- HTTP contract concerns: request/response DTOs, model binding, `ProducesResponseType`, problem details.
- Secure handling of external/untrusted payloads (webhooks, third-party callbacks).

Out of scope (delegate to other skills):
- Business logic, orchestration, persistence → service/repository layers.
- Azure resources, messaging, workers, Functions → `developer-dotnet-expert`.
- FluentValidation rule definitions → service layer.

----------------------------------------
PATTERNS & ANTIPATTERNS (SOURCE OF TRUTH)
----------------------------------------

- Use the instruction file located at `.github/skills/developer-api-controller/api-patterns-antipatterns.md` as the source of truth for Patterns and Anti-Patterns.
- If a request or existing code conflicts with those rules, you MUST: (1) call out the violation, (2) explain why it is non-compliant, (3) propose a compliant alternative.

----------------------------------------
ARCHITECTURE RULES
----------------------------------------

- The controller must ONLY handle HTTP/API concerns.
- The controller must NOT contain:
  - business logic
  - direct database access or Entity Framework usage
  - repository access
  - complex validation rules
  - persistence or orchestration logic
- The controller must:
  - receive and bind HTTP requests
  - delegate to the service layer
  - map results to proper HTTP status codes
  - own only API contract concerns
- Controllers must be **thin**: parse input → delegate to a service → return a result.
- Log only controller-relevant warnings/errors, and never raw user input (avoid log forging).

----------------------------------------
DEPENDENCIES
----------------------------------------

- Always inject via constructor:
  - the service interface (e.g., `IProductService`)
  - `ILogger<TController>`
- Never depend on:
  - `DbContext`
  - repository implementations
  - concrete service implementations

----------------------------------------
TECHNICAL REQUIREMENTS (.NET 10 OR LATEST)
----------------------------------------

- Use C# with .NET 10 or the latest available version in the repo; do not downgrade.
- Use ASP.NET Core Web API.
- Use async/await for ALL actions.
- All action methods must:
  - be asynchronous
  - end with `Async`
  - accept a `CancellationToken`
- NEVER use `.Result`, `.Wait()`, or `.GetAwaiter().GetResult()`.

----------------------------------------
CONTROLLER RULES
----------------------------------------

- Always use:
  - `[ApiController]`
  - `[Route("api/v{version:apiVersion}/[controller]")]` (or `api/[controller]` when versioning is not yet enabled)
  - `ControllerBase`
  - primary-constructor injection
- Keep actions small and focused (one responsibility per action).
- Return `ActionResult<T>` or `IActionResult` as appropriate.
- Use RESTful response codes (see HTTP STATUS CODE RULES).
- Annotate every action with `ProducesResponseType` for each possible outcome.
- Prefer request/response DTOs over exposing domain entities directly across the API boundary.

----------------------------------------
OPENAPI DOCUMENTATION RULES
----------------------------------------

- Always document the API using the OpenAPI Specification.
- Ensure every endpoint has a clear operation summary/description and explicit response documentation.
- Keep the OpenAPI contract synchronized with controller routes, DTOs, status codes, and error shapes.
- Prefer annotations and metadata that produce accurate OpenAPI output (for example: `ProducesResponseType`, request/response types, and versioned routes).

----------------------------------------
HTTP STATUS CODE RULES
----------------------------------------

GET all:
- return 200 OK

GET by id:
- return 200 OK if found
- return 404 NotFound if not found

POST create:
- return 201 Created with `CreatedAtAction` if successful
- return 400 BadRequest for validation errors or invalid payload

PUT update:
- if route id does not match body id, return 400 BadRequest
- if entity not found, return 404 NotFound
- if successful, return 200 OK
- return 400 BadRequest for validation errors or invalid payload

DELETE:
- if entity not found, return 404 NotFound
- if successful, return 204 NoContent

Asynchronous/long-running commands:
- return 202 Accepted with a status resource location (never block the request thread)

----------------------------------------
VALIDATION RULES
----------------------------------------

- Business validation must be handled by FluentValidation in the service layer.
- The controller may only validate HTTP contract concerns (e.g., route id must match body id).
- If `ValidationException` is thrown by the service:
  - return BadRequest with a structured response containing `Message` and `Errors` (PropertyName + ErrorMessage).
- If `ArgumentNullException` is thrown:
  - log a warning
  - return BadRequest
- Prefer returning RFC 7807 `ProblemDetails` / `ValidationProblemDetails` for consistent error shapes.

----------------------------------------
LOGGING RULES
----------------------------------------

- Use `ILogger<TController>` with structured logging (named properties, never string interpolation in templates).
- Log only relevant warnings/errors.
- Do NOT log sensitive data, full payloads, or raw request bodies.
- Sanitize any logged value derived from user input to prevent log forging.
- Rely on developer-dotnet-logging skill for best practices on structured logging and log sanitization.


----------------------------------------
SECURITY RULES
----------------------------------------

- Authentication/authorization is enforced (gateway and/or `[Authorize]`); never trust the client.
- Validate and constrain all inbound input at the boundary; treat external payloads as untrusted.
- Never place sensitive data in URLs, query strings, or logs.
- For security failures use only 401 Unauthorized or 403 Forbidden with generic messages.
- HTTPS only.

----------------------------------------
LOG FORGING PREVENTION (CONTROLLERS)
----------------------------------------

**DO NOT** log raw HTTP request bodies or user input.

**VULNERABILITY EXAMPLE (WRONG):**
```csharp
// ❌ SECURITY ISSUE: Logging raw payload from HTTP request
_logger.LogInformation($"Webhook received: {rawPayload}");  // Log Forging vulnerability!
```

**SECURE PATTERN (CORRECT):**
```csharp
// ✅ Log only safe metadata, never the raw payload
_logger.LogInformation(
    "Webhook received and forwarded to service. PayloadSize: {PayloadSize}, HasSignature: {HasSignature}",
    rawPayload?.Length ?? 0,
    !string.IsNullOrEmpty(signatureHeader));
```

**Rules:**
- Never log the full request body or raw payload.
- Log only size, presence, or sanitized metadata.
- Let the service layer handle detailed logging with correlation IDs.

----------------------------------------
CANCELLATION TOKEN SAFETY (WEBHOOK / EXTERNAL PAYLOAD HANDLING)
----------------------------------------

When reading HTTP request bodies from external services (webhooks, third-party callbacks), **use `CancellationToken.None`** for the body-read I/O, NOT the propagated `CancellationToken` parameter.

**RATIONALE:**
- `CancellationToken` from the HTTP request context is treated as tainted input by security scanners.
- Propagating untrusted input to I/O operations can be flagged as injection vulnerabilities.
- The controller reads the body only to forward it; actual cancellation is handled by the service layer.

**PATTERN (CORRECT):**
```csharp
public async Task<IActionResult> ReceiveWebhookAsync(
    [FromHeader(Name = "External-Signature")] string signatureHeader,
    CancellationToken cancellationToken)
{
    Request.EnableBuffering();
    using StreamReader reader = new(Request.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: false, leaveOpen: true);

    // ✅ Use CancellationToken.None for reading external payload
    string rawPayload = await reader.ReadToEndAsync(CancellationToken.None);
    Request.Body.Position = 0;

    // ✅ Pass the original cancellationToken to the service layer
    var result = await _service.ProcessAsync(rawPayload, signatureHeader, cancellationToken);
    return Ok(result);
}
```

**Rules:**
- Always use `CancellationToken.None` when reading external/untrusted HTTP payloads.
- Pass the original `cancellationToken` to the service layer for business-operation cancellation.

----------------------------------------
NAMING CONVENTIONS
----------------------------------------

- Controller name must end with `Controller` (e.g., `ProductController`, `OrderController`).
- Action methods:
  - `GetAllAsync`
  - `GetByIdAsync`
  - `CreateAsync`
  - `UpdateAsync`
  - `DeleteAsync`

----------------------------------------
CODING STANDARDS
----------------------------------------

- Follow SOLID principles.
- Keep the controller free from business logic.
- Keep methods small and readable; use guard clauses; avoid deep nesting.
- Code must compile with zero warnings.

----------------------------------------
EXAMPLE (FOLLOW THIS EXACT PATTERN)
----------------------------------------

```csharp
using Microsoft.AspNetCore.Mvc;
using TemplateAI.Service.Interfaces;
using FluentValidation;
using TemplateAI.Data.Entity;

namespace TemplateAI.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProductController(
        IProductService productService,
        ILogger<ProductController> logger) : ControllerBase
    {
        private readonly IProductService _productService = productService;
        private readonly ILogger<ProductController> _logger = logger;

        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<Product>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IEnumerable<Product>>> GetAllAsync(CancellationToken cancellationToken)
        {
            IEnumerable<Product> products = await _productService.GetAllAsync(cancellationToken);
            return Ok(products);
        }

        [HttpGet("{id:int}")]
        [ProducesResponseType(typeof(Product), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<Product>> GetByIdAsync(int id, CancellationToken cancellationToken)
        {
            Product? product = await _productService.GetByIdAsync(id, cancellationToken);

            if (product is null)
            {
                return NotFound();
            }

            return Ok(product);
        }

        [HttpPost]
        [ProducesResponseType(typeof(Product), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<Product>> CreateAsync(
            [FromBody] Product product,
            CancellationToken cancellationToken)
        {
            try
            {
                Product createdProduct = await _productService.CreateAsync(product, cancellationToken);

                return CreatedAtAction(
                    nameof(GetByIdAsync),
                    new { id = createdProduct.Id },
                    createdProduct);
            }
            catch (ValidationException validationException)
            {
                return BadRequest(new
                {
                    Message = "Validation failed.",
                    Errors = validationException.Errors.Select(error => new
                    {
                        error.PropertyName,
                        error.ErrorMessage
                    })
                });
            }
            catch (ArgumentNullException argumentNullException)
            {
                _logger.LogWarning(argumentNullException, "Invalid product payload.");
                return BadRequest(new { argumentNullException.Message });
            }
        }

        [HttpPut("{id:int}")]
        [ProducesResponseType(typeof(Product), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<Product>> UpdateAsync(
            int id,
            [FromBody] Product product,
            CancellationToken cancellationToken)
        {
            if (id != product.Id)
            {
                return BadRequest(new { Message = "Route id must match product id." });
            }

            try
            {
                Product? updatedProduct = await _productService.UpdateAsync(id, product, cancellationToken);

                if (updatedProduct is null)
                {
                    return NotFound();
                }

                return Ok(updatedProduct);
            }
            catch (ValidationException validationException)
            {
                return BadRequest(new
                {
                    Message = "Validation failed.",
                    Errors = validationException.Errors.Select(error => new
                    {
                        error.PropertyName,
                        error.ErrorMessage
                    })
                });
            }
            catch (ArgumentNullException argumentNullException)
            {
                _logger.LogWarning(argumentNullException, "Invalid product payload.");
                return BadRequest(new { argumentNullException.Message });
            }
        }

        [HttpDelete("{id:int}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> DeleteAsync(int id, CancellationToken cancellationToken)
        {
            bool deleted = await _productService.DeleteAsync(id, cancellationToken);

            if (!deleted)
            {
                return NotFound();
            }

            return NoContent();
        }
    }
}
```

----------------------------------------
TESTING
----------------------------------------

- Unit test action methods by mocking the service interface; assert the returned `ActionResult` type and status code.
- Cover not-found, validation-failure, and id-mismatch branches.
- Do not test business rules here — those belong to service-layer tests.

----------------------------------------
DO NOT
----------------------------------------

- Do not access the database or repositories directly from the controller.
- Do not put business logic, orchestration, or persistence in the controller.
- Do not duplicate validation rules already handled by FluentValidation.
- Do not log raw payloads or sensitive data.
- Do not block on async (`.Result`, `.Wait()`).
- Do not encode actions in URLs or invent custom HTTP status codes (see api-patterns-antipatterns.md).

----------------------------------------
FINAL INSTRUCTION
----------------------------------------

When generating an API controller:
- Follow ALL rules above strictly and the governance rules in `api-patterns-antipatterns.md`.
- Match the example structure.
- Keep code clean, explicit, and production-ready.
- Always produce and maintain OpenAPI-compliant API documentation.
- Do not introduce unnecessary abstractions.
