import type { FastifyPluginAsync } from "fastify";
import { createChallenge } from "altcha-lib";

import { env } from "../config/env.js";

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.get("/challenge", async (_request, reply) => {
    const challenge = await createChallenge({
      hmacKey: env.ALTCHA_HMAC_KEY,
      maxNumber: 100_000,
      expires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });
    return reply.send(challenge);
  });
};

export default plugin;
