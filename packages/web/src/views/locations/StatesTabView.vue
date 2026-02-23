<script setup lang="ts">
import { computed } from "vue";
import Panel from "primevue/panel";
import { useStateList } from "../../api/queries/locations";
import UsaStateMap from "../../components/locations/UsaStateMap.vue";
import { useRouter } from "vue-router";
import { useBreadcrumb } from "../../composables/useBreadcrumb";

const { set: setBreadcrumbs } = useBreadcrumb();
setBreadcrumbs([{ label: "Locations" }]);

const { data: states, isLoading, isError } = useStateList();
const router = useRouter();

const mainStates = computed(() => states.value?.filter((s) => !s.isTerritory) ?? []);
const territories = computed(() => states.value?.filter((s) => s.isTerritory) ?? []);

const totalStateDocs = computed(() =>
  mainStates.value.reduce((sum, s) => sum + s.documentCount, 0)
);
const totalTerritoryDocs = computed(() =>
  territories.value.reduce((sum, s) => sum + s.documentCount, 0)
);

function onMapSelect(usps: string) {
  router.push(`/locations/states/${usps}`);
}
</script>

<template>
  <div v-if="isLoading" class="text-muted">Loading states…</div>
  <div v-else-if="isError" class="text-critical">Failed to load states.</div>
  <div v-else class="space-y-6">
    <!-- SVG Map -->
    <UsaStateMap
      v-if="mainStates.length"
      :states="mainStates"
      @select="onMapSelect"
    />

    <!-- States list (collapsed by default) -->
    <Panel :collapsed="true" toggleable>
      <template #header>
        <span class="font-medium text-primary">
          States
          <span class="text-muted font-normal text-sm ml-2">{{ totalStateDocs.toLocaleString() }} documents</span>
        </span>
      </template>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
        <RouterLink
          v-for="state in mainStates"
          :key="state.usps"
          :to="`/locations/states/${state.usps}`"
          class="block rounded-lg border border-default p-3 hover:bg-sunken transition-colors text-sm font-medium text-primary"
        >
          <div class="font-bold text-lg">{{ state.usps }}</div>
          <div class="text-muted text-xs">{{ state.name }}</div>
          <div class="text-muted text-xs mt-1">{{ state.documentCount }} docs</div>
        </RouterLink>
      </div>
    </Panel>

    <!-- Territories (collapsed by default) -->
    <Panel :collapsed="true" toggleable>
      <template #header>
        <span class="font-medium text-primary">
          US Territories
          <span class="text-muted font-normal text-sm ml-2">{{ totalTerritoryDocs.toLocaleString() }} documents</span>
        </span>
      </template>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
        <RouterLink
          v-for="territory in territories"
          :key="territory.usps"
          :to="`/locations/states/${territory.usps}`"
          class="block rounded-lg border border-default p-3 hover:bg-sunken transition-colors text-sm font-medium text-primary"
        >
          <div class="font-bold text-lg">{{ territory.usps }}</div>
          <div class="text-muted text-xs">{{ territory.name }}</div>
          <div class="text-muted text-xs mt-1">{{ territory.documentCount }} docs</div>
        </RouterLink>
      </div>
    </Panel>
  </div>
</template>
