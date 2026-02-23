import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

// Mock PrimeVue ProgressBar
vi.mock("primevue/progressbar", () => ({
  default: {
    name: "ProgressBar",
    props: ["value", "class"],
    template: `<div class="progress-bar-mock" :data-value="value">{{ value }}%</div>`,
  },
}));

import UsageLimitBar from "../../src/components/shared/UsageLimitBar.vue";

function mountComponent(props: { limitType: string; used: number; limit: number; remaining: number }) {
  return mount(UsageLimitBar, { props });
}

describe("UsageLimitBar", () => {
  it("renders the limitType label with underscores replaced by spaces", () => {
    const wrapper = mountComponent({ limitType: "llm_metadata", used: 2, limit: 10, remaining: 8 });
    expect(wrapper.text()).toContain("llm metadata");
  });

  it("renders plain limitType without underscores", () => {
    const wrapper = mountComponent({ limitType: "uploads", used: 3, limit: 20, remaining: 17 });
    expect(wrapper.text()).toContain("uploads");
  });

  it("renders used and limit numbers in 'used / limit' format", () => {
    const wrapper = mountComponent({ limitType: "uploads", used: 5, limit: 10, remaining: 5 });
    expect(wrapper.text()).toContain("5 / 10");
  });

  it("renders remaining count", () => {
    const wrapper = mountComponent({ limitType: "uploads", used: 3, limit: 10, remaining: 7 });
    expect(wrapper.text()).toContain("7 remaining");
  });

  it("shows 0% when used is 0", () => {
    const wrapper = mountComponent({ limitType: "uploads", used: 0, limit: 10, remaining: 10 });
    const bar = wrapper.find(".progress-bar-mock");
    expect(bar.attributes("data-value")).toBe("0");
  });

  it("shows 100% when used equals limit", () => {
    const wrapper = mountComponent({ limitType: "uploads", used: 10, limit: 10, remaining: 0 });
    const bar = wrapper.find(".progress-bar-mock");
    expect(bar.attributes("data-value")).toBe("100");
  });

  it("shows 100% when used exceeds limit (capped at 100)", () => {
    const wrapper = mountComponent({ limitType: "uploads", used: 15, limit: 10, remaining: 0 });
    const bar = wrapper.find(".progress-bar-mock");
    expect(bar.attributes("data-value")).toBe("100");
  });

  it("calculates 50% correctly for 5/10", () => {
    const wrapper = mountComponent({ limitType: "uploads", used: 5, limit: 10, remaining: 5 });
    const bar = wrapper.find(".progress-bar-mock");
    expect(bar.attributes("data-value")).toBe("50");
  });

  it("handles limit of 0 without division by zero (shows 0%)", () => {
    const wrapper = mountComponent({ limitType: "uploads", used: 0, limit: 0, remaining: 0 });
    const bar = wrapper.find(".progress-bar-mock");
    expect(bar.attributes("data-value")).toBe("0");
  });

  it("renders the ProgressBar component", () => {
    const wrapper = mountComponent({ limitType: "uploads", used: 5, limit: 10, remaining: 5 });
    expect(wrapper.find(".progress-bar-mock").exists()).toBe(true);
  });

  it("rounds percentage to the nearest integer", () => {
    // 1/3 = 33.33... → 33
    const wrapper = mountComponent({ limitType: "uploads", used: 1, limit: 3, remaining: 2 });
    const bar = wrapper.find(".progress-bar-mock");
    expect(bar.attributes("data-value")).toBe("33");
  });

  it("shows 'remaining' text", () => {
    const wrapper = mountComponent({ limitType: "uploads", used: 2, limit: 10, remaining: 8 });
    expect(wrapper.text()).toContain("remaining");
  });

  it("renders multiple limitType segments from underscores", () => {
    const wrapper = mountComponent({ limitType: "llm_metadata_requests", used: 1, limit: 5, remaining: 4 });
    expect(wrapper.text()).toContain("llm metadata requests");
  });
});
