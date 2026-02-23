import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createRouter, createWebHistory } from "vue-router";
import { createPinia } from "pinia";

// Mock authClient before importing the component
vi.mock("../../src/services/authClient.js", () => ({
  authClient: {
    twoFactor: {
      verifyTotp: vi.fn(),
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
    props: ["modelValue", "type", "placeholder", "id", "autocomplete", "inputmode", "pattern", "maxlength"],
    emits: ["update:modelValue"],
    template: `<input :id="id" :type="type || 'text'" :value="modelValue" :placeholder="placeholder" @input="$emit('update:modelValue', $event.target.value)" />`,
  },
}));

import TwoFactorView from "../../src/views/TwoFactorView.vue";
import { authClient } from "../../src/services/authClient.js";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: { template: "<div>Home</div>" } },
    { path: "/two-factor", component: TwoFactorView },
  ],
});

function mountTwoFactorView() {
  return mount(TwoFactorView, {
    global: {
      plugins: [createPinia(), router],
    },
  });
}

describe("TwoFactorView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Two-Factor Authentication heading", () => {
    const wrapper = mountTwoFactorView();
    expect(wrapper.text()).toContain("Two-Factor Authentication");
  });

  it("renders the verification code input", () => {
    const wrapper = mountTwoFactorView();
    const input = wrapper.find("input#code");
    expect(input.exists()).toBe(true);
    expect(input.attributes("placeholder")).toBe("000000");
  });

  it("renders the Verify button", () => {
    const wrapper = mountTwoFactorView();
    const buttons = wrapper.findAll("button");
    const verifyBtn = buttons.find((b) => b.text().includes("Verify"));
    expect(verifyBtn).toBeDefined();
  });

  it("shows validation error for code shorter than 6 digits", async () => {
    const wrapper = mountTwoFactorView();
    const input = wrapper.find("input#code");
    await input.setValue("123");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("6-digit code");
    expect(vi.mocked(authClient.twoFactor.verifyTotp)).not.toHaveBeenCalled();
  });

  it("calls authClient.twoFactor.verifyTotp with the entered code", async () => {
    vi.mocked(authClient.twoFactor.verifyTotp).mockResolvedValueOnce({
      data: null,
      error: { message: "Invalid code", status: 401, statusText: "Unauthorized" },
    });

    const wrapper = mountTwoFactorView();
    const input = wrapper.find("input#code");
    await input.setValue("123456");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(vi.mocked(authClient.twoFactor.verifyTotp)).toHaveBeenCalledWith({ code: "123456" });
  });

  it("displays an error message when verification fails", async () => {
    vi.mocked(authClient.twoFactor.verifyTotp).mockResolvedValueOnce({
      data: null,
      error: { message: "Invalid verification code", status: 401, statusText: "Unauthorized" },
    });

    const wrapper = mountTwoFactorView();
    const input = wrapper.find("input#code");
    await input.setValue("999999");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    const alert = wrapper.find("[role='alert']");
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain("Invalid verification code");
  });

  it("shows no error message initially", () => {
    const wrapper = mountTwoFactorView();
    const alert = wrapper.find("[role='alert']");
    if (alert.exists()) {
      expect(alert.text()).toBe("");
    } else {
      expect(alert.exists()).toBe(false);
    }
  });
});
