import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // Public
    {
      path: "/",
      name: "home",
      component: () => import("../views/HomeView.vue"),
    },
    {
      path: "/login",
      name: "login",
      component: () => import("../views/LoginView.vue"),
      meta: { public: true },
    },
    {
      path: "/register",
      name: "register",
      component: () => import("../views/RegisterView.vue"),
      meta: { public: true },
    },
    {
      path: "/two-factor",
      name: "two-factor",
      component: () => import("../views/TwoFactorView.vue"),
      meta: { public: true },
    },
    {
      path: "/forgot-password",
      name: "forgot-password",
      component: () => import("../views/ForgotPasswordView.vue"),
      meta: { public: true },
    },
    {
      path: "/reset-password",
      name: "reset-password",
      component: () => import("../views/ResetPasswordView.vue"),
      meta: { public: true },
    },

    // Browse & Documents
    {
      path: "/browse",
      name: "browse",
      component: () => import("../views/BrowseView.vue"),
    },
    {
      path: "/documents/:id",
      name: "document-detail",
      component: () => import("../views/DocumentDetailView.vue"),
    },
    {
      path: "/documents/:id/edit",
      name: "document-edit",
      component: () => import("../views/DocumentEditView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/documents/:id/ai-review",
      name: "document-ai-review",
      component: () => import("../views/AiReviewView.vue"),
      meta: { requiresAuth: true },
    },

    // Upload & My Uploads
    {
      path: "/upload",
      name: "upload",
      component: () => import("../views/UploadView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/my-uploads",
      name: "my-uploads",
      component: () => import("../views/MyUploadsView.vue"),
      meta: { requiresAuth: true },
    },

    // Locations
    {
      path: "/locations",
      component: () => import("../views/locations/LocationsLayoutView.vue"),
      children: [
        {
          path: "",
          redirect: "/locations/states",
        },
        {
          path: "states",
          name: "locations-states",
          component: () => import("../views/locations/StatesTabView.vue"),
        },
        {
          path: "tribes",
          name: "locations-tribes",
          component: () => import("../views/locations/TribesTabView.vue"),
        },
      ],
    },
    {
      path: "/locations/states/:usps",
      name: "state-browse",
      component: () => import("../views/locations/StateBrowseView.vue"),
    },
    {
      path: "/locations/places/:geoid",
      name: "location-overview",
      component: () => import("../views/locations/LocationOverviewView.vue"),
    },
    {
      path: "/locations/tribes/:tribeId",
      name: "tribal-overview",
      component: () => import("../views/locations/TribalOverviewView.vue"),
    },

    // Profile & Settings
    {
      path: "/profile",
      name: "profile",
      component: () => import("../views/ProfileView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/profile/security",
      name: "security-settings",
      component: () => import("../views/SecuritySettingsView.vue"),
      meta: { requiresAuth: true },
    },

    // Moderation
    {
      path: "/moderation",
      name: "moderation",
      component: () => import("../views/ModerationView.vue"),
      meta: { requiresAuth: true, requiresRole: "moderator" },
    },

    // DocumentCloud
    {
      path: "/documentcloud",
      name: "documentcloud-search",
      component: () => import("../views/DocumentCloudSearchView.vue"),
      meta: { requiresAuth: true, requiresRole: "moderator" },
    },

    // Admin
    {
      path: "/admin",
      name: "admin",
      component: () => import("../views/admin/AdminView.vue"),
      meta: { requiresAuth: true, requiresRole: "admin" },
    },
    {
      path: "/admin/users",
      name: "admin-users",
      component: () => import("../views/admin/AdminUsersView.vue"),
      meta: { requiresAuth: true, requiresRole: "admin" },
    },
    {
      path: "/admin/users/:id",
      name: "admin-user-detail",
      component: () => import("../views/admin/AdminUserDetailView.vue"),
      meta: { requiresAuth: true, requiresRole: "admin" },
    },
    {
      path: "/admin/documents",
      name: "admin-documents",
      component: () => import("../views/admin/AdminDocumentsView.vue"),
      meta: { requiresAuth: true, requiresRole: "admin" },
    },
    {
      path: "/admin/catalog",
      name: "admin-catalog",
      component: () => import("../views/admin/CatalogManageView.vue"),
      meta: { requiresAuth: true, requiresRole: "moderator" },
    },
    {
      path: "/admin/categories",
      name: "admin-categories",
      component: () => import("../views/admin/DocumentTypesManageView.vue"),
      meta: { requiresAuth: true, requiresRole: "admin" },
    },
    {
      path: "/admin/tiers",
      name: "admin-tiers",
      component: () => import("../views/admin/TierManageView.vue"),
      meta: { requiresAuth: true, requiresRole: "admin" },
    },
    {
      path: "/admin/agencies",
      name: "admin-agencies",
      component: () => import("../views/admin/AdminAgenciesView.vue"),
      meta: { requiresAuth: true, requiresRole: "admin" },
    },
    {
      path: "/admin/state-metadata",
      name: "admin-state-metadata",
      component: () => import("../views/admin/AdminStateMetadataView.vue"),
      meta: { requiresAuth: true, requiresRole: "admin" },
    },
    {
      path: "/admin/jobs",
      name: "admin-jobs",
      component: () => import("../views/admin/JobsOverviewView.vue"),
      meta: { requiresAuth: true, requiresRole: "admin" },
    },

    // 404
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: () => import("../views/NotFoundView.vue"),
    },
  ],
});

// Navigation guard
router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  if (!authStore.initialized) {
    await authStore.init();
  }

  if (to.meta.requiresAuth && !authStore.user) {
    return { name: "login", query: { redirect: to.fullPath } };
  }

  if (to.meta.requiresRole) {
    const role = to.meta.requiresRole as string;
    if (!authStore.user || !authStore.hasRole(role)) {
      return { name: "home" };
    }
  }
});

export { router };
