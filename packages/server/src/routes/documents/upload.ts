import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { nanoid } from "nanoid";
import { makeWorkerUtils } from "graphile-worker";

import { env } from "../../config/env.js";
import { createPresignedUploadUrl, headObject } from "../../services/storage.js";
import { checkTierLimit, recordUsage } from "../../services/usage.js";

const ALLOWED_MIMETYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

const initiateSchema = z.object({
  title: z.string().min(1).max(500),
  filename: z.string().min(1),
  mimetype: z.string().min(1),
  size: z.number().int().positive().max(MAX_SIZE),
  description: z.string().max(5000).optional(),
  documentDate: z.string().optional(),
  governmentLevel: z.enum(["federal", "state", "county", "place", "tribal"]).optional(),
  stateUsps: z.string().length(2).optional(),
  placeGeoid: z.string().optional(),
  tribeId: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string().min(1).max(100)).optional(),
  saveAsDraft: z.boolean().optional().default(false),
});

const confirmUploadSchema = z.object({
  saveAsDraft: z.boolean().optional().default(false),
});

const idParamsSchema = z.object({
  id: z.string(),
});

async function enqueueVirusScan(documentId: string, s3Key: string, mimetype: string): Promise<void> {
  const workerUtils = await makeWorkerUtils({ connectionString: env.DATABASE_URL });
  await workerUtils.addJob("virus_scan", { documentId, s3Key, mimetype });
  await workerUtils.release();
}

const plugin: FastifyPluginAsync = async (fastify) => {
  // POST /initiate — Auth required
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/initiate",
    {
      schema: { body: initiateSchema },
      preHandler: [fastify.requireAuth],
    },
    async (request, reply) => {
      const body = request.body;
      const user = request.user!;

      // Validate MIME type
      if (!ALLOWED_MIMETYPES.has(body.mimetype)) {
        return reply.status(400).send({
          success: false,
          error: `MIME type '${body.mimetype}' is not allowed`,
        });
      }

      // Check tier limit
      const tierCheck = await checkTierLimit(fastify.db, user.id, "uploads", user.role);
      if (!tierCheck.allowed) {
        return reply.status(429).send({
          success: false,
          error: `Upload limit reached. Used ${tierCheck.used} of ${tierCheck.limit} uploads today.`,
        });
      }

      // Generate IDs and object key
      const documentId = nanoid();
      const safeFilename = body.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const objectKey = `documents/${documentId}/${safeFilename}`;

      // Create presigned POST URL
      const { url: presignedUrl, fields: presignedFields } = await createPresignedUploadUrl(
        objectKey,
        body.mimetype,
      );

      // Insert document row
      await fastify.db
        .insertInto("documents")
        .values({
          id: documentId,
          title: body.title,
          description: body.description ?? null,
          filename: body.filename,
          filepath: objectKey,
          mimetype: body.mimetype,
          size: body.size,
          uploader_id: user.id,
          government_level: body.governmentLevel ?? null,
          state_usps: body.stateUsps ?? null,
          place_geoid: body.placeGeoid ?? null,
          tribe_id: body.tribeId ?? null,
          document_date: body.documentDate ?? null,
          category: body.category ?? null,
          state: "pending_upload",
          use_ai_extraction: true,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute();

      // Insert tags if provided
      if (body.tags && body.tags.length > 0) {
        const normalizedTags = [...new Set(body.tags.map((t) => t.trim().toLowerCase()))];
        await fastify.db
          .insertInto("document_tags")
          .values(
            normalizedTags.map((tag) => ({
              id: nanoid(),
              document_id: documentId,
              tag,
              created_at: new Date(),
            })),
          )
          .execute();
      }

      return {
        success: true,
        data: {
          documentId,
          presignedUrl,
          presignedFields,
          objectKey,
        },
      };
    },
  );

  // POST /:id/confirm-upload — Auth required
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/:id/confirm-upload",
    {
      schema: {
        params: idParamsSchema,
        body: confirmUploadSchema,
      },
      preHandler: [fastify.requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body;
      const user = request.user!;

      // Fetch document
      const doc = await fastify.db
        .selectFrom("documents")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();

      if (!doc) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      // Verify ownership
      if ((doc.uploader_id as string) !== user.id) {
        return reply.status(403).send({ success: false, error: "Not authorized" });
      }

      // Verify state
      if ((doc.state as string) !== "pending_upload") {
        return reply.status(422).send({
          success: false,
          error: "Document is not in pending_upload state",
        });
      }

      // Verify S3 object exists
      const s3Info = await headObject(doc.filepath as string);
      if (!s3Info) {
        return reply.status(422).send({ success: false, error: "File not found in S3" });
      }

      // Record usage
      await recordUsage(fastify.db, user.id, "uploads");

      // Determine new state
      const newState = body.saveAsDraft ? "draft" : "submitted";

      // Update document state
      await fastify.db
        .updateTable("documents")
        .set({
          state: newState,
          updated_at: new Date(),
        })
        .where("id", "=", id)
        .execute();

      // If submitted, enqueue virus scan job
      if (newState === "submitted") {
        await enqueueVirusScan(id, doc.filepath as string, doc.mimetype as string);
      }

      return {
        success: true,
        data: { id, state: newState },
      };
    },
  );

  // POST /:id/submit — Auth required (F19 submit draft)
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/:id/submit",
    {
      schema: { params: idParamsSchema },
      preHandler: [fastify.requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user!;

      // Fetch document
      const doc = await fastify.db
        .selectFrom("documents")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();

      if (!doc) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      // Verify ownership
      if ((doc.uploader_id as string) !== user.id) {
        return reply.status(403).send({ success: false, error: "Not authorized" });
      }

      // Verify state is draft
      if ((doc.state as string) !== "draft") {
        return reply.status(422).send({
          success: false,
          error: "Document is not in draft state",
        });
      }

      // Check tier limit
      const tierCheck = await checkTierLimit(fastify.db, user.id, "uploads", user.role);
      if (!tierCheck.allowed) {
        return reply.status(429).send({
          success: false,
          error: `Upload limit reached. Used ${tierCheck.used} of ${tierCheck.limit} uploads today.`,
        });
      }

      // Update state to submitted
      await fastify.db
        .updateTable("documents")
        .set({
          state: "submitted",
          updated_at: new Date(),
        })
        .where("id", "=", id)
        .execute();

      // Enqueue virus scan
      await enqueueVirusScan(id, doc.filepath as string, doc.mimetype as string);

      return {
        success: true,
        data: { id, state: "submitted" },
      };
    },
  );
};

export default plugin;
