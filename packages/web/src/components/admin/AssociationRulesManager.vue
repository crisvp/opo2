<script setup lang="ts">
import { ref, watch, computed } from "vue";
import InputNumber from "primevue/inputnumber";
import Button from "primevue/button";
import { useCategoryDetail, useUpdateCategoryRules } from "../../api/queries/categories";

const props = defineProps<{
  categoryId: string;
}>();

const categoryIdRef = computed(() => props.categoryId);
const { data: category } = useCategoryDetail(categoryIdRef);
const { mutate: updateRules, isPending } = useUpdateCategoryRules();

const minVendors = ref<number | null>(null);
const maxVendors = ref<number | null>(null);
const minProducts = ref<number | null>(null);
const maxProducts = ref<number | null>(null);
const minTechnologies = ref<number | null>(null);
const maxTechnologies = ref<number | null>(null);
const minGovernmentEntities = ref<number | null>(null);
const maxGovernmentEntities = ref<number | null>(null);

watch(
  category,
  (val) => {
    if (val) {
      minVendors.value = val.minVendors ?? null;
      maxVendors.value = val.maxVendors ?? null;
      minProducts.value = val.minProducts ?? null;
      maxProducts.value = val.maxProducts ?? null;
      minTechnologies.value = val.minTechnologies ?? null;
      maxTechnologies.value = val.maxTechnologies ?? null;
      minGovernmentEntities.value = val.minGovernmentEntities ?? null;
      maxGovernmentEntities.value = val.maxGovernmentEntities ?? null;
    }
  },
  { immediate: true },
);

function onSave() {
  updateRules({
    id: props.categoryId,
    minVendors: minVendors.value,
    maxVendors: maxVendors.value,
    minProducts: minProducts.value,
    maxProducts: maxProducts.value,
    minTechnologies: minTechnologies.value,
    maxTechnologies: maxTechnologies.value,
    minGovernmentEntities: minGovernmentEntities.value,
    maxGovernmentEntities: maxGovernmentEntities.value,
  });
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <h3 class="text-base font-semibold">Association Rules</h3>

    <div class="grid grid-cols-2 gap-4">
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium">Min Vendors</label>
        <InputNumber v-model="minVendors" :min="0" placeholder="None" show-buttons />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium">Max Vendors</label>
        <InputNumber v-model="maxVendors" :min="0" placeholder="None" show-buttons />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium">Min Products</label>
        <InputNumber v-model="minProducts" :min="0" placeholder="None" show-buttons />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium">Max Products</label>
        <InputNumber v-model="maxProducts" :min="0" placeholder="None" show-buttons />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium">Min Technologies</label>
        <InputNumber v-model="minTechnologies" :min="0" placeholder="None" show-buttons />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium">Max Technologies</label>
        <InputNumber v-model="maxTechnologies" :min="0" placeholder="None" show-buttons />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium">Min Government Entities</label>
        <InputNumber v-model="minGovernmentEntities" :min="0" placeholder="None" show-buttons />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium">Max Government Entities</label>
        <InputNumber v-model="maxGovernmentEntities" :min="0" placeholder="None" show-buttons />
      </div>
    </div>

    <div class="flex justify-end">
      <Button label="Save Rules" :loading="isPending" @click="onSave" />
    </div>
  </div>
</template>
