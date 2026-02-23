import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";
import type { Ref } from "vue";
import type { StateAgency } from "@opo/shared";
import { apiClient } from "../client";

export const agencyKeys = {
  all: ["agencies"] as const,
  list: (stateUsps?: string) => [...agencyKeys.all, "list", stateUsps ?? "all"] as const,
  detail: (id: string) => [...agencyKeys.all, "detail", id] as const,
  stateMetadata: (usps: string | null) => [...agencyKeys.all, "state-metadata", usps ?? "all"] as const,
  stateMetadataList: (usps: string | null) => [...agencyKeys.all, "state-metadata-list", usps ?? "all"] as const,
};

export function useAgencyList(stateUsps: Ref<string | null>) {
  return useQuery({
    queryKey: computed(() => agencyKeys.list(stateUsps.value ?? undefined)),
    queryFn: () =>
      apiClient.get<StateAgency[]>("/agencies", stateUsps.value ? { stateUsps: stateUsps.value } : undefined),
  });
}

export function useAgencyDetail(id: Ref<string>) {
  return useQuery({
    queryKey: computed(() => agencyKeys.detail(id.value)),
    queryFn: () => apiClient.get<StateAgency>(`/agencies/${id.value}`),
    enabled: computed(() => !!id.value),
  });
}

export function useStateMetadata(usps: Ref<string>) {
  return useQuery({
    queryKey: computed(() => agencyKeys.stateMetadata(usps.value)),
    queryFn: () => apiClient.get<unknown>(`/state-metadata/${usps.value}`),
    enabled: computed(() => !!usps.value),
  });
}

export function useStateMetadataList(stateUsps: Ref<string | null>) {
  return useQuery({
    queryKey: computed(() => agencyKeys.stateMetadataList(stateUsps.value)),
    queryFn: () =>
      apiClient.get<unknown[]>("/state-metadata", stateUsps.value ? { stateUsps: stateUsps.value } : undefined),
  });
}

export function useCreateAgency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => apiClient.post<StateAgency>("/agencies", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agencyKeys.all });
    },
  });
}

export function useUpdateAgency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      apiClient.put<StateAgency>(`/agencies/${id}`, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: agencyKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: agencyKeys.all });
    },
  });
}

export function useDeleteAgency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/agencies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agencyKeys.all });
    },
  });
}

export function useCreateStateMetadata() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => apiClient.post<unknown>("/state-metadata", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agencyKeys.all });
    },
  });
}

export function useUpdateStateMetadata() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      apiClient.put<unknown>(`/state-metadata/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agencyKeys.all });
    },
  });
}

export function useDeleteStateMetadata() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/state-metadata/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agencyKeys.all });
    },
  });
}
