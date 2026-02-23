# Catalog Management UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat DataTable catalog admin UI with a hierarchical tree view (vendor-view, technology-view, all-view tabs) and a slide-out drawer for entry editing, aliases, and bidirectional association management.

**Architecture:** The existing `CatalogManageView.vue` is replaced wholesale. A new `CatalogEntryDrawer.vue` component wraps the existing `CatalogEntryForm` and `AliasManager` into a three-tab PrimeVue Drawer, adding a new `CatalogAssociationsManager.vue` for bidirectional catalog-to-catalog association editing. Two new backend routes handle POST/DELETE for `catalog_entry_associations`. Two new TanStack Query mutation hooks are added to `catalog.ts`. The shared types file gains a `createCatalogAssociationSchema` and `CreateCatalogAssociationInput`.

**Tech Stack:** Vue 3 + `<script setup>` + TypeScript strict, PrimeVue v4 (Aura), TanStack Query (Vue), Fastify + Zod + fastify-type-provider-zod, Kysely, nanoid, Vitest

---

## Task 1: Add shared Zod schema and types for catalog entry associations

**Files:**
- Modify: `packages/shared/src/types/catalog.ts`

**Step 1: Add the schema and type after `CatalogEntryAssociation` interface**

In `packages/shared/src/types/catalog.ts`, after line 149 (the `CatalogEntryAssociation` interface), add:

```typescript
export const createCatalogAssociationSchema = z.object({
  targetEntryId: z.string().min(1),
  associationTypeId: z.string().min(1),
});

export type CreateCatalogAssociationInput = z.infer<typeof createCatalogAssociationSchema>;
```

**Step 2: Verify the shared package builds**

```bash
cd /path/to/project && pnpm --filter @opo/shared build
```

Expected: no errors.

**Step 3: Commit**

```bash
git add packages/shared/src/types/catalog.ts
git commit -m "feat(shared): add createCatalogAssociationSchema and CreateCatalogAssociationInput"
```

---

## Task 2: Add backend routes for catalog entry associations

**Files:**
- Create: `packages/server/src/routes/catalog/associations.ts`
- Modify: `packages/server/src/routes/catalog/index.ts`

**Step 1: Write the failing test**

Create `packages/server/src/routes/catalog/__tests__/associations.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp } from "../../../test/helpers.js";
import type { FastifyInstance } from "fastify";

describe("POST /catalog/entries/:id/associations", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/catalog/entries/nonexistent/associations",
      payload: { targetEntryId: "x", associationTypeId: "y" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 when source entry does not exist", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/catalog/entries/nonexistent/associations",
      payload: { targetEntryId: "x", associationTypeId: "y" },
      headers: { cookie: await getModeratorCookie(app) },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /catalog/associations/:id", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/catalog/associations/nonexistent",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 when association does not exist", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/catalog/associations/nonexistent",
      headers: { cookie: await getModeratorCookie(app) },
    });
    expect(res.statusCode).toBe(404);
  });
});

// Helper — look at existing test files in packages/server/src/routes/catalog/__tests__/
// to find the correct test helper pattern for this project.
async function getModeratorCookie(_app: FastifyInstance): Promise<string> {
  // Replace with the project's actual auth helper
  return "";
}
```

**Step 2: Run the test to verify it fails**

```bash
pnpm --filter @opo/server test packages/server/src/routes/catalog/__tests__/associations.test.ts
```

Expected: FAIL (module not found or route not registered).

**Step 3: Create `packages/server/src/routes/catalog/associations.ts`**

```typescript
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { nanoid } from "nanoid";

import { createCatalogAssociationSchema } from "@opo/shared";

const idParamsSchema = z.object({
  id: z.string(),
});

const plugin: FastifyPluginAsync = async (fastify) => {
  // POST /entries/:id/associations — create catalog entry association (moderator+)
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/entries/:id/associations",
    {
      preHandler: [fastify.requireRole("moderator")],
      schema: {
        params: idParamsSchema,
        body: createCatalogAssociationSchema,
      },
    },
    async (request, reply) => {
      const { id: sourceEntryId } = request.params;
      const { targetEntryId, associationTypeId } = request.body;

      const sourceEntry = await fastify.db
        .selectFrom("catalog_entries")
        .select("id")
        .where("id", "=", sourceEntryId)
        .executeTakeFirst();

      if (!sourceEntry) {
        return reply.status(404).send({ success: false, error: "Source catalog entry not found" });
      }

      const targetEntry = await fastify.db
        .selectFrom("catalog_entries")
        .select("id")
        .where("id", "=", targetEntryId)
        .executeTakeFirst();

      if (!targetEntry) {
        return reply.status(404).send({ success: false, error: "Target catalog entry not found" });
      }

      const assocType = await fastify.db
        .selectFrom("association_types")
        .select("id")
        .where("id", "=", associationTypeId)
        .executeTakeFirst();

      if (!assocType) {
        return reply.status(400).send({ success: false, error: "Invalid association type" });
      }

      const assocId = nanoid();
      const now = new Date();

      try {
        await fastify.db
          .insertInto("catalog_entry_associations")
          .values({
            id: assocId,
            source_entry_id: sourceEntryId,
            target_entry_id: targetEntryId,
            association_type_id: associationTypeId,
            created_at: now,
          })
          .execute();
      } catch (err: unknown) {
        const pgErr = err as { code?: string };
        if (pgErr.code === "23505") {
          return reply.status(409).send({
            success: false,
            error: "This association already exists",
          });
        }
        throw err;
      }

      return {
        success: true,
        data: {
          id: assocId,
          sourceEntryId,
          targetEntryId,
          associationTypeId,
          createdAt: now.toISOString(),
        },
      };
    },
  );

  // DELETE /associations/:id — remove catalog entry association (moderator+)
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    "/associations/:id",
    {
      preHandler: [fastify.requireRole("moderator")],
      schema: {
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await fastify.db
        .selectFrom("catalog_entry_associations")
        .select("id")
        .where("id", "=", id)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({ success: false, error: "Association not found" });
      }

      await fastify.db
        .deleteFrom("catalog_entry_associations")
        .where("id", "=", id)
        .execute();

      return { success: true, data: null };
    },
  );
};

export default plugin;
```

