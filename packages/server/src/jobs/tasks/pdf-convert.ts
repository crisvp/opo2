import type { JobHelpers } from "graphile-worker";
import { makeWorkerUtils } from "graphile-worker";
import { z } from "zod";

import { TASK_TIMEOUTS } from "../../config/processing.js";
import { convertToPdf } from "../../services/libreoffice.js";
import { getObjectStream, putObject } from "../../services/storage.js";
import { getDb } from "../../util/db.js";

export interface PdfConvertPayload {
  documentId: string;
  s3Key: string;
  mimetype: string;
}

const pdfConvertPayloadSchema = z.object({
  documentId: z.string(),
  s3Key: z.string(),
  mimetype: z.string(),
});

const CONVERSION_REQUIRED_MIMETYPES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

function needsConversion(mimetype: string): boolean {
  return CONVERSION_REQUIRED_MIMETYPES.has(mimetype);
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks);
}

export async function pdfConvert(rawPayload: unknown, helpers: JobHelpers): Promise<void> {
  void TASK_TIMEOUTS;
  const payload: PdfConvertPayload = pdfConvertPayloadSchema.parse(rawPayload);
  const { documentId, s3Key, mimetype } = payload;

  helpers.logger.info(`Starting PDF conversion check for document ${documentId}, mimetype=${mimetype}`);

  const db = getDb(process.env.DATABASE_URL!);

  try {
    let finalS3Key: string;
    let conversionPerformed = false;
    let convertedFilepath: string | null = null;

    if (!needsConversion(mimetype)) {
      helpers.logger.info(`No conversion needed for document ${documentId} (mimetype=${mimetype})`);
      finalS3Key = s3Key;
    } else {
      helpers.logger.info(`Converting document ${documentId} to PDF`);

      const stream = await getObjectStream(s3Key);
      const inputBuffer = await streamToBuffer(stream);

      const filename = s3Key.split("/").pop() ?? "document";
      const pdfBuffer = await convertToPdf(inputBuffer, filename);

      const convertedKey = `documents/${documentId}/converted.pdf`;
      await putObject(convertedKey, pdfBuffer, "application/pdf");

      finalS3Key = convertedKey;
      conversionPerformed = true;
      convertedFilepath = convertedKey;

      helpers.logger.info(`PDF conversion complete for document ${documentId}, uploaded to ${convertedKey}`);
    }

    const conversionFields = {
      conversion_performed: conversionPerformed,
      original_mimetype: mimetype,
      converted_filepath: convertedFilepath,
      conversion_completed_at: new Date(),
    };

    await db
      .insertInto("document_processing_results")
      .values({ document_id: documentId, ...conversionFields })
      .onConflict((oc) =>
        oc.column("document_id").doUpdateSet(conversionFields),
      )
      .execute();

    const workerUtils = await makeWorkerUtils({ connectionString: process.env.DATABASE_URL! });
    try {
      await workerUtils.addJob("sieve", { documentId, s3Key: finalS3Key });
    } finally {
      await workerUtils.release();
    }

    helpers.logger.info(`PDF convert complete for document ${documentId}, enqueueing sieve`);
  } catch (err) {
    helpers.logger.error(`PDF conversion failed for document ${documentId}: ${err}`);
    await db
      .updateTable("documents")
      .set({ state: "processing_failed" })
      .where("id", "=", documentId)
      .execute();
    throw err;
  }
}
