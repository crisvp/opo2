import type { JobHelpers } from "graphile-worker";
import { makeWorkerUtils } from "graphile-worker";
import { nanoid } from "nanoid";
import { z } from "zod";

import { TASK_TIMEOUTS } from "../../config/processing.js";
import { chatCompletion } from "../../services/openrouter.js";
import { getFileAsDataUrl } from "../../services/storage.js";
import { getDb } from "../../util/db.js";

export interface ExtractorPayload {
  documentId: string;
  s3Key: string;
}

const extractorPayloadSchema = z.object({
  documentId: z.string(),
  s3Key: z.string(),
});

const EXTRACTOR_MODEL = "google/gemini-2.0-flash-001";

const EXTRACTOR_PROMPT = `You are a document metadata extractor. Extract structured information from this surveillance policy document.

Respond ONLY with JSON:
{
  "title": "extracted or improved title",
  "description": "1-2 sentence summary",
  "document_date": "YYYY-MM-DD or null",
  "metadata": [
    {"key": "field_key", "value": "string value", "confidence": 0.0-1.0},
    ...
  ]
}

Common metadata fields: vendor_name, technology_type, policy_type, contract_value, effective_date, expiration_date, department_name`;

const metadataItemSchema = z.object({
  key: z.string(),
  value: z.string(),
  confidence: z.number().min(0).max(1),
});

const extractorResponseSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  document_date: z.string().nullable().optional(),
  metadata: z.array(metadataItemSchema).optional().default([]),
});

