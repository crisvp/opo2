import type { JobHelpers } from "graphile-worker";
import { Pool } from "pg";

import { TASK_TIMEOUTS } from "../../config/processing.js";
import { deleteObject } from "../../services/storage.js";

export async function cleanupExpiredDrafts(_payload: unknown, helpers: JobHelpers): Promise<void> {
  helpers.logger.info("Starting expired draft cleanup");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  let expiredRows: Array<{ id: string; filepath: string | null }> = [];
  let draftRows: Array<{ id: string; filepath: string | null }> = [];

  try {
    // Delete pending_upload documents older than 1 hour
    const r1 = await client.query<{ id: string; filepath: string | null }>(`
      DELETE FROM documents
      WHERE state = 'pending_upload'
      AND created_at < NOW() - INTERVAL '1 hour'
      RETURNING id, filepath
    `);
    expiredRows = r1.rows;
    helpers.logger.info(`Cleaned up ${r1.rowCount} expired pending uploads`);

    // Delete draft documents older than 14 days
    const r2 = await client.query<{ id: string; filepath: string | null }>(`
      DELETE FROM documents
      WHERE state = 'draft'
      AND created_at < NOW() - INTERVAL '14 days'
      RETURNING id, filepath
    `);
    draftRows = r2.rows;
    helpers.logger.info(`Cleaned up ${r2.rowCount} expired drafts`);
  } finally {
    client.release();
    await pool.end();
  }

  // Delete S3 objects for all deleted documents
  const allRows = [...expiredRows, ...draftRows];
  for (const row of allRows) {
    if (row.filepath) {
      try {
        await deleteObject(row.filepath);
        helpers.logger.info(`Deleted S3 object: ${row.filepath}`);
      } catch (err) {
        helpers.logger.warn(`Failed to delete S3 object ${row.filepath}: ${String(err)}`);
      }
    }
  }

  // Reference TASK_TIMEOUTS to satisfy the import
  void TASK_TIMEOUTS;
}
