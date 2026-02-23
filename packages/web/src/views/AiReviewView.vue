<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDocumentDetail, useDocumentAiMetadata, useSubmitForModeration, useRetryExtraction } from "../api/queries/documents";

const route = useRoute();
const router = useRouter();
const id = computed(() => route.params.id as string);

const { data: docData, isLoading: docLoading, isError: docError } = useDocumentDetail(id);
const { data: aiData, isLoading: aiLoading, isError: aiError } = useDocumentAiMetadata(id);

const submitForModeration = useSubmitForModeration();
const retryExtraction = useRetryExtraction();

const submitError = ref("");
const retryError = ref("");

const doc = computed(() => docData.value);
const aiResult = computed(() => (aiData.value as { processingResults: Record<string, unknown> | null; metadata: Array<{ key: string; value: string; source: string }> } | null));

const isLoading = computed(() => docLoading.value || aiLoading.value);
const isError = computed(() => docError.value || aiError.value);

const canSubmitForModeration = computed(() => {
  const state = doc.value?.state;
  return state === "user_review" || state === "moderator_review";
});

const canRetryExtraction = computed(() => {
  const state = doc.value?.state;
  return state === "user_review" || state === "processing_failed";
});

async function handleSubmitForModeration() {
  submitError.value = "";
  try {
    await submitForModeration.mutateAsync(id.value);
    await router.push(`/documents/${id.value}`);
  } catch (e) {
    submitError.value = "Failed to submit for moderation.";
  }
}

async function handleRetryExtraction() {
  retryError.value = "";
  try {
    await retryExtraction.mutateAsync(id.value);
    await router.push(`/documents/${id.value}`);
  } catch (e) {
    retryError.value = "Failed to retry extraction.";
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto p-8">
    <!-- Loading -->
    <div v-if="isLoading" class="text-center py-12 text-muted">Loading...</div>

    <!-- Error -->
    <div v-else-if="isError" class="text-center py-12 text-critical">
      Failed to load document.
    </div>

    <template v-else-if="doc">
      <div class="flex items-start justify-between mb-6">
        <div>
          <h1 class="text-2xl font-semibold text-primary">AI Review</h1>
          <p class="text-base text-secondary mt-1">{{ doc.title }}</p>
        </div>
        <span
          class="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-subtle text-accent"
        >
          {{ doc.state.replace(/_/g, " ") }}
        </span>
      </div>

      <!-- Processing Results -->
      <section class="mb-6">
        <h2 class="text-lg font-semibold text-primary mb-3">Processing Results</h2>
        <div
          v-if="aiResult?.processingResults"
          class="bg-sunken rounded-lg p-4 space-y-2"
        >
          <div
            v-for="(value, key) in aiResult.processingResults"
            :key="String(key)"
            class="flex gap-3 text-sm"
          >
            <span class="font-medium text-secondary min-w-40 capitalize">
              {{ String(key).replace(/_/g, " ") }}:
            </span>
            <span class="text-primary">{{ JSON.stringify(value) }}</span>
          </div>
        </div>
        <p v-else class="text-sm text-muted">No processing results available.</p>
      </section>

      <!-- Extracted Metadata -->
      <section class="mb-6">
        <h2 class="text-lg font-semibold text-primary mb-3">Extracted Metadata</h2>
        <div
          v-if="aiResult?.metadata && aiResult.metadata.length > 0"
          class="bg-sunken rounded-lg p-4 space-y-2"
        >
          <div
            v-for="meta in aiResult.metadata"
            :key="meta.key"
            class="flex gap-3 text-sm"
          >
            <span class="font-medium text-secondary min-w-40 capitalize">
              {{ meta.key.replace(/_/g, " ") }}:
            </span>
            <span class="text-primary">{{ meta.value }}</span>
            <span v-if="meta.source" class="text-xs text-muted italic ml-auto">
              via {{ meta.source }}
            </span>
          </div>
        </div>
        <p v-else class="text-sm text-muted">No extracted metadata available.</p>
      </section>

      <!-- Actions -->
      <section class="flex flex-wrap gap-3">
        <button
          v-if="canSubmitForModeration"
          type="button"
          class="px-4 py-2 bg-interactive text-inverted rounded-lg text-sm disabled:opacity-50"
          :disabled="submitForModeration.isPending.value"
          data-testid="submit-for-moderation-button"
          @click="handleSubmitForModeration"
        >
          Submit for Moderation
        </button>
        <p v-if="submitError" class="text-sm text-critical">{{ submitError }}</p>

        <button
          v-if="canRetryExtraction"
          type="button"
          class="px-4 py-2 border border-default rounded-lg text-sm disabled:opacity-50"
          :disabled="retryExtraction.isPending.value"
          data-testid="retry-extraction-button"
          @click="handleRetryExtraction"
        >
          Retry Extraction
        </button>
        <p v-if="retryError" class="text-sm text-critical">{{ retryError }}</p>
      </section>
    </template>
  </div>
</template>
