import type { JobHelpers } from "graphile-worker";
import { makeWorkerUtils } from "graphile-worker";
import { nanoid } from "nanoid";
import { z } from "zod";

import { TASK_TIMEOUTS } from "../../config/processing.js";
import { chatCompletion } from "../../services/openrouter.js";
import { getFileAsDataUrl } from "../../services/storage.js";
import { getDb } from "../../util/db.js";

export interface SievePayload {
  documentId: string;
  s3Key: string;
}

const sievePayloadSchema = z.object({
  documentId: z.string(),
  s3Key: z.string(),
});

const SIEVE_MODEL = "google/gemini-2.0-flash-001";

const SIEVE_PROMPT = `You are a document relevance classifier. Classify this document into one of:
- HIGH_RELEVANCE: Contains surveillance policy, contracts, or operational documents about surveillance technology
- ADMIN_FINANCE: Administrative or financial documents with minimal direct surveillance content
- JUNK: Not related to surveillance (spam, personal documents, etc.)
- UNCERTAIN: Cannot determine relevance without more context

Respond ONLY with JSON: {"category": "HIGH_RELEVANCE"|"ADMIN_FINANCE"|"JUNK"|"UNCERTAIN", "nexus_score": 0.0-1.0, "junk_score": 0.0-1.0, "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

const sieveResponseSchema = z.object({
  category: z.enum(["HIGH_RELEVANCE", "ADMIN_FINANCE", "JUNK", "UNCERTAIN"]),
  nexus_score: z.number().min(0).max(1),
  junk_score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export type SieveCategory = "HIGH_RELEVANCE" | "ADMIN_FINANCE" | "JUNK" | "UNCERTAIN";

export function parseSieveResponse(content: string): z.infer<typeof sieveResponseSchema> {
  // Strip markdown code fences if present
  const stripped = content.replace(/```(?:json)?\n?/g, "").trim();
  const parsed = JSON.parse(stripped) as unknown;
  return sieveResponseSchema.parse(parsed);
}

export async function sieve(rawPayload: unknown, helpers: JobHelpers): Promise<void> {
  void TASK_TIMEOUTS;
  const payload: SievePayload = sievePayloadSchema.parse(rawPayload);
  const { documentId, s3Key } = payload;

  helpers.logger.info(`Starting sieve classification for document ${documentId}`);

  const db = getDb(process.env.DATABASE_URL!);
  const startedAt = new Date();
  let uploaderId: string | null = null;

  try {
    // Fetch the document to get uploader_id for LLM call logging
    const doc = await db
      .selectFrom("documents")
      .select(["uploader_id"])
      .where("id", "=", documentId)
      .executeTakeFirst();

    uploaderId = doc?.uploader_id ?? null;

    const dataUrl = await getFileAsDataUrl(s3Key);

    const messages = [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: SIEVE_PROMPT },
          { type: "image_url" as const, image_url: { url: dataUrl } },
        ],
      },
    ];

    // No apiKey passed — uses the system key (process.env.OPENROUTER_API_KEY)
    const result = await chatCompletion({
      model: SIEVE_MODEL,
      messages,
      maxTokens: 512,
      temperature: 0.1,
    });
    const usedSystemKey = true;

    const completedAt = new Date();
    const processingTimeMs = completedAt.getTime() - startedAt.getTime();

    let sieveData: z.infer<typeof sieveResponseSchema>;
    try {
      sieveData = parseSieveResponse(result.content);
    } catch (parseErr) {
      throw new Error(`Failed to parse sieve LLM response: ${parseErr}. Raw: ${result.content}`);
    }

    const totalTokens =
      result.inputTokens !== null && result.outputTokens !== null
        ? result.inputTokens + result.outputTokens
        : null;

    // Log LLM call
    const llmLogId = nanoid();
    await db
      .insertInto("llm_call_logs")
      .values({
        id: llmLogId,
        document_id: documentId,
        job_id: String(helpers.job.id),
        task_type: "sieve",
        model_id: result.model,
        status: "success",
        started_at: startedAt,
        completed_at: completedAt,
        processing_time_ms: processingTimeMs,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        total_tokens: totalTokens,
        user_id: uploaderId,
        used_system_key: usedSystemKey,
        cost_cents: null,
        error_code: null,
        error_message: null,
        response_summary: JSON.stringify({ category: sieveData.category, confidence: sieveData.confidence }),
      })
      .execute();

    // Upsert processing results
    const sieveFields = {
      sieve_performed: true,
      sieve_category: sieveData.category,
      sieve_nexus_score: sieveData.nexus_score,
      sieve_junk_score: sieveData.junk_score,
      sieve_confidence: sieveData.confidence,
      sieve_reasoning: sieveData.reasoning,
      sieve_model: result.model,
      sieve_processing_time_ms: processingTimeMs,
      sieve_completed_at: completedAt,
    };

    await db
      .insertInto("document_processing_results")
      .values({ document_id: documentId, ...sieveFields })
      .onConflict((oc) =>
        oc.column("document_id").doUpdateSet(sieveFields),
      )
      .execute();

    const workerUtils = await makeWorkerUtils({ connectionString: process.env.DATABASE_URL! });
    try {
      if (sieveData.category === "JUNK") {
        helpers.logger.info(`Document ${documentId} classified as JUNK, enqueueing pipeline_complete`);
        await workerUtils.addJob("pipeline_complete", { documentId });
      } else {
        helpers.logger.info(`Document ${documentId} classified as ${sieveData.category}, enqueueing extractor`);
        await workerUtils.addJob("extractor", { documentId, s3Key });
      }
    } finally {
      await workerUtils.release();
    }
  } catch (err) {
    helpers.logger.error(`Sieve failed for document ${documentId}: ${err}`);

    // Log failed LLM call if error happened during LLM call
    try {
      const failedAt = new Date();
      await db
        .insertInto("llm_call_logs")
        .values({
          id: nanoid(),
          document_id: documentId,
          job_id: String(helpers.job.id),
          task_type: "sieve",
          model_id: SIEVE_MODEL,
          status: "error",
          started_at: startedAt,
          completed_at: failedAt,
          processing_time_ms: failedAt.getTime() - startedAt.getTime(),
          input_tokens: null,
          output_tokens: null,
          total_tokens: null,
          user_id: uploaderId,
          used_system_key: true,
          cost_cents: null,
          error_code: null,
          error_message: String(err),
          response_summary: null,
        })
        .execute();
    } catch {
      // Ignore logging errors
    }

    await db
      .updateTable("documents")
      .set({ state: "processing_failed" })
      .where("id", "=", documentId)
      .execute();
    throw err;
  }
}
