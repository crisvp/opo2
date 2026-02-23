import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { RouterLink } from "vue-router";
import PolicyStatusCard from "../../src/components/locations/PolicyStatusCard.vue";

function mountCard(props: { policyType: string; hasPolicy: boolean; documentId?: string | null }) {
  return mount(PolicyStatusCard, {
    props,
    global: {
      stubs: { RouterLink: true },
    },
  });
}

describe("PolicyStatusCard", () => {
  it("renders policy type label with underscores replaced by spaces", () => {
    const wrapper = mountCard({ policyType: "body_worn_camera", hasPolicy: false });
    expect(wrapper.text()).toContain("body worn camera");
  });

  it("shows 'No Policy' in muted style when hasPolicy is false", () => {
    const wrapper = mountCard({ policyType: "use_of_force", hasPolicy: false });
    const span = wrapper.find("span.text-text-muted");
    expect(span.exists()).toBe(true);
    expect(span.text()).toBe("No Policy");
  });

  it("shows 'Policy Found' as plain text when hasPolicy is true and no documentId", () => {
    const wrapper = mountCard({ policyType: "use_of_force", hasPolicy: true });
    const span = wrapper.find("span.text-green-600");
    expect(span.exists()).toBe(true);
    expect(span.text()).toBe("Policy Found");
  });

  it("renders a RouterLink to /documents/:id when hasPolicy is true and documentId is provided", () => {
    const wrapper = mountCard({ policyType: "use_of_force", hasPolicy: true, documentId: "doc-123" });
    const link = wrapper.findComponent(RouterLink);
    expect(link.exists()).toBe(true);
    expect(link.attributes("to")).toBe("/documents/doc-123");
  });

  it("data-testid attribute contains the policy type", () => {
    const wrapper = mountCard({ policyType: "body_worn_camera", hasPolicy: false });
    const root = wrapper.find("[data-testid]");
    expect(root.attributes("data-testid")).toContain("body_worn_camera");
  });
});
