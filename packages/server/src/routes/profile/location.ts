import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const putLocationSchema = z.object({
  stateUsps: z.string().length(2).nullable().optional(),
  placeGeoid: z.string().nullable().optional(),
});

const plugin: FastifyPluginAsync = async (fastify) => {
  // GET /profile/location — Auth required
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/location",
    {
      preHandler: [fastify.requireAuth],
    },
    async (request, _reply) => {
      const user = request.user!;

      const row = await fastify.db
        .selectFrom("user_profiles")
        .select(["state_usps", "place_geoid"])
        .where("user_id", "=", user.id)
        .executeTakeFirst();

      return {
        success: true,
        data: {
          stateUsps: row?.state_usps ?? null,
          placeGeoid: row?.place_geoid ?? null,
        },
      };
    },
  );

  // PUT /profile/location — Auth required
  fastify.withTypeProvider<ZodTypeProvider>().put(
    "/location",
    {
      schema: { body: putLocationSchema },
      preHandler: [fastify.requireAuth],
    },
    async (request, _reply) => {
      const user = request.user!;
      const { stateUsps, placeGeoid } = request.body;

      await fastify.db
        .insertInto("user_profiles")
        .values({
          user_id: user.id,
          state_usps: stateUsps ?? null,
          place_geoid: placeGeoid ?? null,
        })
        .onConflict((oc) =>
          oc.column("user_id").doUpdateSet({
            state_usps: stateUsps ?? null,
            place_geoid: placeGeoid ?? null,
          }),
        )
        .execute();

      return {
        success: true,
        data: {
          stateUsps: stateUsps ?? null,
          placeGeoid: placeGeoid ?? null,
        },
      };
    },
  );
};

export default plugin;
