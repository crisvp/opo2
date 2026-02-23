<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { usePlaceList, useStateDetail } from "../../api/queries/locations";

const route = useRoute();
const usps = computed(() => route.params.usps as string);
const { data: state } = useStateDetail(usps);
const { data: places, isLoading, isError } = usePlaceList(usps);
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
    <ul v-else class="divide-y divide-default">
      <li v-for="place in places" :key="place.geoid">
        <RouterLink
          :to="`/locations/places/${place.geoid}`"
          class="flex items-center py-3 hover:bg-sunken px-2 rounded transition-colors"
        >
          <span class="font-medium text-primary">{{ place.name }}</span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
