# api-patterns-antipatterns.md
# REST API & Controller Pattern / Anti-Pattern guidance

## Scope
These instructions apply to **all GitHub Copilot agents** working on API controllers in this repository.

You MUST follow these rules when:
- Designing or modifying REST API controllers and endpoints
- Generating request/response contracts (DTOs)
- Defining routing, versioning, and status-code behavior
- Creating or updating OpenAPI / Swagger definitions
- Reviewing pull requests that affect public API surface

If a user request or existing code conflicts with these rules, you MUST:
1. Clearly call out the violation
2. Explain why it is non-compliant
3. Propose a compliant alternative

---

## 1. Controller Responsibility Boundaries

✅ A controller MAY:
- Bind and validate HTTP contract concerns (route/body id match, model binding)
- Delegate to the service layer
- Map service results to HTTP status codes
- Set response headers (Location, correlation IDs, caching headers)
- Enforce authentication/authorization attributes

❌ A controller MUST NOT:
- Contain business logic or orchestrate multi-step workflows
- Access databases, `DbContext`, or repositories directly
- Perform complex aggregation or composition
- Define FluentValidation rules
- Serve static content (images, PDFs, videos)

➡ If any violation is detected, move the logic into the service layer or a dedicated composition/facade service.

---

## 2. REST Design Rules

### Resources & URLs
- Use plural nouns for collections.
- Keep hierarchy shallow (≤ 2 levels ideally).
- NEVER encode actions in URLs.

✅ Correct:
```
GET    /v1/orders
POST   /v1/orders
GET    /v1/orders/{orderId}
```

❌ Incorrect:
```
POST   /createOrder
GET    /orders/getStatuses
```

### HTTP Methods
- GET → Read (safe, idempotent, no side effects)
- POST → Create or command
- PUT → Full update of an existing resource (idempotent)
- DELETE → Remove (idempotent)
- Avoid PATCH unless partial update is explicitly required

### Status Codes
- Always return correct, standard HTTP status codes.
- Never invent custom codes.
- Use `202 Accepted` ONLY for asynchronous operations.
- Use `201 Created` with a `Location` header (`CreatedAtAction`) for resource creation.

---

## 3. Mandatory Controller Patterns

### Thin Controllers
- Parse input → delegate to service → return result. Nothing more.

### Explicit Response Contracts
- Annotate every action with `ProducesResponseType` for each outcome.
- Prefer dedicated request/response DTOs over exposing domain entities at the boundary.

### Consistent Error Shape (RFC 7807)
- Return `ProblemDetails` / `ValidationProblemDetails` for error responses.
- Every error response MUST include `status`, `code`/`type`, `title`, and an optional `detail`.

### Throttling & Rate Limiting
- Apply rate limiting where appropriate; return `429 Too Many Requests` when exceeded.

### Asynchronous Commands
- Model non-CRUD actions as command resources via POST.
- Async commands MUST return `202 Accepted`, expose a status resource (GET), and optionally support DELETE to cancel.

---

## 4. Explicit Anti-Patterns (Always Reject)

Immediately flag and reject:
- Business rules, persistence, or orchestration inside the controller
- Direct database/repository access from the controller
- Content-based routing using request bodies (route on headers/metadata only)
- Actions encoded in URLs (`/createOrder`, `/orders/approve`)
- Custom or non-standard HTTP status codes
- Returning raw domain entities when a contract DTO is required
- Logging raw payloads or sensitive data
- Generic `catch (Exception)` that swallows errors without rethrow/handling

Always explain why the anti-pattern is harmful and provide a compliant alternative.

---

## 5. Versioning Rules

- Avoid versioning whenever possible; prefer non-breaking changes (add fields, add endpoints).
- Breaking changes REQUIRE: a new major version, explicit consumer notification, and a deprecation/sunset plan.

✅ Version format: `/v1/resource`
❌ Do NOT version using custom headers or media types.

---

## 6. Security Rules (Assume Clients Are Insecure)

### Authentication & Authorization
- OAuth 2.0 with Bearer tokens; enforce via gateway and/or `[Authorize]`.
- API keys identify clients but are NOT a security boundary.

### Transport Security
- HTTPS only; TLS 1.2+.

### Sensitive Data
- NEVER place sensitive data in URLs, query strings, or logs.
- Mask or strip sensitive data before logging.

### Security Errors
- Use only `401 Unauthorized` or `403 Forbidden` with generic messages — never leak why.

### Untrusted Payloads
- Treat all inbound bodies/headers as untrusted; validate at the boundary.
- When reading external payloads (webhooks), read the body with `CancellationToken.None` and forward the original token to the service layer.

---

## 7. Context Handling

- Pass context via HTTP headers (Authorization, Correlation ID, channel/geography).
- Do NOT infer context from request bodies.

---

## 8. Data & Type Standards

- JSON only (`application/json`), UTF-8 encoding.
- ISO-8601 timestamps in UTC.
- Treat IDs as strings at the contract boundary.
- Ignore unknown fields (Postel's Law) instead of failing hard.

---

## 9. Caching Rules

- Design for cacheability where appropriate; use `Cache-Control` correctly.
- NEVER public-cache authenticated responses.

---

## 10. OpenAPI / Swagger Rules

When generating API specs:
- Use OpenAPI 3.x consistently.
- Fully document parameters, request bodies, responses, and error shapes.
- Document every status code the action can return.
- Reject incomplete or consumer-hostile specifications.

---

## 11. API Lifecycle Awareness

Always align work to this lifecycle:
1. Understand the consumer.
2. Define the API contract first.
3. Prototype early.
4. Implement thin controllers over a tested service layer.
5. Version responsibly and communicate deprecations.
