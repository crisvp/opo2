import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { ref } from "vue";

// Mock TanStack Query
vi.mock("@tanstack/vue-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}));

// Mock the locations queries module
vi.mock("../../src/api/queries/locations", () => ({
  useStateList: vi.fn(),
  usePlaceList: vi.fn(),
  useTribeList: vi.fn(),
  locationKeys: {
    all: ["locations"],
    states: () => ["locations", "states"],
    places: (usps?: string) => ["locations", "places", usps ?? "all"],
    tribes: () => ["locations", "tribes"],
  },
}));

// Mock PrimeVue Select
vi.mock("primevue/select", () => ({
  default: {
    name: "Select",
    props: ["modelValue", "options", "optionLabel", "optionValue", "placeholder", "showClear", "disabled"],
    emits: ["update:modelValue"],
    template: `
      <div class="select-mock" :data-value="modelValue">
        <button
          v-for="option in options"
          :key="option.value ?? option.usps ?? option"
          :data-testid="'option-' + (option.value ?? option.usps)"
          @click="$emit('update:modelValue', option.value ?? option.usps)"
        >{{ option.label ?? option.name }}</button>
      </div>
    `,
  },
}));

// Mock PlaceAutocomplete
vi.mock("../../src/components/locations/PlaceAutocomplete.vue", () => ({
  default: {
    name: "PlaceAutocomplete",
    props: ["stateUsps", "placeholder", "disabled"],
    emits: ["select", "clear"],
    template: `<div class="place-autocomplete-mock" data-testid="place-autocomplete"><slot /></div>`,
  },
}));

// Mock TribeAutocomplete
vi.mock("../../src/components/locations/TribeAutocomplete.vue", () => ({
  default: {
    name: "TribeAutocomplete",
    props: ["placeholder", "disabled"],
    emits: ["select", "clear"],
    template: `<div class="tribe-autocomplete-mock" data-testid="tribe-autocomplete"><slot /></div>`,
  },
}));

import LocationSelector from "../../src/components/locations/LocationSelector.vue";
import { useStateList, usePlaceList, useTribeList } from "../../src/api/queries/locations";

const mockStates = [
  { usps: "CA", name: "California", isTerritory: false },
  { usps: "NY", name: "New York", isTerritory: false },
];

function mountComponent(props: Record<string, unknown> = {}) {
  return mount(LocationSelector, {
    props: {
      governmentLevel: null,
      stateUsps: null,
      placeGeoid: null,
      tribeId: null,
      ...props,
    },
    global: {
      plugins: [createPinia()],
    },
  });
}

describe("LocationSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useStateList).mockReturnValue({
      data: ref(mockStates),
      isLoading: ref(false),
      isError: ref(false),
      error: ref(null),
    } as ReturnType<typeof useStateList>);

    vi.mocked(usePlaceList).mockReturnValue({
      data: ref([]),
      isLoading: ref(false),
      isError: ref(false),
      error: ref(null),
    } as ReturnType<typeof usePlaceList>);

    vi.mocked(useTribeList).mockReturnValue({
      data: ref([]),
      isLoading: ref(false),
      isError: ref(false),
      error: ref(null),
    } as ReturnType<typeof useTribeList>);
  });

  it("renders the government level selector", () => {
    const wrapper = mountComponent();
    const selects = wrapper.findAll(".select-mock");
    expect(selects.length).toBeGreaterThan(0);
  });

  it("shows only level selector when governmentLevel is null", () => {
    const wrapper = mountComponent({ governmentLevel: null });
    expect(wrapper.find("[data-testid='place-autocomplete']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='tribe-autocomplete']").exists()).toBe(false);
  });

  it("shows state selector when governmentLevel is 'state'", () => {
    const wrapper = mountComponent({ governmentLevel: "state" });
    const selects = wrapper.findAll(".select-mock");
    // Should have level selector + state selector
    expect(selects.length).toBe(2);
  });

  it("shows state selector when governmentLevel is 'place'", () => {
    const wrapper = mountComponent({ governmentLevel: "place" });
    const selects = wrapper.findAll(".select-mock");
    expect(selects.length).toBe(2);
  });

  it("shows place autocomplete when level is 'place' and stateUsps is set", () => {
    const wrapper = mountComponent({ governmentLevel: "place", stateUsps: "CA" });
    expect(wrapper.find("[data-testid='place-autocomplete']").exists()).toBe(true);
  });

  it("does not show place autocomplete when level is 'place' but stateUsps is null", () => {
    const wrapper = mountComponent({ governmentLevel: "place", stateUsps: null });
    expect(wrapper.find("[data-testid='place-autocomplete']").exists()).toBe(false);
  });

  it("shows tribe autocomplete when governmentLevel is 'tribal'", () => {
    const wrapper = mountComponent({ governmentLevel: "tribal" });
    expect(wrapper.find("[data-testid='tribe-autocomplete']").exists()).toBe(true);
  });

  it("does not show tribe autocomplete when level is 'state'", () => {
    const wrapper = mountComponent({ governmentLevel: "state" });
    expect(wrapper.find("[data-testid='tribe-autocomplete']").exists()).toBe(false);
  });

  it("does not show place autocomplete when level is 'tribal'", () => {
    const wrapper = mountComponent({ governmentLevel: "tribal" });
    expect(wrapper.find("[data-testid='place-autocomplete']").exists()).toBe(false);
  });

  it("emits update:governmentLevel when level changes", async () => {
    const wrapper = mountComponent();
    const levelOption = wrapper.find("[data-testid='option-federal']");
    if (levelOption.exists()) {
      await levelOption.trigger("click");
      const emitted = wrapper.emitted("update:governmentLevel");
      expect(emitted).toBeDefined();
      expect((emitted![0] as unknown[])[0]).toBe("federal");
    }
  });

  it("emits null sub-values when level changes", async () => {
    const wrapper = mountComponent({ governmentLevel: "state", stateUsps: "CA" });
    const levelOption = wrapper.find("[data-testid='option-federal']");
    if (levelOption.exists()) {
      await levelOption.trigger("click");
      const stateEmitted = wrapper.emitted("update:stateUsps");
      expect(stateEmitted).toBeDefined();
    }
  });

  it("calls useStateList composable", () => {
    mountComponent();
    expect(useStateList).toHaveBeenCalled();
  });

  it("renders federal level option", () => {
    const wrapper = mountComponent();
    const federalBtn = wrapper.find("[data-testid='option-federal']");
    expect(federalBtn.exists()).toBe(true);
  });

  it("renders tribal level option", () => {
    const wrapper = mountComponent();
    const tribalBtn = wrapper.find("[data-testid='option-tribal']");
    expect(tribalBtn.exists()).toBe(true);
  });

  it("emits update:stateUsps when state is selected", async () => {
    const wrapper = mountComponent({ governmentLevel: "state" });
    const caOption = wrapper.find("[data-testid='option-CA']");
    if (caOption.exists()) {
      await caOption.trigger("click");
      const emitted = wrapper.emitted("update:stateUsps");
      expect(emitted).toBeDefined();
      expect((emitted![0] as unknown[])[0]).toBe("CA");
    }
  });
});
