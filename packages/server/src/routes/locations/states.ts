import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/states",
    { schema: {} },
    async (_request, _reply) => {
      const rows = await fastify.db
        .selectFrom("states")
        .select(["usps", "name", "is_territory"])
        .orderBy("name", "asc")
        .execute();

      return {
        success: true,
        data: rows.map((r) => ({
          usps: r.usps as string,
          name: r.name as string,
          isTerritory: r.is_territory as boolean,
        })),
      };
    },
  );
};

export default plugin;
