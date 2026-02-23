import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { solveChallenge } from "altcha-lib";

import { buildApp } from "../../src/app.js";

// Mock S3 and worker so tests don't need real AWS/worker infrastructure
vi.mock("../../src/services/storage.js", () => ({
  createPresignedUploadUrl: vi.fn().mockResolvedValue({
    url: "https://s3.example.com/upload",
    fields: { key: "documents/test-id/file.pdf", "Content-Type": "application/pdf" },
  }),
  headObject: vi.fn().mockResolvedValue({ ContentLength: 1024, ContentType: "application/pdf" }),
  getPresignedDownloadUrl: vi.fn().mockResolvedValue("https://s3.example.com/download/test"),
  deleteObject: vi.fn().mockResolvedValue(undefined),
  getObject: vi.fn().mockResolvedValue(null),
}));

vi.mock("graphile-worker", () => ({
  makeWorkerUtils: vi.fn().mockResolvedValue({
    addJob: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchAndSolveChallenge(app: FastifyInstance): Promise<string> {
  const res = await app.inject({ method: "GET", url: "/api/altcha/challenge" });
  const challenge = res.json<{ algorithm: string; challenge: string; salt: string; signature: string; maxnumber?: number }>();
  const { promise } = solveChallenge(challenge.challenge, challenge.salt, challenge.algorithm, challenge.maxnumber ?? 100_000);
  const solution = await promise;
  if (!solution) throw new Error("Failed to solve ALTCHA challenge");
  return btoa(JSON.stringify({ algorithm: challenge.algorithm, challenge: challenge.challenge, number: solution.number, salt: challenge.salt, signature: challenge.signature }));
}

async function registerAndSignIn(
  app: FastifyInstance,
  suffix: string,
): Promise<{ cookie: string; userId: string; email: string }> {
  const email = `mod-test-${suffix}@example.com`;
  const password = "testpass1234";
  const altchaPayload = await fetchAndSolveChallenge(app);
  const regRes = await app.inject({
    method: "POST",
    url: "/api/auth/sign-up/email",
    payload: { name: "Moderation Test User", email, password, altchaPayload },
  });
  const userId = (regRes.json<{ user?: { id: string } }>()).user?.id ?? "";
  const signInRes = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    payload: { email, password },
  });
  const setCookie = signInRes.headers["set-cookie"];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : (setCookie ?? "");
  return { cookie, userId, email };
}

/** Promote a user to a given role by directly updating the DB */
async function setUserRole(app: FastifyInstance, userId: string, role: "admin" | "moderator" | "user"): Promise<void> {
  await (app as FastifyInstance & { db: { updateTable: Function } }).db
    .updateTable("user")
    .set({ role, updatedAt: new Date() } as never)
    .where("id" as never, "=", userId)
    .execute();
}

/** Create a document and move it to moderator_review state via the full pipeline shortcut */
async function seedDocumentInModeratorReview(
  app: FastifyInstance,
  uploaderCookie: string,
  docTitle: string,
): Promise<string> {
  // Initiate upload
  const initiateRes = await app.inject({
    method: "POST",
    url: "/api/documents/initiate",
    headers: { cookie: uploaderCookie },
    payload: { title: docTitle, filename: "test.pdf", mimetype: "application/pdf", size: 1024 },
  });
  const { data: { documentId } } = initiateRes.json<{ data: { documentId: string } }>();

  // Confirm upload (submitted state)
  await app.inject({
    method: "POST",
    url: `/api/documents/${documentId}/confirm-upload`,
    headers: { cookie: uploaderCookie },
    payload: { saveAsDraft: false },
  });

  // Directly set state to moderator_review in DB (bypassing the processing pipeline)
  await (app as FastifyInstance & { db: { updateTable: Function } }).db
    .updateTable("documents")
    .set({ state: "moderator_review", updated_at: new Date() } as never)
    .where("id" as never, "=", documentId)
    .execute();

  return documentId;
}

// ---------------------------------------------------------------------------
// Auth guard tests (existing)
// ---------------------------------------------------------------------------

describe("Moderation API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/moderation/queue", () => {
    it("returns 403 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/moderation/queue",
      });
      expect(response.statusCode).toBe(403);
      const body = response.json() as { success: boolean };
      expect(body.success).toBe(false);
    });

    it("returns 403 with plain user role (not moderator)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/moderation/queue",
        headers: {},
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/documents/:id/approve", () => {
    it("returns 403 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/documents/some-id/approve",
      });
      expect(response.statusCode).toBe(403);
      const body = response.json() as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  describe("POST /api/documents/:id/reject", () => {
    it("returns 403 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/documents/some-id/reject",
        payload: { reason: "Insufficient information" },
      });
      expect(response.statusCode).toBe(403);
      const body = response.json() as { success: boolean };
      expect(body.success).toBe(false);
    });

    it("returns 400 when body is missing (schema validation before auth)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/documents/some-id/reject",
      });
      expect(response.statusCode).toBe(400);
    });
  });
});

// ---------------------------------------------------------------------------
// Business logic: moderation state transitions
// ---------------------------------------------------------------------------

