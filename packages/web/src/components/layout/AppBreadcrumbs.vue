<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";

const route = useRoute();

const routeTitles: Record<string, string> = {
  home: "Home",
  browse: "Browse",
  "document-detail": "Document",
  "document-edit": "Edit Document",
  "document-ai-review": "AI Review",
  upload: "Upload",
  "my-uploads": "My Uploads",
  login: "Sign In",
  register: "Sign Up",
  "forgot-password": "Forgot Password",
  "reset-password": "Reset Password",
  "two-factor": "Two-Factor Auth",
  profile: "Profile",
  "security-settings": "Security",
  moderation: "Moderation Queue",
  "documentcloud-search": "DocumentCloud",
  locations: "Locations",
  "state-browse": "State",
  "location-overview": "Location",
  "tribal-overview": "Tribal Nation",
  admin: "Admin Dashboard",
  "admin-users": "Users",
  "admin-user-detail": "User Detail",
  "admin-documents": "Documents",
  "admin-catalog": "Catalog",
  "admin-categories": "Document Types",
  "admin-tiers": "Tiers",
  "admin-agencies": "State Agencies",
  "admin-state-metadata": "State Metadata",
  "admin-jobs": "Jobs",
  "not-found": "Not Found",
};

const currentPageTitle = computed(() => {
  const routeName = route.name as string;
  return (route.meta?.title as string) || routeTitles[routeName] || "Page";
});

const isHome = computed(() => route.path === "/");
</script>

<template>
  <div
    v-if="!isHome"
    class="hidden md:flex h-14 border-b border-default items-center px-6 bg-elevated"
  >
    <nav class="flex items-center gap-2 text-sm font-mono">
      <RouterLink to="/" class="text-muted hover:text-primary no-underline">
        Home
      </RouterLink>
      <span class="text-muted">/</span>
      <span class="text-primary font-medium">{{ currentPageTitle }}</span>
    </nav>
  </div>
</template>
