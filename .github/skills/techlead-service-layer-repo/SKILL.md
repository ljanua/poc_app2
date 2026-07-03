---
name: developer-service-layer repo
description: Use when implementing or refactoring .NET service layer logic with FluentValidation, repository orchestration, and business-rule enforcement.
---

Act as a senior .NET 8 (or latest available version) backend engineer and generate a Service layer implementation following strict enterprise standards.

----------------------------------------
LANGUAGE REQUIREMENTS
----------------------------------------

**CRITICAL:** All generated code, comments, and documentation must be in ENGLISH regardless of the language used in conversation.
- Code keywords, class names, method names, variables: English only
- XML documentation comments: English only
- Commit messages and PR descriptions: English only
- Even if the user speaks Portuguese, Spanish, or other languages, always generate English

You must follow ALL rules below when generating or modifying service layer code.

----------------------------------------
ARCHITECTURE RULES
----------------------------------------

- The service layer must ONLY contain business logic and orchestration.
- The service must NOT contain:
  - direct database access
  - Entity Framework usage
  - HTTP concerns
  - controller logic
  - DTO mapping (unless explicitly required)

  - depend on repository abstractions (interfaces only)
  - depend on validators (FluentValidation)
  - orchestrate operations between layers
  - enforce business rules

DEPENDENCIES

  - FluentValidation validator (e.g., IValidator<Product>)

- Never depend on:
  - DbContext
  - concrete repository implementations
  - controllers
----------------------------------------
TECHNICAL REQUIREMENTS (.NET 8 OR LATEST)
----------------------------------------

- Use C# with .NET 8 or Latest available version
  - For **provider integration services** (like payment services):
    - Inherit from `BasePaymentService<TResult, TContext>` 
    - Implement the Template Method pattern
    - Define a sealed class (no further inheritance)
    - Use generics for flexibility across different provider operations
- Use async/await for ALL operations
  - be asynchronous
  - accept CancellationToken
- NEVER use:
  - .Result
  - .Wait()

----------------------------------------
VALIDATION RULES
----------------------------------------
  - For provider integration services, inject:
    - External service HTTP client (e.g., IStripePaymentIntentHttpClient)
    - Repository interfaces (e.g., IPaymentIntentRepository, IAuditRepository)
    - Configuration manager (IConfigurationManager)

- Always call:

----------------------------------------
BUSINESS RULE RULES
----------------------------------------


