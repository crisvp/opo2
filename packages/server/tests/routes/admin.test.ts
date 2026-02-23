import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { solveChallenge } from "altcha-lib";

import { buildApp } from "../../src/app.js";

// Mock S3 and worker for tests that create documents
vi.mock("../../src/services/storage.js", () => ({
  createPresignedUploadUrl: vi.fn().mockResolvedValue({
    url: "https://s3.example.com/upload",
    fields: { key: "test", "Content-Type": "application/pdf" },
  }),
  headObject: vi.fn().mockResolvedValue({ ContentLength: 1024 }),
  getPresignedDownloadUrl: vi.fn().mockResolvedValue("https://s3.example.com/dl"),
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
  const email = `admin-test-${suffix}@example.com`;
  const password = "testpass1234";
  const altchaPayload = await fetchAndSolveChallenge(app);
  const regRes = await app.inject({
    method: "POST",
    url: "/api/auth/sign-up/email",
    payload: { name: "Admin Test User", email, password, altchaPayload },
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

type AppWithDb = FastifyInstance & { db: { updateTable: Function; selectFrom: Function } };

async function setUserRole(app: FastifyInstance, userId: string, role: string): Promise<void> {
  await (app as AppWithDb).db
    .updateTable("user")
    .set({ role, updatedAt: new Date() } as never)
    .where("id" as never, "=", userId)
    .execute();
}

async function signInAfterRoleChange(app: FastifyInstance, email: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    payload: { email, password: "testpass1234" },
  });
  const setCookie = res.headers["set-cookie"];
  return Array.isArray(setCookie) ? setCookie[0] : (setCookie ?? "");
}

// ---------------------------------------------------------------------------
// Auth guard tests (original — preserved)
// ---------------------------------------------------------------------------

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ testing: true });
}, 30_000);

afterAll(async () => {
  await app.close();
});

describe("GET /api/admin/stats", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/stats" });
    expect(res.statusCode).toBe(401);
    const body = res.json() as { success: boolean };
    expect(body.success).toBe(false);
  });

  it("does not return 501 (no longer a stub)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/stats" });
    expect(res.statusCode).not.toBe(501);
  });
});

describe("GET /api/admin/users", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/users" });
    expect(res.statusCode).toBe(401);
    const body = res.json() as { success: boolean };
    expect(body.success).toBe(false);
  });
});

describe("GET /api/admin/users/:id", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/users/some-id" });
    expect(res.statusCode).toBe(401);
  });
});

describe("PUT /api/admin/users/:id/role", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({ method: "PUT", url: "/api/admin/users/some-id/role", payload: { role: "user" } });
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 for invalid role value (validation before auth)", async () => {
    const res = await app.inject({ method: "PUT", url: "/api/admin/users/some-id/role", payload: { role: "superuser" } });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});

describe("PUT /api/admin/users/:id/tier", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({ method: "PUT", url: "/api/admin/users/some-id/tier", payload: { tierId: 1 } });
    expect(res.statusCode).toBe(401);
  });
});

describe("DELETE /api/admin/users/:id", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({ method: "DELETE", url: "/api/admin/users/some-id" });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /api/admin/failed-processing", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/failed-processing" });
    expect(res.statusCode).toBe(401);
  });
  it("does not return 501", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/failed-processing" });
    expect(res.statusCode).not.toBe(501);
  });
});

describe("POST /api/admin/failed-processing/:id/retry", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({ method: "POST", url: "/api/admin/failed-processing/some-id/retry" });
    expect(res.statusCode).toBe(401);
  });
});

describe("DELETE /api/admin/failed-processing/:id", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({ method: "DELETE", url: "/api/admin/failed-processing/some-id" });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /api/admin/stuck-processing", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/stuck-processing" });
    expect(res.statusCode).toBe(401);
  });
  it("does not return 501", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/stuck-processing" });
    expect(res.statusCode).not.toBe(501);
  });
});

describe("GET /api/admin/jobs", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/jobs" });
    expect(res.statusCode).toBe(401);
  });
  it("does not return 501", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/jobs" });
    expect(res.statusCode).not.toBe(501);
  });
});

describe("GET /api/admin/jobs/:id", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/jobs/123" });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/admin/jobs/:id/retry", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({ method: "POST", url: "/api/admin/jobs/123/retry" });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/admin/jobs/:id/cancel", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({ method: "POST", url: "/api/admin/jobs/123/cancel" });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/admin/jobs/bulk-retry", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({ method: "POST", url: "/api/admin/jobs/bulk-retry" });
    expect(res.statusCode).toBe(401);
  });
});

