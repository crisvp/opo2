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

type SearchResult = { id: string; name: string; typeId: string; typeName: string; similarity: number };

const outgoing = computed(() => props.associations.filter((a) => a.sourceEntryId === props.entryId));
const incoming = computed(() => props.associations.filter((a) => a.targetEntryId === props.entryId));

function typeName(typeId: string): string {
  return props.associationTypes.find((t) => t.id === typeId)?.name ?? typeId;
}

const catalogCatalogTypes = computed(() =>
  props.associationTypes.filter((t) => t.appliesTo === "catalog_catalog"),
);
const typeOptions = computed(() =>
  catalogCatalogTypes.value.map((t) => ({ label: t.name, value: t.id })),
);

const searchQuery = ref("");
const searchResults = ref<SearchResult[]>([]);
const selectedTarget = ref<SearchResult | null>(null);
const selectedTypeId = ref("");
const addError = ref<string | null>(null);

const searchQueryRef = computed(() => searchQuery.value);
const { data: searchData } = useCatalogSearch(searchQueryRef);

function onSearchInput(event: { query: string }) {
  searchQuery.value = event.query;
  searchResults.value = ((searchData.value ?? []) as SearchResult[]).filter((r) => r.id !== props.entryId);
}

const { mutate: createAssoc, isPending: isCreating } = useCreateCatalogAssociation();
const { mutate: deleteAssoc, isPending: isDeleting } = useDeleteCatalogAssociation();

function handleAdd() {
  addError.value = null;
  if (!selectedTypeId.value) {
    addError.value = "Select an association type";
    return;
  }
  if (!selectedTarget.value) {
    addError.value = "Select a target entry";
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
    <!-- Outgoing associations -->
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
            <span class="text-sm text-primary">{{ a.targetName ?? a.targetEntryId }}</span>
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

    <!-- Incoming associations -->
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
            <span class="text-sm text-primary">{{ a.sourceName ?? a.sourceEntryId }}</span>
          </div>
        </li>
      </ul>
    </div>

    <!-- Add form -->
    <div class="flex flex-col gap-3 rounded border border-subtle bg-surface-subtle p-3">
      <h4 class="text-sm font-medium text-primary">Add Association</h4>
      <Message v-if="addError" severity="error" :closable="false">{{ addError }}</Message>
      <div class="flex flex-col gap-2">
        <Select
          v-model="selectedTypeId"
          :options="typeOptions"
          option-label="label"
          option-value="value"
          placeholder="Association type…"
          class="w-full"
        />
        <AutoComplete
          v-model="selectedTarget"
          :suggestions="searchResults"
          option-label="name"
          placeholder="Search for an entry…"
          :disabled="!selectedTypeId"
          class="w-full"
          @complete="onSearchInput"
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
