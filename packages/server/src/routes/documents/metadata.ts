import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { nanoid } from "nanoid";

import { EDITABLE_STATES } from "@opo/shared";

const idParamsSchema = z.object({ id: z.string() });
const fieldKeyParamsSchema = z.object({ id: z.string(), fieldKey: z.string() });

const metadataItemSchema = z.object({
  fieldKey: z.string().min(1),
  valueText: z.string().optional(),
  valueNumber: z.number().optional(),
  valueDate: z.string().optional(),
  valueBoolean: z.boolean().optional(),
  source: z.string().optional(),
});

const metadataBodySchema = z.array(metadataItemSchema);

const plugin: FastifyPluginAsync = async (fastify) => {
  // PUT /:id/metadata — Owner, editable states
  fastify.withTypeProvider<ZodTypeProvider>().put(
    "/:id/metadata",
    {
      schema: {
        params: idParamsSchema,
        body: metadataBodySchema,
      },
      preHandler: [fastify.requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const items = request.body;
      const user = request.user!;

      const doc = await fastify.db
        .selectFrom("documents")
        .select(["uploader_id", "state"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!doc) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      if ((doc.uploader_id as string) !== user.id && user.role !== "admin") {
        return reply.status(403).send({ success: false, error: "Not authorized" });
      }

      const currentState = doc.state as string;
      if (!EDITABLE_STATES.includes(currentState as (typeof EDITABLE_STATES)[number])) {
        return reply.status(422).send({
          success: false,
          error: `Document in state '${currentState}' cannot be edited`,
        });
      }

      // Upsert each metadata item
      for (const item of items) {
        // Check if exists
        const existing = await fastify.db
          .selectFrom("document_metadata")
          .select(["id"])
          .where("document_id", "=", id)
          .where("field_key", "=", item.fieldKey)
          .executeTakeFirst();

        if (existing) {
          await fastify.db
            .updateTable("document_metadata")
            .set({
              value_text: item.valueText ?? null,
              value_number: item.valueNumber ?? null,
              value_date: item.valueDate ?? null,
              value_boolean: item.valueBoolean ?? null,
              ...(item.source !== undefined ? { source: item.source } : {}),
            })
            .where("id", "=", existing.id as string)
            .execute();
        } else {
          await fastify.db
            .insertInto("document_metadata")
            .values({
              id: nanoid(),
              document_id: id,
              field_key: item.fieldKey,
              field_definition_id: null,
              value_text: item.valueText ?? null,
              value_number: item.valueNumber ?? null,
              value_date: item.valueDate ?? null,
              value_boolean: item.valueBoolean ?? null,
              value_json: null,
              ...(item.source !== undefined ? { source: item.source } : {}),
              confidence: null,
            })
            .execute();
        }
      }

      return { success: true };
    },
  );

  // DELETE /:id/metadata/:fieldKey — Owner
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    "/:id/metadata/:fieldKey",
    {
      schema: { params: fieldKeyParamsSchema },
      preHandler: [fastify.requireAuth],
    },
    async (request, reply) => {
      const { id, fieldKey } = request.params;
      const user = request.user!;

      const doc = await fastify.db
        .selectFrom("documents")
        .select(["uploader_id"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!doc) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      if ((doc.uploader_id as string) !== user.id && user.role !== "admin") {
        return reply.status(403).send({ success: false, error: "Not authorized" });
      }

      await fastify.db
        .deleteFrom("document_metadata")
        .where("document_id", "=", id)
        .where("field_key", "=", fieldKey)
        .execute();

      return { success: true };
    },
  );
};

export default plugin;
