<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import Button from "primevue/button";
import Drawer from "primevue/drawer";
import Badge from "primevue/badge";
import { useAuthStore } from "../../stores/auth";
import { useSidebarState } from "../../composables/useSidebarState";
import { ROLES, hasRole } from "@opo/shared";
import AppLogo from "./AppLogo.vue";
import { useUserReviewCount } from "../../composables/useUserReviewCount";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { isOpen, isMobileOpen, toggle, closeMobile } = useSidebarState();
const { count: userReviewCount } = useUserReviewCount();

// Dark mode: simple toggle using localStorage + class on documentElement
const isDark = ref(document.documentElement.classList.contains("dark"));
function toggleDark() {
  isDark.value = !isDark.value;
  document.documentElement.classList.toggle("dark", isDark.value);
  localStorage.setItem("theme", isDark.value ? "dark" : "light");
}

const isModerator = computed(() => {
  if (!authStore.user) return false;
  return hasRole(
    authStore.user.role as "user" | "moderator" | "admin",
    ROLES.MODERATOR,
  );
});

const isAdmin = computed(() => {
  if (!authStore.user) return false;
  return hasRole(
    authStore.user.role as "user" | "moderator" | "admin",
    ROLES.ADMIN,
  );
});

const userInitials = computed(() => {
  const name = authStore.user?.name || authStore.user?.email || "";
  return name.substring(0, 2).toUpperCase();
});

interface NavItem {
  label: string;
  icon: string;
  to: string;
  badge?: string | null;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections = computed<NavSection[]>(() => {
  const sections: NavSection[] = [
    {
      label: "Main",
      items: [
        { label: "Home", icon: "pi-home", to: "/" },
        { label: "Browse Locations", icon: "pi-map-marker", to: "/locations" },
        { label: "Documents", icon: "pi-search", to: "/browse" },
        ...(authStore.isAuthenticated
          ? [{ label: "Upload", icon: "pi-upload", to: "/upload" }]
          : []),
      ],
    },
  ];

  if (authStore.isAuthenticated) {
    sections.push({
      label: "My Account",
      items: [
        { label: "My Uploads", icon: "pi-folder", to: "/my-uploads", badge: userReviewCount.value > 0 ? String(userReviewCount.value) : null },
        { label: "Profile", icon: "pi-user", to: "/profile" },
        { label: "Security", icon: "pi-shield", to: "/profile/security" },
      ],
    });
  }

  if (isModerator.value) {
    sections.push({
      label: "Moderation",
      items: [
        { label: "Queue", icon: "pi-check-square", to: "/moderation" },
        { label: "DocumentCloud", icon: "pi-cloud", to: "/documentcloud" },
        { label: "Catalog", icon: "pi-sitemap", to: "/admin/catalog" },
        {
          label: "Document Types",
          icon: "pi-folder",
          to: "/admin/categories",
        },
        {
          label: "State Agencies",
          icon: "pi-building",
          to: "/admin/agencies",
        },
        {
          label: "State Metadata",
          icon: "pi-list",
          to: "/admin/state-metadata",
        },
      ],
    });
  }

  if (isAdmin.value) {
    sections.push({
      label: "Admin",
      items: [
        { label: "Dashboard", icon: "pi-cog", to: "/admin" },
        { label: "Users", icon: "pi-users", to: "/admin/users" },
        { label: "Documents", icon: "pi-file", to: "/admin/documents" },
        { label: "Tiers", icon: "pi-star", to: "/admin/tiers" },
        { label: "Jobs", icon: "pi-sync", to: "/admin/jobs" },
      ],
    });
  }

  return sections;
});

function isActive(to: string) {
  if (to === "/" || to === "/admin") {
    return route.path === to;
  }
  return route.path.startsWith(to);
}

async function handleSignOut() {
  await authStore.signOut();
  router.push("/");
  closeMobile();
}

function handleNavClick() {
  closeMobile();
}
</script>

<template>
  <div>
    <!-- Desktop Sidebar -->
    <aside
      class="hidden md:flex flex-col bg-surface-subtle border-r border-default transition-all duration-200 h-screen sticky top-0"
      :class="isOpen ? 'w-60' : 'w-16'"
    >
      <!-- Logo & Collapse Toggle -->
      <div class="flex items-center h-14 px-3 border-b border-default">
        <RouterLink
          to="/"
          class="flex items-center gap-2 text-primary no-underline overflow-hidden"
        >
          <AppLogo :size="28" class="shrink-0" />
          <span
            v-if="isOpen"
            class="font-bold whitespace-nowrap overflow-hidden text-sm"
          >
            Open Panopticon
          </span>
        </RouterLink>
        <Button
          :icon="isOpen ? 'pi pi-angle-left' : 'pi pi-angle-right'"
          severity="secondary"
          text
          rounded
          size="small"
          class="ml-auto shrink-0"
          @click="toggle"
          aria-label="Toggle sidebar"
        />
      </div>

