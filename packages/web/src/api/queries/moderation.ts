import { useQuery } from "@tanstack/vue-query";
import { computed } from "vue";
import type { Ref } from "vue";
import type { DocumentListItem, PaginatedResponse } from "@opo/shared";
import { apiClient } from "../client";

export { useApproveDocument, useRejectDocument } from "./documents";

export const moderationKeys = {
  all: ["moderation"] as const,
  queue: (filters: Record<string, unknown>) => [...moderationKeys.all, "queue", filters] as const,
};

export function useModerationQueue(filters: Ref<Record<string, unknown>>) {
  return useQuery({
    queryKey: computed(() => moderationKeys.queue(filters.value)),
    queryFn: () =>
      apiClient.get<PaginatedResponse<DocumentListItem>>("/moderation/queue", {
        ...filters.value as Record<string, string | number | boolean | null | undefined>,
      }),
  });
}
