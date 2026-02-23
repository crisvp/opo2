<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { useMyUploads, useSubmitDraft } from "../api/queries/documents";
import type { DocumentListItem } from "@opo/shared";

const { data, isLoading, isError } = useMyUploads();
const submitDraft = useSubmitDraft();

const items = computed<DocumentListItem[]>(() => data.value?.items ?? []);

// Group by state
const grouped = computed(() => {
  const map = new Map<string, DocumentListItem[]>();
  for (const doc of items.value) {
    if (!map.has(doc.state)) map.set(doc.state, []);
    map.get(doc.state)!.push(doc);
  }
  return map;
});

const stateOrder = [
  "draft",
  "submitted",
  "processing",
  "user_review",
  "moderator_review",
  "processing_failed",
  "rejected",
  "approved",
];

const groupedEntries = computed(() => {
  return stateOrder
    .filter((s) => grouped.value.has(s))
    .map((s) => [s, grouped.value.get(s)!] as [string, DocumentListItem[]]);
});

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

function stateBadgeClass(state: string): string {
  const map: Record<string, string> = {
    approved: "bg-success-subtle text-success",
    submitted: "bg-info-subtle text-info",
    processing: "bg-warning-subtle text-warning",
    draft: "bg-surface-subtle text-secondary",
    moderator_review: "bg-accent-subtle text-accent",
    user_review: "bg-warning-subtle text-warning",
    rejected: "bg-critical-subtle text-critical",
    processing_failed: "bg-critical-subtle text-critical",
  };
  return map[state] ?? "bg-surface-subtle text-muted";
}

async function handleSubmit(id: string) {
  await submitDraft.mutateAsync(id);
}
</script>

<template>
  <div class="max-w-4xl mx-auto p-8">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold text-primary">My Uploads</h1>
      <RouterLink
        to="/upload"
        class="px-4 py-2 bg-interactive text-inverted rounded-lg text-sm"
      >
        Upload New
      </RouterLink>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="text-center py-12 text-muted">Loading…</div>

    <!-- Error -->
    <div v-else-if="isError" class="text-center py-12 text-critical">
      Failed to load uploads.
    </div>

    <!-- Empty -->
    <div v-else-if="items.length === 0" class="text-center py-12 text-muted">
      No uploads yet.
    </div>

    <!-- Grouped list -->
    <div v-else class="space-y-8">
      <div v-for="[state, docs] in groupedEntries" :key="state">
        <h2 class="text-base font-semibold text-secondary mb-3 capitalize">
          {{ state.replace(/_/g, " ") }}
          <span class="text-xs text-muted font-normal ml-1">({{ docs.length }})</span>
        </h2>

        <div class="space-y-3">
          <div
            v-for="doc in docs"
            :key="doc.id"
            class="flex items-center gap-4 bg-elevated border border-default rounded-lg p-4"
          >
            <div class="flex-1 min-w-0">
              <RouterLink
                :to="`/documents/${doc.id}`"
                class="text-base font-medium text-primary hover:underline truncate block"
              >
                {{ doc.title }}
              </RouterLink>
              <p class="text-xs text-muted mt-0.5">{{ formatDate(doc.createdAt) }}</p>
              <div v-if="doc.tags && doc.tags.length > 0" class="flex flex-wrap gap-1 mt-1">
                <span
                  v-for="tag in doc.tags.slice(0, 3)"
                  :key="tag"
                  class="text-xs px-1.5 py-0.5 bg-sunken rounded"
                >
                  {{ tag }}
                </span>
              </div>
            </div>

            <span
              class="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full"
              :class="stateBadgeClass(doc.state)"
            >
              {{ doc.state.replace(/_/g, " ") }}
            </span>

            <!-- Actions -->
            <div class="flex items-center gap-2">
              <RouterLink
                v-if="['draft', 'rejected', 'processing_failed'].includes(doc.state)"
                :to="`/documents/${doc.id}/edit`"
                class="text-xs text-primary underline"
              >
                Edit
              </RouterLink>
              <button
                v-if="doc.state === 'draft'"
                type="button"
                class="text-xs px-2 py-1 bg-interactive text-inverted rounded disabled:opacity-50"
                :disabled="submitDraft.isPending.value"
                @click="handleSubmit(doc.id)"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
