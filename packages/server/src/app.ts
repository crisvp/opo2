import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

import { auth } from "./auth.js";
import { env } from "./config/env.js";
import { createDb } from "./util/db.js";
import { redis } from "./util/redis.js";
import { ensureBucket } from "./util/ensure-bucket.js";

export interface AppOptions {
  testing?: boolean;
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: options.testing ? false : { level: "info" },
  });

  // Set Zod validator and serializer compilers
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  // Decorate with db and redis
  const db = createDb(env.DATABASE_URL);
  fastify.decorate("db", db);
  fastify.decorate("redis", redis);

  // Ensure S3 bucket exists (skip in testing — handled by e2e global-setup)
  if (!options.testing) {
    await ensureBucket();
  }

  // Connect redis (skip in testing — the shared singleton connects lazily on first use)
  if (!options.testing) {
    await redis.connect();
  } else {
    // Ensure the shared redis singleton is connected for auth; reconnect if a
    // prior test suite called quit() on it.
    if (redis.status === "end" || redis.status === "close") {
      await redis.connect();
    }
  }

  // Plugins
  await fastify.register(import("./plugins/error-handler.js"));
  await fastify.register(import("./plugins/cors.js"));
  await fastify.register(import("./plugins/rate-limit.js"), { testing: options.testing });
  await fastify.register(import("./plugins/auth.js"));

  // Better Auth routes
  fastify.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (value) headers.append(key, Array.isArray(value) ? value.join(", ") : value);
      }
      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        body: request.method !== "GET" && request.method !== "HEAD" && request.body
          ? JSON.stringify(request.body)
          : undefined,
      });
      const response = await auth.handler(req);
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      const body = await response.text();
      reply.send(body || null);
    },
  });

  // Application routes
  await fastify.register(import("./routes/health.js"), { prefix: "/api/health" });
  await fastify.register(import("./routes/altcha.js"), { prefix: "/api/altcha" });
  await fastify.register(import("./routes/sse.js"), { prefix: "/api/sse" });
  await fastify.register(import("./routes/documents/index.js"), { prefix: "/api/documents" });
  await fastify.register(import("./routes/moderation.js"), { prefix: "/api/moderation" });
  await fastify.register(import("./routes/document-associations.js"), { prefix: "/api/document-associations" });
  await fastify.register(import("./routes/catalog/index.js"), { prefix: "/api/catalog" });
  await fastify.register(import("./routes/association-types.js"), { prefix: "/api/association-types" });
  await fastify.register(import("./routes/categories/index.js"), { prefix: "/api/categories" });
  await fastify.register(import("./routes/field-definitions.js"), { prefix: "/api/field-definitions" });
  await fastify.register(import("./routes/policy-types.js"), { prefix: "/api/policy-types" });
  await fastify.register(import("./routes/locations/index.js"), { prefix: "/api/locations" });
  await fastify.register(import("./routes/tiers.js"), { prefix: "/api/tiers" });
  await fastify.register(import("./routes/profile/index.js"), { prefix: "/api/profile" });
  await fastify.register(import("./routes/agencies.js"), { prefix: "/api/agencies" });
  await fastify.register(import("./routes/state-metadata.js"), { prefix: "/api/state-metadata" });
  await fastify.register(import("./routes/admin/index.js"), { prefix: "/api/admin" });
  await fastify.register(import("./routes/documentcloud.js"), { prefix: "/api/documentcloud" });

  // Graceful shutdown
  fastify.addHook("onClose", async () => {
    if (!options.testing) {
      try {
        await redis.quit();
      } catch {
        // Ignore errors if connection already closed
      }
    }
    await db.destroy();
  });

  return fastify;
}

// Augment FastifyInstance with custom decorators
declare module "fastify" {
  interface FastifyInstance {
    db: import("./util/db.js").DB extends never ? never : import("kysely").Kysely<import("./util/db.js").DB>;
    redis: import("ioredis").Redis;
  }
}
