# Coding Conventions — Open Panopticon Rebuild

> This document is law during the rebuild. Every file must conform to it. If something is not covered here, stop and ask rather than inventing a convention.

---

## 1. Project Structure

```
/
├── packages/
│   ├── server/
│   │   ├── src/
│   │   │   ├── index.ts                    # Server entry point
│   │   │   ├── app.ts                      # Fastify app factory
│   │   │   ├── auth.ts                     # Better Auth configuration
│   │   │   ├── plugins/
│   │   │   │   ├── auth.ts                 # Auth plugin (session extraction, decorators)
│   │   │   │   ├── cors.ts                 # CORS configuration
│   │   │   │   ├── rate-limit.ts           # @fastify/rate-limit + Redis
│   │   │   │   └── error-handler.ts        # Global error handler
│   │   │   ├── routes/
│   │   │   │   ├── documents/
│   │   │   │   │   ├── index.ts            # Route registration
│   │   │   │   │   ├── upload.ts           # POST /api/documents/initiate + confirm-upload
│   │   │   │   │   ├── list.ts             # GET /api/documents
│   │   │   │   │   ├── detail.ts           # GET /api/documents/:id
│   │   │   │   │   ├── update.ts           # PUT /api/documents/:id
│   │   │   │   │   ├── files.ts            # preview, download
│   │   │   │   │   ├── tags.ts             # Tag operations
│   │   │   │   │   ├── associations.ts     # Catalog association operations
│   │   │   │   │   ├── metadata.ts         # Metadata operations
│   │   │   │   │   ├── ai-metadata.ts      # AI extraction endpoints
│   │   │   │   │   ├── moderation.ts       # approve, reject
│   │   │   │   │   └── related.ts          # Document-document associations
│   │   │   │   ├── catalog/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── entries.ts
│   │   │   │   │   ├── aliases.ts
│   │   │   │   │   ├── search.ts
│   │   │   │   │   └── types.ts
│   │   │   │   ├── categories/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── categories.ts
│   │   │   │   │   ├── fields.ts
│   │   │   │   │   └── rules.ts
│   │   │   │   ├── locations/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── states.ts
│   │   │   │   │   ├── places.ts
│   │   │   │   │   ├── tribes.ts
│   │   │   │   │   ├── nearest.ts
│   │   │   │   │   └── overview.ts
│   │   │   │   ├── admin/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── stats.ts
│   │   │   │   │   ├── users.ts
│   │   │   │   │   ├── failed-processing.ts
│   │   │   │   │   ├── stuck-processing.ts
│   │   │   │   │   └── jobs.ts
│   │   │   │   ├── profile/
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── location.ts
│   │   │   │   │   ├── usage.ts
│   │   │   │   │   └── api-keys.ts
│   │   │   │   ├── tiers.ts
│   │   │   │   ├── agencies.ts
│   │   │   │   ├── state-metadata.ts
│   │   │   │   ├── policy-types.ts
│   │   │   │   ├── documentcloud.ts
│   │   │   │   ├── altcha.ts
│   │   │   │   ├── health.ts
│   │   │   │   └── sse.ts
│   │   │   ├── services/
│   │   │   │   ├── openrouter.ts           # LLM API client
│   │   │   │   ├── documentcloud.ts        # DocumentCloud API client
│   │   │   │   ├── libreoffice.ts          # LibreOffice sidecar HTTP client
│   │   │   │   ├── sse.ts                  # SSE connection manager
│   │   │   │   ├── usage.ts               # Tier/usage checking
│   │   │   │   ├── worker-admin.ts         # Graphile Worker admin queries (raw SQL isolated here)
│   │   │   │   └── storage.ts              # S3 file operations
│   │   │   ├── util/
│   │   │   │   ├── crypto.ts               # AES-256-GCM encryption
│   │   │   │   ├── db.ts                   # Database pool and Kysely instance
│   │   │   │   ├── redis.ts                # Redis client (ioredis)
│   │   │   │   ├── s3-client.ts            # S3 client initialization
│   │   │   │   └── id.ts                   # nanoid generation
│   │   │   ├── config/
│   │   │   │   ├── processing.ts           # Pipeline configuration
│   │   │   │   ├── llm-pipeline.ts         # LLM pipeline config loader
│   │   │   │   ├── llm-pipeline.yaml       # LLM pipeline config file
│   │   │   │   └── env.ts                  # Environment variable validation
│   │   │   └── jobs/
│   │   │       ├── worker.ts               # Graphile Worker setup
│   │   │       └── tasks/
│   │   │           ├── virus-scan.ts
│   │   │           ├── pdf-convert.ts
│   │   │           ├── sieve.ts
│   │   │           ├── extractor.ts
│   │   │           ├── pipeline-complete.ts
│   │   │           ├── cleanup-expired-drafts.ts
│   │   │           └── documentcloud-import.ts
│   │   ├── migrations/
│   │   │   └── 001_initial_schema.ts
│   │   ├── seeds/
│   │   │   ├── states.ts
│   │   │   ├── places.ts
│   │   │   ├── tribes.ts
│   │   │   └── reference-data.ts           # Categories, types, tiers, associations
│   │   ├── tests/
│   │   │   ├── routes/
│   │   │   │   ├── documents.test.ts
│   │   │   │   ├── catalog.test.ts
│   │   │   │   └── ...
│   │   │   ├── services/
│   │   │   │   └── ...
│   │   │   └── setup.ts                    # Test database setup/teardown
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   │
│   ├── web/
│   │   ├── src/
│   │   │   ├── main.ts                     # Vue app entry
│   │   │   ├── App.vue                     # Root component
│   │   │   ├── router/
│   │   │   │   └── index.ts                # Route definitions
│   │   │   ├── api/
│   │   │   │   ├── client.ts               # Fetch wrapper
│   │   │   │   └── queries/
│   │   │   │       ├── documents.ts         # TanStack Query: documents
│   │   │   │       ├── catalog.ts           # TanStack Query: catalog
│   │   │   │       ├── categories.ts        # TanStack Query: categories
│   │   │   │       ├── locations.ts         # TanStack Query: locations
│   │   │   │       ├── tiers.ts             # TanStack Query: tiers
│   │   │   │       ├── admin.ts             # TanStack Query: admin
│   │   │   │       ├── profile.ts           # TanStack Query: profile
│   │   │   │       ├── agencies.ts          # TanStack Query: agencies
│   │   │   │       ├── documentcloud.ts     # TanStack Query: DocumentCloud
│   │   │   │       └── moderation.ts        # TanStack Query: moderation
│   │   │   ├── stores/
│   │   │   │   ├── auth.ts                  # useAuthStore
│   │   │   │   ├── browse-filters.ts        # useBrowseFiltersStore
│   │   │   │   ├── upload-wizard.ts         # useUploadWizardStore
│   │   │   │   └── sidebar.ts              # useSidebarStore
│   │   │   ├── composables/
│   │   │   │   ├── useDocumentSSE.ts
│   │   │   │   ├── useRecentLocation.ts
│   │   │   │   └── useSidebarState.ts
│   │   │   ├── views/
│   │   │   │   ├── HomeView.vue
│   │   │   │   ├── LoginView.vue
│   │   │   │   ├── RegisterView.vue
│   │   │   │   ├── BrowseView.vue
│   │   │   │   ├── UploadView.vue
│   │   │   │   ├── MyUploadsView.vue
│   │   │   │   ├── DocumentDetailView.vue
│   │   │   │   ├── DocumentEditView.vue
│   │   │   │   ├── AiReviewView.vue
│   │   │   │   ├── ModerationView.vue
│   │   │   │   ├── ProfileView.vue
│   │   │   │   ├── SecuritySettingsView.vue
│   │   │   │   ├── TwoFactorView.vue
│   │   │   │   ├── DocumentCloudSearchView.vue
│   │   │   │   ├── locations/
│   │   │   │   │   ├── LocationsIndexView.vue
│   │   │   │   │   ├── StateBrowseView.vue
│   │   │   │   │   ├── LocationOverviewView.vue
│   │   │   │   │   └── TribalOverviewView.vue
│   │   │   │   └── admin/
│   │   │   │       ├── AdminView.vue
│   │   │   │       ├── AdminUsersView.vue
│   │   │   │       ├── AdminUserDetailView.vue
│   │   │   │       ├── AdminDocumentsView.vue
│   │   │   │       ├── CatalogManageView.vue
│   │   │   │       ├── DocumentTypesManageView.vue
│   │   │   │       ├── TierManageView.vue
│   │   │   │       ├── AdminAgenciesView.vue
│   │   │   │       ├── AdminStateMetadataView.vue
│   │   │   │       ├── FailedProcessingView.vue
│   │   │   │       └── JobsOverviewView.vue
│   │   │   ├── components/
│   │   │   │   ├── layout/
│   │   │   │   │   ├── AppSidebar.vue
│   │   │   │   │   ├── AppMobileHeader.vue
│   │   │   │   │   ├── AppBreadcrumbs.vue
│   │   │   │   │   └── AppFooter.vue
│   │   │   │   ├── documents/
│   │   │   │   │   ├── DocumentCard.vue
│   │   │   │   │   ├── DocumentPreviewPanel.vue
│   │   │   │   │   ├── DocumentMetadataPanel.vue
│   │   │   │   │   ├── DocumentAssociationsPanel.vue
│   │   │   │   │   ├── DocumentRelatedPanel.vue
│   │   │   │   │   ├── DocumentAssociationsEditor.vue
│   │   │   │   │   ├── DocumentEditForm.vue
│   │   │   │   │   ├── DynamicMetadataForm.vue
│   │   │   │   │   ├── PdfViewer.vue
│   │   │   │   │   ├── CsvViewer.vue
│   │   │   │   │   └── FileDropzone.vue
│   │   │   │   ├── catalog/
│   │   │   │   │   ├── CatalogEntrySelect.vue
│   │   │   │   │   ├── CatalogEntryForm.vue
│   │   │   │   │   ├── VendorProductSelector.vue
│   │   │   │   │   ├── GovernmentEntitySelector.vue
│   │   │   │   │   └── AliasManager.vue
│   │   │   │   ├── locations/
│   │   │   │   │   ├── LocationSelector.vue
│   │   │   │   │   ├── PlaceAutocomplete.vue
│   │   │   │   │   ├── TribeAutocomplete.vue
│   │   │   │   │   ├── GeolocationButton.vue
│   │   │   │   │   ├── LocationDisplay.vue
│   │   │   │   │   └── PolicyStatusCard.vue
│   │   │   │   ├── ai/
│   │   │   │   │   ├── AiSuggestionField.vue
│   │   │   │   │   ├── AiCatalogMatchesPanel.vue
│   │   │   │   │   └── AiExtractionStatus.vue
│   │   │   │   ├── admin/
│   │   │   │   │   ├── FieldDefinitionsManager.vue
│   │   │   │   │   ├── AssociationRulesManager.vue
│   │   │   │   │   └── JobDetailPanel.vue
│   │   │   │   ├── shared/
│   │   │   │   │   ├── SearchInput.vue
│   │   │   │   │   ├── TagInput.vue
│   │   │   │   │   ├── TierBadge.vue
│   │   │   │   │   ├── UsageLimitBar.vue
│   │   │   │   │   ├── ConfirmDialog.vue
│   │   │   │   │   └── EmptyState.vue
│   │   │   │   └── forms/
│   │   │   │       ├── CategoryForm.vue
│   │   │   │       ├── FieldDefinitionForm.vue
│   │   │   │       ├── AgencyForm.vue
│   │   │   │       ├── TierForm.vue
│   │   │   │       ├── StateMetadataForm.vue
│   │   │   │       └── ApiKeyForm.vue
│   │   │   ├── styles/
│   │   │   │   └── main.css                # Semantic tokens, Tailwind config
│   │   │   └── services/
│   │   │       └── authClient.ts            # Better Auth client
│   │   ├── tests/
│   │   │   ├── components/
│   │   │   │   └── ...
│   │   │   └── setup.ts
│   │   ├── e2e/
│   │   │   ├── auth.spec.ts
│   │   │   ├── upload.spec.ts
│   │   │   └── ...
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── vitest.config.ts
│   │   └── playwright.config.ts
│   │
│   └── shared/
│       ├── src/
│       │   ├── index.ts                    # Central export hub
│       │   ├── types/
│       │   │   ├── api.ts
│       │   │   ├── user.ts
│       │   │   ├── document.ts
│       │   │   ├── catalog.ts
│       │   │   ├── category.ts
│       │   │   ├── metadata.ts
│       │   │   ├── location.ts
│       │   │   ├── agency.ts
│       │   │   ├── tier.ts
│       │   │   ├── mentions.ts
│       │   │   ├── document-source.ts
│       │   │   └── document-associations.ts
│       │   └── constants/
│       │       ├── roles.ts
│       │       ├── status.ts
│       │       └── tiers.ts
│       ├── tests/
│       │   ├── validation.test.ts
│       │   └── status.test.ts
│       ├── package.json
│       └── tsconfig.json
```

