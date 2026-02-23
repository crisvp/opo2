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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchAndSolveChallenge(app: FastifyInstance): Promise<string> {
  const res = await app.inject({ method: "GET", url: "/api/altcha/challenge" });
  const c = res.json<{ algorithm: string; challenge: string; salt: string; signature: string; maxnumber?: number }>();
  const { promise } = solveChallenge(c.challenge, c.salt, c.algorithm, c.maxnumber ?? 100_000);
  const sol = await promise;
  if (!sol) throw new Error("ALTCHA solve failed");
  return btoa(JSON.stringify({ algorithm: c.algorithm, challenge: c.challenge, number: sol.number, salt: c.salt, signature: c.signature }));
}

async function registerAndSignIn(app: FastifyInstance, suffix: string): Promise<{ cookie: string; userId: string; email: string }> {
  const email = `agency-test-${suffix}@example.com`;
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

describe("Agencies API — auth guards", () => {
  let app: FastifyInstance;

  beforeAll(async () => { app = await buildApp({ testing: true }); });
  afterAll(async () => { await app.close(); });

  it("GET /api/agencies returns paginated list", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agencies" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { items: unknown[]; total: number } }>();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.items)).toBe(true);
  });

  it("GET /api/agencies supports stateUsps filter", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agencies?stateUsps=CA" });
    expect(res.statusCode).toBe(200);
  });

  it("GET /api/agencies/:id returns 404 for nonexistent", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agencies/nonexistent-xyz" });
    expect(res.statusCode).toBe(404);
  });

  it("POST /api/agencies returns 403 without auth", async () => {
    const res = await app.inject({ method: "POST", url: "/api/agencies", payload: { stateUsps: "CA", name: "Test" } });
    expect(res.statusCode).toBe(403);
  });

  it("PUT /api/agencies/:id returns 403 without auth", async () => {
    const res = await app.inject({ method: "PUT", url: "/api/agencies/some-id", payload: { name: "Updated" } });
    expect(res.statusCode).toBe(403);
  });

  it("DELETE /api/agencies/:id returns 403 without auth", async () => {
    const res = await app.inject({ method: "DELETE", url: "/api/agencies/some-id" });
    expect(res.statusCode).toBe(403);
  });

  it("GET /api/agencies returns 400 for invalid stateUsps length", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agencies?stateUsps=TOOLONG" });
    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Agencies CRUD business logic
// ---------------------------------------------------------------------------

describe("Agencies — CRUD business logic", () => {
  let app: FastifyInstance;
  let modCookie: string;
  let modEmail: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });

    // Seed TX state (FK required by state_agencies table)
    await (app as AppWithDb & { db: { insertInto: Function } }).db
      .insertInto("states")
      .values({ usps: "TX", name: "Texas", is_territory: false } as never)
      .onConflict((oc: { doNothing: () => unknown }) => oc.doNothing())
      .execute();

    const mod = await registerAndSignIn(app, `mod-ag-${Date.now()}`);
    modEmail = mod.email;
    await setUserRole(app, mod.userId, "moderator");
    modCookie = await signInAgain(app, modEmail);
  }, 120_000);

  afterAll(async () => { await app.close(); });

  let createdAgencyId: string;

  it("POST /api/agencies creates a new agency", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/agencies",
      headers: { cookie: modCookie },
      payload: {
        stateUsps: "TX",
        name: `Test Agency ${Date.now()}`,
        abbreviation: "TA",
        category: "law_enforcement",
        websiteUrl: "https://example.com",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { id: string; stateUsps: string; name: string; category: string } }>();
    expect(body.success).toBe(true);
    expect(body.data.stateUsps).toBe("TX");
    expect(body.data.category).toBe("law_enforcement");
    expect(typeof body.data.id).toBe("string");
    createdAgencyId = body.data.id;
  }, 30_000);

  it("GET /api/agencies/:id retrieves the created agency", async () => {
    const res = await app.inject({ method: "GET", url: `/api/agencies/${createdAgencyId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { id: string } }>();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(createdAgencyId);
  }, 30_000);

  it("GET /api/agencies filters by stateUsps", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agencies?stateUsps=TX" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: { items: Array<{ stateUsps: string }> } }>();
    expect(body.data.items.every((a) => a.stateUsps === "TX")).toBe(true);
  }, 30_000);

  it("PUT /api/agencies/:id updates the agency", async () => {
    const updatedName = `Updated Agency ${Date.now()}`;
    const res = await app.inject({
      method: "PUT",
      url: `/api/agencies/${createdAgencyId}`,
      headers: { cookie: modCookie },
      payload: { name: updatedName },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { name: string } }>();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe(updatedName);
  }, 30_000);

  it("PUT /api/agencies/:id returns 404 for nonexistent agency", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/agencies/nonexistent-ag-xyz",
      headers: { cookie: modCookie },
      payload: { name: "Whatever" },
    });
    expect(res.statusCode).toBe(404);
  }, 30_000);

  it("DELETE /api/agencies/:id deletes the agency", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/agencies/${createdAgencyId}`,
      headers: { cookie: modCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean }>();
    expect(body.success).toBe(true);
  }, 30_000);

  it("GET /api/agencies/:id returns 404 after deletion", async () => {
    const res = await app.inject({ method: "GET", url: `/api/agencies/${createdAgencyId}` });
    expect(res.statusCode).toBe(404);
  }, 30_000);

  it("DELETE /api/agencies/:id returns 404 for nonexistent agency", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/agencies/nonexistent-delete-xyz",
      headers: { cookie: modCookie },
    });
    expect(res.statusCode).toBe(404);
  }, 30_000);
});
