import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { ref } from "vue";

vi.mock("@tanstack/vue-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: ref(false) })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock("../../src/api/queries/catalog.js", () => ({
  useCatalogSearch: vi.fn(() => ({ data: ref(undefined) })),
  useCreateCatalogAssociation: vi.fn(() => ({ mutate: vi.fn(), isPending: ref(false) })),
  useDeleteCatalogAssociation: vi.fn(() => ({ mutate: vi.fn(), isPending: ref(false) })),
}));

// Stub PrimeVue components
vi.mock("primevue/button", () => ({ default: { name: "Button", props: ["label", "icon", "severity", "text", "size", "loading", "disabled"], emits: ["click"], template: `<button @click="$emit('click')">{{ label }}</button>` } }));
vi.mock("primevue/select", () => ({ default: { name: "Select", props: ["modelValue", "options", "optionLabel", "optionValue", "placeholder"], emits: ["update:modelValue"], template: `<select></select>` } }));
vi.mock("primevue/autocomplete", () => ({ default: { name: "AutoComplete", props: ["modelValue", "suggestions", "optionLabel", "placeholder"], emits: ["update:modelValue", "complete"], template: `<input />` } }));
vi.mock("primevue/tag", () => ({ default: { name: "Tag", props: ["value", "severity"], template: `<span>{{ value }}</span>` } }));
vi.mock("primevue/message", () => ({ default: { name: "Message", props: ["severity", "closable"], template: `<div><slot /></div>` } }));
vi.mock("primevue/usetoast", () => ({ useToast: vi.fn(() => ({ add: vi.fn() })) }));

import CatalogAssociationsManager from "../../src/components/catalog/CatalogAssociationsManager.vue";

const mockAssociations = [
  { id: "assoc1", sourceEntryId: "entry-A", targetEntryId: "entry-B", associationTypeId: "type1", createdAt: "2024-01-01T00:00:00Z" },
];

const mockAssociationTypes = [
  { id: "type1", name: "uses", appliesTo: "catalog_catalog", isDirectional: true, inverseId: null, isSystem: false, sortOrder: 1, description: null },
];

function mountComponent(props: Record<string, unknown> = {}) {
  return mount(CatalogAssociationsManager, {
    props: { entryId: "entry-A", associations: [], associationTypes: [], ...props },
    global: { plugins: [createPinia()] },
  });
}

describe("CatalogAssociationsManager", () => {
  it("renders the 'Linked from this entry' section heading", () => {
    const wrapper = mountComponent();
    expect(wrapper.text()).toContain("Linked from this entry");
  });

  it("renders the 'Linked to this entry' section heading", () => {
    const wrapper = mountComponent();
    expect(wrapper.text()).toContain("Linked to this entry");
  });

  it("shows empty state when no outgoing associations", () => {
    const wrapper = mountComponent({ entryId: "entry-A", associations: [], associationTypes: [] });
    // Both sections show "No associations"
    expect(wrapper.text()).toContain("No associations");
  });

  it("renders outgoing association type label for source entry", () => {
    const wrapper = mountComponent({
      entryId: "entry-A",
      associations: mockAssociations,
      associationTypes: mockAssociationTypes,
    });
    expect(wrapper.text()).toContain("uses");
  });

  it("renders incoming association for target entry", () => {
    const wrapper = mountComponent({
      entryId: "entry-B",
      associations: mockAssociations,
      associationTypes: mockAssociationTypes,
    });
    expect(wrapper.text()).toContain("Linked to this entry");
  });

  it("renders the Add Association form", () => {
    const wrapper = mountComponent();
    expect(wrapper.text()).toContain("Add Association");
  });
});
