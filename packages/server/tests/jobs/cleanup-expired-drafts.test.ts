import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoist mocks so they are available inside vi.mock factories
// ---------------------------------------------------------------------------

const { mockQuery, mockRelease, mockPoolConnect, mockPoolEnd, mockDeleteObject } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockRelease = vi.fn();
  const mockPoolConnect = vi.fn().mockResolvedValue({ query: mockQuery, release: mockRelease });
  const mockPoolEnd = vi.fn().mockResolvedValue(undefined);
  const mockDeleteObject = vi.fn().mockResolvedValue(undefined);
  return { mockQuery, mockRelease, mockPoolConnect, mockPoolEnd, mockDeleteObject };
});

// ---------------------------------------------------------------------------
// Mock pg Pool so we don't need a real DB connection
// ---------------------------------------------------------------------------

vi.mock("pg", () => ({
  Pool: vi.fn().mockImplementation(() => ({
    connect: mockPoolConnect,
    end: mockPoolEnd,
  })),
}));

// ---------------------------------------------------------------------------
// Mock storage so we can verify deleteObject is called
// ---------------------------------------------------------------------------

vi.mock("../../src/services/storage.js", () => ({
  deleteObject: mockDeleteObject,
  createPresignedUploadUrl: vi.fn(),
  headObject: vi.fn(),
  getPresignedDownloadUrl: vi.fn(),
  getObject: vi.fn(),
  getObjectStream: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock graphile-worker helpers (TASK_TIMEOUTS is imported from config)
// ---------------------------------------------------------------------------

vi.mock("../../src/config/processing.js", () => ({
  TASK_TIMEOUTS: { cleanup_expired_drafts: 120_000 },
}));

// ---------------------------------------------------------------------------
// Import task under test AFTER mocks are set up
// ---------------------------------------------------------------------------

import { cleanupExpiredDrafts } from "../../src/jobs/tasks/cleanup-expired-drafts.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHelpers() {
  return {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    job: {},
    withPgClient: vi.fn(),
    query: vi.fn(),
    addJob: vi.fn(),
  } as Parameters<typeof cleanupExpiredDrafts>[1];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("cleanupExpiredDrafts()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPoolConnect.mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    });
  });

  it("deletes pending_upload documents older than 1 hour and calls deleteObject for each", async () => {
    const expiredPendingRows = [
      { id: "doc-1", filepath: "documents/doc-1/file.pdf" },
      { id: "doc-2", filepath: "documents/doc-2/file.pdf" },
    ];

    // First query: pending_upload cleanup → returns 2 rows
    // Second query: draft cleanup → returns 0 rows
    mockQuery
      .mockResolvedValueOnce({ rows: expiredPendingRows, rowCount: 2 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await cleanupExpiredDrafts({}, makeHelpers());

    // Both S3 objects should be deleted
    expect(mockDeleteObject).toHaveBeenCalledTimes(2);
    expect(mockDeleteObject).toHaveBeenCalledWith("documents/doc-1/file.pdf");
    expect(mockDeleteObject).toHaveBeenCalledWith("documents/doc-2/file.pdf");
  });

  it("deletes draft documents older than 14 days and calls deleteObject for each", async () => {
    const expiredDraftRows = [
      { id: "draft-1", filepath: "documents/draft-1/doc.pdf" },
    ];

    // First query: pending_upload → 0 rows; Second: drafts → 1 row
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: expiredDraftRows, rowCount: 1 });

    await cleanupExpiredDrafts({}, makeHelpers());

    expect(mockDeleteObject).toHaveBeenCalledTimes(1);
    expect(mockDeleteObject).toHaveBeenCalledWith("documents/draft-1/doc.pdf");
  });

  it("handles documents with null filepath without calling deleteObject", async () => {
    const rowsWithNullPath = [
      { id: "doc-null", filepath: null },
    ];

    mockQuery
      .mockResolvedValueOnce({ rows: rowsWithNullPath, rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await cleanupExpiredDrafts({}, makeHelpers());

    // deleteObject should NOT be called for null filepath
    expect(mockDeleteObject).not.toHaveBeenCalled();
  });

  it("continues processing other rows even if deleteObject fails for one", async () => {
    const rows = [
      { id: "doc-ok", filepath: "documents/doc-ok/file.pdf" },
      { id: "doc-fail", filepath: "documents/doc-fail/file.pdf" },
    ];

    mockQuery
      .mockResolvedValueOnce({ rows, rowCount: 2 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    // First deleteObject succeeds, second fails
    mockDeleteObject
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("S3 error"));

    // Should not throw — errors are caught and logged as warnings
    await expect(cleanupExpiredDrafts({}, makeHelpers())).resolves.not.toThrow();
    expect(mockDeleteObject).toHaveBeenCalledTimes(2);
  });

  it("releases db connection and ends pool even on success", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await cleanupExpiredDrafts({}, makeHelpers());

    expect(mockRelease).toHaveBeenCalledTimes(1);
    expect(mockPoolEnd).toHaveBeenCalledTimes(1);
  });

  it("queries pending_upload with 1 hour threshold", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await cleanupExpiredDrafts({}, makeHelpers());

    const firstCall = mockQuery.mock.calls[0][0] as string;
    expect(firstCall).toMatch(/pending_upload/i);
    expect(firstCall).toMatch(/1 hour/i);
  });

  it("queries draft with 14 days threshold", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await cleanupExpiredDrafts({}, makeHelpers());

    const secondCall = mockQuery.mock.calls[1][0] as string;
    expect(secondCall).toMatch(/draft/i);
    expect(secondCall).toMatch(/14 days/i);
  });

  it("processes both pending and draft rows in a single run", async () => {
    const pendingRows = [{ id: "p1", filepath: "docs/p1.pdf" }];
    const draftRows = [{ id: "d1", filepath: "docs/d1.pdf" }, { id: "d2", filepath: "docs/d2.pdf" }];

    mockQuery
      .mockResolvedValueOnce({ rows: pendingRows, rowCount: 1 })
      .mockResolvedValueOnce({ rows: draftRows, rowCount: 2 });

    await cleanupExpiredDrafts({}, makeHelpers());

    // 1 pending + 2 draft = 3 S3 deletions
    expect(mockDeleteObject).toHaveBeenCalledTimes(3);
  });
});
