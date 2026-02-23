import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createRouter, createWebHistory } from "vue-router";
import { ref } from "vue";
import type { LocationOverviewData } from "../../src/api/queries/locations";

// Mock the locations query composable
vi.mock("../../src/api/queries/locations", () => ({
  useLocationOverview: vi.fn(),
}));

import LocationOverviewView from "../../src/views/locations/LocationOverviewView.vue";
import { useLocationOverview } from "../../src/api/queries/locations";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/locations/places/:geoid", name: "location-overview", component: LocationOverviewView },
    { path: "/documents/:id", name: "document-detail", component: { template: "<div />" } },
  ],
});

const emptyOverview: LocationOverviewData = {
  documentCount: 0,
  documentsByCategory: {},
  policies: [],
  vendors: [],
  technologies: [],
  agencies: [],
  stateMetadata: [],
};

function mountOverviewView() {
  return mount(LocationOverviewView, {
    global: {
      plugins: [router],
      stubs: {
        RouterLink: {
          props: ["to"],
          template: `<a :href="to"><slot /></a>`,
        },
      },
    },
  });
}

describe("LocationOverviewView — loading state", () => {
  it("shows loading indicator while data is loading", async () => {
    vi.mocked(useLocationOverview).mockReturnValue({
      data: ref(null),
      isLoading: ref(true),
      isError: ref(false),
    } as ReturnType<typeof useLocationOverview>);

    const wrapper = mountOverviewView();
    expect(wrapper.text()).toContain("Loading");
  });
});

describe("LocationOverviewView — error state", () => {
  it("shows error message when query fails", async () => {
    vi.mocked(useLocationOverview).mockReturnValue({
      data: ref(null),
      isLoading: ref(false),
      isError: ref(true),
    } as ReturnType<typeof useLocationOverview>);

    const wrapper = mountOverviewView();
    expect(wrapper.text()).toContain("Failed");
  });
});

describe("LocationOverviewView — empty state", () => {
  it("renders document count of 0 when no documents", async () => {
    vi.mocked(useLocationOverview).mockReturnValue({
      data: ref(emptyOverview),
      isLoading: ref(false),
      isError: ref(false),
    } as ReturnType<typeof useLocationOverview>);

    const wrapper = mountOverviewView();
    await flushPromises();
    expect(wrapper.text()).toContain("0");
  });

  it("does not render policies section when policies array is empty", async () => {
    vi.mocked(useLocationOverview).mockReturnValue({
      data: ref({ ...emptyOverview, policies: [] }),
      isLoading: ref(false),
      isError: ref(false),
    } as ReturnType<typeof useLocationOverview>);

    const wrapper = mountOverviewView();
    await flushPromises();
    // Policies section should not appear when empty
    expect(wrapper.text()).not.toContain("Policies");
  });
});

describe("LocationOverviewView — policies rendering", () => {
  it("renders PolicyStatusCard for each policy in overview.policies", async () => {
    const overviewWithPolicies: LocationOverviewData = {
      ...emptyOverview,
      policies: [
        { typeId: "pt-1", typeName: "body_worn_camera", exists: true, documentId: "doc-abc" },
        { typeId: "pt-2", typeName: "use_of_force", exists: false, documentId: null },
        { typeId: "pt-3", typeName: "surveillance", exists: true, documentId: "doc-xyz" },
      ],
    };

    vi.mocked(useLocationOverview).mockReturnValue({
      data: ref(overviewWithPolicies),
      isLoading: ref(false),
      isError: ref(false),
    } as ReturnType<typeof useLocationOverview>);

    const wrapper = mountOverviewView();
    await flushPromises();

    // Should render Policies section
    expect(wrapper.text()).toContain("Policies");

    // Should render each policy type (underscores replaced by spaces)
    expect(wrapper.text()).toContain("body worn camera");
    expect(wrapper.text()).toContain("use of force");
    expect(wrapper.text()).toContain("surveillance");
  });

  it("shows 'Policy Found' for a policy that exists", async () => {
    const overviewWithPolicy: LocationOverviewData = {
      ...emptyOverview,
      policies: [
        { typeId: "pt-1", typeName: "use_of_force", exists: true, documentId: "doc-123" },
      ],
    };

    vi.mocked(useLocationOverview).mockReturnValue({
      data: ref(overviewWithPolicy),
      isLoading: ref(false),
      isError: ref(false),
    } as ReturnType<typeof useLocationOverview>);

    const wrapper = mountOverviewView();
    await flushPromises();

    expect(wrapper.text()).toContain("Policy Found");
  });

  it("shows 'No Policy' for a policy that does not exist", async () => {
    const overviewWithMissingPolicy: LocationOverviewData = {
      ...emptyOverview,
      policies: [
        { typeId: "pt-1", typeName: "use_of_force", exists: false, documentId: null },
      ],
    };

    vi.mocked(useLocationOverview).mockReturnValue({
      data: ref(overviewWithMissingPolicy),
      isLoading: ref(false),
      isError: ref(false),
    } as ReturnType<typeof useLocationOverview>);

    const wrapper = mountOverviewView();
    await flushPromises();

    expect(wrapper.text()).toContain("No Policy");
  });

  it("renders policy cards with correct data-testid attributes", async () => {
    const overviewWithPolicy: LocationOverviewData = {
      ...emptyOverview,
      policies: [
        { typeId: "pt-1", typeName: "body_worn_camera", exists: false, documentId: null },
      ],
    };

    vi.mocked(useLocationOverview).mockReturnValue({
      data: ref(overviewWithPolicy),
      isLoading: ref(false),
      isError: ref(false),
    } as ReturnType<typeof useLocationOverview>);

    const wrapper = mountOverviewView();
    await flushPromises();

    const card = wrapper.find("[data-testid='policy-card-body_worn_camera']");
    expect(card.exists()).toBe(true);
  });
});

describe("LocationOverviewView — vendors section", () => {
  it("renders vendors when overview has vendors", async () => {
    const overviewWithVendors: LocationOverviewData = {
      ...emptyOverview,
      vendors: [
        { id: "v-1", name: "Axon", documentCount: 5 },
        { id: "v-2", name: "Motorola", documentCount: 3 },
      ],
    };

    vi.mocked(useLocationOverview).mockReturnValue({
      data: ref(overviewWithVendors),
      isLoading: ref(false),
      isError: ref(false),
    } as ReturnType<typeof useLocationOverview>);

    const wrapper = mountOverviewView();
    await flushPromises();

    expect(wrapper.text()).toContain("Vendors");
    expect(wrapper.text()).toContain("Axon");
    expect(wrapper.text()).toContain("Motorola");
  });
});
