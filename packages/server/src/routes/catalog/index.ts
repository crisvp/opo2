import type { FastifyPluginAsync } from "fastify";

const catalogRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(import("./entries.js"));
  await fastify.register(import("./aliases.js"));
  await fastify.register(import("./search.js"));
  await fastify.register(import("./types.js"));
  await fastify.register(import("./associations.js"));
};

export default catalogRoutes;
