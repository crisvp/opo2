import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { updateFieldDefinitionSchema } from "@opo/shared";
import type { MetadataFieldDefinition } from "@opo/shared";

const idParamsSchema = z.object({ id: z.string() });

function mapFieldRow(r: Record<string, unknown>): MetadataFieldDefinition {
  return {
    id: r.id as string,
    categoryId: r.category_id as string,
    fieldKey: r.field_key as string,
    displayName: r.display_name as string,
    description: (r.description ?? null) as string | null,
    valueType: r.value_type as MetadataFieldDefinition["valueType"],
    enumValues: (r.enum_values ?? null) as string[] | null,
    isRequired: r.is_required as boolean,
    isAiExtractable: r.is_ai_extractable as boolean,
    validationRules: (r.validation_rules ?? null) as MetadataFieldDefinition["validationRules"],
    displayOrder: r.display_order as number,
  };
}

const plugin: FastifyPluginAsync = async (fastify) => {
  // PUT /:id — update field definition (moderator+)
  fastify.withTypeProvider<ZodTypeProvider>().put(
    "/:id",
    {
      preHandler: [fastify.requireRole("moderator")],
      schema: {
        params: idParamsSchema,
        body: updateFieldDefinitionSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const {
        fieldKey,
        displayName,
        description,
        valueType,
        enumValues,
        isRequired,
        isAiExtractable,
        validationRules,
        displayOrder,
      } = request.body;

      const existing = await fastify.db
        .selectFrom("metadata_field_definitions")
        .select("id")
        .where("id", "=", id)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({ success: false, error: "Field definition not found" });
      }

      const updateValues: Record<string, unknown> = {};
      if (fieldKey !== undefined) updateValues.field_key = fieldKey;
      if (displayName !== undefined) updateValues.display_name = displayName;
      if (description !== undefined) updateValues.description = description;
      if (valueType !== undefined) updateValues.value_type = valueType;
      if (enumValues !== undefined) updateValues.enum_values = JSON.stringify(enumValues);
      if (isRequired !== undefined) updateValues.is_required = isRequired;
      if (isAiExtractable !== undefined) updateValues.is_ai_extractable = isAiExtractable;
      if (validationRules !== undefined) updateValues.validation_rules = JSON.stringify(validationRules);
      if (displayOrder !== undefined) updateValues.display_order = displayOrder;

      if (Object.keys(updateValues).length > 0) {
        await fastify.db
          .updateTable("metadata_field_definitions")
          .set(updateValues)
          .where("id", "=", id)
          .execute();
      }

      const row = await fastify.db
        .selectFrom("metadata_field_definitions")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirstOrThrow();

      return {
        success: true,
        data: mapFieldRow(row as Record<string, unknown>),
      };
    },
  );

  // DELETE /:id — delete field definition (moderator+)
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    "/:id",
    {
      preHandler: [fastify.requireRole("moderator")],
      schema: {
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await fastify.db
        .selectFrom("metadata_field_definitions")
        .select("id")
        .where("id", "=", id)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({ success: false, error: "Field definition not found" });
      }

      await fastify.db
        .deleteFrom("metadata_field_definitions")
        .where("id", "=", id)
        .execute();

      return { success: true };
    },
  );
};

export default plugin;
