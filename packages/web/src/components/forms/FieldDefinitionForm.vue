<script setup lang="ts">
import { ref, watch, computed } from "vue";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import Checkbox from "primevue/checkbox";
import InputNumber from "primevue/inputnumber";
import Button from "primevue/button";
import type { MetadataFieldDefinition, CreateFieldDefinitionInput } from "@opo/shared";
import { FIELD_TYPES } from "@opo/shared";

const props = defineProps<{
  categoryId: string;
  modelValue?: MetadataFieldDefinition | null;
}>();

const emit = defineEmits<{
  submit: [data: Omit<CreateFieldDefinitionInput, "categoryId">];
  cancel: [];
}>();

const fieldTypeOptions = Object.values(FIELD_TYPES).map((v) => ({ label: v, value: v }));

const fieldKey = ref(props.modelValue?.fieldKey ?? "");
const displayName = ref(props.modelValue?.displayName ?? "");
const valueType = ref<string>(props.modelValue?.valueType ?? "text");
const isRequired = ref(props.modelValue?.isRequired ?? false);
const isAiExtractable = ref(props.modelValue?.isAiExtractable ?? false);
const enumValuesStr = ref((props.modelValue?.enumValues ?? []).join(", "));
const displayOrder = ref(props.modelValue?.displayOrder ?? 0);

const isEnum = computed(() => valueType.value === "enum");

watch(
  () => props.modelValue,
  (val) => {
    fieldKey.value = val?.fieldKey ?? "";
    displayName.value = val?.displayName ?? "";
    valueType.value = val?.valueType ?? "text";
    isRequired.value = val?.isRequired ?? false;
    isAiExtractable.value = val?.isAiExtractable ?? false;
    enumValuesStr.value = (val?.enumValues ?? []).join(", ");
    displayOrder.value = val?.displayOrder ?? 0;
  },
);

function onSubmit() {
  const data: Omit<CreateFieldDefinitionInput, "categoryId"> = {
    fieldKey: fieldKey.value,
    displayName: displayName.value,
    valueType: valueType.value as CreateFieldDefinitionInput["valueType"],
    isRequired: isRequired.value,
    isAiExtractable: isAiExtractable.value,
    displayOrder: displayOrder.value,
  };
  if (isEnum.value) {
    data.enumValues = enumValuesStr.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  emit("submit", data);
}
</script>

<template>
  <form @submit.prevent="onSubmit" class="flex flex-col gap-4">
    <div class="flex flex-col gap-1">
      <label class="text-sm font-medium">Field Key</label>
      <InputText v-model="fieldKey" placeholder="e.g. contract_value" />
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-sm font-medium">Display Name</label>
      <InputText v-model="displayName" placeholder="e.g. Contract Value" />
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-sm font-medium">Field Type</label>
      <Select v-model="valueType" :options="fieldTypeOptions" option-label="label" option-value="value" />
    </div>
    <div v-if="isEnum" class="flex flex-col gap-1">
      <label class="text-sm font-medium">Enum Values (comma-separated)</label>
      <InputText v-model="enumValuesStr" placeholder="option1, option2, option3" />
    </div>
    <div class="flex items-center gap-2">
      <Checkbox v-model="isRequired" :binary="true" input-id="is-required" />
      <label for="is-required">Required</label>
    </div>
    <div class="flex items-center gap-2">
      <Checkbox v-model="isAiExtractable" :binary="true" input-id="is-ai" />
      <label for="is-ai">AI Extractable</label>
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-sm font-medium">Display Order</label>
      <InputNumber v-model="displayOrder" :min="0" />
    </div>
    <div class="flex gap-2 justify-end">
      <Button type="button" label="Cancel" severity="secondary" @click="emit('cancel')" />
      <Button type="submit" :label="props.modelValue ? 'Update' : 'Add Field'" />
    </div>
  </form>
</template>
