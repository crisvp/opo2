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
  const email = `cat-test-${suffix}@example.com`;
  const altchaPayload = await fetchAndSolveChallenge(app);
  const regRes = await app.inject({ method: "POST", url: "/api/auth/sign-up/email", payload: { name: "Test", email, password: "testpass1234", altchaPayload } });
  const userId = regRes.json<{ user?: { id: string } }>().user?.id ?? "";
  const signInRes = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", payload: { email, password: "testpass1234" } });
  const setCookie = signInRes.headers["set-cookie"];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : (setCookie ?? "");
  return { cookie, userId, email };
}

type AppWithDb = FastifyInstance & { db: { updateTable: Function; selectFrom: Function } };

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

describe("Catalog API — auth guards", () => {
  let app: FastifyInstance;

  beforeAll(async () => { app = await buildApp({ testing: true }); });
  afterAll(async () => { await app.close(); });

  it("GET /api/catalog/types returns 200", async () => {
    const res = await app.inject({ method: "GET", url: "/api/catalog/types" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: unknown[] }>();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /api/association-types returns 200", async () => {
    const res = await app.inject({ method: "GET", url: "/api/association-types" });
    expect(res.statusCode).toBe(200);
  });

  it("GET /api/catalog/entries returns paginated list", async () => {
    const res = await app.inject({ method: "GET", url: "/api/catalog/entries" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { items: unknown[]; total: number } }>();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.items)).toBe(true);
  });

  it("GET /api/catalog/entries/:id returns 404 for nonexistent", async () => {
    const res = await app.inject({ method: "GET", url: "/api/catalog/entries/nonexistent-xyz" });
    expect(res.statusCode).toBe(404);
  });

  it("GET /api/catalog/search returns results", async () => {
    const res = await app.inject({ method: "GET", url: "/api/catalog/search?q=test" });
    expect(res.statusCode).toBe(200);
  });

  it("POST /api/catalog/entries returns 401 without auth", async () => {
    const res = await app.inject({ method: "POST", url: "/api/catalog/entries", payload: { typeId: "vendor", name: "Test" } });
    expect(res.statusCode).toBe(401);
  });

  it("PUT /api/catalog/entries/:id returns 401 without auth", async () => {
    const res = await app.inject({ method: "PUT", url: "/api/catalog/entries/some-id", payload: { name: "Updated" } });
    expect(res.statusCode).toBe(401);
  });

  it("DELETE /api/catalog/entries/:id returns 401 without auth", async () => {
    const res = await app.inject({ method: "DELETE", url: "/api/catalog/entries/some-id" });
    expect(res.statusCode).toBe(401);
  });

  it("POST /api/catalog/entries/:id/aliases returns 401 without auth", async () => {
    const res = await app.inject({ method: "POST", url: "/api/catalog/entries/some-id/aliases", payload: { alias: "test" } });
    expect(res.statusCode).toBe(401);
  });

  it("DELETE /api/catalog/aliases/:id returns 401 without auth", async () => {
    const res = await app.inject({ method: "DELETE", url: "/api/catalog/aliases/some-id" });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Catalog CRUD business logic
// ---------------------------------------------------------------------------

describe("Catalog entries — CRUD business logic", () => {
  let app: FastifyInstance;
  let modCookie: string;
  let modEmail: string;
  let catalogTypeId: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });

    // Create moderator
    const mod = await registerAndSignIn(app, `mod-cat-${Date.now()}`);
    modEmail = mod.email;
    await setUserRole(app, mod.userId, "moderator");
    modCookie = await signInAgain(app, modEmail);

    // Get a real catalog type ID from the DB
    const types = await (app as AppWithDb).db.selectFrom("catalog_types").select(["id"]).limit(1).execute();
    if (types.length === 0) throw new Error("No catalog types found in DB — run migrations/seeds first");
    catalogTypeId = (types[0] as { id: string }).id;
  }, 120_000);

  afterAll(async () => { await app.close(); });

  let createdEntryId: string;

  it("POST /api/catalog/entries creates a new entry", async () => {
    const entryName = `Test Entry ${Date.now()}`;
    const res = await app.inject({
      method: "POST",
      url: "/api/catalog/entries",
      headers: { cookie: modCookie },
      payload: { typeId: catalogTypeId, name: entryName, isVerified: false },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { id: string; name: string; typeId: string } }>();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe(entryName);
    expect(body.data.typeId).toBe(catalogTypeId);
    expect(typeof body.data.id).toBe("string");
    createdEntryId = body.data.id;
  }, 30_000);

  it("GET /api/catalog/entries/:id returns entry with aliases array", async () => {
    const res = await app.inject({ method: "GET", url: `/api/catalog/entries/${createdEntryId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { id: string; aliases: unknown[]; associations: unknown[] } }>();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(createdEntryId);
    expect(Array.isArray(body.data.aliases)).toBe(true);
    expect(Array.isArray(body.data.associations)).toBe(true);
  }, 30_000);

  it("PUT /api/catalog/entries/:id updates the entry", async () => {
    const updatedName = `Updated Entry ${Date.now()}`;
    const res = await app.inject({
      method: "PUT",
      url: `/api/catalog/entries/${createdEntryId}`,
      headers: { cookie: modCookie },
      payload: { name: updatedName, isVerified: true },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { name: string; isVerified: boolean } }>();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe(updatedName);
    expect(body.data.isVerified).toBe(true);
  }, 30_000);

  it("PUT /api/catalog/entries/:id returns 404 for nonexistent entry", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/catalog/entries/nonexistent-xyz",
      headers: { cookie: modCookie },
      payload: { name: "Whatever" },
    });
    expect(res.statusCode).toBe(404);
  }, 30_000);

  it("POST /api/catalog/entries/:id/aliases adds an alias", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/catalog/entries/${createdEntryId}/aliases`,
      headers: { cookie: modCookie },
      payload: { alias: "test alias", source: "manual" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { id: string; alias: string; normalizedAlias: string; source: string } }>();
    expect(body.success).toBe(true);
    expect(body.data.alias).toBe("test alias");
    expect(body.data.normalizedAlias).toBe("test alias");
    expect(body.data.source).toBe("manual");
  }, 30_000);

  it("POST /api/catalog/entries/:id/aliases returns 409 on duplicate alias", async () => {
    // Try to add the same alias again
    const res = await app.inject({
      method: "POST",
      url: `/api/catalog/entries/${createdEntryId}/aliases`,
      headers: { cookie: modCookie },
      payload: { alias: "test alias", source: "manual" },
    });
    expect(res.statusCode).toBe(409);
  }, 30_000);

  it("GET /api/catalog/entries/:id shows alias in aliases array after add", async () => {
    const res = await app.inject({ method: "GET", url: `/api/catalog/entries/${createdEntryId}` });
    const body = res.json<{ data: { aliases: Array<{ alias: string }> } }>();
    const aliases = body.data.aliases.map((a) => a.alias);
    expect(aliases).toContain("test alias");
  }, 30_000);

  it("DELETE /api/catalog/entries/:id deletes the entry", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/catalog/entries/${createdEntryId}`,
      headers: { cookie: modCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean }>();
    expect(body.success).toBe(true);
  }, 30_000);

  it("GET /api/catalog/entries/:id returns 404 after deletion", async () => {
    const res = await app.inject({ method: "GET", url: `/api/catalog/entries/${createdEntryId}` });
    expect(res.statusCode).toBe(404);
  }, 30_000);

  it("DELETE /api/catalog/entries/:id returns 404 for nonexistent entry", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/catalog/entries/nonexistent-delete-xyz",
      headers: { cookie: modCookie },
    });
    expect(res.statusCode).toBe(404);
  }, 30_000);

  it("POST /api/catalog/entries returns 400 for invalid catalog type", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/catalog/entries",
      headers: { cookie: modCookie },
      payload: { typeId: "nonexistent-type-xyz", name: "Bad Entry" },
    });
    expect(res.statusCode).toBe(400);
  }, 30_000);
});
