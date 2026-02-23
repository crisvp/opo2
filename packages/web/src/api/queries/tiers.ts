import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";
import type { Ref } from "vue";
import type { Tier } from "@opo/shared";
import { apiClient } from "../client";

export const tierKeys = {
  all: ["tiers"] as const,
  lists: () => [...tierKeys.all, "list"] as const,
  detail: (id: string) => [...tierKeys.all, "detail", id] as const,
};

export function useTierList() {
  return useQuery({
    queryKey: tierKeys.lists(),
    queryFn: () => apiClient.get<Tier[]>("/tiers"),
  });
}

export function useTierDetail(id: Ref<string>) {
  return useQuery({
    queryKey: computed(() => tierKeys.detail(id.value)),
    queryFn: () => apiClient.get<Tier>(`/tiers/${id.value}`),
    enabled: computed(() => !!id.value),
  });
}

export function useCreateTier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => apiClient.post<Tier>("/tiers", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tierKeys.lists() });
    },
  });
}

export function useUpdateTier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      apiClient.put<Tier>(`/tiers/${id}`, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tierKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: tierKeys.lists() });
    },
  });
}

export function useUpdateTierLimits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      apiClient.put<unknown>(`/tiers/${id}/limits`, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tierKeys.detail(variables.id) });
    },
  });
}

export function useDeleteTier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<null>(`/tiers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tierKeys.lists() });
    },
  });
}
