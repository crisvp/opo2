<script setup lang="ts">
import { computed, ref } from "vue";
import { useTribeList } from "../../api/queries/locations";
import { useBreadcrumb } from "../../composables/useBreadcrumb";

const { set: setBreadcrumbs } = useBreadcrumb();
setBreadcrumbs([{ label: "Locations" }]);

const { data: tribes, isLoading, isError } = useTribeList();

const filter = ref("");

const filteredTribes = computed(() => {
  if (!tribes.value) return [];
  const q = filter.value.trim().toLowerCase();
  if (!q) return tribes.value;
  return tribes.value.filter((t) => t.name.toLowerCase().includes(q));
});
</script>

<template>
  <div>
    <div v-if="isLoading" class="text-muted">Loading tribal nations…</div>
    <div v-else-if="isError" class="text-critical">Failed to load tribal nations.</div>
    <template v-else>
      <input
        v-model="filter"
        type="search"
        placeholder="Filter tribal nations…"
        class="w-full max-w-sm mb-4 px-3 py-2 rounded-lg border border-default bg-surface text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <p v-if="filter && !filteredTribes.length" class="text-muted text-sm">No tribal nations match "{{ filter }}".</p>
      <ul v-else class="divide-y divide-default">
        <li v-for="tribe in filteredTribes" :key="tribe.id">
          <RouterLink
            :to="`/locations/tribes/${tribe.id}`"
            class="flex items-center py-3 px-2 hover:bg-sunken rounded transition-colors"
          >
            <span class="font-medium text-primary">{{ tribe.name }}</span>
            <span v-if="tribe.isAlaskaNative" class="ml-2 text-xs text-muted">(Alaska Native)</span>
          </RouterLink>
        </li>
      </ul>
    </template>
  </div>
</template>
