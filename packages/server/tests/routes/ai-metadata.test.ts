import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";

describe("AI Metadata API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // GET /api/documents/:id/ai-metadata
  // ---------------------------------------------------------------------------

  describe("GET /api/documents/:id/ai-metadata", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/documents/some-id/ai-metadata",
      });

      expect(response.statusCode).toBe(401);
      const body = response.json() as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/documents/:id/submit-for-moderation
  // ---------------------------------------------------------------------------

  describe("POST /api/documents/:id/submit-for-moderation", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/documents/some-id/submit-for-moderation",
      });

      expect(response.statusCode).toBe(401);
      const body = response.json() as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/documents/:id/retry-extraction
  // ---------------------------------------------------------------------------

  describe("POST /api/documents/:id/retry-extraction", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/documents/some-id/retry-extraction",
      });

      expect(response.statusCode).toBe(401);
      const body = response.json() as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/documents/:id/admin-rerun-extraction
  // ---------------------------------------------------------------------------

  describe("POST /api/documents/:id/admin-rerun-extraction", () => {
    it("returns 403 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/documents/some-id/admin-rerun-extraction",
      });

      expect(response.statusCode).toBe(403);
      const body = response.json() as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/documents/:id/associations
  // ---------------------------------------------------------------------------

  describe("POST /api/documents/:id/associations", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/documents/some-id/associations",
        payload: { associations: [] },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json() as { success: boolean };
      expect(body.success).toBe(false);
    });
  });
});
