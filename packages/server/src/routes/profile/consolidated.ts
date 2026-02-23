import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

import { profileResponseSchema, updateProfileSchema } from "@opo/shared";
import { getAiAvailability } from "../../services/ai-availability.js";

const plugin: FastifyPluginAsync = async (fastify) => {
  // GET /profile — Auth required
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/",
    {
      schema: {
        response: { 200: profileResponseSchema },
      },
      preHandler: [fastify.requireAuth],
    },
    async (request, _reply) => {
      const user = request.user!;

      // Fetch tier name
      const tier = await fastify.db
        .selectFrom("user_tiers")
        .select(["name"])
        .where("id", "=", user.tier)
        .executeTakeFirst();

      // Fetch user profile (location data)
      const profile = await fastify.db
        .selectFrom("user_profiles")
        .select(["state_usps", "place_geoid"])
        .where("user_id", "=", user.id)
        .executeTakeFirst();

      // Fetch full user row for ai_suggestions_enabled and createdAt
      const userRow = await fastify.db
        .selectFrom("user")
        .select(["ai_suggestions_enabled", "createdAt"])
        .where("id", "=", user.id)
        .executeTakeFirstOrThrow();

      // Get AI availability
      const aiAvailability = await getAiAvailability(fastify.db, user.id, user.tier);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tier: user.tier,
        tierName: tier?.name ?? "Unknown",
        aiSuggestions: {
          enabled: userRow.ai_suggestions_enabled,
          available: aiAvailability.available,
          usingOwnKey: aiAvailability.usingOwnKey,
          limits: aiAvailability.limits,
        },
        location: {
          stateUsps: profile?.state_usps ?? null,
          placeGeoid: profile?.place_geoid ?? null,
        },
        createdAt: userRow.createdAt,
      };
    },
  );

  // PUT /profile — Auth required
  fastify.withTypeProvider<ZodTypeProvider>().put(
    "/",
    {
      schema: { body: updateProfileSchema },
      preHandler: [fastify.requireAuth],
    },
    async (request, _reply) => {
      const user = request.user!;
      const { name, aiSuggestionsEnabled, stateUsps, placeGeoid } = request.body;

      // Build user table update with type-safe conditional spreading
      if (name !== undefined || aiSuggestionsEnabled !== undefined) {
        await fastify.db
          .updateTable("user")
          .set({
            ...(name !== undefined ? { name } : {}),
            ...(aiSuggestionsEnabled !== undefined
              ? { ai_suggestions_enabled: aiSuggestionsEnabled }
              : {}),
          })
          .where("id", "=", user.id)
          .execute();
      }

      // Update user_profiles if location fields provided
      if (stateUsps !== undefined || placeGeoid !== undefined) {
        await fastify.db
          .insertInto("user_profiles")
          .values({
            user_id: user.id,
            state_usps: stateUsps ?? null,
            place_geoid: placeGeoid ?? null,
          })
          .onConflict((oc) =>
            oc.column("user_id").doUpdateSet({
              ...(stateUsps !== undefined ? { state_usps: stateUsps } : {}),
              ...(placeGeoid !== undefined ? { place_geoid: placeGeoid } : {}),
            }),
          )
          .execute();
      }

      return { success: true };
    },
  );
};

export default plugin;
