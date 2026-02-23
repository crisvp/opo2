import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { sql } from "kysely";
import { hasRole } from "@opo/shared";

const listQuerySchema = z.object({
  search: z.string().optional(),
  governmentLevel: z.string().optional(),
  stateUsps: z.string().optional(),
  placeGeoid: z.string().optional(),
  tribeId: z.string().optional(),
  vendorId: z.string().optional(),
  technologyId: z.string().optional(),
  category: z.string().optional(),
  tag: z.string().optional(),
  sort: z.enum(["createdAt", "title"]).optional().default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

type ListQuery = z.infer<typeof listQuerySchema>;

const plugin: FastifyPluginAsync = async (fastify) => {
  // GET / — Public — browse approved documents
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/",
    {
      schema: { querystring: listQuerySchema },
    },
    async (request, _reply) => {
      const q = request.query;
      const user = request.user;
      const page = q.page;
      const pageSize = q.pageSize;
      const offset = (page - 1) * pageSize;

      // Determine visible states
      const canSeeModerator = user && hasRole(user.role as import("@opo/shared").Role, "moderator");
      const visibleStates = canSeeModerator
        ? (["approved", "moderator_review"] as string[])
        : (["approved"] as string[]);

      // Build filter functions to apply to any Kysely query builder
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filters: Array<(qb: any) => any> = [
        (qb) => qb.where("d.state", "in", visibleStates),
      ];

      if (q.search) {
        const search = q.search;
        filters.push((qb) =>
          qb.where(
            sql<boolean>`to_tsvector('english', d.title || ' ' || COALESCE(d.description, '')) @@ plainto_tsquery('english', ${search})`,
          ),
        );
      }
      if (q.governmentLevel) {
        const v = q.governmentLevel;
        filters.push((qb) => qb.where("d.government_level", "=", v));
      }
      if (q.stateUsps) {
        const v = q.stateUsps;
        filters.push((qb) => qb.where("d.state_usps", "=", v));
      }
      if (q.placeGeoid) {
        const v = q.placeGeoid;
        filters.push((qb) => qb.where("d.place_geoid", "=", v));
      }
      if (q.tribeId) {
        const v = q.tribeId;
        filters.push((qb) => qb.where("d.tribe_id", "=", v));
      }
      if (q.category) {
        const v = q.category;
        filters.push((qb) => qb.where("d.category", "=", v));
      }
      if (q.tag) {
        const v = q.tag;
        filters.push((qb) =>
          qb.where(
            sql<boolean>`EXISTS (SELECT 1 FROM document_tags dt WHERE dt.document_id = d.id AND dt.tag = ${v})`,
          ),
        );
      }
      if (q.vendorId) {
        const v = q.vendorId;
        filters.push((qb) =>
          qb.where(
            sql<boolean>`EXISTS (SELECT 1 FROM document_catalog_associations dca WHERE dca.document_id = d.id AND dca.entry_id = ${v})`,
          ),
        );
      }
      if (q.technologyId) {
        const v = q.technologyId;
        filters.push((qb) =>
          qb.where(
            sql<boolean>`EXISTS (SELECT 1 FROM document_catalog_associations dca WHERE dca.document_id = d.id AND dca.entry_id = ${v})`,
          ),
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function applyFilters<T>(qb: T): T {
        return filters.reduce((acc, f) => f(acc), qb as unknown) as T;
      }

      // Count total
      const countResult = await applyFilters(
        fastify.db
          .selectFrom("documents as d")
          .select(fastify.db.fn.countAll<number>().as("count")),
      ).executeTakeFirstOrThrow();
      const total = Number(countResult.count);

      // Sort
      const sortColumn = q.sort === "title" ? "d.title" : "d.created_at";
      const sortDir = q.sortDir as "asc" | "desc";

      // Main data query
      const rows = await applyFilters(
        fastify.db
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
          .orderBy(sortColumn, sortDir)
          .limit(pageSize)
          .offset(offset),
      ).execute();

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

      // Batch fetch catalog associations
      const assocRows = await fastify.db
        .selectFrom("document_catalog_associations as dca")
        .innerJoin("catalog_entries as ce", "ce.id", "dca.entry_id")
        .innerJoin("catalog_types as ct", "ct.id", "ce.type_id")
        .select([
          "dca.document_id",
          "ce.id as entry_id",
          "ce.name as entry_name",
          "ct.name as type_name",
        ])
        .where("dca.document_id", "in", docIds)
        .execute();

      const vendorsMap = new Map<string, { id: string; name: string }[]>();
      const techsMap = new Map<string, { id: string; name: string }[]>();

      for (const a of assocRows) {
        const docId = a.document_id;
        const entry = { id: a.entry_id, name: a.entry_name };
        const typeName = a.type_name.toLowerCase();

        if (typeName === "vendor") {
          if (!vendorsMap.has(docId)) vendorsMap.set(docId, []);
          vendorsMap.get(docId)!.push(entry);
        } else if (typeName === "technology") {
          if (!techsMap.has(docId)) techsMap.set(docId, []);
          techsMap.get(docId)!.push(entry);
        }
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
        vendors: vendorsMap.get(r.id) ?? [],
        technologies: techsMap.get(r.id) ?? [],
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

  // GET /my-uploads — Auth required
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/my-uploads",
    {
      preHandler: [fastify.requireAuth],
    },
    async (request, _reply) => {
      const user = request.user!;

      const rows = await fastify.db
        .selectFrom("documents as d")
        .leftJoin("document_categories as dc", "dc.id", "d.category")
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
          "d.place_geoid",
          "d.uploader_id",
          "d.document_date",
          "d.source_id",
          "d.created_at",
          "d.updated_at",
        ])
        .where("d.uploader_id", "=", user.id)
        .where("d.state", "!=", "pending_upload")
        .orderBy("d.created_at", "desc")
        .execute();

      if (rows.length === 0) {
        return { success: true, data: { items: [] } };
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
        stateName: null as string | null,
        placeGeoid: r.place_geoid ?? null,
        placeName: null as string | null,
        uploaderId: r.uploader_id ?? null,
        uploaderName: null as string | null,
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

      return { success: true, data: { items } };
    },
  );
};

export default plugin;
