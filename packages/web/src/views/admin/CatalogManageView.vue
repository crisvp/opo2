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

import type { CatalogEntry, CatalogType, CreateCatalogEntryInput, UpdateCatalogEntryInput } from "@opo/shared";
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

// Association id type returned from detail
type AssocRecord = { id: string; sourceEntryId: string; targetEntryId: string; associationTypeId: string };

const toast = useToast();

// ── Drawer ────────────────────────────────────────────────────────────────────
const drawerVisible = ref(false);
const drawerEntryId = ref("");

function openDrawer(entryId: string) {
  drawerEntryId.value = entryId;
  drawerVisible.value = true;
}

// ── Create dialog ─────────────────────────────────────────────────────────────
const showCreateDialog = ref(false);
const { data: typesData } = useCatalogTypes();
const catalogTypes = computed<CatalogType[]>(
  () => (typesData.value as CatalogType[] | undefined) ?? [],
);

const { mutate: createEntry, isPending: isCreating } = useCreateCatalogEntry();

function handleCreate(values: CreateCatalogEntryInput | UpdateCatalogEntryInput) {
  createEntry(values as CreateCatalogEntryInput, {
    onSuccess: () => {
      showCreateDialog.value = false;
      toast.add({ severity: "success", summary: "Entry created", life: 3000 });
    },
    onError: (err) => {
      toast.add({
        severity: "error",
        summary: "Failed to create entry",
        detail: (err as Error).message,
        life: 5000,
      });
    },
  });
}

// ── All Entries tab (flat DataTable) ──────────────────────────────────────────
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
const entries = computed<EntryWithType[]>(
  () => (entriesData.value?.items as EntryWithType[] | undefined) ?? [],
);
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
const vendorFilters = computed(() => ({ typeId: "vendor", pageSize: 500, page: 1 }));
const productFilters = computed(() => ({ typeId: "product", pageSize: 500, page: 1 }));

const { data: vendorData, isLoading: vendorsLoading } = useCatalogList(vendorFilters);
const { data: productData } = useCatalogList(productFilters);

const vendors = computed<EntryWithType[]>(
  () => (vendorData.value?.items as EntryWithType[] | undefined) ?? [],
);
const products = computed<EntryWithType[]>(
  () => (productData.value?.items as EntryWithType[] | undefined) ?? [],
);

// Lazy loading: one detail query at a time per expanded vendor
const expandedVendorId = ref("");
const { data: expandedVendorDetail } = useCatalogDetail(expandedVendorId);
const vendorExpandedKeys = ref<Record<string, boolean>>({});

// Map: vendorId → [{ assocId, productId }]
const vendorAssocMap = ref<Record<string, { assocId: string; productId: string }[]>>({});

watch(expandedVendorDetail, (detail) => {
  if (!detail || !expandedVendorId.value) return;
  const vid = expandedVendorId.value;
  const productAssocs = ((detail.associations ?? []) as AssocRecord[]).filter(
    (a) => a.sourceEntryId === vid && a.associationTypeId === "makes",
  );
  vendorAssocMap.value[vid] = productAssocs.map((a) => ({
    assocId: a.id,
    productId: a.targetEntryId,
  }));
});

const vendorTreeNodes = computed(() => {
  const productById = Object.fromEntries(products.value.map((p) => [p.id, p]));
  return vendors.value.map((vendor) => ({
    key: vendor.id,
    label: vendor.name,
    data: vendor,
    icon: "pi pi-building",
    leaf: false,
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
  }));
});

function onVendorNodeExpand(node: { key: string }) {
  expandedVendorId.value = node.key;
}

function toggleVendorNode(node: { key?: string; leaf?: boolean }) {
  if (!node.key || node.leaf) return;
  if (vendorExpandedKeys.value[node.key]) {
    const updated = { ...vendorExpandedKeys.value };
    delete updated[node.key];
    vendorExpandedKeys.value = updated;
  } else {
    vendorExpandedKeys.value = { ...vendorExpandedKeys.value, [node.key]: true };
    expandedVendorId.value = node.key;
  }
}

const { mutate: createAssoc } = useCreateCatalogAssociation();
const { mutate: deleteAssoc } = useDeleteCatalogAssociation();

