<script setup lang="ts">
import { ref, computed } from "vue";
import { useDocumentCloudSearch } from "../../api/queries/documentcloud";

interface DcSelection {
  documentCloudId: number;
  title: string;
}

const emit = defineEmits<{
  selected: [value: DcSelection];
}>();

const qInput = ref("");
const orgInput = ref("");
const submittedQuery = ref<Record<string, string | number | boolean | null | undefined> | null>(null);
const currentPage = ref(1);
const selectedId = ref<number | null>(null);

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
  if (searchData.value && currentPage.value * searchData.value.perPage < searchData.value.count) {
    currentPage.value++;
  }
}

function selectResult(id: number, title: string) {
  selectedId.value = id;
  emit("selected", { documentCloudId: id, title });
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Search form -->
    <form class="flex flex-col gap-3 sm:flex-row sm:items-end" @submit.prevent="submitSearch">
      <div class="flex-1">
        <label class="block text-sm font-medium text-primary mb-1" for="dc-panel-query">Search</label>
        <input
          id="dc-panel-query"
          v-model="qInput"
          type="text"
          placeholder="Search documents…"
          class="w-full rounded border border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-focus"
        />
      </div>
      <div class="w-40">
        <label class="block text-sm font-medium text-primary mb-1" for="dc-panel-org">Organization</label>
        <input
          id="dc-panel-org"
          v-model="orgInput"
          type="text"
          placeholder="Optional"
          class="w-full rounded border border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-focus"
        />
      </div>
      <button
        type="submit"
        class="shrink-0 px-4 py-2 rounded bg-interactive text-inverted text-sm font-medium hover:bg-primary/90"
      >
        Search
      </button>
    </form>

    <!-- Results area -->
    <div v-if="submittedQuery">
      <!-- Loading -->
      <div v-if="searching" class="flex justify-center py-8">
        <svg class="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>

      <!-- Error -->
      <div
        v-else-if="searchError"
        class="rounded-lg border border-critical bg-critical-subtle px-4 py-3 text-sm text-critical"
      >
        Search failed — try again.
      </div>

      <!-- Empty -->
      <div
        v-else-if="searchData && searchData.results.length === 0"
        class="py-8 text-center text-muted text-sm"
      >
        No results found.
      </div>

      <!-- Result list -->
      <template v-else-if="searchData">
        <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
          <div
            v-for="result in searchData.results"
            :key="result.id"
            class="rounded-lg border px-4 py-3 text-sm transition-colors"
            :class="
              result.alreadyImported
                ? 'border-default bg-sunken opacity-60 cursor-not-allowed'
                : selectedId === result.id
                  ? 'border-interactive bg-interactive/10 cursor-pointer'
                  : 'border-default bg-elevated cursor-pointer hover:border-interactive'
            "
            @click="!result.alreadyImported && selectResult(result.id, result.title)"
          >
            <div class="flex items-start justify-between gap-2">
              <p class="font-medium text-primary line-clamp-2">{{ result.title }}</p>
              <span
                v-if="result.alreadyImported"
                class="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-success-subtle text-success"
              >
                Already Imported
              </span>
              <span
                v-else-if="selectedId === result.id"
                class="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-interactive text-inverted"
              >
                Selected
              </span>
            </div>
            <div class="mt-1 flex flex-wrap gap-2 text-xs text-muted">
              <span v-if="result.organization">{{ result.organization.name }}</span>
              <span>{{ result.pages }} pages</span>
              <span>{{ formatDate(result.createdAt) }}</span>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div class="mt-3 flex items-center justify-between text-sm text-muted">
          <button
            class="px-3 py-1 rounded border border-default hover:bg-sunken disabled:opacity-40"
            :disabled="currentPage <= 1"
            @click="prevPage"
          >
            Previous
          </button>
          <span>Page {{ currentPage }}</span>
          <button
            class="px-3 py-1 rounded border border-default hover:bg-sunken disabled:opacity-40"
            :disabled="currentPage * searchData.perPage >= searchData.count"
            @click="nextPage"
          >
            Next
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
