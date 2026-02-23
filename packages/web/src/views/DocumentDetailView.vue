<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import DocumentPreviewPanel from "../components/documents/DocumentPreviewPanel.vue";
import DocumentMetadataPanel from "../components/documents/DocumentMetadataPanel.vue";
import DocumentAssociationsPanel from "../components/documents/DocumentAssociationsPanel.vue";
import { useDocumentDetail } from "../api/queries/documents";

const route = useRoute();
const id = computed(() => route.params.id as string);

const { data, isLoading, isError } = useDocumentDetail(id);

const doc = computed(() => data.value);

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
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
  <div class="max-w-6xl mx-auto p-8">
    <!-- Loading -->
    <div v-if="isLoading" class="text-center py-12 text-muted">Loading…</div>

    <!-- Error -->
    <div v-else-if="isError" class="text-center py-12 text-critical">
      Failed to load document.
    </div>

    <!-- Not found / unauthorized handled by apiClient throwing -->

    <div v-else-if="doc" class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Left: Document info -->
      <div class="space-y-6">
        <div>
          <div class="flex items-start gap-3">
            <h1 class="text-2xl font-semibold text-primary flex-1">
              {{ doc.title }}
            </h1>
            <span
              class="shrink-0 text-sm font-medium px-2 py-1 rounded-full"
              :class="stateBadgeClass(doc.state)"
              data-testid="state-badge"
            >
              {{ doc.state.replace(/_/g, " ") }}
            </span>
          </div>

          <p v-if="doc.description" class="mt-2 text-muted">
            {{ doc.description }}
          </p>
        </div>

        <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt class="font-medium text-secondary">Category</dt>
          <dd class="text-primary">{{ doc.categoryName ?? "—" }}</dd>

          <dt class="font-medium text-secondary">Government Level</dt>
          <dd class="text-primary">{{ doc.governmentLevel ?? "—" }}</dd>

          <dt v-if="doc.stateName" class="font-medium text-secondary">State</dt>
          <dd v-if="doc.stateName" class="text-primary">{{ doc.stateName }}</dd>

          <dt v-if="doc.placeName" class="font-medium text-secondary">Place</dt>
          <dd v-if="doc.placeName" class="text-primary">{{ doc.placeName }}</dd>

          <dt class="font-medium text-secondary">Document Date</dt>
          <dd class="text-primary">{{ formatDate(doc.documentDate) }}</dd>

          <dt class="font-medium text-secondary">Uploaded</dt>
          <dd class="text-primary">{{ formatDate(doc.createdAt) }}</dd>

          <dt class="font-medium text-secondary">File</dt>
          <dd class="text-primary">{{ doc.filename }}</dd>
        </dl>

        <!-- Tags -->
        <div v-if="doc.tags && doc.tags.length > 0">
          <h3 class="text-sm font-semibold text-secondary mb-2">Tags</h3>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="tag in doc.tags"
              :key="tag"
              class="text-xs px-2 py-1 bg-sunken rounded"
            >
              {{ tag }}
            </span>
          </div>
        </div>

        <!-- Download link -->
        <div class="flex gap-3">
          <a
            :href="`/api/documents/${doc.id}/download`"
            class="text-sm text-primary underline"
          >
            Download
          </a>
        </div>

        <!-- Associations -->
        <div v-if="doc.associations && doc.associations.length > 0">
          <h3 class="text-sm font-semibold text-secondary mb-2">Associations</h3>
          <DocumentAssociationsPanel :associations="doc.associations" />
        </div>

        <!-- Metadata -->
        <div v-if="doc.metadata && doc.metadata.length > 0">
          <h3 class="text-sm font-semibold text-secondary mb-2">Metadata</h3>
          <DocumentMetadataPanel :metadata="doc.metadata" />
        </div>
      </div>

      <!-- Right: Preview -->
      <div class="h-96 lg:h-auto">
        <h2 class="text-base font-semibold text-secondary mb-2">Preview</h2>
        <div class="border border-default rounded-lg overflow-hidden h-full min-h-64">
          <DocumentPreviewPanel :document-id="doc.id" :mimetype="doc.mimetype" />
        </div>
      </div>
    </div>
  </div>
</template>
