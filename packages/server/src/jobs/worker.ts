import { run } from "graphile-worker";

import { env } from "../config/env.js";
import { withExecutionLogging } from "./withExecutionLogging.js";

async function main() {
  const runner = await run({
    connectionString: env.DATABASE_URL,
    concurrency: 5,
    noHandleSignals: false,
    pollInterval: 1000,
    taskList: {
      virus_scan: withExecutionLogging((await import("./tasks/virus-scan.js")).virusScan),
      pdf_convert: withExecutionLogging((await import("./tasks/pdf-convert.js")).pdfConvert),
      sieve: withExecutionLogging((await import("./tasks/sieve.js")).sieve),
      extractor: withExecutionLogging((await import("./tasks/extractor.js")).extractor),
      pipeline_complete: withExecutionLogging(
        (await import("./tasks/pipeline-complete.js")).pipelineComplete,
      ),
      cleanup_expired_drafts: (await import("./tasks/cleanup-expired-drafts.js"))
        .cleanupExpiredDrafts,
      documentcloud_import: withExecutionLogging(
        (await import("./tasks/documentcloud-import.js")).documentcloudImport,
      ),
    },
  });

  await runner.promise;
}

main().catch((err) => {
  console.error("Worker crashed:", err);
  process.exit(1);
});
