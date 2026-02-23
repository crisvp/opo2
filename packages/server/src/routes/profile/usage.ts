import type { FastifyPluginAsync } from "fastify";

import type { UserTierInfo } from "@opo/shared";

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/usage",
    { preHandler: [fastify.requireAuth] },
    async (request, _reply) => {
      const user = request.user!;
      const tierId = user.tier;

      // Get tier info
      const tier = await fastify.db
        .selectFrom("user_tiers")
        .selectAll()
        .where("id", "=", tierId)
        .executeTakeFirst();

      // Get limits for this tier
      const limitRows = await fastify.db
        .selectFrom("tier_limits")
        .selectAll()
        .where("tier_id", "=", tierId)
        .execute();

      // Admins are exempt from all limits
      const isExempt = user.role === "admin";

      // Calculate midnight Central Time for resetAt
      const now = new Date();
      const central = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(now);
      const year = central.find((p) => p.type === "year")!.value;
      const month = central.find((p) => p.type === "month")!.value;
      const day = central.find((p) => p.type === "day")!.value;
      const resetAt = new Date(`${year}-${month}-${day}T00:00:00-06:00`);
      // If we're past midnight, reset is tomorrow
      if (resetAt <= now) {
        resetAt.setDate(resetAt.getDate() + 1);
      }

      // Calculate today's start in UTC for query comparisons
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Build usage array with actual counts per limit type
      const usage = await Promise.all(
        limitRows.map(async (l) => {
          const limitType = l.limit_type as string;
          let used = 0;

          if (!isExempt) {
            if (limitType === "uploads") {
              const countResult = await fastify.db
                .selectFrom("documents")
                .select(fastify.db.fn.countAll<number>().as("count"))
                .where("uploader_id", "=", user.id)
                .where("state", "!=", "pending_upload" as never)
                .where("created_at", ">=", todayStart as never)
                .executeTakeFirst();
              used = Number(countResult?.count ?? 0);
            } else if (limitType === "llm_metadata") {
              // Check if user has a custom OpenRouter key (exempt)
              const apiKeyRow = await fastify.db
                .selectFrom("user_api_keys" as never)
                .select(["id"] as never[])
                .where("user_id" as never, "=", user.id as never)
                .where("service" as never, "=", "openrouter" as never)
                .executeTakeFirst();

              if (!apiKeyRow) {
                const countResult = await fastify.db
                  .selectFrom("documents")
                  .select(fastify.db.fn.countAll<number>().as("count"))
                  .where("uploader_id", "=", user.id)
                  .where("processing_completed_at", "is not", null as never)
                  .where("processing_completed_at", ">=", todayStart as never)
                  .executeTakeFirst();
                used = Number(countResult?.count ?? 0);
              }
            }
          }

          return {
            limitType,
            used,
            limit: l.limit_value as number,
            remaining: Math.max(0, (l.limit_value as number) - used),
            resetAt: resetAt.toISOString(),
          };
        }),
      );

      const data: UserTierInfo = {
        tier: tierId,
        tierLabel: (tier?.name as string | undefined) ?? "Unknown",
        usage,
        isExempt,
      };

      return {
        success: true,
        data,
      };
    },
  );
};

export default plugin;
