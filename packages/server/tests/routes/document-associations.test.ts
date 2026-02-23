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
// GET /api/documents/:id/related
// ---------------------------------------------------------------------------

describe("GET /api/documents/:id/related", () => {
  it("returns 404 for a non-existent public document id", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/documents/nonexistent-doc-id/related",
    });
    // Either 404 (not found) or 401 (auth required for non-public) are acceptable
    expect([401, 404]).toContain(res.statusCode);
  });

  it("does not return 501 (stub is replaced)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/documents/nonexistent-doc-id/related",
    });
    expect(res.statusCode).not.toBe(501);
  });
});

// ---------------------------------------------------------------------------
// POST /api/documents/:id/related
// ---------------------------------------------------------------------------

describe("POST /api/documents/:id/related", () => {
  it("returns 401 for unauthenticated requests", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documents/some-doc-id/related",
      payload: {
        targetDocumentId: "other-doc-id",
        associationTypeId: "some-type-id",
      },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json() as { success: boolean };
    expect(body.success).toBe(false);
  });

  it("does not return 501 (stub is replaced)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documents/some-doc-id/related",
      payload: {
        targetDocumentId: "other-doc-id",
        associationTypeId: "some-type-id",
      },
    });
    expect(res.statusCode).not.toBe(501);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/document-associations/:id
// ---------------------------------------------------------------------------

describe("DELETE /api/document-associations/:id", () => {
  it("returns 401 for unauthenticated requests", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/document-associations/some-assoc-id",
    });
    expect(res.statusCode).toBe(401);
    const body = res.json() as { success: boolean };
    expect(body.success).toBe(false);
  });

  it("does not return 501 (stub is replaced)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/document-associations/some-assoc-id",
    });
    expect(res.statusCode).not.toBe(501);
  });
});
