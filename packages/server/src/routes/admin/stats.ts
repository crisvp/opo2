import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/stats",
    {
      preHandler: [fastify.requireRole("admin")],
    },
    async (_request, _reply) => {
      // Count all users
      const userCountResult = await fastify.db
        .selectFrom("user")
        .select(fastify.db.fn.countAll<number>().as("count"))
        .executeTakeFirstOrThrow();
      const userCount = Number(userCountResult.count);

      // Count documents by state (the document "state" field, not the US state)
      const docStateCounts = await fastify.db
        .selectFrom("documents")
        .select([
          "state",
          fastify.db.fn.countAll<number>().as("count"),
        ])
        .groupBy("state")
        .execute();

      const documentCounts: Record<string, number> = {};
      let totalDocuments = 0;
      for (const row of docStateCounts) {
        const stateVal = row.state;
        const cnt = Number(row.count);
        documentCounts[stateVal] = cnt;
        totalDocuments += cnt;
      }

      return {
        success: true,
        data: {
          userCount,
          documentCounts,
          totalDocuments,
        },
      };
    },
  );
};

export default plugin;
