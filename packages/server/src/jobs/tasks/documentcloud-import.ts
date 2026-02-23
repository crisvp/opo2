import type { JobHelpers } from "graphile-worker";
import { z } from "zod";
import { makeWorkerUtils } from "graphile-worker";
import { nanoid } from "nanoid";

import { TASK_TIMEOUTS } from "../../config/processing.js";
import { env } from "../../config/env.js";
import { getDb } from "../../util/db.js";
import { putObject } from "../../services/storage.js";

export interface DocumentCloudImportPayload {
  importJobId: string;
  documentCloudId: number;
  userId: string;
}

const documentCloudImportPayloadSchema = z.object({
  importJobId: z.string(),
  documentCloudId: z.number(),
  userId: z.string(),
});

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

const DC_API_BASE = "https://api.www.documentcloud.org/api";

export async function documentcloudImport(
  rawPayload: unknown,
  helpers: JobHelpers,
): Promise<void> {
  const payload: DocumentCloudImportPayload = documentCloudImportPayloadSchema.parse(rawPayload);
  const signal = AbortSignal.timeout(TASK_TIMEOUTS.documentcloud_import);
  helpers.logger.info(`Starting DocumentCloud import for DC ID ${payload.documentCloudId}`);

  const db = getDb(env.DATABASE_URL);
  const documentId = nanoid();

  try {
    // 1. Fetch document metadata from DC API
    const metaRes = await fetch(
      `${DC_API_BASE}/documents/${payload.documentCloudId}/`,
      {
        signal,
        headers: { Accept: "application/json" },
      },
    );
    if (!metaRes.ok) {
      throw new Error(`DC API returned ${metaRes.status} for document ${payload.documentCloudId}`);
    }
    const dcDoc = (await metaRes.json()) as DCDocument;

    // 2. Check file_url is available
    if (!dcDoc.file_url) {
      throw new Error(`DC document ${payload.documentCloudId} has no file_url`);
    }

    // 3. Download the PDF
    const pdfRes = await fetch(dcDoc.file_url, {
      signal,
      headers: { Accept: "application/pdf" },
    });
    if (!pdfRes.ok) {
      throw new Error(`Failed to download PDF from ${dcDoc.file_url}: ${pdfRes.status}`);
    }
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

    // 4. Upload to S3
    const s3Key = `documents/${documentId}/original.pdf`;
    await putObject(s3Key, pdfBuffer, "application/pdf");

    // 5. Create document row
    const now = new Date();
    await db
      .insertInto("documents" as never)
      .values({
        id: documentId,
        title: dcDoc.title,
        description: dcDoc.description ?? null,
        state: "submitted",
        filepath: s3Key,
        uploader_id: payload.userId,
        source_id: String(dcDoc.id),
        source_name: "documentcloud",
        created_at: now,
        updated_at: now,
      } as never)
      .execute();

    helpers.logger.info(`Created document ${documentId} from DC doc ${payload.documentCloudId}`);

    // 6. Update import job: imported_count++
    await db
      .updateTable("document_import_jobs" as never)
      .set({
        imported_count: db.fn("imported_count + 1" as never, [] as never) as never,
        updated_at: now,
      } as never)
      .where("id" as never, "=", payload.importJobId as never)
      .execute();

    // 7. Enqueue virus_scan job
    const workerUtils = await makeWorkerUtils({ connectionString: env.DATABASE_URL });
    try {
      await workerUtils.addJob("virus_scan", {
        documentId,
        s3Key,
        mimetype: "application/pdf",
      });
    } finally {
      await workerUtils.release();
    }

    helpers.logger.info(`DocumentCloud import complete for DC ID ${payload.documentCloudId}`);
  } catch (err) {
    helpers.logger.error(
      `DocumentCloud import failed for DC ID ${payload.documentCloudId}: ${String(err)}`,
    );

    const now = new Date();

    // Update import job: error_count++
    await db
      .updateTable("document_import_jobs" as never)
      .set({
        error_count: db.fn("error_count + 1" as never, [] as never) as never,
        updated_at: now,
      } as never)
      .where("id" as never, "=", payload.importJobId as never)
      .execute();

    // If document row was already created, mark it as processing_failed
    const existingDoc = await db
      .selectFrom("documents" as never)
      .select(["id"] as never[])
      .where("id" as never, "=", documentId as never)
      .executeTakeFirst();

    if (existingDoc) {
      await db
        .updateTable("documents" as never)
        .set({ state: "processing_failed", updated_at: now } as never)
        .where("id" as never, "=", documentId as never)
        .execute();
    }

    throw err;
  }
}