---

## 2. Naming Conventions

### Files

| Type | Convention | Example |
|------|-----------|---------|
| Vue view | PascalCase + `View` suffix | `DocumentDetailView.vue` |
| Vue component | PascalCase | `DocumentCard.vue` |
| Composable | camelCase with `use` prefix | `useDocumentSSE.ts` |
| Pinia store | camelCase with `use` prefix + `Store` suffix | `useAuthStore` in `auth.ts` |
| TanStack Query file | camelCase, domain name | `documents.ts` in `api/queries/` |
| Fastify route file | kebab-case | `ai-metadata.ts` |
| Service | camelCase | `openrouter.ts` |
| Type/schema file | kebab-case | `document-associations.ts` |
| Test file | same name + `.test.ts` or `.spec.ts` | `documents.test.ts` |
| E2E test | kebab-case + `.spec.ts` | `auth.spec.ts` |

### Code

| Type | Convention | Example |
|------|-----------|---------|
| TypeScript types | PascalCase | `DocumentListItem` |
| Zod schemas | camelCase + `Schema` suffix | `createDocumentSchema` |
| Constants | UPPER_SNAKE_CASE (object), PascalCase (enum-like values) | `DOCUMENT_STATE`, `ROLES` |
| Functions | camelCase | `formatPlaceDisplayName` |
| Database columns | snake_case | `uploader_id`, `created_at` |
| API endpoints | kebab-case | `/api/documents/:id/ai-metadata` |
| Query keys | array of strings | `["documents", "detail", id]` |
| Vue props | camelCase | `documentId`, `isLoading` |
| Vue emits | camelCase | `update`, `delete`, `select` |
| CSS custom properties | `--<category>-<name>` | `--color-text-primary` |

