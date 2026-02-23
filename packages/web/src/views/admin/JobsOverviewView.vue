<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import Button from "primevue/button";
import Tag from "primevue/tag";
import Select from "primevue/select";
import {
  useJobsGrouped,
  useRetryJob,
  useCancelJob,
  useBulkRetryJobs,
  useClearCompletedLogs,
} from "../../api/queries/admin";
import type { DocumentTask, DocumentJobGroup } from "../../api/queries/admin";
import JobDetailPanel from "../../components/admin/JobDetailPanel.vue";

const router = useRouter();
const toast = useToast();
const confirm = useConfirm();

// Job detail panel state
const selectedJobId = ref<string | null>(null);
const showDetailPanel = ref(false);

function openJobDetail(jobId: string) {
  selectedJobId.value = jobId;
  showDetailPanel.value = true;
}

// Expanded state for document cards and task histories
const expandedDocuments = ref<Set<string>>(new Set());
const expandedTasks = ref<Set<string>>(new Set());

function toggleDocument(documentId: string | null) {
  const key = documentId ?? "__no_document__";
  if (expandedDocuments.value.has(key)) {
    expandedDocuments.value.delete(key);
  } else {
    expandedDocuments.value.add(key);
  }
}

function isDocumentExpanded(documentId: string | null): boolean {
  return expandedDocuments.value.has(documentId ?? "__no_document__");
}

function getTaskKey(documentId: string | null, taskIdentifier: string): string {
  return `${documentId ?? "__no_document__"}:${taskIdentifier}`;
}

function toggleTaskHistory(documentId: string | null, taskIdentifier: string) {
  const key = getTaskKey(documentId, taskIdentifier);
  if (expandedTasks.value.has(key)) {
    expandedTasks.value.delete(key);
  } else {
    expandedTasks.value.add(key);
  }
}

function isTaskHistoryExpanded(documentId: string | null, taskIdentifier: string): boolean {
  return expandedTasks.value.has(getTaskKey(documentId, taskIdentifier));
}

// Query — auto-refreshes every 5 seconds via refetchInterval
const { data: jobsData, status: queryStatus, refetch } = useJobsGrouped();

const stats = computed(() => jobsData.value?.stats ?? null);
const allDocuments = computed(() => jobsData.value?.documents ?? []);
const loading = computed(() => queryStatus.value === "pending");
const hasNoJobs = computed(() => !loading.value && (stats.value?.counts.total ?? 0) === 0);

