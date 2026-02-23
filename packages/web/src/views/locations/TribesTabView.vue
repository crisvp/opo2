<script setup lang="ts">
import { useTribeList } from "../../api/queries/locations";

const { data: tribes, isLoading, isError } = useTribeList();
</script>

<template>
  <div>
    <div v-if="isLoading" class="text-muted">Loading tribal nations…</div>
    <div v-else-if="isError" class="text-critical">Failed to load tribal nations.</div>
    <div v-else class="space-y-4">
      <ul class="divide-y divide-default">
        <li v-for="tribe in tribes" :key="tribe.id">
          <RouterLink
            :to="`/locations/tribes/${tribe.id}`"
            class="flex items-center py-3 px-2 hover:bg-sunken rounded transition-colors"
          >
            <span class="font-medium text-primary">{{ tribe.name }}</span>
            <span v-if="tribe.isAlaskaNative" class="ml-2 text-xs text-muted">(Alaska Native)</span>
          </RouterLink>
        </li>
      </ul>
    </div>
  </div>
</template>
