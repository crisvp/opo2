<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import { useRoute } from "vue-router";
import { useLocationOverview, usePlaceDetail } from "../../api/queries/locations";
import PolicyStatusCard from "../../components/locations/PolicyStatusCard.vue";
import { useBreadcrumb } from "../../composables/useBreadcrumb";

const route = useRoute();
const level = computed(() => (route.params.level as string) ?? "place");
const state = computed(() => (route.params.state as string) ?? null);
const place = computed(() => (route.params.place as string) ?? null);
const geoid = computed(() => route.params.geoid as string);

const stateRef = ref<string | null>(state.value);
const placeRef = ref<string | null>(place.value);

const { data: overview, isLoading, isError } = useLocationOverview(level, stateRef, placeRef);
const { data: placeDetail } = usePlaceDetail(geoid);

const { set: setBreadcrumbs } = useBreadcrumb();
watchEffect(() => {
  setBreadcrumbs([
    { label: "Locations", to: "/locations" },
    { label: "States", to: "/locations/states" },
    { label: placeDetail.value?.name ?? geoid.value },
  ]);
});
</script>

<template>
  <div class="p-8">
    <h1 class="text-2xl font-semibold text-primary mb-6">Location Overview</h1>

    <div v-if="isLoading" class="text-muted">Loading overview…</div>
    <div v-else-if="isError" class="text-critical">Failed to load overview.</div>
    <div v-else-if="overview" class="space-y-6">
      <!-- Document count -->
      <div class="rounded-lg border border-default p-4">
        <div class="text-sm text-muted mb-1">Total Documents</div>
        <div class="text-3xl font-bold text-primary">{{ overview.documentCount }}</div>
      </div>

      <!-- Policies -->
      <div v-if="overview.policies && overview.policies.length > 0" class="rounded-lg border border-default p-4">
        <h2 class="text-lg font-semibold text-primary mb-3">Policies</h2>
        <div class="space-y-2">
          <PolicyStatusCard
            v-for="policy in overview.policies"
            :key="policy.typeId"
            :policy-type="policy.typeName"
            :has-policy="policy.exists"
            :document-id="policy.documentId"
          />
        </div>
      </div>

      <!-- Documents by category -->
      <div v-if="Object.keys(overview.documentsByCategory).length > 0" class="rounded-lg border border-default p-4">
        <h2 class="text-lg font-semibold text-primary mb-3">By Category</h2>
        <div class="space-y-1">
          <div
            v-for="(count, category) in overview.documentsByCategory"
            :key="category"
            class="flex justify-between text-sm"
          >
            <span class="text-primary">{{ category }}</span>
            <span class="text-muted">{{ count }}</span>
          </div>
        </div>
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

      <!-- State Metadata -->
      <div v-if="overview.stateMetadata.length > 0" class="rounded-lg border border-default p-4">
        <h2 class="text-lg font-semibold text-primary mb-3">State Information</h2>
        <dl class="space-y-2">
          <div v-for="meta in overview.stateMetadata" :key="meta.key">
            <dt class="text-xs text-muted uppercase tracking-wide">{{ meta.key }}</dt>
            <dd class="text-sm text-primary">
              <a v-if="meta.url" :href="meta.url" target="_blank" rel="noopener" class="underline">{{ meta.value }}</a>
              <span v-else>{{ meta.value }}</span>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </div>
</template>
