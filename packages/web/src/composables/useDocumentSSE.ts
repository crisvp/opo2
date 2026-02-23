import { ref, onMounted, onUnmounted } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { useRoute } from "vue-router";
import { useToast } from "primevue/usetoast";
import { documentKeys } from "../api/queries/documents";
import { profileKeys } from "../api/queries/profile";

export function useDocumentSSE() {
  const queryClient = useQueryClient();
  const route = useRoute();
  const toast = useToast();
  const isConnected = ref(false);
  let eventSource: EventSource | null = null;

  function invalidateAndRefetch(queryKey: readonly unknown[]) {
    queryClient.invalidateQueries({ queryKey });
    queryClient.refetchQueries({ queryKey });
  }

  function connect() {
    if (eventSource) return;
    eventSource = new EventSource("/api/sse", { withCredentials: true });

    eventSource.addEventListener("open", () => {
      isConnected.value = true;
    });

    eventSource.addEventListener("document:updated", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as { id: string };
        invalidateAndRefetch(documentKeys.detail(data.id));
        invalidateAndRefetch(documentKeys.lists());
      } catch {
        // ignore parse errors
      }
    });

    eventSource.addEventListener("document:state_changed", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as { id: string };
        invalidateAndRefetch(documentKeys.detail(data.id));
      } catch {
        // ignore parse errors
      }
    });

    eventSource.addEventListener("document:ready_for_review", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as {
          id: string;
          title: string;
        };
        invalidateAndRefetch(documentKeys.detail(data.id));
        invalidateAndRefetch(documentKeys.myUploads());

        const isOnDocPage =
          route.name === "document-detail" && route.params.id === data.id;
        if (!isOnDocPage) {
          toast.add({
            severity: "info",
            summary: "Document ready for review",
            detail: data.title,
            life: 8000,
          });
        }
      } catch {
        // ignore parse errors
      }
    });

    eventSource.addEventListener("profile:updated", () => {
      invalidateAndRefetch(profileKeys.me());
    });

    eventSource.addEventListener("error", () => {
      isConnected.value = false;
      disconnect();
      // Reconnect after 5 seconds
      setTimeout(() => connect(), 5000);
    });
  }

  function disconnect() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    isConnected.value = false;
  }

  onMounted(() => connect());
  onUnmounted(() => disconnect());

  return { isConnected, connect, disconnect };
}
