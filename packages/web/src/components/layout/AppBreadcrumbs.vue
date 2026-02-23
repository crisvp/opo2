<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useBreadcrumb } from "../../composables/useBreadcrumb";

const route = useRoute();
const { breadcrumbs } = useBreadcrumb();

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
  "locations-states": "Locations",
  "locations-tribes": "Locations",
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

const isHome = computed(() => route.path === "/");

// Use dynamic breadcrumbs if a view has set them, otherwise fall back to single-segment
const items = computed(() => {
  if (breadcrumbs.value.length > 0) return breadcrumbs.value;
  const routeName = route.name as string;
  const title = (route.meta?.title as string) || routeTitles[routeName] || "Page";
  return [{ label: title }];
});
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
      <template v-for="(item, i) in items" :key="i">
        <span class="text-muted">/</span>
        <RouterLink
          v-if="item.to"
          :to="item.to"
          class="text-muted hover:text-primary no-underline"
        >
          {{ item.label }}
        </RouterLink>
        <span v-else class="text-primary font-medium">{{ item.label }}</span>
      </template>
    </nav>
  </div>
</template>
