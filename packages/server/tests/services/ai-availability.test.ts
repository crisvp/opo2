import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Kysely } from "kysely";
import type { DB } from "../../src/util/db.js";
import { getAiAvailability } from "../../src/services/ai-availability.js";

// ---------------------------------------------------------------------------
// Mock Kysely DB
// ---------------------------------------------------------------------------

function makeMockDb(overrides: {
  hasApiKey?: boolean;
  tierLimitValue?: number | null;
  llmCallsUsed?: number;
}) {
  const {
    hasApiKey = false,
    tierLimitValue = 50,
    llmCallsUsed = 0,
  } = overrides;

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

  const mockDb = {
    selectFrom: vi.fn((table: string) => {
      if (table === "user_api_keys") {
        return makeQueryBuilder(hasApiKey ? { id: "key-1" } : undefined);
      }
      if (table === "tier_limits") {
        return makeQueryBuilder(
          tierLimitValue !== null ? { limit_value: tierLimitValue } : undefined,
        );
      }
      if (table === "llm_call_logs") {
        return makeQueryBuilder({ count: llmCallsUsed });
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

describe("getAiAvailability()", () => {
  const originalEnv = process.env["OPENROUTER_API_KEY"];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["OPENROUTER_API_KEY"];
    } else {
      process.env["OPENROUTER_API_KEY"] = originalEnv;
    }
  });

  it("returns available=true, usingOwnKey=true with no limits when user has own API key", async () => {
    const db = makeMockDb({ hasApiKey: true });
    process.env["OPENROUTER_API_KEY"] = "sys-key";

    const result = await getAiAvailability(db, "user-1", 1);

    expect(result).toEqual({
      available: true,
      usingOwnKey: true,
      limits: { monthly: null, used: 0, remaining: null },
    });
    // Should not query tier_limits or llm_call_logs
    expect(db.selectFrom).toHaveBeenCalledTimes(1);
    expect(db.selectFrom).toHaveBeenCalledWith("user_api_keys");
  });

  it("returns available=false when no own key and no system key", async () => {
    delete process.env["OPENROUTER_API_KEY"];
    const db = makeMockDb({ hasApiKey: false });

    const result = await getAiAvailability(db, "user-1", 1);

    expect(result).toEqual({
      available: false,
      usingOwnKey: false,
      limits: { monthly: null, used: 0, remaining: null },
    });
    // Should only query user_api_keys, not tier_limits or llm_call_logs
    expect(db.selectFrom).toHaveBeenCalledTimes(1);
    expect(db.selectFrom).toHaveBeenCalledWith("user_api_keys");
  });

  it("returns available=true with limits when user is within monthly limit", async () => {
    process.env["OPENROUTER_API_KEY"] = "sys-key";
    const db = makeMockDb({ hasApiKey: false, tierLimitValue: 50, llmCallsUsed: 20 });

    const result = await getAiAvailability(db, "user-1", 1);

    expect(result).toEqual({
      available: true,
      usingOwnKey: false,
      limits: { monthly: 50, used: 20, remaining: 30 },
    });
  });

  it("returns available=false when user has exhausted monthly limit", async () => {
    process.env["OPENROUTER_API_KEY"] = "sys-key";
    const db = makeMockDb({ hasApiKey: false, tierLimitValue: 50, llmCallsUsed: 50 });

    const result = await getAiAvailability(db, "user-1", 1);

    expect(result).toEqual({
      available: false,
      usingOwnKey: false,
      limits: { monthly: 50, used: 50, remaining: 0 },
    });
  });

  it("returns available=false when user has exceeded monthly limit", async () => {
    process.env["OPENROUTER_API_KEY"] = "sys-key";
    const db = makeMockDb({ hasApiKey: false, tierLimitValue: 10, llmCallsUsed: 15 });

    const result = await getAiAvailability(db, "user-1", 1);

    expect(result.available).toBe(false);
    expect(result.limits.remaining).toBe(0);
  });

  it("returns available=true with null limits when no tier limit row exists", async () => {
    process.env["OPENROUTER_API_KEY"] = "sys-key";
    const db = makeMockDb({ hasApiKey: false, tierLimitValue: null, llmCallsUsed: 999 });

    const result = await getAiAvailability(db, "user-1", 1);

    expect(result.available).toBe(true);
    expect(result.limits.monthly).toBeNull();
    expect(result.limits.remaining).toBeNull();
    expect(result.limits.used).toBe(999);
  });
});
