<script setup lang="ts">
import { RouterView } from "vue-router";
import Toast from "primevue/toast";
import ConfirmDialog from "primevue/confirmdialog";
import { useAuthStore } from "./stores/auth";
import { useSidebarState } from "./composables/useSidebarState";
import AppSidebar from "./components/layout/AppSidebar.vue";
import AppMobileHeader from "./components/layout/AppMobileHeader.vue";
import AppBreadcrumbs from "./components/layout/AppBreadcrumbs.vue";
import AppFooter from "./components/layout/AppFooter.vue";

// Restore saved dark mode preference before first render
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
} else if (savedTheme === "light") {
  document.documentElement.classList.remove("dark");
}
// If no saved preference, CSS media query (prefers-color-scheme: dark) handles it

const authStore = useAuthStore();
authStore.init();

const { toggleMobile } = useSidebarState();
</script>

<template>
  <div class="app-layout">
    <Toast />
    <ConfirmDialog />

    <!-- Mobile Header (visible only on small screens) -->
    <AppMobileHeader class="mobile-header" @toggle-sidebar="toggleMobile" />

    <!-- Sidebar -->
    <AppSidebar class="sidebar-area" />

    <!-- Main Content Area -->
    <main class="main-area">
      <AppBreadcrumbs />
      <div class="container mx-auto px-4 py-8">
        <RouterView />
      </div>
      <AppFooter />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: grid;
  grid-template-areas: "sidebar main";
  grid-template-columns: auto 1fr;
  grid-template-rows: 1fr;
  min-height: 100vh;
}

.sidebar-area {
  grid-area: sidebar;
}

.main-area {
  grid-area: main;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  overflow-x: hidden;
}

.main-area > .container {
  flex: 1;
}

@media (max-width: 767px) {
  .app-layout {
    grid-template-areas:
      "header"
      "main";
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .mobile-header {
    grid-area: header;
  }

  .sidebar-area {
    display: contents;
  }

  .main-area {
    min-height: calc(100vh - 3.5rem);
  }
}
</style>
