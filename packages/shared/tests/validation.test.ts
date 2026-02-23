import { describe, expect, it } from "vitest";

import { createCatalogEntrySchema } from "../src/types/catalog.js";
import { createDocumentSchema, initiateUploadSchema } from "../src/types/document.js";
import { locationInputSchema } from "../src/types/location.js";
import { setApiKeySchema } from "../src/types/user.js";

describe("createDocumentSchema", () => {
  it("accepts valid input", () => {
    const result = createDocumentSchema.safeParse({
      title: "Test Document",
      description: "A description",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = createDocumentSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects title over 500 chars", () => {
    const result = createDocumentSchema.safeParse({ title: "a".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("rejects description over 5000 chars", () => {
    const result = createDocumentSchema.safeParse({
      title: "Title",
      description: "a".repeat(5001),
    });
    expect(result.success).toBe(false);
  });
});

describe("initiateUploadSchema", () => {
  const validBase = {
    filename: "file.pdf",
    mimetype: "application/pdf",
    governmentLevel: "state" as const,
    stateUsps: "IA",
    useAi: false,
  };

  it("rejects files over 50 MB", () => {
    const result = initiateUploadSchema.safeParse({ ...validBase, size: 52_428_801 });
    expect(result.success).toBe(false);
  });

  it("accepts max 50 MB", () => {
    const result = initiateUploadSchema.safeParse({ ...validBase, size: 52_428_800 });
    expect(result.success).toBe(true);
  });

  it("rejects when governmentLevel is missing", () => {
    const { governmentLevel: _, ...withoutLevel } = { ...validBase, size: 1024 };
    const result = initiateUploadSchema.safeParse(withoutLevel);
    expect(result.success).toBe(false);
  });
});

describe("locationInputSchema", () => {
  it("accepts federal level with no location fields", () => {
    const result = locationInputSchema.safeParse({
      governmentLevel: "federal",
      stateUsps: null,
      placeGeoid: null,
      tribeId: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects state level without stateUsps", () => {
    const result = locationInputSchema.safeParse({
      governmentLevel: "state",
      stateUsps: null,
      placeGeoid: null,
      tribeId: null,
    });
    expect(result.success).toBe(false);
  });

  it("accepts state level with stateUsps", () => {
    const result = locationInputSchema.safeParse({
      governmentLevel: "state",
      stateUsps: "TX",
      placeGeoid: null,
      tribeId: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects place level without placeGeoid", () => {
    const result = locationInputSchema.safeParse({
      governmentLevel: "place",
      stateUsps: "TX",
      placeGeoid: null,
      tribeId: null,
    });
    expect(result.success).toBe(false);
  });

  it("accepts tribal level with tribeId", () => {
    const result = locationInputSchema.safeParse({
      governmentLevel: "tribal",
      stateUsps: null,
      placeGeoid: null,
      tribeId: "tribe-123",
    });
    expect(result.success).toBe(true);
  });
});

describe("setApiKeySchema", () => {
  it("accepts valid OpenRouter key", () => {
    const result = setApiKeySchema.safeParse({ key: "sk-or-v1-" + "a".repeat(40) });
    expect(result.success).toBe(true);
  });

  it("rejects key not starting with sk-or-", () => {
    const result = setApiKeySchema.safeParse({ key: "sk-abc-" + "a".repeat(40) });
    expect(result.success).toBe(false);
  });

  it("rejects key under 20 chars", () => {
    const result = setApiKeySchema.safeParse({ key: "sk-or-short" });
    expect(result.success).toBe(false);
  });
});

describe("createCatalogEntrySchema", () => {
  it("accepts valid entry", () => {
    const result = createCatalogEntrySchema.safeParse({
      typeId: "vendor",
      name: "Palantir",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createCatalogEntrySchema.safeParse({
      typeId: "vendor",
      name: "",
    });
    expect(result.success).toBe(false);
  });
});
