import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";
import type { Ref } from "vue";
import type {
  CatalogEntry,
  CatalogType,
  CatalogAlias,
  AssociationType,
  CatalogEntryAssociation,
  PaginatedResponse,
  CreateCatalogEntryInput,
  UpdateCatalogEntryInput,
  CreateAliasInput,
  CreateCatalogAssociationInput,
} from "@opo/shared";
import { apiClient } from "../client";

export const catalogKeys = {
  all: ["catalog"] as const,
  types: () => [...catalogKeys.all, "types"] as const,
  associationTypes: () => [...catalogKeys.all, "association-types"] as const,
  lists: () => [...catalogKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) => [...catalogKeys.lists(), filters] as const,
  details: () => [...catalogKeys.all, "detail"] as const,
  detail: (id: string) => [...catalogKeys.details(), id] as const,
  search: (q: string, typeId?: string) => [...catalogKeys.all, "search", q, typeId ?? ""] as const,
};

export function useCatalogTypes() {
  return useQuery({
    queryKey: catalogKeys.types(),
    queryFn: () => apiClient.get<CatalogType[]>("/catalog/types"),
  });
}

export function useAssociationTypes() {
  return useQuery({
    queryKey: catalogKeys.associationTypes(),
    queryFn: () => apiClient.get<AssociationType[]>("/association-types"),
  });
}

export function useCatalogList(filters: Ref<Record<string, unknown>>) {
  return useQuery({
    queryKey: computed(() => catalogKeys.list(filters.value)),
    queryFn: () =>
      apiClient.get<PaginatedResponse<CatalogEntry & { typeName: string }>>(
        "/catalog/entries",
        filters.value as Record<string, string | number | boolean | null | undefined>,
      ),
  });
}

export function useCatalogDetail(id: Ref<string>) {
  return useQuery({
    queryKey: computed(() => catalogKeys.detail(id.value)),
    queryFn: () =>
      apiClient.get<
        CatalogEntry & {
          typeName: string;
          aliases: CatalogAlias[];
          associations: { id: string; sourceEntryId: string; targetEntryId: string; associationTypeId: string; createdAt: string }[];
        }
      >(`/catalog/entries/${id.value}`),
    enabled: computed(() => !!id.value),
  });
}

export function useCatalogSearch(q: Ref<string>, typeId?: Ref<string | undefined>) {
  return useQuery({
    queryKey: computed(() => catalogKeys.search(q.value, typeId?.value)),
    queryFn: () =>
      apiClient.get<{ id: string; name: string; typeId: string; typeName: string; similarity: number }[]>(
        "/catalog/search",
        { q: q.value, ...(typeId?.value ? { typeId: typeId.value } : {}) },
      ),
    enabled: computed(() => q.value.length >= 2),
  });
}

export function useCreateCatalogEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCatalogEntryInput) =>
      apiClient.post<CatalogEntry & { typeName: string }>("/catalog/entries", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.lists() });
    },
  });
}

export function useUpdateCatalogEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateCatalogEntryInput) =>
      apiClient.put<CatalogEntry & { typeName: string }>(`/catalog/entries/${id}`, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: catalogKeys.lists() });
    },
  });
}

export function useDeleteCatalogEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/catalog/entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.all });
    },
  });
}

export function useAddCatalogAlias() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, ...body }: { entryId: string } & CreateAliasInput) =>
      apiClient.post<CatalogAlias>(`/catalog/entries/${entryId}/aliases`, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.detail(variables.entryId) });
    },
  });
}

export function useDeleteCatalogAlias() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ aliasId, entryId }: { aliasId: string; entryId: string }) =>
      apiClient.delete<void>(`/catalog/aliases/${aliasId}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.detail(variables.entryId) });
    },
  });
}

export function useCreateCatalogAssociation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, ...body }: { entryId: string } & CreateCatalogAssociationInput) =>
      apiClient.post<CatalogEntryAssociation>(`/catalog/entries/${entryId}/associations`, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.detail(variables.entryId) });
    },
  });
}

export function useDeleteCatalogAssociation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assocId }: { assocId: string; entryId: string }) =>
      apiClient.delete<void>(`/catalog/associations/${assocId}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.detail(variables.entryId) });
    },
  });
}
