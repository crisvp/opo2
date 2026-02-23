import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { env } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const HKDF_SALT = "opo-api-key-encryption";

/**
 * Derive a 32-byte AES key from the encryption secret using HKDF-SHA256.
 * Never uses the raw env var directly.
 */
async function deriveKey(): Promise<Buffer> {
  // Node 20+ has built-in crypto.hkdf
  const { hkdf } = await import("node:crypto");
  return new Promise((resolve, reject) => {
    hkdf(
      "sha256",
      Buffer.from(env.API_KEY_ENCRYPTION_SECRET, "utf8"),
      Buffer.from(HKDF_SALT, "utf8"),
      Buffer.alloc(0),
      32,
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(Buffer.from(derivedKey));
      },
    );
  });
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns base64(iv || authTag || ciphertext)
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypt AES-256-GCM ciphertext.
 * Input: base64(iv || authTag || ciphertext)
 */
export async function decrypt(encryptedBase64: string): Promise<string> {
  const key = await deriveKey();
  const combined = Buffer.from(encryptedBase64, "base64");

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  return decipher.update(ciphertext) + decipher.final("utf8");
}

/**
 * SHA-256 hash of plaintext for existence checks without decryption.
 */
export function hashKey(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}
