import { describe, it, expect, vi } from "vitest";
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
  useCatalogList: vi.fn(() => ({ data: ref(null), isLoading: ref(false) })),
  useCatalogDetail: vi.fn(() => ({ data: ref(null), isLoading: ref(false) })),
  useCreateCatalogEntry: vi.fn(() => ({ mutate: vi.fn(), isPending: ref(false) })),
  useDeleteCatalogEntry: vi.fn(() => ({ mutate: vi.fn(), isPending: ref(false) })),
  useCreateCatalogAssociation: vi.fn(() => ({ mutate: vi.fn(), isPending: ref(false) })),
  useDeleteCatalogAssociation: vi.fn(() => ({ mutate: vi.fn(), isPending: ref(false) })),
}));

vi.mock("../../src/components/catalog/CatalogEntryForm.vue", () => ({ default: { name: "CatalogEntryForm", template: "<div />" } }));
vi.mock("../../src/components/catalog/CatalogEntryDrawer.vue", () => ({ default: { name: "CatalogEntryDrawer", props: ["visible", "entryId"], emits: ["update:visible", "deleted"], template: "<div />" } }));

vi.mock("primevue/tree", () => ({ default: { name: "Tree", props: ["value", "draggable", "droppable"], emits: ["node-expand", "node-drop"], template: "<div data-testid='tree'><slot /></div>" } }));
vi.mock("primevue/tabs", () => ({ default: { name: "Tabs", props: ["value"], template: "<div><slot /></div>" } }));
vi.mock("primevue/tab", () => ({ default: { name: "Tab", props: ["value"], template: "<button><slot /></button>" } }));
vi.mock("primevue/tablist", () => ({ default: { name: "TabList", template: "<div><slot /></div>" } }));
vi.mock("primevue/tabpanels", () => ({ default: { name: "TabPanels", template: "<div><slot /></div>" } }));
vi.mock("primevue/tabpanel", () => ({ default: { name: "TabPanel", props: ["value"], template: "<div><slot /></div>" } }));
vi.mock("primevue/datatable", () => ({ default: { name: "DataTable", props: ["value", "loading", "totalRecords", "rows", "first", "paginator", "lazy", "dataKey"], emits: ["page"], template: "<div><slot /></div>" } }));
vi.mock("primevue/column", () => ({ default: { name: "Column", props: ["field", "header"], template: "<div />" } }));
vi.mock("primevue/button", () => ({ default: { name: "Button", props: ["label", "icon", "severity"], emits: ["click"], template: `<button @click="$emit('click')">{{ label }}</button>` } }));
vi.mock("primevue/inputtext", () => ({ default: { name: "InputText", props: ["modelValue", "placeholder"], template: "<input />" } }));
vi.mock("primevue/select", () => ({ default: { name: "Select", props: ["modelValue", "options", "optionLabel", "optionValue", "placeholder"], template: "<select />" } }));
vi.mock("primevue/tag", () => ({ default: { name: "Tag", props: ["value", "severity"], template: "<span>{{ value }}</span>" } }));
vi.mock("primevue/progressspinner", () => ({ default: { name: "ProgressSpinner", template: "<div />" } }));
vi.mock("primevue/dialog", () => ({ default: { name: "Dialog", props: ["visible", "header", "modal", "style"], emits: ["update:visible"], template: "<div><slot /></div>" } }));
vi.mock("primevue/usetoast", () => ({ useToast: vi.fn(() => ({ add: vi.fn() })) }));

import CatalogManageView from "../../src/views/admin/CatalogManageView.vue";

function mountView() {
  return mount(CatalogManageView, {
    global: { plugins: [createPinia()] },
  });
}

describe("CatalogManageView", () => {
  it("renders the page heading", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("Catalog Management");
  });

  it("renders the Vendor View tab", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("Vendor View");
  });

  it("renders the Technology View tab", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("Technology View");
  });

  it("renders the All Entries tab", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("All Entries");
  });

  it("renders Add Entry button", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("Add Entry");
  });
});
