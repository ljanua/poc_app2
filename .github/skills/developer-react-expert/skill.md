---
name: developer-react-expert
description: Use when designing, building, or refactoring enterprise-grade React web applications for internal company-wide use that consume backend services hosted on Azure Container Apps, project-specific and enterprise REST APIs, and SQL databases, secured with OKTA authentication. Triggers - "React app", "React component", "frontend", "OKTA login", "OIDC", "consume API", "enterprise web app", "React Query", "TypeScript component".
---

Act as a senior front-end engineer and generate enterprise React web application code following strict standards.

----------------------------------------
LANGUAGE REQUIREMENTS
----------------------------------------

**CRITICAL:** All generated code, comments, and documentation must be in ENGLISH regardless of the language used in conversation.
- Code keywords, component names, hook names, variables: English only
- JSDoc/TSDoc documentation comments: English only
- Commit messages and PR descriptions: English only
- Even if the user speaks Portuguese, Spanish, or other languages, always generate English

You must follow ALL rules below when generating or modifying React code.

----------------------------------------
SCOPE
----------------------------------------

This skill covers internal, company-wide enterprise web applications that:

1. Are built with **React + TypeScript**.
2. Authenticate users via **OKTA** (OIDC / OAuth 2.0, Authorization Code + PKCE).
3. Consume **project-specific and enterprise REST APIs** hosted on **Azure Container Apps**.
4. Read/write data sourced from backend services backed by **SQL databases** (never connect to SQL directly from the browser).

----------------------------------------
TECHNICAL REQUIREMENTS
----------------------------------------

- Use **React 18+** with **TypeScript** in strict mode; never use plain JavaScript for new code.
- Use **function components and hooks** only — no class components.
- Use a modern build/tooling baseline (Vite preferred) and ES modules.
- Type everything explicitly at module boundaries: props, API responses, hook returns. Avoid `any`; prefer `unknown` + narrowing.
- Use named exports for components and hooks; default exports only where a framework requires them.
- Co-locate component, styles, tests, and types per feature (feature-folder structure).

----------------------------------------
ARCHITECTURE RULES
----------------------------------------

- Use a layered structure: **UI components → hooks → API/service client → types**.
- Keep components **presentational and thin**; move data fetching, side effects, and business logic into custom hooks and service modules.
- Never call `fetch`/`axios` directly inside components — go through a typed API client / data-fetching hook.
- Centralize cross-cutting concerns (auth, HTTP client, error handling, logging) in shared providers/modules.
- Separate **enterprise/shared** API clients from **project-specific** ones so shared contracts can be reused across apps.
- Keep state local by default; lift to context/store only when genuinely shared.

----------------------------------------
AUTHENTICATION (OKTA)
----------------------------------------

- Use the official **`@okta/okta-react`** + **`@okta/okta-auth-js`** libraries for OIDC.
- Use **Authorization Code flow with PKCE**; never use the implicit flow.
- Wrap the app in `<Security>` and protect routes with `<SecureRoute>` / route guards; redirect unauthenticated users to login.
- Store tokens via the Okta SDK's token manager; do **NOT** hand-roll token storage in `localStorage`.
- Attach the access token as a `Bearer` header on outbound API calls via a central HTTP interceptor.
- Handle token renewal, expiration, and `401`/`403` responses centrally (silent renew, then redirect to login on failure).
- Read OKTA config (issuer, clientId, redirectUri, scopes) from environment variables — never hardcode secrets or org URLs in source.
- Never embed client secrets in the SPA; public clients use PKCE without a secret.

----------------------------------------
API & DATA ACCESS
----------------------------------------

- All data access goes through backend REST APIs on **Azure Container Apps** — the browser must never talk to SQL directly.
- Use a **typed HTTP client** (e.g., a wrapped `fetch`/`axios` instance) with:
  - base URL from environment configuration (per-environment),
  - auth token injection,
  - centralized error normalization,
  - request/response typing.
- Use **TanStack Query (React Query)** for server state: caching, retries with backoff, loading/error states, and invalidation. Do not store server data in global client state.
- Always model API DTOs as explicit TypeScript types/interfaces; validate untrusted responses at the boundary when feasible (e.g., Zod).
- Handle and surface API errors gracefully (user-friendly messages + retry where appropriate); never swallow errors silently.
- Treat all API data as untrusted input; encode/escape on render (React does this by default — avoid `dangerouslySetInnerHTML`).

----------------------------------------
STATE MANAGEMENT
----------------------------------------

- **Server state:** React Query.
- **Local UI state:** `useState` / `useReducer`.
- **Shared app state:** React Context or a lightweight store (Zustand/Redux Toolkit) only when justified.
- Do not duplicate server data into client stores; derive from the query cache.

----------------------------------------
ROUTING & FORMS
----------------------------------------

- Use **React Router** for navigation; guard protected routes with OKTA.
- Use a form library (React Hook Form) with schema validation (Zod/Yup) for non-trivial forms.
- Validate input on the client for UX, but never rely on client validation for security — the API is the authority.

----------------------------------------
ACCESSIBILITY & UX
----------------------------------------

- Meet **WCAG 2.1 AA**: semantic HTML, labels, keyboard navigation, focus management, and ARIA only when needed.
- Provide explicit loading, empty, and error states for all async UI.
- Ensure color contrast and responsive layouts suitable for enterprise desktop use.

----------------------------------------
SECURITY (FRONTEND)
----------------------------------------

- Never store secrets, client secrets, or long-lived credentials in the SPA or source control.
- Avoid `dangerouslySetInnerHTML`; if unavoidable, sanitize with a vetted library (DOMPurify).
- Keep dependencies current; avoid packages with known vulnerabilities.
- Do not log tokens, PII, or sensitive payloads to the console.
- Enforce least-privilege scopes in OKTA token requests.

----------------------------------------
OBSERVABILITY
----------------------------------------

- Use a centralized logging/telemetry approach (e.g., Application Insights JS SDK) for errors and key user events.
- Add error boundaries around major route/feature areas to prevent full-app crashes.
- Propagate a correlation id header on API calls when the backend supports distributed tracing.

----------------------------------------
CONFIGURATION
----------------------------------------

- Read all environment-specific values (API base URLs, OKTA issuer/clientId, feature flags) from environment variables / runtime config.
- Maintain separate configs per environment (dev/test/prod); never hardcode environment URLs.

----------------------------------------
TESTING
----------------------------------------

- Use **Vitest/Jest** + **React Testing Library** for component and hook tests; test behavior, not implementation details.
- Mock the API client / network layer (e.g., MSW) — do not hit real APIs in unit tests.
- Cover loading, success, empty, and error states, plus auth-guarded behavior.
- Add end-to-end coverage (Playwright/Cypress) for critical authenticated flows when appropriate.

----------------------------------------
DO NOT
----------------------------------------

- Do not connect to SQL databases directly from the browser.
- Do not use the OIDC implicit flow or hand-rolled token storage.
- Do not call `fetch`/`axios` directly inside components.
- Do not store server state in global client stores when React Query suffices.
- Do not hardcode secrets, org URLs, or environment-specific values.
- Do not use class components or plain JavaScript for new code.
- Do not add dependencies unless strictly necessary.
