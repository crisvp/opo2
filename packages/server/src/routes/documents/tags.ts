import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { nanoid } from "nanoid";

const idParamsSchema = z.object({ id: z.string() });
const tagParamsSchema = z.object({ id: z.string(), tag: z.string() });

const syncTagsBodySchema = z.object({
  tags: z
    .array(z.string().min(1).max(100))
    .transform((tags) => tags.map((t) => t.trim().toLowerCase())),
});

const addTagBodySchema = z.object({
  tag: z.string().min(1).max(100),
});

async function getDocumentForTagging(
  fastify: Parameters<FastifyPluginAsync>[0],
  id: string,
  userId: string,
  userRole: string,
): Promise<{ ok: boolean; status: number; error: string }> {
  const doc = await fastify.db
    .selectFrom("documents")
    .select(["uploader_id", "state"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!doc) {
    return { ok: false, status: 404, error: "Document not found" };
  }

  const isOwner = (doc.uploader_id as string) === userId;
  const isModerator = userRole === "admin" || userRole === "moderator";

  if (!isOwner && !isModerator) {
    return { ok: false, status: 403, error: "Not authorized" };
  }

  return { ok: true, status: 200, error: "" };
}

const plugin: FastifyPluginAsync = async (fastify) => {
  // POST /:id/tags — Sync all tags (moderator or owner)
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/:id/tags",
    {
      schema: {
        params: idParamsSchema,
        body: syncTagsBodySchema,
      },
      preHandler: [fastify.requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user!;
      const { tags } = request.body;

      const check = await getDocumentForTagging(fastify, id, user.id, user.role);
      if (!check.ok) {
        return reply.status(check.status).send({ success: false, error: check.error });
      }

      // Deduplicate
      const uniqueTags = [...new Set(tags)];

      await fastify.db.transaction().execute(async (trx) => {
        // Delete all existing tags
        await trx.deleteFrom("document_tags").where("document_id", "=", id).execute();

        // Insert new tags
        if (uniqueTags.length > 0) {
          await trx
            .insertInto("document_tags")
            .values(
              uniqueTags.map((tag) => ({
                id: nanoid(),
                document_id: id,
                tag,
                created_at: new Date(),
              })),
            )
            .execute();
        }
      });

      return { success: true };
    },
  );

  // POST /:id/tags/add — Add single tag
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/:id/tags/add",
    {
      schema: {
        params: idParamsSchema,
        body: addTagBodySchema,
      },
      preHandler: [fastify.requireAuth],
    },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user!;
      const tag = request.body.tag.trim().toLowerCase();

      const check = await getDocumentForTagging(fastify, id, user.id, user.role);
      if (!check.ok) {
        return reply.status(check.status).send({ success: false, error: check.error });
      }

      // Upsert — ignore conflict on duplicate
      try {
        await fastify.db
          .insertInto("document_tags")
          .values({
            id: nanoid(),
            document_id: id,
            tag,
            created_at: new Date(),
          })
          .onConflict((oc) => oc.doNothing())
          .execute();
      } catch {
        // Tag already exists — ignore
      }

      return { success: true };
    },
  );

  // DELETE /:id/tags/:tag — Delete single tag
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    "/:id/tags/:tag",
    {
      schema: { params: tagParamsSchema },
      preHandler: [fastify.requireAuth],
    },
    async (request, reply) => {
      const { id, tag } = request.params;
      const user = request.user!;

      const check = await getDocumentForTagging(fastify, id, user.id, user.role);
      if (!check.ok) {
        return reply.status(check.status).send({ success: false, error: check.error });
      }

      const normalizedTag = tag.trim().toLowerCase();

      await fastify.db
        .deleteFrom("document_tags")
        .where("document_id", "=", id)
        .where("tag", "=", normalizedTag)
        .execute();

      return { success: true };
    },
  );
};

export default plugin;
