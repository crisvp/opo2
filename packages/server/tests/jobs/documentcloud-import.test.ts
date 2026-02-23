import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.mock factories are hoisted to the top of the file, so any variables they
// reference must be declared with vi.hoisted() to avoid temporal dead zone errors.

const mockAddJob = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockRelease = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockPutObject = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

const mockExecuteTakeFirst = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockExecute = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockSet = vi.hoisted(() => vi.fn());
const mockValues = vi.hoisted(() => vi.fn());
const mockDb = vi.hoisted(() => ({
  selectFrom: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  executeTakeFirst: mockExecuteTakeFirst,
  updateTable: vi.fn().mockReturnThis(),
  set: mockSet,
  execute: mockExecute,
  insertInto: vi.fn().mockReturnThis(),
  values: mockValues,
  fn: vi.fn().mockReturnValue("count_expr"),
}));

// -- Mocks --

vi.mock("nanoid", () => ({
  nanoid: vi.fn().mockReturnValue("test-doc-id"),
}));

vi.mock("../../src/services/storage.js", () => ({
  putObject: mockPutObject,
}));

vi.mock("graphile-worker", () => ({
  makeWorkerUtils: vi.fn().mockResolvedValue({
    addJob: mockAddJob,
    release: mockRelease,
  }),
}));

vi.mock("../../src/config/env.js", () => ({
  env: {
    DATABASE_URL: "postgresql://localhost:5432/test",
    S3_BUCKET: "test-bucket",
  },
}));

vi.mock("../../src/config/processing.js", () => ({
  TASK_TIMEOUTS: { documentcloud_import: 600_000 },
}));

vi.mock("../../src/util/db.js", () => ({
  getDb: vi.fn().mockReturnValue(mockDb),
}));

import { documentcloudImport } from "../../src/jobs/tasks/documentcloud-import.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_PAYLOAD = {
  importJobId: "job-123",
  documentCloudId: 12345,
  userId: "user-abc",
};

const DC_DOC = {
  id: 12345,
  title: "Surveillance Contract 2023",
  description: "A contract for CCTV deployment",
  pages: 5,
  canonical_url: "https://www.documentcloud.org/documents/12345",
  file_url: "https://pdf.documentcloud.org/documents/12345/document.pdf",
  organization: { name: "Test Org" },
  created_at: "2023-06-15T00:00:00Z",
};

function makeFetch({
  metaStatus = 200,
  pdfStatus = 200,
  dcDoc = DC_DOC as object,
} = {}) {
  return vi.fn().mockImplementation((url: string) => {
    if (String(url).includes("api.www.documentcloud.org")) {
      if (metaStatus !== 200) {
        return Promise.resolve({ ok: false, status: metaStatus });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(dcDoc) });
    }
    // PDF download URL
    if (pdfStatus !== 200) {
      return Promise.resolve({ ok: false, status: pdfStatus });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
    });
  });
}

