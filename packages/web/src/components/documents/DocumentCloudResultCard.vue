<script setup lang="ts">
import type { DocumentCloudDocument } from "@opo/shared";

defineProps<{
  result: DocumentCloudDocument;
  loading?: boolean;
}>();

const emit = defineEmits<{
  import: [];
}>();

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}
</script>

<template>
  <div
    class="bg-elevated border border-default rounded-lg p-4"
    data-testid="dc-result-card"
  >
    <div class="flex items-start justify-between gap-2">
      <h3 class="text-base font-semibold text-primary line-clamp-2">
        <a
          :href="result.canonicalUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:underline"
        >
          {{ result.title }}
        </a>
      </h3>
      <span
        v-if="result.alreadyImported"
        class="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-success-subtle text-success"
        data-testid="already-imported-badge"
      >
        Already Imported
      </span>
    </div>

    <p v-if="result.description" class="mt-1 text-sm text-muted line-clamp-2">
      {{ result.description }}
    </p>

    <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
      <span v-if="result.organization">{{ result.organization.name }}</span>
      <span>{{ result.pages }} pages</span>
      <span>{{ formatDate(result.createdAt) }}</span>
    </div>

    <div class="mt-3 flex justify-end">
      <button
        v-if="!result.alreadyImported"
        class="text-sm font-medium px-3 py-1.5 rounded bg-interactive text-inverted hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="loading"
        data-testid="import-button"
        @click="emit('import')"
      >
        Import
      </button>
    </div>
  </div>
</template>
