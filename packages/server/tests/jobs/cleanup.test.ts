import { describe, it, expect, vi } from "vitest";

// Mock pg before importing
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

vi.mock("../../src/config/env.js", () => ({
  env: {
    DATABASE_URL: "postgresql://localhost:5432/test",
    S3_BUCKET: "test-bucket",
  },
}));

import { cleanupExpiredDrafts } from "../../src/jobs/tasks/cleanup-expired-drafts.js";

function makeHelpers() {
  return {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    job: { id: 1 },
    addJob: vi.fn(),
    withPgClient: vi.fn(),
    query: vi.fn(),
  };
}

describe("cleanupExpiredDrafts task", () => {
  it("resolves without throwing when database returns empty results", async () => {
    const helpers = makeHelpers();
    await expect(cleanupExpiredDrafts({}, helpers as never)).resolves.toBeUndefined();
  });

  it("logs cleanup info messages", async () => {
    const helpers = makeHelpers();
    await cleanupExpiredDrafts({}, helpers as never);
    expect(helpers.logger.info).toHaveBeenCalledWith("Starting expired draft cleanup");
  });

  it("logs results for pending_upload and draft cleanup", async () => {
    const helpers = makeHelpers();
    await cleanupExpiredDrafts({}, helpers as never);
    // Should have called info at least twice (once per cleanup pass)
    expect(helpers.logger.info.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("handles being called with null payload", async () => {
    const helpers = makeHelpers();
    await expect(cleanupExpiredDrafts(null, helpers as never)).resolves.toBeUndefined();
  });
});
