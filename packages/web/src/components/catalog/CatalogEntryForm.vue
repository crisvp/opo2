<script setup lang="ts">
import { ref, computed, watch } from "vue";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import Checkbox from "primevue/checkbox";
import Button from "primevue/button";
import Message from "primevue/message";

import type { CatalogType, CreateCatalogEntryInput, UpdateCatalogEntryInput } from "@opo/shared";
import { createCatalogEntrySchema, updateCatalogEntrySchema } from "@opo/shared";

const props = defineProps<{
  catalogTypes: CatalogType[];
  initialValues?: {
    typeId?: string;
    name?: string;
    attributes?: Record<string, unknown>;
    isVerified?: boolean;
  };
  loading?: boolean;
  mode?: "create" | "edit";
}>();

const emit = defineEmits<{
  submit: [values: CreateCatalogEntryInput | UpdateCatalogEntryInput];
  cancel: [];
}>();

const typeId = ref(props.initialValues?.typeId ?? "");
const name = ref(props.initialValues?.name ?? "");
const isVerified = ref(props.initialValues?.isVerified ?? false);
const attributesJson = ref(
  props.initialValues?.attributes ? JSON.stringify(props.initialValues.attributes, null, 2) : "",
);

const validationError = ref<string | null>(null);
const jsonError = ref<string | null>(null);

const mode = computed(() => props.mode ?? "create");

const typeOptions = computed(() =>
  props.catalogTypes.map((t) => ({ label: t.name, value: t.id })),
);

watch(attributesJson, () => {
  jsonError.value = null;
});

function parseAttributes(): Record<string, unknown> | undefined {
  const raw = attributesJson.value.trim();
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      jsonError.value = "Attributes must be a JSON object";
      return undefined;
    }
    jsonError.value = null;
    return parsed as Record<string, unknown>;
  } catch {
    jsonError.value = "Invalid JSON";
    return undefined;
  }
}

function handleSubmit() {
  validationError.value = null;

  if (attributesJson.value.trim()) {
    const attrs = parseAttributes();
    if (jsonError.value) return;

    if (mode.value === "create") {
      const result = createCatalogEntrySchema.safeParse({
        typeId: typeId.value,
        name: name.value,
        attributes: attrs,
        isVerified: isVerified.value,
      });
      if (!result.success) {
        validationError.value = result.error.issues.map((i) => i.message).join("; ");
        return;
      }
      emit("submit", result.data);
    } else {
      const result = updateCatalogEntrySchema.safeParse({
        name: name.value || undefined,
        attributes: attrs,
        isVerified: isVerified.value,
      });
      if (!result.success) {
        validationError.value = result.error.issues.map((i) => i.message).join("; ");
        return;
      }
      emit("submit", result.data);
    }
    return;
  }

  if (mode.value === "create") {
    const result = createCatalogEntrySchema.safeParse({
      typeId: typeId.value,
      name: name.value,
      isVerified: isVerified.value,
    });
    if (!result.success) {
      validationError.value = result.error.issues.map((i) => i.message).join("; ");
      return;
    }
    emit("submit", result.data);
  } else {
    const result = updateCatalogEntrySchema.safeParse({
      name: name.value || undefined,
      isVerified: isVerified.value,
    });
    if (!result.success) {
      validationError.value = result.error.issues.map((i) => i.message).join("; ");
      return;
    }
    emit("submit", result.data);
  }
}
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
    <Message v-if="validationError" severity="error" :closable="false">
      {{ validationError }}
    </Message>

    <div v-if="mode === 'create'" class="flex flex-col gap-1">
      <label class="text-sm font-medium text-primary" for="entry-type">Type</label>
      <Select
        id="entry-type"
        v-model="typeId"
        :options="typeOptions"
        option-label="label"
        option-value="value"
        placeholder="Select type…"
        class="w-full"
      />
    </div>

    <div class="flex flex-col gap-1">
      <label class="text-sm font-medium text-primary" for="entry-name">Name</label>
      <InputText
        id="entry-name"
        v-model="name"
        :placeholder="mode === 'create' ? 'Entry name…' : 'Update name…'"
        class="w-full"
      />
    </div>

    <div class="flex flex-col gap-1">
      <label class="text-sm font-medium text-primary" for="entry-attributes">
        Attributes (JSON, optional)
      </label>
      <textarea
        id="entry-attributes"
        v-model="attributesJson"
        rows="10"
        placeholder="{}"
        class="w-full rounded border border-default bg-surface p-2 font-mono text-sm text-primary focus:outline-none focus:ring-2 focus:ring-focus"
      />
      <span v-if="jsonError" class="text-sm text-critical">{{ jsonError }}</span>
    </div>

    <div class="flex items-center gap-2">
      <Checkbox
        v-model="isVerified"
        input-id="entry-verified"
        :binary="true"
      />
      <label class="text-sm text-primary" for="entry-verified">Verified</label>
    </div>

    <div class="flex justify-end gap-2">
      <Button
        type="button"
        label="Cancel"
        severity="secondary"
        :disabled="props.loading"
        @click="emit('cancel')"
      />
      <Button
        type="submit"
        :label="mode === 'create' ? 'Create' : 'Save'"
        :loading="props.loading"
      />
    </div>
  </form>
</template>