      <!-- Navigation -->
      <nav class="flex-1 overflow-y-auto py-2">
        <div v-for="section in navSections" :key="section.label" class="mb-2">
          <div
            v-if="isOpen"
            class="px-4 py-2 text-xs font-bold text-muted uppercase tracking-widest"
          >
            {{ section.label }}
          </div>
          <div v-else class="h-px bg-default mx-2 my-2"></div>

          <RouterLink
            v-for="item in section.items"
            :key="item.to"
            :to="item.to"
            v-tooltip.right="!isOpen ? item.label : undefined"
            class="flex items-center gap-3 mx-2 px-3 py-2 text-secondary no-underline transition-colors border-l-4 border-transparent rounded"
            :class="[
              isActive(item.to)
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'hover:bg-sunken hover:text-primary',
              !isOpen ? 'justify-center' : '',
            ]"
          >
            <i :class="['pi', item.icon, 'text-base']" class="relative">
              <Badge
                v-if="item.badge && !isOpen"
                :value="item.badge"
                severity="danger"
                class="absolute -top-2 -right-2 text-[10px] min-w-4 h-4"
              />
            </i>
            <span v-if="isOpen" class="text-sm flex-1">{{ item.label }}</span>
            <Badge
              v-if="item.badge && isOpen"
              :value="item.badge"
              severity="danger"
              class="text-[10px] min-w-5 h-5"
            />
          </RouterLink>
        </div>
      </nav>

      <!-- Footer: Dark Mode + User -->
      <div class="border-t border-default p-2">
        <button
          v-tooltip.right="!isOpen ? (isDark ? 'Light mode' : 'Dark mode') : undefined"
          class="flex items-center gap-3 w-full px-3 py-2 text-secondary hover:bg-sunken hover:text-primary transition-colors border-l-4 border-transparent rounded"
          :class="!isOpen ? 'justify-center' : ''"
          @click="toggleDark"
        >
          <i :class="['pi', isDark ? 'pi-sun' : 'pi-moon', 'text-base']"></i>
          <span v-if="isOpen" class="text-sm">{{
            isDark ? "Light Mode" : "Dark Mode"
          }}</span>
        </button>

        <template v-if="authStore.isAuthenticated">
          <div
            class="flex items-center gap-3 px-2 py-2 mt-1"
            :class="!isOpen ? 'justify-center' : ''"
          >
            <div
              class="w-8 h-8 rounded-full bg-interactive text-inverted flex items-center justify-center text-xs font-medium shrink-0"
            >
              {{ userInitials }}
            </div>
            <div v-if="isOpen" class="flex-1 min-w-0">
              <div class="text-sm font-medium text-primary truncate">
                {{ authStore.user?.name || "User" }}
              </div>
              <div class="text-xs text-muted truncate font-mono">
                {{ authStore.user?.email }}
              </div>
            </div>
          </div>
          <button
            v-tooltip.right="!isOpen ? 'Sign out' : undefined"
            class="flex items-center gap-3 w-full px-3 py-2 text-secondary hover:bg-sunken hover:text-primary transition-colors border-l-4 border-transparent rounded"
            :class="!isOpen ? 'justify-center' : ''"
            @click="handleSignOut"
          >
            <i class="pi pi-sign-out text-base"></i>
            <span v-if="isOpen" class="text-sm">Sign Out</span>
          </button>
        </template>

        <template v-else>
          <RouterLink
            to="/login"
            v-tooltip.right="!isOpen ? 'Sign in' : undefined"
            class="flex items-center gap-3 w-full px-3 py-2 text-secondary no-underline hover:bg-sunken hover:text-primary transition-colors border-l-4 border-transparent rounded"
            :class="!isOpen ? 'justify-center' : ''"
          >
            <i class="pi pi-sign-in text-base"></i>
            <span v-if="isOpen" class="text-sm">Sign In</span>
          </RouterLink>
          <RouterLink
            to="/register"
            v-tooltip.right="!isOpen ? 'Sign up' : undefined"
            class="flex items-center gap-3 w-full px-3 py-2 mt-1 bg-interactive text-inverted no-underline hover:opacity-90 transition-opacity border-l-4 border-transparent rounded"
            :class="!isOpen ? 'justify-center' : ''"
          >
            <i class="pi pi-user-plus text-base"></i>
            <span v-if="isOpen" class="text-sm">Sign Up</span>
          </RouterLink>
        </template>
      </div>
    </aside>

    <!-- Mobile Sidebar (Drawer) -->
    <Drawer
      :visible="isMobileOpen"
      @update:visible="(v) => { if (!v) closeMobile(); }"
      position="left"
      class="md:hidden"
      :pt="{
        root: { class: 'w-64' },
        header: { class: 'border-b border-default px-3 py-2' },
        content: { class: 'p-0' },
      }"
    >
      <template #header>
        <RouterLink
          to="/"
          class="flex items-center gap-2 text-primary no-underline"
          @click="handleNavClick"
        >
          <AppLogo :size="28" />
          <span class="font-bold">Open Panopticon</span>
        </RouterLink>
      </template>

      <nav class="py-2">
        <div v-for="section in navSections" :key="section.label" class="mb-2">
          <div
            class="px-4 py-2 text-xs font-bold text-muted uppercase tracking-widest"
          >
            {{ section.label }}
          </div>

          <RouterLink
            v-for="item in section.items"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 mx-2 px-3 py-2 text-secondary no-underline transition-colors border-l-4 border-transparent rounded"
            :class="
              isActive(item.to)
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'hover:bg-sunken hover:text-primary'
            "
            @click="handleNavClick"
          >
            <i :class="['pi', item.icon, 'text-base']"></i>
            <span class="text-sm flex-1">{{ item.label }}</span>
            <Badge
              v-if="item.badge"
              :value="item.badge"
              severity="danger"
              class="text-[10px] min-w-5 h-5"
            />
          </RouterLink>
        </div>
      </nav>

      <!-- Mobile Footer -->
      <div class="border-t border-default p-2 mt-auto">
        <button
          class="flex items-center gap-3 w-full px-3 py-2 text-secondary hover:bg-sunken hover:text-primary transition-colors border-l-4 border-transparent rounded"
          @click="toggleDark"
        >
          <i :class="['pi', isDark ? 'pi-sun' : 'pi-moon', 'text-base']"></i>
          <span class="text-sm">{{ isDark ? "Light Mode" : "Dark Mode" }}</span>
        </button>

        <template v-if="authStore.isAuthenticated">
          <div class="flex items-center gap-3 px-3 py-2 mt-1">
            <div
              class="w-8 h-8 rounded-full bg-interactive text-inverted flex items-center justify-center text-xs font-medium"
            >
              {{ userInitials }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-primary truncate">
                {{ authStore.user?.name || "User" }}
              </div>
              <div class="text-xs text-muted truncate font-mono">
                {{ authStore.user?.email }}
              </div>
            </div>
          </div>
          <button
            class="flex items-center gap-3 w-full px-3 py-2 text-secondary hover:bg-sunken hover:text-primary transition-colors border-l-4 border-transparent rounded"
            @click="handleSignOut"
          >
            <i class="pi pi-sign-out text-base"></i>
            <span class="text-sm">Sign Out</span>
          </button>
        </template>

        <template v-else>
          <RouterLink
            to="/login"
            class="flex items-center gap-3 w-full px-3 py-2 text-secondary no-underline hover:bg-sunken hover:text-primary transition-colors border-l-4 border-transparent rounded"
            @click="handleNavClick"
          >
            <i class="pi pi-sign-in text-base"></i>
            <span class="text-sm">Sign In</span>
          </RouterLink>
          <RouterLink
            to="/register"
            class="flex items-center gap-3 w-full px-3 py-2 mt-1 bg-interactive text-inverted no-underline hover:opacity-90 transition-opacity border-l-4 border-transparent rounded"
            @click="handleNavClick"
          >
            <i class="pi pi-user-plus text-base"></i>
            <span class="text-sm">Sign Up</span>
          </RouterLink>
        </template>
      </div>
    </Drawer>
  </div>
</template>
