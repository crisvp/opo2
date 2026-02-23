/**
 * Execution Logger Service
 *
 * Wraps Graphile Worker's logger to capture step-by-step execution logs
 * to the database while maintaining console output.
 *
 * Features:
 * - Creates a log record when task starts
 * - Captures all logger calls (debug, info, warn, error)
 * - Batches writes to reduce DB load (flushes every 1 second)
 * - Finalizes with status and duration when task completes
 */

import { nanoid } from "nanoid";
import type { Logger } from "graphile-worker";
import { sql } from "kysely";
import { env } from "../config/env.js";
import { getDb } from "../util/db.js";

export interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  data?: Record<string, unknown>;
}

export interface ExecutionLogger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string, meta?: unknown): void;
  scope(): ExecutionLogger;
  getLogId(): string;
  finalize(status: "completed" | "failed" | "rescheduled", error?: string): Promise<void>;
}

export async function createExecutionLogger(
  documentId: string,
  graphileJobId: string,
  taskIdentifier: string,
  baseLogger: Logger,
): Promise<ExecutionLogger> {
  const logId = nanoid();
  const startedAt = new Date();
  const pendingEntries: LogEntry[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let isFinalized = false;

  const db = getDb(env.DATABASE_URL);

  await db
    .insertInto("job_execution_logs")
    .values({
      id: logId,
      document_id: documentId,
      graphile_job_id: graphileJobId,
      task_identifier: taskIdentifier,
      log_entries: JSON.stringify([]),
      started_at: startedAt,
      status: "running",
    })
    .execute();

  async function flushLogs(): Promise<void> {
    if (pendingEntries.length === 0) return;

    const entries = [...pendingEntries];
    pendingEntries.length = 0;

    try {
      await db
        .updateTable("job_execution_logs")
        .set({
          log_entries: sql`log_entries || ${JSON.stringify(entries)}::jsonb`,
        })
        .where("id", "=", logId)
        .execute();
    } catch (error) {
      baseLogger.error(
        `Failed to flush execution logs: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  function scheduleFlush(): void {
    if (isFinalized) return;
    if (!flushTimer) {
      flushTimer = setTimeout(async () => {
        flushTimer = null;
        await flushLogs();
      }, 1000);
    }
  }

  function addEntry(level: LogEntry["level"], message: string, data?: unknown): void {
    if (isFinalized) return;
    pendingEntries.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      data: data as Record<string, unknown> | undefined,
    });
    scheduleFlush();
  }

  return {
    getLogId: () => logId,

    debug(message: string): void {
      addEntry("debug", message);
      baseLogger.debug(message);
    },

    info(message: string): void {
      addEntry("info", message);
      baseLogger.info(message);
    },

    warn(message: string): void {
      addEntry("warn", message);
      baseLogger.warn(message);
    },

    error(message: string, meta?: unknown): void {
      addEntry("error", message, meta);
      baseLogger.error(message, meta as Record<string, unknown> | undefined);
    },

    scope(): ExecutionLogger {
      return this as ExecutionLogger;
    },

    async finalize(
      status: "completed" | "failed" | "rescheduled",
      error?: string,
    ): Promise<void> {
      if (isFinalized) return;
      isFinalized = true;

      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }

      await flushLogs();

      const completedAt = new Date();
      await db
        .updateTable("job_execution_logs")
        .set({
          status,
          final_error: error ?? null,
          completed_at: completedAt,
          duration_ms: completedAt.getTime() - startedAt.getTime(),
        })
        .where("id", "=", logId)
        .execute();
    },
  };
}
