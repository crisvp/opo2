<script setup lang="ts">
import { ref, watch } from "vue";
import PdfViewer from "./PdfViewer.vue";
import CsvViewer from "./CsvViewer.vue";

const props = defineProps<{
  documentId: string;
  mimetype: string;
}>();

const previewUrl = `/api/documents/${props.documentId}/preview`;

const csvContent = ref<string | null>(null);
const csvLoading = ref(false);
const csvError = ref<string | null>(null);

const isPdf = props.mimetype === "application/pdf";
const isCsv = props.mimetype === "text/csv";

async function loadCsv() {
  if (!isCsv) return;
  csvLoading.value = true;
  csvError.value = null;
  try {
    const res = await fetch(previewUrl, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to load CSV");
    csvContent.value = await res.text();
  } catch (err) {
    csvError.value = err instanceof Error ? err.message : "Failed to load CSV";
  } finally {
    csvLoading.value = false;
  }
}

watch(
  () => props.documentId,
  () => {
    if (isCsv) loadCsv();
  },
  { immediate: true },
);
</script>

<template>
  <div class="h-full" data-testid="document-preview-panel">
    <PdfViewer v-if="isPdf" :url="previewUrl" />

    <div v-else-if="isCsv">
      <div v-if="csvLoading" class="p-4 text-muted text-center">Loading preview…</div>
      <div v-else-if="csvError" class="p-4 text-critical text-center">{{ csvError }}</div>
      <CsvViewer v-else-if="csvContent" :content="csvContent" />
    </div>

    <div v-else class="p-4 text-muted text-center">
      <p>Preview not available for this file type.</p>
      <p class="text-xs mt-1">{{ mimetype }}</p>
    </div>
  </div>
</template>