**Step 4: Register in `packages/server/src/routes/catalog/index.ts`**

Add the associations import after the existing imports:

```typescript
import type { FastifyPluginAsync } from "fastify";

const catalogRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(import("./entries.js"));
  await fastify.register(import("./aliases.js"));
  await fastify.register(import("./associations.js"));
  await fastify.register(import("./search.js"));
  await fastify.register(import("./types.js"));
};

export default catalogRoutes;
```

**Step 5: Run tests**

```bash
pnpm --filter @opo/server test packages/server/src/routes/catalog/__tests__/associations.test.ts
```

Expected: PASS (auth and 404 cases pass; adapt helpers to match the project's test pattern found in other `__tests__` files).

**Step 6: Commit**

```bash
git add packages/server/src/routes/catalog/associations.ts packages/server/src/routes/catalog/index.ts packages/server/src/routes/catalog/__tests__/associations.test.ts
git commit -m "feat(server): add POST /catalog/entries/:id/associations and DELETE /catalog/associations/:id"
```

---

## Task 3: Add TanStack Query mutation hooks for catalog entry associations

**Files:**
- Modify: `packages/web/src/api/queries/catalog.ts`

**Step 1: Write the failing test**

Create `packages/web/src/api/queries/__tests__/catalog-associations.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { useCreateCatalogAssociation, useDeleteCatalogAssociation } from "../catalog.js";

describe("useCreateCatalogAssociation", () => {
  it("exports the hook", () => {
    expect(typeof useCreateCatalogAssociation).toBe("function");
  });
});

describe("useDeleteCatalogAssociation", () => {
  it("exports the hook", () => {
    expect(typeof useDeleteCatalogAssociation).toBe("function");
  });
});
```

**Step 2: Run to verify it fails**

```bash
pnpm --filter @opo/web test src/api/queries/__tests__/catalog-associations.test.ts
```

Expected: FAIL — named export does not exist.

**Step 3: Add hooks to `packages/web/src/api/queries/catalog.ts`**

Add after the `useDeleteCatalogAlias` function:

```typescript
export function useCreateCatalogAssociation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, ...body }: { entryId: string } & CreateCatalogAssociationInput) =>
      apiClient.post<CatalogEntryAssociation>(`/catalog/entries/${entryId}/associations`, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.detail(variables.entryId) });
    },
  });
}

export function useDeleteCatalogAssociation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assocId, entryId }: { assocId: string; entryId: string }) =>
      apiClient.delete<void>(`/catalog/associations/${assocId}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.detail(variables.entryId) });
    },
  });
}
```

Also add to the imports at the top of the file:
```typescript
import type {
  // ... existing imports ...
  CatalogEntryAssociation,
  CreateCatalogAssociationInput,
} from "@opo/shared";
```

**Step 4: Run tests**

```bash
pnpm --filter @opo/web test src/api/queries/__tests__/catalog-associations.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/web/src/api/queries/catalog.ts packages/web/src/api/queries/__tests__/catalog-associations.test.ts
git commit -m "feat(web): add useCreateCatalogAssociation and useDeleteCatalogAssociation hooks"
```

---

## Task 4: Build `CatalogAssociationsManager.vue` component

**Files:**
- Create: `packages/web/src/components/catalog/CatalogAssociationsManager.vue`

This component shows bidirectional associations for a catalog entry. It receives `entryId`, `associations` (from the detail query), and `associationTypes`. It displays two sections: "Linked from this entry" (where `sourceEntryId === entryId`) and "Linked to this entry" (where `targetEntryId === entryId`). Each row shows the other entry's name (fetched via a search or detail query), the association type, and a remove button. An "Add association" form uses `useCatalogSearch` autocomplete + a type Select.

**Step 1: Write the failing component test**

Create `packages/web/src/components/catalog/__tests__/CatalogAssociationsManager.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import CatalogAssociationsManager from "../CatalogAssociationsManager.vue";

const mockAssociations = [
  {
    id: "assoc1",
    sourceEntryId: "entry-A",
    targetEntryId: "entry-B",
    associationTypeId: "type1",
    createdAt: "2024-01-01T00:00:00Z",
  },
];

const mockAssociationTypes = [
  { id: "type1", name: "uses", appliesTo: "catalog_catalog", isDirectional: true, inverseId: null, isSystem: false, sortOrder: 1, description: null },
];

describe("CatalogAssociationsManager", () => {
  it("renders outgoing associations section", () => {
    const wrapper = mount(CatalogAssociationsManager, {
      props: {
        entryId: "entry-A",
        associations: mockAssociations,
        associationTypes: mockAssociationTypes,
      },
      global: { plugins: [createTestingPinia()] },
    });
    expect(wrapper.text()).toContain("Linked from this entry");
  });

  it("renders incoming associations section", () => {
    const wrapper = mount(CatalogAssociationsManager, {
      props: {
        entryId: "entry-B",
        associations: mockAssociations,
        associationTypes: mockAssociationTypes,
      },
      global: { plugins: [createTestingPinia()] },
    });
    expect(wrapper.text()).toContain("Linked to this entry");
  });

  it("shows empty state when no associations", () => {
    const wrapper = mount(CatalogAssociationsManager, {
      props: {
        entryId: "entry-X",
        associations: [],
        associationTypes: mockAssociationTypes,
      },
      global: { plugins: [createTestingPinia()] },
    });
    expect(wrapper.text()).toContain("No associations");
  });
});
```

**Step 2: Run to verify fails**

```bash
pnpm --filter @opo/web test src/components/catalog/__tests__/CatalogAssociationsManager.test.ts
```

Expected: FAIL — component does not exist.

**Step 3: Create `packages/web/src/components/catalog/CatalogAssociationsManager.vue`**

```vue
<script setup lang="ts">
import { ref, computed } from "vue";
import Button from "primevue/button";
import Select from "primevue/select";
import AutoComplete from "primevue/autocomplete";
import Tag from "primevue/tag";
import Message from "primevue/message";
import { useToast } from "primevue/usetoast";

import type { CatalogEntryAssociation, AssociationType } from "@opo/shared";
import {
  useCatalogSearch,
  useCreateCatalogAssociation,
  useDeleteCatalogAssociation,
} from "../../api/queries/catalog.js";

