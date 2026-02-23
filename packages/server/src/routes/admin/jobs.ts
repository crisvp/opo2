import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { sql } from "kysely";

const listQuerySchema = z.object({
  status: z.string().optional(),
  taskIdentifier: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

const idParamsSchema = z.object({
  id: z.string(),
});

function getJobStatus(
  lockedAt: Date | string | null,
  runAt: Date | string,
  attempts: number,
  maxAttempts: number,
): "pending" | "running" | "failed" | "scheduled" {
  if (lockedAt !== null) return "running";
  if (attempts >= maxAttempts) return "failed";
  const runAtDate = runAt instanceof Date ? runAt : new Date(runAt);
  if (runAtDate > new Date()) return "scheduled";
  return "pending";
}

const taskOrder: Record<string, number> = {
  virus_scan: 1,
  pdf_convert: 2,
  sieve: 3,
  extractor: 4,
  pipeline_complete: 5,
  document_pipeline_complete: 5,
  documentcloud_import: 0,
};

const plugin: FastifyPluginAsync = async (fastify) => {
  // GET /jobs — list jobs
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/jobs",
    {
      schema: { querystring: listQuerySchema },
      preHandler: [fastify.requireRole("admin")],
    },
    async (request, _reply) => {
      const { taskIdentifier, page, pageSize } = request.query;
      const offset = (page - 1) * pageSize;

      // Check for the jobs view (migration 000017+) or _private_jobs table
      const schemaCheck = await sql<{ exists: boolean }>`
        SELECT EXISTS(
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'graphile_worker' AND c.relname = 'jobs'
        ) as exists
      `.execute(fastify.db);

      if (!schemaCheck.rows[0]?.exists) {
        return {
          success: true,
          data: { items: [], total: 0, page, pageSize, totalPages: 1 },
        };
      }

      try {
        const countResult = await sql<{ count: string }>`
          SELECT count(*)::text as count
          FROM graphile_worker.jobs
          WHERE 1=1
          ${taskIdentifier ? sql`AND task_identifier = ${taskIdentifier}` : sql``}
        `.execute(fastify.db);

        const total = Number(countResult.rows[0]?.count ?? 0);

        // graphile_worker.jobs is a view (migration 000017+); payload lives in _private_jobs
        const jobsResult = await sql<{
          id: string;
          task_identifier: string;
          attempts: number;
          max_attempts: number;
          created_at: string;
          run_at: string;
          locked_at: string | null;
          locked_by: string | null;
          last_error: string | null;
          status: string;
        }>`
          SELECT id::text, task_identifier, attempts, max_attempts,
                 created_at, run_at, locked_at, locked_by, last_error,
                 CASE WHEN locked_at IS NOT NULL THEN 'running'
                      WHEN last_error IS NOT NULL AND attempts >= max_attempts THEN 'failed'
                      WHEN run_at > NOW() THEN 'scheduled'
                      ELSE 'pending' END as status
          FROM graphile_worker.jobs
          WHERE 1=1
          ${taskIdentifier ? sql`AND task_identifier = ${taskIdentifier}` : sql``}
          ORDER BY created_at DESC
          LIMIT ${pageSize} OFFSET ${offset}
        `.execute(fastify.db);

        const items = jobsResult.rows.map((r) => ({
          id: r.id,
          taskIdentifier: r.task_identifier,
          attempts: r.attempts,
          maxAttempts: r.max_attempts,
          createdAt: r.created_at,
          runAt: r.run_at,
          lockedAt: r.locked_at,
          lockedBy: r.locked_by,
          lastError: r.last_error,
          status: r.status,
        }));

        return {
          success: true,
          data: {
            items,
            total,
            page,
            pageSize,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
          },
        };
      } catch {
        return {
          success: true,
          data: { items: [], total: 0, page, pageSize, totalPages: 1 },
        };
      }
    },
  );

  // GET /jobs/grouped — list jobs grouped by document and task type
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/jobs/grouped",
    {
      preHandler: [fastify.requireRole("admin")],
    },
    async (_request, _reply) => {
      // Get active jobs from graphile_worker
      let activeJobs: Array<{
        id: string;
        task_identifier: string;
        payload: Record<string, unknown>;
        attempts: number;
        max_attempts: number;
        created_at: Date;
        run_at: Date;
        locked_at: Date | null;
        last_error: string | null;
      }> = [];

      try {
        // Use _private_jobs JOIN _private_tasks to get task_identifier and payload
        // (graphile_worker.jobs view, migration 000017+, omits payload)
        const activeJobsResult = await sql<{
          id: string;
          task_identifier: string;
          payload: Record<string, unknown>;
          attempts: number;
          max_attempts: number;
          created_at: Date;
          run_at: Date;
          locked_at: Date | null;
          last_error: string | null;
        }>`
          SELECT j.id::text, t.identifier as task_identifier, j.payload,
                 j.attempts, j.max_attempts, j.created_at, j.run_at,
                 j.locked_at, j.last_error
          FROM graphile_worker._private_jobs j
          INNER JOIN graphile_worker._private_tasks t ON t.id = j.task_id
          ORDER BY j.created_at DESC
        `.execute(fastify.db);
        activeJobs = activeJobsResult.rows;
      } catch {
        // graphile_worker schema not yet initialized
      }

      // Get all execution logs for grouping
      const executionLogs = await fastify.db
        .selectFrom("job_execution_logs")
        .select([
          "id",
          "document_id",
          "graphile_job_id",
          "task_identifier",
          "status",
          "started_at",
          "completed_at",
          "final_error",
        ])
        .orderBy("started_at", "desc")
        .execute();

      // Collect all document IDs
      const documentIds = new Set<string>();
      for (const job of activeJobs) {
        const payload = job.payload as { documentId?: string } | null;
        if (payload?.documentId) documentIds.add(payload.documentId);
      }
      for (const log of executionLogs) {
        if (log.document_id) documentIds.add(log.document_id);
      }

      // Get document titles
      const documentTitles: Record<string, string> = {};
      if (documentIds.size > 0) {
        const docs = await fastify.db
          .selectFrom("documents")
          .select(["id", "title"])
          .where("id", "in", [...documentIds])
          .execute();
        for (const doc of docs) {
          documentTitles[doc.id] = doc.title;
        }
      }

      // Build grouped data structure
      type TaskData = {
        attempts: Array<{
          jobId: string;
          status: string;
          startedAt: string;
          completedAt: string | null;
          error: string | null;
        }>;
        activeJob: {
          id: string;
          status: "pending" | "running" | "failed" | "scheduled";
          attempts: number;
          maxAttempts: number;
          runAt: Date;
          lockedAt: Date | null;
          lastError: string | null;
        } | null;
      };

      const documentMap = new Map<string, Map<string, TaskData>>();

      // Process execution logs first (historical attempts)
      for (const log of executionLogs) {
        const docId = log.document_id ?? "__no_document__";
        const taskId = log.task_identifier;

        if (!documentMap.has(docId)) documentMap.set(docId, new Map());
        const taskMap = documentMap.get(docId)!;

        if (!taskMap.has(taskId)) taskMap.set(taskId, { attempts: [], activeJob: null });
        const taskData = taskMap.get(taskId)!;

        taskData.attempts.push({
          jobId: log.graphile_job_id,
          status: log.status,
          startedAt:
            log.started_at instanceof Date
              ? log.started_at.toISOString()
              : String(log.started_at),
          completedAt:
            log.completed_at instanceof Date
              ? log.completed_at.toISOString()
              : (log.completed_at ?? null),
          error: log.final_error ?? null,
        });
      }

      // Process active jobs
      for (const job of activeJobs) {
        const payload = job.payload as { documentId?: string } | null;
        const docId = payload?.documentId ?? "__no_document__";
        const taskId = job.task_identifier ?? "__unknown__";

        if (!documentMap.has(docId)) documentMap.set(docId, new Map());
        const taskMap = documentMap.get(docId)!;

        if (!taskMap.has(taskId)) taskMap.set(taskId, { attempts: [], activeJob: null });
        const taskData = taskMap.get(taskId)!;

        taskData.activeJob = {
          id: job.id,
          status: getJobStatus(job.locked_at, job.run_at, job.attempts ?? 0, job.max_attempts ?? 3),
          attempts: job.attempts ?? 0,
          maxAttempts: job.max_attempts ?? 3,
          runAt: job.run_at,
          lockedAt: job.locked_at,
          lastError: job.last_error,
        };
      }

      // Calculate stats
      const counts = {
        pending: 0,
        scheduled: 0,
        running: 0,
        completed: 0,
        cancelled: 0,
        failed: 0,
        rescheduled: 0,
        total: 0,
      };

      type DocumentGroup = {
        documentId: string | null;
        documentTitle: string | null;
        tasks: Array<{
          taskIdentifier: string;
          status: string;
          attempts: number;
          maxAttempts: number;
          latestJobId: string;
          scheduledAt: string | null;
          startedAt: string | null;
          completedAt: string | null;
          lastError: string | null;
          history: Array<{
            jobId: string;
            status: string;
            startedAt: string;
            completedAt: string | null;
            error: string | null;
          }>;
        }>;
      };

      const documents: DocumentGroup[] = [];

      for (const [docId, taskMap] of documentMap) {
        const tasks: DocumentGroup["tasks"] = [];

        for (const [taskId, taskData] of taskMap) {
          let overallStatus: string;
          let latestJobId: string;
          let scheduledAt: string | null = null;
          let startedAt: string | null = null;
          let completedAt: string | null = null;
          let lastError: string | null = null;
          let maxAttempts = 3;

          const totalAttempts = taskData.attempts.length + (taskData.activeJob ? 1 : 0);

          if (taskData.activeJob) {
            overallStatus = taskData.activeJob.status;
            latestJobId = taskData.activeJob.id;
            maxAttempts = taskData.activeJob.maxAttempts;
            lastError = taskData.activeJob.lastError;

            if (taskData.activeJob.status === "scheduled") {
              scheduledAt = taskData.activeJob.runAt.toISOString();
            }
            if (taskData.activeJob.lockedAt) {
              startedAt =
                taskData.activeJob.lockedAt instanceof Date
                  ? taskData.activeJob.lockedAt.toISOString()
                  : String(taskData.activeJob.lockedAt);
            }
          } else if (taskData.attempts.length > 0) {
            const latest = taskData.attempts[0];
            overallStatus = latest.status;
            latestJobId = latest.jobId;
            startedAt = latest.startedAt;
            completedAt = latest.completedAt;
            lastError = latest.error;
          } else {
            continue;
          }

          if (overallStatus in counts) {
            (counts as Record<string, number>)[overallStatus]++;
          }
          counts.total++;

          tasks.push({
            taskIdentifier: taskId,
            status: overallStatus,
            attempts: totalAttempts,
            maxAttempts,
            latestJobId,
            scheduledAt,
            startedAt,
            completedAt,
            lastError,
            history: taskData.attempts,
          });
        }

        tasks.sort((a, b) => {
          const orderA = taskOrder[a.taskIdentifier] ?? 99;
          const orderB = taskOrder[b.taskIdentifier] ?? 99;
          return orderA - orderB;
        });

        if (tasks.length > 0) {
          documents.push({
            documentId: docId === "__no_document__" ? null : docId,
            documentTitle:
              docId === "__no_document__" ? null : (documentTitles[docId] ?? null),
            tasks,
          });
        }
      }

      // Sort by most recent activity
      documents.sort((a, b) => {
        const getLatestTime = (doc: DocumentGroup): number => {
          let latest = 0;
          for (const task of doc.tasks) {
            if (task.scheduledAt) latest = Math.max(latest, new Date(task.scheduledAt).getTime());
            if (task.startedAt) latest = Math.max(latest, new Date(task.startedAt).getTime());
            if (task.completedAt) latest = Math.max(latest, new Date(task.completedAt).getTime());
          }
          return latest;
        };
        return getLatestTime(b) - getLatestTime(a);
      });

      return {
        success: true,
        data: { stats: { counts }, documents },
      };
    },
  );

  // GET /jobs/:id — job detail with logs
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/jobs/:id",
    {
      schema: { params: idParamsSchema },
      preHandler: [fastify.requireRole("admin")],
    },
    async (request, reply) => {
      const { id } = request.params;

      // Join _private_jobs with _private_tasks to get task_identifier and payload
      const jobResult = await sql<{
        id: string;
        task_identifier: string;
        payload: unknown;
        attempts: number;
        max_attempts: number;
        created_at: string;
        run_at: string;
        locked_at: string | null;
        locked_by: string | null;
        last_error: string | null;
        status: string;
      }>`
        SELECT j.id::text, t.identifier as task_identifier, j.payload,
               j.attempts, j.max_attempts, j.created_at, j.run_at,
               j.locked_at, j.locked_by, j.last_error,
               CASE WHEN j.locked_at IS NOT NULL THEN 'running'
                    WHEN j.last_error IS NOT NULL AND j.attempts >= j.max_attempts THEN 'failed'
                    WHEN j.run_at > NOW() THEN 'scheduled'
                    ELSE 'pending' END as status
        FROM graphile_worker._private_jobs j
        INNER JOIN graphile_worker._private_tasks t ON t.id = j.task_id
        WHERE j.id = ${id}
      `.execute(fastify.db);

      // If not in active jobs, try execution logs (completed/historical)
      if (!jobResult.rows.length) {
        const logResult = await fastify.db
          .selectFrom("job_execution_logs")
          .selectAll()
          .where("graphile_job_id", "=", id)
          .orderBy("started_at", "desc")
          .executeTakeFirst();

        if (!logResult) {
          return reply.status(404).send({ success: false, error: "Job not found" });
        }

        // Return a synthetic job from the execution log
        const llmCallLogs = await fastify.db
          .selectFrom("llm_call_logs")
          .selectAll()
          .where("job_id", "=", id)
          .orderBy("started_at", "asc")
          .execute();

        const allLogs = await fastify.db
          .selectFrom("job_execution_logs")
          .selectAll()
          .where("graphile_job_id", "=", id)
          .orderBy("started_at", "asc")
          .execute();

        let processingResults = null;
        if (logResult.document_id) {
          processingResults = await fastify.db
            .selectFrom("document_processing_results")
            .selectAll()
            .where("document_id", "=", logResult.document_id)
            .executeTakeFirst();
        }

        return {
          success: true,
          data: buildJobDetailResponse(null, allLogs, llmCallLogs, processingResults, logResult),
        };
      }

      const job = jobResult.rows[0];
      const payload = job.payload as { documentId?: string } | null;
      const documentId = payload?.documentId ?? null;

      const executionLogs = await fastify.db
        .selectFrom("job_execution_logs")
        .selectAll()
        .where("graphile_job_id", "=", id)
        .orderBy("started_at", "asc")
        .execute();

      const llmCallLogs = await fastify.db
        .selectFrom("llm_call_logs")
        .selectAll()
        .where("job_id", "=", id)
        .orderBy("started_at", "asc")
        .execute();

      let processingResults = null;
      if (documentId) {
        processingResults = await fastify.db
          .selectFrom("document_processing_results")
          .selectAll()
          .where("document_id", "=", documentId)
          .executeTakeFirst();
      }

      return {
        success: true,
        data: buildJobDetailResponse(job, executionLogs, llmCallLogs, processingResults, null),
      };
    },
  );

  // POST /jobs/:id/retry — reset job attempts
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/jobs/:id/retry",
    {
      schema: { params: idParamsSchema },
      preHandler: [fastify.requireRole("admin")],
    },
    async (request, reply) => {
      const { id } = request.params;

      const result = await sql`
        UPDATE graphile_worker._private_jobs
        SET attempts = 0, last_error = NULL, run_at = NOW()
        WHERE id = ${id}
      `.execute(fastify.db);

      if (!result.numAffectedRows || Number(result.numAffectedRows) === 0) {
        return reply.status(404).send({ success: false, error: "Job not found" });
      }

      return { success: true };
    },
  );

  // POST /jobs/:id/cancel — remove job from queue
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/jobs/:id/cancel",
    {
      schema: { params: idParamsSchema },
      preHandler: [fastify.requireRole("admin")],
    },
    async (request, reply) => {
      const { id } = request.params;

      const result = await sql`
        DELETE FROM graphile_worker._private_jobs WHERE id = ${id}
      `.execute(fastify.db);

      if (!result.numAffectedRows || Number(result.numAffectedRows) === 0) {
        return reply.status(404).send({ success: false, error: "Job not found" });
      }

      return { success: true };
    },
  );

  // POST /jobs/bulk-retry — retry all failed jobs
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/jobs/bulk-retry",
    {
      preHandler: [fastify.requireRole("admin")],
    },
    async (_request, _reply) => {
      const result = await sql`
        UPDATE graphile_worker._private_jobs
        SET attempts = 0, last_error = NULL, run_at = NOW()
        WHERE last_error IS NOT NULL
      `.execute(fastify.db);

      return {
        success: true,
        data: { count: Number(result.numAffectedRows ?? 0) },
      };
    },
  );

  // DELETE /jobs/completed — clear completed execution logs
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    "/jobs/completed",
    {
      preHandler: [fastify.requireRole("admin")],
    },
    async (_request, _reply) => {
      const result = await fastify.db
        .deleteFrom("job_execution_logs")
        .where("status", "=", "completed")
        .executeTakeFirstOrThrow();

      return {
        success: true,
        data: { count: Number(result.numDeletedRows ?? 0) },
      };
    },
  );
};

