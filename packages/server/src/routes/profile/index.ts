import type { FastifyPluginAsync } from "fastify";

const profileRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(import("./location.js"));
  await fastify.register(import("./usage.js"));
  await fastify.register(import("./api-keys.js"));
};

export default profileRoutes;
