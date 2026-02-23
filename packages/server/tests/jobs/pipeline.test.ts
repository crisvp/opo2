import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock external dependencies before importing tasks ----

vi.mock("pg", () => {
  const mockClient = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  };
  const MockPool = vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(mockClient),
    end: vi.fn().mockResolvedValue(undefined),
  }));
  return { Pool: MockPool };
});

vi.mock("../../src/services/storage.js", () => ({
  getObjectStream: vi.fn(),
  putObject: vi.fn(),
  getPresignedDownloadUrl: vi.fn().mockResolvedValue("https://example.com/presigned"),
  deleteObject: vi.fn(),
  createPresignedUploadUrl: vi.fn(),
  headObject: vi.fn(),
}));

vi.mock("../../src/services/libreoffice.js", () => ({
  convertToPdf: vi.fn(),
}));

vi.mock("../../src/services/openrouter.js", () => ({
  chatCompletion: vi.fn(),
}));

vi.mock("graphile-worker", () => ({
  makeWorkerUtils: vi.fn().mockResolvedValue({
    addJob: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../../src/util/db.js", () => {
  const mockExecuteTakeFirst = vi.fn().mockResolvedValue(undefined);
  const mockExecute = vi.fn().mockResolvedValue([]);
  const mockDb = {
    selectFrom: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: mockExecuteTakeFirst,
    updateTable: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: mockExecute,
    insertInto: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflict: vi.fn().mockReturnThis(),
    column: vi.fn().mockReturnThis(),
    columns: vi.fn().mockReturnThis(),
    doUpdateSet: vi.fn().mockReturnThis(),
  };
  return { getDb: vi.fn().mockReturnValue(mockDb) };
});

vi.mock("../../src/config/env.js", () => ({
  env: {
    DATABASE_URL: "postgresql://localhost:5432/test",
    CLAMAV_HOST: "localhost",
    CLAMAV_PORT: 3310,
    OPENROUTER_API_KEY: "test-key",
    LIBREOFFICE_SIDECAR_URL: "http://localhost:4000",
    S3_BUCKET: "test-bucket",
  },
}));

// ---- Import modules under test ----
import { parseSieveResponse } from "../../src/jobs/tasks/sieve.js";
import { parseExtractorResponse } from "../../src/jobs/tasks/extractor.js";
import { determineNewState } from "../../src/jobs/tasks/pipeline-complete.js";
import { cleanupExpiredDrafts } from "../../src/jobs/tasks/cleanup-expired-drafts.js";
import { virusScan } from "../../src/jobs/tasks/virus-scan.js";

// ---- Helpers ----

function makeHelpers(overrides: Partial<{ logger: object; job: object }> = {}) {
  return {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    job: { id: 42 },
    addJob: vi.fn(),
    withPgClient: vi.fn(),
    query: vi.fn(),
    ...overrides,
  };
}

// ---- Tests ----

describe("cleanupExpiredDrafts", () => {
  it("runs without error when db returns empty results", async () => {
    const helpers = makeHelpers();
    // Should not throw
    await expect(cleanupExpiredDrafts({}, helpers as never)).resolves.toBeUndefined();
  });
});

describe("virus-scan payload validation", () => {
  it("throws ZodError when documentId is missing", async () => {
    const helpers = makeHelpers();
    await expect(
      virusScan({ s3Key: "documents/abc/file.pdf", mimetype: "application/pdf" }, helpers as never),
    ).rejects.toThrow();
  });

  it("throws ZodError when s3Key is missing", async () => {
    const helpers = makeHelpers();
    await expect(
      virusScan({ documentId: "abc123", mimetype: "application/pdf" }, helpers as never),
    ).rejects.toThrow();
  });

  it("throws ZodError when payload is empty", async () => {
    const helpers = makeHelpers();
    await expect(virusScan({}, helpers as never)).rejects.toThrow();
  });
});

describe("determineNewState (pipeline-complete)", () => {
  it("returns rejected state when sieve_category is JUNK", () => {
    const result = determineNewState("JUNK");
    expect(result.state).toBe("rejected");
    expect(result.rejectionReason).toBe("Document classified as junk by AI");
  });

  it("returns user_review state when sieve_category is HIGH_RELEVANCE", () => {
    const result = determineNewState("HIGH_RELEVANCE");
    expect(result.state).toBe("user_review");
    expect(result.rejectionReason).toBeNull();
  });

  it("returns user_review state when sieve_category is ADMIN_FINANCE", () => {
    const result = determineNewState("ADMIN_FINANCE");
    expect(result.state).toBe("user_review");
    expect(result.rejectionReason).toBeNull();
  });

  it("returns user_review state when sieve_category is UNCERTAIN", () => {
    const result = determineNewState("UNCERTAIN");
    expect(result.state).toBe("user_review");
    expect(result.rejectionReason).toBeNull();
  });

  it("returns user_review state when sieve_category is null (no results)", () => {
    const result = determineNewState(null);
    expect(result.state).toBe("user_review");
    expect(result.rejectionReason).toBeNull();
  });

  it("returns user_review state when sieve_category is undefined", () => {
    const result = determineNewState(undefined);
    expect(result.state).toBe("user_review");
    expect(result.rejectionReason).toBeNull();
  });
});

describe("parseSieveResponse", () => {
  it("parses valid JSON sieve response", () => {
    const rawJson = JSON.stringify({
      category: "HIGH_RELEVANCE",
      nexus_score: 0.9,
      junk_score: 0.05,
      confidence: 0.95,
      reasoning: "Document contains surveillance contract details",
    });
    const result = parseSieveResponse(rawJson);
    expect(result.category).toBe("HIGH_RELEVANCE");
    expect(result.nexus_score).toBe(0.9);
    expect(result.junk_score).toBe(0.05);
    expect(result.confidence).toBe(0.95);
    expect(result.reasoning).toBe("Document contains surveillance contract details");
  });

  it("parses JSON wrapped in markdown code fences", () => {
    const markdown = "```json\n" + JSON.stringify({
      category: "JUNK",
      nexus_score: 0.02,
      junk_score: 0.98,
      confidence: 0.99,
      reasoning: "Personal document unrelated to surveillance",
    }) + "\n```";
    const result = parseSieveResponse(markdown);
    expect(result.category).toBe("JUNK");
    expect(result.junk_score).toBe(0.98);
  });

  it("parses ADMIN_FINANCE category", () => {
    const rawJson = JSON.stringify({
      category: "ADMIN_FINANCE",
      nexus_score: 0.3,
      junk_score: 0.1,
      confidence: 0.8,
      reasoning: "Financial report",
    });
    const result = parseSieveResponse(rawJson);
    expect(result.category).toBe("ADMIN_FINANCE");
  });

  it("parses UNCERTAIN category", () => {
    const rawJson = JSON.stringify({
      category: "UNCERTAIN",
      nexus_score: 0.5,
      junk_score: 0.2,
      confidence: 0.4,
      reasoning: "Cannot determine",
    });
    const result = parseSieveResponse(rawJson);
    expect(result.category).toBe("UNCERTAIN");
  });

  it("throws on invalid category", () => {
    const rawJson = JSON.stringify({
      category: "INVALID_CATEGORY",
      nexus_score: 0.5,
      junk_score: 0.2,
      confidence: 0.4,
      reasoning: "test",
    });
    expect(() => parseSieveResponse(rawJson)).toThrow();
  });

  it("throws on malformed JSON", () => {
    expect(() => parseSieveResponse("not json at all")).toThrow();
  });
});

describe("parseExtractorResponse", () => {
  it("parses valid extractor JSON response", () => {
    const rawJson = JSON.stringify({
      title: "Surveillance Contract 2023",
      description: "A contract between city and vendor for CCTV deployment.",
      document_date: "2023-06-15",
      metadata: [
        { key: "vendor_name", value: "AcmeSurv Corp", confidence: 0.95 },
        { key: "technology_type", value: "CCTV", confidence: 0.9 },
      ],
    });
    const result = parseExtractorResponse(rawJson);
    expect(result.title).toBe("Surveillance Contract 2023");
    expect(result.description).toBe("A contract between city and vendor for CCTV deployment.");
    expect(result.document_date).toBe("2023-06-15");
    expect(result.metadata).toHaveLength(2);
    expect(result.metadata[0].key).toBe("vendor_name");
    expect(result.metadata[0].value).toBe("AcmeSurv Corp");
    expect(result.metadata[0].confidence).toBe(0.95);
  });

  it("parses response with empty metadata array", () => {
    const rawJson = JSON.stringify({
      title: "Unknown Document",
      description: "Could not extract details.",
      document_date: null,
      metadata: [],
    });
    const result = parseExtractorResponse(rawJson);
    expect(result.metadata).toHaveLength(0);
    expect(result.document_date).toBeNull();
  });

  it("parses response wrapped in markdown code fences", () => {
    const markdown = "```json\n" + JSON.stringify({
      title: "Test",
      description: "Test document",
      document_date: null,
      metadata: [{ key: "contract_value", value: "$1,000,000", confidence: 0.8 }],
    }) + "\n```";
    const result = parseExtractorResponse(markdown);
    expect(result.title).toBe("Test");
    expect(result.metadata[0].key).toBe("contract_value");
  });

  it("handles missing optional fields gracefully", () => {
    const rawJson = JSON.stringify({ metadata: [] });
    const result = parseExtractorResponse(rawJson);
    expect(result.title).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.metadata).toHaveLength(0);
  });

  it("throws on malformed JSON", () => {
    expect(() => parseExtractorResponse("{bad json")).toThrow();
  });
});
