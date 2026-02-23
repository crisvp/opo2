import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
} from "@aws-sdk/client-s3";
import { env } from "../config/env.js";
import { s3Client } from "./s3-client.js";

/**
 * Ensures the configured S3 bucket exists, creating it if necessary.
 * Also sets a permissive CORS policy so browsers can POST presigned uploads directly.
 * Called once at server startup (skipped in test mode).
 */
export async function ensureBucket(): Promise<void> {
  const bucket = env.S3_BUCKET;

  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await s3Client.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`[startup] Created S3 bucket: ${bucket}`);
  }

  // Allow browsers to POST presigned uploads from any trusted origin.
  // The presigned URL signature already provides the real security boundary.
  try {
    await s3Client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: env.TRUSTED_ORIGINS,
              AllowedMethods: ["GET", "POST", "PUT", "HEAD", "DELETE"],
              AllowedHeaders: ["*"],
              ExposeHeaders: ["ETag", "Location"],
              MaxAgeSeconds: 3000,
            },
          ],
        },
      }),
    );
  } catch {
    // RustFS may not support PutBucketCors — uploads still work via presigned POST
    console.warn(`[startup] PutBucketCors not supported on bucket ${bucket}; skipping CORS setup`);
  }
}
