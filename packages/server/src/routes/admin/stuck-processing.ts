import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { sql } from "kysely";

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/stuck-processing",
    {
      preHandler: [fastify.requireRole("admin")],
    },
    async (_request, _reply) => {
      const rows = await fastify.db
        .selectFrom("documents as d")
        .select([
          "d.id",
          "d.title",
          "d.filename",
          "d.state",
          "d.created_at",
          "d.updated_at",
        ])
        .where("d.state", "=", "processing")
        .where(sql<boolean>`d.updated_at < NOW() - INTERVAL '1 hour'`)
        .orderBy("d.updated_at", "asc")
        .execute();

      const items = rows.map((r) => ({
        id: r.id,
        title: r.title,
        filename: r.filename,
        state: r.state,
        createdAt:
          r.created_at instanceof Date
            ? r.created_at.toISOString()
            : String(r.created_at),
        updatedAt:
          r.updated_at instanceof Date
            ? r.updated_at.toISOString()
            : String(r.updated_at),
      }));

      return { success: true, data: items };
    },
  );
};

export default plugin;