### Component naming rules

- Views (routed pages) always end in `View`: `BrowseView.vue`, `DocumentDetailView.vue`
- Components never share a name with a view. If a view wraps a complex component, the component uses a descriptive name: `DocumentDetailView.vue` (view) renders `DocumentPreviewPanel.vue` + `DocumentMetadataPanel.vue` (components). Never `DocumentView.vue` for both.

---

## 3. Vue Component Pattern

Every component uses `<script setup lang="ts">` and follows this order:

```vue
<script setup lang="ts">
// 1. Imports
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import type { DocumentListItem } from "@opo/shared";

// 2. Props
const props = defineProps<{
  document: DocumentListItem;
  isEditable?: boolean;
}>();

// 3. Emits
const emit = defineEmits<{
  delete: [id: string];
  select: [document: DocumentListItem];
}>();

// 4. Composables / stores / queries
const router = useRouter();

// 5. Reactive state
const isExpanded = ref(false);

// 6. Computed properties
const formattedDate = computed(() =>
  props.document.documentDate
    ? new Date(props.document.documentDate).toLocaleDateString()
    : null
);

// 7. Functions
function handleDelete() {
  emit("delete", props.document.id);
}

// 8. Lifecycle hooks (if any)
</script>

<template>
  <!-- Template here -->
</template>
```

