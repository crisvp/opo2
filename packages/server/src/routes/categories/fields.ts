import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { nanoid } from "nanoid";
import { createFieldDefinitionSchema } from "@opo/shared";
import type { MetadataFieldDefinition } from "@opo/shared";

const idParamsSchema = z.object({ id: z.string() });

const createFieldBodySchema = createFieldDefinitionSchema.omit({ categoryId: true });

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
  // GET /:id/fields — list field definitions for a category
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/:id/fields",
    {
      schema: {
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const category = await fastify.db
        .selectFrom("document_categories")
        .select("id")
        .where("id", "=", id)
        .executeTakeFirst();

      if (!category) {
        return reply.status(404).send({ success: false, error: "Category not found" });
      }

      const rows = await fastify.db
        .selectFrom("metadata_field_definitions")
        .selectAll()
        .where("category_id", "=", id)
        .orderBy("display_order", "asc")
        .orderBy("field_key", "asc")
        .execute();

      return {
        success: true,
        data: rows.map((r) => mapFieldRow(r as Record<string, unknown>)),
      };
    },
  );

  // POST /:id/fields — create field definition for a category (moderator+)
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/:id/fields",
    {
      preHandler: [fastify.requireRole("moderator")],
      schema: {
        params: idParamsSchema,
        body: createFieldBodySchema,
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

      const category = await fastify.db
        .selectFrom("document_categories")
        .select("id")
        .where("id", "=", id)
        .executeTakeFirst();

      if (!category) {
        return reply.status(404).send({ success: false, error: "Category not found" });
      }

      const fieldId = nanoid();

      await fastify.db
        .insertInto("metadata_field_definitions")
        .values({
          id: fieldId,
          category_id: id,
          field_key: fieldKey,
          display_name: displayName,
          description: description ?? null,
          value_type: valueType,
          enum_values: enumValues ? JSON.stringify(enumValues) : null,
          is_required: isRequired ?? false,
          is_ai_extractable: isAiExtractable ?? false,
          validation_rules: validationRules ? JSON.stringify(validationRules) : null,
          display_order: displayOrder ?? 0,
        })
        .execute();

      const row = await fastify.db
        .selectFrom("metadata_field_definitions")
        .selectAll()
        .where("id", "=", fieldId)
        .executeTakeFirstOrThrow();

      return {
        success: true,
        data: mapFieldRow(row as Record<string, unknown>),
      };
    },
  );
};

export default plugin;
