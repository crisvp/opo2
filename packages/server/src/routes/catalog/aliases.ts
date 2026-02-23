import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const idParamsSchema = z.object({
  id: z.string(),
});

const plugin: FastifyPluginAsync = async (fastify) => {
  // DELETE /aliases/:id — remove alias (moderator+)
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    "/aliases/:id",
    {
      preHandler: [fastify.requireRole("moderator")],
      schema: {
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await fastify.db
        .selectFrom("catalog_aliases")
        .select("id")
        .where("id", "=", id)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({ success: false, error: "Alias not found" });
      }

      await fastify.db
        .deleteFrom("catalog_aliases")
        .where("id", "=", id)
        .execute();

      return { success: true, data: null };
    },
  );
};

export default plugin;
