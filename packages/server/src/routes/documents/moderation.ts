import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { sql } from "kysely";

const idParamsSchema = z.object({ id: z.string() });

const rejectBodySchema = z.object({
  reason: z.string().min(1).max(1000),
});

const plugin: FastifyPluginAsync = async (fastify) => {
  // POST /:id/approve — Moderator+
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/:id/approve",
    {
      schema: { params: idParamsSchema },
      preHandler: [fastify.requireRole("moderator")],
    },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user!;

      const doc = await fastify.db
        .selectFrom("documents")
        .select(["id", "state"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!doc) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      if (doc.state !== "moderator_review") {
        return reply.status(422).send({
          success: false,
          error: `Document must be in moderator_review state to approve (current: ${doc.state})`,
        });
      }

      await fastify.db
        .updateTable("documents")
        .set({
          state: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date(),
          updated_at: new Date(),
        })
        .where("id", "=", id)
        .execute();

      await sql`SELECT pg_notify('document_status', ${JSON.stringify({ documentId: id, state: "approved" })})`.execute(
        fastify.db,
      );

      return { success: true, data: { id, state: "approved" } };
    },
  );

  // POST /:id/reject — Moderator+
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/:id/reject",
    {
      schema: {
        params: idParamsSchema,
        body: rejectBodySchema,
      },
      preHandler: [fastify.requireRole("moderator")],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { reason } = request.body;
      const user = request.user!;

      const doc = await fastify.db
        .selectFrom("documents")
        .select(["id", "state"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!doc) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      if (doc.state !== "moderator_review") {
        return reply.status(422).send({
          success: false,
          error: `Document must be in moderator_review state to reject (current: ${doc.state})`,
        });
      }

      await fastify.db
        .updateTable("documents")
        .set({
          state: "rejected",
          rejection_reason: reason,
          reviewed_by: user.id,
          reviewed_at: new Date(),
          updated_at: new Date(),
        })
        .where("id", "=", id)
        .execute();

      await sql`SELECT pg_notify('document_status', ${JSON.stringify({ documentId: id, state: "rejected" })})`.execute(
        fastify.db,
      );

      return { success: true, data: { id, state: "rejected" } };
    },
  );
};

export default plugin;
