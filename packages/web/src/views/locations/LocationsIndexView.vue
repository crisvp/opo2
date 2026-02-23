<script setup lang="ts">
import { useStateList } from "../../api/queries/locations";

const { data: states, isLoading, isError } = useStateList();
</script>

<template>
  <div class="p-8">
    <h1 class="text-2xl font-semibold text-primary mb-6">Locations</h1>

    <div v-if="isLoading" class="text-muted">Loading states…</div>
    <div v-else-if="isError" class="text-critical">Failed to load states.</div>
    <div
      v-else
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3"
    >
      <RouterLink
        v-for="state in states"
        :key="state.usps"
        :to="`/locations/states/${state.usps}`"
        class="block rounded-lg border border-default p-3 hover:bg-sunken transition-colors text-sm font-medium text-primary"
      >
        <div class="font-bold text-lg">{{ state.usps }}</div>
        <div class="text-muted text-xs">{{ state.name }}</div>
      </RouterLink>
    </div>
  </div>
</template>
