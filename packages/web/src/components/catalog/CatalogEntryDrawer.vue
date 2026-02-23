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
import ConfirmDialog from "primevue/confirmdialog";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";

import type {
  CatalogType,
  CatalogAlias,
  CatalogEntryAssociation,
  AssociationType,
  UpdateCatalogEntryInput,
} from "@opo/shared";
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

const catalogTypes = computed<CatalogType[]>(
  () => (typesData.value as CatalogType[] | undefined) ?? [],
);
const entry = computed(() => detailData.value ?? null);
const associationTypes = computed<AssociationType[]>(
  () => (assocTypesData.value as AssociationType[] | undefined) ?? [],
);
const aliases = computed<CatalogAlias[]>(() => entry.value?.aliases ?? []);
const associations = computed<CatalogEntryAssociation[]>(
  () => (entry.value?.associations as CatalogEntryAssociation[] | undefined) ?? [],
);

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
        toast.add({
          severity: "error",
          summary: "Update failed",
          detail: (err as Error).message,
          life: 5000,
        });
      },
    },
  );
}

function confirmDelete() {
  if (!entry.value) return;
  const entryName = entry.value.name;
  const entryId = entry.value.id;
  confirm.require({
    message: `Delete "${entryName}"? This cannot be undone.`,
    header: "Confirm Delete",
    icon: "pi pi-exclamation-triangle",
    rejectLabel: "Cancel",
    acceptLabel: "Delete",
    acceptClass: "p-button-danger",
    accept: () => {
      deleteEntry(entryId, {
        onSuccess: () => {
          emit("deleted", entryId);
          emit("update:visible", false);
          toast.add({ severity: "success", summary: "Entry deleted", life: 3000 });
        },
        onError: (err) => {
          toast.add({
            severity: "error",
            summary: "Delete failed",
            detail: (err as Error).message,
            life: 5000,
          });
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
        <span class="font-semibold text-primary">{{ entry?.name ?? "Loading…" }}</span>
        <Tag v-if="entry" :value="entry.typeName ?? entry.typeId" severity="secondary" />
      </div>
    </template>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <ProgressSpinner />
    </div>

    <div v-else-if="entry">
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
            <AliasManager :entry-id="entry.id" :aliases="aliases" />
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

    <div v-else class="py-8 text-center text-muted">Entry not found.</div>
  </Drawer>
</template>
