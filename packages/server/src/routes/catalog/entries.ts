import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { nanoid } from "nanoid";

import { createCatalogEntrySchema, updateCatalogEntrySchema, createAliasSchema } from "@opo/shared";

const listQuerySchema = z.object({
  typeId: z.string().optional(),
  search: z.string().optional(),
  verified: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(5000).default(20),
});

const idParamsSchema = z.object({
  id: z.string(),
});

const plugin: FastifyPluginAsync = async (fastify) => {
  // GET /entries — list/search entries
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/entries",
    {
      schema: {
        querystring: listQuerySchema,
      },
    },
    async (request, _reply) => {
      const { typeId, search, verified, page, pageSize } = request.query;
      const offset = (page - 1) * pageSize;

      let query = fastify.db
        .selectFrom("catalog_entries as e")
        .innerJoin("catalog_types as t", "t.id", "e.type_id")
        .select([
          "e.id",
          "e.type_id",
          "e.name",
          "e.attributes",
          "e.is_verified",
          "e.created_at",
          "e.updated_at",
          "t.name as type_name",
        ]);

      if (typeId) {
        query = query.where("e.type_id", "=", typeId) as typeof query;
      }

      if (search) {
        query = query.where("e.name", "ilike", `%${search}%`) as typeof query;
      }

      if (verified !== undefined) {
        const verifiedBool = verified === "true";
        query = query.where("e.is_verified", "=", verifiedBool) as typeof query;
      }

      const countQuery = query.clearSelect().select(
        fastify.db.fn.countAll<number>().as("count"),
      );
      const countResult = await countQuery.executeTakeFirst();
      const total = Number(countResult?.count ?? 0);

      const rows = await query
        .orderBy("e.name", "asc")
        .limit(pageSize)
        .offset(offset)
        .execute();

      const items = rows.map((r) => ({
        id: r.id as string,
        typeId: r.type_id as string,
        typeName: r.type_name as string,
        name: r.name as string,
        attributes: (r.attributes ?? null) as Record<string, unknown> | null,
        isVerified: r.is_verified as boolean,
        createdAt: (r.created_at as Date).toISOString(),
        updatedAt: (r.updated_at as Date).toISOString(),
      }));

      return {
        success: true,
        data: {
          items,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    },
  );

  // GET /entries/:id — get entry detail with aliases and associations
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/entries/:id",
    {
      schema: {
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const row = await fastify.db
        .selectFrom("catalog_entries as e")
        .innerJoin("catalog_types as t", "t.id", "e.type_id")
        .select([
          "e.id",
          "e.type_id",
          "e.name",
          "e.attributes",
          "e.is_verified",
          "e.created_at",
          "e.updated_at",
          "t.name as type_name",
        ])
        .where("e.id", "=", id)
        .executeTakeFirst();

      if (!row) {
        return reply.status(404).send({ success: false, error: "Catalog entry not found" });
      }

      const aliasRows = await fastify.db
        .selectFrom("catalog_aliases")
        .select(["id", "entry_id", "alias", "normalized_alias", "source", "created_at"])
        .where("entry_id", "=", id)
        .orderBy("alias", "asc")
        .execute();

      const aliases = aliasRows.map((a) => ({
        id: a.id as string,
        entryId: a.entry_id as string,
        alias: a.alias as string,
        normalizedAlias: a.normalized_alias as string,
        source: a.source as string,
        createdAt: (a.created_at as Date).toISOString(),
      }));

      const assocRows = await fastify.db
        .selectFrom("catalog_entry_associations as a")
        .innerJoin("catalog_entries as src", "src.id", "a.source_entry_id")
        .innerJoin("catalog_entries as tgt", "tgt.id", "a.target_entry_id")
        .select([
          "a.id",
          "a.source_entry_id",
          "a.target_entry_id",
          "a.association_type_id",
          "a.created_at",
          "src.name as source_name",
          "tgt.name as target_name",
        ])
        .where((eb) =>
          eb.or([
            eb("a.source_entry_id", "=", id),
            eb("a.target_entry_id", "=", id),
          ]),
        )
        .execute();

      const associations = assocRows.map((a) => ({
        id: a.id as string,
        sourceEntryId: a.source_entry_id as string,
        sourceName: a.source_name as string,
        targetEntryId: a.target_entry_id as string,
        targetName: a.target_name as string,
        associationTypeId: a.association_type_id as string,
        createdAt: (a.created_at as Date).toISOString(),
      }));

      return {
        success: true,
        data: {
          id: row.id as string,
          typeId: row.type_id as string,
          typeName: row.type_name as string,
          name: row.name as string,
          attributes: (row.attributes ?? null) as Record<string, unknown> | null,
          isVerified: row.is_verified as boolean,
          createdAt: (row.created_at as Date).toISOString(),
          updatedAt: (row.updated_at as Date).toISOString(),
          aliases,
          associations,
        },
      };
    },
  );

  // POST /entries — create entry (moderator+)
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/entries",
    {
      preHandler: [fastify.requireRole("moderator")],
      schema: {
        body: createCatalogEntrySchema,
      },
    },
    async (request, reply) => {
      const { typeId, name, attributes, isVerified } = request.body;

      // Check type exists
      const type = await fastify.db
        .selectFrom("catalog_types")
        .select("id")
        .where("id", "=", typeId)
        .executeTakeFirst();

      if (!type) {
        return reply.status(400).send({ success: false, error: "Invalid catalog type" });
      }

      const id = nanoid();
      const now = new Date();

      try {
        await fastify.db
          .insertInto("catalog_entries")
          .values({
            id,
            type_id: typeId,
            name,
            attributes: attributes != null ? JSON.parse(JSON.stringify(attributes)) as import("../../db/types.js").Json : null,
            is_verified: isVerified ?? false,
            created_at: now,
            updated_at: now,
          })
          .execute();
      } catch (err: unknown) {
        const pgErr = err as { code?: string };
        if (pgErr.code === "23505") {
          return reply.status(409).send({
            success: false,
            error: "A catalog entry with this name already exists for this type",
          });
        }
        throw err;
      }

      const row = await fastify.db
        .selectFrom("catalog_entries as e")
        .innerJoin("catalog_types as t", "t.id", "e.type_id")
        .select([
          "e.id",
          "e.type_id",
          "e.name",
          "e.attributes",
          "e.is_verified",
          "e.created_at",
          "e.updated_at",
          "t.name as type_name",
        ])
        .where("e.id", "=", id)
        .executeTakeFirstOrThrow();

      return {
        success: true,
        data: {
          id: row.id as string,
          typeId: row.type_id as string,
          typeName: row.type_name as string,
          name: row.name as string,
          attributes: (row.attributes ?? null) as Record<string, unknown> | null,
          isVerified: row.is_verified as boolean,
          createdAt: (row.created_at as Date).toISOString(),
          updatedAt: (row.updated_at as Date).toISOString(),
        },
      };
    },
  );

  // PUT /entries/:id — update entry (moderator+)
  fastify.withTypeProvider<ZodTypeProvider>().put(
    "/entries/:id",
    {
      preHandler: [fastify.requireRole("moderator")],
      schema: {
        params: idParamsSchema,
        body: updateCatalogEntrySchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { name, attributes, isVerified } = request.body;

      const existing = await fastify.db
        .selectFrom("catalog_entries")
        .select("id")
        .where("id", "=", id)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({ success: false, error: "Catalog entry not found" });
      }

      const updateValues: Record<string, unknown> = { updated_at: new Date() };
      if (name !== undefined) updateValues.name = name;
      if (attributes !== undefined) updateValues.attributes = attributes;
      if (isVerified !== undefined) updateValues.is_verified = isVerified;

      try {
        await fastify.db
          .updateTable("catalog_entries")
          .set(updateValues)
          .where("id", "=", id)
          .execute();
      } catch (err: unknown) {
        const pgErr = err as { code?: string };
        if (pgErr.code === "23505") {
          return reply.status(409).send({
            success: false,
            error: "A catalog entry with this name already exists for this type",
          });
        }
        throw err;
      }

      const row = await fastify.db
        .selectFrom("catalog_entries as e")
        .innerJoin("catalog_types as t", "t.id", "e.type_id")
        .select([
          "e.id",
          "e.type_id",
          "e.name",
          "e.attributes",
          "e.is_verified",
          "e.created_at",
          "e.updated_at",
          "t.name as type_name",
        ])
        .where("e.id", "=", id)
        .executeTakeFirstOrThrow();

      return {
        success: true,
        data: {
          id: row.id as string,
          typeId: row.type_id as string,
          typeName: row.type_name as string,
          name: row.name as string,
          attributes: (row.attributes ?? null) as Record<string, unknown> | null,
          isVerified: row.is_verified as boolean,
          createdAt: (row.created_at as Date).toISOString(),
          updatedAt: (row.updated_at as Date).toISOString(),
        },
      };
    },
  );

  // DELETE /entries/:id — delete entry (moderator+)
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    "/entries/:id",
    {
      preHandler: [fastify.requireRole("moderator")],
      schema: {
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await fastify.db
        .selectFrom("catalog_entries")
        .select("id")
        .where("id", "=", id)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({ success: false, error: "Catalog entry not found" });
      }

      await fastify.db
        .deleteFrom("catalog_entries")
        .where("id", "=", id)
        .execute();

      return { success: true, data: null };
    },
  );

  // POST /entries/:id/aliases — add alias (moderator+)
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/entries/:id/aliases",
    {
      preHandler: [fastify.requireRole("moderator")],
      schema: {
        params: idParamsSchema,
        body: createAliasSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { alias, source } = request.body;

      const existing = await fastify.db
        .selectFrom("catalog_entries")
        .select("id")
        .where("id", "=", id)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({ success: false, error: "Catalog entry not found" });
      }

      const normalizedAlias = alias.trim().toLowerCase();
      const aliasId = nanoid();
      const now = new Date();

      try {
        await fastify.db
          .insertInto("catalog_aliases")
          .values({
            id: aliasId,
            entry_id: id,
            alias,
            normalized_alias: normalizedAlias,
            source: source ?? "manual",
            created_at: now,
          })
          .execute();
      } catch (err: unknown) {
        const pgErr = err as { code?: string };
        if (pgErr.code === "23505") {
          return reply.status(409).send({
            success: false,
            error: "This alias already exists for this entry",
          });
        }
        throw err;
      }

      return {
        success: true,
        data: {
          id: aliasId,
          entryId: id,
          alias,
          normalizedAlias,
          source: source ?? "manual",
          createdAt: now.toISOString(),
        },
      };
    },
  );
};

export default plugin;
