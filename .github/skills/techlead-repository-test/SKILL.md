---
name: techlead-repository-test
description: Use when generating .NET repository unit tests with EF Core InMemory, xUnit, and isolated CRUD scenario coverage.
---

----------------------------------------
LANGUAGE REQUIREMENTS
----------------------------------------

**CRITICAL:** All generated code, comments, and documentation must be in ENGLISH regardless of the language used in conversation.
- Code keywords, class names, method names, variables: English only
- XML documentation comments: English only
- Commit messages and PR descriptions: English only
- Even if the user speaks Portuguese, Spanish, or other languages, always generate English

I want you to act as a senior .NET 8 backend engineer specialized in Entity Framework Core, repository patterns, Unit of Work, and automated testing.

Your task is to generate complete, production-ready unit tests for a repository or data access class using an in-memory database.

----------------------------------------
TECHNICAL CONTEXT
----------------------------------------

- Language: C#
- Runtime: .NET 8
- ORM: Entity Framework Core
- Database: InMemory Provider
- Test framework: xUnit
- Mocking library: NSubstitute

----------------------------------------
TEST STRATEGY (MANDATORY)
----------------------------------------

- DO NOT mock DbContext
- DO NOT mock DbSet
- ALWAYS use EF Core InMemory database

- Each test MUST:
  - use a unique database instance
  - be isolated
  - not share state

----------------------------------------
IN-MEMORY DATABASE RULES
----------------------------------------

- Use:
  UseInMemoryDatabase(databaseName)

- Database name MUST be unique per test:
  Example:
  string databaseName = Guid.NewGuid().ToString();

- Configure DbContext using:
  DbContextOptionsBuilder<AppDbContext>

- Always ensure clean state per test

----------------------------------------
DATA SETUP RULES
----------------------------------------

- Seed data explicitly inside each test
- Do NOT rely on shared state
- Use explicit variable declarations

----------------------------------------
MANDATORY RULES
----------------------------------------

1. Use C# and .NET 8
2. Use xUnit
3. Use EF Core InMemory database
4. Use NSubstitute only for external dependencies (not DbContext)
5. Do NOT call real database
6. Cover all realistic scenarios

----------------------------------------
COVERAGE REQUIREMENTS
----------------------------------------

Cover:

- create operations
- read operations
- update operations
- delete operations
- entity not found
- empty results
- multiple records
- tracking vs no-tracking behavior (if applicable)
- concurrency scenarios when possible

----------------------------------------
CRITICAL CODE QUALITY RULES
----------------------------------------

Generated code MUST:

- Compile with ZERO warnings
- Produce ZERO IDE suggestions
- Be SonarQube clean
- Be Checkmarx safe

----------------------------------------
MODERN C# (.NET 8) RULES
----------------------------------------

Collection initialization:
- ALWAYS use:
  List<Product> products = [];

Object creation:
- ALWAYS use target-typed new:
  Product product = new();
  ProductRepository repository = new(context);

Primary constructors:
- Use when applicable

----------------------------------------
VARIABLE DECLARATION RULES
----------------------------------------

- DO NOT use `var` when type is clear
- ALWAYS use explicit types

Correct:
  Product product = new();
  List<Product> products = [];

----------------------------------------
CODE CLEANLINESS RULES
----------------------------------------

DO NOT generate:

- unused variables
- unused using statements
- dead code
- commented code

----------------------------------------
NULLABILITY RULES
----------------------------------------

- Handle nulls explicitly
- Avoid unnecessary !

----------------------------------------
SECURITY RULES
----------------------------------------

DO NOT use:

- hardcoded secrets
- real data
- unsafe patterns

----------------------------------------
TEST DATA RULES
----------------------------------------

- Use safe, synthetic data
- Bogus is allowed but must be deterministic
- Assign values to explicit variables

----------------------------------------
NSUBSTITUTE RULES
----------------------------------------

- Use NSubstitute ONLY for external dependencies
- Do NOT use for DbContext
- Validate calls using Received()

----------------------------------------
TEST STRUCTURE RULES
----------------------------------------

- Use Arrange / Act / Assert
- Explicit types
- Deterministic tests

----------------------------------------
TEST NAMING
----------------------------------------

