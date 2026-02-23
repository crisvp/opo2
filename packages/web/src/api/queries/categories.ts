import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";
import type { Ref } from "vue";
import type { DocumentCategoryRecord, MetadataFieldDefinition } from "@opo/shared";
import { apiClient } from "../client";

export const categoryKeys = {
  all: ["categories"] as const,
  lists: () => [...categoryKeys.all, "list"] as const,
  details: () => [...categoryKeys.all, "detail"] as const,
  detail: (id: string) => [...categoryKeys.details(), id] as const,
  fields: (categoryId: string) => [...categoryKeys.detail(categoryId), "fields"] as const,
  rules: (categoryId: string) => [...categoryKeys.detail(categoryId), "rules"] as const,
};

export const policyTypeKeys = {
  all: ["policy-types"] as const,
  lists: () => [...policyTypeKeys.all, "list"] as const,
};

export interface PolicyTypeRecord {
  id: string;
  name: string;
  createdAt: string;
}

export function useCategoryList() {
  return useQuery({
    queryKey: categoryKeys.lists(),
    queryFn: () => apiClient.get<DocumentCategoryRecord[]>("/categories"),
  });
}

export function useCategoryDetail(id: Ref<string>) {
  return useQuery({
    queryKey: computed(() => categoryKeys.detail(id.value)),
    queryFn: () => apiClient.get<DocumentCategoryRecord>(`/categories/${id.value}`),
    enabled: computed(() => !!id.value),
  });
}

export function useCategoryFields(categoryId: Ref<string>) {
  return useQuery({
    queryKey: computed(() => categoryKeys.fields(categoryId.value)),
    queryFn: () => apiClient.get<MetadataFieldDefinition[]>(`/categories/${categoryId.value}/fields`),
    enabled: computed(() => !!categoryId.value),
  });
}

export function useCategoryRules(categoryId: Ref<string>) {
  return useQuery({
    queryKey: computed(() => categoryKeys.rules(categoryId.value)),
    queryFn: () => apiClient.get<DocumentCategoryRecord>(`/categories/${categoryId.value}`),
    enabled: computed(() => !!categoryId.value),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => apiClient.post<DocumentCategoryRecord>("/categories", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      apiClient.put<DocumentCategoryRecord>(`/categories/${id}`, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<{ success: boolean }>(`/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
}

export function useCreateFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, ...body }: { categoryId: string } & Record<string, unknown>) =>
      apiClient.post<MetadataFieldDefinition>(`/categories/${categoryId}/fields`, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.fields(variables.categoryId) });
    },
  });
}

export function useUpdateFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, categoryId, ...body }: { id: string; categoryId: string } & Record<string, unknown>) =>
      apiClient.put<MetadataFieldDefinition>(`/field-definitions/${id}`, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.fields(variables.categoryId) });
    },
  });
}

export function useDeleteFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string }) =>
      apiClient.delete<{ success: boolean }>(`/field-definitions/${id}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.fields(variables.categoryId) });
    },
  });
}

export function useUpdateCategoryRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      apiClient.put<DocumentCategoryRecord>(`/categories/${id}/rules`, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
}

export function usePolicyTypeList() {
  return useQuery({
    queryKey: policyTypeKeys.lists(),
    queryFn: () => apiClient.get<PolicyTypeRecord[]>("/policy-types"),
  });
}

export function useCreatePolicyType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) => apiClient.post<PolicyTypeRecord>("/policy-types", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: policyTypeKeys.lists() });
    },
  });
}

export function useDeletePolicyType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<{ success: boolean }>(`/policy-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: policyTypeKeys.lists() });
    },
  });
}
