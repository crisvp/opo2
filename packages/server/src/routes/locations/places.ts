import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { sql } from "kysely";

const paramsSchema = z.object({
  usps: z.string().length(2),
});

function mapPlaceRow(r: { geoid: unknown; usps: unknown; name: unknown; lsad: unknown; lat: unknown; lon: unknown }) {
  return {
    geoid: r.geoid as string,
    usps: r.usps as string,
    name: r.name as string,
    lsad: (r.lsad ?? null) as string | null,
    lat: Number(r.lat),
    lon: Number(r.lon),
  };
}

const plugin: FastifyPluginAsync = async (fastify) => {
  // Incorporated places and CDPs (7-digit GEOIDs)
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/states/:usps/places",
    { schema: { params: paramsSchema } },
    async (request, _reply) => {
      const { usps } = request.params;
      const rows = await fastify.db
        .selectFrom("places")
        .select(["geoid", "usps", "name", "lsad", "lat", "lon"])
        .where("usps", "=", usps)
        .where(sql`length(geoid)`, "=", 7)
        .orderBy("name", "asc")
        .execute();
      return { success: true, data: rows.map(mapPlaceRow) };
    },
  );

  // Counties (5-digit GEOIDs)
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/states/:usps/counties",
    { schema: { params: paramsSchema } },
    async (request, _reply) => {
      const { usps } = request.params;
      const rows = await fastify.db
        .selectFrom("places")
        .select(["geoid", "usps", "name", "lsad", "lat", "lon"])
        .where("usps", "=", usps)
        .where(sql`length(geoid)`, "=", 5)
        .orderBy("name", "asc")
        .execute();
      return { success: true, data: rows.map(mapPlaceRow) };
    },
  );
};

export default plugin;