export function parseExtractorResponse(content: string): z.infer<typeof extractorResponseSchema> {
  const stripped = content.replace(/```(?:json)?\n?/g, "").trim();
  const parsed = JSON.parse(stripped) as unknown;
  return extractorResponseSchema.parse(parsed);
}

export async function extractor(rawPayload: unknown, helpers: JobHelpers): Promise<void> {
  void TASK_TIMEOUTS;
  const payload: ExtractorPayload = extractorPayloadSchema.parse(rawPayload);
  const { documentId, s3Key } = payload;

  helpers.logger.info(`Starting extraction for document ${documentId}`);

  const db = getDb(process.env.DATABASE_URL!);
  const startedAt = new Date();

  try {
    // Check if AI extraction is enabled for this document
    const doc = await db
      .selectFrom("documents")
      .select(["use_ai_extraction"])
      .where("id", "=", documentId)
      .executeTakeFirst();

    if (!doc?.use_ai_extraction) {
      helpers.logger.info(`AI extraction disabled for document ${documentId}, skipping`);

      const skipFields = {
        ai_extraction_performed: false,
        ai_extraction_model: null,
        ai_extracted_metadata: null,
        ai_extraction_error: "AI extraction disabled for this document",
        ai_extraction_completed_at: new Date(),
      };

      await db
        .insertInto("document_processing_results")
        .values({ document_id: documentId, ...skipFields })
        .onConflict((oc) =>
          oc.column("document_id").doUpdateSet(skipFields),
        )
        .execute();

      const workerUtils = await makeWorkerUtils({ connectionString: process.env.DATABASE_URL! });
      try {
        await workerUtils.addJob("pipeline_complete", { documentId });
      } finally {
        await workerUtils.release();
      }
      return;
    }

    const dataUrl = await getFileAsDataUrl(s3Key);

    const messages = [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: EXTRACTOR_PROMPT },
          { type: "image_url" as const, image_url: { url: dataUrl } },
        ],
      },
    ];

    const result = await chatCompletion({
      model: EXTRACTOR_MODEL,
      messages,
      maxTokens: 2048,
      temperature: 0.1,
    });

    const completedAt = new Date();
    const processingTimeMs = completedAt.getTime() - startedAt.getTime();

    let extractedData: z.infer<typeof extractorResponseSchema>;
    try {
      extractedData = parseExtractorResponse(result.content);
    } catch (parseErr) {
      throw new Error(`Failed to parse extractor LLM response: ${parseErr}. Raw: ${result.content}`);
    }

    // Log LLM call
    const llmLogId = nanoid();
    await db
      .insertInto("llm_call_logs")
      .values({
        id: llmLogId,
        document_id: documentId,
        job_id: String(helpers.job.id),
        task_type: "extractor",
        model_id: result.model,
        status: "success",
        started_at: startedAt,
        completed_at: completedAt,
        processing_time_ms: processingTimeMs,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        cost_cents: null,
        error_code: null,
        error_message: null,
        response_summary: JSON.stringify({
          title: extractedData.title,
          metadataCount: extractedData.metadata?.length ?? 0,
        }),
      })
      .execute();

    // Upsert document_metadata rows for each extracted field
    const metadataItems = extractedData.metadata ?? [];
    for (const item of metadataItems) {
      const metaId = nanoid();
      const now = new Date();
      await db
        .insertInto("document_metadata")
        .values({
          id: metaId,
          document_id: documentId,
          field_key: item.key,
          field_definition_id: null,
          value_text: item.value,
          value_number: null,
          value_date: null,
          value_boolean: null,
          value_json: null,
          source: "ai",
          confidence: item.confidence,
        })
        .onConflict((oc) =>
          oc
            .columns(["document_id", "field_key"])
            .doUpdateSet({
              value_text: item.value,
              confidence: item.confidence,
            }),
        )
        .execute();
    }

    // Update document title/description if extracted
    const docUpdates: Record<string, string> = {};
    if (extractedData.title) docUpdates.title = extractedData.title;
    if (extractedData.description) docUpdates.description = extractedData.description;
    if (Object.keys(docUpdates).length > 0) {
      await db
        .updateTable("documents")
        .set(docUpdates)
        .where("id", "=", documentId)
        .execute();
    }

    // Upsert processing results
    const extractionFields = {
      ai_extraction_performed: true,
      ai_extraction_model: result.model,
      ai_extracted_metadata: JSON.stringify(extractedData),
      ai_extraction_error: null,
      ai_extraction_completed_at: completedAt,
    };

    await db
      .insertInto("document_processing_results")
      .values({ document_id: documentId, ...extractionFields })
      .onConflict((oc) =>
        oc.column("document_id").doUpdateSet(extractionFields),
      )
      .execute();

    const workerUtils = await makeWorkerUtils({ connectionString: process.env.DATABASE_URL! });
    try {
      await workerUtils.addJob("pipeline_complete", { documentId });
    } finally {
      await workerUtils.release();
    }

    helpers.logger.info(`Extraction complete for document ${documentId}`);
  } catch (err) {
    helpers.logger.error(`Extraction failed for document ${documentId}: ${err}`);

    // Log failed LLM call
    try {
      const failedAt = new Date();
      await db
        .insertInto("llm_call_logs")
        .values({
          id: nanoid(),
          document_id: documentId,
          job_id: String(helpers.job.id),
          task_type: "extractor",
          model_id: EXTRACTOR_MODEL,
          status: "error",
          started_at: startedAt,
          completed_at: failedAt,
          processing_time_ms: failedAt.getTime() - startedAt.getTime(),
          input_tokens: 0,
          output_tokens: 0,
          cost_cents: null,
          error_code: null,
          error_message: String(err),
          response_summary: null,
        })
        .execute();
    } catch {
      // Ignore logging errors
    }

    const errorFields = {
      ai_extraction_performed: false,
      ai_extraction_model: EXTRACTOR_MODEL,
      ai_extracted_metadata: null,
      ai_extraction_error: String(err),
      ai_extraction_completed_at: new Date(),
    };

    try {
      await db
        .insertInto("document_processing_results")
        .values({ document_id: documentId, ...errorFields })
        .onConflict((oc) =>
          oc.column("document_id").doUpdateSet(errorFields),
        )
        .execute();
    } catch {
      // Ignore
    }

    await db
      .updateTable("documents")
      .set({ state: "processing_failed" })
      .where("id", "=", documentId)
      .execute();
    throw err;
  }
}
