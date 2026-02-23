import type { FastifyPluginAsync } from "fastify";

const locationsRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(import("./states.js"));
  await fastify.register(import("./places.js"));
  await fastify.register(import("./tribes.js"));
  await fastify.register(import("./nearest.js"));
  await fastify.register(import("./overview.js"));
};

export default locationsRoutes;
