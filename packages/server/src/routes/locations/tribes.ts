import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const querySchema = z.object({
  search: z.string().optional(),
});

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/tribes",
    {
      schema: {
        querystring: querySchema,
      },
    },
    async (request, _reply) => {
      const { search } = request.query;

      let query = fastify.db
        .selectFrom("tribes")
        .select(["id", "name", "is_alaska_native"]);

      if (search) {
        query = query.where("name", "ilike", `%${search}%`) as typeof query;
      }

      const rows = await query.orderBy("name", "asc").execute();

      return {
        success: true,
        data: rows.map((r) => ({
          id: r.id as string,
          name: r.name as string,
          isAlaskaNative: r.is_alaska_native as boolean,
        })),
      };
    },
  );
};

export default plugin;
