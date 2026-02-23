<script setup lang="ts">
import { ref, computed } from "vue";
import AutoComplete from "primevue/autocomplete";
import type { Place } from "@opo/shared";
import { formatPlaceDisplayName } from "@opo/shared";
import { usePlaceList } from "../../api/queries/locations";

const props = defineProps<{
  stateUsps: string;
  placeholder?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  select: [place: Place];
  clear: [];
}>();

const stateUspsRef = computed(() => props.stateUsps);
const { data: places } = usePlaceList(stateUspsRef);
const suggestions = ref<Place[]>([]);
const selected = ref<Place | null>(null);

function search(event: { query: string }) {
  const q = event.query.toLowerCase();
  suggestions.value = (places.value ?? []).filter((p) =>
    p.name.toLowerCase().includes(q),
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
    :option-label="(p: Place) => formatPlaceDisplayName(p)"
    :placeholder="placeholder ?? 'Search places…'"
    :disabled="disabled"
    force-selection
    @complete="search"
    @option-select="onSelect"
    @clear="onClear"
  />
</template>
