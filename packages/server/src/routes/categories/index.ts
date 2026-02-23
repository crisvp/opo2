import type { FastifyPluginAsync } from "fastify";

const categoriesRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(import("./categories.js"));
  await fastify.register(import("./fields.js"));
  await fastify.register(import("./rules.js"));
};

export default categoriesRoutes;
