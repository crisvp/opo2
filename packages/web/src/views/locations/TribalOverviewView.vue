<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import { useRoute } from "vue-router";
import { useLocationOverview, useTribeDetail } from "../../api/queries/locations";
import { useBreadcrumb } from "../../composables/useBreadcrumb";

const route = useRoute();
const tribeId = computed(() => route.params.tribeId as string);

const level = ref("tribal");
const stateRef = ref<string | null>(null);
const placeRef = ref<string | null>(null);

const { data: overview, isLoading, isError } = useLocationOverview(level, stateRef, placeRef);
const { data: tribe } = useTribeDetail(tribeId);

const { set: setBreadcrumbs } = useBreadcrumb();
watchEffect(() => {
  setBreadcrumbs([
    { label: "Locations", to: "/locations" },
    { label: "Tribal Nations", to: "/locations/tribes" },
    { label: tribe.value?.name ?? tribeId.value },
  ]);
});
</script>

<template>
  <div class="p-8">
    <h1 class="text-2xl font-semibold text-primary mb-2">Tribal Overview</h1>
    <p v-if="tribeId" class="text-muted mb-6">Tribe ID: {{ tribeId }}</p>

    <div v-if="isLoading" class="text-muted">Loading overview…</div>
    <div v-else-if="isError" class="text-critical">Failed to load overview.</div>
    <div v-else-if="overview" class="space-y-6">
      <!-- Document count -->
      <div class="rounded-lg border border-default p-4">
        <div class="text-sm text-muted mb-1">Total Documents</div>
        <div class="text-3xl font-bold text-primary">{{ overview.documentCount }}</div>
      </div>

      <!-- Vendors -->
      <div v-if="overview.vendors.length > 0" class="rounded-lg border border-default p-4">
        <h2 class="text-lg font-semibold text-primary mb-3">Vendors</h2>
        <ul class="space-y-1">
          <li
            v-for="vendor in overview.vendors"
            :key="vendor.id"
            class="flex justify-between text-sm"
          >
            <span class="text-primary">{{ vendor.name }}</span>
            <span class="text-muted">{{ vendor.documentCount }} docs</span>
          </li>
        </ul>
      </div>

      <!-- Technologies -->
      <div v-if="overview.technologies.length > 0" class="rounded-lg border border-default p-4">
        <h2 class="text-lg font-semibold text-primary mb-3">Technologies</h2>
        <ul class="space-y-1">
          <li
            v-for="tech in overview.technologies"
            :key="tech.id"
            class="flex justify-between text-sm"
          >
            <span class="text-primary">{{ tech.name }}</span>
            <span class="text-muted">{{ tech.documentCount }} docs</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
