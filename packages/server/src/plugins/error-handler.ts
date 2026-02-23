import type { FastifyPluginAsync, FastifyError } from "fastify";
import fp from "fastify-plugin";
import { ZodError } from "zod";

const plugin: FastifyPluginAsync = fp(async (fastify) => {
  fastify.setErrorHandler<FastifyError>((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: "Validation failed",
        message: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
    }

    if (error.statusCode) {
      return reply.status(error.statusCode).send({
        success: false,
        error: error.message,
      });
    }

    fastify.log.error(error);
    return reply.status(500).send({
      success: false,
      error: "Internal server error",
    });
  });
});

export default plugin;
