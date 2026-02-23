export const TASK_TIMEOUTS: Record<string, number> = {
  virus_scan: 2 * 60_000,
  pdf_convert: 5 * 60_000,
  sieve: 3 * 60_000,
  extractor: 10 * 60_000,
  pipeline_complete: 30_000,
  cleanup_expired_drafts: 5 * 60_000,
  documentcloud_import: 10 * 60_000,
};

export const DRAFT_EXPIRY_DAYS = 14;
export const PENDING_UPLOAD_EXPIRY_HOURS = 1;
export const CLEANUP_SCHEDULE = "0 * * * *"; // Every hour