**Rules:**
- No `<style>` blocks. All styling uses Tailwind utility classes with semantic tokens.
- No `defineOptions` unless absolutely necessary for component name.
- Props are always typed with TypeScript generics, not runtime validation.
- Emits are always typed with TypeScript generics.
- No `this` — always Composition API.

---

## 4. Composable Pattern

```typescript
// composables/useDocumentSSE.ts
import { ref, onMounted, onUnmounted } from "vue";
import { useQueryClient } from "@tanstack/vue-query";

export function useDocumentSSE() {
  const queryClient = useQueryClient();
  const isConnected = ref(false);
  let eventSource: EventSource | null = null;

  function connect() {
    // Implementation
  }

  function disconnect() {
    // Implementation
  }

  onMounted(() => connect());
  onUnmounted(() => disconnect());

  return {
    isConnected,
    connect,
    disconnect,
  };
}
```

**Rules:**
- Composables are pure functions that return reactive state and methods.
- Composables handle their own lifecycle (setup/teardown in `onMounted`/`onUnmounted`).
- Composables do not import stores — if they need store data, accept it as a parameter.

---

## 5. TanStack Query Pattern

All server data fetching goes through TanStack Query. Query definitions live in `api/queries/`.

```typescript
// api/queries/documents.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import type { Ref } from "vue";
import type { DocumentListItem, Document } from "@opo/shared";
import { apiClient } from "../client";

// Query keys — centralized, hierarchical
export const documentKeys = {
  all: ["documents"] as const,
  lists: () => [...documentKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) => [...documentKeys.lists(), filters] as const,
  details: () => [...documentKeys.all, "detail"] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
  myUploads: () => [...documentKeys.all, "my-uploads"] as const,
};

// Queries
export function useDocumentList(filters: Ref<Record<string, unknown>>) {
  return useQuery({
    queryKey: computed(() => documentKeys.list(filters.value)),
    queryFn: () => apiClient.get<PaginatedResponse<DocumentListItem>>("/documents", filters.value),
  });
}

export function useDocumentDetail(id: Ref<string>) {
  return useQuery({
    queryKey: computed(() => documentKeys.detail(id.value)),
    queryFn: () => apiClient.get<Document>(`/documents/${id.value}`),
    enabled: computed(() => !!id.value),
  });
}

// Mutations
export function useInitiateUpload() {
  return useMutation({
    mutationFn: (input: InitiateUploadInput) =>
      apiClient.post<InitiateUploadResponse>("/documents/initiate", input),
  });
}

export function useConfirmUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; s3Key: string; saveAsDraft?: boolean }) =>
      apiClient.post<{ id: string; state: string }>(`/documents/${id}/confirm-upload`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
    },
  });
}
```

