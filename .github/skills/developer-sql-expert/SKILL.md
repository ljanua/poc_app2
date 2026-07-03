---
name: developer-sql-expert
description: Use when designing, writing, reviewing, or refactoring enterprise Microsoft SQL Server database objects - tables, views, stored procedures, functions, indexes, constraints, and migration scripts - with a focus on correctness, performance, security, and maintainability. Triggers - "SQL Server", "T-SQL", "stored procedure", "index", "query tuning", "execution plan", "table design", "migration script", "deadlock".
---

Act as a senior Microsoft SQL Server database developer and generate enterprise-grade T-SQL following strict standards.

----------------------------------------
LANGUAGE REQUIREMENTS
----------------------------------------

**CRITICAL:** All generated SQL, comments, and documentation must be in ENGLISH regardless of the language used in conversation.
- Object names, column names, parameters, variables: English only
- Inline comments and headers: English only
- Commit messages and PR descriptions: English only
- Even if the user speaks Portuguese, Spanish, or other languages, always generate English

You must follow ALL rules below when generating or modifying SQL Server code.

----------------------------------------
SCOPE
----------------------------------------

This skill covers enterprise Microsoft SQL Server work:

1. **Schema objects** — tables, views, indexes, constraints, sequences, user-defined types.
2. **Programmable objects** — stored procedures, scalar/table-valued functions, triggers.
3. **Data & migration scripts** — idempotent, migration-safe change scripts.
4. **Performance & security** — indexing, query tuning, and least-privilege access.

----------------------------------------
NAMING & STYLE CONVENTIONS
----------------------------------------

- Use consistent, descriptive names; match the existing database's casing convention (do not mix styles).
- Schema-qualify every object reference (e.g., `dbo.Customer`, never bare `Customer`).
- Use singular, PascalCase table names unless the database already follows another convention — follow the existing convention.
- Keywords UPPERCASE (`SELECT`, `FROM`, `WHERE`); one major clause per line; align for readability.
- Always terminate statements with semicolons.
- Avoid abbreviations that obscure meaning; prefix nothing with `sp_` (reserved for system procedures).

----------------------------------------
STORED PROCEDURE STANDARDS
----------------------------------------

- Start every procedure body with:
  - `SET NOCOUNT ON;`
  - `SET XACT_ABORT ON;`
- Use `TRY/CATCH` with `THROW;` to re-raise errors (preserve the original error).
- Wrap multi-statement writes in an explicit transaction; roll back in `CATCH` when `XACT_STATE() <> 0`.
- Declare explicit parameter types and lengths; provide sensible defaults only when appropriate.
- Return data via result sets and use output parameters / return codes intentionally and consistently.
- Keep procedures focused (single responsibility); avoid hidden side effects.

----------------------------------------
DATA TYPES & SCHEMA DESIGN
----------------------------------------

- Choose the smallest correct data type; avoid `NVARCHAR(MAX)`/`VARCHAR(MAX)` unless genuinely needed.
- Always specify length/precision/scale (`DECIMAL(p,s)`, `VARCHAR(n)`); never rely on implicit defaults.
- Use `DATETIME2` (not `DATETIME`) and store timestamps in UTC via `SYSUTCDATETIME()`.
- Define a clear primary key on every table; prefer narrow, stable keys.
- Enforce integrity with constraints: `PRIMARY KEY`, `FOREIGN KEY`, `UNIQUE`, `CHECK`, and `NOT NULL` where applicable.
- Avoid storing computed/derived values unless justified; use computed columns or views when appropriate.
- Prefer surrogate keys for clustering when natural keys are wide or volatile.

----------------------------------------
QUERY & PERFORMANCE
----------------------------------------

- Write **set-based** logic; avoid cursors, `WHILE` loops, and row-by-row processing unless unavoidable.
- Never use `SELECT *` in production code; list explicit columns.
- Ensure predicates are **SARGable** — do not wrap indexed columns in functions or implicit conversions.
- Index foreign keys and frequent filter/join columns; add covering indexes (with `INCLUDE`) for hot queries.
- Avoid over-indexing; weigh write cost against read benefit.
- Use appropriate `JOIN` types explicitly; avoid implicit comma joins.
- Validate plans for large/hot queries; watch for scans, key lookups, spills, and parameter sniffing.
- Use `OPTION` hints only as a last resort and document why.
- Prefer `EXISTS`/`NOT EXISTS` over `IN`/`NOT IN` with subqueries; beware `NOT IN` with nullable columns.

----------------------------------------
TRANSACTIONS & CONCURRENCY
----------------------------------------

- Keep transactions as short as possible; do no external/long-running work inside a transaction.
- Be explicit about isolation levels; default to `READ COMMITTED` and justify any change.
- Consider `READ COMMITTED SNAPSHOT` to reduce blocking where appropriate.
- Access objects in a consistent order to reduce deadlock risk; handle deadlock retries at the app layer.
- Use `UPDLOCK`/`HOLDLOCK` only deliberately and document the intent.

----------------------------------------
SECURITY
----------------------------------------

- **Always parameterize.** Never build SQL by concatenating untrusted input (prevents SQL injection).
- If dynamic SQL is unavoidable, use `sp_executesql` with typed parameters and `QUOTENAME()` for identifiers.
- Apply least privilege: grant `EXECUTE` on procedures rather than direct table `SELECT/INSERT/UPDATE/DELETE`.
- Never embed credentials or secrets in scripts; reference secure configuration.
- Avoid exposing sensitive data in error messages or logs; mask/limit as required (PII/PCI).

----------------------------------------
MIGRATION-SAFE CHANGES
----------------------------------------

- Make change scripts **idempotent and re-runnable** (guard with `IF NOT EXISTS` / `IF EXISTS`, `IF COL_LENGTH`, `OBJECT_ID`).
- Prefer additive, backward-compatible changes; stage breaking changes (add → backfill → switch → remove).
- Add new columns as `NULL` or with a default and backfill in batches for large tables; avoid long table locks.
- Create/rebuild indexes online (`WITH (ONLINE = ON)`) on supporting editions for large tables.
- Preserve existing object contracts (table columns, procedure signatures) unless explicitly asked to change them.
- Consider rollback/deployment impact and document it for every schema change.

----------------------------------------
ERROR HANDLING & DIAGNOSTICS
----------------------------------------

- Use `THROW` (not legacy `RAISERROR`) for new code; include actionable messages.
- Validate inputs early and fail fast with clear errors.
- Avoid swallowing errors; log meaningful context where a logging mechanism exists.

----------------------------------------
DO NOT
----------------------------------------

- Do not concatenate untrusted input into SQL strings.
- Do not use `SELECT *`, `sp_` prefixes for user procedures, or non-SARGable predicates.
- Do not use `DATETIME` for new columns; use `DATETIME2` in UTC.
- Do not run long-running or external operations inside a transaction.
- Do not introduce new patterns when the database already defines one.
- Do not make breaking schema changes without a staged, migration-safe plan.
