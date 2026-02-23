import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { ref } from "vue";

vi.mock("@tanstack/vue-query", () => ({
  useQuery: vi.fn(() => ({ data: ref(null), isLoading: ref(false) })),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: ref(false) })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock("../../src/api/queries/catalog.js", () => ({
  useCatalogTypes: vi.fn(() => ({ data: ref([]) })),
  useCatalogDetail: vi.fn(() => ({ data: ref(null), isLoading: ref(false) })),
  useUpdateCatalogEntry: vi.fn(() => ({ mutate: vi.fn(), isPending: ref(false) })),
  useDeleteCatalogEntry: vi.fn(() => ({ mutate: vi.fn(), isPending: ref(false) })),
  useAssociationTypes: vi.fn(() => ({ data: ref([]) })),
}));

// Stub child components and PrimeVue
vi.mock("../../src/components/catalog/CatalogEntryForm.vue", () => ({ default: { name: "CatalogEntryForm", template: "<div data-testid='entry-form' />" } }));
vi.mock("../../src/components/catalog/AliasManager.vue", () => ({ default: { name: "AliasManager", template: "<div data-testid='alias-manager' />" } }));
vi.mock("../../src/components/catalog/CatalogAssociationsManager.vue", () => ({ default: { name: "CatalogAssociationsManager", template: "<div data-testid='assoc-manager' />" } }));

vi.mock("primevue/drawer", () => ({ default: { name: "Drawer", props: ["visible", "position", "style", "pt"], emits: ["update:visible"], template: `<div v-if="visible" data-testid="catalog-drawer"><slot name="header" /><slot /></div>` } }));
vi.mock("primevue/tabs", () => ({ default: { name: "Tabs", props: ["value"], template: "<div><slot /></div>" } }));
vi.mock("primevue/tab", () => ({ default: { name: "Tab", props: ["value"], template: "<div><slot /></div>" } }));
vi.mock("primevue/tablist", () => ({ default: { name: "TabList", template: "<div><slot /></div>" } }));
vi.mock("primevue/tabpanels", () => ({ default: { name: "TabPanels", template: "<div><slot /></div>" } }));
vi.mock("primevue/tabpanel", () => ({ default: { name: "TabPanel", props: ["value"], template: "<div><slot /></div>" } }));
vi.mock("primevue/button", () => ({ default: { name: "Button", props: ["label", "icon", "severity", "outlined", "loading"], emits: ["click"], template: `<button @click="$emit('click')">{{ label }}</button>` } }));
vi.mock("primevue/tag", () => ({ default: { name: "Tag", props: ["value", "severity"], template: "<span>{{ value }}</span>" } }));
vi.mock("primevue/progressspinner", () => ({ default: { name: "ProgressSpinner", template: "<div />" } }));
vi.mock("primevue/confirmdialog", () => ({ default: { name: "ConfirmDialog", template: "<div />" } }));
vi.mock("primevue/usetoast", () => ({ useToast: vi.fn(() => ({ add: vi.fn() })) }));
vi.mock("primevue/useconfirm", () => ({ useConfirm: vi.fn(() => ({ require: vi.fn() })) }));

import CatalogEntryDrawer from "../../src/components/catalog/CatalogEntryDrawer.vue";

function mountComponent(props: Record<string, unknown> = {}) {
  return mount(CatalogEntryDrawer, {
    props: { visible: false, entryId: "test-id", ...props },
    global: { plugins: [createPinia()] },
  });
}

describe("CatalogEntryDrawer", () => {
  it("does not render drawer content when visible is false", () => {
    const wrapper = mountComponent({ visible: false });
    expect(wrapper.find("[data-testid='catalog-drawer']").exists()).toBe(false);
  });

  it("renders drawer when visible is true", () => {
    const wrapper = mountComponent({ visible: true });
    expect(wrapper.find("[data-testid='catalog-drawer']").exists()).toBe(true);
  });

  it("emits update:visible when drawer requests close", async () => {
    const wrapper = mountComponent({ visible: true });
    await wrapper.findComponent({ name: "Drawer" }).vm.$emit("update:visible", false);
    expect(wrapper.emitted("update:visible")).toBeDefined();
    expect(wrapper.emitted("update:visible")![0]).toEqual([false]);
  });
});
