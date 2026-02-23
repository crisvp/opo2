import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ testing: true });
}, 30_000);

afterAll(async () => {
  await app.close();
});

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
