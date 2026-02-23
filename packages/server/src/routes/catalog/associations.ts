import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { nanoid } from "nanoid";

import { createCatalogAssociationSchema } from "@opo/shared";

const idParamsSchema = z.object({
  id: z.string(),
});

const plugin: FastifyPluginAsync = async (fastify) => {
  // POST /entries/:id/associations — create catalog entry association (moderator+)
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/entries/:id/associations",
    {
      preHandler: [fastify.requireRole("moderator")],
      schema: {
        params: idParamsSchema,
        body: createCatalogAssociationSchema,
      },
    },
    async (request, reply) => {
      const { id: sourceEntryId } = request.params;
      const { targetEntryId, associationTypeId } = request.body;

      const sourceEntry = await fastify.db
        .selectFrom("catalog_entries")
        .select("id")
        .where("id", "=", sourceEntryId)
        .executeTakeFirst();

      if (!sourceEntry) {
        return reply.status(404).send({ success: false, error: "Source catalog entry not found" });
      }

      const targetEntry = await fastify.db
        .selectFrom("catalog_entries")
        .select("id")
        .where("id", "=", targetEntryId)
        .executeTakeFirst();

      if (!targetEntry) {
        return reply.status(404).send({ success: false, error: "Target catalog entry not found" });
      }

      const assocType = await fastify.db
        .selectFrom("association_types")
        .select("id")
        .where("id", "=", associationTypeId)
        .executeTakeFirst();

      if (!assocType) {
        return reply.status(400).send({ success: false, error: "Invalid association type" });
      }

      const assocId = nanoid();
      const now = new Date();

      try {
        await fastify.db
          .insertInto("catalog_entry_associations")
          .values({
            id: assocId,
            source_entry_id: sourceEntryId,
            target_entry_id: targetEntryId,
            association_type_id: associationTypeId,
            created_at: now,
          })
          .execute();
      } catch (err: unknown) {
        const pgErr = err as { code?: string };
        if (pgErr.code === "23505") {
          return reply.status(409).send({
            success: false,
            error: "This association already exists",
          });
        }
        throw err;
      }

      return {
        success: true,
        data: {
          id: assocId,
          sourceEntryId,
          targetEntryId,
          associationTypeId,
          createdAt: now.toISOString(),
        },
      };
    },
  );

  // DELETE /associations/:id — remove catalog entry association (moderator+)
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    "/associations/:id",
    {
      preHandler: [fastify.requireRole("moderator")],
      schema: {
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await fastify.db
        .selectFrom("catalog_entry_associations")
        .select("id")
        .where("id", "=", id)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({ success: false, error: "Association not found" });
      }

      await fastify.db
        .deleteFrom("catalog_entry_associations")
        .where("id", "=", id)
        .execute();

      return { success: true, data: null };
    },
  );
};

export default plugin;
