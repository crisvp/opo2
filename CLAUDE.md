# Open Panopticon — Claude Instructions

> This file is your law. Read it fully before writing a single line of code.
> When in doubt, stop and flag with ⚠️ rather than guess.

---

## Reference Material

All specifications live in `docs/spec/`:

| File               | Purpose                                                                       |
| ------------------ | ----------------------------------------------------------------------------- |
| `SPEC.md`          | Master spec — stack decisions, architectural principles, key decisions record |
| `FEATURES_SPEC.md` | Feature-by-feature acceptance criteria, API shapes, test requirements         |
| `DATA_SPEC.md`     | Canonical data model, Zod schemas, entity relationships                       |
| `API_SPEC.md`      | Complete REST API surface — every endpoint, request/response shape            |
| `CONVENTIONS.md`   | Coding conventions — file structure, naming, patterns                         |

Read the relevant spec file before implementing any feature, endpoint, or data model. Do not work from memory.

---

## Tools

- **context7**: Use for up-to-date documentation on any third-party library before implementing against it. Always consult context7 for: Better Auth, Fastify, Kysely, TanStack Query (Vue), PrimeVue v4, Graphile Worker, fastify-type-provider-zod.

---

## Plugins & Skills

Plugins are enabled in `.claude/settings.json`. Invoke skills via the `Skill` tool before acting.

| Plugin | Key skills / agents | When to use |
| --- | --- | --- |
| **superpowers** | `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `dispatching-parallel-agents`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review`, `finishing-a-development-branch` | Mandatory workflow gates — check `using-superpowers` for the full decision tree |
| **commit-commands** | `commit`, `commit-push-pr`, `clean_gone` | All git commit/push/PR operations |
| **frontend-design** | `frontend-design` | Building Vue components, pages, or UI features |
| **playwright** | Browser automation agent | E2E test writing and execution |
| **code-simplifier** | `code-simplifier` agent | Post-implementation cleanup and refactoring |
| **claude-md-management** | `revise-claude-md`, `claude-md-improver` | Updating this file after sessions |
| **claude-code-setup** | `claude-automation-recommender` | Reviewing/optimizing Claude Code setup |
| **serena** | Semantic code tools (`find_symbol`, `get_symbols_overview`, etc.) | Codebase navigation and symbol-level edits (MCP; requires network in sandbox) |
| **security-guidance** | Security review agent | Security-sensitive code and auth decisions |

---

## Agent Strategy

You are the orchestrator. Default model for subagents: `claude-sonnet-4-6`.

**Spawn a subagent for:**

- Implementing a fully-specified feature (spec is complete in FEATURES_SPEC.md)
- Writing tests for a completed module
- Implementing a CRUD endpoint where the API_SPEC.md entry is complete
- Scaffolding boilerplate for a new package or plugin

**Handle yourself (do not delegate) when:**

- Making architectural decisions not covered by the spec
- A subagent flags ambiguity or a ⚠️ STILL UNCLEAR item
- Integrating completed modules and resolving cross-package conflicts
- Debugging failures that span multiple layers
- Any decision involving security, cryptography, or auth

---

## Stack (Final — Do Not Deviate)

### Frontend (`packages/web`)

- Vue 3, Composition API, `<script setup>`, TypeScript strict
- PrimeVue v4 (Aura theme) — semantic tokens only, no primitive Tailwind color utilities
- Tailwind CSS v4
- TanStack Query (Vue Query) — all server state
- Pinia — non-server UI state only (form wizards, filter state, sidebar toggles)
- Vue Router (history mode)
- Zod (shared schemas from `packages/shared`)
- Vite 7, vue-tsc

### Backend (`packages/server`)

- Fastify, TypeScript strict, plugin-based architecture
- Zod + fastify-type-provider-zod — schemas define all request/response types
- PostgreSQL + Kysely (type-safe query builder)
- Better Auth — session cookies only, no JWT
- Graphile Worker — `makeWorkerUtils()` public API first; raw SQL fallback isolated in `services/worker-admin.ts` only
- @aws-sdk/client-s3 — presigned POST URLs for browser uploads; files never pass through Fastify
- @fastify/rate-limit + Redis — distributed rate limiting
- OpenRouter via HTTP client — no @google/genai
- nanoid — all primary keys
- rolldown-vite for server bundling, PM2 for production

