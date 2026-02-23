<script setup lang="ts">
import { ref } from "vue";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import Tag from "primevue/tag";
import Message from "primevue/message";

import type { CatalogAlias } from "@opo/shared";
import { useAddCatalogAlias, useDeleteCatalogAlias } from "../../api/queries/catalog";

const props = defineProps<{
  entryId: string;
  aliases: CatalogAlias[];
}>();

const emit = defineEmits<{
  updated: [];
}>();

const newAlias = ref("");
const newSource = ref<"manual" | "ai_suggestion" | "import">("manual");
const addError = ref<string | null>(null);

const sourceOptions = [
  { label: "Manual", value: "manual" },
  { label: "AI Suggestion", value: "ai_suggestion" },
  { label: "Import", value: "import" },
];

const { mutate: addAlias, isPending: isAdding } = useAddCatalogAlias();
const { mutate: deleteAlias, isPending: isDeleting } = useDeleteCatalogAlias();

function handleAdd() {
  addError.value = null;
  const alias = newAlias.value.trim();
  if (!alias) {
    addError.value = "Alias cannot be empty";
    return;
  }
  if (alias.length > 500) {
    addError.value = "Alias must be 500 characters or fewer";
    return;
  }

  addAlias(
    { entryId: props.entryId, alias, source: newSource.value },
    {
      onSuccess: () => {
        newAlias.value = "";
        newSource.value = "manual";
        emit("updated");
      },
      onError: (err) => {
        addError.value = (err as Error).message;
      },
    },
  );
}

function handleDelete(aliasId: string) {
  deleteAlias(
    { aliasId, entryId: props.entryId },
    {
      onSuccess: () => {
        emit("updated");
      },
    },
  );
}

function sourceLabel(source: string): string {
  switch (source) {
    case "ai_suggestion":
      return "AI";
    case "import":
      return "Import";
    default:
      return "Manual";
  }
}

function sourceSeverity(source: string): "info" | "success" | "warn" {
  switch (source) {
    case "ai_suggestion":
      return "info";
    case "import":
      return "warn";
    default:
      return "success";
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold text-primary">Aliases</h3>

      <div v-if="props.aliases.length === 0" class="text-sm text-muted">
        No aliases yet.
      </div>

      <ul v-else class="flex flex-col gap-2">
        <li
          v-for="a in props.aliases"
          :key="a.id"
          class="flex items-center justify-between rounded border border-subtle bg-surface px-3 py-2"
        >
          <div class="flex items-center gap-2">
            <span class="text-sm text-primary">{{ a.alias }}</span>
            <span class="text-xs text-muted">({{ a.normalizedAlias }})</span>
            <Tag :value="sourceLabel(a.source)" :severity="sourceSeverity(a.source)" />
          </div>
          <Button
            icon="pi pi-times"
            severity="danger"
            text
            size="small"
            :loading="isDeleting"
            aria-label="Remove alias"
            @click="handleDelete(a.id)"
          />
        </li>
      </ul>
    </div>

    <div class="flex flex-col gap-2 rounded border border-subtle bg-surface-subtle p-3">
      <h4 class="text-sm font-medium text-primary">Add Alias</h4>

      <Message v-if="addError" severity="error" :closable="false">
        {{ addError }}
      </Message>

      <div class="flex gap-2">
        <InputText
          v-model="newAlias"
          placeholder="Alias text…"
          class="flex-1"
          @keyup.enter="handleAdd"
        />
        <Select
          v-model="newSource"
          :options="sourceOptions"
          option-label="label"
          option-value="value"
          class="w-36"
        />
        <Button
          label="Add"
          :loading="isAdding"
          :disabled="!newAlias.trim()"
          @click="handleAdd"
        />
      </div>
    </div>
  </div>
</template>
