import { computed } from "vue";
import { useMyUploads } from "../api/queries/documents";

export function useUserReviewCount() {
  const { data } = useMyUploads();

  const count = computed(() => {
    if (!data.value) return 0;
    return data.value.items.filter((d) => d.state === "user_review").length;
  });

  return { count };
}
