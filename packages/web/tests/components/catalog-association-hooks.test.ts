import { describe, it, expect } from "vitest";
import { useCreateCatalogAssociation, useDeleteCatalogAssociation } from "../../src/api/queries/catalog.js";

describe("useCreateCatalogAssociation", () => {
  it("is exported as a function", () => {
    expect(typeof useCreateCatalogAssociation).toBe("function");
  });
});

describe("useDeleteCatalogAssociation", () => {
  it("is exported as a function", () => {
    expect(typeof useDeleteCatalogAssociation).toBe("function");
  });
});
