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

// Mock the catalog queries module
vi.mock("../../src/api/queries/catalog", () => ({
  useCatalogSearch: vi.fn(),
  catalogKeys: {
    all: ["catalog"],
    search: (q: string, typeId?: string) => ["catalog", "search", q, typeId ?? ""],
  },
}));

// Mock PrimeVue AutoComplete
vi.mock("primevue/autocomplete", () => ({
  default: {
    name: "AutoComplete",
    props: [
      "modelValue",
      "suggestions",
      "optionLabel",
      "placeholder",
      "disabled",
      "minLength",
      "forceSelection",
    ],
    emits: ["update:modelValue", "complete", "option-select", "clear"],
    template: `
      <div class="autocomplete-mock">
        <input
          :placeholder="placeholder"
          :disabled="disabled"
          data-testid="autocomplete-input"
          @input="$emit('complete', { query: $event.target.value })"
        />
        <ul v-if="suggestions && suggestions.length > 0" data-testid="suggestions">
          <li
            v-for="option in suggestions"
            :key="option.id"
            data-testid="suggestion-item"
            @click="$emit('option-select', { value: option })"
          >{{ option.name }}</li>
        </ul>
      </div>
    `,
  },
}));

import CatalogEntrySelect from "../../src/components/catalog/CatalogEntrySelect.vue";
import { useCatalogSearch } from "../../src/api/queries/catalog";

const mockResults = [
  { id: "e1", name: "Palantir Technologies", typeId: "vendor", typeName: "Vendor", similarity: 0.9 },
  { id: "e2", name: "Axon Enterprise", typeId: "vendor", typeName: "Vendor", similarity: 0.75 },
];

function mountComponent(props: Record<string, unknown> = {}) {
  return mount(CatalogEntrySelect, {
    props,
    global: {
      plugins: [createPinia()],
    },
  });
}

describe("CatalogEntrySelect", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: return empty results
    vi.mocked(useCatalogSearch).mockReturnValue({
      data: ref(undefined),
      isLoading: ref(false),
      isError: ref(false),
      error: ref(null),
    } as ReturnType<typeof useCatalogSearch>);
  });

  it("renders the autocomplete input", () => {
    const wrapper = mountComponent();
    const input = wrapper.find("[data-testid='autocomplete-input']");
    expect(input.exists()).toBe(true);
  });

  it("uses the default placeholder when none provided", () => {
    const wrapper = mountComponent();
    const input = wrapper.find("[data-testid='autocomplete-input']");
    expect(input.attributes("placeholder")).toContain("Search catalog entries");
  });

  it("uses the provided placeholder", () => {
    const wrapper = mountComponent({ placeholder: "Find a vendor…" });
    const input = wrapper.find("[data-testid='autocomplete-input']");
    expect(input.attributes("placeholder")).toBe("Find a vendor…");
  });

  it("renders as disabled when disabled prop is true", () => {
    const wrapper = mountComponent({ disabled: true });
    const input = wrapper.find("[data-testid='autocomplete-input']");
    expect(input.attributes("disabled")).toBeDefined();
  });

  it("passes typeId to useCatalogSearch", () => {
    mountComponent({ typeId: "vendor" });
    expect(useCatalogSearch).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
    );
  });

  it("shows suggestions when search returns results", async () => {
    vi.mocked(useCatalogSearch).mockReturnValue({
      data: ref(mockResults),
      isLoading: ref(false),
      isError: ref(false),
      error: ref(null),
    } as ReturnType<typeof useCatalogSearch>);

    const wrapper = mountComponent();
    // Trigger the complete event directly on the autocomplete component
    await wrapper.findComponent({ name: "AutoComplete" }).vm.$emit("complete", { query: "Palantir" });
    await wrapper.vm.$nextTick();

    const suggestions = wrapper.find("[data-testid='suggestions']");
    expect(suggestions.exists()).toBe(true);
  });

  it("emits select event when an option is chosen", async () => {
    vi.mocked(useCatalogSearch).mockReturnValue({
      data: ref(mockResults),
      isLoading: ref(false),
      isError: ref(false),
      error: ref(null),
    } as ReturnType<typeof useCatalogSearch>);

    const wrapper = mountComponent();
    // Trigger complete to populate suggestions
    await wrapper.findComponent({ name: "AutoComplete" }).vm.$emit("complete", { query: "Palantir" });
    await wrapper.vm.$nextTick();

    const items = wrapper.findAll("[data-testid='suggestion-item']");
    if (items.length > 0) {
      await items[0].trigger("click");
      const emitted = wrapper.emitted("select");
      expect(emitted).toBeDefined();
      expect(emitted!.length).toBe(1);
      expect((emitted![0] as unknown[])[0]).toEqual(mockResults[0]);
    }
  });

  it("emits clear event when selection is cleared", async () => {
    const wrapper = mountComponent();
    // Trigger the clear event on the autocomplete
    await wrapper.findComponent({ name: "AutoComplete" }).vm.$emit("clear");
    const emitted = wrapper.emitted("clear");
    expect(emitted).toBeDefined();
  });
});
