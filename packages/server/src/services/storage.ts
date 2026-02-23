import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";
import { buffer } from "node:stream/consumers";

import { env } from "../config/env.js";
import { s3Client } from "../util/s3-client.js";

export async function createPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 3600,
): Promise<{ url: string; fields: Record<string, string> }> {
  const { url, fields } = await createPresignedPost(s3Client, {
    Bucket: env.S3_BUCKET,
    Key: key,
    Conditions: [
      ["content-length-range", 1, 50 * 1024 * 1024],
      ["eq", "$Content-Type", contentType],
    ],
    Fields: {
      "Content-Type": contentType,
    },
    Expires: expiresInSeconds,
  });
  return { url, fields };
}

export async function headObject(
  key: string,
): Promise<{ contentLength: number; contentType: string } | null> {
  try {
    const result = await s3Client.send(
      new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
    );
    return {
      contentLength: result.ContentLength ?? 0,
      contentType: result.ContentType ?? "",
    };
  } catch {
    return null;
  }
}

export async function getObjectStream(key: string): Promise<Readable> {
  const result = await s3Client.send(
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
  );
  return result.Body as Readable;
}

export async function deleteObject(key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}

export async function getPresignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

export async function getFileAsDataUrl(key: string, mimeType = "application/pdf"): Promise<string> {
  const stream = await getObjectStream(key);
  const buf = await buffer(stream);
  return `data:${mimeType};base64,${buf.toString("base64")}`;
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  await s3Client.send(
    new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: contentType }),
  );
}
