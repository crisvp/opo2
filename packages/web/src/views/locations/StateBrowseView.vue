<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import { useRoute } from "vue-router";
import { usePlaceList, useStateDetail } from "../../api/queries/locations";
import { useBreadcrumb } from "../../composables/useBreadcrumb";

const route = useRoute();
const usps = computed(() => route.params.usps as string);
const { data: state } = useStateDetail(usps);
const { data: places, isLoading, isError } = usePlaceList(usps);

const { set: setBreadcrumbs } = useBreadcrumb();
watchEffect(() => {
  setBreadcrumbs([
    { label: "Locations", to: "/locations" },
    { label: "States", to: "/locations/states" },
    { label: state.value?.name ?? usps.value },
  ]);
});

const filter = ref("");

const filteredPlaces = computed(() => {
  if (!places.value) return [];
  const q = filter.value.trim().toLowerCase();
  if (!q) return places.value;
  return places.value.filter((p) => p.name.toLowerCase().includes(q));
});
</script>

<template>
  <div class="p-8">
    <h1 class="text-2xl font-semibold text-primary mb-2">
      {{ state?.name ?? usps }}
    </h1>
    <p class="text-muted mb-6">Browse places in this state.</p>

    <div v-if="isLoading" class="text-muted">Loading places…</div>
    <div v-else-if="isError" class="text-critical">Failed to load places.</div>
    <div v-else-if="!places?.length" class="text-muted">No places found.</div>
    <template v-else>
      <input
        v-model="filter"
        type="search"
        placeholder="Filter places…"
        class="w-full max-w-sm mb-4 px-3 py-2 rounded-lg border border-default bg-surface text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <p v-if="filter && !filteredPlaces.length" class="text-muted text-sm">No places match "{{ filter }}".</p>
      <ul v-else class="divide-y divide-default">
        <li v-for="place in filteredPlaces" :key="place.geoid">
          <RouterLink
            :to="`/locations/places/${place.geoid}`"
            class="flex items-center py-3 hover:bg-sunken px-2 rounded transition-colors"
          >
            <span class="font-medium text-primary">{{ place.name }}</span>
          </RouterLink>
        </li>
      </ul>
    </template>
  </div>
</template>
