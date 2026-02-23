import type { FastifyPluginAsync } from "fastify";

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (_request, _reply) => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });
};

export default plugin;
