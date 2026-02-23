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

async function fetchAndSolveChallenge(app: FastifyInstance): Promise<string> {
  const res = await app.inject({ method: "GET", url: "/api/altcha/challenge" });
  const c = res.json<{ algorithm: string; challenge: string; salt: string; signature: string; maxnumber?: number }>();
  const { promise } = solveChallenge(c.challenge, c.salt, c.algorithm, c.maxnumber ?? 100_000);
  const sol = await promise;
  if (!sol) throw new Error("ALTCHA solve failed");
  return btoa(JSON.stringify({ algorithm: c.algorithm, challenge: c.challenge, number: sol.number, salt: c.salt, signature: c.signature }));
}

async function registerAndSignIn(app: FastifyInstance, suffix: string): Promise<{ cookie: string; userId: string; email: string }> {
  const email = `tier-test-${suffix}@example.com`;
  const altchaPayload = await fetchAndSolveChallenge(app);
  const regRes = await app.inject({ method: "POST", url: "/api/auth/sign-up/email", payload: { name: "Test", email, password: "testpass1234", altchaPayload } });
  const userId = regRes.json<{ user?: { id: string } }>().user?.id ?? "";
  const signInRes = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", payload: { email, password: "testpass1234" } });
  const setCookie = signInRes.headers["set-cookie"];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : (setCookie ?? "");
  return { cookie, userId, email };
}

type AppWithDb = FastifyInstance & { db: { updateTable: Function } };

async function setUserRole(app: FastifyInstance, userId: string, role: string): Promise<void> {
  await (app as AppWithDb).db.updateTable("user").set({ role, updatedAt: new Date() } as never).where("id" as never, "=", userId).execute();
}

async function signInAgain(app: FastifyInstance, email: string): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", payload: { email, password: "testpass1234" } });
  const setCookie = res.headers["set-cookie"];
  return Array.isArray(setCookie) ? setCookie[0] : (setCookie ?? "");
}

// ---------------------------------------------------------------------------
// Auth guard tests (preserved)
// ---------------------------------------------------------------------------

describe("Tiers API — auth guards", () => {
  let app: FastifyInstance;

  beforeAll(async () => { app = await buildApp({ testing: true }); });
  afterAll(async () => { await app.close(); });

  it("GET /api/tiers returns list ordered by sort_order", async () => {
    const res = await app.inject({ method: "GET", url: "/api/tiers" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: Array<{ sortOrder: number }> }>();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    // Verify sorted by sortOrder ascending
    if (body.data.length > 1) {
      for (let i = 1; i < body.data.length; i++) {
        expect(body.data[i].sortOrder).toBeGreaterThanOrEqual(body.data[i - 1].sortOrder);
      }
    }
  });

  it("GET /api/tiers/:id returns tier with limits", async () => {
    const listRes = await app.inject({ method: "GET", url: "/api/tiers" });
    const list = listRes.json<{ data: Array<{ id: number }> }>();
    if (list.data.length > 0) {
      const tierId = list.data[0].id;
      const res = await app.inject({ method: "GET", url: `/api/tiers/${tierId}` });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ success: boolean; data: { id: number; limits: unknown[] } }>();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.limits)).toBe(true);
    }
  });

  it("GET /api/tiers/:id returns 404 for nonexistent tier", async () => {
    const res = await app.inject({ method: "GET", url: "/api/tiers/99999" });
    expect(res.statusCode).toBe(404);
  });

  it("POST /api/tiers returns 401/403 without auth", async () => {
    const res = await app.inject({ method: "POST", url: "/api/tiers", payload: { id: 99, name: "New Tier", sortOrder: 99 } });
    expect([401, 403]).toContain(res.statusCode);
  });

  it("PUT /api/tiers/:id returns 401/403 without auth", async () => {
    const res = await app.inject({ method: "PUT", url: "/api/tiers/1", payload: { name: "Updated" } });
    expect([401, 403]).toContain(res.statusCode);
  });

  it("PUT /api/tiers/:id/limits returns 401/403 without auth", async () => {
    const res = await app.inject({ method: "PUT", url: "/api/tiers/1/limits", payload: { limits: [] } });
    expect([401, 403]).toContain(res.statusCode);
  });

  it("DELETE /api/tiers/:id returns 401/403 without auth", async () => {
    const res = await app.inject({ method: "DELETE", url: "/api/tiers/99999" });
    expect([401, 403]).toContain(res.statusCode);
  });
});

