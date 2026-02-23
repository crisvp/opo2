<script setup lang="ts">
import { computed } from "vue";
import SlidePanel from "@/components/SlidePanel.vue";
import Accordion from "primevue/accordion";
import AccordionPanel from "primevue/accordionpanel";
import AccordionHeader from "primevue/accordionheader";
import AccordionContent from "primevue/accordioncontent";
import Tag from "primevue/tag";
import { useAdminJobDetail } from "@/api/queries/admin";

const props = defineProps<{
  jobId: string | null;
  visible: boolean;
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
}>();

const jobIdRef = computed(() => props.jobId ?? "");
const { data: jobDetail, status } = useAdminJobDetail(jobIdRef);

const loading = computed(() => status.value === "pending" && !jobDetail.value);
const job = computed(() => jobDetail.value as JobDetailData | null);

interface ExecutionLogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  data?: Record<string, unknown>;
}

interface ExecutionLog {
  id: string;
  taskIdentifier: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  finalError: string | null;
  entries: ExecutionLogEntry[];
}

interface LlmCallLog {
  id: string;
  taskType: string;
  modelId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  processingTimeMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costCents: number | null;
  errorMessage: string | null;
}

interface JobDetailData {
  job: {
    id: string;
    taskIdentifier: string;
    status: string;
    attempts: number;
    maxAttempts: number;
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
    errorMessage: string | null;
  } | null;
  executionLogs: ExecutionLog[];
  llmCalls: LlmCallLog[];
  processingResults: {
    virusScan: { passed: boolean; completedAt: string | null } | null;
    conversion: { performed: boolean; originalMimetype: string | null; completedAt: string | null } | null;
    sieve: {
      category: string | null;
      nexusScore: number;
      junkScore: number;
      confidence: number;
      reasoning: string | null;
      model: string | null;
      processingTimeMs: number | null;
      completedAt: string | null;
    } | null;
    aiExtraction: { performed: boolean; model: string | null; completedAt: string | null; error: string | null } | null;
  } | null;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
}

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString();
}

function formatCost(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return `$${(cents / 100).toFixed(4)}`;
}

function getStatusSeverity(
  status: string,
): "success" | "warn" | "danger" | "secondary" | "info" {
  switch (status) {
    case "completed":
      return "success";
    case "pending":
      return "warn";
    case "failed":
      return "danger";
    case "running":
      return "info";
    default:
      return "secondary";
  }
}

function getLogLevelSeverity(
  level: string,
): "success" | "warn" | "danger" | "secondary" | "info" {
  switch (level) {
    case "error":
      return "danger";
    case "warn":
      return "warn";
    case "info":
      return "info";
    case "debug":
      return "secondary";
    default:
      return "secondary";
  }
}

function getJobTypeLabel(jobType: string): string {
  switch (jobType) {
    case "virus_scan":
      return "Virus Scan";
    case "pdf_convert":
      return "PDF Convert";
    case "sieve":
      return "Sieve Classification";
    case "extractor":
      return "AI Extraction";
    case "pipeline_complete":
    case "document_pipeline_complete":
      return "Pipeline Complete";
    case "documentcloud_import":
      return "DC Import";
    default:
      return jobType;
  }
}

const hasExecutionLogs = computed(() => (job.value?.executionLogs?.length ?? 0) > 0);
const hasLlmCalls = computed(() => (job.value?.llmCalls?.length ?? 0) > 0);
const hasProcessingResults = computed(() => {
  const results = job.value?.processingResults;
  if (!results) return false;
  return results.virusScan || results.conversion || results.sieve || results.aiExtraction;
});
</script>

