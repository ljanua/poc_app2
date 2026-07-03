---
name: tech-lead-repository
description: Use when implementing or refactoring .NET repositories with EF Core, async data access patterns, and strict repository responsibilities.
---

Act as a senior .NET backend engineer and generate a Repository implementation following strict enterprise standards.

----------------------------------------
LANGUAGE REQUIREMENTS
----------------------------------------

**CRITICAL:** All generated code, comments, and documentation must be in ENGLISH regardless of the language used in conversation.
- Code keywords, class names, method names, variables: English only
- XML documentation comments: English only
- Commit messages and PR descriptions: English only
- Even if the user speaks Portuguese, Spanish, or other languages, always generate English

You must follow ALL rules below when generating or modifying repository code.

----------------------------------------
ARCHITECTURE RULES
----------------------------------------

- The repository must ONLY handle data access concerns.
- Do NOT include business logic.
- Do NOT include validation logic.
- Do NOT include HTTP concerns.
- Do NOT call services or controllers.
- Do NOT use DTOs in repositories.
- Only work with domain/persistence entities.

- Always depend on abstractions.
- Always use dependency injection.
- Repository must implement an interface.

----------------------------------------
TECHNICAL REQUIREMENTS (.NET 8)
----------------------------------------

- Use C# with .NET 8
- Use Entity Framework Core
- Use async/await for ALL database operations
- NEVER use:
  - .Result
  - .Wait()
  - .GetAwaiter().GetResult()

- All methods must:
  - be asynchronous
  - end with "Async"
  - accept CancellationToken

----------------------------------------
ENTITY FRAMEWORK RULES
----------------------------------------

READ OPERATIONS:
- Always use AsNoTracking() for read-only queries
- Use OrderBy when returning collections if applicable

CREATE:
- Validate input with ArgumentNullException.ThrowIfNull
- Use Add()
- Call SaveChangesAsync()

UPDATE:
- Load entity from database first
- If not found, return null
- Update only necessary fields explicitly
- Call SaveChangesAsync()

DELETE:
- Load entity first
- If not found, return false
- Remove entity
- Call SaveChangesAsync()

----------------------------------------EXCEPTION HANDLING IN REPOSITORIES
----------------------------------------

All database operations must handle exceptions properly:

**Pattern: Wrap DbUpdateException, Log via caller, Let ArgumentNullException propagate**
```csharp
public async Task<Product> CreateAsync(Product product, CancellationToken cancellationToken = default)
{
    ArgumentNullException.ThrowIfNull(product);

    try
    {
        _context.Products.Add(product);
        await _context.SaveChangesAsync(cancellationToken);
        return product;
    }
    catch (DbUpdateException ex)
    {
        // Database constraints or concurrency issues
        throw new InvalidOperationException("Failed to create product due to database error.", ex);
    }
    catch (OperationCanceledException)
    {
        throw;  // Let cancellation propagate
    }
    catch (Exception ex)
    {
        // Unexpected errors
        throw new InvalidOperationException("Unexpected error during product creation.", ex);
    }
}
```

**Rules:**
- Catch specific EF Core exceptions (DbUpdateException, DbUpdateConcurrencyException)
- Always wrap with InvalidOperationException and include context message
- Let OperationCanceledException propagate
- Let ArgumentNullException propagate (from validation)
- Service layer will log all exceptions

----------------------------------------
MEMORY CLEANUP (HEAP INSPECTION)
----------------------------------------

For repositories that handle sensitive data:

1. **Zero connection strings** - Use configuration, never hardcode
2. **Close DbContext properly** - Always use using statements or DI scoping
3. **No string interpolation of raw data** - Use parameterized queries only

**Secure Pattern (CORRECT):**
```csharp
// ✅ Using parameterized query - protects against SQL injection
Product? product = await _context.Products
    .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

// ✅ EF Core parameterizes automatically
```

**Insecure Pattern (WRONG):**
```csharp
// ❌ String interpolation - SQL injection vulnerability AND heap issues
Product? product = await _context.Products
    .FirstOrDefaultAsync(p => p.Id.ToString() == id.ToString(), cancellationToken);
```

----------------------------------------CODING STANDARDS
----------------------------------------

- Follow SOLID principles
- Keep methods small and focused
- Use clear and explicit variable names
- Avoid magic strings and numbers
- Avoid unnecessary complexity
- Avoid hidden side effects
- Code must compile with zero warnings

----------------------------------------
NAMING CONVENTIONS
----------------------------------------

- Interface: I{Entity}Repository
- Class: {Entity}Repository
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
- UpdateAsync → T? (null if not found)
- DeleteAsync → bool

----------------------------------------
EXAMPLE (FOLLOW THIS EXACT PATTERN)
----------------------------------------

using Microsoft.EntityFrameworkCore;
using TemplateAI.Data.Interfaces;
using TemplateAI.Data.Models;

namespace TemplateAI.Data.Implemantetion
{
    public class ProductRepository(AppDbContext context) : IProductRepository
    {
        private readonly AppDbContext _context = context;

        public async Task<IEnumerable<Product>> GetAllAsync(CancellationToken cancellationToken = default)
        {
            return await _context.Products
                .AsNoTracking()
                .OrderBy(product => product.Id)
                .ToListAsync(cancellationToken);
        }

        public async Task<Product?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
        {
            return await _context.Products
                .AsNoTracking()
                .FirstOrDefaultAsync(product => product.Id == id, cancellationToken);
        }

        public async Task<Product> CreateAsync(Product product, CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(product);

            _context.Products.Add(product);
            await _context.SaveChangesAsync(cancellationToken);

            return product;
        }

        public async Task<Product?> UpdateAsync(Product product, CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(product);

            Product? existingProduct = await _context.Products
                .FirstOrDefaultAsync(currentProduct => currentProduct.Id == product.Id, cancellationToken);

            if (existingProduct is null)
            {
                return null;
            }

            existingProduct.Name = product.Name;
            existingProduct.Price = product.Price;
            existingProduct.Stock = product.Stock;

            await _context.SaveChangesAsync(cancellationToken);

            return existingProduct;
        }

        public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default)
        {
            Product? existingProduct = await _context.Products
                .FirstOrDefaultAsync(product => product.Id == id, cancellationToken);

            if (existingProduct is null)
            {
                return false;
            }

            _context.Products.Remove(existingProduct);
            await _context.SaveChangesAsync(cancellationToken);

            return true;
        }
    }
}

----------------------------------------
FINAL INSTRUCTION
----------------------------------------

When generating a repository:

- Follow ALL rules above strictly
- Match the example structure
- Keep code clean, explicit, and production-ready
- Do not introduce unnecessary abstractions
- Do not add features that were not requested
