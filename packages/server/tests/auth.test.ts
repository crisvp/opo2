import { describe, it, expect } from "vitest";
import { createChallenge, verifySolution, solveChallenge } from "altcha-lib";
import { hasRole, ROLES } from "@opo/shared";

// A 32-character test HMAC key — never used in production
const TEST_HMAC_KEY = "test-hmac-key-for-unit-tests-only";

// ---------------------------------------------------------------------------
// Role-based authorization helpers
// ---------------------------------------------------------------------------

describe("hasRole — authorization checks", () => {
  it("admin satisfies admin requirement", () => {
    expect(hasRole(ROLES.ADMIN, ROLES.ADMIN)).toBe(true);
  });

  it("admin satisfies moderator requirement", () => {
    expect(hasRole(ROLES.ADMIN, ROLES.MODERATOR)).toBe(true);
  });

  it("admin satisfies user requirement", () => {
    expect(hasRole(ROLES.ADMIN, ROLES.USER)).toBe(true);
  });

  it("moderator does not satisfy admin requirement", () => {
    expect(hasRole(ROLES.MODERATOR, ROLES.ADMIN)).toBe(false);
  });

  it("moderator satisfies moderator requirement", () => {
    expect(hasRole(ROLES.MODERATOR, ROLES.MODERATOR)).toBe(true);
  });

  it("moderator satisfies user requirement", () => {
    expect(hasRole(ROLES.MODERATOR, ROLES.USER)).toBe(true);
  });

  it("user does not satisfy admin requirement", () => {
    expect(hasRole(ROLES.USER, ROLES.ADMIN)).toBe(false);
  });

  it("user does not satisfy moderator requirement", () => {
    expect(hasRole(ROLES.USER, ROLES.MODERATOR)).toBe(false);
  });

  it("user satisfies user requirement", () => {
    expect(hasRole(ROLES.USER, ROLES.USER)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ALTCHA verification logic (mirrors what the sign-up hook will do)
// ---------------------------------------------------------------------------

/**
 * Simulates the server-side ALTCHA verification that will run inside the
 * Better Auth databaseHooks.user.create.before hook during registration.
 *
 * The hook receives an altchaPayload (base64-encoded JSON) supplied by the
 * client as an additional field.  It verifies the payload against the server's
 * HMAC key and rejects the request if verification fails.
 */
async function verifyAltchaPayload(
  altchaPayload: string,
  hmacKey: string,
): Promise<boolean> {
  return verifySolution(altchaPayload, hmacKey, false);
}

describe("ALTCHA verification — registration hook logic", () => {
  it("accepts a valid solved payload", async () => {
    const challenge = await createChallenge({
      hmacKey: TEST_HMAC_KEY,
      maxNumber: 10,
    });

    const { promise } = solveChallenge(
      challenge.challenge,
      challenge.salt,
      challenge.algorithm,
      10,
    );
    const solution = await promise;
    expect(solution).not.toBeNull();

    const payload = btoa(
      JSON.stringify({
        algorithm: challenge.algorithm,
        challenge: challenge.challenge,
        number: solution!.number,
        salt: challenge.salt,
        signature: challenge.signature,
      }),
    );

    const result = await verifyAltchaPayload(payload, TEST_HMAC_KEY);
    expect(result).toBe(true);
  });

  it("rejects a payload signed with the wrong key", async () => {
    const challenge = await createChallenge({
      hmacKey: TEST_HMAC_KEY,
      maxNumber: 10,
    });

    const { promise } = solveChallenge(
      challenge.challenge,
      challenge.salt,
      challenge.algorithm,
      10,
    );
    const solution = await promise;
    expect(solution).not.toBeNull();

    const payload = btoa(
      JSON.stringify({
        algorithm: challenge.algorithm,
        challenge: challenge.challenge,
        number: solution!.number,
        salt: challenge.salt,
        signature: challenge.signature,
      }),
    );

    // Verify with a different key — must reject
    const result = await verifyAltchaPayload(
      payload,
      "wrong-hmac-key-that-is-32-chars!!",
    );
    expect(result).toBe(false);
  });

  it("rejects a tampered payload (wrong number)", async () => {
    const challenge = await createChallenge({
      hmacKey: TEST_HMAC_KEY,
      maxNumber: 10,
    });

    const payload = btoa(
      JSON.stringify({
        algorithm: challenge.algorithm,
        challenge: challenge.challenge,
        number: 99999, // deliberate wrong answer
        salt: challenge.salt,
        signature: challenge.signature,
      }),
    );

    const result = await verifyAltchaPayload(payload, TEST_HMAC_KEY);
    expect(result).toBe(false);
  });

  it("returns false for an empty payload string", async () => {
    const result = await verifyAltchaPayload("", TEST_HMAC_KEY);
    expect(result).toBe(false);
  });

  it("returns false for a malformed base64 payload", async () => {
    const result = await verifyAltchaPayload("not-valid-base64!!!", TEST_HMAC_KEY);
    expect(result).toBe(false);
  });
});