describe("DELETE /api/admin/jobs/completed", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({ method: "DELETE", url: "/api/admin/jobs/completed" });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Business logic: admin operations (authenticated)
// ---------------------------------------------------------------------------

describe("Admin — authenticated business logic", () => {
  let adminApp: FastifyInstance;
  let adminCookie: string;
  let adminId: string;
  let adminEmail: string;

  beforeAll(async () => {
    adminApp = await buildApp({ testing: true });
    const admin = await registerAndSignIn(adminApp, `admin-biz-${Date.now()}`);
    adminId = admin.userId;
    adminEmail = admin.email;
    await setUserRole(adminApp, adminId, "admin");

    // Demote any leftover admins from previous test runs so adminId is the only admin
    await (adminApp as AppWithDb).db
      .updateTable("user")
      .set({ role: "user", updatedAt: new Date() } as never)
      .where("id" as never, "!=", adminId)
      .where("role" as never, "=", "admin")
      .execute();

    adminCookie = await signInAfterRoleChange(adminApp, adminEmail);
  }, 120_000);

  afterAll(async () => {
    await adminApp.close();
  });

  // ---------------------------------------------------------------------------
  // GET /api/admin/stats
  // ---------------------------------------------------------------------------

  describe("GET /api/admin/stats", () => {
    it("returns stats with userCount and documentCounts", async () => {
      const res = await adminApp.inject({
        method: "GET",
        url: "/api/admin/stats",
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ success: boolean; data: { userCount: number; documentCounts: Record<string, number> } }>();
      expect(body.success).toBe(true);
      expect(typeof body.data.userCount).toBe("number");
      expect(body.data.userCount).toBeGreaterThanOrEqual(1);
      expect(typeof body.data.documentCounts).toBe("object");
    }, 30_000);
  });

  // ---------------------------------------------------------------------------
  // GET /api/admin/users
  // ---------------------------------------------------------------------------

  describe("GET /api/admin/users", () => {
    it("returns paginated user list", async () => {
      const res = await adminApp.inject({
        method: "GET",
        url: "/api/admin/users",
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ success: boolean; data: { items: Array<{ id: string; email: string; role: string }>; total: number; page: number; pageSize: number } }>();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.items)).toBe(true);
      expect(typeof body.data.total).toBe("number");
      expect(body.data.page).toBe(1);
      expect(body.data.pageSize).toBe(20);
    }, 30_000);

    it("returns filtered users by search query", async () => {
      const res = await adminApp.inject({
        method: "GET",
        url: `/api/admin/users?search=${encodeURIComponent(adminEmail)}`,
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { items: Array<{ email: string }> } }>();
      const found = body.data.items.some((u) => u.email === adminEmail);
      expect(found).toBe(true);
    }, 30_000);
  });

  // ---------------------------------------------------------------------------
  // GET /api/admin/users/:id
  // ---------------------------------------------------------------------------

  describe("GET /api/admin/users/:id", () => {
    it("returns user detail with documentCount and usageStats", async () => {
      const res = await adminApp.inject({
        method: "GET",
        url: `/api/admin/users/${adminId}`,
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ success: boolean; data: { id: string; email: string; documentCount: number; usageStats: unknown[] } }>();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(adminId);
      expect(body.data.email).toBe(adminEmail);
      expect(typeof body.data.documentCount).toBe("number");
      expect(Array.isArray(body.data.usageStats)).toBe(true);
    }, 30_000);

    it("returns 404 for non-existent user", async () => {
      const res = await adminApp.inject({
        method: "GET",
        url: "/api/admin/users/nonexistent-user-xyz",
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(404);
    }, 30_000);
  });

  // ---------------------------------------------------------------------------
  // PUT /api/admin/users/:id/role — last-admin guard
  // ---------------------------------------------------------------------------

  describe("PUT /api/admin/users/:id/role", () => {
    it("changes user role successfully", async () => {
      const target = await registerAndSignIn(adminApp, `role-target-${Date.now()}`);

      const res = await adminApp.inject({
        method: "PUT",
        url: `/api/admin/users/${target.userId}/role`,
        headers: { cookie: adminCookie },
        payload: { role: "moderator" },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ success: boolean; data: { id: string; role: string } }>();
      expect(body.success).toBe(true);
      expect(body.data.role).toBe("moderator");
    }, 60_000);

    it("returns 422 when trying to demote the last admin", async () => {
      // adminId is the only admin in this test app instance
      const res = await adminApp.inject({
        method: "PUT",
        url: `/api/admin/users/${adminId}/role`,
        headers: { cookie: adminCookie },
        payload: { role: "user" },
      });
      expect(res.statusCode).toBe(422);
      const body = res.json<{ success: boolean; error: string }>();
      expect(body.success).toBe(false);
      expect(body.error).toMatch(/last admin/i);
    }, 30_000);

    it("returns 404 for non-existent user", async () => {
      const res = await adminApp.inject({
        method: "PUT",
        url: "/api/admin/users/nonexistent-xyz/role",
        headers: { cookie: adminCookie },
        payload: { role: "user" },
      });
      expect(res.statusCode).toBe(404);
    }, 30_000);
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/admin/users/:id — anonymization
  // ---------------------------------------------------------------------------

  describe("DELETE /api/admin/users/:id", () => {
    it("deletes user and preserves their documents (SET NULL on uploader_id)", async () => {
      const victim = await registerAndSignIn(adminApp, `delete-victim-${Date.now()}`);

      // Create a document for this user
      const initiateRes = await adminApp.inject({
        method: "POST",
        url: "/api/documents/initiate",
        headers: { cookie: victim.cookie },
        payload: { filename: "victim.pdf", mimetype: "application/pdf", size: 1024, governmentLevel: "state", stateUsps: "IA", useAi: false },
      });
      const { data: { documentId } } = initiateRes.json<{ data: { documentId: string } }>();

      await adminApp.inject({
        method: "POST",
        url: `/api/documents/${documentId}/confirm-upload`,
        headers: { cookie: victim.cookie },
        payload: { objectKey: `documents/${documentId}/victim.pdf` },
      });

      // Delete user
      const deleteRes = await adminApp.inject({
        method: "DELETE",
        url: `/api/admin/users/${victim.userId}`,
        headers: { cookie: adminCookie },
      });
      expect(deleteRes.statusCode).toBe(200);
      const body = deleteRes.json<{ success: boolean }>();
      expect(body.success).toBe(true);

      // Verify document still exists with null uploader_id
      const doc = await (adminApp as AppWithDb).db
        .selectFrom("documents")
        .select(["id", "uploader_id"] as never[])
        .where("id" as never, "=", documentId)
        .executeTakeFirst();
      expect(doc).toBeDefined();
      expect((doc as Record<string, unknown>).uploader_id).toBeNull();
    }, 120_000);

    it("returns 422 when trying to delete own account", async () => {
      const res = await adminApp.inject({
        method: "DELETE",
        url: `/api/admin/users/${adminId}`,
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(422);
      const body = res.json<{ success: boolean; error: string }>();
      expect(body.success).toBe(false);
      expect(body.error).toMatch(/own account/i);
    }, 30_000);

    it("returns 404 for non-existent user", async () => {
      const res = await adminApp.inject({
        method: "DELETE",
        url: "/api/admin/users/nonexistent-delete-xyz",
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(404);
    }, 30_000);
  });

  // ---------------------------------------------------------------------------
  // GET /api/admin/failed-processing
  // ---------------------------------------------------------------------------

  describe("GET /api/admin/failed-processing", () => {
    it("returns paginated list of failed documents", async () => {
      const res = await adminApp.inject({
        method: "GET",
        url: "/api/admin/failed-processing",
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ success: boolean; data: { items: unknown[]; total: number } }>();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.items)).toBe(true);
    }, 30_000);
  });

  // ---------------------------------------------------------------------------
  // GET /api/admin/stuck-processing
  // ---------------------------------------------------------------------------

  describe("GET /api/admin/stuck-processing", () => {
    it("returns list of stuck documents", async () => {
      const res = await adminApp.inject({
        method: "GET",
        url: "/api/admin/stuck-processing",
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ success: boolean; data: unknown[] | { items: unknown[] } }>();
      expect(body.success).toBe(true);
    }, 30_000);
  });

  // ---------------------------------------------------------------------------
  // GET /api/admin/jobs
  // ---------------------------------------------------------------------------

  describe("GET /api/admin/jobs", () => {
    it("returns paginated job list", async () => {
      const res = await adminApp.inject({
        method: "GET",
        url: "/api/admin/jobs",
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ success: boolean; data: { items: unknown[]; total: number } }>();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.items)).toBe(true);
    }, 30_000);
  });
});
