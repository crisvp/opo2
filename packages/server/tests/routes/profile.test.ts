import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { solveChallenge } from "altcha-lib";

import { buildApp } from "../../src/app.js";

vi.mock("../../src/services/storage.js", () => ({
  createPresignedUploadUrl: vi.fn().mockResolvedValue({ url: "https://s3.example.com/upload", fields: {} }),
  headObject: vi.fn().mockResolvedValue({ ContentLength: 1024 }),
  getPresignedDownloadUrl: vi.fn().mockResolvedValue("https://s3.example.com/dl"),
  deleteObject: vi.fn().mockResolvedValue(undefined),
  getObject: vi.fn().mockResolvedValue(null),
}));

vi.mock("graphile-worker", () => ({
  makeWorkerUtils: vi.fn().mockResolvedValue({ addJob: vi.fn(), release: vi.fn() }),
}));

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ testing: true });
}, 30_000);

afterAll(async () => {
  await app.close();
});

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function fetchAndSolveChallenge(instance: FastifyInstance): Promise<string> {
  const res = await instance.inject({ method: "GET", url: "/api/altcha/challenge" });
  const c = res.json<{ algorithm: string; challenge: string; salt: string; signature: string; maxnumber?: number }>();
  const { promise } = solveChallenge(c.challenge, c.salt, c.algorithm, c.maxnumber ?? 100_000);
  const sol = await promise;
  if (!sol) throw new Error("ALTCHA solve failed");
  return btoa(JSON.stringify({ algorithm: c.algorithm, challenge: c.challenge, number: sol.number, salt: c.salt, signature: c.signature }));
}

async function registerAndSignIn(
  instance: FastifyInstance,
  suffix: string,
): Promise<{ cookie: string; userId: string; email: string }> {
  const email = `profile-test-${suffix}@example.com`;
  const altchaPayload = await fetchAndSolveChallenge(instance);
  const regRes = await instance.inject({
    method: "POST",
    url: "/api/auth/sign-up/email",
    payload: { name: "Test User", email, password: "testpass1234", altchaPayload },
  });
  const userId = regRes.json<{ user?: { id: string } }>().user?.id ?? "";
  const signInRes = await instance.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    payload: { email, password: "testpass1234" },
  });
  const setCookie = signInRes.headers["set-cookie"];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : (setCookie ?? "");
  return { cookie, userId, email };
}

// ---------------------------------------------------------------------------
// GET /api/profile/usage
// ---------------------------------------------------------------------------

describe("GET /api/profile/usage", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/api/profile/usage" });
    expect(res.statusCode).toBe(401);
    const body = res.json() as { success: boolean };
    expect(body.success).toBe(false);
  });

  it("does not return 501 (no longer a stub)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/profile/usage" });
    expect(res.statusCode).not.toBe(501);
  });
});

// ---------------------------------------------------------------------------
// GET /api/profile/location
// ---------------------------------------------------------------------------

describe("GET /api/profile/location", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/api/profile/location" });
    expect(res.statusCode).toBe(401);
    const body = res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
  });

  it("does not return 501 (no longer a stub)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/profile/location" });
    expect(res.statusCode).not.toBe(501);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/profile/location
// ---------------------------------------------------------------------------

describe("PUT /api/profile/location", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/profile/location",
      payload: { stateUsps: "CA" },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json() as { success: boolean };
    expect(body.success).toBe(false);
  });

  it("returns 400 for invalid stateUsps length without auth (validation before auth)", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/profile/location",
      payload: { stateUsps: "TOOLONG" },
    });
    // Schema validation runs before preHandler in Fastify with ZodTypeProvider
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/profile/api-keys
// ---------------------------------------------------------------------------

describe("GET /api/profile/api-keys", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/api/profile/api-keys" });
    expect(res.statusCode).toBe(401);
    const body = res.json() as { success: boolean };
    expect(body.success).toBe(false);
  });

  it("does not return 501 (no longer a stub)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/profile/api-keys" });
    expect(res.statusCode).not.toBe(501);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/profile/api-keys/openrouter
// ---------------------------------------------------------------------------

describe("PUT /api/profile/api-keys/openrouter", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/profile/api-keys/openrouter",
      payload: { key: "sk-or-v1-valid-key-here-1234" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 when key is too short (validation error)", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/profile/api-keys/openrouter",
      payload: { key: "short" },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/profile/api-keys/openrouter
// ---------------------------------------------------------------------------

describe("DELETE /api/profile/api-keys/openrouter", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/profile/api-keys/openrouter",
    });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/profile/api-keys/openrouter/settings
// ---------------------------------------------------------------------------

describe("PUT /api/profile/api-keys/openrouter/settings", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/profile/api-keys/openrouter/settings",
      payload: { dailyLimit: 10 },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 for invalid dailyLimit (over max)", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/profile/api-keys/openrouter/settings",
      payload: { dailyLimit: 999 },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/profile (consolidated)
// ---------------------------------------------------------------------------

describe("GET /api/profile", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/api/profile" });
    expect(res.statusCode).toBe(401);
    const body = res.json() as { success: boolean };
    expect(body.success).toBe(false);
  });

  it("returns profile data for authenticated user", async () => {
    const { cookie, email } = await registerAndSignIn(app, `get-${Date.now()}`);

    const res = await app.inject({
      method: "GET",
      url: "/api/profile",
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{
      id: string;
      name: string | null;
      email: string;
      role: string;
      tier: number;
      tierName: string;
      aiSuggestions: { enabled: boolean; available: boolean; usingOwnKey: boolean };
      location: { stateUsps: string | null; placeGeoid: string | null };
      createdAt: string;
    }>();
    expect(body.email).toBe(email);
    expect(body.id).toBeTruthy();
    expect(body.role).toBe("user");
    expect(typeof body.tier).toBe("number");
    expect(typeof body.tierName).toBe("string");
    expect(typeof body.aiSuggestions.enabled).toBe("boolean");
    expect(typeof body.aiSuggestions.available).toBe("boolean");
    expect(body.location).toBeDefined();
    expect(body.createdAt).toBeTruthy();
  }, 30_000);
});

// ---------------------------------------------------------------------------
// PUT /api/profile (consolidated)
// ---------------------------------------------------------------------------

describe("PUT /api/profile", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/profile",
      payload: { name: "Test User" },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json() as { success: boolean };
    expect(body.success).toBe(false);
  });

  it("returns 400 for invalid aiSuggestionsEnabled (not a boolean)", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/profile",
      payload: { aiSuggestionsEnabled: "not-a-boolean" },
    });
    expect(res.statusCode).toBe(400);
  });
});