**Rules:**
- Every domain has a `keys` object for structured query key management.
- `queryKey` must be a computed ref when it depends on reactive values.
- `enabled` must be a computed ref when it depends on reactive values.
- Mutations invalidate relevant query keys on success.
- Never fetch data outside of TanStack Query (no raw `fetch` calls in components or stores).
- The API client (`api/client.ts`) is a thin fetch wrapper that handles the base URL, credentials, and response unwrapping.

---

## 6. Pinia Store Pattern

Pinia stores hold **only client-side UI state** — never server data.

```typescript
// stores/browse-filters.ts
import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { useRouter, useRoute } from "vue-router";

export const useBrowseFiltersStore = defineStore("browseFilters", () => {
  const router = useRouter();
  const route = useRoute();

  // State
  const search = ref("");
  const governmentLevel = ref<string | null>(null);
  const stateUsps = ref<string | null>(null);
  const page = ref(1);
  const pageSize = ref(20);

  // Sync from URL on init
  function syncFromUrl() {
    search.value = (route.query.search as string) ?? "";
    governmentLevel.value = (route.query.governmentLevel as string) ?? null;
    // ...
  }

  // Sync to URL on change
  watch([search, governmentLevel, stateUsps, page], () => {
    router.replace({ query: { /* ... */ } });
  });

  function reset() {
    search.value = "";
    governmentLevel.value = null;
    stateUsps.value = null;
    page.value = 1;
  }

  return { search, governmentLevel, stateUsps, page, pageSize, syncFromUrl, reset };
});
```

**What belongs in a Pinia store:**
- Form wizard state (`useUploadWizardStore`)
- Filter/search state synced to URL (`useBrowseFiltersStore`)
- UI toggles (`useSidebarStore`)
- Auth session state (`useAuthStore`)

**What does NOT belong in a Pinia store:**
- Server data (documents, catalog entries, tiers) — use TanStack Query
- Derived data that can be computed from query results — use `computed` in components

---

## 7. Fastify Route Handler Pattern

Routes are organized as Fastify plugins. Each route file exports a plugin function.

```typescript
// routes/documents/detail.ts
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const paramsSchema = z.object({
  id: z.string(),
});

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/:id",
    {
      schema: {
        params: paramsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user; // May be null for public routes

      const document = await getDocumentById(fastify.db, id);
      if (!document) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      // Access control
      if (!canViewDocument(document, user)) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      return { success: true, data: document };
    },
  );
};

export default plugin;
```

**Route registration (index.ts):**

```typescript
// routes/documents/index.ts
import type { FastifyPluginAsync } from "fastify";

const documentsRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(import("./list.js"));
  await fastify.register(import("./detail.js"));
  await fastify.register(import("./upload.js"));
  await fastify.register(import("./update.js"));
  await fastify.register(import("./files.js"));
  await fastify.register(import("./tags.js"));
  await fastify.register(import("./associations.js"));
  await fastify.register(import("./metadata.js"));
  await fastify.register(import("./ai-metadata.js"));
  await fastify.register(import("./moderation.js"));
  await fastify.register(import("./related.js"));
};

export default documentsRoutes;
```

**App registration:**

```typescript
// app.ts
fastify.register(import("./routes/documents/index.js"), { prefix: "/api/documents" });
fastify.register(import("./routes/catalog/index.js"), { prefix: "/api/catalog" });
// ...
```

**Rules:**
- One route handler per file (or a small, cohesive group).
- Schemas (Zod) are defined at the top of the route file, not in a separate schemas directory.
- All request validation uses `fastify-type-provider-zod` — no manual parsing.
- Route handlers never import the database directly. Use `fastify.db` (Kysely instance decorated on the Fastify instance).
- Auth checks use decorators or preHandlers, not inline checks at the top of every handler.

**Auth preHandlers:**

