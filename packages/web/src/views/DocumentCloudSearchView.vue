<script setup lang="ts">
import { ref, computed } from "vue";
import { useAuthStore } from "../stores/auth";
import {
  useDocumentCloudStatus,
  useDocumentCloudSearch,
  useImportBatch,
  useImportJobs,
} from "../api/queries/documentcloud";
import DocumentCloudResultCard from "../components/documents/DocumentCloudResultCard.vue";
import ImportJobStatus from "../components/documents/ImportJobStatus.vue";
import type { DocumentCloudDocument } from "@opo/shared";

const auth = useAuthStore();

const canImport = computed(() => auth.hasRole("moderator"));

// Status
const { data: statusData } = useDocumentCloudStatus();
const dcAvailable = computed(() => statusData.value?.available ?? true);

// Search form state
const qInput = ref("");
const orgInput = ref("");
const submittedQuery = ref<Record<string, string | number | boolean | null | undefined> | null>(null);
const currentPage = ref(1);

const searchQuery = computed<Record<string, string | number | boolean | null | undefined>>(() => {
  if (!submittedQuery.value) return {};
  return {
    ...submittedQuery.value,
    page: currentPage.value,
  };
});

const { data: searchData, isLoading: searching, isError: searchError } = useDocumentCloudSearch(searchQuery);

function submitSearch() {
  currentPage.value = 1;
  submittedQuery.value = {
    q: qInput.value,
    ...(orgInput.value ? { organization: orgInput.value } : {}),
  };
}

function prevPage() {
  if (currentPage.value > 1) currentPage.value--;
}

function nextPage() {
  if (searchData.value && currentPage.value * (searchData.value.perPage) < searchData.value.count) {
    currentPage.value++;
  }
}

// Batch import
const selectedIds = ref<Set<number>>(new Set());

function toggleSelect(id: number) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id);
  } else {
    selectedIds.value.add(id);
  }
}

const { mutate: importBatch, isPending: importingBatch } = useImportBatch();

function importSelected() {
  const ids = Array.from(selectedIds.value);
  if (!ids.length) return;
  importBatch(
    { documentCloudIds: ids },
    {
      onSuccess: () => {
        selectedIds.value = new Set();
      },
    },
  );
}

// Single import
const { data: jobsData } = useImportJobs();
const activeJobs = computed(() => (jobsData.value ?? []).filter((j) => j.status === "pending" || j.status === "processing"));

function handleImport(doc: DocumentCloudDocument) {
  importBatch(
    { documentCloudIds: [doc.id] },
    {
      onSuccess: () => {
        selectedIds.value.delete(doc.id);
      },
    },
  );
}
</script>

<template>
  <div class="p-8 max-w-4xl mx-auto space-y-6">
    <h1 class="text-2xl font-semibold text-primary">DocumentCloud Search</h1>

    <!-- Status warning -->
    <div
      v-if="!dcAvailable"
      class="rounded-lg border border-default bg-warning-subtle px-4 py-3 text-sm text-warning"
      role="alert"
      data-testid="dc-unavailable-banner"
    >
      DocumentCloud is currently unavailable. Search may not work.
    </div>

    <!-- Search form -->
    <form class="flex flex-col gap-3 sm:flex-row sm:items-end" @submit.prevent="submitSearch">
      <div class="flex-1">
        <label class="block text-sm font-medium text-primary mb-1" for="dc-query">Search</label>
        <input
          id="dc-query"
          v-model="qInput"
          type="text"
          placeholder="Search documents…"
          class="w-full rounded border border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-focus"
          data-testid="search-input"
        />
      </div>
      <div class="w-48">
        <label class="block text-sm font-medium text-primary mb-1" for="dc-org">Organization</label>
        <input
          id="dc-org"
          v-model="orgInput"
          type="text"
          placeholder="Optional"
          class="w-full rounded border border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-focus"
          data-testid="org-input"
        />
      </div>
      <button
        type="submit"
        class="shrink-0 px-4 py-2 rounded bg-interactive text-inverted text-sm font-medium hover:bg-primary/90"
        data-testid="search-submit"
      >
        Search
      </button>
    </form>

    <!-- Active import jobs -->
    <div v-if="activeJobs.length > 0" class="space-y-2">
      <h2 class="text-sm font-medium text-primary">Active Imports</h2>
      <ImportJobStatus v-for="job in activeJobs" :key="job.id" :job-id="job.id" />
    </div>

    <!-- Results area -->
    <div v-if="submittedQuery">
      <!-- Loading -->
      <div v-if="searching" class="flex justify-center py-12" data-testid="search-loading">
        <svg class="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>

      <!-- Error -->
      <div v-else-if="searchError" class="rounded-lg border border-critical bg-critical-subtle px-4 py-3 text-sm text-critical" data-testid="search-error">
        Search failed — try again.
      </div>

      <!-- Empty -->
      <div v-else-if="searchData && searchData.results.length === 0" class="py-12 text-center text-muted text-sm" data-testid="empty-results">
        No results found.
      </div>

      <!-- Result list -->
      <template v-else-if="searchData">
        <div class="space-y-3">
          <div v-for="result in searchData.results" :key="result.id" class="flex gap-3 items-start">
            <input
              v-if="canImport && !result.alreadyImported"
              type="checkbox"
              :checked="selectedIds.has(result.id)"
              class="mt-1 shrink-0"
              :aria-label="`Select ${result.title}`"
              @change="toggleSelect(result.id)"
            />
            <div v-else-if="canImport" class="w-4 shrink-0" />
            <DocumentCloudResultCard
              class="flex-1"
              :result="result"
              :loading="importingBatch"
              @import="handleImport(result)"
            />
          </div>
        </div>

        <!-- Batch import button -->
        <div v-if="canImport && selectedIds.size > 0" class="mt-4 flex justify-end">
          <button
            class="px-4 py-2 rounded bg-interactive text-inverted text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            :disabled="importingBatch"
            data-testid="import-selected-button"
            @click="importSelected"
          >
            Import Selected ({{ selectedIds.size }})
          </button>
        </div>

        <!-- Pagination -->
        <div class="mt-4 flex items-center justify-between text-sm text-muted">
          <button
            class="px-3 py-1 rounded border border-default hover:bg-sunken disabled:opacity-40"
            :disabled="currentPage <= 1"
            data-testid="prev-page"
            @click="prevPage"
          >
            Previous
          </button>
          <span>Page {{ currentPage }}</span>
          <button
            class="px-3 py-1 rounded border border-default hover:bg-sunken disabled:opacity-40"
            :disabled="currentPage * searchData.perPage >= searchData.count"
            data-testid="next-page"
            @click="nextPage"
          >
            Next
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