const props = defineProps<{
  entryId: string;
  associations: CatalogEntryAssociation[];
  associationTypes: AssociationType[];
}>();

const toast = useToast();

// Split associations by direction
const outgoing = computed(() =>
  props.associations.filter((a) => a.sourceEntryId === props.entryId),
);
const incoming = computed(() =>
  props.associations.filter((a) => a.targetEntryId === props.entryId),
);

// Association type lookup
function typeName(typeId: string): string {
  return props.associationTypes.find((t) => t.id === typeId)?.name ?? typeId;
}

// Catalog-catalog association types only
const catalogAssocTypes = computed(() =>
  props.associationTypes.filter((t) => t.appliesTo === "catalog_catalog"),
);
const typeOptions = computed(() =>
  catalogAssocTypes.value.map((t) => ({ label: t.name, value: t.id })),
);

// Add form state
const searchQuery = ref("");
const searchResults = ref<{ id: string; name: string; typeId: string; typeName: string; similarity: number }[]>([]);
const selectedTarget = ref<{ id: string; name: string; typeId: string; typeName: string; similarity: number } | null>(null);
const selectedTypeId = ref("");
const addError = ref<string | null>(null);

const searchQueryRef = computed(() => searchQuery.value);
const { data: searchData } = useCatalogSearch(searchQueryRef);

function onSearchInput(event: { query: string }) {
  searchQuery.value = event.query;
  searchResults.value = (searchData.value ?? []).filter((r) => r.id !== props.entryId);
}

const { mutate: createAssoc, isPending: isCreating } = useCreateCatalogAssociation();
const { mutate: deleteAssoc, isPending: isDeleting } = useDeleteCatalogAssociation();

function handleAdd() {
  addError.value = null;
  if (!selectedTarget.value) {
    addError.value = "Select a target entry";
    return;
  }
  if (!selectedTypeId.value) {
    addError.value = "Select an association type";
    return;
  }
  createAssoc(
    { entryId: props.entryId, targetEntryId: selectedTarget.value.id, associationTypeId: selectedTypeId.value },
    {
      onSuccess: () => {
        selectedTarget.value = null;
        selectedTypeId.value = "";
        searchQuery.value = "";
        toast.add({ severity: "success", summary: "Association added", life: 3000 });
      },
      onError: (err) => {
        addError.value = (err as Error).message;
      },
    },
  );
}

