import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { nanoid } from "nanoid";

import { createStateMetadataSchema, updateStateMetadataSchema } from "@opo/shared";

const listQuerySchema = z.object({
  stateUsps: z.string().length(2).optional(),
});

const idParamsSchema = z.object({
  id: z.string(),
});

const plugin: FastifyPluginAsync = async (fastify) => {
  // GET / — public
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/",
    {
      schema: { querystring: listQuerySchema },
    },
    async (request, _reply) => {
      const { stateUsps } = request.query;

      let query = fastify.db
        .selectFrom("state_metadata")
        .selectAll()
        .orderBy("state_usps", "asc")
        .orderBy("key", "asc");

      if (stateUsps) {
        query = query.where("state_usps", "=", stateUsps);
      }

      const rows = await query.execute();

      const items = rows.map((r) => ({
        id: r.id,
        stateUsps: r.state_usps,
        key: r.key,
        value: r.value,
        url: r.url ?? null,
        createdAt:
          r.created_at instanceof Date
            ? r.created_at.toISOString()
            : String(r.created_at),
        updatedAt:
          r.updated_at instanceof Date
            ? r.updated_at.toISOString()
            : String(r.updated_at),
      }));

      return { success: true, data: items };
    },
  );

  // POST / — moderator+
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/",
    {
      schema: { body: createStateMetadataSchema },
      preHandler: [fastify.requireRole("moderator")],
    },
    async (request, _reply) => {
      const body = request.body;
      const id = nanoid();
      const now = new Date();

      await fastify.db
        .insertInto("state_metadata")
        .values({
          id,
          state_usps: body.stateUsps,
          key: body.key,
          value: body.value,
          url: body.url ?? null,
          created_at: now,
          updated_at: now,
        })
        .execute();

      return {
        success: true,
        data: {
          id,
          stateUsps: body.stateUsps,
          key: body.key,
          value: body.value,
          url: body.url ?? null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      };
    },
  );

  // PUT /:id — moderator+
  fastify.withTypeProvider<ZodTypeProvider>().put(
    "/:id",
    {
      schema: { params: idParamsSchema, body: updateStateMetadataSchema },
      preHandler: [fastify.requireRole("moderator")],
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      const existing = await fastify.db
        .selectFrom("state_metadata")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({ success: false, error: "State metadata not found" });
      }

      const now = new Date();

      await fastify.db
        .updateTable("state_metadata")
        .set({
          value: body.value,
          url: body.url !== undefined ? body.url : existing.url,
          updated_at: now,
        })
        .where("id", "=", id)
        .execute();

      return {
        success: true,
        data: {
          id,
          stateUsps: existing.state_usps,
          key: existing.key,
          value: body.value,
          url: (body.url !== undefined ? body.url : existing.url) ?? null,
          createdAt:
            existing.created_at instanceof Date
              ? existing.created_at.toISOString()
              : String(existing.created_at),
          updatedAt: now.toISOString(),
        },
      };
    },
  );

  // DELETE /:id — moderator+
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    "/:id",
    {
      schema: { params: idParamsSchema },
      preHandler: [fastify.requireRole("moderator")],
    },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await fastify.db
        .selectFrom("state_metadata")
        .select(["id"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({ success: false, error: "State metadata not found" });
      }

      await fastify.db
        .deleteFrom("state_metadata")
        .where("id", "=", id)
        .execute();

      return { success: true };
    },
  );
};

export default plugin;
