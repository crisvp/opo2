import { describe, it, expect } from "vitest";

import {
  createCategorySchema,
  updateCategorySchema,
  updateCategoryRulesSchema,
  DOCUMENT_CATEGORIES,
} from "../src/types/category.js";

import {
  createFieldDefinitionSchema,
  updateFieldDefinitionSchema,
  FIELD_TYPES,
} from "../src/types/metadata.js";

// ---------------------------------------------------------------------------
// DOCUMENT_CATEGORIES constant
// ---------------------------------------------------------------------------

describe("DOCUMENT_CATEGORIES", () => {
  it("contains contract", () => {
    expect(DOCUMENT_CATEGORIES.CONTRACT).toBe("contract");
  });

  it("contains all 13 expected categories", () => {
    const values = Object.values(DOCUMENT_CATEGORIES);
    expect(values).toContain("contract");
    expect(values).toContain("proposal");
    expect(values).toContain("policy");
    expect(values).toContain("meeting_agenda");
    expect(values).toContain("meeting_minutes");
    expect(values).toContain("invoice");
    expect(values).toContain("correspondence");
    expect(values).toContain("audit_report");
    expect(values).toContain("training_material");
    expect(values).toContain("foia_request");
    expect(values).toContain("procurement");
    expect(values).toContain("compliance");
    expect(values).toContain("other");
    expect(values.length).toBe(13);
  });
});

// ---------------------------------------------------------------------------
// FIELD_TYPES constant
// ---------------------------------------------------------------------------