```typescript
// plugins/auth.ts
fastify.decorate("requireAuth", async (request, reply) => {
  if (!request.user) {
    return reply.status(401).send({ success: false, error: "Authentication required" });
  }
});

fastify.decorate("requireRole", (role: Role) => async (request, reply) => {
  if (!request.user || !hasRole(request.user.role, role)) {
    return reply.status(403).send({ success: false, error: "Insufficient permissions" });
  }
});
```

Usage in routes:

```typescript
fastify.get("/", { preHandler: [fastify.requireAuth] }, async (request) => { ... });
fastify.post("/", { preHandler: [fastify.requireRole("moderator")] }, async (request) => { ... });
```

---

## 8. API Client Pattern (Frontend)

```typescript
// api/client.ts
const BASE_URL = "/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    credentials: "include", // Always send session cookie
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new ApiError(response.status, error.error ?? "Request failed");
  }

  const json = await response.json();
  return json.data;
}

export const apiClient = {
  get: <T>(path: string, params?: Record<string, unknown>) =>
    request<T>(path + (params ? "?" + new URLSearchParams(/* ... */) : "")),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),
};
```

**Rules:**
- Always use `credentials: "include"` — session cookies must be sent.
- The client unwraps the `ApiResponse` envelope — callers receive `data` directly.
- Errors throw `ApiError` with status code and message.
- No authorization headers — session cookie handles auth.

---

## 9. Zod Schema Conventions

- Schemas live in `packages/shared/src/types/` and are the single source of truth.
- Schema names use camelCase with a `Schema` suffix: `createDocumentSchema`, `updateTierSchema`.
- Types inferred from schemas: `export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;`
- Entity interfaces (for response types) are defined as plain TypeScript interfaces, not Zod schemas.
- Never define the same shape in two places. Import from shared.

---

## 10. Error Handling

### Backend

```typescript
// plugins/error-handler.ts
import { ZodError } from "zod";

fastify.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: "Validation failed",
      message: error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "),
    });
  }

  if (error.statusCode) {
    return reply.status(error.statusCode).send({
      success: false,
      error: error.message,
    });
  }

  fastify.log.error(error);
  return reply.status(500).send({
    success: false,
    error: "Internal server error",
  });
});
```

### Frontend

- TanStack Query `onError` callbacks handle query/mutation errors.
- Use PrimeVue `Toast` for user-facing error messages.
- Never swallow errors silently. Every catch block either shows a toast or rethrows.

```typescript
export function useConfirmUpload() {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; s3Key: string; saveAsDraft?: boolean }) =>
      apiClient.post(`/documents/${id}/confirm-upload`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
    },
    onError: (error: ApiError) => {
      toast.add({ severity: "error", summary: "Upload failed", detail: error.message, life: 5000 });
    },
  });
}
```

---

## 11. Test Conventions

### File Location

- Server unit/integration tests: `packages/server/tests/`
- Shared validation tests: `packages/shared/tests/`
- Component tests: `packages/web/tests/components/`
- E2E tests: `packages/web/e2e/`

### Naming

- Unit/integration: `<module>.test.ts`
- E2E: `<flow>.spec.ts`

### What Must Be Tested

| Layer | Required Tests |
|-------|---------------|
| Shared validation | Every Zod schema: valid input, invalid input, edge cases |
| State machine | Every valid transition, every invalid transition |
| API routes | Happy path, auth failures, validation failures, not-found, access control |
| Services | Business logic, error handling |
| Components | Props rendering, emit behavior, interactive states |
| E2E | Registration, upload, review, moderation, admin operations |

### Pattern

```typescript
// packages/server/tests/routes/documents.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../src/app";

describe("GET /api/documents", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns paginated approved documents for anonymous users", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/documents?page=1&pageSize=10",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.items).toBeInstanceOf(Array);
    expect(body.data.page).toBe(1);
  });

  it("returns 400 for invalid pagination", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/documents?page=-1",
    });

    expect(response.statusCode).toBe(400);
  });
});
```

---

## 12. Styling — Semantic Token System

The project uses a strict semantic token system. Direct Tailwind color utilities are banned.

### Token Categories

| Category | Examples | Usage |
|----------|---------|-------|
| **Text** | `text-primary`, `text-secondary`, `text-muted`, `text-inverse`, `text-critical`, `text-success`, `text-warning` | All text coloring |
| **Background** | `bg-surface`, `bg-surface-alt`, `bg-surface-raised`, `bg-overlay`, `bg-critical`, `bg-success`, `bg-warning` | All background coloring |
| **Border** | `border-subtle`, `border-default`, `border-strong`, `border-critical` | All border coloring |
| **Ring** | `ring-focus`, `ring-critical` | Focus and error rings |