describe("Moderation — state transition business logic", () => {
  let app: FastifyInstance;
  let uploaderCookie: string;
  let moderatorCookie: string;
  let moderatorId: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });

    // Create uploader
    const uploader = await registerAndSignIn(app, `uploader-${Date.now()}`);
    uploaderCookie = uploader.cookie;

    // Create moderator
    const mod = await registerAndSignIn(app, `moderator-${Date.now()}`);
    moderatorCookie = mod.cookie;
    moderatorId = mod.userId;
    await setUserRole(app, moderatorId, "moderator");

    // Re-sign in to refresh session with new role
    const reSignIn = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email: mod.email, password: "testpass1234" },
    });
    const setCookie = reSignIn.headers["set-cookie"];
    moderatorCookie = Array.isArray(setCookie) ? setCookie[0] : (setCookie ?? "");
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // GET /api/moderation/queue
  // ---------------------------------------------------------------------------

  describe("GET /api/moderation/queue", () => {
    it("returns 200 and paginated queue for moderator", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/moderation/queue",
        headers: { cookie: moderatorCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ success: boolean; data: { items: unknown[]; total: number } }>();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.items)).toBe(true);
      expect(typeof body.data.total).toBe("number");
    }, 30_000);
  });

  // ---------------------------------------------------------------------------
  // POST /api/documents/:id/approve
  // ---------------------------------------------------------------------------

  describe("POST /api/documents/:id/approve", () => {
    it("approves a document in moderator_review state", async () => {
      const documentId = await seedDocumentInModeratorReview(app, uploaderCookie, `Approve Me ${Date.now()}`);

      const res = await app.inject({
        method: "POST",
        url: `/api/documents/${documentId}/approve`,
        headers: { cookie: moderatorCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ success: boolean; data: { id: string; state: string } }>();
      expect(body.success).toBe(true);
      expect(body.data.state).toBe("approved");
    }, 60_000);

    it("returns 422 when document is not in moderator_review state", async () => {
      // Create a document and leave it in submitted state
      const initiateRes = await app.inject({
        method: "POST",
        url: "/api/documents/initiate",
        headers: { cookie: uploaderCookie },
        payload: { title: "Wrong State Doc", filename: "ws.pdf", mimetype: "application/pdf", size: 1024 },
      });
      const { data: { documentId } } = initiateRes.json<{ data: { documentId: string } }>();

      await app.inject({
        method: "POST",
        url: `/api/documents/${documentId}/confirm-upload`,
        headers: { cookie: uploaderCookie },
        payload: { saveAsDraft: false },
      });
      // Document is now in "submitted" state — approve should fail

      const res = await app.inject({
        method: "POST",
        url: `/api/documents/${documentId}/approve`,
        headers: { cookie: moderatorCookie },
      });
      expect(res.statusCode).toBe(422);
      const body = res.json<{ success: boolean; error: string }>();
      expect(body.success).toBe(false);
      expect(body.error).toMatch(/moderator_review/i);
    }, 60_000);

    it("returns 404 for non-existent document", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/documents/nonexistent-doc-xyz/approve",
        headers: { cookie: moderatorCookie },
      });
      expect(res.statusCode).toBe(404);
      const body = res.json<{ success: boolean }>();
      expect(body.success).toBe(false);
    }, 30_000);
  });

  // ---------------------------------------------------------------------------
  // POST /api/documents/:id/reject
  // ---------------------------------------------------------------------------

  describe("POST /api/documents/:id/reject", () => {
    it("rejects a document in moderator_review state with a valid reason", async () => {
      const documentId = await seedDocumentInModeratorReview(app, uploaderCookie, `Reject Me ${Date.now()}`);

      const res = await app.inject({
        method: "POST",
        url: `/api/documents/${documentId}/reject`,
        headers: { cookie: moderatorCookie },
        payload: { reason: "Document does not meet quality standards." },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ success: boolean; data: { id: string; state: string } }>();
      expect(body.success).toBe(true);
      expect(body.data.state).toBe("rejected");
    }, 60_000);

    it("returns 422 when document is not in moderator_review state", async () => {
      const initiateRes = await app.inject({
        method: "POST",
        url: "/api/documents/initiate",
        headers: { cookie: uploaderCookie },
        payload: { title: "Wrong State Reject", filename: "wsr.pdf", mimetype: "application/pdf", size: 1024 },
      });
      const { data: { documentId } } = initiateRes.json<{ data: { documentId: string } }>();

      await app.inject({
        method: "POST",
        url: `/api/documents/${documentId}/confirm-upload`,
        headers: { cookie: uploaderCookie },
        payload: { saveAsDraft: true },
      });
      // Document is now in "draft" state

      const res = await app.inject({
        method: "POST",
        url: `/api/documents/${documentId}/reject`,
        headers: { cookie: moderatorCookie },
        payload: { reason: "Bad document" },
      });
      expect(res.statusCode).toBe(422);
      const body = res.json<{ success: boolean }>();
      expect(body.success).toBe(false);
    }, 60_000);

    it("returns 400 when reason exceeds 1000 characters", async () => {
      const documentId = await seedDocumentInModeratorReview(app, uploaderCookie, `Long Reason ${Date.now()}`);
      const longReason = "x".repeat(1001);

      const res = await app.inject({
        method: "POST",
        url: `/api/documents/${documentId}/reject`,
        headers: { cookie: moderatorCookie },
        payload: { reason: longReason },
      });
      expect(res.statusCode).toBe(400);
    }, 60_000);

    it("returns 404 for non-existent document", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/documents/nonexistent-reject-xyz/reject",
        headers: { cookie: moderatorCookie },
        payload: { reason: "Does not exist" },
      });
      expect(res.statusCode).toBe(404);
    }, 30_000);
  });
});