function handleDelete(assocId: string) {
  deleteAssoc(
    { assocId, entryId: props.entryId },
    {
      onSuccess: () => {
        toast.add({ severity: "success", summary: "Association removed", life: 3000 });
      },
    },
  );
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Outgoing -->
    <div class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold text-primary">Linked from this entry</h3>
      <p v-if="outgoing.length === 0" class="text-sm text-muted">No associations</p>
      <ul v-else class="flex flex-col gap-2">
        <li
          v-for="a in outgoing"
          :key="a.id"
          class="flex items-center justify-between rounded border border-subtle bg-surface px-3 py-2"
        >
          <div class="flex items-center gap-2">
            <Tag :value="typeName(a.associationTypeId)" severity="info" />
            <span class="text-sm text-primary">{{ a.targetEntryId }}</span>
          </div>
          <Button
            icon="pi pi-times"
            severity="danger"
            text
            size="small"
            :loading="isDeleting"
            aria-label="Remove association"
            @click="handleDelete(a.id)"
          />
        </li>
      </ul>
    </div>

    <!-- Incoming -->
    <div class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold text-primary">Linked to this entry</h3>
      <p v-if="incoming.length === 0" class="text-sm text-muted">No associations</p>
      <ul v-else class="flex flex-col gap-2">
        <li
          v-for="a in incoming"
          :key="a.id"
          class="flex items-center justify-between rounded border border-subtle bg-surface px-3 py-2"
        >
          <div class="flex items-center gap-2">
            <Tag :value="typeName(a.associationTypeId)" severity="secondary" />
            <span class="text-sm text-primary">{{ a.sourceEntryId }}</span>
          </div>
        </li>
      </ul>
    </div>

    <!-- Add form -->
    <div class="flex flex-col gap-3 rounded border border-subtle bg-surface-subtle p-3">
      <h4 class="text-sm font-medium text-primary">Add Association</h4>
      <Message v-if="addError" severity="error" :closable="false">{{ addError }}</Message>
      <div class="flex flex-col gap-2">
        <AutoComplete
          v-model="selectedTarget"
          :suggestions="searchResults"
          option-label="name"
          placeholder="Search for an entry…"
          class="w-full"
          @complete="onSearchInput"
        />
        <Select
          v-model="selectedTypeId"
          :options="typeOptions"
          option-label="label"
          option-value="value"
          placeholder="Association type…"
          class="w-full"
        />
        <Button
          label="Add"
          :loading="isCreating"
          :disabled="!selectedTarget || !selectedTypeId"
          @click="handleAdd"
        />
      </div>
    </div>
  </div>
</template>
```

**Step 4: Run tests**

```bash
pnpm --filter @opo/web test src/components/catalog/__tests__/CatalogAssociationsManager.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/web/src/components/catalog/CatalogAssociationsManager.vue packages/web/src/components/catalog/__tests__/CatalogAssociationsManager.test.ts
git commit -m "feat(web): add CatalogAssociationsManager component"
```

---

## Task 5: Build `CatalogEntryDrawer.vue` component

**Files:**
- Create: `packages/web/src/components/catalog/CatalogEntryDrawer.vue`

This slide-out Drawer wraps three tabs: Details (CatalogEntryForm + verify toggle + delete), Aliases (AliasManager), Associations (CatalogAssociationsManager). It receives `entryId` as a prop and is `v-model:visible`.

**Step 1: Write the failing test**

Create `packages/web/src/components/catalog/__tests__/CatalogEntryDrawer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import CatalogEntryDrawer from "../CatalogEntryDrawer.vue";

describe("CatalogEntryDrawer", () => {
  it("renders nothing when visible is false", () => {
    const wrapper = mount(CatalogEntryDrawer, {
      props: { visible: false, entryId: "test-id" },
      global: { plugins: [createTestingPinia()] },
    });
    // PrimeVue Drawer is not in DOM when not visible
    expect(wrapper.find("[data-testid='catalog-drawer']").exists()).toBe(false);
  });
});
```

**Step 2: Run to verify fails**

```bash
pnpm --filter @opo/web test src/components/catalog/__tests__/CatalogEntryDrawer.test.ts
```

**Step 3: Create `packages/web/src/components/catalog/CatalogEntryDrawer.vue`**

```vue
<script setup lang="ts">
import { computed } from "vue";
import Drawer from "primevue/drawer";
import Tabs from "primevue/tabs";
import Tab from "primevue/tab";
import TabList from "primevue/tablist";
import TabPanels from "primevue/tabpanels";
import TabPanel from "primevue/tabpanel";
import Button from "primevue/button";
import Tag from "primevue/tag";
import ProgressSpinner from "primevue/progressspinner";
import { useToast } from "primevue/usetoast";
import ConfirmDialog from "primevue/confirmdialog";
import { useConfirm } from "primevue/useconfirm";

import type { CatalogType, CatalogAlias, CatalogEntryAssociation, AssociationType, UpdateCatalogEntryInput } from "@opo/shared";
import {
  useCatalogTypes,
  useCatalogDetail,
  useUpdateCatalogEntry,
  useDeleteCatalogEntry,
  useAssociationTypes,
} from "../../api/queries/catalog.js";
import CatalogEntryForm from "./CatalogEntryForm.vue";
import AliasManager from "./AliasManager.vue";
import CatalogAssociationsManager from "./CatalogAssociationsManager.vue";

const props = defineProps<{
  visible: boolean;
  entryId: string;
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
  deleted: [entryId: string];
}>();

const toast = useToast();
const confirm = useConfirm();

const entryIdRef = computed(() => props.entryId);

const { data: typesData } = useCatalogTypes();
const { data: detailData, isLoading } = useCatalogDetail(entryIdRef);
const { data: assocTypesData } = useAssociationTypes();

const catalogTypes = computed<CatalogType[]>(() => (typesData.value as CatalogType[] | undefined) ?? []);
const entry = computed(() => detailData.value ?? null);
const associationTypes = computed<AssociationType[]>(() => (assocTypesData.value as AssociationType[] | undefined) ?? []);
const aliases = computed<CatalogAlias[]>(() => entry.value?.aliases ?? []);
const associations = computed<CatalogEntryAssociation[]>(() => (entry.value?.associations as CatalogEntryAssociation[] | undefined) ?? []);

const { mutate: updateEntry, isPending: isUpdating } = useUpdateCatalogEntry();
const { mutate: deleteEntry, isPending: isDeleting } = useDeleteCatalogEntry();

function handleUpdate(values: UpdateCatalogEntryInput) {
  if (!entry.value) return;
  updateEntry(
    { id: entry.value.id, ...values },
    {
      onSuccess: () => {
        toast.add({ severity: "success", summary: "Entry updated", life: 3000 });
      },
      onError: (err) => {
        toast.add({ severity: "error", summary: "Update failed", detail: (err as Error).message, life: 5000 });
      },
    },
  );
}

function confirmDelete() {
  if (!entry.value) return;
  confirm.require({
    message: `Delete "${entry.value.name}"? This cannot be undone.`,
    header: "Confirm Delete",
    icon: "pi pi-exclamation-triangle",
    rejectLabel: "Cancel",
    acceptLabel: "Delete",
    acceptClass: "p-button-danger",
    accept: () => {
      deleteEntry(entry.value!.id, {
        onSuccess: () => {
          emit("deleted", entry.value!.id);
          emit("update:visible", false);
          toast.add({ severity: "success", summary: "Entry deleted", life: 3000 });
        },
        onError: (err) => {
          toast.add({ severity: "error", summary: "Delete failed", detail: (err as Error).message, life: 5000 });
        },
      });
    },
  });
}
</script>

<template>
  <ConfirmDialog />
  <Drawer
    :visible="props.visible"
    position="right"
    :style="{ width: '480px' }"
    :pt="{ root: { 'data-testid': 'catalog-drawer' } }"
    @update:visible="emit('update:visible', $event)"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <span class="font-semibold text-primary">{{ entry?.name ?? 'Loading…' }}</span>
        <Tag v-if="entry" :value="entry.typeName ?? entry.typeId" severity="secondary" />
      </div>
    </template>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <ProgressSpinner />
    </div>

    <div v-else-if="entry" class="flex flex-col gap-0">
      <Tabs value="details">
        <TabList>
          <Tab value="details">Details</Tab>
          <Tab value="aliases">Aliases</Tab>
          <Tab value="associations">Associations</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="details" class="flex flex-col gap-4 pt-4">
            <CatalogEntryForm
              mode="edit"
              :catalog-types="catalogTypes"
              :initial-values="{
                typeId: entry.typeId,
                name: entry.name,
                attributes: entry.attributes ?? undefined,
                isVerified: entry.isVerified,
              }"
              :loading="isUpdating"
              @submit="handleUpdate"
              @cancel="emit('update:visible', false)"
            />
            <hr class="border-subtle" />
            <div class="flex justify-end">
              <Button
                label="Delete Entry"
                severity="danger"
                outlined
                :loading="isDeleting"
                icon="pi pi-trash"
                @click="confirmDelete"
              />
            </div>
          </TabPanel>

          <TabPanel value="aliases" class="pt-4">
            <AliasManager
              :entry-id="entry.id"
              :aliases="aliases"
            />
          </TabPanel>

          <TabPanel value="associations" class="pt-4">
            <CatalogAssociationsManager
              :entry-id="entry.id"
              :associations="associations"
              :association-types="associationTypes"
            />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>

    <div v-else class="py-8 text-center text-muted">
      Entry not found.
    </div>
  </Drawer>
