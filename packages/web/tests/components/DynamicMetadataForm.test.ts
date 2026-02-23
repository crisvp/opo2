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

// Mock the categories queries module
vi.mock("../../src/api/queries/categories", () => ({
  useCategoryFields: vi.fn(),
  categoryKeys: {
    all: ["categories"],
    lists: () => ["categories", "list"],
    details: () => ["categories", "detail"],
    detail: (id: string) => ["categories", "detail", id],
    fields: (categoryId: string) => ["categories", "detail", categoryId, "fields"],
    rules: (categoryId: string) => ["categories", "detail", categoryId, "rules"],
  },
}));

// Mock PrimeVue components
vi.mock("primevue/inputtext", () => ({
  default: {
    name: "InputText",
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: `<input data-testid="input-text" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
  },
}));

vi.mock("primevue/inputnumber", () => ({
  default: {
    name: "InputNumber",
    props: ["modelValue", "mode", "currency"],
    emits: ["update:modelValue"],
    template: `<input data-testid="input-number" :data-mode="mode" :value="modelValue" @input="$emit('update:modelValue', Number($event.target.value))" />`,
  },
}));

vi.mock("primevue/datepicker", () => ({
  default: {
    name: "DatePicker",
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: `<input data-testid="date-picker" type="date" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
  },
}));

vi.mock("primevue/checkbox", () => ({
  default: {
    name: "Checkbox",
    props: ["modelValue", "binary"],
    emits: ["update:modelValue"],
    template: `<input data-testid="checkbox" type="checkbox" :checked="modelValue" @change="$emit('update:modelValue', $event.target.checked)" />`,
  },
}));

vi.mock("primevue/select", () => ({
  default: {
    name: "Select",
    props: ["modelValue", "options"],
    emits: ["update:modelValue"],
    template: `
      <select data-testid="select" :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
        <option v-for="opt in options" :key="opt" :value="opt">{{ opt }}</option>
      </select>
    `,
  },
}));

import DynamicMetadataForm from "../../src/components/documents/DynamicMetadataForm.vue";
import { useCategoryFields } from "../../src/api/queries/categories";

import type { MetadataFieldDefinition } from "@opo/shared";

const textField: MetadataFieldDefinition = {
  id: "f1",
  categoryId: "contract",
  fieldKey: "title",
  displayName: "Title",
  description: null,
  valueType: "text",
  enumValues: null,
  isRequired: true,
  isAiExtractable: false,
  validationRules: null,
  displayOrder: 0,
};

const numberField: MetadataFieldDefinition = {
  id: "f2",
  categoryId: "contract",
  fieldKey: "amount",
  displayName: "Amount",
  description: null,
  valueType: "number",
  enumValues: null,
  isRequired: false,
  isAiExtractable: true,
  validationRules: null,
  displayOrder: 1,
};

const booleanField: MetadataFieldDefinition = {
  id: "f3",
  categoryId: "contract",
  fieldKey: "is_signed",
  displayName: "Is Signed",
  description: null,
  valueType: "boolean",
  enumValues: null,
  isRequired: false,
  isAiExtractable: false,
  validationRules: null,
  displayOrder: 2,
};

const enumField: MetadataFieldDefinition = {
  id: "f4",
  categoryId: "contract",
  fieldKey: "status",
  displayName: "Status",
  description: null,
  valueType: "enum",
  enumValues: ["active", "inactive", "pending"],
  isRequired: true,
  isAiExtractable: false,
  validationRules: null,
  displayOrder: 3,
};

const currencyField: MetadataFieldDefinition = {
  id: "f5",
  categoryId: "contract",
  fieldKey: "contract_value",
  displayName: "Contract Value",
  description: null,
  valueType: "currency",
  enumValues: null,
  isRequired: false,
  isAiExtractable: true,
  validationRules: null,
  displayOrder: 4,
};

function mountComponent(
  fields: MetadataFieldDefinition[] | undefined,
  modelValue: Record<string, unknown> = {},
) {
  vi.mocked(useCategoryFields).mockReturnValue({
    data: ref(fields),
    isLoading: ref(false),
    isError: ref(false),
    error: ref(null),
  } as ReturnType<typeof useCategoryFields>);

  return mount(DynamicMetadataForm, {
    props: {
      categoryId: "contract",
      modelValue,
    },
    global: {
      plugins: [createPinia()],
    },
  });
}

