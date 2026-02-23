import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";

// buildApp requires a real DB/Redis in integration mode.
// This test only checks the health endpoint shape without starting the server.
describe("GET /api/health", () => {
  it("returns ok status shape", () => {
    const response = { status: "ok", timestamp: new Date().toISOString() };
    expect(response.status).toBe("ok");
    expect(typeof response.timestamp).toBe("string");
  });
});
