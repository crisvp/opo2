import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createRouter, createWebHistory } from "vue-router";
import { createPinia } from "pinia";

// Mock authClient before importing the component
vi.mock("../../src/services/authClient.js", () => ({
  authClient: {
    signIn: {
      email: vi.fn(),
      passkey: vi.fn(),
    },
    getSession: vi.fn().mockResolvedValue({ data: null }),
  },
}));

// Mock PrimeVue components
vi.mock("primevue/button", () => ({
  default: {
    name: "Button",
    props: ["label", "loading", "type", "severity", "text", "size"],
    emits: ["click"],
    template: `<button :type="type || 'button'" :disabled="loading" @click="$emit('click')">{{ label }}<slot /></button>`,
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

import LoginView from "../../src/views/LoginView.vue";
import { authClient } from "../../src/services/authClient.js";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: { template: "<div>Home</div>" } },
    { path: "/login", component: LoginView },
    { path: "/register", component: { template: "<div>Register</div>" } },
    { path: "/two-factor", component: { template: "<div>2FA</div>" } },
  ],
});

function mountLoginView() {
  return mount(LoginView, {
    global: {
      plugins: [createPinia(), router],
      stubs: {
        RouterLink: {
          template: `<a><slot /></a>`,
        },
      },
    },
  });
}

describe("LoginView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email and password inputs", () => {
    const wrapper = mountLoginView();
    const inputs = wrapper.findAll("input");
    const types = inputs.map((i) => i.attributes("type") ?? i.attributes("placeholder") ?? "");
    // There should be an email input and a password input
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    const hasEmail = inputs.some(
      (i) => i.attributes("type") === "email" || i.attributes("placeholder")?.toLowerCase().includes("email")
    );
    const hasPassword = inputs.some((i) => i.attributes("type") === "password");
    expect(hasEmail).toBe(true);
    expect(hasPassword).toBe(true);
  });

  it("renders the Sign In heading", () => {
    const wrapper = mountLoginView();
    expect(wrapper.text()).toContain("Sign In");
  });

  it("renders a link to /register", () => {
    const wrapper = mountLoginView();
    expect(wrapper.text()).toContain("Register");
  });

  it("renders the Sign In button", () => {
    const wrapper = mountLoginView();
    const buttons = wrapper.findAll("button");
    const signInBtn = buttons.find((b) => b.text().includes("Sign In"));
    expect(signInBtn).toBeDefined();
  });

  it("renders the passkey sign-in button", () => {
    const wrapper = mountLoginView();
    const buttons = wrapper.findAll("button");
    const passkeyBtn = buttons.find((b) => b.text().toLowerCase().includes("passkey"));
    expect(passkeyBtn).toBeDefined();
  });

  it("calls authClient.signIn.email on form submit", async () => {
    const mockSignIn = vi.mocked(authClient.signIn.email);
    mockSignIn.mockResolvedValueOnce({ data: null, error: { message: "Invalid", status: 401, statusText: "Unauthorized" } });

    const wrapper = mountLoginView();
    const inputs = wrapper.findAll("input");
    const emailInput = inputs.find((i) => i.attributes("type") === "email");
    const passwordInput = inputs.find((i) => i.attributes("type") === "password");

    await emailInput!.setValue("test@example.com");
    await passwordInput!.setValue("password123");

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockSignIn).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    });
  });

  it("displays error message on failed sign in", async () => {
    const mockSignIn = vi.mocked(authClient.signIn.email);
    mockSignIn.mockResolvedValueOnce({
      data: null,
      error: { message: "Invalid credentials", status: 401, statusText: "Unauthorized" },
    });

    const wrapper = mountLoginView();
    const inputs = wrapper.findAll("input");
    const emailInput = inputs.find((i) => i.attributes("type") === "email");
    const passwordInput = inputs.find((i) => i.attributes("type") === "password");

    await emailInput!.setValue("bad@example.com");
    await passwordInput!.setValue("wrongpass");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("Invalid credentials");
  });

  it("shows no error message initially", () => {
    const wrapper = mountLoginView();
    const alert = wrapper.find("[role='alert']");
    // If present, text should be empty
    if (alert.exists()) {
      expect(alert.text()).toBe("");
    } else {
      expect(alert.exists()).toBe(false);
    }
  });
});
