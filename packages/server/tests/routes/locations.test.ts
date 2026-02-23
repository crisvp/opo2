import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";

describe("Locations API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // GET /api/locations/states
  // ---------------------------------------------------------------------------

  describe("GET /api/locations/states", () => {
    it("returns 200 with an array", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/locations/states",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { success: boolean; data: unknown[] };
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("items have usps, name, isTerritory fields when present", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/locations/states",
      });

      const body = response.json() as { success: boolean; data: Array<Record<string, unknown>> };
      if (body.data.length > 0) {
        const first = body.data[0];
        expect(typeof first.usps).toBe("string");
        expect(typeof first.name).toBe("string");
        expect(typeof first.isTerritory).toBe("boolean");
      }
    });

    it("items include documentCount field", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/locations/states",
      });

      const body = response.json() as { success: boolean; data: Array<Record<string, unknown>> };
      if (body.data.length > 0) {
        const first = body.data[0];
        expect(typeof first.documentCount).toBe("number");
      }
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/locations/states/:usps/places
  // ---------------------------------------------------------------------------

  describe("GET /api/locations/states/:usps/places", () => {
    it("returns 200 with an array for a valid state code", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/locations/states/CA/places",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { success: boolean; data: unknown[] };
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("returns 200 with empty array for nonexistent state", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/locations/states/ZZ/places",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { success: boolean; data: unknown[] };
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("place items have correct shape when present", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/locations/states/CA/places",
      });

      const body = response.json() as { success: boolean; data: Array<Record<string, unknown>> };
      if (body.data.length > 0) {
        const first = body.data[0];
        expect(typeof first.geoid).toBe("string");
        expect(typeof first.usps).toBe("string");
        expect(typeof first.name).toBe("string");
        expect(typeof first.lat).toBe("number");
        expect(typeof first.lon).toBe("number");
      }
    });

    it("returns places for Connecticut", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/locations/states/CT/places",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { success: boolean; data: unknown[] };
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/locations/tribes
  // ---------------------------------------------------------------------------

  describe("GET /api/locations/tribes", () => {
    it("returns 200 with an array", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/locations/tribes",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { success: boolean; data: unknown[] };
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("tribe items have correct shape when present", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/locations/tribes",
      });

      const body = response.json() as { success: boolean; data: Array<Record<string, unknown>> };
      if (body.data.length > 0) {
        const first = body.data[0];
        expect(typeof first.id).toBe("string");
        expect(typeof first.name).toBe("string");
        expect(typeof first.isAlaskaNative).toBe("boolean");
      }
    });

    it("accepts search query param", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/locations/tribes?search=Cherokee",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { success: boolean; data: unknown[] };
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("search filters results", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/locations/tribes?search=xyznotexist",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { success: boolean; data: unknown[] };
      expect(body.success).toBe(true);
      expect(body.data.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/locations/nearest
  // ---------------------------------------------------------------------------

  describe("POST /api/locations/nearest", () => {
    it("returns 200 with array for valid body", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/locations/nearest",
        payload: { lat: 37.7749, lon: -122.4194 },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { success: boolean; data: unknown[] };
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("returns 200 with custom limit", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/locations/nearest",
        payload: { lat: 40.7128, lon: -74.006, limit: 5 },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { success: boolean; data: unknown[] };
      expect(body.success).toBe(true);
      expect(body.data.length).toBeLessThanOrEqual(5);
    });

    it("returns 400 for missing body", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/locations/nearest",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 for invalid lat out of range", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/locations/nearest",
        payload: { lat: 200, lon: 0 },
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 for invalid lon out of range", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/locations/nearest",
        payload: { lat: 0, lon: 200 },
      });

      expect(response.statusCode).toBe(400);
    });

    it("nearest results have correct shape when present", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/locations/nearest",
        payload: { lat: 37.7749, lon: -122.4194 },
      });

      const body = response.json() as { success: boolean; data: Array<Record<string, unknown>> };
      if (body.data.length > 0) {
        const first = body.data[0];
        expect(typeof first.geoid).toBe("string");
        expect(typeof first.usps).toBe("string");
        expect(typeof first.name).toBe("string");
        expect(typeof first.lat).toBe("number");
        expect(typeof first.lon).toBe("number");
      }
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/locations/overview/:level
  // ---------------------------------------------------------------------------

  describe("GET /api/locations/overview/:level", () => {
    it("returns 200 for federal level", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/locations/overview/federal",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { success: boolean; data: Record<string, unknown> };
      expect(body.success).toBe(true);
      expect(typeof body.data.documentCount).toBe("number");
      expect(typeof body.data.documentsByCategory).toBe("object");
      expect(Array.isArray(body.data.policies)).toBe(true);
      expect(Array.isArray(body.data.vendors)).toBe(true);
      expect(Array.isArray(body.data.technologies)).toBe(true);
      expect(Array.isArray(body.data.agencies)).toBe(true);
      expect(Array.isArray(body.data.stateMetadata)).toBe(true);
    });

    it("returns 200 for state level with state param", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/locations/overview/state/CA",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { success: boolean; data: Record<string, unknown> };
      expect(body.success).toBe(true);
      expect(typeof body.data.documentCount).toBe("number");
      expect(Array.isArray(body.data.agencies)).toBe(true);
      expect(Array.isArray(body.data.stateMetadata)).toBe(true);
    });

    it("returns 200 for place level", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/locations/overview/place/CA/1234567",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { success: boolean; data: Record<string, unknown> };
      expect(body.success).toBe(true);
      expect(typeof body.data.documentCount).toBe("number");
    });

    it("stateMetadata is empty array when no state provided", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/locations/overview/federal",
      });

      const body = response.json() as { success: boolean; data: { stateMetadata: unknown[] } };
      expect(body.data.stateMetadata).toEqual([]);
    });

    it("agencies is empty array when no state provided", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/locations/overview/federal",
      });

      const body = response.json() as { success: boolean; data: { agencies: unknown[] } };
      expect(body.data.agencies).toEqual([]);
    });
  });
});
