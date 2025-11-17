# Commit message conventions

This document describes the standard commit message format used in this repository. It follows the Conventional Commits style to produce clear, machine-readable messages that work well with changelogs and release tooling.
 
## Summary (contract)
- Input: a single commit message per change.
- Output: a concise subject and optional body describing the change; optional footer for metadata (e.g. `BREAKING CHANGE`).
- Success criteria: commit messages are consistent, short subject lines (<=72 chars), use appropriate type, and are written in the imperative mood.

## Format
A commit message MUST follow this structure:

<type>(scope?): subject

[blank line]
[optional body]

[optional footer(s)]

- `type` is required and lower-case (see types below).
- `scope` is optional and should be a noun identifying the area (e.g. `server`, `communications`, `build`).
- `subject` is a short imperative description (no trailing period), max ~72 characters.
- `body` (optional) explains the motivation and contrasts with previous behavior.
- `footer` (optional) contains metadata such as `BREAKING CHANGE:` or references to issues.

## Common types
- feat: A new feature
- fix: A bug fix
- docs: Documentation only changes
- style: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc.)
- refactor: A code change that neither fixes a bug nor adds a feature
- perf: A code change that improves performance
- test: Adding or updating tests
- chore: Changes to the build process or auxiliary tools and libraries such as documentation generation
- build: Changes that affect the build system or external dependencies (example scopes: gradle, npm)
- ci: Continuous Integration related changes (CI config, GitHub Actions, workflows)
- revert: Reverts a previous commit (use with full commit reference)

## Breaking changes
There are two ways to mark a breaking change:
1. Add a `!` after the type/scope: `feat!: change API` or `feat(auth)!: remove token`.
2. Use the footer with `BREAKING CHANGE:` followed by an explanation.

Example footer:

BREAKING CHANGE: the `connect()` function now requires an options object instead of a port number.

## Examples
Single-line commit (preferred for small changes):

```
feat(proxy): add support for TLS passthrough
```

Multi-line commit with body:

```
fix(communications): handle missing player name in sync

Some servers may send player objects without `name`. This change guards
against that and logs an informative warning instead of throwing.

Closes: #123
```

Breaking change example using footer:

```
refactor(auth): rework token validation

Tokens are now opaque JWTs and are validated against an issuer.

BREAKING CHANGE: old session tokens are not compatible with the new format.
```

Revert example:

```
revert: revert "feat(ui): add dark mode"

This reverts commit abc1234 because the approach caused rendering regressions.
```

## Scopes (suggested for this repo)
Suggested scopes for clarity in this project:
- `communications` — the communications service
- `servers` or `anarchy`, `hub`, `proxy`, `parkour` — server modules
- `plugins` — plugin-specific changes
- `web` or `site` — web frontend
- `build` — scripts and build tooling
- `docs` — repository docs

Use scopes sparingly; prefer meaningful, short names.

## Style rules
- Use imperative mood in the subject: "add", "fix", "update".
- Keep the subject concise and lower-case type.
- Do not end the subject line with a period.
- Separate subject from body with a blank line.
- Wrap body at ~72 characters per line for readability.

## When to use `chore` vs `build` vs `ci` vs `refactor`
- `chore`: small repository maintenance or non-production-facing changes (e.g., bump a dev dependency, update README snippets)
- `build`: changes that affect building or packaging (tooling, dependency updates that affect bundling)
- `ci`: updates to CI pipelines and workflows
- `refactor`: code changes that alter structure but not behavior

## Troubleshooting and tips
- If you accidentally made a bad commit message, use `git commit --amend` (if the commit is local and not pushed) to fix it.
- For already-pushed commits, prefer creating a new commit that documents the fix, unless you're prepared to `force push` and coordinate with collaborators.