</template>
```

**Step 4: Run tests**

```bash
pnpm --filter @opo/web test src/components/catalog/__tests__/CatalogEntryDrawer.test.ts
```

**Step 5: Commit**

```bash
git add packages/web/src/components/catalog/CatalogEntryDrawer.vue packages/web/src/components/catalog/__tests__/CatalogEntryDrawer.test.ts
git commit -m "feat(web): add CatalogEntryDrawer component with Details/Aliases/Associations tabs"
```

---

## Task 6: Rewrite `CatalogManageView.vue` with hierarchical tree + tabs

**Files:**
- Modify: `packages/web/src/views/admin/CatalogManageView.vue`

This is the main page rewrite. Replace the DataTable with a three-tab interface: Vendor View (tree), Technology View (tree), All (flat DataTable kept from current implementation). Each tree node has edit (opens drawer) and delete (confirm) actions. Drag-and-drop in the Vendor View reassigns a product to a different vendor by creating/deleting associations.

**Step 1: Understand the PrimeVue Tree API before writing code**

PrimeVue Tree nodes have this shape:
```typescript
interface TreeNode {
  key: string;
  label: string;
  data?: unknown;
  icon?: string;
  children?: TreeNode[];
  leaf?: boolean;
}
```

Drag-and-drop: PrimeVue Tree supports `draggable` and `droppable` props. On drop, the `node-drop` event fires with `{ dragNode, dropNode, dropIndex, originalEvent }`. Use this to call `deleteAssoc` (remove old vendor→product link) then `createAssoc` (add new vendor→product link).

**Step 2: Plan tree construction**

For **Vendor View**:
1. Load all `vendor` entries (`useCatalogList({ typeId: 'vendor', pageSize: 500 })`)
2. Load all `product` entries (`useCatalogList({ typeId: 'product', pageSize: 500 })`)
3. Load associations (`GET /catalog/entries/:vendorId` for each vendor) — this is expensive. Better: load all `catalog_entry_associations` via a dedicated query. Since there is no list-all endpoint for associations, use per-vendor detail calls loaded lazily on expand. OR: load all entries then build the tree from association data embedded in detail responses.

> **⚠️ DESIGN NOTE:** There is no `GET /catalog/associations` list endpoint. The current approach to build vendor→product tree is: when a vendor node is expanded, fire `useCatalogDetail(vendorId)` which returns `associations[]`. Use lazy loading with PrimeVue Tree's `lazy` prop.

For **Technology View**: Same lazy-load approach. Technology node expands to show its associated vendors/products.

**Step 3: Write the rewritten `CatalogManageView.vue`**

```vue
<script setup lang="ts">
import { ref, computed, watch } from "vue";
import Button from "primevue/button";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import Tag from "primevue/tag";
import Tree from "primevue/tree";
import Tabs from "primevue/tabs";
import Tab from "primevue/tab";
import TabList from "primevue/tablist";
import TabPanels from "primevue/tabpanels";
import TabPanel from "primevue/tabpanel";
import Dialog from "primevue/dialog";
import ProgressSpinner from "primevue/progressspinner";
import { useToast } from "primevue/usetoast";

import type { CatalogEntry, CatalogType, CreateCatalogEntryInput } from "@opo/shared";
import {
  useCatalogTypes,
  useCatalogList,
  useCatalogDetail,
  useCreateCatalogEntry,
  useDeleteCatalogEntry,
  useCreateCatalogAssociation,
  useDeleteCatalogAssociation,
} from "../../api/queries/catalog.js";
import CatalogEntryForm from "../../components/catalog/CatalogEntryForm.vue";
import CatalogEntryDrawer from "../../components/catalog/CatalogEntryDrawer.vue";

type EntryWithType = CatalogEntry & { typeName: string };

const toast = useToast();

// ── Drawer ──────────────────────────────────────────────────────────────────
const drawerVisible = ref(false);
const drawerEntryId = ref("");

function openDrawer(entryId: string) {
  drawerEntryId.value = entryId;
  drawerVisible.value = true;
}

// ── Create dialog ────────────────────────────────────────────────────────────
const showCreateDialog = ref(false);
const { data: typesData } = useCatalogTypes();
const catalogTypes = computed<CatalogType[]>(() => (typesData.value as CatalogType[] | undefined) ?? []);

const { mutate: createEntry, isPending: isCreating } = useCreateCatalogEntry();
const { mutate: deleteEntry } = useDeleteCatalogEntry();

function handleCreate(values: CreateCatalogEntryInput) {
  createEntry(values, {
    onSuccess: () => {
      showCreateDialog.value = false;
      toast.add({ severity: "success", summary: "Entry created", life: 3000 });
    },
    onError: (err) => {
      toast.add({ severity: "error", summary: "Failed to create entry", detail: (err as Error).message, life: 5000 });
    },
  });
}

// ── "All" tab — flat DataTable (preserved from old view) ─────────────────────
const filterTypeId = ref("");
const filterSearch = ref("");
const filterVerified = ref<"" | "true" | "false">("");
const page = ref(1);
const pageSize = ref(20);

const allFilters = computed(() => ({
  ...(filterTypeId.value ? { typeId: filterTypeId.value } : {}),
  ...(filterSearch.value ? { search: filterSearch.value } : {}),
  ...(filterVerified.value !== "" ? { verified: filterVerified.value } : {}),
  page: page.value,
  pageSize: pageSize.value,
}));

const { data: entriesData, isLoading: isListLoading } = useCatalogList(allFilters);
const entries = computed<EntryWithType[]>(() => (entriesData.value?.items as EntryWithType[] | undefined) ?? []);
const totalRecords = computed(() => entriesData.value?.total ?? 0);

const typeOptions = computed(() => [
  { label: "All types", value: "" },
  ...catalogTypes.value.map((t) => ({ label: t.name, value: t.id })),
]);
const verifiedOptions = [
  { label: "Any verification", value: "" },
  { label: "Verified", value: "true" },
  { label: "Unverified", value: "false" },
];

function onPageChange(event: { page: number; rows: number }) {
  page.value = event.page + 1;
  pageSize.value = event.rows;
}

function resetFilters() {
  filterTypeId.value = "";
  filterSearch.value = "";
  filterVerified.value = "";
  page.value = 1;
}

// ── Vendor tree ───────────────────────────────────────────────────────────────
// Load vendor and product entries
const vendorFilters = computed(() => ({ typeId: "vendor", pageSize: 500, page: 1 }));
const productFilters = computed(() => ({ typeId: "product", pageSize: 500, page: 1 }));

