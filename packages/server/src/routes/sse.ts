import type { FastifyPluginAsync } from "fastify";
import { nanoid } from "nanoid";

import {
  addSseClient,
  removeSseClient,
  getSseHealthInfo,
} from "../services/sse.js";

const plugin: FastifyPluginAsync = async (fastify) => {
  // GET /documents — Auth required, opens SSE stream
  fastify.get("/documents", { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const connectionId = nanoid();
    const user = request.user!;

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    reply.raw.write('data: {"type":"connected"}\n\n');

    addSseClient(connectionId, { userId: user.id, role: user.role, reply });

    // Heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      reply.raw.write(": heartbeat\n\n");
    }, 30_000);

    request.raw.on("close", () => {
      clearInterval(heartbeat);
      removeSseClient(connectionId);
    });

    // Keep connection open — don't call reply.send()
    await new Promise<void>((resolve) => {
      request.raw.on("close", resolve);
    });
  });

  // GET /health — Public, returns count of connected SSE clients
  fastify.get("/health", async (_request, _reply) => {
    const { connectedClients } = getSseHealthInfo();
    return {
      success: true,
      data: { clients: connectedClients },
    };
  });
};

export default plugin;
