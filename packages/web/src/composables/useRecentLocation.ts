import { ref } from "vue";
import type { locationInputSchema } from "@opo/shared";
import type { z } from "zod";

type LocationInput = z.infer<typeof locationInputSchema>;

const STORAGE_KEY = "opo:recent-location";

export function useRecentLocation() {
  const recentLocation = ref<LocationInput | null>(null);

  function load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        recentLocation.value = JSON.parse(stored) as LocationInput;
      }
    } catch {
      recentLocation.value = null;
    }
  }

  function save(location: LocationInput) {
    recentLocation.value = location;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
    } catch {
      // ignore storage errors
    }
  }

  function clear() {
    recentLocation.value = null;
    localStorage.removeItem(STORAGE_KEY);
  }

  load();

  return { recentLocation, save, clear };
}
