import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { sql } from "kysely";

const searchQuerySchema = z.object({
  q: z.string().min(1),
  typeId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const plugin: FastifyPluginAsync = async (fastify) => {
  // GET /search — trigram search
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/search",
    {
      schema: {
        querystring: searchQuerySchema,
      },
    },
    async (request, _reply) => {
      const { q, typeId, limit } = request.query;

      // Use pg_trgm similarity for fuzzy search
      let query = fastify.db
        .selectFrom("catalog_entries as e")
        .innerJoin("catalog_types as t", "t.id", "e.type_id")
        .select([
          "e.id",
          "e.name",
          "e.type_id",
          "t.name as type_name",
          sql<number>`similarity(e.name, ${q})`.as("similarity"),
        ])
        .where(sql<boolean>`similarity(e.name, ${q}) > 0.1`);

      if (typeId) {
        query = query.where("e.type_id", "=", typeId) as typeof query;
      }

      const rows = await query
        .orderBy(sql`similarity(e.name, ${q})`, "desc")
        .limit(limit)
        .execute();

      const data = rows.map((r) => ({
        id: r.id as string,
        name: r.name as string,
        typeId: r.type_id as string,
        typeName: r.type_name as string,
        similarity: r.similarity as number,
      }));

      return { success: true, data };
    },
  );
};

export default plugin;
