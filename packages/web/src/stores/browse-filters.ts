import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { useRouter, useRoute } from "vue-router";

export const useBrowseFiltersStore = defineStore("browseFilters", () => {
  const router = useRouter();
  const route = useRoute();

  const search = ref("");
  const governmentLevel = ref<string | null>(null);
  const stateUsps = ref<string | null>(null);
  const geoid = ref<string | null>(null);
  const tribeId = ref<string | null>(null);
  const categoryId = ref<string | null>(null);
  const page = ref(1);
  const pageSize = ref(20);

  function syncFromUrl() {
    search.value = (route.query.search as string) ?? "";
    governmentLevel.value = (route.query.governmentLevel as string) ?? null;
    stateUsps.value = (route.query.stateUsps as string) ?? null;
    geoid.value = (route.query.geoid as string) ?? null;
    tribeId.value = (route.query.tribeId as string) ?? null;
    categoryId.value = (route.query.categoryId as string) ?? null;
    page.value = parseInt((route.query.page as string) ?? "1", 10) || 1;
    pageSize.value = parseInt((route.query.pageSize as string) ?? "20", 10) || 20;
  }

  watch([search, governmentLevel, stateUsps, geoid, tribeId, categoryId, page, pageSize], () => {
    const query: Record<string, string> = {};
    if (search.value) query.search = search.value;
    if (governmentLevel.value) query.governmentLevel = governmentLevel.value;
    if (stateUsps.value) query.stateUsps = stateUsps.value;
    if (geoid.value) query.geoid = geoid.value;
    if (tribeId.value) query.tribeId = tribeId.value;
    if (categoryId.value) query.categoryId = categoryId.value;
    if (page.value !== 1) query.page = String(page.value);
    if (pageSize.value !== 20) query.pageSize = String(pageSize.value);
    router.replace({ query });
  });

  function reset() {
    search.value = "";
    governmentLevel.value = null;
    stateUsps.value = null;
    geoid.value = null;
    tribeId.value = null;
    categoryId.value = null;
    page.value = 1;
    pageSize.value = 20;
  }

  return {
    search,
    governmentLevel,
    stateUsps,
    geoid,
    tribeId,
    categoryId,
    page,
    pageSize,
    syncFromUrl,
    reset,
  };
});
