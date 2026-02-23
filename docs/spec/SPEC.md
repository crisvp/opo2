# Open Panopticon — Master Rebuild Specification

> This document is the single source of truth for the rebuild. All implementation decisions are final unless explicitly revised.

---

## 1. Project Overview

Open Panopticon is a platform for crowdsourcing public records related to government surveillance. Users upload or import documents (contracts, policies, meeting minutes, FOIA responses, etc.), which are automatically scanned, classified, and analyzed by an AI pipeline. Extracted metadata links documents to a catalog of vendors, products, technologies, government entities, people, and organizations. The platform presents a structured geographic overview of surveillance activity across US states, municipalities, and tribal territories.

### Who Uses It

| Role | Capabilities |
|------|-------------|
| **Anonymous visitor** | Browse approved documents, search, view location overviews |
| **Authenticated user** | Upload documents, manage drafts, review AI metadata, set profile/location preferences, manage API keys |
| **Moderator** | Approve/reject documents, manage catalog entries, manage categories/field definitions, manage agencies/state metadata |
| **Admin** | All moderator capabilities plus user management, tier management, job management, platform statistics |

### Core Purpose

1. Ingest public records (direct upload or DocumentCloud import)
2. Automatically classify and extract structured metadata via AI
3. Link documents to a unified catalog of surveillance entities
4. Present geographic overviews of surveillance activity by location
5. Enable community review and moderation of document metadata

---

## 2. Stack Decisions

These are final. Do not deviate.

### Frontend

| Concern | Choice | Notes |
|---------|--------|-------|
| Framework | **Vue 3** (Composition API, `<script setup>`) | |
| Language | **TypeScript** (strict mode) | |
| UI Components | **PrimeVue v4** (Aura theme) | |
| Styling | **Tailwind CSS v4** with existing semantic token system | No primitive color utilities; semantic tokens only |
| Server State | **TanStack Query (Vue Query)** | All server data fetching and caching |
| Client State | **Pinia** | Only for non-server state (UI state, form wizards, filter state) |
| Routing | **Vue Router** (history mode) | |
| Validation | **Zod** (shared schemas) | |
| PDF Viewing | **vue-pdf-embed** + **pdfjs-dist** | |
| CSV Viewing | **papaparse** | |
| Fonts | **IBM Plex Sans** / **IBM Plex Mono** | Via @fontsource |
| Build | **Vite 7** | |
| Type Checking | **vue-tsc** | |

### Backend

| Concern | Choice | Notes |
|---------|--------|-------|
| Framework | **Fastify** | Replaces Hono. Plugin-based architecture. |
| Language | **TypeScript** (strict mode) | |
| Validation | **Zod** + **fastify-type-provider-zod** | Schemas define request/response types |
| Database | **PostgreSQL** with **Kysely** | Type-safe query builder |
| Authentication | **Better Auth** (session cookies only) | No JWT. Single auth mechanism. |
| Background Jobs | **Graphile Worker** | PostgreSQL-backed job queue |
| File Storage | **@aws-sdk/client-s3** | S3-compatible (RustFS in dev). Browser uploads via presigned URLs. |
| Virus Scanning | **clamscan** (production dependency) | |
| PDF Conversion | **LibreOffice** (Docker sidecar) | Isolated container — never runs on the API/worker host |
| LLM Integration | **OpenRouter** (HTTP client) | No @google/genai dependency |
| Rate Limiting | **@fastify/rate-limit** + **Redis** | Distributed rate limiting across PM2 cluster instances |
| ID Generation | **nanoid** | For all primary keys |
| Build | **rolldown-vite** | Server bundling |
| Process Manager | **PM2** | Production deployment (cluster mode) |

### Shared Package

| Concern | Choice | Notes |
|---------|--------|-------|
| Validation | **Zod** | Source of truth for all types |
| Language | **TypeScript** | |

### Worker

| Concern | Choice | Notes |
|---------|--------|-------|
| Queue | **Graphile Worker** | |
| Worker API | **makeWorkerUtils()** public API preferred | Raw SQL fallback isolated in a single service module (`services/worker-admin.ts`) |

### Testing

| Concern | Choice | Notes |
|---------|--------|-------|
| Unit / Integration | **Vitest** | Shared validation, API routes, services |
| Component | **Vitest** + **Vue Test Utils** | Vue components and composables |
| E2E | **Playwright** | Critical user flows |

### Infrastructure (Development)

| Service | Purpose | Port |
|---------|---------|------|
| PostgreSQL | Primary data store | 5432 |
| Redis | Rate limiting, ALTCHA challenge dedup | 6379 |
| RustFS (S3) | Object storage | 9000/9001 |
| ClamAV | Virus scanning | 3310 |
| LibreOffice | PDF conversion (isolated sidecar) | — (internal only) |
| Adminer | Database admin GUI | 8080 |

