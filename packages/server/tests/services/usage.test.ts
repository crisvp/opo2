import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Kysely } from "kysely";
import type { DB } from "../../src/util/db.js";
import { checkTierLimit } from "../../src/services/usage.js";

// ---------------------------------------------------------------------------
// Mock Kysely DB
// ---------------------------------------------------------------------------

function makeMockDb(overrides: {
  userTier?: number;
  limitValue?: number;
  uploadsCount?: number;
  llmCount?: number;
  hasApiKey?: boolean;
}) {
  const {
    userTier = 1,
    limitValue = 10,
    uploadsCount = 0,
    llmCount = 0,
    hasApiKey = false,
  } = overrides;

  // Create a chainable query builder mock
  const makeQueryBuilder = (finalValue: unknown) => {
    const qb: Record<string, unknown> = {};
    const chain = () => qb;
    qb.selectFrom = chain;
    qb.select = chain;
    qb.where = chain;
    qb.limit = chain;
    qb.executeTakeFirst = vi.fn().mockResolvedValue(finalValue);
    qb.executeTakeFirstOrThrow = vi.fn().mockResolvedValue(finalValue);
    qb.execute = vi.fn().mockResolvedValue(finalValue ? [finalValue] : []);
    return qb;
  };

  // selectFrom returns different query builders based on table name
  const mockDb = {
    selectFrom: vi.fn((table: string) => {
      if (table === "user") {
        return makeQueryBuilder({ tier: userTier });
      }
      if (table === "tier_limits") {
        return makeQueryBuilder({ limit_value: limitValue });
      }
      if (table === "user_api_keys") {
        return makeQueryBuilder(hasApiKey ? { id: "key-1" } : undefined);
      }
      if (table === "documents") {
        // Return different counts based on what filter is applied
        const qb = makeQueryBuilder(null);
        let isLlm = false;
        const originalWhere = qb.where as ReturnType<typeof vi.fn>;
        qb.where = vi.fn((...args: unknown[]) => {
          if (args[0] === "processing_completed_at") isLlm = true;
          return qb;
        });
        qb.executeTakeFirst = vi.fn().mockImplementation(() => {
          const count = isLlm ? llmCount : uploadsCount;
          return Promise.resolve({ count });
        });
        return qb;
      }
      return makeQueryBuilder(null);
    }),
    fn: {
      countAll: vi.fn().mockReturnValue({ as: vi.fn().mockReturnValue("count") }),
    },
  } as unknown as Kysely<DB>;

  return mockDb;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("checkTierLimit()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns allowed=true, used=0, limit=Infinity for admin role", async () => {
    const db = makeMockDb({});
    const result = await checkTierLimit(db, "user-1", "uploads", "admin");
    expect(result).toEqual({ allowed: true, used: 0, limit: Infinity });
    // Should not query DB at all for admins
    expect(db.selectFrom).not.toHaveBeenCalled();
  });

  it("allows uploads when under limit", async () => {
    const db = makeMockDb({ uploadsCount: 3, limitValue: 10 });
    const result = await checkTierLimit(db, "user-1", "uploads", "user");
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(3);
    expect(result.limit).toBe(10);
  });

  it("blocks uploads when at limit", async () => {
    const db = makeMockDb({ uploadsCount: 10, limitValue: 10 });
    const result = await checkTierLimit(db, "user-1", "uploads", "user");
    expect(result.allowed).toBe(false);
    expect(result.used).toBe(10);
  });

  it("allows llm_metadata when under limit", async () => {
    const db = makeMockDb({ llmCount: 2, limitValue: 5 });
    const result = await checkTierLimit(db, "user-1", "llm_metadata", "user");
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(2);
    expect(result.limit).toBe(5);
  });

  it("blocks llm_metadata when at limit", async () => {
    const db = makeMockDb({ llmCount: 5, limitValue: 5 });
    const result = await checkTierLimit(db, "user-1", "llm_metadata", "user");
    expect(result.allowed).toBe(false);
    expect(result.used).toBe(5);
  });

  it("exempts user with custom OpenRouter API key from llm_metadata limits", async () => {
    const db = makeMockDb({ llmCount: 100, limitValue: 5, hasApiKey: true });
    const result = await checkTierLimit(db, "user-1", "llm_metadata", "user");
    expect(result).toEqual({ allowed: true, used: 0, limit: Infinity });
  });

  it("does NOT exempt user with custom API key from uploads limits", async () => {
    const db = makeMockDb({ uploadsCount: 10, limitValue: 5, hasApiKey: true });
    const result = await checkTierLimit(db, "user-1", "uploads", "user");
    // API key exemption only applies to llm_metadata, not uploads
    expect(result.allowed).toBe(false);
    expect(result.used).toBe(10);
  });

  it("uploads and llm_metadata use different counting logic", async () => {
    // uploads branch should count state != pending_upload
    // llm_metadata branch should count processing_completed_at IS NOT NULL
    // This test verifies the two branches produce different results from the mock
    const dbWithDifferentCounts = makeMockDb({ uploadsCount: 3, llmCount: 7, limitValue: 10 });

    const uploadsResult = await checkTierLimit(dbWithDifferentCounts, "user-1", "uploads", "user");
    expect(uploadsResult.used).toBe(3);

    const llmResult = await checkTierLimit(dbWithDifferentCounts, "user-1", "llm_metadata", "user");
    expect(llmResult.used).toBe(7);
  });
});