### Rules

1. **Never use primitive color classes.** No `text-red-500`, `bg-gray-100`, etc. ESLint enforces this.
2. **Always use semantic tokens.** `text-critical` instead of `text-red-500`. `bg-surface-alt` instead of `bg-gray-50`.
3. **Dark mode is automatic.** Semantic tokens remap in `.dark` class context. No manual dark mode classes.
4. **PrimeVue components use the Aura theme.** Do not override PrimeVue component styles with Tailwind unless necessary for layout (spacing, sizing).
5. **Fonts:** IBM Plex Sans for body text, IBM Plex Mono for code/data. These are imported via `@fontsource`.

### Token Definition (in main.css)

Tokens are CSS custom properties mapped to Tailwind utilities via `@theme`:

```css
@theme {
  --color-text-primary: var(--text-primary);
  --color-bg-surface: var(--bg-surface);
  /* ... */
}
```

Light and dark values are set on `:root` and `.dark` respectively.

---

## 13. Database Access Pattern

All database access goes through Kysely. The Kysely instance is decorated on the Fastify app.

```typescript
// util/db.ts
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { DB } from "@opo/shared";

export function createDb(connectionString: string): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString }),
    }),
  });
}
```

**Rules:**
- No raw SQL except in `services/worker-admin.ts` for Graphile Worker admin queries.
- Use Kysely's type-safe query builder for all application queries.
- Transactions use `db.transaction()`.
- Column names in Kysely queries use snake_case (matching the database).
- Results are mapped to camelCase TypeScript types at the query boundary.

---

## 14. Environment Configuration

```typescript
// config/env.ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  S3_ENDPOINT: z.string().url(),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  ALTCHA_HMAC_KEY: z.string().min(32),
  API_KEY_ENCRYPTION_SECRET: z.string().min(32),
  TRUSTED_ORIGINS: z.string().transform(s => s.split(",").map(o => o.trim())),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  OPENROUTER_API_KEY: z.string().optional(),
  CLAMAV_HOST: z.string().default("localhost"),
  CLAMAV_PORT: z.coerce.number().default(3310),
  REDIS_URL: z.string().url(),
  LIBREOFFICE_SIDECAR_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
```

Environment is validated once at startup. If validation fails, the server refuses to start with a clear error message.

---

## 15. Import Conventions

- Use `.js` extensions in all TypeScript imports (for ESM compatibility): `import { foo } from "./bar.js";`
- Shared package is imported as `@opo/shared`: `import type { Document } from "@opo/shared";`
- Use `type` imports when only importing types: `import type { FastifyInstance } from "fastify";`
- Group imports: (1) Node built-ins, (2) external packages, (3) internal packages, (4) relative imports. Blank line between groups.

```typescript
import { readFile } from "node:fs/promises";

import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";

import type { Document, CreateDocumentInput } from "@opo/shared";

import { storage } from "../../services/storage.js";
import { generateId } from "../../util/id.js";
```

---

## 16. Redis Connection Pattern

Redis is used for two purposes: distributed rate limiting (via `@fastify/rate-limit`) and ALTCHA spent challenge deduplication. A single `ioredis` client is shared.

```typescript
// util/redis.ts
import Redis from "ioredis";
import { env } from "../config/env.js";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});
```

The Redis client is decorated on the Fastify instance alongside the database:

```typescript
// app.ts
import { redis } from "./util/redis.js";

fastify.decorate("redis", redis);

fastify.addHook("onClose", async () => {
  await redis.quit();
});
```

**Rules:**
- Never use Redis for caching server data — that is TanStack Query's job on the frontend and Kysely queries on the backend.
- Redis keys use a namespaced prefix: `altcha:spent:{salt}`, `ratelimit:{key}`.
- All Redis values have an explicit TTL. No keys persist indefinitely.

---

## 17. Rate Limiting Pattern

Rate limiting uses `@fastify/rate-limit` with the shared Redis client.

```typescript
// plugins/rate-limit.ts
import rateLimit from "@fastify/rate-limit";

const plugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    redis: fastify.redis,
    keyGenerator: (request) => {
      // Authenticated: key by user ID. Unauthenticated: key by IP.
      return request.user?.id ?? request.ip;
    },
  });
};

export default plugin;
```

Route-specific overrides use the `config` option on individual routes:

```typescript
fastify.post(
  "/initiate",
  {
    config: {
      rateLimit: { max: 50, timeWindow: "1 hour" },
    },
    preHandler: [fastify.requireAuth],
    schema: { body: initiateUploadSchema },
  },
  async (request, reply) => { /* ... */ },
);
```

---

## 18. Worker Job Timeout Pattern

Every worker task has an explicit timeout. Timeouts are configured in the processing config and enforced by wrapping task execution in `AbortSignal.timeout()`.

```typescript
// config/processing.ts
export const TASK_TIMEOUTS: Record<string, number> = {
  virus_scan: 2 * 60_000,          // 2 minutes
  pdf_convert: 5 * 60_000,         // 5 minutes
  sieve: 3 * 60_000,               // 3 minutes
  extractor: 10 * 60_000,          // 10 minutes
  pipeline_complete: 30_000,        // 30 seconds
  cleanup_expired_drafts: 5 * 60_000, // 5 minutes
  documentcloud_import: 10 * 60_000,  // 10 minutes
};
```

Task implementations use the timeout:

```typescript
// jobs/tasks/virus-scan.ts
import { TASK_TIMEOUTS } from "../../config/processing.js";

export async function virusScan(payload: VirusScanPayload, helpers: JobHelpers) {
  const signal = AbortSignal.timeout(TASK_TIMEOUTS.virus_scan);

  try {
    await scanFile(payload.s3Key, { signal });
    // ... enqueue next task
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      helpers.logger.error(`virus_scan timed out for document ${payload.documentId}`);
      throw error; // Let Graphile Worker handle retry/failure
    }
    throw error;
  }
}
```

**Dead-letter behavior:** When a job exhausts its max attempts (configured per task in Graphile Worker), it remains in the `failed` state. The document transitions to `processing_failed`. Failed jobs are visible in the admin UI (`GET /api/admin/failed-processing`) and can be retried manually.

---

## 19. LibreOffice Sidecar Communication Pattern

The LibreOffice sidecar is a Docker container that exposes a single HTTP endpoint for file conversion. The worker communicates with it via internal Docker network — no files pass through the API server.

```typescript
// services/libreoffice.ts
import { env } from "../config/env.js";

export async function convertToPdf(inputBuffer: Buffer, filename: string): Promise<Buffer> {
  const formData = new FormData();
  formData.append("file", new Blob([inputBuffer]), filename);

  const response = await fetch(`${env.LIBREOFFICE_SIDECAR_URL}/convert`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(5 * 60_000), // 5-minute timeout matches TASK_TIMEOUTS.pdf_convert
  });

  if (!response.ok) {
    throw new Error(`LibreOffice conversion failed: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
```

**Conversion flow in the worker:**
1. Worker downloads the original file from S3.
2. Worker sends the file to the sidecar via HTTP POST.
3. Sidecar converts to PDF and returns the result.
4. Worker uploads the converted PDF to S3.

**Rules:**
- The sidecar has no network egress — it can only respond to requests from the internal Docker network.
- The sidecar runs as an unprivileged user with a read-only filesystem (except `/tmp`).
- Never call the sidecar from the Fastify API server — only from worker tasks.

---

## 20. Presigned Upload Pattern (Frontend)

The frontend upload flow uses two API calls plus a direct S3 upload:

```typescript
// Simplified upload flow in UploadView.vue or useUploadWizard composable
async function uploadDocument(file: File, metadata: UploadMetadata) {
  // Step 1: Initiate — get presigned URL from API
  const { id, presignedUrl, presignedFields, expiresAt } = await apiClient.post(
    "/documents/initiate",
    {
      filename: file.name,
      contentType: file.type,
      contentLength: file.size,
      ...metadata,
    },
  );

  // Step 2: Upload file directly to S3 via presigned POST
  const formData = new FormData();
  for (const [key, value] of Object.entries(presignedFields)) {
    formData.append(key, value);
  }
  formData.append("file", file); // "file" must be last

  const s3Response = await fetch(presignedUrl, {
    method: "POST",
    body: formData,
  });

  if (!s3Response.ok) {
    throw new Error("File upload to storage failed");
  }

  // Step 3: Confirm upload with API
  const result = await apiClient.post(`/documents/${id}/confirm-upload`, {
    s3Key: presignedFields.key,
    saveAsDraft: metadata.saveAsDraft,
  });

  return result;
}
```

**Rules:**
- The `file` field must be appended last in the FormData for S3 presigned POST.
- The frontend must not set `Content-Type` headers on the S3 POST — the browser sets the correct `multipart/form-data` boundary automatically.
- If the presigned URL expires before the upload completes, the client should call `initiate` again.