- enforcing simple business rules such as:
  - id validation (id > 0)
  - route vs entity consistency (id != entity.Id)
  - Use **primary constructors** for clean dependency injection (C# 12 feature):
    ```csharp
    public sealed class PaymentIntentService(
      IStripePaymentIntentHttpClient stripeClient,
      IConfigurationManager configuration,
      IPaymentIntentRepository repo,
      IAuditRepository auditRepository
    ) : BasePaymentService<CreatePaymentIntentResult, PaymentIntentContext>, IPaymentIntentService
    ```
- orchestrating calls to repository
  - Store dependencies as readonly fields immediately after primary constructor
  - Mark service classes as `sealed` to prevent accidental inheritance
- deciding return behavior (null, bool, entity)
----------------------------------------
----------------------------------------
- call repository directly

- return null if invalid

- validate input null
- validate using FluentValidation
- call repository
UpdateAsync:
- validate input null
- call repository
DeleteAsync:
- call repository

CODING STANDARDS
----------------------------------------
- Use guard clauses
- Avoid deep nesting
- Code must compile with zero warnings

----------------------------------------
EXCEPTION HANDLING REQUIREMENTS (.NET 8)
----------------------------------------

All service methods must implement robust exception handling:

**Pattern: Catch Specific → General, Wrap with Context, Re-throw**
```csharp
public async Task<Result> ProcessAsync(Request request, string correlationId, CancellationToken cancellationToken)
{
    try
    {
        // business logic
        return await _repository.CreateAsync(entity, cancellationToken);
    }
    catch (ArgumentNullException ex)  // Specific exception first
    {
        _logger.LogError(
            "ArgumentValidationError",
            Context(),
            "Request validation failed.",
            ex,
            correlationId,
            400,
            new Dictionary<string, object> { ["Error"] = ex.Message });
        
        throw;  // Re-throw with context logged
    }
    catch (DbUpdateException ex)  // Database-specific exception
    {
        _logger.LogError(
            "RepositoryException",
            Context(),
            "Database operation failed.",
            ex,
            correlationId,
            500,
            new Dictionary<string, object> { ["Operation"] = "Create" });
        
        throw new InvalidOperationException("Failed to process request.", ex);
    }
    catch (Exception ex)  // General catch - ALWAYS LAST
    {
        _logger.LogError(
            "UnexpectedError",
            Context(),
            "Unexpected error during processing.",
            ex,
            correlationId,
            500);
        
        throw;  // Re-throw or wrap based on context
    }
}
```

**Rules:**
- Order: Specific → General (never reverse)
- Always log BEFORE re-throwing
- Use appropriate log level (LogError for exceptions)
- Include context in wrapped exception
- Clean up resources if needed before re-throwing



  ----------------------------------------
  TEMPLATE METHOD PATTERN (FOR PROVIDER SERVICES)
  ----------------------------------------

  When implementing a provider integration service (e.g., Stripe, PayPal), use the Template Method pattern:

  **Base Class Structure:**
  ```csharp
  public abstract class BasePaymentService<TResult, TContext>
    where TResult : class
  {
    protected async Task<TResult> ExecuteAsync(
      TContext context,
      CancellationToken cancellationToken)
    {
      // Template method orchestration:
      // 1. RegisterRequestAsync     - persist request to database
      // 2. BuildProviderRequest     - build external service request
      // 3. RegisterAuditOutRequestAsync - audit outgoing request
      // 4. CallProviderAsync        - call external service
      // 5. HandleSuccess/Failure    - handle response
    }
    
    protected abstract Task<TResult> RegisterRequestAsync(TContext context, CancellationToken cancellationToken);
    protected abstract object BuildProviderRequest(TContext context);
    protected abstract Task<TResult> RegisterAuditOutRequestAsync(object providerRequest, TContext context, CancellationToken cancellationToken);
    protected abstract Task<StripeHttpResult> CallProviderAsync(object providerRequest, TContext context, CancellationToken cancellationToken);
    protected abstract Task<TResult> HandleSuccessAsync(StripeHttpResult httpResponse, object providerRequest, TContext context, CancellationToken cancellationToken);
    protected abstract Task<TResult> HandleFailureAsync(StripeHttpResult httpResponse, object providerRequest, TContext context, CancellationToken cancellationToken);
  }
  ```

  **Implementation Pattern:**
  ```csharp
  public sealed class PaymentIntentService(
    IStripePaymentIntentHttpClient stripeClient,
    IConfigurationManager configuration,
    IPaymentIntentRepository repo,
    IAuditRepository auditRepository
  ) : BasePaymentService<CreatePaymentIntentResult, PaymentIntentContext>, IPaymentIntentService
  {
    private readonly IStripePaymentIntentHttpClient _stripeClient = stripeClient;
    private readonly IPaymentIntentRepository _repository = repo;
    private readonly IConfigurationManager _configuration = configuration;
    private readonly IAuditRepository _auditRepository = auditRepository;
    
    // Public entry point
    public async Task<CreatePaymentIntentResult> CreateAsync(
      CreatePaymentIntentInput input,
      string method,
      string endpoint,
      string ipAddress,
      CancellationToken cancellationToken = default)
    {
      PaymentIntentContext context = await InitializeAsync(input, method, endpoint, ipAddress);
      return await ExecuteAsync(context, cancellationToken);
    }
    
    // Initialize context with all necessary data
    private Task<PaymentIntentContext> InitializeAsync(
      CreatePaymentIntentInput request,
      string method,
      string endpoint,
      string ipAddress)
    {
      string formattedSecretKey = _configuration.GetValue<string>(...);
        
      PaymentIntentContext context = new()
      {
        Request = request,
        CorrelationId = request.PaymentHubCorrelationId ?? Guid.NewGuid().ToString(),
        // ... populate all context fields
      };
        
      return Task.FromResult(context);
    }
    
    // 1. Register the request in database
    protected override async Task<CreatePaymentIntentResult> RegisterRequestAsync(
      PaymentIntentContext context,
      CancellationToken cancellationToken)
    {
      PaymentIntentCreateResult createResult = await _repository.CreateAsync(
        new PaymentIntentCreateParams { ... },
        cancellationToken);
        
      context.CreateResult = createResult;
      context.RequestId = createResult.ClientSystemRequestId;
        
      return null; // Continue template execution
    }
    
    // 2. Build the external service request
    protected override object BuildProviderRequest(PaymentIntentContext context)
    {
      return new CreatePaymentIntentRequest
      {
        Amount = ConvertToMinorUnits(context.Level1.Amount),
        Currency = context.Level1.CurrencyCode,
        // ... build request fields
      };
    }
    
    // 3. Audit the outgoing request
    protected override async Task<CreatePaymentIntentResult> RegisterAuditOutRequestAsync(
      object providerRequest,
      PaymentIntentContext context,
      CancellationToken cancellationToken)
    {
      CreatePaymentIntentRequest request = (CreatePaymentIntentRequest)providerRequest;
      string payloadProvider = JsonSerializer.Serialize(request);
        
      await CreateAuditEventAsync(new PaymentIntentAuditEventParams
      {
        AuditEventTypeCode = "CLIENT_REQUEST",
        // ... audit fields
      }, cancellationToken);
        
      return null; // Continue template execution
    }
    
    // 4. Call the external provider
    protected override Task<StripeHttpResult> CallProviderAsync(
      object providerRequest,
      PaymentIntentContext context,
      CancellationToken cancellationToken)
    {
      CreatePaymentIntentRequest request = (CreatePaymentIntentRequest)providerRequest;
      return _stripeClient.CreatePaymentIntentAsync(
        context.FormattedSecretKey,
        request,
        context.CorrelationId,
        cancellationToken);
    }
    
    // 5. Handle success response
    protected override async Task<CreatePaymentIntentResult> HandleSuccessAsync(
      StripeHttpResult httpResponse,
      object providerRequest,
      PaymentIntentContext context,
      CancellationToken cancellationToken)
    {
      PaymentIntentCreateResult createResult = context.CreateResult;
      StripePaymentIntentResponse stripeResponse = ParsePaymentIntentResponseBody(httpResponse.ResponseBody);
        
      // Update database with success
      await _repository.UpdateStatusAsync(
        new PaymentIntentUpdateStatusParams
        {
          ClientSystemRequestId = context.RequestId,
          StatusCode = "SUCCEEDED",
          StripePaymentIntentId = stripeResponse.Id,
          StatusDetail = stripeResponse.Status
        },
        cancellationToken);
        
      // Audit success
      await CreateAuditEventAsync(new PaymentIntentAuditEventParams
      {
        AuditEventTypeCode = "PROVIDER_RESPONSE",
        Outcome = "success",
        // ... audit fields
      }, cancellationToken);
        
      // Return result
      return new CreatePaymentIntentResult { Id = stripeResponse.Id };
    }
    
    // 6. Handle failure response
    protected override async Task<CreatePaymentIntentResult> HandleFailureAsync(
      StripeHttpResult httpResponse,
      object providerRequest,
      PaymentIntentContext context,
      CancellationToken cancellationToken)
    {
      PaymentIntentCreateResult createResult = context.CreateResult;
      (string externalMessage, string errorType, _) = ParseStripeError(httpResponse.ResponseBody);
        
      // Update database with failure
      await _repository.UpdateStatusAsync(
        new PaymentIntentUpdateStatusParams
        {
          ClientSystemRequestId = context.RequestId,
          StatusCode = "FAILED",
          StatusDetail = externalMessage
        },
        cancellationToken);
        
      // Audit failure
      await CreateAuditEventAsync(new PaymentIntentAuditEventParams
      {
        AuditEventTypeCode = "PROVIDER_RESPONSE",
        Outcome = "failed",
        HttpStatus = httpResponse.StatusCode,
        // ... audit fields
      }, cancellationToken);
        
      // Throw custom exception
      throw new CustomHttpRequestException((HttpStatusCode)httpResponse.StatusCode)
      {
        Data =
        {
          ["StripeErrorType"] = errorType ?? string.Empty,
          ["ExternalStatusCode"] = httpResponse.StatusCode,
          ["CorrelationId"] = context.CorrelationId
        }
      };
    }
  }
  ```

  ----------------------------------------
  CONTEXT PATTERN RULES
  ----------------------------------------

  - Define a dedicated **Context class** that carries all data through the template execution:
    ```csharp
    public class PaymentIntentContext
    {
      public CreatePaymentIntentInput Request { get; set; }
      public Requester Requester { get; set; }
      public Metadata Metadata { get; set; }
      public string CorrelationId { get; set; }
      public string IdempotencyKey { get; set; }
      public string FormattedSecretKey { get; set; }
      public PaymentIntentCreateResult CreateResult { get; set; }
      // ... other context fields
    }
    ```

  - Context should hold:
    - Input request data
    - Configuration/credentials
    - Correlation tracking (correlationId, idempotencyKey)
    - Intermediate results (CreateResult, RequestId)
    - HTTP metadata (method, endpoint, ipAddress)

  - Context is mutable and passed through entire template execution
  - Each template method can read from and write to context

  ----------------------------------------
  AUDIT LOGGING PATTERN
  ----------------------------------------

  - Call `CreateAuditEventAsync` at key points:
    - **Before** external call (CLIENT_REQUEST)
    - **After** external call (PROVIDER_RESPONSE)

  - Include comprehensive audit data:
    - Direction (OutReq, OutRes, InRes)
    - HTTP status and outcome
    - Payloads (client and provider)
    - Correlation IDs
    - Request IDs
    - User/Account information
    - Timestamps and duration

  - Example audit flow:
    ```csharp
    // Outgoing audit
    await CreateAuditEventAsync(new PaymentIntentAuditEventParams
    {
      AuditEventTypeCode = "CLIENT_REQUEST",
      Direction = AuditDirection.OutReq.ToCode(),
      HttpStatus = null,
      Outcome = null,
      PayloadClient = context.PayloadClient,
      PayloadProvider = payloadProvider,
      ClientSystemRequestId = context.RequestId,
      CorrelationId = context.CorrelationId,
      // ...
    }, cancellationToken);
  
    // Incoming audit
    await CreateAuditEventAsync(new PaymentIntentAuditEventParams
    {
      AuditEventTypeCode = "PROVIDER_RESPONSE",
      Direction = AuditDirection.OutRes.ToCode(),
      HttpStatus = httpResponse.StatusCode,
      Outcome = httpResponse.Success ? "success" : "failed",
      PayloadProvider = httpResponse.ResponseBody,
      // ...
    }, cancellationToken);
    ```

  ----------------------------------------
  ERROR HANDLING PATTERN
  ----------------------------------------

  - In `HandleFailureAsync`:
    - Parse external service error response
    - Update database with failure status
    - Create audit record for failure
    - Throw custom exception with structured error data

  - Preserve correlation ID in all exceptions:
    ```csharp
    throw new CustomHttpRequestException((HttpStatusCode)httpResponse.StatusCode)
    {
      Data =
      {
        ["StripeErrorType"] = errorType,
        ["ExternalStatusCode"] = httpResponse.StatusCode,
        ["CorrelationId"] = context.CorrelationId
      }
    };
    ```

  - Base template method catches exceptions and calls `HandleExceptionAsync` (can be overridden)

- Interface: I{Entity}Service
- Class: {Entity}Service
- Methods:
  - GetAllAsync
  - GetByIdAsync
  - CreateAsync
  - UpdateAsync
  - DeleteAsync

----------------------------------------
RETURN PATTERNS
----------------------------------------

- GetAllAsync → IEnumerable<T>
- GetByIdAsync → T?
- CreateAsync → T
- UpdateAsync → T? (null if not found or invalid)
- DeleteAsync → bool

----------------------------------------
EXAMPLE (FOLLOW THIS EXACT PATTERN)
----------------------------------------

using FluentValidation;
using TemplateAI.Data.Entity;
using TemplateAI.Data.Interfaces;
using TemplateAI.Service.Interfaces;

namespace TemplateAI.Service.Implemantetion
{
    public class ProductService(
        IProductRepository productRepository,
        IValidator<Product> productValidator) : IProductService
    {
        private readonly IProductRepository _productRepository = productRepository;
        private readonly IValidator<Product> _productValidator = productValidator;

        public async Task<IEnumerable<Product>> GetAllAsync(CancellationToken cancellationToken = default)
        {
            return await _productRepository.GetAllAsync(cancellationToken);
        }

        public async Task<Product?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
        {
            if (id <= 0)
            {
                return null;
            }

            return await _productRepository.GetByIdAsync(id, cancellationToken);
        }

        public async Task<Product> CreateAsync(Product product, CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(product);

            await _productValidator.ValidateAndThrowAsync(product, cancellationToken);

            return await _productRepository.CreateAsync(product, cancellationToken);
        }

        public async Task<Product?> UpdateAsync(int id, Product product, CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(product);

            if (id != product.Id)
            {
                return null;
            }

            await _productValidator.ValidateAndThrowAsync(product, cancellationToken);

            return await _productRepository.UpdateAsync(product, cancellationToken);
        }

        public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default)
        {
            if (id <= 0)
            {
                return false;
            }

            return await _productRepository.DeleteAsync(id, cancellationToken);
        }
    }
}

----------------------------------------
FINAL INSTRUCTION
----------------------------------------

When generating a service:

- Follow ALL rules above strictly
- Match the example structure
- Keep code clean, explicit, and production-ready
- Do not introduce unnecessary abstractions
- Do not add logic outside service responsibility
- Do not access the database directly
