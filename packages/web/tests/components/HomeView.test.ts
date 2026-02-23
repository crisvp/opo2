import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createWebHistory } from "vue-router";
import { createPinia, setActivePinia } from "pinia";

// Mock authClient before importing stores
vi.mock("../../src/services/authClient.js", () => ({
  authClient: {
    signIn: { email: vi.fn(), passkey: vi.fn() },
    signOut: vi.fn(),
    getSession: vi.fn().mockResolvedValue({ data: null }),
  },
}));

import HomeView from "../../src/views/HomeView.vue";
import { useAuthStore } from "../../src/stores/auth";
import type { AppUser } from "@opo/shared";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: HomeView },
    { path: "/register", component: { template: "<div>Register</div>" } },
    { path: "/login", component: { template: "<div>Login</div>" } },
    { path: "/upload", component: { template: "<div>Upload</div>" } },
    { path: "/browse", component: { template: "<div>Browse</div>" } },
  ],
});

const fakeUser: AppUser = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  role: "user",
  tier: 1,
} as AppUser;

function mountHomeView(authenticated: boolean) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const authStore = useAuthStore();
  authStore.setUser(authenticated ? fakeUser : null);

  return mount(HomeView, {
    global: {
      plugins: [pinia, router],
      stubs: {
        RouterLink: {
          props: ["to"],
          template: `<a :href="to" :data-to="to"><slot /></a>`,
        },
      },
    },
  });
}

describe("HomeView — unauthenticated state", () => {
  it("shows 'Open Panopticon' heading when not authenticated", () => {
    const wrapper = mountHomeView(false);
    expect(wrapper.text()).toContain("Open Panopticon");
  });

  it("shows 'Get Started' register CTA when not authenticated", () => {
    const wrapper = mountHomeView(false);
    const registerCta = wrapper.find("[data-testid='register-cta']");
    expect(registerCta.exists()).toBe(true);
    expect(registerCta.text()).toContain("Get Started");
  });

  it("shows 'Sign In' CTA when not authenticated", () => {
    const wrapper = mountHomeView(false);
    const loginCta = wrapper.find("[data-testid='login-cta']");
    expect(loginCta.exists()).toBe(true);
    expect(loginCta.text()).toContain("Sign In");
  });

  it("does NOT show upload CTA when not authenticated", () => {
    const wrapper = mountHomeView(false);
    const uploadCta = wrapper.find("[data-testid='upload-cta']");
    expect(uploadCta.exists()).toBe(false);
  });
});

describe("HomeView — authenticated state", () => {
  it("shows 'Welcome back' heading when authenticated", () => {
    const wrapper = mountHomeView(true);
    expect(wrapper.text()).toContain("Welcome back");
  });

  it("shows 'Upload Document' CTA when authenticated", () => {
    const wrapper = mountHomeView(true);
    const uploadCta = wrapper.find("[data-testid='upload-cta']");
    expect(uploadCta.exists()).toBe(true);
    expect(uploadCta.text()).toContain("Upload Document");
  });

  it("shows 'Browse Documents' CTA when authenticated", () => {
    const wrapper = mountHomeView(true);
    const browseCta = wrapper.find("[data-testid='browse-cta']");
    expect(browseCta.exists()).toBe(true);
    expect(browseCta.text()).toContain("Browse");
  });

  it("does NOT show 'Get Started' register CTA when authenticated", () => {
    const wrapper = mountHomeView(true);
    const registerCta = wrapper.find("[data-testid='register-cta']");
    expect(registerCta.exists()).toBe(false);
  });
});