const { data: vendorData, isLoading: vendorsLoading } = useCatalogList(vendorFilters);
const { data: productData } = useCatalogList(productFilters);

const vendors = computed<EntryWithType[]>(() => (vendorData.value?.items as EntryWithType[] | undefined) ?? []);
const products = computed<EntryWithType[]>(() => (productData.value?.items as EntryWithType[] | undefined) ?? []);

// Per-vendor detail for associations (lazy: only fetched when `expandedVendorId` is set)
const expandedVendorId = ref("");
const { data: expandedVendorDetail } = useCatalogDetail(expandedVendorId);

// Map: vendorId → productIds (from associations)
const vendorProductMap = ref<Record<string, string[]>>({});

watch(expandedVendorDetail, (detail) => {
  if (!detail || !expandedVendorId.value) return;
  const productAssocs = (detail.associations ?? []).filter(
    (a: { sourceEntryId: string; targetEntryId: string }) => a.sourceEntryId === expandedVendorId.value,
  );
  vendorProductMap.value[expandedVendorId.value] = productAssocs.map(
    (a: { targetEntryId: string }) => a.targetEntryId,
  );
});

// Build tree nodes
const vendorTreeNodes = computed(() => {
  const productById = Object.fromEntries(products.value.map((p) => [p.id, p]));

  return vendors.value.map((vendor) => ({
    key: vendor.id,
    label: vendor.name,
    data: vendor,
    icon: "pi pi-building",
    leaf: false,
    children: (vendorProductMap.value[vendor.id] ?? [])
      .map((pid) => productById[pid])
      .filter(Boolean)
      .map((product) => ({
        key: product.id,
        label: product.name,
        data: product,
        icon: "pi pi-box",
        leaf: true,
      })),
  }));
});

function onVendorNodeExpand(node: { key: string }) {
  expandedVendorId.value = node.key;
}

// Drag-and-drop: reassign product to new vendor
const { mutate: createAssoc } = useCreateCatalogAssociation();
const { mutate: deleteAssoc } = useDeleteCatalogAssociation();

function onVendorTreeDrop(event: {
  dragNode: { key: string; data: EntryWithType };
  dropNode: { key: string; data: EntryWithType };
}) {
  const { dragNode, dropNode } = event;
  // dragNode is a product, dropNode is a vendor
  if (!dragNode.data || !dropNode.data) return;
  if (dragNode.data.typeId !== "product") return;
  if (dropNode.data.typeId !== "vendor") return;

  // Find current vendor (source of existing association)
  // We need to find which vendor currently has this product
  const currentVendorId = Object.entries(vendorProductMap.value).find(([, pids]) =>
    pids.includes(dragNode.key),
  )?.[0];

  if (currentVendorId) {
    // Find the association id — we'd need it from detail data
    // For now: delete then recreate using detail association list
    // This requires knowing the assocId — load from cached detail
    // The detail query is already cached; look up assocId
    toast.add({
      severity: "info",
      summary: "Reassigning product…",
      life: 2000,
    });
    // TODO: get assocId from vendorDetail cache, then:
    // deleteAssoc({ assocId, entryId: currentVendorId }, {
    //   onSuccess: () => createAssoc(...)
    // })
  }

  // Simplified: just create new association (server will 409 if duplicate)
  createAssoc(
    { entryId: dropNode.key, targetEntryId: dragNode.key, associationTypeId: "vendor_product" },
    {
      onSuccess: () => {
        // Update local map
        vendorProductMap.value[dropNode.key] = [
          ...(vendorProductMap.value[dropNode.key] ?? []),
          dragNode.key,
        ];
        toast.add({ severity: "success", summary: "Product reassigned", life: 3000 });
      },
      onError: (err) => {
        toast.add({ severity: "error", summary: "Reassignment failed", detail: (err as Error).message, life: 5000 });
      },
    },
  );
}

// ── Technology tree ───────────────────────────────────────────────────────────
const techFilters = computed(() => ({ typeId: "technology", pageSize: 500, page: 1 }));
const { data: techData, isLoading: techsLoading } = useCatalogList(techFilters);
const technologies = computed<EntryWithType[]>(() => (techData.value?.items as EntryWithType[] | undefined) ?? []);

const expandedTechId = ref("");
const { data: expandedTechDetail } = useCatalogDetail(expandedTechId);
const techAssocMap = ref<Record<string, { id: string; name: string; typeName: string }[]>>({});

watch(expandedTechDetail, (detail) => {
  if (!detail || !expandedTechId.value) return;
  const assocs = detail.associations ?? [];
  const allEntries = [...vendors.value, ...products.value];
  const entryById = Object.fromEntries(allEntries.map((e) => [e.id, e]));

  techAssocMap.value[expandedTechId.value] = assocs.map(
    (a: { sourceEntryId: string; targetEntryId: string }) => {
      const otherId =
        a.sourceEntryId === expandedTechId.value ? a.targetEntryId : a.sourceEntryId;
      const other = entryById[otherId];
      return { id: otherId, name: other?.name ?? otherId, typeName: other?.typeName ?? "" };
    },
  );
});

const techTreeNodes = computed(() =>
  technologies.value.map((tech) => ({
    key: tech.id,
    label: tech.name,
    data: tech,
    icon: "pi pi-microchip",
    leaf: false,
    children: (techAssocMap.value[tech.id] ?? []).map((linked) => ({
      key: linked.id,
      label: linked.name,
      data: linked,
      icon: "pi pi-circle",
      leaf: true,
    })),
  })),
);

function onTechNodeExpand(node: { key: string }) {
  expandedTechId.value = node.key;
}
</script>

