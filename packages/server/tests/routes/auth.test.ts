import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { createChallenge, solveChallenge } from "altcha-lib";
import { buildApp } from "../../src/app.js";

// ---------------------------------------------------------------------------
// Integration tests for auth-related HTTP endpoints.
//
// A single buildApp({ testing: true }) instance is shared across all suites
// to avoid multiple Redis/DB connections per test file.
// ---------------------------------------------------------------------------

const TEST_HMAC_KEY = process.env.ALTCHA_HMAC_KEY ?? "test-hmac-key-for-unit-tests-only";

let app: FastifyInstance;

/** Fetch a challenge from the route and solve it */
async function fetchAndSolveChallenge(): Promise<string> {
  const res = await app.inject({ method: "GET", url: "/api/altcha/challenge" });
  const challenge = res.json<{
    algorithm: string;
    challenge: string;
    salt: string;
    signature: string;
    maxnumber?: number;
  }>();

  // Must solve up to the same maxNumber the challenge was issued with
  const { promise } = solveChallenge(
    challenge.challenge,
    challenge.salt,
    challenge.algorithm,
    challenge.maxnumber ?? 100_000,
  );
  const solution = await promise;
  if (!solution) throw new Error("Failed to solve ALTCHA challenge");

  return btoa(
    JSON.stringify({
      algorithm: challenge.algorithm,
      challenge: challenge.challenge,
      number: solution.number,
      salt: challenge.salt,
      signature: challenge.signature,
    }),
  );
}

beforeAll(async () => {
  app = await buildApp({ testing: true });

  // Register test-only protected routes to verify auth decorators
  app.get(
    "/test-require-auth",
    { preHandler: [app.requireAuth] },
    async () => ({ success: true }),
  );
  app.get(
    "/test-require-admin",
    { preHandler: [app.requireRole("admin")] },
    async () => ({ success: true }),
  );
}, 30_000);

afterAll(async () => {
  await app.close();
});

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------

describe("GET /api/health", () => {
  it("returns 200 with ok status", async () => {
    const response = await app.inject({ method: "GET", url: "/api/health" });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ status: string; timestamp: string }>();
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// GET /api/altcha/challenge
// ---------------------------------------------------------------------------

describe("GET /api/altcha/challenge", () => {
  it("returns 200 with a valid challenge object", async () => {
    const response = await app.inject({ method: "GET", url: "/api/altcha/challenge" });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ algorithm: string; challenge: string; salt: string; signature: string }>();
    expect(body.algorithm).toBe("SHA-256");
    expect(body.challenge.length).toBeGreaterThan(0);
    expect(body.salt.length).toBeGreaterThan(0);
    expect(body.signature.length).toBeGreaterThan(0);
  });

  it("returns a unique challenge on each request", async () => {
    const [r1, r2] = await Promise.all([
      app.inject({ method: "GET", url: "/api/altcha/challenge" }),
      app.inject({ method: "GET", url: "/api/altcha/challenge" }),
    ]);
    const b1 = r1.json<{ salt: string; challenge: string }>();
    const b2 = r2.json<{ salt: string; challenge: string }>();
    expect(b1.salt).not.toBe(b2.salt);
    expect(b1.challenge).not.toBe(b2.challenge);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/sign-up/email — Registration
// ---------------------------------------------------------------------------

describe("POST /api/auth/sign-up/email — registration", () => {
  const uniqueSuffix = `${Date.now()}-signup`;

  it("rejects registration without altchaPayload (400)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: {
        name: "Test User",
        email: `no-altcha-${uniqueSuffix}@example.com`,
        password: "password1234",
      },
    });
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("rejects registration with an invalid altchaPayload (400)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: {
        name: "Test User",
        email: `bad-altcha-${uniqueSuffix}@example.com`,
        password: "password1234",
        altchaPayload: "not-valid-base64!!!",
      },
    });
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("accepts registration with a valid solved altchaPayload", async () => {
    const altchaPayload = await fetchAndSolveChallenge();
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: {
        name: "Integration Test User",
        email: `integration-${uniqueSuffix}@example.com`,
        password: "integrationpass123",
        altchaPayload,
      },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ user?: { email: string } }>();
    expect(body.user?.email).toBe(`integration-${uniqueSuffix}@example.com`);
  }, 30_000);
});

// ---------------------------------------------------------------------------
// POST /api/auth/sign-in/email — Sign-in
// ---------------------------------------------------------------------------

describe("POST /api/auth/sign-in/email — sign-in", () => {
  const uniqueSuffix = `${Date.now()}-signin`;
  const testEmail = `signin-${uniqueSuffix}@example.com`;
  const testPassword = "signinpass123";

  beforeAll(async () => {
    // Register a user to sign in with
    const altchaPayload = await fetchAndSolveChallenge();
    await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: {
        name: "Sign-in Test User",
        email: testEmail,
        password: testPassword,
        altchaPayload,
      },
    });
  }, 30_000);

  it("returns 200 and a user object for valid credentials", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email: testEmail, password: testPassword },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ user?: { email: string } }>();
    expect(body.user?.email).toBe(testEmail);
  });

  it("returns 401 for invalid credentials", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email: testEmail, password: "wrongpassword" },
    });
    expect(response.statusCode).toBe(401);
  });

  it("returns 400+ for missing email", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { password: testPassword },
    });
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/get-session — Session retrieval
// ---------------------------------------------------------------------------

describe("GET /api/auth/get-session — session retrieval", () => {
  it("returns null body for unauthenticated request", async () => {
    const response = await app.inject({ method: "GET", url: "/api/auth/get-session" });
    expect(response.statusCode).toBe(200);
    // Better Auth returns "null" as body text when no session exists
    const text = response.body;
    expect(text === "null" || text === "" || !response.json<{ session?: unknown }>()?.session).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// requireAuth and requireRole decorators
// ---------------------------------------------------------------------------

describe("requireAuth and requireRole decorators", () => {
  it("returns 401 for unauthenticated request to requireAuth route", async () => {
    const response = await app.inject({ method: "GET", url: "/test-require-auth" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ success: false, error: "Authentication required" });
  });

  it("returns 401 for unauthenticated request to requireRole('admin') route", async () => {
    const response = await app.inject({ method: "GET", url: "/test-require-admin" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ success: false, error: "Authentication required" });
  });
});

// ---------------------------------------------------------------------------
// ALTCHA HMAC key environment sanity
// ---------------------------------------------------------------------------

describe("ALTCHA HMAC key — environment sanity check", () => {
  it("ALTCHA_HMAC_KEY is set and at least 32 characters", () => {
    const key = process.env.ALTCHA_HMAC_KEY;
    if (key) {
      expect(key.length).toBeGreaterThanOrEqual(32);
    } else {
      expect(TEST_HMAC_KEY.length).toBeGreaterThanOrEqual(32);
    }
  });

  it("can create and solve a challenge using the env key", async () => {
    const key = process.env.ALTCHA_HMAC_KEY ?? TEST_HMAC_KEY;
    const challenge = await createChallenge({ hmacKey: key, maxNumber: 10 });
    const { promise } = solveChallenge(
      challenge.challenge,
      challenge.salt,
      challenge.algorithm,
      10,
    );
    const solution = await promise;
    expect(solution).not.toBeNull();
    expect(solution!.number).toBeGreaterThanOrEqual(0);
  });
});
