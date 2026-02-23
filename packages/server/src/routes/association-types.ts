import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const plugin: FastifyPluginAsync = async (fastify) => {
  // GET / — list all association types
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/",
    {},
    async (_request, _reply) => {
      const rows = await fastify.db
        .selectFrom("association_types")
        .select([
          "id",
          "name",
          "description",
          "applies_to",
          "is_directional",
          "inverse_id",
          "is_system",
          "sort_order",
        ])
        .orderBy("sort_order", "asc")
        .execute();

      const data = rows.map((r) => ({
        id: r.id as string,
        name: r.name as string,
        description: (r.description ?? null) as string | null,
        appliesTo: r.applies_to as string,
        isDirectional: r.is_directional as boolean,
        inverseId: (r.inverse_id ?? null) as string | null,
        isSystem: r.is_system as boolean,
        sortOrder: r.sort_order as number,
      }));

      return { success: true, data };
    },
  );
};

export default plugin;
