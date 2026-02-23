import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

import { updateDocumentSchema, updateDocumentLocationSchema, EDITABLE_STATES, DELETABLE_STATES, hasRole } from "@opo/shared";
import { deleteObject } from "../../services/storage.js";

const idParamsSchema = z.object({ id: z.string() });

const plugin: FastifyPluginAsync = async (fastify) => {
  // PUT /:id — Owner, editable states only
  fastify.withTypeProvider<ZodTypeProvider>().put(
    "/:id",
    {
      schema: {
        params: idParamsSchema,
        body: updateDocumentSchema,
      },
      preHandler: [fastify.requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body;
      const user = request.user!;

      const doc = await fastify.db
        .selectFrom("documents")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();

      if (!doc) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      if ((doc.uploader_id as string) !== user.id && !hasRole(user.role, "admin")) {
        return reply.status(403).send({ success: false, error: "Not authorized" });
      }

      const currentState = doc.state as string;
      if (!EDITABLE_STATES.includes(currentState as (typeof EDITABLE_STATES)[number])) {
        return reply.status(422).send({
          success: false,
          error: `Document in state '${currentState}' cannot be edited`,
        });
      }

      const updateValues: Record<string, unknown> = { updated_at: new Date() };
      if (body.title !== undefined) updateValues.title = body.title;
      if (body.description !== undefined) updateValues.description = body.description;
      if (body.documentDate !== undefined) updateValues.document_date = body.documentDate;
      if (body.category !== undefined) updateValues.category = body.category;

      await fastify.db
        .updateTable("documents")
        .set(updateValues)
        .where("id", "=", id)
        .execute();

      const updated = await fastify.db
        .selectFrom("documents")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirstOrThrow();

      return {
        success: true,
        data: {
          id: updated.id as string,
          title: updated.title as string,
          description: (updated.description ?? null) as string | null,
          filename: updated.filename as string,
          filepath: updated.filepath as string,
          mimetype: updated.mimetype as string,
          size: Number(updated.size),
          uploaderId: (updated.uploader_id ?? null) as string | null,
          governmentLevel: (updated.government_level ?? null) as string | null,
          stateUsps: (updated.state_usps ?? null) as string | null,
          placeGeoid: (updated.place_geoid ?? null) as string | null,
          tribeId: (updated.tribe_id ?? null) as string | null,
          documentDate: (updated.document_date ?? null) as string | null,
          category: (updated.category ?? null) as string | null,
          state: updated.state as string,
          useAiExtraction: updated.use_ai_extraction as boolean,
          reviewedBy: (updated.reviewed_by ?? null) as string | null,
          reviewedAt: updated.reviewed_at
            ? (updated.reviewed_at as Date).toISOString()
            : null,
          rejectionReason: (updated.rejection_reason ?? null) as string | null,
          processingStartedAt: updated.processing_started_at
            ? (updated.processing_started_at as Date).toISOString()
            : null,
          processingCompletedAt: updated.processing_completed_at
            ? (updated.processing_completed_at as Date).toISOString()
            : null,
          sourceId: (updated.source_id ?? null) as string | null,
          externalId: (updated.external_id ?? null) as string | null,
          createdAt: (updated.created_at as Date).toISOString(),
          updatedAt: (updated.updated_at as Date).toISOString(),
        },
      };
    },
  );

  // DELETE /:id — Owner or admin, deletable states only
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    "/:id",
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

      if ((doc.uploader_id as string | null) !== user.id && !hasRole(user.role, "admin")) {
        return reply.status(403).send({ success: false, error: "Not authorized" });
      }

      const currentState = doc.state as string;
      if (!DELETABLE_STATES.includes(currentState as (typeof DELETABLE_STATES)[number])) {
        return reply.status(422).send({
          success: false,
          error: `Document in state '${currentState}' cannot be deleted`,
        });
      }

      // Delete document row (cascade handles related tables)
      await fastify.db
        .deleteFrom("documents")
        .where("id", "=", id)
        .execute();

      // Delete S3 file if present
      const filepath = doc.filepath as string | null;
      if (filepath) {
        try {
          await deleteObject(filepath);
        } catch {
          // Log but don't fail — DB row is already deleted
        }
      }

      return { success: true };
    },
  );

  // PUT /:id/location — Owner, editable states only
  fastify.withTypeProvider<ZodTypeProvider>().put(
    "/:id/location",
    {
      schema: {
        params: idParamsSchema,
        body: updateDocumentLocationSchema,
      },
      preHandler: [fastify.requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body;
      const user = request.user!;

      const doc = await fastify.db
        .selectFrom("documents")
        .select(["uploader_id", "state"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!doc) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      if ((doc.uploader_id as string) !== user.id && !hasRole(user.role, "admin")) {
        return reply.status(403).send({ success: false, error: "Not authorized" });
      }

      const currentState = doc.state as string;
      if (!EDITABLE_STATES.includes(currentState as (typeof EDITABLE_STATES)[number])) {
        return reply.status(422).send({
          success: false,
          error: `Document in state '${currentState}' cannot be edited`,
        });
      }

      await fastify.db
        .updateTable("documents")
        .set({
          government_level: body.governmentLevel,
          state_usps: body.stateUsps,
          place_geoid: body.placeGeoid,
          tribe_id: body.tribeId,
          updated_at: new Date(),
        })
        .where("id", "=", id)
        .execute();

      return { success: true };
    },
  );
};

export default plugin;
