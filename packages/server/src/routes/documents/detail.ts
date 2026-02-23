import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { hasRole } from "@opo/shared";

const idParamsSchema = z.object({ id: z.string() });

const plugin: FastifyPluginAsync = async (fastify) => {
  // GET /:id — Public (access controlled)
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/:id",
    {
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user;

      // Fetch document with joins
      const doc = await fastify.db
        .selectFrom("documents as d")
        .leftJoin("states as s", "s.usps", "d.state_usps")
        .leftJoin("places as p", "p.geoid", "d.place_geoid")
        .leftJoin("document_categories as dc", "dc.id", "d.category")
        .leftJoin("user as u", "u.id" as never, "d.uploader_id" as never)
        .selectAll("d")
        .select([
          "s.name as state_name",
          "p.name as place_name",
          "dc.name as category_name",
          "u.name as uploader_name",
        ])
        .where("d.id", "=", id)
        .executeTakeFirst();

      if (!doc) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      const state = doc.state as string;

      // pending_upload is always 404
      if (state === "pending_upload") {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      // Access control
      const isOwner = user && (doc.uploader_id as string) === user.id;
      const isModerator = user && hasRole(user.role, "moderator");

      if (state === "approved") {
        // Visible to everyone
      } else if (state === "moderator_review") {
        if (!isModerator) {
          // Owners can see their own docs in moderator_review
          if (!isOwner) {
            return reply.status(403).send({ success: false, error: "Not authorized" });
          }
        }
      } else {
        // draft, submitted, processing, user_review, processing_failed, rejected
        // Only owner can see
        if (!isOwner) {
          return reply.status(403).send({ success: false, error: "Not authorized" });
        }
      }

      // Fetch tags
      const tagRows = await fastify.db
        .selectFrom("document_tags")
        .select(["tag"])
        .where("document_id", "=", id)
        .execute();

      const tags = tagRows.map((t) => t.tag as string);

      // Fetch catalog associations
      const assocRows = await fastify.db
        .selectFrom("document_catalog_associations as dca")
        .innerJoin("catalog_entries as ce", "ce.id", "dca.entry_id")
        .innerJoin("catalog_types as ct", "ct.id", "ce.type_id")
        .select([
          "dca.id",
          "dca.entry_id as entry_id",
          "ce.name as entry_name",
          "dca.association_type_id as type_id",
          "ct.name as type_name",
          "dca.role",
          "dca.context",
        ])
        .where("dca.document_id", "=", id)
        .execute();

      const associations = assocRows.map((a) => ({
        id: a.id as string,
        entryId: a.entry_id as string,
        entryName: a.entry_name as string,
        typeId: (a.type_id ?? null) as string | null,
        typeName: (a.type_name ?? null) as string | null,
        role: (a.role ?? null) as string | null,
        context: (a.context ?? null) as string | null,
      }));

      // Fetch document metadata
      const metaRows = await fastify.db
        .selectFrom("document_metadata")
        .selectAll()
        .where("document_id", "=", id)
        .execute();

      const metadata = metaRows.map((m) => ({
        id: m.id as string,
        documentId: m.document_id as string,
        fieldKey: m.field_key as string,
        fieldDefinitionId: (m.field_definition_id ?? null) as string | null,
        valueText: (m.value_text ?? null) as string | null,
        valueNumber: (m.value_number ?? null) as string | null,
        valueDate: m.value_date instanceof Date ? m.value_date.toISOString() : (m.value_date ?? null),
        valueBoolean: (m.value_boolean ?? null) as boolean | null,
        valueJson: (m.value_json ?? null) as unknown,
        source: (m.source ?? null) as string | null,
        confidence: (m.confidence ?? null) as string | null,
      }));

      return {
        success: true,
        data: {
          id: doc.id as string,
          title: doc.title as string,
          description: (doc.description ?? null) as string | null,
          filename: doc.filename as string,
          filepath: doc.filepath as string,
          mimetype: doc.mimetype as string,
          size: Number(doc.size),
          uploaderId: (doc.uploader_id ?? null) as string | null,
          uploaderName: (doc.uploader_name ?? null) as string | null,
          governmentLevel: (doc.government_level ?? null) as string | null,
          stateUsps: (doc.state_usps ?? null) as string | null,
          stateName: (doc.state_name ?? null) as string | null,
          placeGeoid: (doc.place_geoid ?? null) as string | null,
          placeName: (doc.place_name ?? null) as string | null,
          tribeId: (doc.tribe_id ?? null) as string | null,
          documentDate: (doc.document_date ?? null) as string | null,
          category: (doc.category ?? null) as string | null,
          categoryName: (doc.category_name ?? null) as string | null,
          state: doc.state as string,
          useAiExtraction: doc.use_ai_extraction as boolean,
          reviewedBy: (doc.reviewed_by ?? null) as string | null,
          reviewedAt: doc.reviewed_at ? (doc.reviewed_at as Date).toISOString() : null,
          rejectionReason: (doc.rejection_reason ?? null) as string | null,
          processingStartedAt: doc.processing_started_at
            ? (doc.processing_started_at as Date).toISOString()
            : null,
          processingCompletedAt: doc.processing_completed_at
            ? (doc.processing_completed_at as Date).toISOString()
            : null,
          sourceId: (doc.source_id ?? null) as string | null,
          externalId: (doc.external_id ?? null) as string | null,
          createdAt: (doc.created_at as Date).toISOString(),
          updatedAt: (doc.updated_at as Date).toISOString(),
          tags,
          associations,
          metadata,
        },
      };
    },
  );
};

export default plugin;
