import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

import { auth } from "../auth.js";
import type { Role } from "@opo/shared";
import { hasRole } from "@opo/shared";

declare module "fastify" {
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (role: Role) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: { id: string; role: Role; tier: number; email: string; name: string | null } | null;
    session: { id: string } | null;
  }
}

const plugin: FastifyPluginAsync = fp(async (fastify) => {
  // Decorate request with user/session
  fastify.decorateRequest("user", null);
  fastify.decorateRequest("session", null);

  // Extract session from cookie on every request
  fastify.addHook("preHandler", async (request) => {
    try {
      const session = await auth.api.getSession({ headers: new Headers(request.headers as Record<string, string>) });
      if (session?.user) {
        request.user = {
          id: session.user.id,
          role: (session.user as { role?: Role }).role ?? "user",
          tier: (session.user as { tier?: number }).tier ?? 1,
          email: session.user.email,
          name: session.user.name ?? null,
        };
        request.session = { id: session.session.id };
      }
    } catch {
      // No valid session — request.user stays null
    }
  });

  // Auth preHandlers
  fastify.decorate("requireAuth", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ success: false, error: "Authentication required" });
    }
  });

  fastify.decorate(
    "requireRole",
    (role: Role) => async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        return reply.status(401).send({ success: false, error: "Authentication required" });
      }
      if (!hasRole(request.user.role, role)) {
        return reply.status(403).send({ success: false, error: "Insufficient permissions" });
      }
    },
  );
});

export default plugin;
