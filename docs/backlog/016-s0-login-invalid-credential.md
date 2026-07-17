---
id: "016"
title: S0 login error — Invalid credential
status: open
created: 2026-07-15
updated: 2026-07-15
source: user
tags: [s0, auth, copy]
---

# 016 — S0 login error — Invalid credential

## Idea

On failed login, replace the error copy **"You do not have permission to perform this action"** with **"Invalid credential"**.

## Why it matters

Permission wording is misleading for bad email/password; users need a clear credential failure message.

## Notes

- Surface today: `docs/ux/mockup/S0-login.html` (`#loginError` placeholder text) and whatever `MockupApi.login` returns on failure in `docs/ux/mockup/js/mockup-api-client.js`.
- Keep the change scoped to **login** failure messaging; do not retarget the shared 403 “forbidden” strings used elsewhere unless planning later expands scope.
- Exact user wording: `Invalid credential` (singular).
