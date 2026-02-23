import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/types",
    {},
    async (_request, _reply) => {
      const rows = await fastify.db
        .selectFrom("catalog_types")
        .select([
          "id",
          "name",
          "description",
          "icon",
          "color",
          "attribute_schema",
          "is_system",
          "sort_order",
        ])
        .orderBy("sort_order", "asc")
        .execute();

      const data = rows.map((r) => ({
        id: r.id as string,
        name: r.name as string,
        description: (r.description ?? null) as string | null,
        icon: (r.icon ?? null) as string | null,
        color: (r.color ?? null) as string | null,
        attributeSchema: (r.attribute_schema ?? null) as Record<string, unknown> | null,
        isSystem: r.is_system as boolean,
        sortOrder: r.sort_order as number,
      }));

      return { success: true, data };
    },
  );
};

export default plugin;
