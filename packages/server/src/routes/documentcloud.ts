import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { nanoid } from "nanoid";
import { makeWorkerUtils } from "graphile-worker";

import { env } from "../config/env.js";

const DC_API_BASE = "https://api.www.documentcloud.org/api";

interface DCDocument {
  id: number;
  title: string;
  description: string | null;
  pages: number;
  canonical_url: string;
  file_url: string | null;
  organization: { name: string } | null;
  created_at: string;
}

interface DCSearchResult {
  results: DCDocument[];
  count: number;
}

const searchQuerySchema = z.object({
  q: z.string().min(1),
  organization: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  perPage: z.coerce.number().int().positive().max(100).optional().default(20),
});

const importBodySchema = z.object({
  documentCloudId: z.number().int().positive(),
  options: z
    .object({
      addTags: z.array(z.string()).optional(),
      governmentLevel: z.string().optional(),
      stateUsps: z.string().optional(),
      placeGeoid: z.string().optional(),
      tribeId: z.string().optional(),
    })
    .optional(),
});

const importBatchBodySchema = z.object({
  documentCloudIds: z.array(z.number().int().positive()).min(1).max(100),
  options: z
    .object({
      addTags: z.array(z.string()).optional(),
      governmentLevel: z.string().optional(),
      stateUsps: z.string().optional(),
      placeGeoid: z.string().optional(),
      tribeId: z.string().optional(),
    })
    .optional(),
});

const jobIdParamsSchema = z.object({
  jobId: z.string(),
});

