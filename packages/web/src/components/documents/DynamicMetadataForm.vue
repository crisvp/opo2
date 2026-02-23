<script setup lang="ts">
import { computed } from "vue";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import DatePicker from "primevue/datepicker";
import Checkbox from "primevue/checkbox";
import Select from "primevue/select";
import type { MetadataFieldDefinition } from "@opo/shared";
import { useCategoryFields } from "../../api/queries/categories";

const props = defineProps<{
  categoryId: string;
  modelValue: Record<string, unknown>;
}>();

const emit = defineEmits<{
  "update:modelValue": [v: Record<string, unknown>];
}>();

const categoryIdRef = computed(() => props.categoryId);
const { data: fields } = useCategoryFields(categoryIdRef);

function update(key: string, val: unknown) {
  emit("update:modelValue", { ...props.modelValue, [key]: val });
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <template v-if="fields && fields.length > 0">
      <div
        v-for="field in (fields as MetadataFieldDefinition[])"
        :key="field.fieldKey"
        class="flex flex-col gap-1"
      >
        <label class="text-sm font-medium">
          {{ field.displayName }}
          <span v-if="field.isRequired" class="text-critical">*</span>
        </label>
        <InputText
          v-if="field.valueType === 'text'"
          :model-value="(modelValue[field.fieldKey] as string) ?? ''"
          @update:model-value="(v) => update(field.fieldKey, v)"
        />
        <InputNumber
          v-else-if="field.valueType === 'number'"
          :model-value="(modelValue[field.fieldKey] as number) ?? null"
          @update:model-value="(v) => update(field.fieldKey, v)"
        />
        <InputNumber
          v-else-if="field.valueType === 'currency'"
          :model-value="(modelValue[field.fieldKey] as number) ?? null"
          mode="currency"
          currency="USD"
          @update:model-value="(v) => update(field.fieldKey, v)"
        />
        <DatePicker
          v-else-if="field.valueType === 'date'"
          :model-value="(modelValue[field.fieldKey] as Date) ?? null"
          @update:model-value="(v) => update(field.fieldKey, v)"
        />
        <Checkbox
          v-else-if="field.valueType === 'boolean'"
          :model-value="(modelValue[field.fieldKey] as boolean) ?? false"
          :binary="true"
          @update:model-value="(v) => update(field.fieldKey, v)"
        />
        <Select
          v-else-if="field.valueType === 'enum'"
          :model-value="modelValue[field.fieldKey]"
          :options="field.enumValues ?? []"
          @update:model-value="(v) => update(field.fieldKey, v)"
        />
      </div>
    </template>
    <p v-else class="text-sm text-muted">No fields defined for this category.</p>
  </div>
</template>
