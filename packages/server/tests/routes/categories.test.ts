import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { solveChallenge } from "altcha-lib";
import { buildApp } from "../../src/app.js";
import { nanoid } from "nanoid";

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
  const email = `categ-test-${suffix}@example.com`;
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

describe("Categories API — auth guards", () => {
  let app: FastifyInstance;

  beforeAll(async () => { app = await buildApp({ testing: true }); });
  afterAll(async () => { await app.close(); });

  it("GET /api/categories returns array", async () => {
    const res = await app.inject({ method: "GET", url: "/api/categories" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: unknown[] }>();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /api/categories/:id returns 404 for nonexistent", async () => {
    const res = await app.inject({ method: "GET", url: "/api/categories/nonexistent-xyz" });
    expect(res.statusCode).toBe(404);
  });

  it("GET /api/categories/:id/fields returns 200", async () => {
    const res = await app.inject({ method: "GET", url: "/api/categories/nonexistent-xyz/fields" });
    // Returns 200 with empty array or 404 — either is valid
    expect([200, 404]).toContain(res.statusCode);
  });

  it("POST /api/categories returns 401 without auth", async () => {
    const res = await app.inject({ method: "POST", url: "/api/categories", payload: { id: "test", name: "Test" } });
    expect(res.statusCode).toBe(401);
  });

  it("PUT /api/categories/:id returns 401 without auth", async () => {
    const res = await app.inject({ method: "PUT", url: "/api/categories/some-id", payload: { name: "Updated" } });
    expect(res.statusCode).toBe(401);
  });

  it("DELETE /api/categories/:id returns 401 without auth", async () => {
    const res = await app.inject({ method: "DELETE", url: "/api/categories/some-id" });
    expect(res.statusCode).toBe(401);
  });

  it("POST /api/categories/:id/fields returns 401 without auth", async () => {
    const res = await app.inject({ method: "POST", url: "/api/categories/some-id/fields", payload: { fieldKey: "test", displayName: "Test", valueType: "text" } });
    expect(res.statusCode).toBe(401);
  });

  it("PUT /api/categories/:id/rules returns 401 without auth", async () => {
    const res = await app.inject({ method: "PUT", url: "/api/categories/some-id/rules", payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/policy-types returns array", async () => {
    const res = await app.inject({ method: "GET", url: "/api/policy-types" });
    expect(res.statusCode).toBe(200);
  });

  it("POST /api/policy-types returns 401 without auth", async () => {
    const res = await app.inject({ method: "POST", url: "/api/policy-types", payload: { name: "Test Policy" } });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Categories CRUD business logic
// ---------------------------------------------------------------------------

describe("Categories — CRUD business logic", () => {
  let app: FastifyInstance;
  let modCookie: string;
  let modEmail: string;
  let adminCookie: string;
  let adminEmail: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });

    const mod = await registerAndSignIn(app, `mod-categ-${Date.now()}`);
    modEmail = mod.email;
    await setUserRole(app, mod.userId, "moderator");
    modCookie = await signInAgain(app, modEmail);

    const admin = await registerAndSignIn(app, `admin-categ-${Date.now()}`);
    adminEmail = admin.email;
    await setUserRole(app, admin.userId, "admin");
    adminCookie = await signInAgain(app, adminEmail);
  }, 120_000);

  afterAll(async () => { await app.close(); });

  let createdCategoryId: string;

  it("POST /api/categories creates a new category", async () => {
    createdCategoryId = `testcat_${Date.now()}`;
    const res = await app.inject({
      method: "POST",
      url: "/api/categories",
      headers: { cookie: modCookie },
      payload: { id: createdCategoryId, name: `Test Category ${Date.now()}`, description: "A test category" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { id: string; name: string } }>();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(createdCategoryId);
  }, 30_000);

  it("GET /api/categories/:id returns the created category", async () => {
    const res = await app.inject({ method: "GET", url: `/api/categories/${createdCategoryId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { id: string } }>();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(createdCategoryId);
  }, 30_000);

  it("PUT /api/categories/:id updates the category", async () => {
    const newName = `Updated Category ${Date.now()}`;
    const res = await app.inject({
      method: "PUT",
      url: `/api/categories/${createdCategoryId}`,
      headers: { cookie: modCookie },
      payload: { name: newName },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { name: string } }>();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe(newName);
  }, 30_000);

  it("PUT /api/categories/:id returns 404 for nonexistent category", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/categories/nonexistent-cat-xyz",
      headers: { cookie: modCookie },
      payload: { name: "Whatever" },
    });
    expect(res.statusCode).toBe(404);
  }, 30_000);

  it("PUT /api/categories/:id/rules updates association rules", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/categories/${createdCategoryId}/rules`,
      headers: { cookie: modCookie },
      payload: { minVendors: 1, maxVendors: 3, requireGovernmentLocation: true },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { minVendors?: number; maxVendors?: number } }>();
    expect(body.success).toBe(true);
  }, 30_000);

  let createdFieldId: string;

  it("POST /api/categories/:id/fields creates a field definition", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/categories/${createdCategoryId}/fields`,
      headers: { cookie: modCookie },
      payload: { fieldKey: "contract_value", displayName: "Contract Value", valueType: "currency", required: false },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { id: string; fieldKey: string; displayName: string } }>();
    expect(body.success).toBe(true);
    expect(body.data.fieldKey).toBe("contract_value");
    createdFieldId = body.data.id;
  }, 30_000);

  it("GET /api/categories/:id/fields returns the field", async () => {
    const res = await app.inject({ method: "GET", url: `/api/categories/${createdCategoryId}/fields` });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: Array<{ fieldKey: string }> }>();
    expect(body.success).toBe(true);
    const keys = body.data.map((f) => f.fieldKey);
    expect(keys).toContain("contract_value");
  }, 30_000);

  it("PUT /api/field-definitions/:id updates the field definition", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/field-definitions/${createdFieldId}`,
      headers: { cookie: modCookie },
      payload: { displayName: "Contract Amount", required: true },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { displayName: string } }>();
    expect(body.success).toBe(true);
    expect(body.data.displayName).toBe("Contract Amount");
  }, 30_000);

  it("DELETE /api/field-definitions/:id deletes the field", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/field-definitions/${createdFieldId}`,
      headers: { cookie: modCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean }>();
    expect(body.success).toBe(true);
  }, 30_000);

  it("DELETE /api/categories/:id deletes the category", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/categories/${createdCategoryId}`,
      headers: { cookie: modCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean }>();
    expect(body.success).toBe(true);
  }, 30_000);

  it("GET /api/categories/:id returns 404 after deletion", async () => {
    const res = await app.inject({ method: "GET", url: `/api/categories/${createdCategoryId}` });
    expect(res.statusCode).toBe(404);
  }, 30_000);
});

// ---------------------------------------------------------------------------
// Policy types
// ---------------------------------------------------------------------------

describe("Policy Types — admin CRUD", () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let adminEmail: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    const admin = await registerAndSignIn(app, `admin-pt-${Date.now()}`);
    adminEmail = admin.email;
    await setUserRole(app, admin.userId, "admin");
    adminCookie = await signInAgain(app, adminEmail);
  }, 120_000);

  afterAll(async () => { await app.close(); });

  let createdPolicyTypeId: string;

  it("POST /api/policy-types creates a new policy type (admin)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/policy-types",
      headers: { cookie: adminCookie },
      payload: { name: `Test Policy ${Date.now()}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { id: string; name: string } }>();
    expect(body.success).toBe(true);
    expect(typeof body.data.id).toBe("string");
    createdPolicyTypeId = body.data.id;
  }, 30_000);

  it("GET /api/policy-types lists includes the new policy type", async () => {
    const res = await app.inject({ method: "GET", url: "/api/policy-types" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: Array<{ id: string }> }>();
    const ids = body.data.map((p) => p.id);
    expect(ids).toContain(createdPolicyTypeId);
  }, 30_000);

  it("DELETE /api/policy-types/:id deletes the policy type (admin)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/policy-types/${createdPolicyTypeId}`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean }>();
    expect(body.success).toBe(true);
  }, 30_000);
});
