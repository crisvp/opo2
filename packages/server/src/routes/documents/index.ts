import type { FastifyPluginAsync } from "fastify";

const documentsRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(import("./list.js"));
  await fastify.register(import("./upload.js"));
  await fastify.register(import("./detail.js"));
  await fastify.register(import("./update.js"));
  await fastify.register(import("./files.js"));
  await fastify.register(import("./tags.js"));
  await fastify.register(import("./associations.js"));
  await fastify.register(import("./metadata.js"));
  await fastify.register(import("./ai-metadata.js"));
  await fastify.register(import("./moderation.js"));
  await fastify.register(import("./related.js"));
};

export default documentsRoutes;
