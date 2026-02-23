import type { Kysely } from "kysely";
import type { DB } from "../util/db.js";

export interface AiAvailabilityResult {
  available: boolean;
  usingOwnKey: boolean;
  limits: {
    monthly: number | null;
    used: number;
    remaining: number | null;
  };
}

export async function getAiAvailability(
  db: Kysely<DB>,
  userId: string,
  userTier: number,
): Promise<AiAvailabilityResult> {
  // 1. Check if user has their own API key
  const apiKeyRow = await db
    .selectFrom("user_api_keys")
    .select(["id"])
    .where("user_id", "=", userId)
    .executeTakeFirst();

  if (apiKeyRow) {
    return {
      available: true,
      usingOwnKey: true,
      limits: { monthly: null, used: 0, remaining: null },
    };
  }

  // 2. Check if system key is configured
  if (!process.env["OPENROUTER_API_KEY"]) {
    return {
      available: false,
      usingOwnKey: false,
      limits: { monthly: null, used: 0, remaining: null },
    };
  }

  // 3. Get the monthly LLM call limit for the user's tier
  const limitRow = await db
    .selectFrom("tier_limits")
    .select(["limit_value"])
    .where("tier_id", "=", userTier)
    .where("limit_type", "=", "llm_calls_monthly")
    .executeTakeFirst();

  const monthlyLimit: number | null = limitRow?.limit_value ?? null;

  // 4. Count system-key LLM calls for this user in the current month
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const countResult = await db
    .selectFrom("llm_call_logs")
    .select(db.fn.countAll<number>().as("count"))
    .where("user_id", "=", userId)
    .where("used_system_key", "=", true)
    .where("started_at", ">=", startOfMonth)
    .executeTakeFirst();

  const used = Number(countResult?.count ?? 0);

  // 5. Compute availability
  const available = monthlyLimit === null || used < monthlyLimit;
  const remaining = monthlyLimit === null ? null : Math.max(0, monthlyLimit - used);

  return {
    available,
    usingOwnKey: false,
    limits: {
      monthly: monthlyLimit,
      used,
      remaining,
    },
  };
}
