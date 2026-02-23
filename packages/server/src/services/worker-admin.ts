/**
 * worker-admin.ts
 *
 * This is the ONLY permitted location for raw SQL queries against
 * Graphile Worker's internal tables. All other worker interactions
 * use the makeWorkerUtils() public API.
 *
 * Raw SQL is needed here because Graphile Worker does not expose
 * all admin operations (job cancellation, detailed status, etc.)
 * through its public API.
 *
 * Note: graphile_worker.jobs is a VIEW (migration 000017+) that does not
 * expose `payload`. Use _private_jobs JOIN _private_tasks for full data.
 */
import type { Pool } from "pg";

export interface WorkerJob {
  id: string;
  queue_name: string | null;
  task_identifier: string;
  payload: unknown;
  priority: number;
  run_at: Date;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
  locked_by: string | null;
  locked_at: Date | null;
  key: string | null;
  revision: number;
  flags: unknown;
}

export interface WorkerJobListOptions {
  status?: "pending" | "running" | "failed" | "completed";
  taskIdentifier?: string;
  limit?: number;
  offset?: number;
}

export async function listWorkerJobs(
  pool: Pool,
  options: WorkerJobListOptions = {},
): Promise<{ jobs: WorkerJob[]; total: number }> {
  const { status, taskIdentifier, limit = 20, offset = 0 } = options;

  let whereClause = "WHERE 1=1";
  const params: unknown[] = [];
  let paramIdx = 1;

  if (taskIdentifier) {
    whereClause += ` AND t.identifier = $${paramIdx++}`;
    params.push(taskIdentifier);
  }

  if (status === "running") {
    whereClause += ` AND j.locked_by IS NOT NULL AND j.locked_at IS NOT NULL`;
  } else if (status === "failed") {
    whereClause += ` AND j.last_error IS NOT NULL AND j.attempts >= j.max_attempts`;
  } else if (status === "pending") {
    whereClause += ` AND j.locked_by IS NULL AND (j.last_error IS NULL OR j.attempts < j.max_attempts)`;
  }

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM graphile_worker._private_jobs j
     INNER JOIN graphile_worker._private_tasks t ON t.id = j.task_id
     ${whereClause}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const jobsResult = await pool.query(
    `SELECT j.id::text, t.identifier as task_identifier, j.payload,
            j.priority, j.run_at, j.attempts, j.max_attempts,
            j.last_error, j.created_at, j.updated_at,
            j.locked_by, j.locked_at, j.key, j.revision, j.flags
     FROM graphile_worker._private_jobs j
     INNER JOIN graphile_worker._private_tasks t ON t.id = j.task_id
     ${whereClause}
     ORDER BY j.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset],
  );

  return { jobs: jobsResult.rows as WorkerJob[], total };
}

export async function cancelWorkerJob(pool: Pool, jobId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM graphile_worker._private_jobs WHERE id = $1 AND locked_by IS NULL RETURNING id`,
    [jobId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getWorkerJob(pool: Pool, jobId: string): Promise<WorkerJob | null> {
  const result = await pool.query(
    `SELECT j.id::text, t.identifier as task_identifier, j.payload,
            j.priority, j.run_at, j.attempts, j.max_attempts,
            j.last_error, j.created_at, j.updated_at,
            j.locked_by, j.locked_at, j.key, j.revision, j.flags
     FROM graphile_worker._private_jobs j
     INNER JOIN graphile_worker._private_tasks t ON t.id = j.task_id
     WHERE j.id = $1`,
    [jobId],
  );
  return (result.rows[0] as WorkerJob) ?? null;
}
