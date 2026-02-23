import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const queueQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

const plugin: FastifyPluginAsync = async (fastify) => {
  // GET /queue — Moderator+
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/queue",
    {
      schema: { querystring: queueQuerySchema },
      preHandler: [fastify.requireRole("moderator")],
    },
    async (request, _reply) => {
      const { page, pageSize } = request.query;
      const offset = (page - 1) * pageSize;

      // Count total
      const countResult = await fastify.db
        .selectFrom("documents as d")
        .select(fastify.db.fn.countAll<number>().as("count"))
        .where("d.state", "=", "moderator_review")
        .executeTakeFirstOrThrow();
      const total = Number(countResult.count);

      const rows = await fastify.db
        .selectFrom("documents as d")
        .leftJoin("states as s", "s.usps", "d.state_usps")
        .leftJoin("places as p", "p.geoid", "d.place_geoid")
        .leftJoin("document_categories as dc", "dc.id", "d.category")
        .leftJoin("user as u", "u.id", "d.uploader_id")
        .select([
          "d.id",
          "d.title",
          "d.description",
          "d.filename",
          "d.mimetype",
          "d.size",
          "d.state",
          "d.category",
          "dc.name as category_name",
          "d.government_level",
          "d.state_usps",
          "s.name as state_name",
          "d.place_geoid",
          "p.name as place_name",
          "d.uploader_id",
          "u.name as uploader_name",
          "d.document_date",
          "d.source_id",
          "d.created_at",
          "d.updated_at",
        ])
        .where("d.state", "=", "moderator_review")
        .orderBy("d.created_at", "asc")
        .limit(pageSize)
        .offset(offset)
        .execute();

      if (rows.length === 0) {
        return {
          success: true,
          data: {
            items: [],
            total,
            page,
            pageSize,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
          },
        };
      }

      // Batch fetch tags
      const docIds = rows.map((r) => r.id);
      const tagRows = await fastify.db
        .selectFrom("document_tags")
        .select(["document_id", "tag"])
        .where("document_id", "in", docIds)
        .execute();

      const tagsMap = new Map<string, string[]>();
      for (const t of tagRows) {
        const docId = t.document_id;
        if (!tagsMap.has(docId)) tagsMap.set(docId, []);
        tagsMap.get(docId)!.push(t.tag);
      }

      const items = rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description ?? null,
        filename: r.filename,
        mimetype: r.mimetype,
        size: Number(r.size),
        state: r.state,
        category: r.category ?? null,
        categoryName: r.category_name ?? null,
        governmentLevel: r.government_level ?? null,
        stateUsps: r.state_usps ?? null,
        stateName: r.state_name ?? null,
        placeGeoid: r.place_geoid ?? null,
        placeName: r.place_name ?? null,
        uploaderId: r.uploader_id ?? null,
        uploaderName: r.uploader_name ?? null,
        documentDate: r.document_date instanceof Date ? r.document_date.toISOString() : (r.document_date ?? null),
        sourceId: r.source_id ?? null,
        createdAt:
          r.created_at instanceof Date
            ? r.created_at.toISOString()
            : String(r.created_at),
        updatedAt:
          r.updated_at instanceof Date
            ? r.updated_at.toISOString()
            : String(r.updated_at),
        tags: tagsMap.get(r.id) ?? [],
        vendors: [],
        technologies: [],
      }));

      return {
        success: true,
        data: {
          items,
          total,
          page,
          pageSize,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      };
    },
  );
};

export default plugin;