function makeHelpers() {
  return {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    job: { id: 1 },
    addJob: vi.fn(),
    withPgClient: vi.fn(),
    query: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Payload validation
// ---------------------------------------------------------------------------

describe("documentcloudImport — payload validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws ZodError when importJobId is missing", async () => {
    await expect(
      documentcloudImport({ documentCloudId: 12345, userId: "u1" }, makeHelpers() as never),
    ).rejects.toThrow();
  });

  it("throws ZodError when documentCloudId is missing", async () => {
    await expect(
      documentcloudImport({ importJobId: "j1", userId: "u1" }, makeHelpers() as never),
    ).rejects.toThrow();
  });

  it("throws ZodError when userId is missing", async () => {
    await expect(
      documentcloudImport({ importJobId: "j1", documentCloudId: 12345 }, makeHelpers() as never),
    ).rejects.toThrow();
  });

  it("throws ZodError when documentCloudId is a string instead of number", async () => {
    await expect(
      documentcloudImport(
        { importJobId: "j1", documentCloudId: "12345", userId: "u1" },
        makeHelpers() as never,
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------

describe("documentcloudImport — success path", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue([]);
    mockExecuteTakeFirst.mockResolvedValue(undefined);
    mockSet.mockReturnThis();
    mockValues.mockReturnThis();
    fetchMock = makeFetch();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("fetches DC document metadata from the correct API URL", async () => {
    await documentcloudImport(VALID_PAYLOAD, makeHelpers() as never);

    const metaCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("api.www.documentcloud.org"),
    );
    expect(metaCall).toBeDefined();
    expect(String(metaCall![0])).toContain(String(VALID_PAYLOAD.documentCloudId));
  });

  it("downloads PDF from the file_url returned by the DC API", async () => {
    await documentcloudImport(VALID_PAYLOAD, makeHelpers() as never);

    const pdfCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("pdf.documentcloud.org"),
    );
    expect(pdfCall).toBeDefined();
    expect(String(pdfCall![0])).toBe(DC_DOC.file_url);
  });

  it("uploads PDF buffer to S3 with the correct key and content-type", async () => {
    await documentcloudImport(VALID_PAYLOAD, makeHelpers() as never);

    expect(mockPutObject).toHaveBeenCalledOnce();
    expect(mockPutObject).toHaveBeenCalledWith(
      "documents/test-doc-id/original.pdf",
      expect.any(Buffer),
      "application/pdf",
    );
  });

  it("inserts document row with state=submitted and source_name=documentcloud", async () => {
    await documentcloudImport(VALID_PAYLOAD, makeHelpers() as never);

    expect(mockDb.insertInto).toHaveBeenCalledWith("documents");
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "submitted",
        source_name: "documentcloud",
        source_id: String(DC_DOC.id),
        title: DC_DOC.title,
        description: DC_DOC.description,
        uploader_id: VALID_PAYLOAD.userId,
        filepath: "documents/test-doc-id/original.pdf",
      }),
    );
  });

  it("increments imported_count on the import job row", async () => {
    await documentcloudImport(VALID_PAYLOAD, makeHelpers() as never);

    const updateCalls = mockDb.updateTable.mock.calls.map(([t]: [string]) => t);
    expect(updateCalls).toContain("document_import_jobs");
  });

  it("enqueues virus_scan job with documentId, s3Key, and mimetype=application/pdf", async () => {
    await documentcloudImport(VALID_PAYLOAD, makeHelpers() as never);

    expect(mockAddJob).toHaveBeenCalledWith("virus_scan", {
      documentId: "test-doc-id",
      s3Key: "documents/test-doc-id/original.pdf",
      mimetype: "application/pdf",
    });
  });

  it("releases workerUtils after enqueueing", async () => {
    await documentcloudImport(VALID_PAYLOAD, makeHelpers() as never);
    expect(mockRelease).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Error: DC API failure
// ---------------------------------------------------------------------------

describe("documentcloudImport — DC API failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet.mockReturnThis();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("throws when DC API returns a non-200 status", async () => {
    vi.stubGlobal("fetch", makeFetch({ metaStatus: 404 }));
    await expect(
      documentcloudImport(VALID_PAYLOAD, makeHelpers() as never),
    ).rejects.toThrow("404");
  });

  it("increments error_count on the import job when DC API fails", async () => {
    vi.stubGlobal("fetch", makeFetch({ metaStatus: 500 }));
    await expect(
      documentcloudImport(VALID_PAYLOAD, makeHelpers() as never),
    ).rejects.toThrow();

    const updateCalls = mockDb.updateTable.mock.calls.map(([t]: [string]) => t);
    expect(updateCalls).toContain("document_import_jobs");
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ error_count: expect.anything() }),
    );
  });

  it("does not update document state when doc row was never created", async () => {
    vi.stubGlobal("fetch", makeFetch({ metaStatus: 404 }));
    mockExecuteTakeFirst.mockResolvedValue(undefined);

    await expect(
      documentcloudImport(VALID_PAYLOAD, makeHelpers() as never),
    ).rejects.toThrow();

    const updateCalls = mockDb.updateTable.mock.calls.map(([t]: [string]) => t);
    expect(updateCalls.filter((t: string) => t === "documents")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Error: missing file_url
// ---------------------------------------------------------------------------

describe("documentcloudImport — missing file_url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet.mockReturnThis();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("throws when DC document has no file_url", async () => {
    vi.stubGlobal("fetch", makeFetch({ dcDoc: { ...DC_DOC, file_url: null } }));
    await expect(
      documentcloudImport(VALID_PAYLOAD, makeHelpers() as never),
    ).rejects.toThrow("no file_url");
  });

  it("increments error_count when file_url is null", async () => {
    vi.stubGlobal("fetch", makeFetch({ dcDoc: { ...DC_DOC, file_url: null } }));
    await expect(
      documentcloudImport(VALID_PAYLOAD, makeHelpers() as never),
    ).rejects.toThrow();

    const updateCalls = mockDb.updateTable.mock.calls.map(([t]: [string]) => t);
    expect(updateCalls).toContain("document_import_jobs");
  });

  it("does not download a PDF when file_url is null", async () => {
    const fetchMock = makeFetch({ dcDoc: { ...DC_DOC, file_url: null } });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      documentcloudImport(VALID_PAYLOAD, makeHelpers() as never),
    ).rejects.toThrow();

    // Only one fetch call (metadata), no PDF download
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Error: PDF download failure
// ---------------------------------------------------------------------------

describe("documentcloudImport — PDF download failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet.mockReturnThis();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("throws when PDF download returns a non-200 status", async () => {
    vi.stubGlobal("fetch", makeFetch({ pdfStatus: 403 }));
    await expect(
      documentcloudImport(VALID_PAYLOAD, makeHelpers() as never),
    ).rejects.toThrow("403");
  });

  it("increments error_count when PDF download fails", async () => {
    vi.stubGlobal("fetch", makeFetch({ pdfStatus: 403 }));
    await expect(
      documentcloudImport(VALID_PAYLOAD, makeHelpers() as never),
    ).rejects.toThrow();

    const updateCalls = mockDb.updateTable.mock.calls.map(([t]: [string]) => t);
    expect(updateCalls).toContain("document_import_jobs");
  });

  it("does not upload to S3 when PDF download fails", async () => {
    vi.stubGlobal("fetch", makeFetch({ pdfStatus: 403 }));
    await expect(
      documentcloudImport(VALID_PAYLOAD, makeHelpers() as never),
    ).rejects.toThrow();

    expect(mockPutObject).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Error: S3 upload failure
// ---------------------------------------------------------------------------

describe("documentcloudImport — S3 upload failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet.mockReturnThis();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("throws when S3 upload fails", async () => {
    vi.stubGlobal("fetch", makeFetch());
    mockPutObject.mockRejectedValueOnce(new Error("S3 unavailable"));
    await expect(
      documentcloudImport(VALID_PAYLOAD, makeHelpers() as never),
    ).rejects.toThrow("S3 unavailable");
  });

  it("increments error_count when S3 upload fails", async () => {
    vi.stubGlobal("fetch", makeFetch());
    mockPutObject.mockRejectedValueOnce(new Error("S3 unavailable"));
    await expect(
      documentcloudImport(VALID_PAYLOAD, makeHelpers() as never),
    ).rejects.toThrow();

    const updateCalls = mockDb.updateTable.mock.calls.map(([t]: [string]) => t);
    expect(updateCalls).toContain("document_import_jobs");
  });

  it("does not create a document row when S3 upload fails", async () => {
    vi.stubGlobal("fetch", makeFetch());
    mockPutObject.mockRejectedValueOnce(new Error("S3 unavailable"));
    await expect(
      documentcloudImport(VALID_PAYLOAD, makeHelpers() as never),
    ).rejects.toThrow();

    const insertCalls = mockDb.insertInto.mock.calls.map(([t]: [string]) => t);
    expect(insertCalls.filter((t: string) => t === "documents")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Error: failure after document row created
// ---------------------------------------------------------------------------

describe("documentcloudImport — failure after document row is created", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet.mockReturnThis();
    mockValues.mockReturnThis();
    mockExecute.mockResolvedValue([]);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("marks document as processing_failed when enqueue fails after insert", async () => {
    vi.stubGlobal("fetch", makeFetch());
    mockAddJob.mockRejectedValueOnce(new Error("Worker unavailable"));
    // Error-handler check finds the doc row
    mockExecuteTakeFirst.mockResolvedValue({ id: "test-doc-id" });

    await expect(
      documentcloudImport(VALID_PAYLOAD, makeHelpers() as never),
    ).rejects.toThrow("Worker unavailable");

    const setCalls = mockSet.mock.calls as Array<[Record<string, unknown>]>;
    expect(setCalls.some(([args]) => args.state === "processing_failed")).toBe(true);
  });

  it("increments error_count even when failure occurs after insert", async () => {
    vi.stubGlobal("fetch", makeFetch());
    mockAddJob.mockRejectedValueOnce(new Error("Worker unavailable"));
    mockExecuteTakeFirst.mockResolvedValue({ id: "test-doc-id" });

    await expect(
      documentcloudImport(VALID_PAYLOAD, makeHelpers() as never),
    ).rejects.toThrow();

    const updateCalls = mockDb.updateTable.mock.calls.map(([t]: [string]) => t);
    expect(updateCalls).toContain("document_import_jobs");
  });

  it("does not set processing_failed when no doc row exists at time of error", async () => {
    vi.stubGlobal("fetch", makeFetch());
    mockAddJob.mockRejectedValueOnce(new Error("Worker unavailable"));
    mockExecuteTakeFirst.mockResolvedValue(undefined);

    await expect(
      documentcloudImport(VALID_PAYLOAD, makeHelpers() as never),
    ).rejects.toThrow();

    const setCalls = mockSet.mock.calls as Array<[Record<string, unknown>]>;
    expect(setCalls.some(([args]) => args.state === "processing_failed")).toBe(false);
  });
});