MethodScenarioExpectedResult

Example:
CreateAsync_ValidProduct_SavesSuccessfully

----------------------------------------
IMPLEMENTATION STEPS
----------------------------------------

1. Identify repository methods
2. List scenarios
3. Generate full test class
4. Follow all rules strictly

----------------------------------------
VALIDATION REQUIREMENTS
----------------------------------------

Validate:

- data persisted correctly
- data retrieved correctly
- updates applied correctly
- deletes executed correctly
- entity existence checks

----------------------------------------
FINAL OUTPUT
----------------------------------------

1. List scenarios
2. Full test class
3. Assumptions
4. Final checklist:

- explicit types used
- no var misuse
- no unused code
- no warnings expected
- Sonar clean
- Checkmarx safe

----------------------------------------
IMPORTANT
----------------------------------------

- DO NOT mock DbContext
- ALWAYS use InMemory database
- Ensure each test is isolated
- Prefer correctness over fake completeness

----------------------------------------
INPUT CLASS
----------------------------------------

using Bogus;
using Microsoft.EntityFrameworkCore;
using TemplateAI.Data;
using TemplateAI.Data.Entity;
using TemplateAI.Data.Implemantetion;
using Xunit;

namespace TemplateAI.Test.Data.TemplateAI.Data
{
    public class ProductRepositoryTest
    {
        private static readonly Faker<Product> ProductFaker = new Faker<Product>()
            .RuleFor(p => p.Id, f => f.Random.Int(1, 1000))
            .RuleFor(p => p.Name, f => f.Commerce.ProductName())
            .RuleFor(p => p.Price, f => f.Random.Decimal(1, 1000))
            .RuleFor(p => p.Stock, f => f.Random.Int(0, 100));

        [Fact]
        public async Task GetAllAsync_ProductsExist_ReturnsAllProductsOrderedById()
        {
            // Arrange
            string databaseName = Guid.NewGuid().ToString();
            DbContextOptions<AppDbContext> options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName)
                .Options;
            List<Product> products = [.. ProductFaker.Generate(3).OrderBy(p => p.Id)];
            using (AppDbContext context = new(options))
            {
                context.Products.AddRange(products);
                await context.SaveChangesAsync();
            }

            using (AppDbContext context = new(options))
            {
                ProductRepository repository = new(context);

                // Act
                IEnumerable<Product> result = await repository.GetAllAsync();

                // Assert
                Assert.NotNull(result);
                Assert.Equal(products.Select(p => p.Id), result.Select(p => p.Id));
            }
        }

        [Fact]
        public async Task GetAllAsync_NoProductsExist_ReturnsEmptyList()
        {
            // Arrange
            string databaseName = Guid.NewGuid().ToString();
            DbContextOptions<AppDbContext> options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName)
                .Options;

            using AppDbContext context = new(options);
            ProductRepository repository = new(context);

            // Act
            IEnumerable<Product> result = await repository.GetAllAsync();

