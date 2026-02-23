import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia, defineStore } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import { VueQueryPlugin } from "@tanstack/vue-query";

// Mock authClient before importing the component
vi.mock("../../src/services/authClient.js", () => ({
  authClient: {
    useListPasskeys: vi.fn().mockReturnValue({
      value: { data: [], isPending: false, error: null, refetch: vi.fn() },
    }),
    passkey: {
      addPasskey: vi.fn(),
      deletePasskey: vi.fn(),
    },
    twoFactor: {
      enable: vi.fn(),
      disable: vi.fn(),
    },
    getSession: vi.fn().mockResolvedValue({ data: null }),
  },
}));

// Mock PrimeVue components
vi.mock("primevue/button", () => ({
  default: {
    name: "Button",
    props: ["label", "loading", "type", "severity", "icon", "text", "size", "ariaLabel"],
    emits: ["click"],
    template: `<button :type="type || 'button'" :disabled="loading" @click="$emit('click')">{{ label }}<slot /></button>`,
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

import SecuritySettingsView from "../../src/views/SecuritySettingsView.vue";
import { authClient } from "../../src/services/authClient.js";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/security", component: SecuritySettingsView },
  ],
});

function mountSecuritySettingsView(twoFactorEnabled = false) {
  const pinia = createPinia();
  setActivePinia(pinia);

  // Define auth store with configurable twoFactorEnabled state
  const useAuthStore = defineStore("auth", {
    state: () => ({
      user: twoFactorEnabled
        ? { id: "1", email: "test@test.com", name: "Test", role: "user", tier: 1, twoFactorEnabled: true }
        : null,
      initialized: true,
    }),
    actions: {
      setUser(user: unknown) { this.user = user as typeof this.user; },
      async init() {},
    },
  });

  // Instantiate so it's available
  useAuthStore();

  return mount(SecuritySettingsView, {
    global: {
      plugins: [pinia, router, VueQueryPlugin],
    },
  });
}

describe("SecuritySettingsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset useListPasskeys mock to default (no passkeys, not loading)
    vi.mocked(authClient.useListPasskeys).mockReturnValue({
      value: { data: [], isPending: false, error: null, refetch: vi.fn() },
    } as ReturnType<typeof authClient.useListPasskeys>);
  });

  it("renders the Security Settings heading", () => {
    const wrapper = mountSecuritySettingsView();
    expect(wrapper.text()).toContain("Security Settings");
  });

  it("renders the Passkeys section", () => {
    const wrapper = mountSecuritySettingsView();
    expect(wrapper.text()).toContain("Passkeys");
  });

  it("renders the Two-Factor Authentication section", () => {
    const wrapper = mountSecuritySettingsView();
    expect(wrapper.text()).toContain("Two-Factor Authentication");
  });

  it("renders Add Passkey button", () => {
    const wrapper = mountSecuritySettingsView();
    const buttons = wrapper.findAll("button");
    const addPasskeyBtn = buttons.find((b) => b.text().includes("Add Passkey"));
    expect(addPasskeyBtn).toBeDefined();
  });

  it("shows 'No passkeys registered yet' when list is empty", () => {
    const wrapper = mountSecuritySettingsView();
    expect(wrapper.text()).toContain("No passkeys registered yet");
  });

  it("calls authClient.passkey.addPasskey on Add Passkey click", async () => {
    vi.mocked(authClient.passkey.addPasskey).mockResolvedValueOnce(undefined);

    const wrapper = mountSecuritySettingsView();
    const buttons = wrapper.findAll("button");
    const addPasskeyBtn = buttons.find((b) => b.text().includes("Add Passkey"));
    await addPasskeyBtn!.trigger("click");
    await flushPromises();

    expect(vi.mocked(authClient.passkey.addPasskey)).toHaveBeenCalled();
  });

  it("shows Enable 2FA button when 2FA is not enabled", () => {
    const wrapper = mountSecuritySettingsView(false);
    const buttons = wrapper.findAll("button");
    const enableBtn = buttons.find((b) => b.text().includes("Enable 2FA"));
    expect(enableBtn).toBeDefined();
  });

  it("shows Disable 2FA button when 2FA is enabled", () => {
    const wrapper = mountSecuritySettingsView(true);
    const buttons = wrapper.findAll("button");
    const disableBtn = buttons.find((b) => b.text().includes("Disable 2FA"));
    expect(disableBtn).toBeDefined();
  });

  it("shows the enable 2FA form when Enable 2FA is clicked", async () => {
    const wrapper = mountSecuritySettingsView(false);
    const buttons = wrapper.findAll("button");
    const enableBtn = buttons.find((b) => b.text().includes("Enable 2FA"));
    await enableBtn!.trigger("click");
    await flushPromises();

    // Form should now be visible with a password input
    const passwordInput = wrapper.find("input[type='password']");
    expect(passwordInput.exists()).toBe(true);
  });

  it("calls authClient.twoFactor.enable with password on form submit", async () => {
    vi.mocked(authClient.twoFactor.enable).mockResolvedValueOnce({
      data: { totpURI: "otpauth://totp/test?secret=TEST", backupCodes: ["code1", "code2"] },
      error: null,
    });

    const wrapper = mountSecuritySettingsView(false);
    const buttons = wrapper.findAll("button");
    const enableBtn = buttons.find((b) => b.text().includes("Enable 2FA"));
    await enableBtn!.trigger("click");
    await flushPromises();

    const passwordInput = wrapper.find("input[type='password']");
    await passwordInput.setValue("mypassword");
    const form = wrapper.find("form");
    await form.trigger("submit");
    await flushPromises();

    expect(vi.mocked(authClient.twoFactor.enable)).toHaveBeenCalledWith({ password: "mypassword" });
  });

  it("shows error when Enable 2FA password is empty", async () => {
    const wrapper = mountSecuritySettingsView(false);
    const buttons = wrapper.findAll("button");
    const enableBtn = buttons.find((b) => b.text().includes("Enable 2FA"));
    await enableBtn!.trigger("click");
    await flushPromises();

    const form = wrapper.find("form");
    await form.trigger("submit");
    await flushPromises();

    const alert = wrapper.find("[role='alert']");
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain("Password is required");
  });

  it("shows passkeys list when passkeys are present", () => {
    vi.mocked(authClient.useListPasskeys).mockReturnValue({
      value: {
        data: [{ id: "pk1", name: "My Passkey", credentialID: "cred1", createdAt: new Date("2025-01-01") }],
        isPending: false,
        error: null,
        refetch: vi.fn(),
      },
    } as ReturnType<typeof authClient.useListPasskeys>);

    const wrapper = mountSecuritySettingsView();
    expect(wrapper.text()).toContain("My Passkey");
  });
});
