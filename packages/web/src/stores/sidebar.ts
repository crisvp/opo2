import { defineStore } from "pinia";
import { ref } from "vue";

export const useSidebarStore = defineStore("sidebar", () => {
  const isOpen = ref(true);
  const isMobileOpen = ref(false);

  function toggle() {
    isOpen.value = !isOpen.value;
  }

  function toggleMobile() {
    isMobileOpen.value = !isMobileOpen.value;
  }

  function closeMobile() {
    isMobileOpen.value = false;
  }

  return { isOpen, isMobileOpen, toggle, toggleMobile, closeMobile };
});
