<script setup lang="ts">
import { ref, computed } from "vue";
import { RouterLink } from "vue-router";
import type { DocumentListItem } from "@opo/shared";
import { useModerationQueue, useApproveDocument, useRejectDocument } from "../api/queries/moderation";

const page = ref(1);
const pageSize = ref(20);
const filters = computed(() => ({ page: page.value, pageSize: pageSize.value }));

const { data, isLoading, isError } = useModerationQueue(filters);
const approveDoc = useApproveDocument();
const rejectDoc = useRejectDocument();

const items = computed<DocumentListItem[]>(() => data.value?.items ?? []);
const total = computed(() => data.value?.total ?? 0);
const totalPages = computed(() => data.value?.totalPages ?? 1);

// Reject dialog state
const rejectDialogVisible = ref(false);
const rejectingDocId = ref<string | null>(null);
const rejectReason = ref("");
const rejectError = ref("");

function openRejectDialog(id: string) {
  rejectingDocId.value = id;
  rejectReason.value = "";
  rejectError.value = "";
  rejectDialogVisible.value = true;
}

function closeRejectDialog() {
  rejectDialogVisible.value = false;
  rejectingDocId.value = null;
  rejectReason.value = "";
  rejectError.value = "";
}

async function handleApprove(id: string) {
  await approveDoc.mutateAsync(id);
}

async function handleRejectSubmit() {
  if (!rejectingDocId.value) return;
  const trimmed = rejectReason.value.trim();
  if (!trimmed) {
    rejectError.value = "Reason is required.";
    return;
  }
  await rejectDoc.mutateAsync({ id: rejectingDocId.value, reason: trimmed });
  closeRejectDialog();
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
  <div class="max-w-4xl mx-auto p-8">
    <h1 class="text-2xl font-semibold text-primary mb-6">Moderation Queue</h1>

    <!-- Loading -->
    <div v-if="isLoading" class="text-center py-12 text-muted">Loading...</div>

    <!-- Error -->
    <div v-else-if="isError" class="text-center py-12 text-critical">
      Failed to load moderation queue.
    </div>

    <!-- Empty -->
    <div v-else-if="items.length === 0" class="text-center py-12 text-muted">
      No documents awaiting review.
    </div>

    <!-- List -->
    <div v-else class="space-y-4">
      <div
        v-for="doc in items"
        :key="doc.id"
        class="flex items-start gap-4 bg-elevated border border-default rounded-lg p-4"
        data-testid="moderation-item"
      >
        <div class="flex-1 min-w-0">
          <RouterLink
            :to="`/documents/${doc.id}`"
            class="text-base font-medium text-primary hover:underline truncate block"
          >
            {{ doc.title }}
          </RouterLink>
          <p class="text-xs text-muted mt-0.5">{{ formatDate(doc.createdAt) }}</p>
          <p v-if="doc.uploaderName" class="text-xs text-secondary mt-0.5">
            Uploaded by: {{ doc.uploaderName }}
          </p>
          <p v-if="doc.description" class="text-sm text-secondary mt-1 line-clamp-2">
            {{ doc.description }}
          </p>
          <div v-if="doc.tags && doc.tags.length > 0" class="flex flex-wrap gap-1 mt-2">
            <span
              v-for="tag in doc.tags.slice(0, 5)"
              :key="tag"
              class="text-xs px-1.5 py-0.5 bg-sunken rounded"
            >
              {{ tag }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <RouterLink
            :to="`/documents/${doc.id}/ai-review`"
            class="text-xs px-3 py-1.5 border border-default rounded text-secondary hover:bg-sunken"
          >
            View AI Review
          </RouterLink>
          <button
            type="button"
            class="text-xs px-3 py-1.5 bg-success text-inverted rounded disabled:opacity-50"
            :disabled="approveDoc.isPending.value"
            data-testid="approve-button"
            @click="handleApprove(doc.id)"
          >
            Approve
          </button>
          <button
            type="button"
            class="text-xs px-3 py-1.5 bg-critical text-inverted rounded disabled:opacity-50"
            :disabled="rejectDoc.isPending.value"
            data-testid="reject-button"
            @click="openRejectDialog(doc.id)"
          >
            Reject
          </button>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-center gap-4 mt-8">
      <button
        type="button"
        class="px-4 py-2 border border-default rounded text-sm disabled:opacity-50"
        :disabled="page <= 1"
        @click="page--"
      >
        Previous
      </button>
      <span class="text-sm text-secondary">Page {{ page }} of {{ totalPages }} ({{ total }} total)</span>
      <button
        type="button"
        class="px-4 py-2 border border-default rounded text-sm disabled:opacity-50"
        :disabled="page >= totalPages"
        @click="page++"
      >
        Next
      </button>
    </div>

    <!-- Reject Dialog -->
    <div
      v-if="rejectDialogVisible"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      data-testid="reject-dialog"
    >
      <div class="bg-elevated rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h2 class="text-lg font-semibold text-primary mb-4">Reject Document</h2>
        <p class="text-sm text-secondary mb-3">
          Please provide a reason for rejection (required):
        </p>
        <textarea
          v-model="rejectReason"
          class="w-full border border-default rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-focus"
          rows="4"
          placeholder="Explain why this document is being rejected..."
          data-testid="reject-reason-input"
        />
        <p v-if="rejectError" class="text-xs text-critical mt-1">{{ rejectError }}</p>
        <div class="flex justify-end gap-3 mt-4">
          <button
            type="button"
            class="px-4 py-2 border border-default rounded text-sm"
            @click="closeRejectDialog"
          >
            Cancel
          </button>
          <button
            type="button"
            class="px-4 py-2 bg-critical text-inverted rounded text-sm disabled:opacity-50"
            :disabled="rejectDoc.isPending.value"
            data-testid="reject-submit-button"
            @click="handleRejectSubmit"
          >
            Reject Document
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