// State filter
const STATUS_OPTIONS = [
  { label: "All States", value: null },
  { label: "Pending", value: "pending" },
  { label: "Running", value: "running" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
  { label: "Cancelled", value: "cancelled" },
];

const selectedStatus = ref<string | null>(null);

const documents = computed(() => {
  if (!selectedStatus.value) return allDocuments.value;
  return allDocuments.value.filter((doc) =>
    doc.tasks.some((t) => t.status === selectedStatus.value),
  );
});

// Mutations
const retryMutation = useRetryJob();
const cancelMutation = useCancelJob();
const retryAllMutation = useBulkRetryJobs();
const clearCompletedMutation = useClearCompletedLogs();

function getStatusSeverity(status: string): "success" | "warn" | "danger" | "secondary" | "info" {
  switch (status) {
    case "completed":
      return "success";
    case "pending":
      return "warn";
    case "scheduled":
      return "secondary";
    case "failed":
      return "danger";
    case "cancelled":
      return "secondary";
    case "running":
      return "info";
    case "rescheduled":
      return "secondary";
    default:
      return "secondary";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "cancelled":
      return "Cancelled";
    case "rescheduled":
      return "Rescheduled";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function formatScheduledTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return "soon";
  const diffMins = Math.ceil(diffMs / 60000);
  if (diffMins < 60) return `in ${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `in ${diffHours}h`;
  return date.toLocaleString();
}

function getTaskTypeLabel(taskType: string): string {
  switch (taskType) {
    case "virus_scan":
      return "Virus Scan";
    case "pdf_convert":
      return "PDF Convert";
    case "sieve":
      return "Classification";
    case "extractor":
      return "Extraction";
    case "documentcloud_import":
      return "DC Import";
    case "pipeline_complete":
    case "document_pipeline_complete":
      return "Finalize";
    default:
      return taskType;
  }
}

function getTaskTypeIcon(taskType: string): string {
  switch (taskType) {
    case "virus_scan":
      return "pi-shield";
    case "pdf_convert":
      return "pi-file-pdf";
    case "sieve":
      return "pi-tags";
    case "extractor":
      return "pi-sparkles";
    case "documentcloud_import":
      return "pi-cloud-download";
    case "pipeline_complete":
    case "document_pipeline_complete":
      return "pi-check-circle";
    default:
      return "pi-cog";
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "—";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function canRetryTask(task: DocumentTask): boolean {
  return (
    task.status === "failed" ||
    task.status === "completed" ||
    task.status === "cancelled" ||
    task.status === "scheduled"
  );
}

function getRetryableTasks(doc: DocumentJobGroup): DocumentTask[] {
  return doc.tasks.filter(canRetryTask);
}

async function retryDocumentTasks(doc: DocumentJobGroup) {
  const tasks = getRetryableTasks(doc);
  try {
    await Promise.all(tasks.map((t) => retryMutation.mutateAsync(t.latestJobId)));
    toast.add({ severity: "success", summary: "Job Queued", detail: "Task(s) queued for immediate retry", life: 3000 });
    refetch();
  } catch {
    toast.add({ severity: "error", summary: "Error", detail: "Failed to retry task(s)", life: 5000 });
  }
}

function canCancelTask(task: DocumentTask): boolean {
  return task.status === "pending" || task.status === "running" || task.status === "scheduled";
}

async function retryTask(task: DocumentTask) {
  try {
    await retryMutation.mutateAsync(task.latestJobId);
    toast.add({ severity: "success", summary: "Job Queued", detail: "Job has been queued for retry", life: 3000 });
    refetch();
  } catch {
    toast.add({ severity: "error", summary: "Error", detail: "Failed to retry job", life: 5000 });
  }
}

function confirmCancelTask(task: DocumentTask, documentTitle: string | null) {
  confirm.require({
    message: `Cancel ${getTaskTypeLabel(task.taskIdentifier)} task${documentTitle ? ` for "${documentTitle}"` : ""}?`,
    header: "Cancel Task",
    icon: "pi pi-times-circle",
    acceptClass: "p-button-danger",
    accept: () => cancelTask(task),
  });
}

async function cancelTask(task: DocumentTask) {
  try {
    await cancelMutation.mutateAsync(task.latestJobId);
    toast.add({ severity: "success", summary: "Task Cancelled", detail: "Task has been cancelled", life: 3000 });
    refetch();
  } catch {
    toast.add({ severity: "error", summary: "Error", detail: "Failed to cancel task", life: 5000 });
  }
}

function confirmRetryAllFailed() {
  const failedCount = stats.value?.counts.failed ?? 0;
  if (failedCount === 0) {
    toast.add({ severity: "info", summary: "No Failed Jobs", detail: "There are no failed jobs to retry", life: 3000 });
    return;
  }
  confirm.require({
    message: `Retry all ${failedCount} failed jobs?`,
    header: "Retry All Failed",
    icon: "pi pi-refresh",
    accept: () => retryAllFailed(),
  });
}

async function retryAllFailed() {
  try {
    const result = await retryAllMutation.mutateAsync();
    toast.add({ severity: "success", summary: "Jobs Queued", detail: `${result.count} jobs queued for retry`, life: 3000 });
    refetch();
  } catch {
    toast.add({ severity: "error", summary: "Error", detail: "Failed to retry jobs", life: 5000 });
  }
}

function confirmClearCompleted() {
  const completedCount = stats.value?.counts.completed ?? 0;
  if (completedCount === 0) {
    toast.add({ severity: "info", summary: "No Completed Jobs", detail: "There are no completed jobs to clear", life: 3000 });
    return;
  }
  confirm.require({
    message: `Clear ${completedCount} completed jobs from the list?`,
    header: "Clear Completed",
    icon: "pi pi-trash",
    acceptClass: "p-button-danger",
    accept: () => clearCompleted(),
  });
}

async function clearCompleted() {
  try {
    const result = await clearCompletedMutation.mutateAsync();
    toast.add({ severity: "success", summary: "Jobs Cleared", detail: `${result.count} completed jobs cleared`, life: 3000 });
    refetch();
  } catch {
    toast.add({ severity: "error", summary: "Error", detail: "Failed to clear jobs", life: 5000 });
  }
}

function getDocumentStatus(doc: DocumentJobGroup): {
  status: string;
  severity: "success" | "warn" | "danger" | "info" | "secondary";
} {
  const statuses = doc.tasks.map((t) => t.status);
  if (statuses.includes("running")) return { status: "Processing", severity: "info" };
  if (statuses.includes("failed")) return { status: "Has Failures", severity: "danger" };
  if (statuses.includes("pending") || statuses.includes("scheduled")) return { status: "In Queue", severity: "warn" };
  if (statuses.every((s) => s === "completed")) return { status: "Complete", severity: "success" };
  return { status: "Mixed", severity: "secondary" };
}

function getDocumentDisplayTitle(doc: DocumentJobGroup): string {
  if (doc.documentTitle) return doc.documentTitle;
  if (!doc.documentId) return "Import pending...";
  return "Document deleted";
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-primary">Processing Jobs</h1>
        <p class="text-secondary mt-1">Monitor and manage document processing jobs</p>
      </div>
      <Button
        label="Back to Admin"
        icon="pi pi-arrow-left"
        severity="secondary"
        @click="router.push('/admin')"
      />
    </div>

    <!-- Empty State: No Jobs At All -->
    <div v-if="hasNoJobs" class="bg-elevated rounded-lg border border-default p-12 text-center">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface-subtle mb-4">
        <i class="pi pi-check-circle text-3xl text-success" />
      </div>
      <h2 class="text-xl font-semibold text-primary mb-2">No Processing Jobs</h2>
      <p class="text-secondary max-w-md mx-auto mb-6">
        There are no document processing jobs in the queue. Jobs are created automatically when
        users upload files.
      </p>
      <div class="flex justify-center gap-3">
        <Button label="Refresh" icon="pi pi-refresh" severity="secondary" @click="refetch()" />
        <Button
          label="Back to Admin"
          icon="pi pi-arrow-left"
          severity="secondary"
          outlined
          @click="router.push('/admin')"
        />
      </div>
    </div>

    <!-- Main Content: Stats + Grouped Documents -->
    <div v-else>
      <!-- Stats Cards -->
      <div v-if="stats" class="grid grid-cols-2 md:grid-cols-7 gap-4 mb-6">
        <div class="bg-elevated p-4 rounded-lg border border-default">
          <div class="text-sm text-muted mb-1">Total</div>
          <div class="text-2xl font-bold text-primary">{{ stats.counts.total }}</div>
        </div>
        <div class="bg-elevated p-4 rounded-lg border border-default">
          <div class="text-sm text-muted mb-1">Pending</div>
          <div class="text-2xl font-bold text-warning">{{ stats.counts.pending }}</div>
        </div>
        <div class="bg-elevated p-4 rounded-lg border border-default">
          <div class="text-sm text-muted mb-1">Scheduled</div>
          <div class="text-2xl font-bold text-secondary">{{ stats.counts.scheduled ?? 0 }}</div>
        </div>
        <div class="bg-elevated p-4 rounded-lg border border-default">
          <div class="text-sm text-muted mb-1">Running</div>
          <div class="text-2xl font-bold text-info">{{ stats.counts.running }}</div>
        </div>
        <div class="bg-elevated p-4 rounded-lg border border-default">
          <div class="text-sm text-muted mb-1">Completed</div>
          <div class="text-2xl font-bold text-success">{{ stats.counts.completed }}</div>
        </div>
        <div class="bg-elevated p-4 rounded-lg border border-default">
          <div class="text-sm text-muted mb-1">Failed</div>
          <div class="text-2xl font-bold text-critical">{{ stats.counts.failed }}</div>
        </div>
        <div class="bg-elevated p-4 rounded-lg border border-default">
          <div class="text-sm text-muted mb-1">Cancelled</div>
          <div class="text-2xl font-bold text-muted">{{ stats.counts.cancelled ?? 0 }}</div>
        </div>
      </div>

      <!-- Actions Bar -->
      <div class="flex flex-wrap items-center gap-4 mb-4">
        <div class="text-sm text-secondary">
          {{ documents.length }} document{{ documents.length !== 1 ? "s" : "" }} with active jobs
        </div>
        <Select
          v-model="selectedStatus"
          :options="STATUS_OPTIONS"
          option-label="label"
          option-value="value"
          class="w-40"
          aria-label="Filter by state"
        />
        <div class="flex gap-2 ml-auto">
          <Button
            label="Retry All Failed"
            icon="pi pi-refresh"
            severity="warn"
            :disabled="!stats?.counts.failed"
            :loading="retryAllMutation.isPending.value"
            @click="confirmRetryAllFailed"
          />
          <Button
            label="Clear Completed"
            icon="pi pi-trash"
            severity="secondary"
            :disabled="!stats?.counts.completed"
            :loading="clearCompletedMutation.isPending.value"
            @click="confirmClearCompleted"
          />
          <Button icon="pi pi-refresh" severity="secondary" title="Refresh" @click="refetch()" />
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="space-y-4">
        <div
          v-for="i in 3"
          :key="i"
          class="bg-elevated rounded-lg border border-default p-4 animate-pulse"
        >
          <div class="h-5 bg-surface-subtle rounded w-1/3 mb-3" />
          <div class="h-4 bg-surface-subtle rounded w-1/2" />
        </div>
      </div>

      <!-- Grouped Documents -->
      <div v-else class="space-y-4">
        <div
          v-for="doc in documents"
          :key="doc.documentId ?? '__no_document__'"
          class="bg-elevated rounded-lg border border-default overflow-hidden"
        >
          <!-- Document Header -->
          <div
            class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-subtle transition-colors"
            @click="toggleDocument(doc.documentId)"
          >
            <i
              :class="[
                'pi text-secondary transition-transform',
                isDocumentExpanded(doc.documentId) ? 'pi-chevron-down' : 'pi-chevron-right',
              ]"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium text-primary truncate">
                  {{ getDocumentDisplayTitle(doc) }}
                </span>
                <Tag
                  :value="getDocumentStatus(doc).status"
                  :severity="getDocumentStatus(doc).severity"
                  class="text-xs"
                />
              </div>
              <div class="text-xs text-muted mt-0.5">
                {{ doc.tasks.length }} task{{ doc.tasks.length !== 1 ? "s" : "" }}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <i
                v-if="doc.tasks.some((t) => t.status === 'running')"
                class="pi pi-spin pi-spinner text-info"
                title="Running"
              />
              <i
                v-if="doc.tasks.some((t) => t.status === 'failed')"
                class="pi pi-times-circle text-critical"
                title="Has failures"
              />
              <i
                v-if="doc.tasks.some((t) => t.status === 'scheduled')"
                class="pi pi-clock text-secondary"
                title="Scheduled"
              />
              <button
                v-if="getRetryableTasks(doc).length > 0"
                class="p-1 rounded-full hover:bg-surface-overlay transition-colors"
                :title="getRetryableTasks(doc).length === 1 ? 'Retry this task' : `Retry ${getRetryableTasks(doc).length} tasks`"
                @click.stop="retryDocumentTasks(doc)"
              >
                <i class="pi pi-refresh text-info text-sm" />
              </button>
            </div>
          </div>

          <!-- Expanded Task List -->
          <div v-if="isDocumentExpanded(doc.documentId)" class="border-t border-default">
            <div
              v-for="task in doc.tasks"
              :key="task.taskIdentifier"
              class="border-b border-default last:border-b-0"
            >
              <!-- Task Row -->
              <div class="flex items-center gap-3 px-4 py-2 pl-10 hover:bg-surface-subtle">
                <!-- Expand history button -->
                <button
                  v-if="task.history.length > 1"
                  class="p-1 rounded hover:bg-surface-overlay transition-colors"
                  @click.stop="toggleTaskHistory(doc.documentId, task.taskIdentifier)"
                >
                  <i
                    :class="[
                      'pi text-xs text-secondary',
                      isTaskHistoryExpanded(doc.documentId, task.taskIdentifier)
                        ? 'pi-chevron-down'
                        : 'pi-chevron-right',
                    ]"
                  />
                </button>
                <span v-else class="w-6" />

                <!-- Task type icon and label -->
                <div class="flex items-center gap-2 w-36">
                  <i :class="['pi', getTaskTypeIcon(task.taskIdentifier), 'text-secondary']" />
                  <span class="text-sm">{{ getTaskTypeLabel(task.taskIdentifier) }}</span>
                </div>

                <!-- Status -->
                <div class="flex items-center gap-2 w-32">
                  <Tag
                    :value="getStatusLabel(task.status)"
                    :severity="getStatusSeverity(task.status)"
                    class="text-xs"
                  />
                  <i v-if="task.status === 'running'" class="pi pi-spin pi-spinner text-info text-xs" />
                  <i v-else-if="task.status === 'scheduled'" class="pi pi-clock text-secondary text-xs" />
                </div>

                <!-- Scheduled time -->
                <div class="w-24 text-xs text-muted">
                  <span
                    v-if="task.status === 'scheduled'"
                    :title="formatDate(task.scheduledAt)"
                  >
                    Retry {{ formatScheduledTime(task.scheduledAt) }}
                  </span>
                </div>

                <!-- Attempts -->
                <div class="w-24">
                  <span
                    class="text-xs"
                    :class="
                      task.attempts >= task.maxAttempts
                        ? 'text-critical font-medium'
                        : 'text-secondary'
                    "
                  >
                    {{ task.attempts }} attempt{{ task.attempts !== 1 ? "s" : "" }}
                  </span>
                </div>

                <!-- Error (if any) -->
                <div class="flex-1 min-w-0">
                  <span
                    v-if="task.lastError"
                    class="text-xs text-critical truncate block"
                    :title="task.lastError"
                  >
                    {{ task.lastError }}
                  </span>
                </div>

                <!-- Actions -->
                <div class="flex items-center gap-1">
                  <Button
                    icon="pi pi-eye"
                    severity="secondary"
                    text
                    rounded
                    size="small"
                    title="View logs"
                    @click.stop="openJobDetail(task.latestJobId)"
                  />
                  <Button
                    v-if="canRetryTask(task)"
                    icon="pi pi-refresh"
                    severity="info"
                    text
                    rounded
                    size="small"
                    :title="task.status === 'scheduled' ? 'Run now' : 'Retry this task'"
                    :loading="retryMutation.isPending.value"
                    @click.stop="retryTask(task)"
                  />
                  <Button
                    v-if="canCancelTask(task)"
                    icon="pi pi-times"
                    severity="danger"
                    text
                    rounded
                    size="small"
                    title="Cancel this task"
                    :loading="cancelMutation.isPending.value"
                    @click.stop="confirmCancelTask(task, doc.documentTitle)"
                  />
                </div>
              </div>

              <!-- Attempt History (expanded) -->
              <div
                v-if="
                  task.history.length > 1 &&
                  isTaskHistoryExpanded(doc.documentId, task.taskIdentifier)
                "
                class="bg-surface-subtle border-t border-default"
              >
                <div
                  v-for="(attempt, idx) in task.history"
                  :key="attempt.jobId"
                  class="flex items-center gap-3 px-4 py-1.5 pl-20 text-xs border-b border-default last:border-b-0"
                >
                  <span class="text-muted w-16">Attempt {{ task.history.length - idx }}</span>
                  <Tag
                    :value="getStatusLabel(attempt.status)"
                    :severity="getStatusSeverity(attempt.status)"
                    class="text-xs"
                  />
                  <span class="text-muted" :title="formatDate(attempt.startedAt)">
                    {{ formatRelativeTime(attempt.startedAt) }}
                  </span>
                  <span
                    v-if="attempt.error"
                    class="text-critical truncate flex-1"
                    :title="attempt.error"
                  >
                    {{ attempt.error }}
                  </span>
                  <Button
                    icon="pi pi-eye"
                    severity="secondary"
                    text
                    rounded
                    size="small"
                    class="p-1!"
                    title="View logs"
                    @click.stop="openJobDetail(attempt.jobId)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty filtered state -->
        <div v-if="documents.length === 0" class="text-center py-8">
          <i class="pi pi-inbox text-4xl text-muted mb-4 block" />
          <p class="text-muted">No documents with active jobs</p>
        </div>
      </div>
    </div>

    <!-- Job Detail Panel -->
    <JobDetailPanel :job-id="selectedJobId" v-model:visible="showDetailPanel" />
  </div>
</template>
