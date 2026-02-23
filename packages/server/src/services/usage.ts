import type { Kysely } from "kysely";

import type { DB } from "../util/db.js";

export async function checkTierLimit(
  db: Kysely<DB>,
  userId: string,
  limitType: string,
  userRole: string,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  // Admins are exempt from all limits
  if (userRole === "admin") {
    return { allowed: true, used: 0, limit: Infinity };
  }

  // Users with a custom OpenRouter API key are exempt from LLM limits
  if (limitType === "llm_metadata") {
    const apiKeyRow = await db
      .selectFrom("user_api_keys" as never)
      .select(["id"] as never[])
      .where("user_id" as never, "=", userId as never)
      .executeTakeFirst();

    if (apiKeyRow) {
      return { allowed: true, used: 0, limit: Infinity };
    }
  }

  // Get user's tier
  const user = await db
    .selectFrom("user")
    .select(["tier"])
    .where("id", "=", userId)
    .executeTakeFirst();

  const tierId = (user?.tier as number) ?? 1;

  // Get limit for this tier and limit type
  const limitRow = await db
    .selectFrom("tier_limits")
    .select(["limit_value"])
    .where("tier_id", "=", tierId)
    .where("limit_type", "=", limitType)
    .executeTakeFirst();

  const limit = (limitRow?.limit_value as number) ?? 10;

  // Count today's usage based on limitType
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let used: number;

  if (limitType === "uploads") {
    // Count documents created today that are past pending_upload state
    const countResult = await db
      .selectFrom("documents")
      .select(db.fn.countAll<number>().as("count"))
      .where("uploader_id", "=", userId)
      .where("state", "!=", "pending_upload" as never)
      .where("created_at", ">=", today as never)
      .executeTakeFirst();
    used = Number(countResult?.count ?? 0);
  } else if (limitType === "llm_metadata") {
    // Count documents with processing completed today by this user
    const countResult = await db
      .selectFrom("documents")
      .select(db.fn.countAll<number>().as("count"))
      .where("uploader_id", "=", userId)
      .where("processing_completed_at", "is not", null as never)
      .where("processing_completed_at", ">=", today as never)
      .executeTakeFirst();
    used = Number(countResult?.count ?? 0);
  } else {
    // Default: count non-pending documents created today
    const countResult = await db
      .selectFrom("documents")
      .select(db.fn.countAll<number>().as("count"))
      .where("uploader_id", "=", userId)
      .where("state", "!=", "pending_upload" as never)
      .where("created_at", ">=", today as never)
      .executeTakeFirst();
    used = Number(countResult?.count ?? 0);
  }

  return { allowed: used < limit, used, limit };
}

export async function recordUsage(
  _db: Kysely<DB>,
  _userId: string,
  _limitType: string,
): Promise<void> {
  // Usage is counted dynamically from documents table
  // No separate log needed for this implementation
}
