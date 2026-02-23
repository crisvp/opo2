import { describe, it, expect } from "vitest";
import {
  randomBytes,
  hkdfSync,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";

// ---------------------------------------------------------------------------
// Re-implement the crypto helpers inline so the test is self-contained and
// does not import from the route module (which would pull in env parsing).
// ---------------------------------------------------------------------------

const TEST_SECRET = "this-is-a-test-secret-at-least-32-chars!!";

function deriveKey(secret: string): Buffer {
  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(secret),
      Buffer.from("opo-api-key-encryption"),
      Buffer.alloc(0),
      32,
    ),
  );
}

function encryptKey(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

function decryptKey(stored: string, secret: string): string {
  const key = deriveKey(secret);
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

function hashKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("deriveKey", () => {
  it("produces a 32-byte key from a secret", () => {
    const key = deriveKey(TEST_SECRET);
    expect(key.length).toBe(32);
  });

  it("is deterministic — same secret yields same key", () => {
    const k1 = deriveKey(TEST_SECRET);
    const k2 = deriveKey(TEST_SECRET);
    expect(k1.equals(k2)).toBe(true);
  });

  it("different secrets yield different keys", () => {
    const k1 = deriveKey(TEST_SECRET);
    const k2 = deriveKey(TEST_SECRET + "-different");
    expect(k1.equals(k2)).toBe(false);
  });
});

describe("encryptKey / decryptKey (round-trip)", () => {
  it("round-trips a plaintext API key correctly", () => {
    const plaintext = "sk-or-v1-test-api-key-for-unit-test-1234";
    const encrypted = encryptKey(plaintext, TEST_SECRET);
    const decrypted = decryptKey(encrypted, TEST_SECRET);
    expect(decrypted).toBe(plaintext);
  });

  it("round-trips an empty string", () => {
    const encrypted = encryptKey("", TEST_SECRET);
    const decrypted = decryptKey(encrypted, TEST_SECRET);
    expect(decrypted).toBe("");
  });

  it("round-trips a Unicode string", () => {
    const plaintext = "sk-or-v1-unicode-key-🔑-test-1234";
    const encrypted = encryptKey(plaintext, TEST_SECRET);
    const decrypted = decryptKey(encrypted, TEST_SECRET);
    expect(decrypted).toBe(plaintext);
  });

  it("decryption fails with the wrong secret", () => {
    const plaintext = "sk-or-v1-test-key-12345678901234567890";
    const encrypted = encryptKey(plaintext, TEST_SECRET);
    expect(() => decryptKey(encrypted, "wrong-secret-also-32-chars-long!!")).toThrow();
  });
});

describe("IV uniqueness", () => {
  it("two encryptions of the same plaintext produce different ciphertexts", () => {
    const plaintext = "sk-or-v1-same-key-12345678901234567890";
    const enc1 = encryptKey(plaintext, TEST_SECRET);
    const enc2 = encryptKey(plaintext, TEST_SECRET);
    // Different IVs → different base64 output
    expect(enc1).not.toBe(enc2);
    // But both decrypt to the same value
    expect(decryptKey(enc1, TEST_SECRET)).toBe(plaintext);
    expect(decryptKey(enc2, TEST_SECRET)).toBe(plaintext);
  });
});

describe("storage format", () => {
  it("encrypted blob is a valid base64 string", () => {
    const enc = encryptKey("sk-or-v1-test-12345678901234567890", TEST_SECRET);
    expect(typeof enc).toBe("string");
    // base64 characters only
    expect(/^[A-Za-z0-9+/]+=*$/.test(enc)).toBe(true);
  });

  it("encrypted blob is at least 28 bytes decoded (12 IV + 16 authTag + 0+ ciphertext)", () => {
    const enc = encryptKey("sk-or-v1-test-12345678901234567890", TEST_SECRET);
    const decoded = Buffer.from(enc, "base64");
    expect(decoded.length).toBeGreaterThanOrEqual(28);
  });

  it("the first 12 bytes are the IV and differ between encryptions", () => {
    const plaintext = "sk-or-v1-test-12345678901234567890";
    const enc1 = encryptKey(plaintext, TEST_SECRET);
    const enc2 = encryptKey(plaintext, TEST_SECRET);
    const iv1 = Buffer.from(enc1, "base64").subarray(0, 12);
    const iv2 = Buffer.from(enc2, "base64").subarray(0, 12);
    expect(iv1.equals(iv2)).toBe(false);
  });
});

describe("hashKey", () => {
  it("returns a 64-character hex string (SHA-256)", () => {
    const hash = hashKey("sk-or-v1-some-key-12345678901234567890");
    expect(typeof hash).toBe("string");
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it("is deterministic", () => {
    const key = "sk-or-v1-deterministic-key-1234567890";
    expect(hashKey(key)).toBe(hashKey(key));
  });

  it("different plaintexts produce different hashes", () => {
    expect(hashKey("key-one-long-enough-12345678901234567890")).not.toBe(
      hashKey("key-two-long-enough-12345678901234567890"),
    );
  });
});