### Shared (`packages/shared`)

- Zod schemas are the single source of truth for all types
- Database schemas, API types, and frontend types derive from shared Zod schemas

### Testing

- Vitest — unit and integration tests
- Vitest + Vue Test Utils — component and composable tests
- Playwright — E2E for critical user flows
- Tests are written alongside each feature, never after

---

## Architectural Principles (Enforced)

1. **No `as any`.** No untyped object mutation. No implicit contracts between layers.
2. **One pattern per concern.** One way to define an endpoint, one way to fetch server data, one way to handle errors. See CONVENTIONS.md.
3. **REST only.** No GraphQL. No hybrid approaches.
4. **Session cookies only.** No JWT tokens anywhere.
5. **Tests alongside features.** Every feature: unit tests for validation, integration tests for endpoints, component tests for interactive UI.
6. **TanStack Query owns server state. Pinia owns UI state.** Never duplicate server data into Pinia.
7. **No dead code.** No deprecated exports, no backward-compatibility aliases, no V1/V2 variants.
8. **No hardcoded secrets.** All secrets are required environment variables. See SPEC.md §7.
9. **Files never pass through Fastify.** Browser → S3 via presigned POST. Fastify generates the URL and receives the key.
10. **LibreOffice runs in isolated Docker sidecar only.** Never on the API or worker host.
11. **No invented cryptography.** Use only the formats defined in DATA_SPEC.md. AES-256-GCM storage: `base64(iv:authTag:ciphertext)`.
12. **User deletion anonymizes, does not destroy.** SET NULL on `documents.uploader_id`, then delete user row. Documents and S3 files preserved.

---

## Monorepo Structure

```text
/
├── packages/
│   ├── server/          # Fastify API + Graphile Worker
│   ├── web/             # Vue 3 SPA
│   └── shared/          # Zod schemas, types, constants
├── reference/           # READ-ONLY. Old codebase + specs. Never modify.
│   └── docs/rebuild/spec/
├── docker-compose.yml
├── ecosystem.config.cjs
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.json
├── eslint.config.js
└── prettier.config.js
```

**`reference/` is read-only.** Use it to understand existing behavior and read specs. Never write to it, never copy patterns from the old codebase unless the spec explicitly endorses them.

---

## Build Sequence

Implement features in priority order as defined in FEATURES_SPEC.md (1-HIGH before 2-MEDIUM before 3-LOW).

Within each feature, the sequence is:

1. Shared Zod schemas (`packages/shared`)
2. Database migration (if required)
3. Kysely types derived from schema
4. Fastify route(s) with tests
5. TanStack Query composable(s) with tests
6. Vue component(s) with tests
7. E2E test (if the feature is a critical user flow)

Do not move to the next feature until the current one has passing tests.

---

## Flagging Rules

If any of the following occur, stop and flag with ⚠️ before proceeding:

- A requirement is ambiguous or missing from the spec
- Two spec documents appear to contradict each other
- A dependency is missing from package.json
- A security, cryptography, or auth decision is not explicitly covered
- A subagent returns something that conflicts with CONVENTIONS.md
- You are about to write code you are not confident is correct

Format flags as:

```text
⚠️ STILL UNCLEAR: [short title]
File: [where you encountered it]
Issue: [what is ambiguous or missing]
Options: [if applicable]
```

---

## What You Must Never Do

- Write `as any` or suppress TypeScript errors with `@ts-ignore`
- Invent a convention not in CONVENTIONS.md
- Access `reference/` for anything other than reading
- Write to `reference/` under any circumstances
- Use JWT for authentication
- Route file uploads through Fastify
- Run LibreOffice outside the Docker sidecar
- Hardcode secrets or use fallback defaults for secrets
- Use GraphQL
- Use `@google/genai`
- Use PostgREST
- Write a feature without writing its tests
- Commit broken tests
