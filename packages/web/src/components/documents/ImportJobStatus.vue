<script setup lang="ts">
import { computed } from "vue";
import { useImportJob } from "../../api/queries/documentcloud";

const props = defineProps<{
  jobId: string;
}>();

const jobIdRef = computed(() => props.jobId);
const { data, isLoading } = useImportJob(jobIdRef);

const statusClass = computed(() => {
  const map: Record<string, string> = {
    pending: "bg-warning-subtle text-warning",
    processing: "bg-info-subtle text-info",
    completed: "bg-success-subtle text-success",
    failed: "bg-critical-subtle text-critical",
  };
  return map[data.value?.status ?? ""] ?? "bg-surface-subtle text-muted";
});
</script>

<template>
  <div
    class="border border-default rounded-lg p-4 bg-elevated"
    data-testid="import-job-status"
  >
    <div v-if="isLoading" class="text-sm text-muted">Loading job status…</div>

    <template v-else-if="data">
      <div class="flex items-center gap-3">
        <span
          class="text-xs font-medium px-2 py-0.5 rounded-full"
          :class="statusClass"
          data-testid="job-status-pill"
        >
          {{ data.status }}
        </span>
        <span class="text-sm text-muted">
          {{ data.importedCount }} / {{ data.totalRequested }} imported
        </span>
        <span v-if="data.errorCount > 0" class="text-sm text-critical">
          {{ data.errorCount }} error(s)
        </span>
      </div>

      <div v-if="data.status === 'completed'" class="mt-2 text-sm text-primary">
        Import complete —
        <RouterLink to="/browse" class="underline text-primary">browse documents</RouterLink>
      </div>
    </template>
  </div>
</template>
