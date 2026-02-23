import { describe, it, expect } from "vitest";

import {
  createCatalogEntrySchema,
  updateCatalogEntrySchema,
  createAliasSchema,
  CATALOG_TYPES,
  ALIAS_SOURCES,
} from "../src/types/catalog.js";

// ---------------------------------------------------------------------------
// Alias normalization
// ---------------------------------------------------------------------------

function normalizeAlias(alias: string): string {
  return alias.trim().toLowerCase();
}

describe("alias normalization", () => {
  it("lowercases an alias", () => {
    expect(normalizeAlias("Palantir Technologies")).toBe("palantir technologies");
  });

  it("trims leading/trailing whitespace", () => {
    expect(normalizeAlias("  Axon  ")).toBe("axon");
  });

  it("trims and lowercases combined", () => {
    expect(normalizeAlias("  CLEARVIEW AI  ")).toBe("clearview ai");
  });

  it("preserves inner whitespace", () => {
    expect(normalizeAlias("ShotSpotter Inc")).toBe("shotspotter inc");
  });

  it("handles already-normalized alias", () => {
    expect(normalizeAlias("vendor name")).toBe("vendor name");
  });

  it("empty string normalizes to empty string", () => {
    expect(normalizeAlias("")).toBe("");
  });

  it("whitespace-only string normalizes to empty string", () => {
    expect(normalizeAlias("   ")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// CATALOG_TYPES constant
// ---------------------------------------------------------------------------

describe("CATALOG_TYPES", () => {
  it("contains all six expected types", () => {
    expect(CATALOG_TYPES.VENDOR).toBe("vendor");
    expect(CATALOG_TYPES.PRODUCT).toBe("product");
    expect(CATALOG_TYPES.TECHNOLOGY).toBe("technology");
    expect(CATALOG_TYPES.GOVERNMENT_ENTITY).toBe("government_entity");
    expect(CATALOG_TYPES.PERSON).toBe("person");
    expect(CATALOG_TYPES.ORGANIZATION).toBe("organization");
  });
});

// ---------------------------------------------------------------------------
// ALIAS_SOURCES constant
// ---------------------------------------------------------------------------

describe("ALIAS_SOURCES", () => {
  it("contains all three alias source values", () => {
    expect(ALIAS_SOURCES.MANUAL).toBe("manual");
    expect(ALIAS_SOURCES.AI_SUGGESTION).toBe("ai_suggestion");
    expect(ALIAS_SOURCES.IMPORT).toBe("import");
  });
});

// ---------------------------------------------------------------------------
// createCatalogEntrySchema validation
// ---------------------------------------------------------------------------

describe("createCatalogEntrySchema", () => {
  it("accepts a minimal valid entry", () => {
    const result = createCatalogEntrySchema.safeParse({
      typeId: "vendor",
      name: "Palantir",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a full entry", () => {
    const result = createCatalogEntrySchema.safeParse({
      typeId: "vendor",
      name: "Palantir Technologies",
      attributes: { country: "US" },
      isVerified: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isVerified).toBe(true);
    }
  });

  it("defaults isVerified to false when not provided", () => {
    const result = createCatalogEntrySchema.safeParse({
      typeId: "vendor",
      name: "Axon",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isVerified).toBe(false);
    }
  });

  it("rejects empty name", () => {
    const result = createCatalogEntrySchema.safeParse({
      typeId: "vendor",
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name over 500 characters", () => {
    const result = createCatalogEntrySchema.safeParse({
      typeId: "vendor",
      name: "a".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("accepts name of exactly 500 characters", () => {
    const result = createCatalogEntrySchema.safeParse({
      typeId: "vendor",
      name: "a".repeat(500),
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing typeId", () => {
    const result = createCatalogEntrySchema.safeParse({
      name: "Palantir",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = createCatalogEntrySchema.safeParse({
      typeId: "vendor",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateCatalogEntrySchema validation
// ---------------------------------------------------------------------------

describe("updateCatalogEntrySchema", () => {
  it("accepts all fields optional", () => {
    const result = updateCatalogEntrySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts name only", () => {
    const result = updateCatalogEntrySchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("accepts isVerified update", () => {
    const result = updateCatalogEntrySchema.safeParse({ isVerified: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isVerified).toBe(true);
    }
  });

  it("rejects empty name", () => {
    const result = updateCatalogEntrySchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name over 500 characters", () => {
    const result = updateCatalogEntrySchema.safeParse({ name: "x".repeat(501) });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createAliasSchema validation
// ---------------------------------------------------------------------------

describe("createAliasSchema", () => {
  it("accepts a valid alias with default source", () => {
    const result = createAliasSchema.safeParse({ alias: "Palantir" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe("manual");
    }
  });

  it("accepts alias with explicit source", () => {
    const result = createAliasSchema.safeParse({
      alias: "AI Name",
      source: "ai_suggestion",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe("ai_suggestion");
    }
  });

  it("accepts import source", () => {
    const result = createAliasSchema.safeParse({
      alias: "Imported Name",
      source: "import",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty alias", () => {
    const result = createAliasSchema.safeParse({ alias: "" });
    expect(result.success).toBe(false);
  });

  it("rejects alias over 500 characters", () => {
    const result = createAliasSchema.safeParse({ alias: "a".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("rejects invalid source value", () => {
    const result = createAliasSchema.safeParse({
      alias: "Some Alias",
      source: "invalid_source",
    });
    expect(result.success).toBe(false);
  });
});
