import { Pool } from "pg";
import type { JobHelpers } from "graphile-worker";
import { z } from "zod";

import { TASK_TIMEOUTS } from "../../config/processing.js";
import { getDb } from "../../util/db.js";

export interface PipelineCompletePayload {
  documentId: string;
}

const pipelineCompletePayloadSchema = z.object({
  documentId: z.string(),
});

export function determineNewState(sieveCategory: string | null | undefined): {
  state: string;
  rejectionReason: string | null;
} {
  if (sieveCategory === "JUNK") {
    return {
      state: "rejected",
      rejectionReason: "Document classified as junk by AI",
    };
  }
  return {
    state: "user_review",
    rejectionReason: null,
  };
}

export async function pipelineComplete(
  rawPayload: unknown,
  helpers: JobHelpers,
): Promise<void> {
  void TASK_TIMEOUTS;
  const payload: PipelineCompletePayload = pipelineCompletePayloadSchema.parse(rawPayload);
  const { documentId } = payload;

  helpers.logger.info(`Pipeline complete for document ${documentId}`);

  const db = getDb(process.env.DATABASE_URL!);

  try {
    // Get processing results to determine final state
    const processingResult = await db
      .selectFrom("document_processing_results")
      .select(["sieve_category"])
      .where("document_id", "=", documentId)
      .executeTakeFirst();

    const sieveCategory = processingResult?.sieve_category ?? null;
    const { state, rejectionReason } = determineNewState(sieveCategory);

    const now = new Date();
    const updateValues: Record<string, unknown> = {
      state,
      processing_completed_at: now,
    };
    if (rejectionReason !== null) {
      updateValues.rejection_reason = rejectionReason;
    }

    await db
      .updateTable("documents")
      .set(updateValues)
      .where("id", "=", documentId)
      .execute();

    helpers.logger.info(`Document ${documentId} transitioned to state: ${state}`);

    // Send pg_notify for SSE
    const notifyPayload = JSON.stringify({ documentId, state });
    const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
    const client = await pool.connect();
    try {
      await client.query("SELECT pg_notify('document_status', $1)", [notifyPayload]);
    } finally {
      client.release();
      await pool.end();
    }

    helpers.logger.info(`Sent document_status NOTIFY for document ${documentId}`);
  } catch (err) {
    helpers.logger.error(`pipeline_complete failed for document ${documentId}: ${err}`);
    await db
      .updateTable("documents")
      .set({ state: "processing_failed" })
      .where("id", "=", documentId)
      .execute();
    throw err;
  }
}
