import { ref } from "vue";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

const breadcrumbs = ref<BreadcrumbItem[]>([]);

export function useBreadcrumb() {
  function set(items: BreadcrumbItem[]) {
    breadcrumbs.value = items;
  }

  return { breadcrumbs, set };
}
