import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { makeWorkerUtils } from "graphile-worker";

import { env } from "../../config/env.js";
import { deleteObject } from "../../services/storage.js";

const idParamsSchema = z.object({
  id: z.string(),
});

const plugin: FastifyPluginAsync = async (fastify) => {
  // GET /failed-processing — list documents in processing_failed state
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/failed-processing",
    {
      preHandler: [fastify.requireRole("admin")],
    },
    async (_request, _reply) => {
      const countResult = await fastify.db
        .selectFrom("documents")
        .select(fastify.db.fn.countAll<number>().as("count"))
        .where("state", "=", "processing_failed")
        .executeTakeFirstOrThrow();
      const total = Number(countResult.count);

      const rows = await fastify.db
        .selectFrom("documents as d")
        .leftJoin(
          "document_processing_results as dpr",
          "dpr.document_id",
          "d.id",
        )
        .select([
          "d.id",
          "d.title",
          "d.filename",
          "d.state",
          "d.filepath",
          "dpr.sieve_category",
          "dpr.ai_extraction_error",
        ])
        .where("d.state", "=", "processing_failed")
        .orderBy("d.created_at", "desc")
        .execute();

      const items = rows.map((r) => ({
        id: r.id,
        title: r.title,
        filename: r.filename,
        state: r.state,
        sieveCategory: r.sieve_category ?? null,
        aiExtractionError: r.ai_extraction_error ?? null,
      }));

      return { success: true, data: { items, total } };
    },
  );

  // POST /failed-processing/:id/retry — re-enqueue virus_scan
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/failed-processing/:id/retry",
    {
      schema: { params: idParamsSchema },
      preHandler: [fastify.requireRole("admin")],
    },
    async (request, reply) => {
      const { id } = request.params;

      const doc = await fastify.db
        .selectFrom("documents")
        .select(["id", "filepath", "state", "mimetype"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!doc) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      // Reset state to submitted
      await fastify.db
        .updateTable("documents")
        .set({ state: "submitted", updated_at: new Date() })
        .where("id", "=", id)
        .execute();

      // Re-enqueue virus_scan
      const workerUtils = await makeWorkerUtils({ connectionString: env.DATABASE_URL });
      await workerUtils.addJob("virus_scan", { documentId: id, s3Key: doc.filepath, mimetype: doc.mimetype });
      await workerUtils.release();

      return { success: true };
    },
  );

  // DELETE /failed-processing/:id — delete document and S3 file
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    "/failed-processing/:id",
    {
      schema: { params: idParamsSchema },
      preHandler: [fastify.requireRole("admin")],
    },
    async (request, reply) => {
      const { id } = request.params;

      const doc = await fastify.db
        .selectFrom("documents")
        .select(["id", "filepath"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!doc) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      // Delete from database first (cascade handles related rows)
      await fastify.db
        .deleteFrom("documents")
        .where("id", "=", id)
        .execute();

      // Delete from S3
      if (doc.filepath) {
        try {
          await deleteObject(doc.filepath);
        } catch {
          // Log but don't fail the request if S3 deletion fails
        }
      }

      return { success: true };
    },
  );
};

export default plugin;