const plugin: FastifyPluginAsync = async (fastify) => {
  // GET /status
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/status",
    { preHandler: [fastify.requireAuth] },
    async (_request, _reply) => {
      try {
        const res = await fetch(`${DC_API_BASE}/`, {
          signal: AbortSignal.timeout(5_000),
          headers: { Accept: "application/json" },
        });
        return { success: true, data: { available: res.ok || res.status < 500 } };
      } catch {
        return { success: true, data: { available: false } };
      }
    },
  );

  // GET /search
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/search",
    {
      schema: { querystring: searchQuerySchema },
      preHandler: [fastify.requireAuth],
    },
    async (request, reply) => {
      const { q, organization, page, perPage } = request.query;

      const fullQuery = q + (organization ? ` organization:${organization}` : "");
      const url = new URL(`${DC_API_BASE}/documents/`);
      url.searchParams.set("q", fullQuery);
      url.searchParams.set("per_page", String(perPage));
      url.searchParams.set("page", String(page));

      let dcData: DCSearchResult;
      try {
        const res = await fetch(url.toString(), {
          signal: AbortSignal.timeout(10_000),
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`DC API error: ${res.status}`);
        dcData = (await res.json()) as DCSearchResult;
      } catch {
        return reply.status(502).send({ success: false, error: "DocumentCloud search failed" });
      }

      // Check which documents are already imported by source_id
      const dcIds = dcData.results.map((d) => String(d.id));
      let importedIds = new Set<string>();
      if (dcIds.length > 0) {
        const existingDocs = await fastify.db
          .selectFrom("documents" as never)
          .select(["source_id"] as never[])
          .where("source_id" as never, "in" as never, dcIds as never)
          .execute();
        importedIds = new Set((existingDocs as Array<{ source_id: string }>).map((d) => d.source_id));
      }

      const results = dcData.results.map((doc) => ({
        ...doc,
        alreadyImported: importedIds.has(String(doc.id)),
      }));

      return {
        success: true,
        data: {
          results,
          count: dcData.count,
          page,
          perPage,
        },
      };
    },
  );

  // POST /import
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/import",
    {
      schema: { body: importBodySchema },
      preHandler: [fastify.requireRole("moderator")],
    },
    async (request, _reply) => {
      const { documentCloudId } = request.body;
      const userId = request.user!.id;
      const importJobId = nanoid();
      const now = new Date();

      await fastify.db
        .insertInto("document_import_jobs" as never)
        .values({
          id: importJobId,
          source_id: "documentcloud",
          user_id: userId,
          document_ids: JSON.stringify([documentCloudId]),
          status: "pending",
          total_requested: 1,
          imported_count: 0,
          error_count: 0,
          created_at: now,
          updated_at: now,
        } as never)
        .execute();

      const workerUtils = await makeWorkerUtils({ connectionString: env.DATABASE_URL });
      try {
        await workerUtils.addJob("documentcloud_import", {
          importJobId,
          documentCloudId,
          userId,
        });
      } finally {
        await workerUtils.release();
      }

      return { success: true, data: { jobId: importJobId } };
    },
  );

  // POST /import/batch
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/import/batch",
    {
      schema: { body: importBatchBodySchema },
      preHandler: [fastify.requireRole("moderator")],
    },
    async (request, _reply) => {
      const { documentCloudIds } = request.body;
      const userId = request.user!.id;
      const importJobId = nanoid();
      const now = new Date();

      await fastify.db
        .insertInto("document_import_jobs" as never)
        .values({
          id: importJobId,
          source_id: "documentcloud",
          user_id: userId,
          document_ids: JSON.stringify(documentCloudIds),
          status: "pending",
          total_requested: documentCloudIds.length,
          imported_count: 0,
          error_count: 0,
          created_at: now,
          updated_at: now,
        } as never)
        .execute();

      const workerUtils = await makeWorkerUtils({ connectionString: env.DATABASE_URL });
      try {
        for (const dcId of documentCloudIds) {
          await workerUtils.addJob("documentcloud_import", {
            importJobId,
            documentCloudId: dcId,
            userId,
          });
        }
      } finally {
        await workerUtils.release();
      }

      return { success: true, data: { jobId: importJobId, count: documentCloudIds.length } };
    },
  );

  // GET /import/:jobId
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/import/:jobId",
    {
      schema: { params: jobIdParamsSchema },
      preHandler: [fastify.requireAuth],
    },
    async (request, reply) => {
      const { jobId } = request.params;
      const user = request.user!;

      const job = await fastify.db
        .selectFrom("document_import_jobs" as never)
        .selectAll()
        .where("id" as never, "=", jobId as never)
        .executeTakeFirst();

      if (!job) {
        return reply.status(404).send({ success: false, error: "Import job not found" });
      }

      const jobRow = job as Record<string, unknown>;
      const isOwner = (jobRow.user_id as string) === user.id;
      const isAdmin = user.role === "admin";

      if (!isOwner && !isAdmin) {
        return reply.status(403).send({ success: false, error: "Not authorized" });
      }

      return {
        success: true,
        data: {
          id: jobRow.id as string,
          sourceId: jobRow.source_id as string,
          userId: jobRow.user_id as string,
          documentIds: jobRow.document_ids as unknown,
          status: jobRow.status as string,
          totalRequested: jobRow.total_requested as number,
          importedCount: jobRow.imported_count as number,
          errorCount: jobRow.error_count as number,
          createdAt:
            jobRow.created_at instanceof Date
              ? (jobRow.created_at as Date).toISOString()
              : (jobRow.created_at as string),
          updatedAt:
            jobRow.updated_at instanceof Date
              ? (jobRow.updated_at as Date).toISOString()
              : (jobRow.updated_at as string),
        },
      };
    },
  );

  // GET /jobs
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/jobs",
    { preHandler: [fastify.requireAuth] },
    async (request, _reply) => {
      const userId = request.user!.id;

      const jobs = await fastify.db
        .selectFrom("document_import_jobs" as never)
        .selectAll()
        .where("user_id" as never, "=", userId as never)
        .orderBy("created_at" as never, "desc")
        .execute();

      const data = (jobs as Array<Record<string, unknown>>).map((jobRow) => ({
        id: jobRow.id as string,
        sourceId: jobRow.source_id as string,
        userId: jobRow.user_id as string,
        documentIds: jobRow.document_ids as unknown,
        status: jobRow.status as string,
        totalRequested: jobRow.total_requested as number,
        importedCount: jobRow.imported_count as number,
        errorCount: jobRow.error_count as number,
        createdAt:
          jobRow.created_at instanceof Date
            ? (jobRow.created_at as Date).toISOString()
            : (jobRow.created_at as string),
        updatedAt:
          jobRow.updated_at instanceof Date
            ? (jobRow.updated_at as Date).toISOString()
            : (jobRow.updated_at as string),
      }));

      return { success: true, data };
    },
  );
};

export default plugin;
