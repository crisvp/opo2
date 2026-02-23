import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { sql } from "kysely";
import { makeWorkerUtils } from "graphile-worker";
import { env } from "../../config/env.js";

const idParamsSchema = z.object({ id: z.string() });

const plugin: FastifyPluginAsync = async (fastify) => {
  // GET /:id/ai-metadata — Auth required (owner or moderator)
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/:id/ai-metadata",
    {
      schema: { params: idParamsSchema },
      preHandler: [fastify.requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
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

      // Fetch processing results
      const processingResult = await fastify.db
        .selectFrom("document_processing_results")
        .selectAll()
        .where("document_id", "=", id)
        .executeTakeFirst();

      // Fetch document metadata
      const metadataRows = await fastify.db
        .selectFrom("document_metadata")
        .selectAll()
        .where("document_id", "=", id)
        .execute();

      // Fetch catalog matches (document_catalog_associations joined with catalog_entries)
      // Note: document_catalog_associations has no confidence column
      const catalogAssocRows = await fastify.db
        .selectFrom("document_catalog_associations as dca")
        .innerJoin("catalog_entries as ce", "ce.id", "dca.entry_id")
        .select([
          "ce.id as entry_id",
          "ce.name",
          "ce.type_id",
        ])
        .where("dca.document_id", "=", id)
        .execute();

      const catalogMatches = catalogAssocRows.map((r) => ({
        entryId: r.entry_id,
        name: r.name,
        typeId: r.type_id,
        confidence: null as number | null,
      }));

      return {
        success: true,
        data: {
          processingResults: processingResult ?? null,
          metadata: metadataRows,
          catalogMatches,
        },
      };
    },
  );

  // POST /:id/submit-for-moderation — Auth required (owner)
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/:id/submit-for-moderation",
    {
      schema: { params: idParamsSchema },
      preHandler: [fastify.requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user!;

      const doc = await fastify.db
        .selectFrom("documents")
        .select(["id", "uploader_id", "state"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!doc) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      if (doc.uploader_id !== user.id) {
        return reply.status(403).send({ success: false, error: "Not authorized" });
      }

      const currentState = doc.state;
      if (currentState !== "user_review" && currentState !== "moderator_review") {
        return reply.status(422).send({
          success: false,
          error: `Document must be in user_review or moderator_review state (current: ${currentState})`,
        });
      }

      await fastify.db
        .updateTable("documents")
        .set({ state: "moderator_review", updated_at: new Date() })
        .where("id", "=", id)
        .execute();

      await sql`SELECT pg_notify('document_status', ${JSON.stringify({ documentId: id, state: "moderator_review" })})`.execute(
        fastify.db,
      );

      return { success: true, data: { id, state: "moderator_review" } };
    },
  );

  // POST /:id/retry-extraction — Auth required (owner)
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/:id/retry-extraction",
    {
      schema: { params: idParamsSchema },
      preHandler: [fastify.requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user!;

      const doc = await fastify.db
        .selectFrom("documents")
        .select(["id", "uploader_id", "state", "filepath"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!doc) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      if (doc.uploader_id !== user.id) {
        return reply.status(403).send({ success: false, error: "Not authorized" });
      }

      const currentState = doc.state;
      if (currentState !== "user_review" && currentState !== "processing_failed") {
        return reply.status(422).send({
          success: false,
          error: `Document must be in user_review or processing_failed state (current: ${currentState})`,
        });
      }

      await fastify.db
        .updateTable("documents")
        .set({ state: "processing", updated_at: new Date() })
        .where("id", "=", id)
        .execute();

      const workerUtils = await makeWorkerUtils({ connectionString: env.DATABASE_URL });
      await workerUtils.addJob("extractor", { documentId: id, s3Key: doc.filepath });
      await workerUtils.release();

      return { success: true };
    },
  );

  // POST /:id/admin-rerun-extraction — Auth required (admin)
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/:id/admin-rerun-extraction",
    {
      schema: { params: idParamsSchema },
      preHandler: [fastify.requireRole("admin")],
    },
    async (request, reply) => {
      const { id } = request.params;

      const doc = await fastify.db
        .selectFrom("documents")
        .select(["id", "state", "filepath", "mimetype"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!doc) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      await fastify.db
        .updateTable("documents")
        .set({ state: "submitted", updated_at: new Date() })
        .where("id", "=", id)
        .execute();

      const workerUtils = await makeWorkerUtils({ connectionString: env.DATABASE_URL });
      await workerUtils.addJob("virus_scan", { documentId: id, s3Key: doc.filepath, mimetype: doc.mimetype });
      await workerUtils.release();

      return { success: true };
    },
  );
};

export default plugin;
