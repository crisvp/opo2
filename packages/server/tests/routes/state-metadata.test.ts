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
  const email = `sm-test-${suffix}@example.com`;
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

describe("State Metadata API — auth guards", () => {
  let app: FastifyInstance;

  beforeAll(async () => { app = await buildApp({ testing: true }); });
  afterAll(async () => { await app.close(); });

  it("GET /api/state-metadata returns array", async () => {
    const res = await app.inject({ method: "GET", url: "/api/state-metadata" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: unknown[] }>();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /api/state-metadata supports stateUsps filter", async () => {
    const res = await app.inject({ method: "GET", url: "/api/state-metadata?stateUsps=CA" });
    expect(res.statusCode).toBe(200);
  });

  it("POST /api/state-metadata returns 401 without auth", async () => {
    const res = await app.inject({ method: "POST", url: "/api/state-metadata", payload: { stateUsps: "CA", key: "test", value: "val" } });
    expect(res.statusCode).toBe(401);
  });

  it("PUT /api/state-metadata/:id returns 401 without auth", async () => {
    const res = await app.inject({ method: "PUT", url: "/api/state-metadata/some-id", payload: { value: "updated" } });
    expect(res.statusCode).toBe(401);
  });

  it("DELETE /api/state-metadata/:id returns 401 without auth", async () => {
    const res = await app.inject({ method: "DELETE", url: "/api/state-metadata/some-id" });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// State Metadata CRUD business logic
// ---------------------------------------------------------------------------

describe("State Metadata — CRUD business logic", () => {
  let app: FastifyInstance;
  let modCookie: string;
  let modEmail: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });

    // Seed WA state (FK required by state_metadata table)
    await (app as AppWithDb & { db: { insertInto: Function } }).db
      .insertInto("states")
      .values({ usps: "WA", name: "Washington", is_territory: false } as never)
      .onConflict((oc: { doNothing: () => unknown }) => oc.doNothing())
      .execute();

    const mod = await registerAndSignIn(app, `mod-sm-${Date.now()}`);
    modEmail = mod.email;
    await setUserRole(app, mod.userId, "moderator");
    modCookie = await signInAgain(app, modEmail);
  }, 120_000);

  afterAll(async () => { await app.close(); });

  let createdMetaId: string;
  const testKey = `test_key_${Date.now()}`;

  it("POST /api/state-metadata creates a new entry", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/state-metadata",
      headers: { cookie: modCookie },
      payload: {
        stateUsps: "WA",
        key: testKey,
        value: "Test value for WA",
        url: "https://example.com/wa",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { id: string; stateUsps: string; key: string; value: string } }>();
    expect(body.success).toBe(true);
    expect(body.data.stateUsps).toBe("WA");
    expect(body.data.key).toBe(testKey);
    expect(body.data.value).toBe("Test value for WA");
    createdMetaId = body.data.id;
  }, 30_000);

  it("GET /api/state-metadata with stateUsps=WA shows the new entry", async () => {
    const res = await app.inject({ method: "GET", url: "/api/state-metadata?stateUsps=WA" });
    const body = res.json<{ data: Array<{ key: string }> }>();
    const keys = body.data.map((m) => m.key);
    expect(keys).toContain(testKey);
  }, 30_000);

  it("PUT /api/state-metadata/:id updates the entry", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/state-metadata/${createdMetaId}`,
      headers: { cookie: modCookie },
      payload: { value: "Updated value", url: "https://example.com/wa/updated" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { value: string } }>();
    expect(body.success).toBe(true);
    expect(body.data.value).toBe("Updated value");
  }, 30_000);

  it("PUT /api/state-metadata/:id returns 404 for nonexistent entry", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/state-metadata/nonexistent-sm-xyz",
      headers: { cookie: modCookie },
      payload: { value: "Whatever" },
    });
    expect(res.statusCode).toBe(404);
  }, 30_000);

  it("DELETE /api/state-metadata/:id deletes the entry", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/state-metadata/${createdMetaId}`,
      headers: { cookie: modCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean }>();
    expect(body.success).toBe(true);
  }, 30_000);

  it("GET /api/state-metadata no longer shows deleted entry", async () => {
    const res = await app.inject({ method: "GET", url: "/api/state-metadata?stateUsps=WA" });
    const body = res.json<{ data: Array<{ key: string }> }>();
    const keys = body.data.map((m) => m.key);
    expect(keys).not.toContain(testKey);
  }, 30_000);

  it("DELETE /api/state-metadata/:id returns 404 for nonexistent", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/state-metadata/nonexistent-delete-xyz",
      headers: { cookie: modCookie },
    });
    expect(res.statusCode).toBe(404);
  }, 30_000);
});