<template>
  <div class="flex flex-col gap-6 p-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-primary">Catalog Management</h1>
        <p class="mt-1 text-sm text-muted">
          Manage vendors, products, technologies, and other catalog entries.
        </p>
      </div>
      <Button label="Add Entry" icon="pi pi-plus" @click="showCreateDialog = true" />
    </div>

    <!-- Tabs -->
    <Tabs value="vendor">
      <TabList>
        <Tab value="vendor">Vendor View</Tab>
        <Tab value="technology">Technology View</Tab>
        <Tab value="all">All Entries</Tab>
      </TabList>

      <TabPanels>
        <!-- Vendor View -->
        <TabPanel value="vendor" class="pt-4">
          <div v-if="vendorsLoading" class="flex justify-center py-12">
            <ProgressSpinner />
          </div>
          <div v-else-if="vendors.length === 0" class="py-8 text-center text-muted">
            No vendors found. Add a vendor entry to get started.
          </div>
          <Tree
            v-else
            :value="vendorTreeNodes"
            :draggable="true"
            :droppable="true"
            class="w-full"
            @node-expand="onVendorNodeExpand"
            @node-drop="onVendorTreeDrop"
          >
            <template #default="{ node }">
              <div class="flex items-center gap-2 py-1">
                <span class="flex-1 text-sm text-primary">{{ node.label }}</span>
                <Tag
                  v-if="node.data?.isVerified"
                  value="Verified"
                  severity="success"
                  class="text-xs"
                />
                <Button
                  icon="pi pi-pencil"
                  severity="secondary"
                  text
                  size="small"
                  aria-label="Edit"
                  @click.stop="openDrawer(node.key as string)"
                />
              </div>
            </template>
          </Tree>
        </TabPanel>

        <!-- Technology View -->
        <TabPanel value="technology" class="pt-4">
          <div v-if="techsLoading" class="flex justify-center py-12">
            <ProgressSpinner />
          </div>
          <div v-else-if="technologies.length === 0" class="py-8 text-center text-muted">
            No technologies found.
          </div>
          <Tree
            v-else
            :value="techTreeNodes"
            class="w-full"
            @node-expand="onTechNodeExpand"
          >
            <template #default="{ node }">
              <div class="flex items-center gap-2 py-1">
                <span class="flex-1 text-sm text-primary">{{ node.label }}</span>
                <Tag
                  v-if="node.data?.typeName"
                  :value="node.data.typeName"
                  severity="secondary"
                  class="text-xs"
                />
                <Button
                  v-if="node.data?.typeId"
                  icon="pi pi-pencil"
                  severity="secondary"
                  text
                  size="small"
                  aria-label="Edit"
                  @click.stop="openDrawer(node.key as string)"
                />
              </div>
            </template>
          </Tree>
        </TabPanel>

        <!-- All Entries -->
        <TabPanel value="all" class="pt-4">
          <div class="flex flex-col gap-4">
            <!-- Filters -->
            <div class="flex flex-wrap gap-3 rounded border border-subtle bg-surface-subtle p-4">
              <InputText
                v-model="filterSearch"
                placeholder="Search by name…"
                class="w-56"
                @keyup.enter="page = 1"
              />
              <Select
                v-model="filterTypeId"
                :options="typeOptions"
                option-label="label"
                option-value="value"
                placeholder="Filter by type"
                class="w-44"
                @change="page = 1"
              />
              <Select
                v-model="filterVerified"
                :options="verifiedOptions"
                option-label="label"
                option-value="value"
                class="w-44"
                @change="page = 1"
              />
              <Button label="Reset" severity="secondary" @click="resetFilters" />
            </div>

            <!-- Table -->
            <DataTable
              :value="entries"
              :loading="isListLoading"
              :total-records="totalRecords"
              :rows="pageSize"
              :first="(page - 1) * pageSize"
              paginator
              lazy
              data-key="id"
              class="rounded border border-subtle"
              @page="onPageChange"
            >
              <Column field="name" header="Name" class="font-medium text-primary" />
              <Column field="typeName" header="Type" />
              <Column header="Verified">
                <template #body="{ data: row }">
                  <Tag
                    :value="(row as EntryWithType).isVerified ? 'Verified' : 'Unverified'"
                    :severity="(row as EntryWithType).isVerified ? 'success' : 'warn'"
                  />
                </template>
              </Column>
              <Column header="Actions">
                <template #body="{ data: row }">
                  <Button
                    icon="pi pi-pencil"
                    severity="secondary"
                    text
                    size="small"
                    aria-label="Edit entry"
                    @click="openDrawer((row as EntryWithType).id)"
                  />
                </template>
              </Column>
            </DataTable>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <!-- Create Dialog -->
    <Dialog
      v-model:visible="showCreateDialog"
      header="Add Catalog Entry"
      modal
      :style="{ width: '480px' }"
    >
      <CatalogEntryForm
        mode="create"
        :catalog-types="catalogTypes"
        :loading="isCreating"
        @submit="handleCreate"
        @cancel="showCreateDialog = false"
      />
    </Dialog>

    <!-- Entry Drawer -->
    <CatalogEntryDrawer
      v-model:visible="drawerVisible"
      :entry-id="drawerEntryId"
      @deleted="drawerVisible = false"
    />
  </div>
</template>
```

**Step 4: Write test for the view**

Create `packages/web/src/views/admin/__tests__/CatalogManageView.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import CatalogManageView from "../CatalogManageView.vue";

describe("CatalogManageView", () => {
  it("renders the page heading", () => {
    const wrapper = mount(CatalogManageView, {
      global: { plugins: [createTestingPinia()] },
    });
    expect(wrapper.text()).toContain("Catalog Management");
  });

  it("renders the three tabs", () => {
    const wrapper = mount(CatalogManageView, {
      global: { plugins: [createTestingPinia()] },
    });
    expect(wrapper.text()).toContain("Vendor View");
    expect(wrapper.text()).toContain("Technology View");
    expect(wrapper.text()).toContain("All Entries");
  });
});
```

**Step 5: Run tests**

```bash
pnpm --filter @opo/web test src/views/admin/__tests__/CatalogManageView.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/web/src/views/admin/CatalogManageView.vue packages/web/src/views/admin/__tests__/CatalogManageView.test.ts
git commit -m "feat(web): rewrite CatalogManageView with hierarchical tree, tabs, and CatalogEntryDrawer"
```

---

## Task 7: Resolve drag-and-drop association lookup (vendor reassignment)

**Files:**
- Modify: `packages/web/src/views/admin/CatalogManageView.vue`

The drag-and-drop handler in Task 6 has a TODO: find the assocId to delete before creating the new one. This task completes that logic.

**Step 1: Understand the data available**

When a vendor node is expanded, `useCatalogDetail(vendorId)` is called. Its response includes `associations[]` with `{ id, sourceEntryId, targetEntryId, associationTypeId }`. We need to store these (not just the productIds) to look up assocId on drop.

**Step 2: Modify the vendorProductMap to store association objects**

In `CatalogManageView.vue`, change `vendorProductMap` to store the full association records:

```typescript
// Replace:
const vendorProductMap = ref<Record<string, string[]>>({});

