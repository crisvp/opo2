<script setup lang="ts">
import type { DocumentListItem } from "@opo/shared";

defineProps<{
  document: DocumentListItem;
}>();

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
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
</script>

<template>
  <RouterLink
    :to="`/documents/${document.id}`"
    class="block bg-elevated border border-default rounded-lg p-4 hover:shadow-sm transition-shadow"
    data-testid="document-card"
  >
    <div class="flex items-start justify-between gap-2">
      <h3 class="text-base font-semibold text-primary line-clamp-2">
        {{ document.title }}
      </h3>
      <span
        class="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full"
        :class="stateBadgeClass(document.state)"
        data-testid="state-badge"
      >
        {{ document.state.replace(/_/g, " ") }}
      </span>
    </div>

    <p v-if="document.description" class="mt-1 text-sm text-muted line-clamp-2">
      {{ document.description }}
    </p>

    <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
      <span v-if="document.categoryName">{{ document.categoryName }}</span>
      <span v-if="document.stateName">{{ document.stateName }}</span>
      <span v-if="document.placeName">{{ document.placeName }}</span>
      <span v-if="document.documentDate">{{ formatDate(document.documentDate) }}</span>
      <span class="ml-auto">{{ formatDate(document.createdAt) }}</span>
    </div>

    <div v-if="document.tags && document.tags.length > 0" class="mt-2 flex flex-wrap gap-1">
      <span
        v-for="tag in document.tags.slice(0, 5)"
        :key="tag"
        class="text-xs px-2 py-0.5 bg-sunken rounded"
        data-testid="document-tag"
      >
        {{ tag }}
      </span>
      <span v-if="document.tags.length > 5" class="text-xs text-muted">
        +{{ document.tags.length - 5 }}
      </span>
    </div>
  </RouterLink>
</template>
