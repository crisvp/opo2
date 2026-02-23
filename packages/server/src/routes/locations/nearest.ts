import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { sql } from "kysely";
import { nearestPlacesRequestSchema } from "@opo/shared";

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/nearest",
    {
      schema: {
        body: nearestPlacesRequestSchema,
      },
    },
    async (request, _reply) => {
      const { lat, lon, limit } = request.body;

      const rows = await fastify.db
        .selectFrom("places")
        .select(["geoid", "usps", "name", "lsad", "lat", "lon"])
        .orderBy(
          sql`(lat - ${lat})^2 + (lon - ${lon})^2`,
          "asc",
        )
        .limit(limit ?? 10)
        .execute();

      return {
        success: true,
        data: rows.map((r) => ({
          geoid: r.geoid as string,
          usps: r.usps as string,
          name: r.name as string,
          lsad: (r.lsad ?? null) as string | null,
          lat: Number(r.lat),
          lon: Number(r.lon),
        })),
      };
    },
  );
};

export default plugin;
