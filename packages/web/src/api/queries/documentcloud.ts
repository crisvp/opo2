import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";
import type { Ref } from "vue";
import { apiClient } from "../client";
import { documentKeys } from "./documents";
import type {
  DocumentCloudSearchResponse,
  DocumentCloudImportOptions,
  DocumentCloudImportJob,
} from "@opo/shared";

export const documentCloudKeys = {
  all: ["documentcloud"] as const,
  status: () => [...documentCloudKeys.all, "status"] as const,
  search: (query: Record<string, unknown>) => [...documentCloudKeys.all, "search", query] as const,
  job: (id: string | null) => [...documentCloudKeys.all, "job", id] as const,
  jobs: () => [...documentCloudKeys.all, "jobs"] as const,
};

export function useDocumentCloudStatus() {
  return useQuery({
    queryKey: documentCloudKeys.status(),
    queryFn: () => apiClient.get<{ available: boolean }>("/documentcloud/status"),
  });
}

export function useDocumentCloudSearch(query: Ref<Record<string, string | number | boolean | null | undefined>>) {
  return useQuery({
    queryKey: computed(() => documentCloudKeys.search(query.value)),
    queryFn: () => apiClient.get<DocumentCloudSearchResponse>("/documentcloud/search", query.value),
    enabled: computed(() => Object.values(query.value).some(Boolean)),
  });
}

export function useImportFromDocumentCloud() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { documentCloudId: number; options?: DocumentCloudImportOptions }) =>
      apiClient.post<{ jobId: string }>("/documentcloud/import", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
      queryClient.invalidateQueries({ queryKey: documentCloudKeys.jobs() });
    },
  });
}

export function useImportBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { documentCloudIds: number[]; options?: DocumentCloudImportOptions }) =>
      apiClient.post<{ jobId: string; count: number }>("/documentcloud/import/batch", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
      queryClient.invalidateQueries({ queryKey: documentCloudKeys.jobs() });
    },
  });
}

export function useImportJob(jobId: Ref<string | null>) {
  return useQuery({
    queryKey: computed(() => documentCloudKeys.job(jobId.value)),
    queryFn: () => apiClient.get<DocumentCloudImportJob>(`/documentcloud/import/${jobId.value}`),
    enabled: computed(() => jobId.value !== null),
    refetchInterval: computed(() => {
      // Will be overridden per-instance based on job status; poll every 3s by default when enabled
      return jobId.value !== null ? 3000 : false;
    }),
  });
}

export function useImportJobs() {
  return useQuery({
    queryKey: documentCloudKeys.jobs(),
    queryFn: () => apiClient.get<DocumentCloudImportJob[]>("/documentcloud/jobs"),
  });
}
