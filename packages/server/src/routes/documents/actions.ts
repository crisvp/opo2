import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { nanoid } from "nanoid";
import { makeWorkerUtils } from "graphile-worker";

import { env } from "../../config/env.js";
import { importFromDcSchema } from "@opo/shared";
import { isValidStateTransition } from "@opo/shared";

const idParamsSchema = z.object({ id: z.string() });

const DC_API_BASE = "https://api.www.documentcloud.org/api";

interface DCDocument {
  id: number;
  title: string;
  description: string | null;
  pages: number;
  canonical_url: string;
  file_url: string | null;
  organization: { name: string } | null;
  created_at: string;
}

const plugin: FastifyPluginAsync = async (fastify) => {
  // POST /import-from-dc — Authenticated user (any role)
  // IMPORTANT: must be registered before /:id routes to prevent "import-from-dc" being parsed as :id
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/import-from-dc",
    {
      schema: { body: importFromDcSchema },
      preHandler: [fastify.requireAuth],
    },
    async (request, reply) => {
      const body = request.body;
      const user = request.user!;

      // Check if this DC document is already imported
      const existing = await fastify.db
        .selectFrom("documents")
        .select(["id"])
        .where("source_id", "=", String(body.documentCloudId))
        .executeTakeFirst();

      if (existing) {
        return reply.status(409).send({
          success: false,
          error: "This DocumentCloud document has already been imported",
        });
      }

      // Fetch document metadata from DC API
      let dcDoc: DCDocument;
      try {
        const metaRes = await fetch(
          `${DC_API_BASE}/documents/${body.documentCloudId}/`,
          {
            signal: AbortSignal.timeout(10_000),
            headers: { Accept: "application/json" },
          },
        );
        if (!metaRes.ok) {
          return reply.status(502).send({
            success: false,
            error: `DocumentCloud API returned ${metaRes.status}`,
          });
        }
        dcDoc = (await metaRes.json()) as DCDocument;
      } catch {
        return reply.status(502).send({
          success: false,
          error: "Failed to reach DocumentCloud API",
        });
      }

      if (!dcDoc.file_url) {
        return reply.status(422).send({
          success: false,
          error: "DocumentCloud document has no downloadable file",
        });
      }

      // Create the document row in submitted state — background job will download from DC
      const documentId = nanoid();
      const now = new Date();
      const title = dcDoc.title.trim() || `DocumentCloud #${body.documentCloudId}`;

      await fastify.db
        .insertInto("documents")
        .values({
          id: documentId,
          title,
          description: dcDoc.description ?? null,
          filename: `dc-${body.documentCloudId}.pdf`,
          filepath: `documents/${documentId}/original.pdf`,
          mimetype: "application/pdf",
          size: 0,
          uploader_id: user.id,
          government_level: body.governmentLevel,
          state_usps: body.stateUsps ?? null,
          place_geoid: body.placeGeoid ?? null,
          tribe_id: body.tribeId ?? null,
          source_id: String(body.documentCloudId),
          use_ai_extraction: body.useAi,
          state: "submitted",
          created_at: now,
          updated_at: now,
        })
        .execute();

      // Enqueue documentcloud_import job to download and process the file
      const workerUtils = await makeWorkerUtils({ connectionString: env.DATABASE_URL });
      try {
        await workerUtils.addJob("documentcloud_import_single", {
          documentId,
          documentCloudId: body.documentCloudId,
          userId: user.id,
        });
      } finally {
        await workerUtils.release();
      }

      return reply.status(201).send({ documentId });
    },
  );

  // POST /:id/save-draft — Authenticated user (owner); transitions user_review → draft
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/:id/save-draft",
    {
      schema: { params: idParamsSchema },
      preHandler: [fastify.requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user!;

      const doc = await fastify.db
        .selectFrom("documents")
        .select(["id", "state", "uploader_id"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!doc) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      if (doc.uploader_id === null || doc.uploader_id !== user.id) {
        return reply.status(403).send({ success: false, error: "Not authorized" });
      }

      const currentState = doc.state as import("@opo/shared").DocumentState;
      if (!isValidStateTransition(currentState, "draft")) {
        return reply.status(422).send({
          success: false,
          error: `Cannot save as draft from state '${doc.state}' (must be in user_review)`,
        });
      }

      await fastify.db
        .updateTable("documents")
        .set({ state: "draft", updated_at: new Date() })
        .where("id", "=", id)
        .execute();

      return reply.send({ success: true });
    },
  );

  // POST /:id/reopen — Authenticated user (owner); transitions rejected → user_review
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/:id/reopen",
    {
      schema: { params: idParamsSchema },
      preHandler: [fastify.requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user!;

      const doc = await fastify.db
        .selectFrom("documents")
        .select(["id", "state", "uploader_id"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!doc) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      if (doc.uploader_id === null || doc.uploader_id !== user.id) {
        return reply.status(403).send({ success: false, error: "Not authorized" });
      }

      const currentState = doc.state as import("@opo/shared").DocumentState;
      if (!isValidStateTransition(currentState, "user_review")) {
        return reply.status(422).send({
          success: false,
          error: `Cannot reopen from state '${doc.state}' (must be in rejected)`,
        });
      }

      await fastify.db
        .updateTable("documents")
        .set({ state: "user_review", updated_at: new Date() })
        .where("id", "=", id)
        .execute();

      return reply.send({ success: true });
    },
  );
};

export default plugin;
