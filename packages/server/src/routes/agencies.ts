import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { nanoid } from "nanoid";

import { createAgencySchema, updateAgencySchema } from "@opo/shared";

const listQuerySchema = z.object({
  stateUsps: z.string().length(2).optional(),
  category: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
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
      const { stateUsps, category, page, pageSize } = request.query;
      const offset = (page - 1) * pageSize;

      let countQuery = fastify.db
        .selectFrom("state_agencies")
        .select(fastify.db.fn.countAll<number>().as("count"));

      if (stateUsps) {
        countQuery = countQuery.where("state_usps", "=", stateUsps);
      }
      if (category) {
        countQuery = countQuery.where("category", "=", category);
      }

      const countResult = await countQuery.executeTakeFirstOrThrow();
      const total = Number(countResult.count);

      let query = fastify.db
        .selectFrom("state_agencies")
        .selectAll()
        .orderBy("created_at", "asc")
        .limit(pageSize)
        .offset(offset);

      if (stateUsps) {
        query = query.where("state_usps", "=", stateUsps);
      }
      if (category) {
        query = query.where("category", "=", category);
      }

      const rows = await query.execute();

      const items = rows.map((r) => ({
        id: r.id,
        stateUsps: r.state_usps,
        name: r.name,
        abbreviation: r.abbreviation ?? null,
        category: r.category ?? null,
        websiteUrl: r.website_url ?? null,
        createdAt:
          r.created_at instanceof Date
            ? r.created_at.toISOString()
            : String(r.created_at),
        updatedAt:
          r.updated_at instanceof Date
            ? r.updated_at.toISOString()
            : String(r.updated_at),
      }));

      return {
        success: true,
        data: {
          items,
          total,
          page,
          pageSize,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      };
    },
  );

  // GET /:id — public
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/:id",
    {
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const { id } = request.params;

      const row = await fastify.db
        .selectFrom("state_agencies")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();

      if (!row) {
        return reply.status(404).send({ success: false, error: "Agency not found" });
      }

      return {
        success: true,
        data: {
          id: row.id,
          stateUsps: row.state_usps,
          name: row.name,
          abbreviation: row.abbreviation ?? null,
          category: row.category ?? null,
          websiteUrl: row.website_url ?? null,
          createdAt:
            row.created_at instanceof Date
              ? row.created_at.toISOString()
              : String(row.created_at),
          updatedAt:
            row.updated_at instanceof Date
              ? row.updated_at.toISOString()
              : String(row.updated_at),
        },
      };
    },
  );

  // POST / — moderator+
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/",
    {
      schema: { body: createAgencySchema },
      preHandler: [fastify.requireRole("moderator")],
    },
    async (request, _reply) => {
      const body = request.body;
      const id = nanoid();
      const now = new Date();

      await fastify.db
        .insertInto("state_agencies")
        .values({
          id,
          state_usps: body.stateUsps,
          name: body.name,
          abbreviation: body.abbreviation ?? null,
          category: body.category ?? null,
          website_url: body.websiteUrl ?? null,
          created_at: now,
          updated_at: now,
        })
        .execute();

      return {
        success: true,
        data: {
          id,
          stateUsps: body.stateUsps,
          name: body.name,
          abbreviation: body.abbreviation ?? null,
          category: body.category ?? null,
          websiteUrl: body.websiteUrl ?? null,
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
      schema: { params: idParamsSchema, body: updateAgencySchema },
      preHandler: [fastify.requireRole("moderator")],
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      const existing = await fastify.db
        .selectFrom("state_agencies")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({ success: false, error: "Agency not found" });
      }

      const now = new Date();
      const updateValues: Record<string, unknown> = { updated_at: now };
      if (body.name !== undefined) updateValues.name = body.name;
      if (body.abbreviation !== undefined) updateValues.abbreviation = body.abbreviation;
      if (body.category !== undefined) updateValues.category = body.category;
      if (body.websiteUrl !== undefined) updateValues.website_url = body.websiteUrl;

      await fastify.db
        .updateTable("state_agencies")
        .set(updateValues)
        .where("id", "=", id)
        .execute();

      return {
        success: true,
        data: {
          id,
          stateUsps: existing.state_usps,
          name: (body.name ?? existing.name),
          abbreviation: (body.abbreviation !== undefined ? body.abbreviation : existing.abbreviation) ?? null,
          category: (body.category !== undefined ? body.category : existing.category) ?? null,
          websiteUrl: (body.websiteUrl !== undefined ? body.websiteUrl : existing.website_url) ?? null,
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
        .selectFrom("state_agencies")
        .select(["id"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({ success: false, error: "Agency not found" });
      }

      await fastify.db
        .deleteFrom("state_agencies")
        .where("id", "=", id)
        .execute();

      return { success: true };
    },
  );
};

export default plugin;
