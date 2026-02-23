<script setup lang="ts">
import { computed } from "vue";
import DocumentCard from "../components/documents/DocumentCard.vue";
import SearchInput from "../components/shared/SearchInput.vue";
import EmptyState from "../components/shared/EmptyState.vue";
import Select from "primevue/select";
import Button from "primevue/button";
import Paginator from "primevue/paginator";
import { useBrowseFiltersStore } from "../stores/browse-filters";
import { useDocumentList } from "../api/queries/documents";
import type { DocumentListItem } from "@opo/shared";

const filtersStore = useBrowseFiltersStore();

const filters = computed(() => ({
  search: filtersStore.search || undefined,
  governmentLevel: filtersStore.governmentLevel || undefined,
  stateUsps: filtersStore.stateUsps || undefined,
  category: filtersStore.categoryId || undefined,
  page: filtersStore.page,
  pageSize: filtersStore.pageSize,
}));

const { data, isLoading, isError } = useDocumentList(filters);

const items = computed<DocumentListItem[]>(() => data.value?.items ?? []);
const total = computed(() => data.value?.total ?? 0);

function onPageChange(event: { page: number; rows: number }) {
  filtersStore.page = event.page + 1; // Paginator is 0-indexed; store is 1-indexed
  filtersStore.pageSize = event.rows;
}
</script>

<template>
  <div class="max-w-5xl mx-auto p-8">
    <h1 class="text-2xl font-semibold text-primary mb-6">Browse Documents</h1>

    <!-- Filters -->
    <div class="flex flex-wrap gap-4 mb-6">
      <div class="flex-1 min-w-48">
        <SearchInput
          v-model="filtersStore.search"
          placeholder="Search documents…"
        />
      </div>

      <Select
        v-model="filtersStore.governmentLevel"
        :options="[
          { label: 'Federal', value: 'federal' },
          { label: 'State', value: 'state' },
          { label: 'Place', value: 'place' },
          { label: 'Tribal', value: 'tribal' },
        ]"
        option-label="label"
        option-value="value"
        placeholder="All levels"
        show-clear
      />

      <Select
        v-model="filtersStore.stateUsps"
        :options="[
          { label: 'Alabama', value: 'AL' }, { label: 'Alaska', value: 'AK' },
          { label: 'Arizona', value: 'AZ' }, { label: 'Arkansas', value: 'AR' },
          { label: 'California', value: 'CA' }, { label: 'Colorado', value: 'CO' },
          { label: 'Connecticut', value: 'CT' }, { label: 'Delaware', value: 'DE' },
          { label: 'Florida', value: 'FL' }, { label: 'Georgia', value: 'GA' },
          { label: 'Hawaii', value: 'HI' }, { label: 'Idaho', value: 'ID' },
          { label: 'Illinois', value: 'IL' }, { label: 'Indiana', value: 'IN' },
          { label: 'Iowa', value: 'IA' }, { label: 'Kansas', value: 'KS' },
          { label: 'Kentucky', value: 'KY' }, { label: 'Louisiana', value: 'LA' },
          { label: 'Maine', value: 'ME' }, { label: 'Maryland', value: 'MD' },
          { label: 'Massachusetts', value: 'MA' }, { label: 'Michigan', value: 'MI' },
          { label: 'Minnesota', value: 'MN' }, { label: 'Mississippi', value: 'MS' },
          { label: 'Missouri', value: 'MO' }, { label: 'Montana', value: 'MT' },
          { label: 'Nebraska', value: 'NE' }, { label: 'Nevada', value: 'NV' },
          { label: 'New Hampshire', value: 'NH' }, { label: 'New Jersey', value: 'NJ' },
          { label: 'New Mexico', value: 'NM' }, { label: 'New York', value: 'NY' },
          { label: 'North Carolina', value: 'NC' }, { label: 'North Dakota', value: 'ND' },
          { label: 'Ohio', value: 'OH' }, { label: 'Oklahoma', value: 'OK' },
          { label: 'Oregon', value: 'OR' }, { label: 'Pennsylvania', value: 'PA' },
          { label: 'Rhode Island', value: 'RI' }, { label: 'South Carolina', value: 'SC' },
          { label: 'South Dakota', value: 'SD' }, { label: 'Tennessee', value: 'TN' },
          { label: 'Texas', value: 'TX' }, { label: 'Utah', value: 'UT' },
          { label: 'Vermont', value: 'VT' }, { label: 'Virginia', value: 'VA' },
          { label: 'Washington', value: 'WA' }, { label: 'West Virginia', value: 'WV' },
          { label: 'Wisconsin', value: 'WI' }, { label: 'Wyoming', value: 'WY' },
        ]"
        option-label="label"
        option-value="value"
        placeholder="All states"
        show-clear
        filter
      />

      <Button
        v-if="filtersStore.search || filtersStore.governmentLevel || filtersStore.stateUsps"
        label="Clear filters"
        severity="secondary"
        @click="filtersStore.reset()"
      />
    </div>

    <!-- Results count -->
    <p class="text-sm text-muted mb-4">
      {{ total }} document{{ total !== 1 ? "s" : "" }} found
    </p>

    <!-- Loading -->
    <div v-if="isLoading" class="text-center py-12 text-muted">Loading…</div>

    <!-- Error -->
    <div v-else-if="isError" class="text-center py-12 text-critical">
      Failed to load documents.
    </div>

    <!-- Empty -->
    <EmptyState
      v-else-if="items.length === 0"
      icon="pi-search"
      title="No documents found"
      description="Try adjusting your search filters."
    />

    <!-- Document list -->
    <div v-else class="space-y-4">
      <DocumentCard v-for="doc in items" :key="doc.id" :document="doc" />
    </div>

    <!-- Pagination -->
    <Paginator
      v-if="total > filtersStore.pageSize"
      :rows="filtersStore.pageSize"
      :total-records="total"
      :first="(filtersStore.page - 1) * filtersStore.pageSize"
      class="mt-8"
      @page="onPageChange"
    />
  </div>
</template>
