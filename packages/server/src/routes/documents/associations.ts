import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { nanoid } from "nanoid";
import { EDITABLE_STATES } from "@opo/shared";

const idParamsSchema = z.object({ id: z.string() });

const associationItemSchema = z.object({
  catalogEntryId: z.string(),
  associationTypeId: z.string().optional(),
  role: z.string().optional(),
  context: z.string().optional(),
});

const associationsBodySchema = z.object({
  associations: z.array(associationItemSchema),
});

const plugin: FastifyPluginAsync = async (fastify) => {
  // POST /:id/associations — Auth required (owner or moderator)
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/:id/associations",
    {
      schema: {
        params: idParamsSchema,
        body: associationsBodySchema,
      },
      preHandler: [fastify.requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { associations } = request.body;
      const user = request.user!;

      const doc = await fastify.db
        .selectFrom("documents")
        .select(["id", "uploader_id", "state"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!doc) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      const isOwner = doc.uploader_id === user.id;
      const isModerator = user.role === "moderator" || user.role === "admin";

      if (!isOwner && !isModerator) {
        return reply.status(403).send({ success: false, error: "Not authorized" });
      }

      const currentState = doc.state;
      if (!EDITABLE_STATES.includes(currentState as (typeof EDITABLE_STATES)[number])) {
        return reply.status(422).send({
          success: false,
          error: `Document in state '${currentState}' cannot be edited`,
        });
      }

      // Delete all existing associations then insert new ones
      await fastify.db
        .deleteFrom("document_catalog_associations")
        .where("document_id", "=", id)
        .execute();

      if (associations.length > 0) {
        const rows = associations.map((a) => ({
          id: nanoid(),
          document_id: id,
          entry_id: a.catalogEntryId,
          association_type_id: a.associationTypeId ?? null,
          role: a.role ?? null,
          context: a.context ?? null,
          created_at: new Date(),
        }));

        await fastify.db
          .insertInto("document_catalog_associations")
          .values(rows)
          .execute();
      }

      return { success: true };
    },
  );
};

export default plugin;
