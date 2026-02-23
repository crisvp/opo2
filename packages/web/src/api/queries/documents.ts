import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";
import type { Ref } from "vue";
import type { Document, DocumentDetail, DocumentListItem, PaginatedResponse, ImportFromDcInput } from "@opo/shared";
import { apiClient } from "../client";

export const documentKeys = {
  all: ["documents"] as const,
  lists: () => [...documentKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) => [...documentKeys.lists(), filters] as const,
  details: () => [...documentKeys.all, "detail"] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
  myUploads: () => [...documentKeys.all, "my-uploads"] as const,
  aiMetadata: (id: string) => [...documentKeys.details(), id, "ai-metadata"] as const,
  relatedPending: (id: string) => [...documentKeys.details(), id, "related-pending"] as const,
};

export function useDocumentList(filters: Ref<Record<string, unknown>>) {
  return useQuery({
    queryKey: computed(() => documentKeys.list(filters.value)),
    queryFn: () =>
      apiClient.get<PaginatedResponse<DocumentListItem>>(
        "/documents",
        filters.value as Record<string, string | number | boolean | null | undefined>,
      ),
  });
}

export function useMyUploads() {
  return useQuery({
    queryKey: documentKeys.myUploads(),
    queryFn: () => apiClient.get<{ items: DocumentListItem[] }>("/documents/my-uploads"),
  });
}

export function useDocumentDetail(id: Ref<string>) {
  return useQuery({
    queryKey: computed(() => documentKeys.detail(id.value)),
    queryFn: () => apiClient.get<DocumentDetail>(`/documents/${id.value}`),
    enabled: computed(() => !!id.value),
  });
}

export function useDocumentAiMetadata(id: Ref<string>) {
  return useQuery({
    queryKey: computed(() => documentKeys.aiMetadata(id.value)),
    queryFn: () => apiClient.get<unknown>(`/documents/${id.value}/ai-metadata`),
    enabled: computed(() => !!id.value),
  });
}

export function useInitiateUpload() {
  return useMutation({
    mutationFn: (input: {
      title: string;
      filename: string;
      mimetype: string;
      size: number;
      description?: string;
      documentDate?: string;
      governmentLevel?: string;
      stateUsps?: string;
      placeGeoid?: string;
      tribeId?: string;
      category?: string;
      tags?: string[];
      saveAsDraft?: boolean;
      useAi?: boolean;
    }) =>
      apiClient.post<{
        documentId: string;
        presignedUrl: string;
        presignedFields: Record<string, string>;
        objectKey: string;
      }>("/documents/initiate", input),
  });
}

export function useConfirmUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, saveAsDraft }: { id: string; saveAsDraft?: boolean }) =>
      apiClient.post<{ id: string; state: string }>(`/documents/${id}/confirm-upload`, {
        saveAsDraft,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
    },
  });
}

export function useSubmitDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ id: string; state: string }>(`/documents/${id}/submit`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: documentKeys.myUploads() });
    },
  });
}

export function useSyncTags() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tags }: { id: string; tags: string[] }) =>
      apiClient.post<void>(`/documents/${id}/tags`, { tags }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(variables.id) });
    },
  });
}

export function useAddTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tag }: { id: string; tag: string }) =>
      apiClient.post<void>(`/documents/${id}/tags/add`, { tag }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(variables.id) });
    },
  });
}

export function useRemoveTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tag }: { id: string; tag: string }) =>
      apiClient.delete<void>(`/documents/${id}/tags/${encodeURIComponent(tag)}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(variables.id) });
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      title?: string;
      description?: string | null;
      documentDate?: string | null;
      category?: string | null;
    }) => apiClient.put<Document>(`/documents/${id}`, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(variables.id) });
    },
  });
}

export function useUpdateDocumentLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      governmentLevel: string | null;
      stateUsps: string | null;
      placeGeoid: string | null;
      tribeId: string | null;
    }) => apiClient.put<void>(`/documents/${id}/location`, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(variables.id) });
    },
  });
}

export function useApproveDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<{ state: string }>(`/documents/${id}/approve`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}

export function useRejectDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post<{ state: string }>(`/documents/${id}/reject`, { reason }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}

export function useSubmitForModeration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ id: string; state: string }>(`/documents/${id}/submit-for-moderation`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: documentKeys.myUploads() });
    },
  });
}

export function useRetryExtraction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<void>(`/documents/${id}/retry-extraction`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: documentKeys.myUploads() });
    },
  });
}

export function useSyncAssociations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      associations,
    }: {
      id: string;
      associations: Array<{
        catalogEntryId: string;
        associationTypeId?: string;
        role?: string;
        context?: string;
      }>;
    }) => apiClient.post<void>(`/documents/${id}/associations`, { associations }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(variables.id) });
    },
  });
}

export function useImportFromDc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ImportFromDcInput) =>
      apiClient.post<{ documentId: string }>("/documents/import-from-dc", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
    },
  });
}

export function useSaveDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<{ success: boolean }>(`/documents/${id}/save-draft`, {}),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: documentKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: documentKeys.myUploads() });
    },
  });
}

export function useDocumentReopen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<{ id: string; state: string }>(`/documents/${id}/reopen`, {}),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: documentKeys.myUploads() });
    },
  });
}