type ActiveJob = {
  id: string;
  task_identifier: string;
  payload: unknown;
  attempts: number;
  max_attempts: number;
  created_at: string;
  run_at: string;
  locked_at: string | null;
  locked_by: string | null;
  last_error: string | null;
  status: string;
} | null;

type ExecutionLog = {
  id: string;
  document_id: string | null;
  graphile_job_id: string;
  task_identifier: string;
  log_entries: unknown;
  started_at: Date | string;
  completed_at: Date | string | null;
  duration_ms: number | null;
  status: string;
  final_error: string | null;
};

type LlmCallLog = {
  id: string;
  document_id: string | null;
  job_id: string | null;
  task_type: string;
  model_id: string;
  status: string;
  started_at: Date | string;
  completed_at: Date | string | null;
  processing_time_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_cents: unknown;
  error_code: string | null;
  error_message: string | null;
  response_summary: unknown;
};

type ProcessingResults = {
  virus_scan_passed: boolean | null;
  virus_scan_details: string | null;
  virus_scan_completed_at: Date | string | null;
  conversion_performed: boolean | null;
  original_mimetype: string | null;
  conversion_completed_at: Date | string | null;
  sieve_performed: boolean | null;
  sieve_category: string | null;
  sieve_nexus_score: unknown;
  sieve_junk_score: unknown;
  sieve_confidence: unknown;
  sieve_reasoning: string | null;
  sieve_model: string | null;
  sieve_processing_time_ms: number | null;
  sieve_completed_at: Date | string | null;
  ai_extraction_performed: boolean | null;
  ai_extraction_model: string | null;
  ai_extracted_metadata: string | null;
  ai_extraction_error: string | null;
  ai_extraction_completed_at: Date | string | null;
} | null | undefined;

