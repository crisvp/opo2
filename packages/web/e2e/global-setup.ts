import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Parse a .env file and load missing keys into process.env.
 * Only sets keys that are not already set (environment wins).
 */
function loadEnvFile(path: string): void {
  try {
    const content = readFileSync(path, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env absent — rely on process.env (CI injects vars directly)
  }
}

export default async function globalSetup(): Promise<void> {
  // Load root .env so tests can run without pre-exporting variables
  loadEnvFile(resolve(process.cwd(), "../../.env"));

  const endpoint = process.env.S3_ENDPOINT ?? "http://localhost:9000";
  const accessKeyId = process.env.S3_ACCESS_KEY ?? "minioadmin";
  const secretAccessKey = process.env.S3_SECRET_KEY ?? "minioadmin";
  const bucket = process.env.S3_BUCKET ?? "opo-documents";

  const s3 = new S3Client({
    endpoint,
    region: "us-east-1",
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  // Create bucket if it doesn't exist
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`[global-setup] Created S3 bucket: ${bucket}`);
  }

  // Allow browsers to POST directly from the local dev origin.
  // This is required for the presigned-POST E2E flow to work without
  // Playwright intercepting all S3 traffic.
  try {
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: ["http://localhost:5173"],
              AllowedMethods: ["GET", "POST", "PUT", "HEAD", "DELETE"],
              AllowedHeaders: ["*"],
              ExposeHeaders: ["ETag", "Location"],
              MaxAgeSeconds: 3000,
            },
          ],
        },
      }),
    );
    console.log(`[global-setup] CORS policy set on bucket: ${bucket}`);
  } catch (err) {
    // RustFS may not support PutBucketCors; the upload.spec.ts test
    // handles CORS preflights via page.route() as a fallback.
    console.warn(`[global-setup] PutBucketCors not supported, falling back to route intercept:`, err);
  }
}
