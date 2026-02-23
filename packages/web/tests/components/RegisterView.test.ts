import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createRouter, createWebHistory } from "vue-router";
import { createPinia } from "pinia";

// Mock fetch for ALTCHA challenge
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

// Mock authClient before importing the component
vi.mock("../../src/services/authClient.js", () => ({
  authClient: {
    signUp: {
      email: vi.fn(),
    },
    getSession: vi.fn().mockResolvedValue({ data: null }),
  },
}));

// Mock PrimeVue components
vi.mock("primevue/button", () => ({
  default: {
    name: "Button",
    props: ["label", "loading", "type", "severity"],
    emits: ["click"],
    template: `<button :type="type || 'button'" :disabled="loading" @click="$emit('click')">{{ label }}</button>`,
  },
}));

vi.mock("primevue/inputtext", () => ({
  default: {
    name: "InputText",
    props: ["modelValue", "type", "placeholder", "id", "autocomplete"],
    emits: ["update:modelValue"],
    template: `<input :id="id" :type="type || 'text'" :value="modelValue" :placeholder="placeholder" @input="$emit('update:modelValue', $event.target.value)" />`,
  },
}));

vi.mock("primevue/password", () => ({
  default: {
    name: "Password",
    props: ["modelValue", "feedback", "toggleMask", "placeholder", "id", "autocomplete", "inputClass"],
    emits: ["update:modelValue"],
    template: `<input :id="id" type="password" :value="modelValue" :placeholder="placeholder" @input="$emit('update:modelValue', $event.target.value)" />`,
  },
}));

import RegisterView from "../../src/views/RegisterView.vue";
import { authClient } from "../../src/services/authClient.js";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: { template: "<div>Home</div>" } },
    { path: "/login", component: { template: "<div>Login</div>" } },
    { path: "/register", component: RegisterView },
  ],
});

function mountRegisterView() {
  return mount(RegisterView, {
    global: {
      plugins: [createPinia(), router],
      stubs: {
        RouterLink: {
          template: `<a><slot /></a>`,
        },
        // altcha-widget is a custom element not available in jsdom
        "altcha-widget": true,
      },
    },
  });
}

describe("RegisterView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Create Account heading", () => {
    const wrapper = mountRegisterView();
    expect(wrapper.text()).toContain("Create Account");
  });

  it("renders name, email, and password inputs", () => {
    const wrapper = mountRegisterView();
    const inputs = wrapper.findAll("input");
    expect(inputs.length).toBeGreaterThanOrEqual(3);

    const hasName = inputs.some(
      (i) =>
        i.attributes("id") === "name" ||
        i.attributes("placeholder")?.toLowerCase().includes("name")
    );
    const hasEmail = inputs.some(
      (i) =>
        i.attributes("type") === "email" ||
        i.attributes("placeholder")?.toLowerCase().includes("email")
    );
    const hasPassword = inputs.some((i) => i.attributes("type") === "password");

    expect(hasName).toBe(true);
    expect(hasEmail).toBe(true);
    expect(hasPassword).toBe(true);
  });

  it("renders the submit button", () => {
    const wrapper = mountRegisterView();
    const buttons = wrapper.findAll("button");
    const submitBtn = buttons.find((b) => b.text().includes("Create Account"));
    expect(submitBtn).toBeDefined();
  });

  it("renders a link to /login", () => {
    const wrapper = mountRegisterView();
    expect(wrapper.text()).toContain("Sign in");
  });

  it("calls authClient.signUp.email on form submit", async () => {
    const mockSignUp = vi.mocked(authClient.signUp.email);
    mockSignUp.mockResolvedValueOnce({
      data: null,
      error: { message: "Email already in use", status: 400, statusText: "Bad Request" },
    });

    const wrapper = mountRegisterView();
    const inputs = wrapper.findAll("input");
    const nameInput = inputs.find((i) => i.attributes("id") === "name");
    const emailInput = inputs.find((i) => i.attributes("type") === "email");
    const passwordInput = inputs.find((i) => i.attributes("type") === "password");

    await nameInput!.setValue("Test User");
    await emailInput!.setValue("test@example.com");
    await passwordInput!.setValue("securepassword");

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Test User",
        email: "test@example.com",
        password: "securepassword",
      })
    );
  });

  it("displays an error message on failed registration", async () => {
    const mockSignUp = vi.mocked(authClient.signUp.email);
    mockSignUp.mockResolvedValueOnce({
      data: null,
      error: { message: "Email already in use", status: 400, statusText: "Bad Request" },
    });

    const wrapper = mountRegisterView();
    const inputs = wrapper.findAll("input");
    const nameInput = inputs.find((i) => i.attributes("id") === "name");
    const emailInput = inputs.find((i) => i.attributes("type") === "email");
    const passwordInput = inputs.find((i) => i.attributes("type") === "password");

    await nameInput!.setValue("Test User");
    await emailInput!.setValue("existing@example.com");
    await passwordInput!.setValue("password123");

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("Email already in use");
  });

  it("shows no error message initially", () => {
    const wrapper = mountRegisterView();
    const alert = wrapper.find("[role='alert']");
    if (alert.exists()) {
      expect(alert.text()).toBe("");
    } else {
      expect(alert.exists()).toBe(false);
    }
  });
});
