import pg from "pg";
import type { FastifyPluginAsync } from "fastify";
import { nanoid } from "nanoid";

import {
  addSseClient,
  removeSseClient,
  getSseHealthInfo,
  broadcastToUser,
} from "../services/sse.js";
import { env } from "../config/env.js";

const plugin: FastifyPluginAsync = async (fastify) => {
  // Set up dedicated PostgreSQL client for LISTEN/NOTIFY
  const pgClient = new pg.Client({ connectionString: env.DATABASE_URL });
  await pgClient.connect();

  pgClient.on("notification", (msg) => {
    if (msg.channel === "document_status") {
      try {
        const payload = JSON.parse(msg.payload ?? "{}") as { documentId: string; state: string };
        if (payload.documentId) {
          broadcastToUser(payload.documentId, "document:status", { documentId: payload.documentId, state: payload.state });
        }
      } catch {
        // ignore parse errors
      }
    } else if (msg.channel === "op_profile_changed") {
      try {
        const payload = JSON.parse(msg.payload ?? "{}") as { userId: string };
        if (payload.userId) {
          broadcastToUser(payload.userId, "profile:updated", { userId: payload.userId });
        }
      } catch {
        // ignore parse errors
      }
    }
  });

  await pgClient.query("LISTEN document_status");
  await pgClient.query("LISTEN op_profile_changed");

  fastify.addHook("onClose", async () => {
    try {
      await pgClient.query("UNLISTEN *");
      await pgClient.end();
    } catch {
      // ignore errors during shutdown
    }
  });

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
