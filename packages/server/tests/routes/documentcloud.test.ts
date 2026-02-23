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
// GET /api/documentcloud/status
// ---------------------------------------------------------------------------

describe("GET /api/documentcloud/status", () => {
  it("returns 401 for unauthenticated requests", async () => {
    const res = await app.inject({ method: "GET", url: "/api/documentcloud/status" });
    expect(res.statusCode).toBe(401);
    const body = res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
  });

  it("does not return 501 (stub is replaced)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/documentcloud/status" });
    expect(res.statusCode).not.toBe(501);
  });
});

// ---------------------------------------------------------------------------
// GET /api/documentcloud/search
// ---------------------------------------------------------------------------

describe("GET /api/documentcloud/search", () => {
  it("returns 401 for unauthenticated requests", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/documentcloud/search?q=surveillance",
    });
    expect(res.statusCode).toBe(401);
    const body = res.json() as { success: boolean };
    expect(body.success).toBe(false);
  });

  it("returns 400 when q param is missing and no auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/documentcloud/search" });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("does not return 501 (stub is replaced)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/documentcloud/search?q=test",
    });
    expect(res.statusCode).not.toBe(501);
  });
});

// ---------------------------------------------------------------------------
// POST /api/documentcloud/import
// ---------------------------------------------------------------------------

describe("POST /api/documentcloud/import", () => {
  it("returns 401 for unauthenticated requests", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documentcloud/import",
      payload: { documentCloudId: 12345 },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json() as { success: boolean };
    expect(body.success).toBe(false);
  });

  it("does not return 501 (stub is replaced)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documentcloud/import",
      payload: { documentCloudId: 12345 },
    });
    expect(res.statusCode).not.toBe(501);
  });
});

// ---------------------------------------------------------------------------
// POST /api/documentcloud/import/batch
// ---------------------------------------------------------------------------

describe("POST /api/documentcloud/import/batch", () => {
  it("returns 401 for unauthenticated requests", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documentcloud/import/batch",
      payload: { documentCloudIds: [12345, 67890] },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json() as { success: boolean };
    expect(body.success).toBe(false);
  });

  it("does not return 501 (stub is replaced)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documentcloud/import/batch",
      payload: { documentCloudIds: [12345] },
    });
    expect(res.statusCode).not.toBe(501);
  });
});

// ---------------------------------------------------------------------------
// GET /api/documentcloud/import/:jobId
// ---------------------------------------------------------------------------

describe("GET /api/documentcloud/import/:jobId", () => {
  it("returns 401 for unauthenticated requests", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/documentcloud/import/some-job-id",
    });
    expect(res.statusCode).toBe(401);
  });

  it("does not return 501 (stub is replaced)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/documentcloud/import/some-job-id",
    });
    expect(res.statusCode).not.toBe(501);
  });
});

// ---------------------------------------------------------------------------
// GET /api/documentcloud/jobs
// ---------------------------------------------------------------------------

describe("GET /api/documentcloud/jobs", () => {
  it("returns 401 for unauthenticated requests", async () => {
    const res = await app.inject({ method: "GET", url: "/api/documentcloud/jobs" });
    expect(res.statusCode).toBe(401);
    const body = res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe("Authentication required");
  });

  it("does not return 501 (stub is replaced)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/documentcloud/jobs" });
    expect(res.statusCode).not.toBe(501);
  });
});
