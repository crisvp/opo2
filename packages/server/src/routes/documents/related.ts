import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { nanoid } from "nanoid";

const idParamsSchema = z.object({ id: z.string() });

const addRelatedBodySchema = z.object({
  targetDocumentId: z.string().min(1),
  associationTypeId: z.string().min(1),
  context: z.string().optional(),
});

const plugin: FastifyPluginAsync = async (fastify) => {
  // GET /:id/related — public for public docs, auth for non-public
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/:id/related",
    {
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user;

      // Check document exists and determine visibility
      const doc = await fastify.db
        .selectFrom("documents")
        .select(["id", "state", "uploader_id"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!doc) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      const isPublic = doc.state === "approved";
      const isOwner = user && doc.uploader_id === user.id;
      const isModerator = user && (user.role === "moderator" || user.role === "admin");

      if (!isPublic && !isOwner && !isModerator) {
        if (!user) {
          return reply.status(401).send({ success: false, error: "Authentication required" });
        }
        return reply.status(403).send({ success: false, error: "Not authorized" });
      }

      // Fetch associations where this doc is source OR target
      const associations = await fastify.db
        .selectFrom("document_document_associations")
        .selectAll()
        .where((eb) =>
          eb.or([
            eb("source_document_id", "=", id),
            eb("target_document_id", "=", id),
          ]),
        )
        .execute();

      // Collect related document IDs
      const relatedIds = new Set<string>();
      for (const a of associations) {
        if (a.source_document_id !== id) relatedIds.add(a.source_document_id);
        if (a.target_document_id !== id) relatedIds.add(a.target_document_id);
      }

      // Fetch related documents
      const relatedDocMap = new Map<string, { title: string; state: string }>();
      if (relatedIds.size > 0) {
        const relatedDocs = await fastify.db
          .selectFrom("documents")
          .select(["id", "title", "state"])
          .where("id", "in", [...relatedIds])
          .execute();
        for (const rd of relatedDocs) {
          relatedDocMap.set(rd.id, {
            title: rd.title ?? "(untitled)",
            state: rd.state,
          });
        }
      }

      // Fetch association type names
      const assocTypeIds = new Set<string>();
      for (const a of associations) {
        if (a.association_type_id) assocTypeIds.add(a.association_type_id);
      }

      const assocTypeMap = new Map<string, string>();
      if (assocTypeIds.size > 0) {
        const assocTypes = await fastify.db
          .selectFrom("association_types")
          .select(["id", "name"])
          .where("id", "in", [...assocTypeIds])
          .execute();
        for (const at of assocTypes) {
          assocTypeMap.set(at.id, at.name);
        }
      }

      // Build response
      const data = associations.map((a) => {
        const isOutgoing = a.source_document_id === id;
        const relatedDocId = isOutgoing ? a.target_document_id : a.source_document_id;
        const relatedDoc = relatedDocMap.get(relatedDocId);
        const assocTypeName = assocTypeMap.get(a.association_type_id) ?? "";

        return {
          associationId: a.id,
          direction: isOutgoing ? "outgoing" : "incoming",
          associationTypeId: a.association_type_id,
          associationTypeName: assocTypeName,
          context: a.context ?? null,
          relatedDocumentId: relatedDocId,
          relatedDocumentTitle: relatedDoc?.title ?? "(untitled)",
          relatedDocumentState: relatedDoc?.state ?? "unknown",
          createdAt:
            a.created_at instanceof Date
              ? a.created_at.toISOString()
              : String(a.created_at),
        };
      });

      return { success: true, data };
    },
  );

  // POST /:id/related — auth required (owner or moderator)
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/:id/related",
    {
      schema: { params: idParamsSchema, body: addRelatedBodySchema },
      preHandler: [fastify.requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { targetDocumentId, associationTypeId, context } = request.body;
      const user = request.user!;

      if (id === targetDocumentId) {
        return reply.status(422).send({
          success: false,
          error: "Source and target documents must be different",
        });
      }

      // Verify source document exists and user has permission
      const sourceDoc = await fastify.db
        .selectFrom("documents")
        .select(["id", "uploader_id"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!sourceDoc) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      const isOwner = sourceDoc.uploader_id === user.id;
      const isModerator = user.role === "moderator" || user.role === "admin";

      if (!isOwner && !isModerator) {
        return reply.status(403).send({ success: false, error: "Not authorized" });
      }

      // Verify target document exists
      const targetDoc = await fastify.db
        .selectFrom("documents")
        .select(["id"])
        .where("id", "=", targetDocumentId)
        .executeTakeFirst();

      if (!targetDoc) {
        return reply.status(404).send({ success: false, error: "Target document not found" });
      }

      // Verify association type exists
      const assocType = await fastify.db
        .selectFrom("association_types")
        .select(["id"])
        .where("id", "=", associationTypeId)
        .executeTakeFirst();

      if (!assocType) {
        return reply.status(404).send({ success: false, error: "Association type not found" });
      }

      const assocId = nanoid();
      const now = new Date();

      await fastify.db
        .insertInto("document_document_associations")
        .values({
          id: assocId,
          source_document_id: id,
          target_document_id: targetDocumentId,
          association_type_id: associationTypeId,
          context: context ?? null,
          created_at: now,
        })
        .execute();

      return { success: true, data: { id: assocId } };
    },
  );
};

export default plugin;
