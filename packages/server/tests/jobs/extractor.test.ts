import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Test the parseExtractorResponse helper (pure function, no external deps)
// ---------------------------------------------------------------------------

import { parseExtractorResponse } from "../../src/jobs/tasks/extractor.js";

describe("parseExtractorResponse()", () => {
  it("parses a valid JSON response", () => {
    const content = JSON.stringify({
      title: "Surveillance Policy 2023",
      description: "A policy governing CCTV usage.",
      document_date: "2023-01-15",
      metadata: [
        { key: "vendor_name", value: "Axon", confidence: 0.95 },
        { key: "technology_type", value: "body_camera", confidence: 0.88 },
      ],
    });

    const result = parseExtractorResponse(content);

    expect(result.title).toBe("Surveillance Policy 2023");
    expect(result.description).toBe("A policy governing CCTV usage.");
    expect(result.document_date).toBe("2023-01-15");
    expect(result.metadata).toHaveLength(2);
    expect(result.metadata[0].key).toBe("vendor_name");
    expect(result.metadata[0].value).toBe("Axon");
    expect(result.metadata[0].confidence).toBe(0.95);
  });

  it("strips markdown code fences before parsing", () => {
    const content = "```json\n" + JSON.stringify({ title: "Test", metadata: [] }) + "\n```";
    const result = parseExtractorResponse(content);
    expect(result.title).toBe("Test");
  });

  it("strips bare code fences before parsing", () => {
    const content = "```\n" + JSON.stringify({ title: "Test", metadata: [] }) + "\n```";
    const result = parseExtractorResponse(content);
    expect(result.title).toBe("Test");
  });

  it("defaults metadata to empty array when not provided", () => {
    const content = JSON.stringify({ title: "No Metadata" });
    const result = parseExtractorResponse(content);
    expect(Array.isArray(result.metadata)).toBe(true);
    expect(result.metadata).toHaveLength(0);
  });

  it("allows null document_date", () => {
    const content = JSON.stringify({ title: "Test", document_date: null, metadata: [] });
    const result = parseExtractorResponse(content);
    expect(result.document_date).toBeNull();
  });

  it("allows optional fields to be missing", () => {
    const content = JSON.stringify({ metadata: [] });
    const result = parseExtractorResponse(content);
    expect(result.title).toBeUndefined();
    expect(result.description).toBeUndefined();
  });

  it("throws on invalid JSON", () => {
    expect(() => parseExtractorResponse("not json at all")).toThrow();
  });

  it("throws on invalid confidence value (out of 0-1 range)", () => {
    const content = JSON.stringify({
      metadata: [{ key: "test", value: "val", confidence: 1.5 }],
    });
    expect(() => parseExtractorResponse(content)).toThrow();
  });

  it("throws on missing required metadata fields", () => {
    const content = JSON.stringify({
      metadata: [{ key: "test" }], // missing value and confidence
    });
    expect(() => parseExtractorResponse(content)).toThrow();
  });
});
