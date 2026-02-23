<script setup lang="ts">
import { ref, watch, computed } from "vue";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import Textarea from "primevue/textarea";
import Button from "primevue/button";

import type { Tier, CreateTierInput, UpdateTierInput, TierLimit } from "@opo/shared";

const props = defineProps<{
  modelValue?: Tier | null;
}>();

const emit = defineEmits<{
  submit: [data: CreateTierInput | UpdateTierInput];
  cancel: [];
}>();

const isEdit = computed(() => !!props.modelValue);
const id = ref<number>(props.modelValue?.id ?? 0);
const name = ref(props.modelValue?.name ?? "");
const description = ref(props.modelValue?.description ?? "");
const limits = ref<TierLimit[]>(props.modelValue?.limits ? [...props.modelValue.limits] : []);

watch(
  () => props.modelValue,
  (val) => {
    id.value = val?.id ?? 0;
    name.value = val?.name ?? "";
    description.value = val?.description ?? "";
    limits.value = val?.limits ? [...val.limits] : [];
  },
);

function addLimit() {
  limits.value.push({ limitType: "", limitValue: 0 });
}

function removeLimit(idx: number) {
  limits.value.splice(idx, 1);
}

function onSubmit() {
  if (isEdit.value) {
    const data: UpdateTierInput = {};
    if (name.value) data.name = name.value;
    data.description = description.value || null;
    emit("submit", data);
  } else {
    const data: CreateTierInput = {
      id: id.value,
      name: name.value,
      description: description.value || undefined,
      isDefault: false,
      limits: [...limits.value],
    };
    emit("submit", data);
  }
}
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
    <div v-if="!isEdit" class="flex flex-col gap-1">
      <label class="text-sm font-medium">Tier ID (integer)</label>
      <InputNumber v-model="id" :min="1" />
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-sm font-medium">Name</label>
      <InputText v-model="name" placeholder="e.g. Basic" />
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-sm font-medium">Description</label>
      <Textarea v-model="description" rows="2" />
    </div>
    <div v-if="!isEdit">
      <div class="mb-2 flex items-center justify-between">
        <label class="text-sm font-medium">Limits</label>
        <Button type="button" label="Add Limit" size="small" severity="secondary" @click="addLimit" />
      </div>
      <div v-for="(limit, idx) in limits" :key="idx" class="mb-2 flex items-center gap-2">
        <InputText v-model="limit.limitType" placeholder="uploads" class="flex-1" />
        <InputNumber v-model="limit.limitValue" :min="0" class="w-24" />
        <Button type="button" icon="pi pi-trash" severity="danger" size="small" @click="removeLimit(idx)" />
      </div>
    </div>
    <div class="flex justify-end gap-2">
      <Button type="button" label="Cancel" severity="secondary" @click="emit('cancel')" />
      <Button type="submit" :label="isEdit ? 'Update' : 'Create'" />
    </div>
  </form>
</template>
