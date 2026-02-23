import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";
import type { Ref } from "vue";
import type { PaginatedResponse } from "@opo/shared";
import { apiClient } from "../client";

// ---- Types ----

export interface ExecutionLogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  data?: Record<string, unknown>;
}

export interface ExecutionLog {
  id: string;
  taskIdentifier: string;
  status: "running" | "completed" | "failed" | "rescheduled";
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  finalError: string | null;
  entries: ExecutionLogEntry[];
}

export interface LlmCallLog {
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
  errorCode: string | null;
  errorMessage: string | null;
}

export interface ProcessingResultsDetail {
  virusScan: {
    passed: boolean;
    completedAt: string | null;
  } | null;
  conversion: {
    performed: boolean;
    originalMimetype: string | null;
    completedAt: string | null;
  } | null;
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
  aiExtraction: {
    performed: boolean;
    model: string | null;
    completedAt: string | null;
    error: string | null;
  } | null;
}

export interface JobDetailData {
  job: {
    id: string;
    taskIdentifier: string;
    documentId: string | null;
    status: string;
    attempts: number;
    maxAttempts: number;
    createdAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    errorMessage: string | null;
  } | null;
  executionLogs: ExecutionLog[];
  llmCalls: LlmCallLog[];
  processingResults: ProcessingResultsDetail | null;
}

export interface TaskAttempt {
  jobId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

export interface DocumentTask {
  taskIdentifier: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  latestJobId: string;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
  history: TaskAttempt[];
}

export interface DocumentJobGroup {
  documentId: string | null;
  documentTitle: string | null;
  tasks: DocumentTask[];
}

export interface JobsGroupedOverview {
  stats: {
    counts: {
      pending: number;
      scheduled: number;
      running: number;
      completed: number;
      failed: number;
      cancelled: number;
      rescheduled: number;
      total: number;
    };
  };
  documents: DocumentJobGroup[];
}

// ---- Query keys ----

export const adminKeys = {
  all: ["admin"] as const,
  stats: () => [...adminKeys.all, "stats"] as const,
  users: () => [...adminKeys.all, "users"] as const,
  userList: (filters: Record<string, unknown>) => [...adminKeys.users(), "list", filters] as const,
  userDetail: (id: string) => [...adminKeys.users(), "detail", id] as const,
  stuckProcessing: () => [...adminKeys.all, "stuck-processing"] as const,
  jobs: () => [...adminKeys.all, "jobs"] as const,
  jobsGrouped: () => [...adminKeys.jobs(), "grouped"] as const,
  jobDetail: (id: string) => [...adminKeys.jobs(), "detail", id] as const,
};

// ---- Composables ----

export function useAdminStats() {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: () => apiClient.get<unknown>("/admin/stats"),
  });
}

export function useAdminUserList(filters: Ref<Record<string, unknown>>) {
  return useQuery({
    queryKey: computed(() => adminKeys.userList(filters.value)),
    queryFn: () =>
      apiClient.get<PaginatedResponse<unknown>>(
        "/admin/users",
        filters.value as Record<string, string | number | boolean | null | undefined>,
      ),
  });
}

export function useAdminUserDetail(id: Ref<string>) {
  return useQuery({
    queryKey: computed(() => adminKeys.userDetail(id.value)),
    queryFn: () => apiClient.get<unknown>(`/admin/users/${id.value}`),
    enabled: computed(() => !!id.value),
  });
}

export function useAdminSetUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiClient.put<unknown>(`/admin/users/${id}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useAdminSetUserTier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tierId }: { id: string; tierId: number }) =>
      apiClient.put<unknown>(`/admin/users/${id}/tier`, { tierId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useAdminAnonymizeUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useStuckProcessing() {
  return useQuery({
    queryKey: adminKeys.stuckProcessing(),
    queryFn: () => apiClient.get<unknown[]>("/admin/stuck-processing"),
  });
}

export function useAdminJobs() {
  return useQuery({
    queryKey: adminKeys.jobs(),
    queryFn: () => apiClient.get<unknown[]>("/admin/jobs"),
  });
}

export function useJobsGrouped() {
  return useQuery({
    queryKey: adminKeys.jobsGrouped(),
    queryFn: () => apiClient.get<JobsGroupedOverview>("/admin/jobs/grouped"),
    refetchInterval: 5000,
  });
}

export function useAdminJobDetail(id: Ref<string>) {
  return useQuery({
    queryKey: computed(() => adminKeys.jobDetail(id.value)),
    queryFn: () => apiClient.get<JobDetailData>(`/admin/jobs/${id.value}`),
    enabled: computed(() => !!id.value),
  });
}

export function useCancelJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<void>(`/admin/jobs/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.jobs() });
      queryClient.invalidateQueries({ queryKey: adminKeys.jobsGrouped() });
    },
  });
}

export function useRetryJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<void>(`/admin/jobs/${id}/retry`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.jobs() });
      queryClient.invalidateQueries({ queryKey: adminKeys.jobsGrouped() });
    },
  });
}

export function useBulkRetryJobs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<{ count: number }>("/admin/jobs/bulk-retry"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.jobs() });
      queryClient.invalidateQueries({ queryKey: adminKeys.jobsGrouped() });
    },
  });
}

export function useClearCompletedLogs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete<{ count: number }>("/admin/jobs/completed"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.jobs() });
      queryClient.invalidateQueries({ queryKey: adminKeys.jobsGrouped() });
    },
  });
}