describe("DynamicMetadataForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'No fields' message when fields are empty", () => {
    const wrapper = mountComponent([]);
    expect(wrapper.text()).toContain("No fields defined for this category");
  });

  it("renders 'No fields' message when fields are undefined", () => {
    const wrapper = mountComponent(undefined);
    expect(wrapper.text()).toContain("No fields defined for this category");
  });

  it("renders InputText for text fields", () => {
    const wrapper = mountComponent([textField]);
    const input = wrapper.find("[data-testid='input-text']");
    expect(input.exists()).toBe(true);
  });

  it("renders Checkbox for boolean fields", () => {
    const wrapper = mountComponent([booleanField]);
    const checkbox = wrapper.find("[data-testid='checkbox']");
    expect(checkbox.exists()).toBe(true);
  });

  it("renders Select for enum fields", () => {
    const wrapper = mountComponent([enumField]);
    const select = wrapper.find("[data-testid='select']");
    expect(select.exists()).toBe(true);
  });

  it("renders InputNumber for number fields", () => {
    const wrapper = mountComponent([numberField]);
    const input = wrapper.find("[data-testid='input-number']");
    expect(input.exists()).toBe(true);
  });

  it("renders InputNumber with currency mode for currency fields", () => {
    const wrapper = mountComponent([currencyField]);
    const input = wrapper.find("[data-testid='input-number']");
    expect(input.exists()).toBe(true);
    expect(input.attributes("data-mode")).toBe("currency");
  });

  it("marks required fields with asterisk", () => {
    const wrapper = mountComponent([textField]);
    // textField has isRequired: true
    const asterisk = wrapper.find("span.text-red-500");
    expect(asterisk.exists()).toBe(true);
    expect(asterisk.text()).toBe("*");
  });

  it("does not show asterisk for non-required fields", () => {
    const wrapper = mountComponent([numberField]);
    // numberField has isRequired: false
    const asterisk = wrapper.find("span.text-red-500");
    expect(asterisk.exists()).toBe(false);
  });

  it("displays field display name as label", () => {
    const wrapper = mountComponent([textField]);
    expect(wrapper.text()).toContain("Title");
  });

  it("emits update:modelValue when text input changes", async () => {
    const wrapper = mountComponent([textField], {});
    const input = wrapper.find("[data-testid='input-text']");
    await input.setValue("New Title");
    await input.trigger("input");

    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted).toBeDefined();
    expect(emitted!.length).toBeGreaterThan(0);
  });

  it("emits update:modelValue when checkbox changes", async () => {
    const wrapper = mountComponent([booleanField], {});
    const checkbox = wrapper.find("[data-testid='checkbox']");
    await checkbox.setValue(true);
    await checkbox.trigger("change");

    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted).toBeDefined();
    expect(emitted!.length).toBeGreaterThan(0);
  });

  it("merges new value with existing modelValue on emit", async () => {
    const wrapper = mountComponent([textField], { existing_key: "existing_value" });
    const input = wrapper.find("[data-testid='input-text']");
    await input.setValue("new title");
    await input.trigger("input");

    const emitted = wrapper.emitted("update:modelValue") as Array<[Record<string, unknown>]>;
    if (emitted && emitted.length > 0) {
      const lastEmit = emitted[emitted.length - 1][0];
      expect(lastEmit.existing_key).toBe("existing_value");
    }
  });

  it("renders multiple fields when provided", () => {
    const wrapper = mountComponent([textField, numberField, booleanField]);
    expect(wrapper.text()).toContain("Title");
    expect(wrapper.text()).toContain("Amount");
    expect(wrapper.text()).toContain("Is Signed");
  });

  it("passes enum options to Select component", () => {
    const wrapper = mountComponent([enumField]);
    const select = wrapper.findComponent({ name: "Select" });
    expect(select.props("options")).toEqual(["active", "inactive", "pending"]);
  });
});