PostgREST and Swagger are removed. No GraphQL layer exists in the rebuild.

---

## 3. Architectural Principles

1. **Every layer is explicit and typed.** No `as any` casts, no untyped object mutation, no implicit contracts between layers. Zod schemas are the single source of truth — database schemas, API types, and frontend types all derive from them.

2. **One pattern per concern.** There is exactly one way to define an endpoint, one way to fetch server data in the frontend, one way to validate input, one way to handle errors. No variation.

3. **REST only.** All API communication is REST over HTTP. No GraphQL. No hybrid approaches.

4. **Session cookies only.** Authentication uses a single mechanism: httpOnly session cookies via Better Auth. No JWT tokens.

5. **Tests are written alongside each feature, not after.** Every feature implementation includes unit tests for validation logic, integration tests for API endpoints, and component tests for interactive UI. E2E tests cover critical user flows.

6. **Separation of concerns in state management.** TanStack Query owns all server state (fetching, caching, invalidation). Pinia stores own only client-side UI state (form wizards, filter selections, sidebar toggles). Never duplicate server data into Pinia.

7. **No dead code.** No deprecated exports, no backward-compatibility aliases, no V1/V2 schema variants. Each concept has exactly one representation.

8. **Secrets are never hardcoded.** All secrets (ALTCHA HMAC key, API key encryption secret, trusted origins) are required environment variables. The init script generates them automatically. No fallback defaults.

9. **User deletion anonymizes, does not destroy.** When an admin "deletes" a user, the application sets `uploader_id` to NULL on all their documents, then deletes the user record. The FK uses `ON DELETE SET NULL`. Documents and S3 files are preserved; the uploader is displayed as "Deleted User" in the UI when `uploader_id` is NULL.

10. **If something is unclear, stop and flag it.** Claude must not invent conventions not specified in this document or in CONVENTIONS.md. If a requirement is ambiguous, add a `⚠️ STILL UNCLEAR` flag and ask.

11. **File uploads never pass through the API server.** Browsers upload directly to S3 via presigned POST URLs. Fastify only generates the URL and later receives the S3 object key to create the database record. This keeps large binaries out of the Node.js event loop.

12. **Untrusted file processing runs in isolation.** LibreOffice runs inside a locked-down Docker sidecar container with no network access and an unprivileged user. The worker sends files via S3 and receives converted PDFs back. LibreOffice never runs on the API or worker host.

13. **Do not invent cryptography.** All cryptographic formats (encryption storage, key derivation, nonce generation) are explicitly specified. Use only the formats defined in DATA_SPEC.md. Never design a novel crypto scheme.

---

## 4. Monorepo Structure

```
/
├── packages/
│   ├── server/          # Fastify API + Graphile Worker
│   ├── web/             # Vue 3 SPA
│   └── shared/          # Zod schemas, types, constants, validation
├── docker-compose.yml   # Dev services (PostgreSQL, RustFS, ClamAV, Adminer)
├── ecosystem.config.cjs # PM2 production config
├── pnpm-workspace.yaml
├── package.json         # Root scripts, shared dev dependencies
├── tsconfig.json
├── eslint.config.js
└── prettier.config.js
```

---

## 5. Key Decisions Record

Each decision references the original question from the audit.

