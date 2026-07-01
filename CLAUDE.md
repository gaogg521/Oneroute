# CLAUDE.md — Project Conventions for new-api

## Session Bootstrap — READ `CONTEXT.md` FIRST

Before doing any work in a new session (including after disconnects, client switches, or model changes), **read the root-level [`CONTEXT.md`](./CONTEXT.md) in full**. It is the rolling, up-to-date log of current work progress, pending tasks, in-flight decisions, and gotchas. This `CLAUDE.md` holds the *permanent* project rules; `CONTEXT.md` holds the *current* project state. Both are authoritative for their respective scope — do not let them drift out of sync. After finishing a development phase, append a one-line progress summary to `CONTEXT.md` so the next session can resume seamlessly.

## Overview

This is an AI API gateway/proxy built with Go. It aggregates 40+ upstream AI providers (OpenAI, Claude, Gemini, Azure, AWS Bedrock, etc.) behind a unified API, with user management, billing, rate limiting, and an admin dashboard.

## Tech Stack

- **Backend**: Go 1.22+, Gin web framework, GORM v2 ORM
- **Frontend**: React 19, TypeScript, Rsbuild, Base UI, Tailwind CSS
- **Databases**: SQLite, MySQL, PostgreSQL (all three must be supported)
- **Cache**: Redis (go-redis) + in-memory cache
- **Auth**: JWT, WebAuthn/Passkeys, OAuth (GitHub, Discord, OIDC, etc.)
- **Frontend package manager**: Bun (preferred over npm/yarn/pnpm)

## Architecture

Layered architecture: Router -> Controller -> Service -> Model

```
router/        — HTTP routing (API, relay, dashboard, web)
controller/    — Request handlers
service/       — Business logic
model/         — Data models and DB access (GORM)
relay/         — AI API relay/proxy with provider adapters
  relay/channel/ — Provider-specific adapters (openai/, claude/, gemini/, aws/, etc.)
middleware/    — Auth, rate limiting, CORS, logging, distribution
setting/       — Configuration management (ratio, model, operation, system, performance)
common/        — Shared utilities (JSON, crypto, Redis, env, rate-limit, etc.)
dto/           — Data transfer objects (request/response structs)
constant/      — Constants (API types, channel types, context keys)
types/         — Type definitions (relay formats, file sources, errors)
i18n/          — Backend internationalization (go-i18n, en/zh)
oauth/         — OAuth provider implementations
pkg/           — Internal packages (cachex, ionet)
web/             — Frontend themes container
 web/default/   — Default frontend (React 19, Rsbuild, Base UI, Tailwind)
  web/classic/   — Classic frontend (React 18, Vite, Semi Design)
  web/default/src/i18n/ — Frontend internationalization (i18next, zh/en/fr/ru/ja/vi)
```

## Internationalization (i18n)

### Backend (`i18n/`)
- Library: `nicksnyder/go-i18n/v2`
- Languages: en, zh

### Frontend (`web/default/src/i18n/`)
- Library: `i18next` + `react-i18next` + `i18next-browser-languagedetector`
- Languages: en (base), zh (fallback), fr, ru, ja, vi
- Translation files: `web/default/src/i18n/locales/{lang}.json` — flat JSON, keys are English source strings
- Usage: `useTranslation()` hook, call `t('English key')` in components
- CLI tools: `bun run i18n:sync` (from `web/default/`)

## Rules

### Rule 1: JSON Package — Use `common/json.go`

All JSON marshal/unmarshal operations MUST use the wrapper functions in `common/json.go`:

- `common.Marshal(v any) ([]byte, error)`
- `common.Unmarshal(data []byte, v any) error`
- `common.UnmarshalJsonStr(data string, v any) error`
- `common.DecodeJson(reader io.Reader, v any) error`
- `common.GetJsonType(data json.RawMessage) string`

Do NOT directly import or call `encoding/json` in business code. These wrappers exist for consistency and future extensibility (e.g., swapping to a faster JSON library).

Note: `json.RawMessage`, `json.Number`, and other type definitions from `encoding/json` may still be referenced as types, but actual marshal/unmarshal calls must go through `common.*`.

### Rule 2: Database Compatibility — SQLite, MySQL >= 5.7.8, PostgreSQL >= 9.6

All database code MUST be fully compatible with all three databases simultaneously.

