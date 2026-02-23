import { describe, it, expect } from "vitest";
import { createChallenge } from "altcha-lib";

// A 32-character test HMAC key — never used in production
const TEST_HMAC_KEY = "test-hmac-key-for-unit-tests-only";

describe("GET /api/altcha/challenge — challenge shape", () => {
  it("createChallenge returns all required fields", async () => {
    const challenge = await createChallenge({
      hmacKey: TEST_HMAC_KEY,
      maxNumber: 100_000,
      expires: new Date(Date.now() + 10 * 60 * 1000),
    });

    expect(typeof challenge.algorithm).toBe("string");
    expect(challenge.algorithm).toBe("SHA-256");
    expect(typeof challenge.challenge).toBe("string");
    expect(challenge.challenge.length).toBeGreaterThan(0);
    expect(typeof challenge.salt).toBe("string");
    expect(challenge.salt.length).toBeGreaterThan(0);
    expect(typeof challenge.signature).toBe("string");
    expect(challenge.signature.length).toBeGreaterThan(0);
  });

  it("challenge is unique on each call", async () => {
    const [a, b] = await Promise.all([
      createChallenge({ hmacKey: TEST_HMAC_KEY, maxNumber: 100_000 }),
      createChallenge({ hmacKey: TEST_HMAC_KEY, maxNumber: 100_000 }),
    ]);

    // Salts should differ (random per call)
    expect(a.salt).not.toBe(b.salt);
    expect(a.challenge).not.toBe(b.challenge);
  });

  it("challenge signed with a different key fails verification", async () => {
    const { verifySolution, solveChallenge } = await import("altcha-lib");

    const challenge = await createChallenge({
      hmacKey: TEST_HMAC_KEY,
      maxNumber: 10, // small so solve is fast
    });

    const { promise } = solveChallenge(
      challenge.challenge,
      challenge.salt,
      challenge.algorithm,
      10,
    );
    const solution = await promise;
    expect(solution).not.toBeNull();

    // Build the base64 payload that verifySolution expects
    const payload = btoa(
      JSON.stringify({
        algorithm: challenge.algorithm,
        challenge: challenge.challenge,
        number: solution!.number,
        salt: challenge.salt,
        signature: challenge.signature,
      }),
    );

    // Verify with correct key — should pass
    const validResult = await verifySolution(payload, TEST_HMAC_KEY, false);
    expect(validResult).toBe(true);

    // Verify with wrong key — should fail
    const wrongResult = await verifySolution(
      payload,
      "wrong-hmac-key-that-is-32-chars!!",
      false,
    );
    expect(wrongResult).toBe(false);
  });
});
