import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

import { hasRole } from "@opo/shared";
import { getObjectStream, getPresignedDownloadUrl } from "../../services/storage.js";

const idParamsSchema = z.object({ id: z.string() });

async function getDocumentWithAccess(
  fastify: Parameters<FastifyPluginAsync>[0],
  id: string,
  userId: string | undefined,
  userRole: string | undefined,
): Promise<{ doc: Record<string, unknown>; error: { status: number; message: string } | null }> {
  const doc = await fastify.db
    .selectFrom("documents")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (!doc) {
    return { doc: {}, error: { status: 404, message: "Document not found" } };
  }

  const state = doc.state as string;

  if (state === "pending_upload") {
    return { doc: {}, error: { status: 404, message: "Document not found" } };
  }

  const isOwner = userId && (doc.uploader_id as string) === userId;
  const isModerator = !!userRole && hasRole(userRole as import("@opo/shared").Role, "moderator");

  if (state === "approved") {
    // public
  } else if (state === "moderator_review") {
    if (!isModerator && !isOwner) {
      return { doc: {}, error: { status: 403, message: "Not authorized" } };
    }
  } else {
    if (!isOwner) {
      return { doc: {}, error: { status: 403, message: "Not authorized" } };
    }
  }

  return { doc: doc as Record<string, unknown>, error: null };
}

const plugin: FastifyPluginAsync = async (fastify) => {
  // GET /:id/preview — Stream S3 object
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/:id/preview",
    {
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user;

      const { doc, error } = await getDocumentWithAccess(
        fastify,
        id,
        user?.id,
        user?.role,
      );

      if (error) {
        return reply.status(error.status).send({ success: false, error: error.message });
      }

      const filepath = doc.filepath as string;
      const mimetype = doc.mimetype as string;

      const stream = await getObjectStream(filepath);

      reply.header("Content-Type", mimetype);
      reply.header("Cache-Control", "private, max-age=3600");

      return reply.send(stream);
    },
  );

  // GET /:id/download — Redirect to presigned URL
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/:id/download",
    {
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user;

      const { doc, error } = await getDocumentWithAccess(
        fastify,
        id,
        user?.id,
        user?.role,
      );

      if (error) {
        return reply.status(error.status).send({ success: false, error: error.message });
      }

      const filepath = doc.filepath as string;
      const downloadUrl = await getPresignedDownloadUrl(filepath);

      return reply.redirect(downloadUrl, 302);
    },
  );
};

export default plugin;