            // Assert
            Assert.NotNull(result);
            Assert.Empty(result);
        }

        [Fact]
        public async Task GetByIdAsync_ProductExists_ReturnsProduct()
        {
            // Arrange
            string databaseName = Guid.NewGuid().ToString();
            DbContextOptions<AppDbContext> options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName)
                .Options;
            Product product = ProductFaker.Generate();
            using (AppDbContext context = new(options))
            {
                context.Products.Add(product);
                await context.SaveChangesAsync();
            }

            using (AppDbContext context = new(options))
            {
                ProductRepository repository = new(context);

                // Act
                Product? result = await repository.GetByIdAsync(product.Id);

                // Assert
                Assert.NotNull(result);
                Assert.Equal(product.Id, result!.Id);
            }
        }

        [Fact]
        public async Task GetByIdAsync_ProductDoesNotExist_ReturnsNull()
        {
            // Arrange
            string databaseName = Guid.NewGuid().ToString();
            DbContextOptions<AppDbContext> options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName)
                .Options;

            using AppDbContext context = new(options);
            ProductRepository repository = new(context);

            // Act
            Product? result = await repository.GetByIdAsync(9999);

            // Assert
            Assert.Null(result);
        }

        [Fact]
        public async Task CreateAsync_ValidProduct_AddsProductAndSavesChanges()
        {
            // Arrange
            string databaseName = Guid.NewGuid().ToString();
            DbContextOptions<AppDbContext> options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName)
                .Options;
            Product product = ProductFaker.Generate();

            using AppDbContext context = new(options);
            ProductRepository repository = new(context);

            // Act
            Product result = await repository.CreateAsync(product);

            // Assert
            Assert.Equal(product, result);
            Assert.Contains(context.Products, p => p.Id == product.Id);
        }

        [Fact]
        public async Task CreateAsync_NullProduct_ThrowsArgumentNullException()
        {
            // Arrange
            string databaseName = Guid.NewGuid().ToString();
            DbContextOptions<AppDbContext> options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName)
                .Options;

            using AppDbContext context = new(options);
            ProductRepository repository = new(context);

            // Act & Assert
            await Assert.ThrowsAsync<ArgumentNullException>(() => repository.CreateAsync(null!));
        }

        [Fact]
        public async Task UpdateAsync_ProductExists_UpdatesProductAndSavesChanges()
        {
            // Arrange
            string databaseName = Guid.NewGuid().ToString();
            DbContextOptions<AppDbContext> options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName)
                .Options;
            Product existingProduct = ProductFaker.Generate();
            using (AppDbContext context = new(options))
            {
                context.Products.Add(existingProduct);
                await context.SaveChangesAsync();
            }
            Product updatedProduct = new()
            {
                Id = existingProduct.Id,
                Name = "UpdatedName",
                Price = existingProduct.Price + 10,
                Stock = existingProduct.Stock + 5
            };

            using (AppDbContext context = new(options))
            {
                ProductRepository repository = new(context);

                // Act
                Product? result = await repository.UpdateAsync(updatedProduct);

                // Assert
                Assert.NotNull(result);
                Assert.Equal(updatedProduct.Name, result!.Name);
                Assert.Equal(updatedProduct.Price, result.Price);
                Assert.Equal(updatedProduct.Stock, result.Stock);
            }
        }

        [Fact]
        public async Task UpdateAsync_ProductDoesNotExist_ReturnsNull()
        {
            // Arrange
            string databaseName = Guid.NewGuid().ToString();
            DbContextOptions<AppDbContext> options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName)
                .Options;
            Product product = ProductFaker.Generate();

            using AppDbContext context = new(options);
            ProductRepository repository = new(context);

            // Act
            Product? result = await repository.UpdateAsync(product);

            // Assert
            Assert.Null(result);
        }

        [Fact]
        public async Task UpdateAsync_NullProduct_ThrowsArgumentNullException()
        {
            // Arrange
            string databaseName = Guid.NewGuid().ToString();
            DbContextOptions<AppDbContext> options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName)
                .Options;

            using AppDbContext context = new(options);
            ProductRepository repository = new(context);

            // Act & Assert
            await Assert.ThrowsAsync<ArgumentNullException>(() => repository.UpdateAsync(null!));
        }

        [Fact]
        public async Task DeleteAsync_ProductExists_RemovesProductAndSavesChanges_ReturnsTrue()
        {
            // Arrange
            string databaseName = Guid.NewGuid().ToString();
            DbContextOptions<AppDbContext> options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName)
                .Options;
            Product product = ProductFaker.Generate();
            using (AppDbContext context = new(options))
            {
                context.Products.Add(product);
             await   context.SaveChangesAsync();
            }

            using (AppDbContext context = new(options))
            {
                ProductRepository repository = new(context);

                // Act
                bool result = await repository.DeleteAsync(product.Id);

                // Assert
                Assert.True(result);
                Assert.DoesNotContain(context.Products, p => p.Id == product.Id);
            }
        }

        [Fact]
        public async Task DeleteAsync_ProductDoesNotExist_ReturnsFalse()
        {
            // Arrange
            string databaseName = Guid.NewGuid().ToString();
            DbContextOptions<AppDbContext> options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName)
                .Options;

            using AppDbContext context = new(options);
            ProductRepository repository = new(context);

            // Act
            bool result = await repository.DeleteAsync(9999);

            // Assert
            Assert.False(result);
        }
    }
}