describe("FIELD_TYPES", () => {
  it("contains all 6 field types", () => {
    const values = Object.values(FIELD_TYPES);
    expect(values).toContain("text");
    expect(values).toContain("number");
    expect(values).toContain("date");
    expect(values).toContain("boolean");
    expect(values).toContain("currency");
    expect(values).toContain("enum");
    expect(values.length).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// createCategorySchema
// ---------------------------------------------------------------------------

describe("createCategorySchema", () => {
  it("accepts a valid category with all fields", () => {
    const result = createCategorySchema.safeParse({
      id: "contract",
      name: "Contract",
      description: "Legal contracts",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid category without description", () => {
    const result = createCategorySchema.safeParse({
      id: "invoice",
      name: "Invoice",
    });
    expect(result.success).toBe(true);
  });

  it("accepts description as null", () => {
    const result = createCategorySchema.safeParse({
      id: "policy",
      name: "Policy",
      description: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects id starting with a number", () => {
    const result = createCategorySchema.safeParse({
      id: "1contract",
      name: "Contract",
    });
    expect(result.success).toBe(false);
  });

  it("rejects id with uppercase letters", () => {
    const result = createCategorySchema.safeParse({
      id: "Contract",
      name: "Contract",
    });
    expect(result.success).toBe(false);
  });

  it("rejects id with hyphens", () => {
    const result = createCategorySchema.safeParse({
      id: "my-category",
      name: "My Category",
    });
    expect(result.success).toBe(false);
  });

  it("accepts id with underscores", () => {
    const result = createCategorySchema.safeParse({
      id: "meeting_agenda",
      name: "Meeting Agenda",
    });
    expect(result.success).toBe(true);
  });

  it("rejects id longer than 50 characters", () => {
    const result = createCategorySchema.safeParse({
      id: "a".repeat(51),
      name: "Too Long",
    });
    expect(result.success).toBe(false);
  });

  it("accepts id of exactly 50 characters", () => {
    const result = createCategorySchema.safeParse({
      id: "a".repeat(50),
      name: "Max Length",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty id", () => {
    const result = createCategorySchema.safeParse({
      id: "",
      name: "Empty ID",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = createCategorySchema.safeParse({
      id: "contract",
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 200 characters", () => {
    const result = createCategorySchema.safeParse({
      id: "contract",
      name: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("accepts name of exactly 200 characters", () => {
    const result = createCategorySchema.safeParse({
      id: "contract",
      name: "a".repeat(200),
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateCategorySchema
// ---------------------------------------------------------------------------

describe("updateCategorySchema", () => {
  it("accepts partial update with only name", () => {
    const result = updateCategorySchema.safeParse({ name: "Updated Name" });
    expect(result.success).toBe(true);
  });

  it("accepts partial update with only description", () => {
    const result = updateCategorySchema.safeParse({ description: "New description" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (no changes)", () => {
    const result = updateCategorySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts description as null to clear it", () => {
    const result = updateCategorySchema.safeParse({ description: null });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateCategoryRulesSchema
// ---------------------------------------------------------------------------

describe("updateCategoryRulesSchema", () => {
  it("accepts all nullable fields set to null", () => {
    const result = updateCategoryRulesSchema.safeParse({
      minVendors: null,
      maxVendors: null,
      minProducts: null,
      maxProducts: null,
      minTechnologies: null,
      maxTechnologies: null,
      minGovernmentEntities: null,
      maxGovernmentEntities: null,
      requireGovernmentLocation: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid min/max integer values", () => {
    const result = updateCategoryRulesSchema.safeParse({
      minVendors: 1,
      maxVendors: 5,
      minProducts: 0,
      maxProducts: 10,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative values", () => {
    const result = updateCategoryRulesSchema.safeParse({
      minVendors: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer values", () => {
    const result = updateCategoryRulesSchema.safeParse({
      minVendors: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty object", () => {
    const result = updateCategoryRulesSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts requireGovernmentLocation as boolean", () => {
    const result = updateCategoryRulesSchema.safeParse({
      requireGovernmentLocation: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts zero as a valid value for min fields", () => {
    const result = updateCategoryRulesSchema.safeParse({
      minVendors: 0,
      minProducts: 0,
      minTechnologies: 0,
      minGovernmentEntities: 0,
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createFieldDefinitionSchema
// ---------------------------------------------------------------------------

describe("createFieldDefinitionSchema", () => {
  it("accepts a valid field definition", () => {
    const result = createFieldDefinitionSchema.safeParse({
      categoryId: "contract",
      fieldKey: "contract_value",
      displayName: "Contract Value",
      valueType: "currency",
    });
    expect(result.success).toBe(true);
  });

  it("rejects fieldKey starting with a number", () => {
    const result = createFieldDefinitionSchema.safeParse({
      categoryId: "contract",
      fieldKey: "1field",
      displayName: "Field",
      valueType: "text",
    });
    expect(result.success).toBe(false);
  });

  it("rejects fieldKey with uppercase letters", () => {
    const result = createFieldDefinitionSchema.safeParse({
      categoryId: "contract",
      fieldKey: "MyField",
      displayName: "Field",
      valueType: "text",
    });
    expect(result.success).toBe(false);
  });

  it("accepts fieldKey with underscores", () => {
    const result = createFieldDefinitionSchema.safeParse({
      categoryId: "contract",
      fieldKey: "my_field_key",
      displayName: "My Field",
      valueType: "text",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid valueType", () => {
    const result = createFieldDefinitionSchema.safeParse({
      categoryId: "contract",
      fieldKey: "amount",
      displayName: "Amount",
      valueType: "money",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid field types", () => {
    const types = ["text", "number", "date", "boolean", "currency", "enum"] as const;
    for (const type of types) {
      const result = createFieldDefinitionSchema.safeParse({
        categoryId: "contract",
        fieldKey: "some_field",
        displayName: "Some Field",
        valueType: type,
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts enumValues as string array", () => {
    const result = createFieldDefinitionSchema.safeParse({
      categoryId: "contract",
      fieldKey: "status",
      displayName: "Status",
      valueType: "enum",
      enumValues: ["active", "inactive", "pending"],
    });
    expect(result.success).toBe(true);
  });

  it("defaults isRequired to false", () => {
    const result = createFieldDefinitionSchema.safeParse({
      categoryId: "contract",
      fieldKey: "amount",
      displayName: "Amount",
      valueType: "number",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isRequired).toBe(false);
    }
  });

  it("defaults isAiExtractable to false", () => {
    const result = createFieldDefinitionSchema.safeParse({
      categoryId: "contract",
      fieldKey: "amount",
      displayName: "Amount",
      valueType: "number",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isAiExtractable).toBe(false);
    }
  });

  it("defaults displayOrder to 0", () => {
    const result = createFieldDefinitionSchema.safeParse({
      categoryId: "contract",
      fieldKey: "amount",
      displayName: "Amount",
      valueType: "number",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.displayOrder).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// updateFieldDefinitionSchema
// ---------------------------------------------------------------------------

describe("updateFieldDefinitionSchema", () => {
  it("accepts empty object", () => {
    const result = updateFieldDefinitionSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts partial update with only displayName", () => {
    const result = updateFieldDefinitionSchema.safeParse({ displayName: "New Name" });
    expect(result.success).toBe(true);
  });

  it("does not include categoryId", () => {
    const result = updateFieldDefinitionSchema.safeParse({ categoryId: "something" });
    // categoryId is stripped (omitted), so it should succeed but data won't have it
    expect(result.success).toBe(true);
    if (result.success) {
      expect("categoryId" in result.data).toBe(false);
    }
  });

  it("rejects invalid valueType", () => {
    const result = updateFieldDefinitionSchema.safeParse({ valueType: "invalid" });
    expect(result.success).toBe(false);
  });
});
