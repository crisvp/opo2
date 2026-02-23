<script setup lang="ts">
import { ref } from "vue";
import { RouterLink } from "vue-router";
import Button from "primevue/button";
import AppLogo from "./AppLogo.vue";

defineEmits<{
  toggleSidebar: [];
}>();

const isDark = ref(document.documentElement.classList.contains("dark"));

function toggleDarkMode() {
  isDark.value = !isDark.value;
  document.documentElement.classList.toggle("dark", isDark.value);
  localStorage.setItem("theme", isDark.value ? "dark" : "light");
}
</script>

<template>
  <header
    class="md:hidden bg-elevated border-b border-default h-14 flex items-center px-3 sticky top-0 z-40"
  >
    <Button
      icon="pi pi-bars"
      severity="secondary"
      text
      rounded
      @click="$emit('toggleSidebar')"
      aria-label="Toggle menu"
    />

    <RouterLink
      to="/"
      class="flex items-center gap-2 ml-2 text-primary no-underline"
    >
      <AppLogo :size="28" />
      <span class="font-bold">Open Panopticon</span>
    </RouterLink>

    <div class="ml-auto">
      <Button
        :icon="isDark ? 'pi pi-sun' : 'pi pi-moon'"
        severity="secondary"
        text
        rounded
        @click="toggleDarkMode"
        :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
      />
    </div>
  </header>
</template>
