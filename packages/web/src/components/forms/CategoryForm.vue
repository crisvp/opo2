<script setup lang="ts">
import { ref, computed, watch } from "vue";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import Button from "primevue/button";
import type { DocumentCategoryRecord, CreateCategoryInput, UpdateCategoryInput } from "@opo/shared";

const props = defineProps<{
  modelValue?: DocumentCategoryRecord | null;
}>();

const emit = defineEmits<{
  submit: [data: CreateCategoryInput | UpdateCategoryInput];
  cancel: [];
}>();

const isEdit = computed(() => !!props.modelValue);
const id = ref(props.modelValue?.id ?? "");
const name = ref(props.modelValue?.name ?? "");
const description = ref(props.modelValue?.description ?? "");

watch(
  () => props.modelValue,
  (val) => {
    id.value = val?.id ?? "";
    name.value = val?.name ?? "";
    description.value = val?.description ?? "";
  },
);

function onSubmit() {
  if (isEdit.value) {
    emit("submit", { name: name.value, description: description.value || null });
  } else {
    emit("submit", { id: id.value, name: name.value, description: description.value || null });
  }
}
</script>

<template>
  <form @submit.prevent="onSubmit" class="flex flex-col gap-4">
    <div v-if="!isEdit" class="flex flex-col gap-1">
      <label class="text-sm font-medium">Category ID</label>
      <InputText v-model="id" placeholder="e.g. contract" />
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-sm font-medium">Name</label>
      <InputText v-model="name" placeholder="Category name" />
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-sm font-medium">Description</label>
      <Textarea v-model="description" placeholder="Optional description" :rows="3" />
    </div>
    <div class="flex gap-2 justify-end">
      <Button type="button" label="Cancel" severity="secondary" @click="emit('cancel')" />
      <Button type="submit" :label="isEdit ? 'Update' : 'Create'" />
    </div>
  </form>
</template>