**Use GORM abstractions:**
- Prefer GORM methods (`Create`, `Find`, `Where`, `Updates`, etc.) over raw SQL.
- Let GORM handle primary key generation — do not use `AUTO_INCREMENT` or `SERIAL` directly.

**When raw SQL is unavoidable:**
- Column quoting differs: PostgreSQL uses `"column"`, MySQL/SQLite uses `` `column` ``.
- Use `commonGroupCol`, `commonKeyCol` variables from `model/main.go` for reserved-word columns like `group` and `key`.
- Boolean values differ: PostgreSQL uses `true`/`false`, MySQL/SQLite uses `1`/`0`. Use `commonTrueVal`/`commonFalseVal`.
- Use `common.UsingMainDatabase(common.DatabaseTypeX)` for primary-database branches and `common.UsingLogDatabase(common.DatabaseTypeX)` for log-database branches (log DB can now also be ClickHouse). The old `common.UsingPostgreSQL`/`common.UsingSQLite`/`common.UsingMySQL`/`common.LogSqlType` globals no longer exist.

**Forbidden without cross-DB fallback:**
- MySQL-only functions (e.g., `GROUP_CONCAT` without PostgreSQL `STRING_AGG` equivalent)
- PostgreSQL-only operators (e.g., `@>`, `?`, `JSONB` operators)
- `ALTER COLUMN` in SQLite (unsupported — use column-add workaround)
- Database-specific column types without fallback — use `TEXT` instead of `JSONB` for JSON storage

**Migrations:**
- Ensure all migrations work on all three databases.
- For SQLite, use `ALTER TABLE ... ADD COLUMN` instead of `ALTER COLUMN` (see `model/main.go` for patterns).

### Rule 3: Frontend — Prefer Bun

Use `bun` as the preferred package manager and script runner for the frontend (`web/default/` directory):
- `bun install` for dependency installation
- `bun run dev` for development server
- `bun run build` for production build
- `bun run i18n:*` for i18n tooling

### Rule 4: New Channel StreamOptions Support

When implementing a new channel:
- Confirm whether the provider supports `StreamOptions`.
- If supported, add the channel to `streamSupportedChannels`.

### Rule 6: Upstream Relay Request DTOs — Preserve Explicit Zero Values

For request structs that are parsed from client JSON and then re-marshaled to upstream providers (especially relay/convert paths):

- Optional scalar fields MUST use pointer types with `omitempty` (e.g. `*int`, `*uint`, `*float64`, `*bool`), not non-pointer scalars.
- Semantics MUST be:
  - field absent in client JSON => `nil` => omitted on marshal;
  - field explicitly set to zero/false => non-`nil` pointer => must still be sent upstream.
- Avoid using non-pointer scalars with `omitempty` for optional request parameters, because zero values (`0`, `0.0`, `false`) will be silently dropped during marshal.

### Rule 7: Billing Expression System — Read `pkg/billingexpr/expr.md`

When working on tiered/dynamic billing (expression-based pricing), you MUST read `pkg/billingexpr/expr.md` first. It documents the design philosophy, expression language (variables, functions, examples), full system architecture (editor → storage → pre-consume → settlement → log display), token normalization rules (`p`/`c` auto-exclusion), quota conversion, and expression versioning. All code changes to the billing expression system must follow the patterns described in that document.

### Rule 8: Pull Requests — Identify AI-Generated Contributions When Appropriate

When creating a pull request:

- First compare the current git user (`git config user.name` / `git config user.email`) with the repository's historical core developers (for example, the recurring top authors in `git log`). Do not change git config.
- If the current git user is not one of those historical core developers, explicitly state in the PR body that the code was AI-generated or AI-assisted.
- Always use the repository PR template at `.github/PULL_REQUEST_TEMPLATE.md` when drafting the PR title/body. Preserve the template structure and fill in the relevant sections instead of replacing it with an ad hoc format.

### Rule 9: Syncing with Upstream (`origin` = QuantumNous/new-api)

`origin` is the real upstream repo, not a fork remote. When merging new upstream commits (`git merge origin/main`) into this fork, follow these 4 principles in order:

