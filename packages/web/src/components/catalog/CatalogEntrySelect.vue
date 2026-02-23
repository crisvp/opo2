<script setup lang="ts">
import { ref, computed } from "vue";
import AutoComplete from "primevue/autocomplete";
import type { AutoCompleteCompleteEvent } from "primevue/autocomplete";

import { useCatalogSearch } from "../../api/queries/catalog";

interface SearchResult {
  id: string;
  name: string;
  typeId: string;
  typeName: string;
  similarity: number;
}

const props = defineProps<{
  typeId?: string;
  placeholder?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  select: [entry: SearchResult];
  clear: [];
}>();

const searchQuery = ref("");
const selected = ref<SearchResult | null>(null);
const suggestions = ref<SearchResult[]>([]);

const typeIdRef = computed(() => props.typeId);
const { data: searchResults } = useCatalogSearch(searchQuery, typeIdRef);

function handleComplete(event: AutoCompleteCompleteEvent) {
  searchQuery.value = event.query;
  suggestions.value = searchResults.value ?? [];
}

function handleSelect(event: { value: SearchResult }) {
  selected.value = event.value;
  emit("select", event.value);
}

function handleClear() {
  selected.value = null;
  searchQuery.value = "";
  emit("clear");
}
</script>

<template>
  <AutoComplete
    v-model="selected"
    :suggestions="suggestions"
    option-label="name"
    :placeholder="props.placeholder ?? 'Search catalog entries…'"
    :disabled="props.disabled"
    :min-length="2"
    force-selection
    class="w-full"
    @complete="handleComplete"
    @option-select="handleSelect"
    @clear="handleClear"
  >
    <template #option="{ option }">
      <div class="flex flex-col gap-0.5">
        <span class="text-primary font-medium">{{ option.name }}</span>
        <span class="text-muted text-xs">{{ option.typeName }}</span>
      </div>
    </template>
  </AutoComplete>
</template>
