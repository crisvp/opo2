import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/states",
    { schema: {} },
    async (_request, _reply) => {
      const rows = await fastify.db
        .selectFrom("states")
        .leftJoin(
          fastify.db
            .selectFrom("documents")
            .select([
              "state_usps",
              fastify.db.fn.countAll<number>().as("doc_count"),
            ])
            .where("state", "=", "approved")
            .groupBy("state_usps")
            .as("dc"),
          "dc.state_usps",
          "states.usps",
        )
        .select([
          "states.usps",
          "states.name",
          "states.is_territory",
          "dc.doc_count",
        ])
        .orderBy("states.name", "asc")
        .execute();

      return {
        success: true,
        data: rows.map((r) => ({
          usps: r.usps as string,
          name: r.name as string,
          isTerritory: r.is_territory as boolean,
          documentCount: Number(r.doc_count ?? 0),
        })),
      };
    },
  );
};

export default plugin;
