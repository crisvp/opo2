/**
 * Execution Logging Wrapper for Graphile Worker Tasks
 *
 * Wraps task handlers to automatically capture execution logs to the database.
 * The wrapper:
 * 1. Creates an execution logger before task runs
 * 2. Replaces helpers.logger with the logging wrapper
 * 3. Finalizes the log with success/failure status when task completes
 */

import type { Logger, Task } from "graphile-worker";
import { createExecutionLogger } from "./executionLogger.js";

/**
 * Special error class to signal that a task was rescheduled (e.g., rate limited).
 * Tasks should throw this instead of returning normally when they reschedule themselves.
 * This allows the execution logger to record "rescheduled" status instead of "completed".
 */
export class TaskRescheduledError extends Error {
  constructor(message: string = "Task rescheduled") {
    super(message);
    this.name = "TaskRescheduledError";
  }
}

/**
 * Special error class to signal that a task has permanently failed and should not be retried.
 * Use this for non-transient errors like 400 Bad Request where retrying would be futile.
 * The task will be marked as failed but Graphile Worker will not schedule retries.
 */
export class PermanentJobError extends Error {
  constructor(message: string = "Permanent job failure") {
    super(message);
    this.name = "PermanentJobError";
  }
}

/**
 * Wrap a task handler with execution logging.
 *
 * Designed for document processing tasks that have a documentId in their payload.
 * For tasks without a documentId, the original task is returned unchanged.
 */
export function withExecutionLogging(task: Task): Task {
  return async (payload, helpers) => {
    const typedPayload = payload as Record<string, unknown>;
    const documentId =
      "documentId" in typedPayload ? typedPayload.documentId : undefined;

    if (!documentId || typeof documentId !== "string") {
      return task(payload, helpers);
    }

    const execLogger = await createExecutionLogger(
      documentId,
      helpers.job.id.toString(),
      helpers.job.task_identifier,
      helpers.logger,
    );

    const wrappedHelpers = {
      ...helpers,
      logger: execLogger as unknown as Logger,
    };

    try {
      await task(payload, wrappedHelpers);
      await execLogger.finalize("completed");
    } catch (error) {
      if (error instanceof TaskRescheduledError) {
        await execLogger.finalize("rescheduled", error.message);
        return;
      }

      if (error instanceof PermanentJobError) {
        await execLogger.finalize("failed", error.message);
        return;
      }

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await execLogger.finalize("failed", errorMessage);
      throw error;
    }
  };
}
