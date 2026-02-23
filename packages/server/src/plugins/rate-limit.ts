import rateLimit from "@fastify/rate-limit";
import type { FastifyPluginAsync } from "fastify";

const plugin: FastifyPluginAsync<{ testing?: boolean }> = async (fastify, opts) => {
  if (opts.testing) return; // Skip rate limiting in tests

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    redis: fastify.redis,
    keyGenerator: (request) => {
      return (request as { user?: { id: string } }).user?.id ?? request.ip;
    },
  });
};

export default plugin;
