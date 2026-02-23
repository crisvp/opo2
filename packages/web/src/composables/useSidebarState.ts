import { computed } from "vue";
import { useSidebarStore } from "../stores/sidebar";

export function useSidebarState() {
  const sidebarStore = useSidebarStore();

  const isOpen = computed(() => sidebarStore.isOpen);
  const isMobileOpen = computed(() => sidebarStore.isMobileOpen);

  function toggle() {
    sidebarStore.toggle();
  }

  function toggleMobile() {
    sidebarStore.toggleMobile();
  }

  function closeMobile() {
    sidebarStore.closeMobile();
  }

  return { isOpen, isMobileOpen, toggle, toggleMobile, closeMobile };
}
