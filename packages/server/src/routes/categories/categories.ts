import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { nanoid } from "nanoid";
import { createCategorySchema, updateCategorySchema } from "@opo/shared";

const idParamsSchema = z.object({ id: z.string() });

function mapCategoryRow(r: Record<string, unknown>) {
  return {
    id: r.id as string,
    name: r.name as string,
    description: (r.description ?? null) as string | null,
    minVendors: (r.min_vendors ?? null) as number | null,
    maxVendors: (r.max_vendors ?? null) as number | null,
    minProducts: (r.min_products ?? null) as number | null,
    maxProducts: (r.max_products ?? null) as number | null,
    minTechnologies: (r.min_technologies ?? null) as number | null,
    maxTechnologies: (r.max_technologies ?? null) as number | null,
    minGovernmentEntities: (r.min_government_entities ?? null) as number | null,
    maxGovernmentEntities: (r.max_government_entities ?? null) as number | null,
    requireGovernmentLocation: (r.require_government_location ?? null) as boolean | null,
  };
}

const plugin: FastifyPluginAsync = async (fastify) => {
  // GET / — list all categories
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/",
    { schema: {} },
    async (_request, _reply) => {
      const rows = await fastify.db
        .selectFrom("document_categories")
        .selectAll()
        .orderBy("name", "asc")
        .execute();

      return {
        success: true,
        data: rows.map((r) => mapCategoryRow(r as Record<string, unknown>)),
      };
    },
  );

  // GET /:id — get single category
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/:id",
    {
      schema: {
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const row = await fastify.db
        .selectFrom("document_categories")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();

      if (!row) {
        return reply.status(404).send({ success: false, error: "Category not found" });
      }

      return {
        success: true,
        data: mapCategoryRow(row as Record<string, unknown>),
      };
    },
  );

  // POST / — create category (moderator+)
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/",
    {
      preHandler: [fastify.requireRole("moderator")],
      schema: {
        body: createCategorySchema,
      },
    },
    async (request, reply) => {
      const { id, name, description } = request.body;

      try {
        await fastify.db
          .insertInto("document_categories")
          .values({
            id,
            name,
            description: description ?? null,
          })
          .execute();
      } catch (err: unknown) {
        const pgErr = err as { code?: string };
        if (pgErr.code === "23505") {
          return reply.status(409).send({ success: false, error: "A category with this ID already exists" });
        }
        throw err;
      }

      const row = await fastify.db
        .selectFrom("document_categories")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirstOrThrow();

      return {
        success: true,
        data: mapCategoryRow(row as Record<string, unknown>),
      };
    },
  );

  // PUT /:id — update category (moderator+)
  fastify.withTypeProvider<ZodTypeProvider>().put(
    "/:id",
    {
      preHandler: [fastify.requireRole("moderator")],
      schema: {
        params: idParamsSchema,
        body: updateCategorySchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { name, description } = request.body;

      const existing = await fastify.db
        .selectFrom("document_categories")
        .select("id")
        .where("id", "=", id)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({ success: false, error: "Category not found" });
      }

      const updateValues: Record<string, unknown> = {};
      if (name !== undefined) updateValues.name = name;
      if (description !== undefined) updateValues.description = description;

      if (Object.keys(updateValues).length > 0) {
        await fastify.db
          .updateTable("document_categories")
          .set(updateValues)
          .where("id", "=", id)
          .execute();
      }

      const row = await fastify.db
        .selectFrom("document_categories")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirstOrThrow();

      return {
        success: true,
        data: mapCategoryRow(row as Record<string, unknown>),
      };
    },
  );

  // DELETE /:id — delete category (moderator+)
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    "/:id",
    {
      preHandler: [fastify.requireRole("moderator")],
      schema: {
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await fastify.db
        .selectFrom("document_categories")
        .select("id")
        .where("id", "=", id)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({ success: false, error: "Category not found" });
      }

      await fastify.db
        .deleteFrom("document_categories")
        .where("id", "=", id)
        .execute();

      return { success: true };
    },
  );
};

export default plugin;
