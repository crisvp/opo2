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
  };
  return { getDb: vi.fn().mockReturnValue(mockDb) };
});

vi.mock("../../src/config/env.js", () => ({
  env: {
    DATABASE_URL: "postgresql://localhost:5432/test",
  },
}));

vi.mock("../../src/services/sse.js", () => ({
  broadcastToUser: vi.fn(),
  broadcastToRole: vi.fn(),
  broadcastToAll: vi.fn(),
  addSseClient: vi.fn(),
  removeSseClient: vi.fn(),
  getSseHealthInfo: vi.fn(),
}));

// ---- Import modules under test ----
import * as sseService from "../../src/services/sse.js";
import * as dbModule from "../../src/util/db.js";
import { pipelineComplete } from "../../src/jobs/tasks/pipeline-complete.js";

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

describe("pipelineComplete SSE broadcast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply default mock behavior after clearAllMocks
    const mockDb = (dbModule.getDb as ReturnType<typeof vi.fn>)();
    (mockDb.selectFrom as ReturnType<typeof vi.fn>).mockReturnThis();
    (mockDb.select as ReturnType<typeof vi.fn>).mockReturnThis();
    (mockDb.where as ReturnType<typeof vi.fn>).mockReturnThis();
    (mockDb.updateTable as ReturnType<typeof vi.fn>).mockReturnThis();
    (mockDb.set as ReturnType<typeof vi.fn>).mockReturnThis();
    (mockDb.execute as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mockDb.executeTakeFirst as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it("broadcasts document:ready_for_review when pipeline transitions to user_review", async () => {
    const mockDb = (dbModule.getDb as ReturnType<typeof vi.fn>)();
    (mockDb.executeTakeFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ sieve_category: "HIGH_RELEVANCE" }) // processing result
      .mockResolvedValueOnce({ title: "Test Document", uploader_id: "user-123" }); // document fetch for SSE

    const helpers = makeHelpers();
    await pipelineComplete({ documentId: "doc-abc" }, helpers as never);

    expect(sseService.broadcastToUser).toHaveBeenCalledWith(
      "user-123",
      "document:ready_for_review",
      expect.objectContaining({ id: "doc-abc", title: "Test Document" }),
    );
  });

  it("does not broadcast when pipeline transitions to rejected (JUNK)", async () => {
    const mockDb = (dbModule.getDb as ReturnType<typeof vi.fn>)();
    (mockDb.executeTakeFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ sieve_category: "JUNK" }); // processing result

    const helpers = makeHelpers();
    await pipelineComplete({ documentId: "doc-xyz" }, helpers as never);

    expect(sseService.broadcastToUser).not.toHaveBeenCalled();
  });

  it("does not broadcast when document has no uploader_id", async () => {
    const mockDb = (dbModule.getDb as ReturnType<typeof vi.fn>)();
    (mockDb.executeTakeFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ sieve_category: "UNCERTAIN" }) // processing result
      .mockResolvedValueOnce({ title: "Anonymous Doc", uploader_id: null }); // document with no uploader

    const helpers = makeHelpers();
    await pipelineComplete({ documentId: "doc-anon" }, helpers as never);

    expect(sseService.broadcastToUser).not.toHaveBeenCalled();
  });
});
