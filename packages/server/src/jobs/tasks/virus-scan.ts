import * as net from "node:net";
import type { JobHelpers } from "graphile-worker";
import { makeWorkerUtils } from "graphile-worker";
import { z } from "zod";

import { env } from "../../config/env.js";
import { TASK_TIMEOUTS } from "../../config/processing.js";
import { getObjectStream } from "../../services/storage.js";
import { getDb } from "../../util/db.js";

export interface VirusScanPayload {
  documentId: string;
  s3Key: string;
  mimetype: string;
}

const virusScanPayloadSchema = z.object({
  documentId: z.string(),
  s3Key: z.string(),
  mimetype: z.string(),
});

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks);
}

async function scanWithClamAV(buffer: Buffer, host: string, port: number): Promise<{ clean: boolean; details: string }> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      // Send INSTREAM command
      socket.write("nINSTREAM\n");

      const CHUNK_SIZE = 8192;
      let offset = 0;

      function sendNextChunk() {
        if (offset >= buffer.length) {
          // Send zero-length chunk to signal end
          const endChunk = Buffer.alloc(4);
          endChunk.writeUInt32BE(0, 0);
          socket.write(endChunk);
          return;
        }
        const end = Math.min(offset + CHUNK_SIZE, buffer.length);
        const chunk = buffer.slice(offset, end);
        const lenBuf = Buffer.allocUnsafe(4);
        lenBuf.writeUInt32BE(chunk.length, 0);
        socket.write(lenBuf);
        socket.write(chunk, () => {
          offset = end;
          sendNextChunk();
        });
      }

      sendNextChunk();
    });

    let response = "";
    socket.on("data", (data: Buffer) => {
      response += data.toString();
    });

    socket.on("end", () => {
      const trimmed = response.trim();
      if (trimmed.includes("OK")) {
        resolve({ clean: true, details: trimmed });
      } else if (trimmed.includes("FOUND")) {
        resolve({ clean: false, details: trimmed });
      } else {
        resolve({ clean: false, details: `Unknown ClamAV response: ${trimmed}` });
      }
    });

    socket.on("error", (err: Error) => {
      reject(err);
    });

    socket.setTimeout(30_000, () => {
      socket.destroy();
      reject(new Error("ClamAV connection timed out"));
    });
  });
}

export async function virusScan(rawPayload: unknown, helpers: JobHelpers): Promise<void> {
  void TASK_TIMEOUTS;
  const payload: VirusScanPayload = virusScanPayloadSchema.parse(rawPayload);
  const { documentId, s3Key, mimetype } = payload;

  helpers.logger.info(`Starting virus scan for document ${documentId}`);

  const db = getDb(process.env.DATABASE_URL!);

  // Transition to processing state
  await db
    .updateTable("documents")
    .set({ state: "processing", processing_started_at: new Date() })
    .where("id", "=", documentId)
    .execute();

  let fileBuffer: Buffer;
  try {
    const stream = await getObjectStream(s3Key);
    fileBuffer = await streamToBuffer(stream);
  } catch (err) {
    helpers.logger.error(`Failed to download file from S3 for document ${documentId}: ${err}`);
    await db
      .updateTable("documents")
      .set({ state: "processing_failed" })
      .where("id", "=", documentId)
      .execute();
    throw err;
  }

  let scanResult: { clean: boolean; details: string };
  try {
    const clamdHost = env.CLAMAV_HOST;
    const clamdPort = env.CLAMAV_PORT;
    scanResult = await scanWithClamAV(fileBuffer, clamdHost, clamdPort);
  } catch (err) {
    helpers.logger.error(`ClamAV scan failed for document ${documentId}: ${err}`);
    await db
      .updateTable("documents")
      .set({ state: "processing_failed" })
      .where("id", "=", documentId)
      .execute();
    throw err;
  }

  // Upsert processing results
  const scanFields = {
    virus_scan_passed: scanResult.clean,
    virus_scan_details: scanResult.details,
    virus_scan_completed_at: new Date(),
  };

  await db
    .insertInto("document_processing_results")
    .values({ document_id: documentId, ...scanFields })
    .onConflict((oc) =>
      oc.column("document_id").doUpdateSet(scanFields),
    )
    .execute();

  if (!scanResult.clean) {
    helpers.logger.warn(`Virus detected in document ${documentId}: ${scanResult.details}`);
    await db
      .updateTable("documents")
      .set({ state: "processing_failed" })
      .where("id", "=", documentId)
      .execute();
    return;
  }

  helpers.logger.info(`Virus scan passed for document ${documentId}, enqueueing pdf_convert`);

  const workerUtils = await makeWorkerUtils({ connectionString: process.env.DATABASE_URL! });
  try {
    await workerUtils.addJob("pdf_convert", { documentId, s3Key, mimetype });
  } finally {
    await workerUtils.release();
  }
}
