import type { FastifyPluginAsync } from "fastify";

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(import("./stats.js"));
  await fastify.register(import("./users.js"));
  await fastify.register(import("./stuck-processing.js"));
  await fastify.register(import("./jobs.js"));
  await fastify.register(import("./failed-processing.js"));
};

export default adminRoutes;
