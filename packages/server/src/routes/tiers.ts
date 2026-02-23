import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { nanoid } from "nanoid";

import { createTierSchema, updateTierSchema, updateTierLimitsSchema } from "@opo/shared";
import type { TierLimit } from "@opo/shared";

const idParamsSchema = z.object({
  id: z.string(),
});

const idLimitsParamsSchema = z.object({
  id: z.string(),
});

function buildTierResponse(
  t: Record<string, unknown>,
  limits: TierLimit[],
) {
  return {
    id: t.id as number,
    name: t.name as string,
    description: (t.description ?? null) as string | null,
    isDefault: t.is_default as boolean,
    sortOrder: t.sort_order as number,
    limits,
  };
}

const plugin: FastifyPluginAsync = async (fastify) => {
  // GET / — public — list all tiers with limits
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/",
    { schema: {} },
    async (_request, _reply) => {
      const tiers = await fastify.db
        .selectFrom("user_tiers as t")
        .selectAll("t")
        .orderBy("t.sort_order", "asc")
        .execute();

      const limitRows = await fastify.db
        .selectFrom("tier_limits")
        .selectAll()
        .execute();

      const limitsMap = new Map<number, TierLimit[]>();
      for (const l of limitRows) {
        const tid = l.tier_id as number;
        if (!limitsMap.has(tid)) limitsMap.set(tid, []);
        limitsMap.get(tid)!.push({
          limitType: l.limit_type as string,
          limitValue: l.limit_value as number,
        });
      }

      return {
        success: true,
        data: tiers.map((t) =>
          buildTierResponse(
            t as Record<string, unknown>,
            limitsMap.get(t.id as number) ?? [],
          ),
        ),
      };
    },
  );

  // GET /:id — public — get single tier with limits
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/:id",
    {
      schema: {
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const numId = parseInt(request.params.id, 10);
      if (isNaN(numId)) {
        return reply.status(404).send({ success: false, error: "Tier not found" });
      }

      const tier = await fastify.db
        .selectFrom("user_tiers")
        .selectAll()
        .where("id", "=", numId)
        .executeTakeFirst();

      if (!tier) {
        return reply.status(404).send({ success: false, error: "Tier not found" });
      }

      const limitRows = await fastify.db
        .selectFrom("tier_limits")
        .selectAll()
        .where("tier_id", "=", numId)
        .execute();

      const limits: TierLimit[] = limitRows.map((l) => ({
        limitType: l.limit_type as string,
        limitValue: l.limit_value as number,
      }));

      return {
        success: true,
        data: buildTierResponse(tier as Record<string, unknown>, limits),
      };
    },
  );

  // POST / — admin only — create tier
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/",
    {
      preHandler: [fastify.requireRole("admin")],
      schema: {
        body: createTierSchema,
      },
    },
    async (request, reply) => {
      const body = request.body;

      try {
        await fastify.db
          .insertInto("user_tiers")
          .values({
            id: body.id,
            name: body.name,
            description: body.description ?? null,
            is_default: body.isDefault,
            sort_order: body.sortOrder ?? 0,
          })
          .execute();
      } catch (err: unknown) {
        const pgErr = err as { code?: string };
        if (pgErr.code === "23505") {
          return reply.status(409).send({ success: false, error: "A tier with this ID already exists" });
        }
        throw err;
      }

      if (body.limits.length > 0) {
        await fastify.db
          .insertInto("tier_limits")
          .values(
            body.limits.map((l) => ({
              id: nanoid(),
              tier_id: body.id,
              limit_type: l.limitType,
              limit_value: l.limitValue,
            })),
          )
          .execute();
      }

      const tier = await fastify.db
        .selectFrom("user_tiers")
        .selectAll()
        .where("id", "=", body.id)
        .executeTakeFirstOrThrow();

      const limitRows = await fastify.db
        .selectFrom("tier_limits")
        .selectAll()
        .where("tier_id", "=", body.id)
        .execute();

      const limits: TierLimit[] = limitRows.map((l) => ({
        limitType: l.limit_type as string,
        limitValue: l.limit_value as number,
      }));

      return {
        success: true,
        data: buildTierResponse(tier as Record<string, unknown>, limits),
      };
    },
  );

  // PUT /:id — admin only — update tier
  fastify.withTypeProvider<ZodTypeProvider>().put(
    "/:id",
    {
      preHandler: [fastify.requireRole("admin")],
      schema: {
        params: idParamsSchema,
        body: updateTierSchema,
      },
    },
    async (request, reply) => {
      const numId = parseInt(request.params.id, 10);
      if (isNaN(numId)) {
        return reply.status(404).send({ success: false, error: "Tier not found" });
      }

      const existing = await fastify.db
        .selectFrom("user_tiers")
        .select("id")
        .where("id", "=", numId)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({ success: false, error: "Tier not found" });
      }

      const { name, description, isDefault, sortOrder } = request.body;
      const updateValues: Record<string, unknown> = {};
      if (name !== undefined) updateValues.name = name;
      if (description !== undefined) updateValues.description = description;
      if (isDefault !== undefined) updateValues.is_default = isDefault;
      if (sortOrder !== undefined) updateValues.sort_order = sortOrder;

      if (Object.keys(updateValues).length > 0) {
        await fastify.db
          .updateTable("user_tiers")
          .set(updateValues)
          .where("id", "=", numId)
          .execute();
      }

      const tier = await fastify.db
        .selectFrom("user_tiers")
        .selectAll()
        .where("id", "=", numId)
        .executeTakeFirstOrThrow();

      const limitRows = await fastify.db
        .selectFrom("tier_limits")
        .selectAll()
        .where("tier_id", "=", numId)
        .execute();

      const limits: TierLimit[] = limitRows.map((l) => ({
        limitType: l.limit_type as string,
        limitValue: l.limit_value as number,
      }));

      return {
        success: true,
        data: buildTierResponse(tier as Record<string, unknown>, limits),
      };
    },
  );

  // PUT /:id/limits — admin only — replace all limits for this tier
  fastify.withTypeProvider<ZodTypeProvider>().put(
    "/:id/limits",
    {
      preHandler: [fastify.requireRole("admin")],
      schema: {
        params: idLimitsParamsSchema,
        body: updateTierLimitsSchema,
      },
    },
    async (request, reply) => {
      const numId = parseInt(request.params.id, 10);
      if (isNaN(numId)) {
        return reply.status(404).send({ success: false, error: "Tier not found" });
      }

      const existing = await fastify.db
        .selectFrom("user_tiers")
        .select("id")
        .where("id", "=", numId)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({ success: false, error: "Tier not found" });
      }

      const { limits } = request.body;

      await fastify.db.transaction().execute(async (trx) => {
        await trx.deleteFrom("tier_limits").where("tier_id", "=", numId).execute();
        if (limits.length > 0) {
          await trx
            .insertInto("tier_limits")
            .values(
              limits.map((l) => ({
                id: nanoid(),
                tier_id: numId,
                limit_type: l.limitType,
                limit_value: l.limitValue,
              })),
            )
            .execute();
        }
      });

      const tier = await fastify.db
        .selectFrom("user_tiers")
        .selectAll()
        .where("id", "=", numId)
        .executeTakeFirstOrThrow();

      const limitRows = await fastify.db
        .selectFrom("tier_limits")
        .selectAll()
        .where("tier_id", "=", numId)
        .execute();

      const updatedLimits: TierLimit[] = limitRows.map((l) => ({
        limitType: l.limit_type as string,
        limitValue: l.limit_value as number,
      }));

      return {
        success: true,
        data: buildTierResponse(tier as Record<string, unknown>, updatedLimits),
      };
    },
  );

  // DELETE /:id — admin only — delete tier
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    "/:id",
    {
      preHandler: [fastify.requireRole("admin")],
      schema: {
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const numId = parseInt(request.params.id, 10);
      if (isNaN(numId)) {
        return reply.status(404).send({ success: false, error: "Tier not found" });
      }

      const existing = await fastify.db
        .selectFrom("user_tiers")
        .select(["id", "is_default"])
        .where("id", "=", numId)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({ success: false, error: "Tier not found" });
      }

      if (existing.is_default as boolean) {
        return reply.status(400).send({ success: false, error: "Cannot delete the default tier" });
      }

      await fastify.db.deleteFrom("user_tiers").where("id", "=", numId).execute();

      return { success: true, data: null };
    },
  );
};

export default plugin;
