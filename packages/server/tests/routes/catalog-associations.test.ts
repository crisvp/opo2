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
  const email = `assoc-test-${suffix}@example.com`;
  const altchaPayload = await fetchAndSolveChallenge(app);
  const regRes = await app.inject({ method: "POST", url: "/api/auth/sign-up/email", payload: { name: "Test", email, password: "testpass1234", altchaPayload } });
  const userId = regRes.json<{ user?: { id: string } }>().user?.id ?? "";
  const signInRes = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", payload: { email, password: "testpass1234" } });
  const setCookie = signInRes.headers["set-cookie"];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : (setCookie ?? "");
  return { cookie, userId, email };
}

type AppWithDb = FastifyInstance & { db: { updateTable: Function; selectFrom: Function; insertInto: Function } };

async function setUserRole(app: FastifyInstance, userId: string, role: string): Promise<void> {
  await (app as AppWithDb).db.updateTable("user").set({ role, updatedAt: new Date() } as never).where("id" as never, "=", userId).execute();
}

async function signInAgain(app: FastifyInstance, email: string): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", payload: { email, password: "testpass1234" } });
  const setCookie = res.headers["set-cookie"];
  return Array.isArray(setCookie) ? setCookie[0] : (setCookie ?? "");
}

describe("POST /api/catalog/entries/:id/associations", () => {
  let app: FastifyInstance;

  beforeAll(async () => { app = await buildApp({ testing: true }); });
  afterAll(async () => { await app.close(); });

  it("returns 401 when unauthenticated", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/catalog/entries/nonexistent/associations",
      payload: { targetEntryId: "x", associationTypeId: "y" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 when authenticated as regular user", { timeout: 30000 }, async () => {
    const { cookie } = await registerAndSignIn(app, "post-user1");
    const res = await app.inject({
      method: "POST",
      url: "/api/catalog/entries/nonexistent/associations",
      payload: { targetEntryId: "x", associationTypeId: "y" },
      headers: { cookie },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 404 when source entry does not exist (moderator)", { timeout: 30000 }, async () => {
    const { cookie, userId, email } = await registerAndSignIn(app, "post-mod1");
    await setUserRole(app, userId, "moderator");
    const modCookie = await signInAgain(app, email);
    const res = await app.inject({
      method: "POST",
      url: "/api/catalog/entries/nonexistent/associations",
      payload: { targetEntryId: "x", associationTypeId: "y" },
      headers: { cookie: modCookie },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /api/catalog/associations/:id", () => {
  let app: FastifyInstance;

  beforeAll(async () => { app = await buildApp({ testing: true }); });
  afterAll(async () => { await app.close(); });

  it("returns 401 when unauthenticated", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/catalog/associations/nonexistent",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 when authenticated as regular user", { timeout: 30000 }, async () => {
    const { cookie } = await registerAndSignIn(app, "del-user2");
    const res = await app.inject({
      method: "DELETE",
      url: "/api/catalog/associations/nonexistent",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 404 when association does not exist (moderator)", { timeout: 30000 }, async () => {
    const { cookie, userId, email } = await registerAndSignIn(app, "del-mod2");
    await setUserRole(app, userId, "moderator");
    const modCookie = await signInAgain(app, email);
    const res = await app.inject({
      method: "DELETE",
      url: "/api/catalog/associations/nonexistent",
      headers: { cookie: modCookie },
    });
    expect(res.statusCode).toBe(404);
  });
});