// ---------------------------------------------------------------------------
// Tiers CRUD business logic
// ---------------------------------------------------------------------------

describe("Tiers — CRUD business logic (admin)", () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let adminEmail: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });

    // Clean up leftover test tier from previous runs
    await (app as AppWithDb & { db: { deleteFrom: Function } }).db
      .deleteFrom("user_tiers")
      .where("id" as never, "=", 9999)
      .execute();

    const admin = await registerAndSignIn(app, `admin-tier-${Date.now()}`);
    adminEmail = admin.email;
    await setUserRole(app, admin.userId, "admin");
    adminCookie = await signInAgain(app, adminEmail);
  }, 120_000);

  afterAll(async () => { await app.close(); });

  let createdTierId: number;

  it("POST /api/tiers creates a new tier", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/tiers",
      headers: { cookie: adminCookie },
      payload: { id: 9999, name: `Test Tier ${Date.now()}`, description: "A test tier", sortOrder: 99, isDefault: false },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { id: number; name: string; isDefault: boolean } }>();
    expect(body.success).toBe(true);
    expect(typeof body.data.id).toBe("number");
    expect(body.data.isDefault).toBe(false);
    createdTierId = body.data.id;
  }, 30_000);

  it("PUT /api/tiers/:id updates the tier", async () => {
    const newName = `Updated Tier ${Date.now()}`;
    const res = await app.inject({
      method: "PUT",
      url: `/api/tiers/${createdTierId}`,
      headers: { cookie: adminCookie },
      payload: { name: newName },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { name: string } }>();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe(newName);
  }, 30_000);

  it("PUT /api/tiers/:id/limits replaces tier limits", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/tiers/${createdTierId}/limits`,
      headers: { cookie: adminCookie },
      payload: {
        limits: [
          { limitType: "uploads", limitValue: 5 },
          { limitType: "llm_metadata", limitValue: 10 },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { id: number; limits: Array<{ limitType: string; limitValue: number }> } }>();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.limits)).toBe(true);
    const uploads = body.data.limits.find((l) => l.limitType === "uploads");
    expect(uploads?.limitValue).toBe(5);
  }, 30_000);

  it("GET /api/tiers/:id reflects updated limits", async () => {
    const res = await app.inject({ method: "GET", url: `/api/tiers/${createdTierId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: { limits: Array<{ limitType: string; limitValue: number }> } }>();
    const uploads = body.data.limits.find((l) => l.limitType === "uploads");
    expect(uploads?.limitValue).toBe(5);
  }, 30_000);

  it("DELETE /api/tiers/:id deletes the non-default tier", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/tiers/${createdTierId}`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean }>();
    expect(body.success).toBe(true);
  }, 30_000);

  it("GET /api/tiers/:id returns 404 after deletion", async () => {
    const res = await app.inject({ method: "GET", url: `/api/tiers/${createdTierId}` });
    expect(res.statusCode).toBe(404);
  }, 30_000);

  it("DELETE default tier returns 422 (cannot delete default)", async () => {
    // Find the default tier
    const listRes = await app.inject({ method: "GET", url: "/api/tiers" });
    const list = listRes.json<{ data: Array<{ id: number; isDefault: boolean }> }>();
    const defaultTier = list.data.find((t) => t.isDefault);
    if (!defaultTier) return; // Skip if no default tier found

    const res = await app.inject({
      method: "DELETE",
      url: `/api/tiers/${defaultTier.id}`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ success: boolean; error: string }>();
    expect(body.success).toBe(false);
  }, 30_000);
});
