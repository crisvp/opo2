import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const idParamsSchema = z.object({ id: z.string() });

const plugin: FastifyPluginAsync = async (fastify) => {
  // DELETE /:id — document owner or moderator
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    "/:id",
    {
      schema: { params: idParamsSchema },
      preHandler: [fastify.requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user!;

      // Fetch the association
      const assoc = await fastify.db
        .selectFrom("document_document_associations" as never)
        .select(["id", "source_document_id"] as never[])
        .where("id" as never, "=", id as never)
        .executeTakeFirst();

      if (!assoc) {
        return reply.status(404).send({ success: false, error: "Association not found" });
      }

      const assocRow = assoc as Record<string, unknown>;
      const isModerator = user.role === "moderator" || user.role === "admin";

      if (!isModerator) {
        // Check if user owns the source document
        const sourceDoc = await fastify.db
          .selectFrom("documents" as never)
          .select(["uploader_id"] as never[])
          .where("id" as never, "=", assocRow.source_document_id as never)
          .executeTakeFirst();

        const sourceRow = sourceDoc as Record<string, unknown> | undefined;
        const isOwner = sourceRow && (sourceRow.uploader_id as string | null) === user.id;

        if (!isOwner) {
          return reply.status(403).send({ success: false, error: "Not authorized" });
        }
      }

      await fastify.db
        .deleteFrom("document_document_associations" as never)
        .where("id" as never, "=", id as never)
        .execute();

      return { success: true };
    },
  );
};

export default plugin;