// With:
const vendorAssocMap = ref<Record<string, { assocId: string; productId: string }[]>>({});
```

Update the `watch(expandedVendorDetail, ...)` to:
```typescript
watch(expandedVendorDetail, (detail) => {
  if (!detail || !expandedVendorId.value) return;
  const productAssocs = (detail.associations ?? []).filter(
    (a: { sourceEntryId: string }) => a.sourceEntryId === expandedVendorId.value,
  );
  vendorAssocMap.value[expandedVendorId.value] = productAssocs.map(
    (a: { id: string; targetEntryId: string }) => ({ assocId: a.id, productId: a.targetEntryId }),
  );
});
```

Update the tree node children to use `vendorAssocMap`:
```typescript
children: (vendorAssocMap.value[vendor.id] ?? [])
  .map(({ productId }) => productById[productId])
  .filter(Boolean)
  .map((product) => ({
    key: product.id,
    label: product.name,
    data: { ...product, __currentVendorId: vendor.id },
    icon: "pi pi-box",
    leaf: true,
  })),
```

Update the drop handler to use `vendorAssocMap`:
```typescript
function onVendorTreeDrop(event: {
  dragNode: { key: string; data: EntryWithType & { __currentVendorId?: string } };
  dropNode: { key: string; data: EntryWithType };
}) {
  const { dragNode, dropNode } = event;
  if (!dragNode.data || !dropNode.data) return;
  if (dropNode.data.typeId !== "vendor") return;

  const currentVendorId = dragNode.data.__currentVendorId;
  const productId = dragNode.key;
  const newVendorId = dropNode.key;

  if (currentVendorId === newVendorId) return;

  const existingAssoc = vendorAssocMap.value[currentVendorId ?? ""]?.find(
    (a) => a.productId === productId,
  );

  const doCreate = () => {
    createAssoc(
      { entryId: newVendorId, targetEntryId: productId, associationTypeId: "vendor_product" },
      {
        onSuccess: () => {
          toast.add({ severity: "success", summary: "Product reassigned", life: 3000 });
        },
        onError: (err) => {
          toast.add({ severity: "error", summary: "Reassignment failed", detail: (err as Error).message, life: 5000 });
        },
      },
    );
  };

  if (existingAssoc && currentVendorId) {
    deleteAssoc(
      { assocId: existingAssoc.assocId, entryId: currentVendorId },
      { onSuccess: doCreate, onError: doCreate },
    );
  } else {
    doCreate();
  }
}
```

> **Note:** The `associationTypeId: "vendor_product"` must match an actual seeded association type ID. Check `packages/server/src/migrations/seed-data.ts` for the actual ID of the catalog-catalog association type used for vendor→product links. If no such type exists in seed data, this task must also add it to the seed.

**Step 3: Check seed data for vendor_product association type**

```bash
grep -i "vendor\|product\|catalog_catalog" packages/server/src/migrations/seed-data.ts
```

If no `catalog_catalog` association type exists, add one to the seed:
```typescript
// In seed-data.ts, add to association_types insert:
{ id: 'assoc_vendor_product', name: 'has_product', applies_to: 'catalog_catalog', is_directional: true, inverse_id: 'assoc_product_vendor', is_system: true, sort_order: 10 },
{ id: 'assoc_product_vendor', name: 'made_by', applies_to: 'catalog_catalog', is_directional: true, inverse_id: 'assoc_vendor_product', is_system: true, sort_order: 11 },
```

**Step 4: Run full test suite**

```bash
pnpm --filter @opo/web test
pnpm --filter @opo/server test
```

Expected: all passing.

**Step 5: Commit**

```bash
git add packages/web/src/views/admin/CatalogManageView.vue packages/server/src/migrations/seed-data.ts
git commit -m "feat(web): complete drag-and-drop product reassignment in vendor tree"
```

---

## Task 8: Verify the implementation end-to-end

**Step 1: Build both packages**

```bash
pnpm --filter @opo/shared build
pnpm --filter @opo/server build
pnpm --filter @opo/web build
```

Expected: no TypeScript errors.

**Step 2: Run the dev server**

```bash
pnpm dev
```

Navigate to `/admin/catalog` and verify:
- Three tabs render
- Vendor View shows vendors, expanding loads products
- Technology View shows technologies
- All Entries shows the DataTable with filters
- Clicking any entry opens the drawer
- Drawer Details tab loads and saves
- Drawer Aliases tab shows aliases, add/remove works
- Drawer Associations tab shows linked entries, add/remove works

**Step 3: Run all tests one final time**

```bash
pnpm test
```

Expected: all passing.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: catalog management UI with hierarchical tree, drawer, and bidirectional associations"
```

---

## Notes for implementer

1. **Association type IDs for drag-and-drop:** Check `packages/server/src/migrations/seed-data.ts` before hardcoding any association type IDs. If `catalog_catalog`-scoped association types don't exist in the seed, add them in Task 7.

2. **PrimeVue Tree drag-and-drop event shape:** Verify the actual event payload by reading PrimeVue v4 Tree docs via context7 before implementing. The event fields (`dragNode`, `dropNode`) may differ from what's documented here.

3. **`useCatalogDetail` caching:** The lazy-load tree approach fires a detail query per expanded node. TanStack Query caches these automatically so repeated expansions don't re-fetch. This is acceptable for moderator-use admin pages.

4. **Test setup helpers:** Look at existing test files in `packages/server/src/routes/catalog/__tests__/` and `packages/web/src/components/catalog/__tests__/` for the correct test helper patterns (auth cookies, query client wrappers) before writing new tests.

5. **`CatalogEntryForm` in edit mode:** The form currently emits `CreateCatalogEntryInput | UpdateCatalogEntryInput`. In the drawer, only `UpdateCatalogEntryInput` is used — no type cast needed because the drawer only calls `handleUpdate`.
