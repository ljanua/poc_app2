---
name: ce-backlog
description: >-
  Capture ideas and future features that still need to be planned as numbered
  markdown files in docs/backlog/. Use when the user says backlog, save for
  later, park an idea, future feature, or /ce-backlog — before brainstorming
  or planning.
argument-hint: "[optional: idea summary, or list|show|promote NNN]"
---

# /ce-backlog

Save ideas and future features that are **not ready to plan yet**. Each item is its own markdown file under `docs/backlog/` with a sequential item number in the filename.

This skill does **not** write requirements, implementation plans, or code. Downstream:

- `ce-brainstorm` — define WHAT to build
- `ce-plan` — define HOW to build
- `ce-ideate` — generate/rank options when the user wants AI-driven idea exploration first

## Usage

```text
/ce-backlog                              # Capture from conversation context
/ce-backlog [idea summary]               # Capture a stated idea
/ce-backlog list                         # List open backlog items
/ce-backlog show 003                     # Show one item
/ce-backlog promote 003                  # Hand off item 003 to ce-brainstorm
```

## Storage

| Rule | Value |
|------|--------|
| Directory | `docs/backlog/` (create if missing) |
| Filename | `NNN-kebab-slug.md` |
| Numbering | 3-digit zero-padded (`001`, `002`, …) |
| Next number | Max `NNN` among existing `docs/backlog/*.md` + 1; start at `001` if empty |
| Slug | Short kebab-case from the title (≤6 words); ASCII only |

Examples: `001-clip-export-csv.md`, `014-coach-digest-email.md`

Ignore non-matching files (e.g. `.gitkeep`, `README.md`) when computing the next number.

## Capture workflow

1. **Resolve the idea** — Prefer the user's argument. If empty, derive one clear idea from the latest conversation. If multiple distinct ideas are present, ask which to capture (or offer to capture each as a separate file). If still unclear, ask one short question.
2. **Deduplicate** — Skim existing `docs/backlog/*.md` titles/summaries. If a near-duplicate exists, show it and ask whether to update that file or add a new item.
3. **Assign number + slug** — Compute next `NNN` and a stable slug. Do not reuse numbers of deleted items unless the user explicitly asks to reclaim a gap.
4. **Write the file** — Use the template below. Keep it lightweight: enough to resume later, not a plan.
5. **Confirm** — Reply with the path and a one-line summary. Offer next steps: capture another, `list`, or `promote` into `ce-brainstorm`.

### Item template

```markdown
---
id: NNN
title: Short human title
status: open
created: YYYY-MM-DD
updated: YYYY-MM-DD
source: conversation | user | other
tags: []
---

# NNN — Short human title

## Idea

One or two paragraphs: what the feature/idea is.

## Why it matters

Who benefits and what problem it addresses. Optional if obvious.

## Notes

Bullets for constraints, related screens/APIs, open questions, or links to mocks/plans.
Do not invent requirements the user did not state.

## Out of scope (for now)

Optional. Things explicitly deferred or excluded.
```

`status` values: `open` | `planned` | `done` | `dropped`

When an item is promoted into a real plan, set `status: planned` and add a Notes bullet linking the plan path (repo-relative). Do not delete the backlog file unless the user asks.

## List / show

- **list** — Table or bullets: `NNN`, title, status, created. Default to `open` (+ `planned` if useful); include all statuses only if asked.
- **show NNN** — Read and summarize that file; offer edit or promote.

## Promote

For `promote NNN` (or when the user asks to plan a backlog item):

1. Read `docs/backlog/NNN-*.md`.
2. Confirm with the user that this is the item to develop.
3. Update frontmatter `status: planned` and `updated`.
4. Hand off to `ce-brainstorm` using the Idea / Why / Notes as the starting brief (do not skip straight to implementation unless the user explicitly asks for `ce-plan` / `ce-work`).

## Rules

- One idea per file.
- Never invent product scope beyond what the user said; put uncertainties under Notes.
- Never run `ce-plan` or implement from this skill alone.
- Use repo-relative paths in backlog notes.
- Do not commit unless the user asks.