function toIsoString(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  return val instanceof Date ? val.toISOString() : String(val);
}

function buildJobDetailResponse(
  job: ActiveJob,
  executionLogs: ExecutionLog[],
  llmCallLogs: LlmCallLog[],
  processingResults: ProcessingResults,
  fallbackLog: ExecutionLog | null,
) {
  const documentId = job
    ? ((job.payload as { documentId?: string } | null)?.documentId ?? null)
    : (fallbackLog?.document_id ?? null);

  const jobInfo = job
    ? {
        id: job.id,
        taskIdentifier: job.task_identifier,
        documentId,
        payload: job.payload,
        attempts: job.attempts,
        maxAttempts: job.max_attempts,
        createdAt: job.created_at,
        runAt: job.run_at,
        lockedAt: job.locked_at,
        lockedBy: job.locked_by,
        lastError: job.last_error,
        status: job.status,
        startedAt: job.locked_at,
        completedAt: null,
        errorMessage: job.last_error,
      }
    : fallbackLog
      ? {
          id: fallbackLog.graphile_job_id,
          taskIdentifier: fallbackLog.task_identifier,
          documentId,
          payload: null,
          attempts: 1,
          maxAttempts: 3,
          createdAt: toIsoString(fallbackLog.started_at),
          runAt: toIsoString(fallbackLog.started_at),
          lockedAt: toIsoString(fallbackLog.started_at),
          lockedBy: null,
          lastError: fallbackLog.final_error,
          status: fallbackLog.status,
          startedAt: toIsoString(fallbackLog.started_at),
          completedAt: toIsoString(fallbackLog.completed_at),
          errorMessage: fallbackLog.final_error,
        }
      : null;

  const mappedLogs = executionLogs.map((l) => ({
    id: l.id,
    graphileJobId: l.graphile_job_id,
    taskIdentifier: l.task_identifier,
    status: l.status,
    startedAt: toIsoString(l.started_at) ?? "",
    completedAt: toIsoString(l.completed_at),
    durationMs: l.duration_ms ?? null,
    finalError: l.final_error ?? null,
    entries: Array.isArray(l.log_entries) ? l.log_entries : [],
  }));

  const mappedLlmCalls = llmCallLogs.map((l) => ({
    id: l.id,
    jobId: l.job_id,
    taskType: l.task_type,
    modelId: l.model_id,
    status: l.status,
    startedAt: toIsoString(l.started_at) ?? "",
    completedAt: toIsoString(l.completed_at),
    processingTimeMs: l.processing_time_ms,
    inputTokens: l.input_tokens,
    outputTokens: l.output_tokens,
    costCents: l.cost_cents !== null ? Number(l.cost_cents) : null,
    errorCode: l.error_code,
    errorMessage: l.error_message,
    responseSummary: l.response_summary,
  }));

  const pr = processingResults;
  const mappedProcessingResults = pr
    ? {
        virusScan:
          pr.virus_scan_passed !== null
            ? {
                passed: pr.virus_scan_passed,
                details: pr.virus_scan_details,
                completedAt: toIsoString(pr.virus_scan_completed_at),
              }
            : null,
        conversion:
          pr.conversion_performed !== null
            ? {
                performed: pr.conversion_performed,
                originalMimetype: pr.original_mimetype,
                completedAt: toIsoString(pr.conversion_completed_at),
              }
            : null,
        sieve:
          pr.sieve_performed
            ? {
                category: pr.sieve_category,
                nexusScore: Number(pr.sieve_nexus_score ?? 0),
                junkScore: Number(pr.sieve_junk_score ?? 0),
                confidence: Number(pr.sieve_confidence ?? 0),
                reasoning: pr.sieve_reasoning,
                model: pr.sieve_model,
                processingTimeMs: pr.sieve_processing_time_ms,
                completedAt: toIsoString(pr.sieve_completed_at),
              }
            : null,
        aiExtraction:
          pr.ai_extraction_performed !== null
            ? {
                performed: pr.ai_extraction_performed,
                model: pr.ai_extraction_model,
                completedAt: toIsoString(pr.ai_extraction_completed_at),
                error: pr.ai_extraction_error,
              }
            : null,
      }
    : null;

  return {
    job: jobInfo,
    executionLogs: mappedLogs,
    llmCalls: mappedLlmCalls,
    processingResults: mappedProcessingResults,
  };
}

export default plugin;