function onVendorTreeDrop(event: {
  dragNode: { key?: string; data?: unknown };
  dropNode: { key?: string; data?: unknown };
}) {
  const { dragNode, dropNode } = event;
  if (!dragNode?.data || !dropNode?.data) return;
  const dragData = dragNode.data as EntryWithType & { __currentVendorId?: string };
  const dropData = dropNode.data as EntryWithType;
  if (dropData.typeId !== "vendor") return;

  const currentVendorId = dragData.__currentVendorId;
  const productId = dragNode.key;
  const newVendorId = dropNode.key;

  if (!newVendorId || !productId) return;
  if (currentVendorId === newVendorId) return;

  const existingAssoc = vendorAssocMap.value[currentVendorId ?? ""]?.find(
    (a) => a.productId === productId,
  );

  const doCreate = () => {
    createAssoc(
      { entryId: newVendorId, targetEntryId: productId, associationTypeId: "makes" },
      {
        onSuccess: () => {
          toast.add({ severity: "success", summary: "Product reassigned", life: 3000 });
        },
        onError: (err) => {
          toast.add({
            severity: "error",
            summary: "Reassignment failed",
            detail: (err as Error).message,
            life: 5000,
          });
        },
      },
    );
  };

  if (existingAssoc && currentVendorId) {
    deleteAssoc({ assocId: existingAssoc.assocId, entryId: currentVendorId }, {
      onSuccess: doCreate,
      onError: doCreate,
    });
  } else {
    doCreate();
  }
}

// ── Technology tree ───────────────────────────────────────────────────────────
const techFilters = computed(() => ({ typeId: "technology", pageSize: 500, page: 1 }));
const { data: techData, isLoading: techsLoading } = useCatalogList(techFilters);
const technologies = computed<EntryWithType[]>(
  () => (techData.value?.items as EntryWithType[] | undefined) ?? [],
);

const expandedTechId = ref("");
const { data: expandedTechDetail } = useCatalogDetail(expandedTechId);
const techExpandedKeys = ref<Record<string, boolean>>({});
const techLinkedMap = ref<Record<string, { id: string; name: string; typeName: string }[]>>({});

watch(expandedTechDetail, (detail) => {
  if (!detail || !expandedTechId.value) return;
  const tid = expandedTechId.value;
  const assocs = (detail.associations ?? []) as AssocRecord[];
  const allEntries = [...vendors.value, ...products.value];
  const entryById = Object.fromEntries(allEntries.map((e) => [e.id, e]));

  techLinkedMap.value[tid] = assocs.map((a) => {
    const otherId = a.sourceEntryId === tid ? a.targetEntryId : a.sourceEntryId;
    const other = entryById[otherId];
    return { id: otherId, name: other?.name ?? otherId, typeName: other?.typeName ?? "" };
  });
});

const techTreeNodes = computed(() =>
  technologies.value.map((tech) => ({
    key: tech.id,
    label: tech.name,
    data: tech,
    icon: "pi pi-microchip",
    leaf: false,
    children: (techLinkedMap.value[tech.id] ?? []).map((linked) => ({
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

function toggleTechNode(node: { key?: string; leaf?: boolean }) {
  if (!node.key || node.leaf) return;
  if (techExpandedKeys.value[node.key]) {
    const updated = { ...techExpandedKeys.value };
    delete updated[node.key];
    techExpandedKeys.value = updated;
  } else {
    techExpandedKeys.value = { ...techExpandedKeys.value, [node.key]: true };
    expandedTechId.value = node.key;
  }
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
            v-model:expandedKeys="vendorExpandedKeys"
            :value="vendorTreeNodes"
            :draggable="true"
            :droppable="true"
            class="w-full border-0"
            @node-expand="onVendorNodeExpand"
            @node-drop="onVendorTreeDrop"
          >
            <template #default="{ node }">
              <div class="flex items-center gap-2 py-1 cursor-pointer" @click="toggleVendorNode(node)">
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
            v-model:expandedKeys="techExpandedKeys"
            :value="techTreeNodes"
            class="w-full border-0"
            @node-expand="onTechNodeExpand"
          >
            <template #default="{ node }">
              <div class="flex items-center gap-2 py-1 cursor-pointer" @click="toggleTechNode(node)">
                <span class="flex-1 text-sm text-primary">{{ node.label }}</span>
                <Tag
                  v-if="node.data?.typeName"
                  :value="(node.data as EntryWithType).typeName"
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
