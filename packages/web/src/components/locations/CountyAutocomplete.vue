<script setup lang="ts">
import { ref, computed } from "vue";
import AutoComplete from "primevue/autocomplete";
import type { Place } from "@opo/shared";
import { useCountyList } from "../../api/queries/locations";

const props = defineProps<{
  stateUsps: string;
  placeholder?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  select: [county: Place];
  clear: [];
}>();

const stateUspsRef = computed(() => props.stateUsps);
const { data: counties } = useCountyList(stateUspsRef);
const suggestions = ref<Place[]>([]);
const selected = ref<Place | null>(null);

function displayName(c: Place) {
  return c.lsad ? `${c.name} ${c.lsad}, ${c.usps}` : `${c.name}, ${c.usps}`;
}

function search(event: { query: string }) {
  const q = event.query.toLowerCase();
  suggestions.value = (counties.value ?? []).filter((c) =>
    c.name.toLowerCase().includes(q),
  );
}

function onSelect(event: { value: Place }) {
  emit("select", event.value);
}

function onClear() {
  selected.value = null;
  emit("clear");
}
</script>

<template>
  <AutoComplete
    v-model="selected"
    :suggestions="suggestions"
    :option-label="displayName"
    :placeholder="placeholder ?? 'Search counties…'"
    :disabled="disabled"
    force-selection
    @complete="search"
    @option-select="onSelect"
    @clear="onClear"
  />
</template>
