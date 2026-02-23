import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { nanoid } from "nanoid";

const idParamsSchema = z.object({ id: z.string() });

const createPolicyTypeSchema = z.object({
  name: z.string().min(1).max(200),
});

const plugin: FastifyPluginAsync = async (fastify) => {
  // GET / — list all policy types
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/",
    { schema: {} },
    async (_request, _reply) => {
      const rows = await fastify.db
        .selectFrom("policy_types")
        .selectAll()
        .orderBy("name", "asc")
        .execute();

      return {
        success: true,
        data: rows.map((r) => ({
          id: r.id as string,
          name: r.name as string,
          description: (r.description ?? null) as string | null,
          sortOrder: (r.sort_order ?? 0) as number,
        })),
      };
    },
  );

  // POST / — create policy type (admin)
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/",
    {
      preHandler: [fastify.requireRole("admin")],
      schema: {
        body: createPolicyTypeSchema,
      },
    },
    async (request, reply) => {
      const { name } = request.body;
      const id = nanoid();

      try {
        await fastify.db
          .insertInto("policy_types")
          .values({
            id,
            name,
          })
          .execute();
      } catch (err: unknown) {
        const pgErr = err as { code?: string };
        if (pgErr.code === "23505") {
          return reply.status(409).send({ success: false, error: "A policy type with this name already exists" });
        }
        throw err;
      }

      const row = await fastify.db
        .selectFrom("policy_types")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirstOrThrow();

      return {
        success: true,
        data: {
          id: row.id as string,
          name: row.name as string,
          description: (row.description ?? null) as string | null,
          sortOrder: (row.sort_order ?? 0) as number,
        },
      };
    },
  );

  // DELETE /:id — delete policy type (admin)
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    "/:id",
    {
      preHandler: [fastify.requireRole("admin")],
      schema: {
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await fastify.db
        .selectFrom("policy_types")
        .select("id")
        .where("id", "=", id)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({ success: false, error: "Policy type not found" });
      }

      await fastify.db
        .deleteFrom("policy_types")
        .where("id", "=", id)
        .execute();

      return { success: true };
    },
  );
};

export default plugin;
