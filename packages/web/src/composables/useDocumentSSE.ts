import { ref, onMounted, onUnmounted } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { documentKeys } from "../api/queries/documents";

export function useDocumentSSE() {
  const queryClient = useQueryClient();
  const isConnected = ref(false);
  let eventSource: EventSource | null = null;

  function connect() {
    if (eventSource) return;
    eventSource = new EventSource("/api/sse", { withCredentials: true });

    eventSource.addEventListener("open", () => {
      isConnected.value = true;
    });

    eventSource.addEventListener("document:updated", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as { id: string };
        queryClient.invalidateQueries({ queryKey: documentKeys.detail(data.id) });
        queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      } catch {
        // ignore parse errors
      }
    });

    eventSource.addEventListener("document:state_changed", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as { id: string };
        queryClient.invalidateQueries({ queryKey: documentKeys.detail(data.id) });
      } catch {
        // ignore parse errors
      }
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
