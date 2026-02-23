import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { updateCategoryRulesSchema } from "@opo/shared";

const idParamsSchema = z.object({ id: z.string() });

function mapCategoryRow(r: Record<string, unknown>) {
  return {
    id: r.id as string,
    name: r.name as string,
    description: (r.description ?? null) as string | null,
    minVendors: (r.min_vendors ?? null) as number | null,
    maxVendors: (r.max_vendors ?? null) as number | null,
    minProducts: (r.min_products ?? null) as number | null,
    maxProducts: (r.max_products ?? null) as number | null,
    minTechnologies: (r.min_technologies ?? null) as number | null,
    maxTechnologies: (r.max_technologies ?? null) as number | null,
    minGovernmentEntities: (r.min_government_entities ?? null) as number | null,
    maxGovernmentEntities: (r.max_government_entities ?? null) as number | null,
    requireGovernmentLocation: (r.require_government_location ?? null) as boolean | null,
  };
}

const plugin: FastifyPluginAsync = async (fastify) => {
  // PUT /:id/rules — update association rules (moderator+)
  fastify.withTypeProvider<ZodTypeProvider>().put(
    "/:id/rules",
    {
      preHandler: [fastify.requireRole("moderator")],
      schema: {
        params: idParamsSchema,
        body: updateCategoryRulesSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const {
        minVendors,
        maxVendors,
        minProducts,
        maxProducts,
        minTechnologies,
        maxTechnologies,
        minGovernmentEntities,
        maxGovernmentEntities,
        requireGovernmentLocation,
      } = request.body;

      const existing = await fastify.db
        .selectFrom("document_categories")
        .select("id")
        .where("id", "=", id)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({ success: false, error: "Category not found" });
      }

      const updateValues: Record<string, unknown> = {};
      if (minVendors !== undefined) updateValues.min_vendors = minVendors;
      if (maxVendors !== undefined) updateValues.max_vendors = maxVendors;
      if (minProducts !== undefined) updateValues.min_products = minProducts;
      if (maxProducts !== undefined) updateValues.max_products = maxProducts;
      if (minTechnologies !== undefined) updateValues.min_technologies = minTechnologies;
      if (maxTechnologies !== undefined) updateValues.max_technologies = maxTechnologies;
      if (minGovernmentEntities !== undefined) updateValues.min_government_entities = minGovernmentEntities;
      if (maxGovernmentEntities !== undefined) updateValues.max_government_entities = maxGovernmentEntities;
      if (requireGovernmentLocation !== undefined) updateValues.require_government_location = requireGovernmentLocation;

      if (Object.keys(updateValues).length > 0) {
        await fastify.db
          .updateTable("document_categories")
          .set(updateValues)
          .where("id", "=", id)
          .execute();
      }

      const row = await fastify.db
        .selectFrom("document_categories")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirstOrThrow();

      return {
        success: true,
        data: mapCategoryRow(row as Record<string, unknown>),
      };
    },
  );
};

export default plugin;
