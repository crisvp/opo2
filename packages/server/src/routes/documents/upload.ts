import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { nanoid } from "nanoid";
import { makeWorkerUtils } from "graphile-worker";

import { env } from "../../config/env.js";
import { createPresignedUploadUrl, headObject } from "../../services/storage.js";
import { checkTierLimit, recordUsage } from "../../services/usage.js";
import { initiateUploadSchema, confirmUploadSchema } from "@opo/shared";

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

const idParamsSchema = z.object({
  id: z.string(),
});

function titleFromFilename(filename: string): string {
  return (
    filename
      .replace(/\.[^.]+$/, "") // strip extension
      .replace(/[_-]+/g, " ") // underscores/hyphens → spaces
      .replace(/\b\w/g, (c) => c.toUpperCase()) // capitalize words
      .trim() || "Untitled Document"
  );
}

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
      schema: { body: initiateUploadSchema },
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

      // Insert document row — title auto-derived from filename
      await fastify.db
        .insertInto("documents")
        .values({
          id: documentId,
          title: titleFromFilename(body.filename),
          filename: body.filename,
          filepath: objectKey,
          mimetype: body.mimetype,
          size: body.size,
          uploader_id: user.id,
          government_level: body.governmentLevel,
          state_usps: body.stateUsps ?? null,
          place_geoid: body.placeGeoid ?? null,
          tribe_id: body.tribeId ?? null,
          state: "pending_upload",
          use_ai_extraction: body.useAi,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute();

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
  // Accepts objectKey (for future S3 key verification); always transitions pending_upload → submitted
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

      // Always transition pending_upload → submitted and enqueue the pipeline
      await fastify.db
        .updateTable("documents")
        .set({
          state: "submitted",
          updated_at: new Date(),
        })
        .where("id", "=", id)
        .execute();

      await enqueueVirusScan(id, doc.filepath as string, doc.mimetype as string);

      return {
        success: true,
        data: { id, state: "submitted" },
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