1. **Keep the local `CLAUDE.md` as-is.** Never adopt upstream's version of this file — it documents this fork's own conventions, including this rule.
2. **Do not break locally-added features** (team management `/team`, enterprise team `/teamv3` + `/admin-teamv3`, Antom payment gateway, docs center `/docs`, home page redesign, model-pricing visual-editor Save-button fix, etc.). When a conflicting file was rewritten upstream, take upstream's version as the base and re-apply the local feature on top of it — don't just pick one side wholesale.
3. **Do not overwrite existing local data or docs.** `CONTEXT.md` is local-only (not tracked upstream, so it never conflicts) — never let a merge step discard it or other project-specific documentation.
4. **Everything else — new features and bug fixes — should be accepted from upstream by default.** Don't reject upstream changes just because they touch a file we've also customized; reconcile them instead of picking "ours" wholesale.

**After merging, verify before calling it done:**
- `go build -o new-api.exe .` — zero errors
- `cd web/default && bun run typecheck && bun run build` — zero errors (regenerate `web/default/src/routeTree.gen.ts` via the build rather than hand-merging it)
- `grep -rln "common\.UsingPostgreSQL\|common\.UsingMySQL\|common\.UsingSQLite\|common\.LogSqlType"` across the repo — these globals were renamed to `common.UsingMainDatabase(...)` / `common.UsingLogDatabase(...)`; any hit is a stale reference from an auto-merged hunk that needs updating
- i18n locale JSON conflicts (`web/default/src/i18n/locales/*.json`): 3-way merge by key (union, don't pick one side), then run `bun run i18n:sync`
- Functional smoke test in a browser (logged in as an admin): home page, `/team`, `/teamv3`, `/admin-teamv3`, `/docs`, `/system-settings/billing/payment` (Antom tab + enabled toggle), `/system-settings/billing/model-pricing`, and at least one non-Chinese locale

**Playbook (the workflow that worked well for a 128-commit sync):**

1. **Scope the conflict before committing to anything.** Don't just run `git merge` and hope. First get a true picture:
   - If there's uncommitted work, snapshot it non-destructively with `git stash create` (this returns a commit hash *without* touching the working tree or the index — safe to run anytime).
   - Run `git merge-tree --write-tree <snapshot-or-HEAD> origin/main` (git ≥2.38). It prints every conflicting file and an `Auto-merging`/`CONFLICT` line per path, with zero side effects. This tells you the real conflict count and file list before you've committed to anything, so you can plan instead of discovering scope mid-merge.
   - For each conflict candidate, compare diff sizes on both sides — `git diff <merge-base> <ours>` vs `git diff <merge-base> origin/main` for that path. A file where upstream changed 5,000 lines and we changed 5 is a different problem (take theirs, re-apply our 5 lines) than a file where both sides changed ~50 lines (real line-level reconciliation).
2. **Commit uncommitted local work first**, excluding stray build/log artifacts, so the merge has a clean, recoverable starting point and nothing can be lost mid-merge.
3. **Do the merge on a throwaway branch**, not `main`. Only fast-forward/merge into `main` after the full verification pass below succeeds.
4. **Resolve conflicts by category** (see the table of examples in this rule's history / recent merge commits for concrete instances):
   - Docs/config we own → `git checkout --ours -- <path>`.
   - Generated files → `git checkout --theirs -- <path>` as a placeholder, then regenerate for real via the build.
   - Comparable-size diffs both sides → open the file, resolve conflict markers by hand, keep both sides' intent.
   - Upstream rewrote the file, we made a small patch → `git checkout --theirs -- <path>` first, then re-read our pre-merge diff (`git diff <merge-base> <our-checkpoint-commit> -- <path>`) and manually re-apply that same *intent* on top of the new structure (upstream may have moved things into tabs, renamed a helper, split a component — adapt, don't paste blindly).
   - Large additive flat dictionaries (i18n locale JSON) → don't hand-edit conflict markers. Write a short throwaway Node script that reads base/ours/theirs via `git show <rev>:<path>`, unions the keys, prefers whichever side actually changed a key (both-sides-changed keys are rare for pure translation additions — log them for a manual look rather than guessing silently), and writes the merged JSON. Then run the project's own `i18n:sync` tool to normalize.
5. **Don't try to manually enumerate every renamed symbol.** Spot-check a couple of files with the old API name to gauge blast radius, but the real safety net is `go build` / `bun run typecheck` after all conflicts are resolved — the compiler finds every stale reference precisely. Fix what it reports, rebuild, repeat until clean.
6. **Verify functionally in a real browser session before landing on `main`**, not just "it compiles." A clean build proves the code is well-typed, not that the feature you were protecting still renders/works.