| ID | Decision | Rationale |
|----|----------|-----------|
| ARCH-1 | Remove PostgREST/Swagger from docker-compose | Unused. Application uses Fastify REST API. |
| ARCH-2 | REST-only API via Fastify | Eliminates dual API surface, dual auth, PostGraphile RC dependency. Simpler, fully typed. |
| ARCH-3 | Session cookies only (no JWT) | Single auth mechanism. Better Auth handles sessions natively with Fastify. |
| ARCH-4 | Drop PostGraphile entirely | Replaced by typed Fastify routes with Kysely queries. |
| ARCH-5 | Use rolldown-vite for server bundling | Addresses the beta dependency concern with the Vite ecosystem integration. |
| ARCH-6 | TanStack Query for all server state | Replaces both URQL and Pinia Colada. Single, mature, well-documented caching layer. |
| DATA-1 | Unified catalog only; remove legacy type files | vendor.ts, product.ts, technology.ts are dead code. Catalog entries with type_id is the model. |
| DATA-2 | People and organizations are catalog entity types | They are attributes of documents, managed through the unified catalog system. Need UI in catalog management. |
| DATA-3 | Unified mentions system | document_mentions links to catalog_entries via resolved_entry_id. All entity types use the same table. |
| DATA-4 | Location preference via REST only | Single path. No dual REST/GraphQL. |
| DATA-5 | Fresh database schema (single initial migration) | 70 migrations with fixes-of-fixes are replaced by one clean schema. |
| DEP-1 | Remove @google/genai | Unused. LLM integration uses OpenRouter HTTP client. |
| DEP-2 | clamscan is a production dependency | It runs in the worker process, which is production code. |
| DEP-3 | Drop all GraphQL codegen dependencies | No GraphQL in the rebuild. |
| DEP-4 | Continue with PrimeVue v4 + Aura theme | Existing semantic token system works well with it. |
| FEAT-1 | Simplified AI review flow | Linear: upload → AI analysis → user review → optional moderator review → published. No guided wizard. |
| FEAT-2 | Draft expiration: 14 days, cleanup hourly | Clear policy, automated enforcement. |
| FEAT-3 | Minimal home page | Sign in/up CTA for anonymous users; upload or search CTA for authenticated users. |
| FEAT-4 | Configurable policy types | Three defaults (purchasing, ALPR, surveillance) stored in database, admin-editable. |
| FEAT-5 | Document-to-document associations with UI | Active feature. UI for managing supersedes/amends/references/attachment_of relationships. |
| QUAL-1 | Tests: unit + integration + E2E | Vitest for unit/integration, Playwright for E2E. |
| QUAL-2 | Split admin handler into separate route files | Users, jobs, stats, processing — each gets its own plugin. |
| QUAL-3 | Split document store into focused concerns | Documents, tags, metadata, AI — each gets its own TanStack Query module. |
| QUAL-4 | Graphile Worker: public API first, raw SQL fallback in isolated module | `makeWorkerUtils()` for job operations. Raw SQL only for admin introspection, isolated in `services/worker-admin.ts`. |
| SEC-1 | Init script auto-generates ALTCHA HMAC key | No hardcoded defaults. |
| SEC-2 | Trusted origins fully configurable via env | `TRUSTED_ORIGINS` env var (comma-separated). No hardcoded localhost ports. |
| SEC-3 | User deletion: SET NULL on documents, then delete user | FK `ON DELETE SET NULL` on `documents.uploader_id`. Application NULLs the uploader, then deletes the user row. Documents and S3 files preserved. UI shows "Deleted User" when uploader is NULL. |

| SEC-4 | Presigned S3 uploads — files never pass through Fastify | Browser uploads directly to S3 via presigned POST URL. Fastify generates the URL and later receives the S3 key. |
| SEC-5 | LibreOffice runs in isolated Docker sidecar | Unprivileged container, no network, read-only filesystem except temp dir. Prevents RCE from malicious Office documents. |
| SEC-6 | AES-256-GCM storage format: base64(iv:authTag:ciphertext) | Single `encrypted_key` column stores all three components in a deterministic format. No separate columns. |
| SEC-7 | ALTCHA replay prevention via Redis TTL | Spent challenge salts stored in Redis with TTL matching challenge expiry. Prevents replay attacks. |
| SEC-8 | Redis-backed distributed rate limiting | @fastify/rate-limit with Redis store. Supports PM2 cluster mode. |
| SEC-9 | Worker job timeouts with dead-letter behavior | Each pipeline task has an explicit timeout. Timed-out jobs are marked FAILED and the document moves to PROCESSING_FAILED. |

---

## 6. Database Roles

| Role | Purpose | Login |
|------|---------|-------|
| `opo_admin` | Migrations, schema management | Yes |
| `opo_app` | Application queries (server + worker) | Yes |

RLS is enforced at the application layer via Kysely queries with explicit WHERE clauses, not via PostgreSQL SET ROLE. This is simpler and more debuggable than the previous PostGraphile RLS approach.

> **Note:** RLS policies may still be used as a defense-in-depth measure on sensitive tables (e.g., `documents`, `user_api_keys`), but the application does not rely on them for correctness. The Fastify middleware enforces access control.

---

## 7. Environment Variables

All required. No defaults for secrets.

| Variable | Purpose | Generated by init |
|----------|---------|-------------------|
| `DATABASE_URL` | PostgreSQL connection string | No (user-configured) |
| `S3_ENDPOINT` | S3-compatible storage URL | No |
| `S3_ACCESS_KEY` | S3 access key | No |
| `S3_SECRET_KEY` | S3 secret key | No |
| `S3_BUCKET` | S3 bucket name | No |
| `BETTER_AUTH_SECRET` | Better Auth session secret | Yes |
| `ALTCHA_HMAC_KEY` | ALTCHA challenge HMAC key | Yes |
| `API_KEY_ENCRYPTION_SECRET` | AES-256-GCM key for user API keys | Yes |
| `TRUSTED_ORIGINS` | Comma-separated allowed origins | No |
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `OPENROUTER_API_KEY` | System OpenRouter API key (optional) | No |
| `REDIS_URL` | Redis connection string | No |
| `CLAMAV_HOST` | ClamAV daemon host | No |
| `CLAMAV_PORT` | ClamAV daemon port | No |
| `LIBREOFFICE_SIDECAR_URL` | LibreOffice sidecar service URL (internal Docker network) | No |