<template>
  <SlidePanel
    :visible="visible"
    :header="job?.job ? `Job: ${getJobTypeLabel(job.job.taskIdentifier)}` : 'Job Details'"
    width="700px"
    :loading="loading"
    :show-footer="false"
    @update:visible="emit('update:visible', $event)"
  >
    <div v-if="job?.job" class="space-y-6">
      <!-- Overview Section -->
      <section>
        <h3 class="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
          Overview
        </h3>
        <div class="bg-sunken rounded-lg p-4 space-y-3">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="text-xs text-muted mb-1">Status</div>
              <Tag :value="job.job.status" :severity="getStatusSeverity(job.job.status)" />
            </div>
            <div>
              <div class="text-xs text-muted mb-1">Job Type</div>
              <div class="text-primary font-medium">
                {{ getJobTypeLabel(job.job.taskIdentifier) }}
              </div>
            </div>
            <div>
              <div class="text-xs text-muted mb-1">Attempts</div>
              <div class="text-primary">{{ job.job.attempts }} / {{ job.job.maxAttempts }}</div>
            </div>
            <div>
              <div class="text-xs text-muted mb-1">Created</div>
              <div class="text-secondary text-sm">{{ formatDate(job.job.createdAt) }}</div>
            </div>
            <div>
              <div class="text-xs text-muted mb-1">Started</div>
              <div class="text-secondary text-sm">{{ formatDate(job.job.startedAt) }}</div>
            </div>
            <div>
              <div class="text-xs text-muted mb-1">Completed</div>
              <div class="text-secondary text-sm">{{ formatDate(job.job.completedAt) }}</div>
            </div>
          </div>
          <div
            v-if="job.job.errorMessage"
            class="mt-3 p-3 bg-critical/10 rounded border border-critical/20"
          >
            <div class="text-xs text-muted mb-1">Error Message</div>
            <div class="text-critical text-sm font-mono">{{ job.job.errorMessage }}</div>
          </div>
        </div>
      </section>

      <!-- Accordion for detailed sections -->
      <Accordion :multiple="true" :value="[]">
        <!-- Execution Logs -->
        <AccordionPanel value="0" :disabled="!hasExecutionLogs">
          <AccordionHeader>
            <div class="flex items-center gap-2">
              <i class="pi pi-list text-sm" />
              <span>Execution Logs</span>
              <Tag
                v-if="hasExecutionLogs"
                :value="String(job.executionLogs?.length)"
                severity="secondary"
                class="ml-auto"
              />
              <span v-else class="text-muted text-sm ml-auto">No logs</span>
            </div>
          </AccordionHeader>
          <AccordionContent>
            <div v-if="hasExecutionLogs" class="space-y-4">
              <div
                v-for="log in job.executionLogs"
                :key="log.id"
                class="border border-default rounded-lg overflow-hidden"
              >
                <div class="flex items-center justify-between gap-3 p-3 bg-sunken">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-primary">{{ log.taskIdentifier }}</span>
                    <Tag :value="log.status" :severity="getStatusSeverity(log.status)" />
                  </div>
                  <div class="text-sm text-muted">{{ formatDuration(log.durationMs) }}</div>
                </div>
                <div class="max-h-64 overflow-y-auto">
                  <div
                    v-for="(entry, idx) in log.entries"
                    :key="idx"
                    class="flex gap-3 px-3 py-2 border-b border-default last:border-b-0 text-sm font-mono"
                  >
                    <span class="text-muted whitespace-nowrap">
                      {{ new Date(entry.timestamp).toLocaleTimeString() }}
                    </span>
                    <Tag
                      :value="entry.level"
                      :severity="getLogLevelSeverity(entry.level)"
                      class="!text-xs !px-1.5 !py-0.5"
                    />
                    <span class="text-primary flex-1 break-all">{{ entry.message }}</span>
                  </div>
                </div>
                <div
                  v-if="log.finalError"
                  class="p-3 bg-critical/10 border-t border-critical/20"
                >
                  <div class="text-critical text-sm font-mono">{{ log.finalError }}</div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionPanel>

        <!-- LLM API Calls -->
        <AccordionPanel value="1" :disabled="!hasLlmCalls">
          <AccordionHeader>
            <div class="flex items-center gap-2">
              <i class="pi pi-microchip-ai text-sm" />
              <span>LLM API Calls</span>
              <Tag
                v-if="hasLlmCalls"
                :value="String(job.llmCalls?.length)"
                severity="secondary"
                class="ml-auto"
              />
              <span v-else class="text-muted text-sm ml-auto">No LLM calls</span>
            </div>
          </AccordionHeader>
          <AccordionContent>
            <div v-if="hasLlmCalls" class="space-y-3">
              <div
                v-for="call in job.llmCalls"
                :key="call.id"
                class="border border-default rounded-lg p-3"
              >
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-primary">{{ call.taskType }}</span>
                    <Tag :value="call.status" :severity="getStatusSeverity(call.status)" />
                  </div>
                  <span class="text-sm text-muted">{{ call.modelId }}</span>
                </div>
                <div class="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <div class="text-xs text-muted mb-1">Input Tokens</div>
                    <div class="text-primary font-medium">{{ formatNumber(call.inputTokens) }}</div>
                  </div>
                  <div>
                    <div class="text-xs text-muted mb-1">Output Tokens</div>
                    <div class="text-primary font-medium">{{ formatNumber(call.outputTokens) }}</div>
                  </div>
                  <div>
                    <div class="text-xs text-muted mb-1">Duration</div>
                    <div class="text-primary font-medium">{{ formatDuration(call.processingTimeMs) }}</div>
                  </div>
                  <div>
                    <div class="text-xs text-muted mb-1">Cost</div>
                    <div class="text-primary font-medium">{{ formatCost(call.costCents) }}</div>
                  </div>
                </div>
                <div v-if="call.errorMessage" class="mt-3 p-2 bg-critical/10 rounded">
                  <div class="text-critical text-sm font-mono">{{ call.errorMessage }}</div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionPanel>

        <!-- Processing Results -->
        <AccordionPanel value="2" :disabled="!hasProcessingResults">
          <AccordionHeader>
            <div class="flex items-center gap-2">
              <i class="pi pi-check-circle text-sm" />
              <span>Processing Results</span>
              <span v-if="!hasProcessingResults" class="text-muted text-sm ml-auto">
                No results
              </span>
            </div>
          </AccordionHeader>
          <AccordionContent>
            <div v-if="hasProcessingResults" class="space-y-4">
              <!-- Virus Scan -->
              <div
                v-if="job.processingResults?.virusScan"
                class="border border-default rounded-lg p-3"
              >
                <div class="flex items-center gap-2 mb-2">
                  <i class="pi pi-shield text-sm" />
                  <span class="font-medium">Virus Scan</span>
                  <Tag
                    :value="job.processingResults.virusScan.passed ? 'Passed' : 'Failed'"
                    :severity="job.processingResults.virusScan.passed ? 'success' : 'danger'"
                  />
                </div>
                <div class="text-sm text-muted">
                  Completed: {{ formatDate(job.processingResults.virusScan.completedAt) }}
                </div>
              </div>

              <!-- PDF Conversion -->
              <div
                v-if="job.processingResults?.conversion"
                class="border border-default rounded-lg p-3"
              >
                <div class="flex items-center gap-2 mb-2">
                  <i class="pi pi-file-pdf text-sm" />
                  <span class="font-medium">PDF Conversion</span>
                  <Tag
                    :value="job.processingResults.conversion.performed ? 'Converted' : 'Not Needed'"
                    :severity="job.processingResults.conversion.performed ? 'success' : 'secondary'"
                  />
                </div>
                <div class="text-sm text-muted">
                  <span v-if="job.processingResults.conversion.originalMimetype">
                    Original: {{ job.processingResults.conversion.originalMimetype }} •
                  </span>
                  Completed: {{ formatDate(job.processingResults.conversion.completedAt) }}
                </div>
              </div>

              <!-- Sieve Classification -->
              <div
                v-if="job.processingResults?.sieve"
                class="border border-default rounded-lg p-3"
              >
                <div class="flex items-center gap-2 mb-2">
                  <i class="pi pi-filter text-sm" />
                  <span class="font-medium">Sieve Classification</span>
                  <Tag :value="job.processingResults.sieve.category ?? ''" severity="info" />
                </div>
                <div class="grid grid-cols-3 gap-4 text-sm mt-2">
                  <div>
                    <div class="text-xs text-muted">Nexus Score</div>
                    <div class="text-primary font-medium">
                      {{ job.processingResults.sieve.nexusScore }}
                    </div>
                  </div>
                  <div>
                    <div class="text-xs text-muted">Junk Score</div>
                    <div class="text-primary font-medium">
                      {{ job.processingResults.sieve.junkScore }}
                    </div>
                  </div>
                  <div>
                    <div class="text-xs text-muted">Confidence</div>
                    <div class="text-primary font-medium">
                      {{ (job.processingResults.sieve.confidence * 100).toFixed(0) }}%
                    </div>
                  </div>
                </div>
                <div
                  v-if="job.processingResults.sieve.reasoning"
                  class="mt-3 text-sm text-secondary"
                >
                  <div class="text-xs text-muted mb-1">Reasoning</div>
                  {{ job.processingResults.sieve.reasoning }}
                </div>
                <div class="text-sm text-muted mt-2">
                  Model: {{ job.processingResults.sieve.model || "—" }} •
                  Duration: {{ formatDuration(job.processingResults.sieve.processingTimeMs) }}
                </div>
              </div>

              <!-- AI Extraction -->
              <div
                v-if="job.processingResults?.aiExtraction"
                class="border border-default rounded-lg p-3"
              >
                <div class="flex items-center gap-2 mb-2">
                  <i class="pi pi-microchip-ai text-sm" />
                  <span class="font-medium">AI Extraction</span>
                  <Tag
                    :value="job.processingResults.aiExtraction.performed ? 'Extracted' : 'Skipped'"
                    :severity="job.processingResults.aiExtraction.performed ? 'success' : 'secondary'"
                  />
                </div>
                <div class="text-sm text-muted">
                  <span v-if="job.processingResults.aiExtraction.model">
                    Model: {{ job.processingResults.aiExtraction.model }} •
                  </span>
                  Completed: {{ formatDate(job.processingResults.aiExtraction.completedAt) }}
                </div>
                <div
                  v-if="job.processingResults.aiExtraction.error"
                  class="mt-2 p-2 bg-critical/10 rounded"
                >
                  <div class="text-critical text-sm">
                    {{ job.processingResults.aiExtraction.error }}
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionPanel>
      </Accordion>
    </div>

    <!-- Empty state -->
    <div v-else-if="!loading" class="text-center py-12">
      <i class="pi pi-inbox text-4xl text-muted mb-4 block" />
      <p class="text-muted">Select a job to view details</p>
    </div>
  </SlidePanel>
</template>
