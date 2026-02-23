<script setup lang="ts">
import { ref } from "vue";
import AutoComplete from "primevue/autocomplete";
import type { Tribe } from "@opo/shared";
import { useTribeList } from "../../api/queries/locations";

defineProps<{
  placeholder?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  select: [tribe: Tribe];
  clear: [];
}>();

const { data: tribes } = useTribeList();
const suggestions = ref<Tribe[]>([]);
const selected = ref<Tribe | null>(null);

function search(event: { query: string }) {
  const q = event.query.toLowerCase();
  suggestions.value = (tribes.value ?? []).filter((t) =>
    t.name.toLowerCase().includes(q),
  );
}

function onSelect(event: { value: Tribe }) {
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
    option-label="name"
    :placeholder="placeholder ?? 'Search tribes…'"
    :disabled="disabled"
    force-selection
    @complete="search"
    @option-select="onSelect"
    @clear="onClear"
  />
</template>
