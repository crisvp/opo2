import cors from "@fastify/cors";
import type { FastifyPluginAsync } from "fastify";

import { env } from "../config/env.js";

const plugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(cors, {
    origin: env.TRUSTED_ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });
};

export default plugin;
