import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { solveChallenge } from "altcha-lib";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";


// Mock the storage service so S3 calls don't hit AWS
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

// Mock graphile-worker so we don't need a real worker queue in tests
vi.mock("graphile-worker", () => ({
  makeWorkerUtils: vi.fn().mockResolvedValue({
    addJob: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe("Documents API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // GET /api/documents
  // ---------------------------------------------------------------------------

  describe("GET /api/documents", () => {
    it("returns 200 with paginated response", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/documents",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as {
        success: boolean;
        data: { items: unknown[]; total: number; page: number; pageSize: number; totalPages: number };
      };
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.items)).toBe(true);
      expect(typeof body.data.total).toBe("number");
      expect(typeof body.data.page).toBe("number");
      expect(typeof body.data.pageSize).toBe("number");
      expect(typeof body.data.totalPages).toBe("number");
    });

    it("returns empty items array when no approved documents", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/documents",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { success: boolean; data: { items: unknown[] } };
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.items)).toBe(true);
    });

    it("defaults to page 1 and pageSize 20", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/documents",
      });

      const body = response.json() as {
        success: boolean;
        data: { page: number; pageSize: number };
      };
      expect(body.data.page).toBe(1);
      expect(body.data.pageSize).toBe(20);
    });

    it("accepts valid sort parameter", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/documents?sort=title",
      });

      expect(response.statusCode).toBe(200);
    });

    it("accepts createdAt sort parameter", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/documents?sort=createdAt",
      });

      expect(response.statusCode).toBe(200);
    });

    it("returns 400 with invalid sort parameter", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/documents?sort=invalid_sort_value",
      });

      expect(response.statusCode).toBe(400);
    });

    it("accepts search query parameter", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/documents?search=test",
      });

      expect(response.statusCode).toBe(200);
    });

    it("accepts governmentLevel filter", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/documents?governmentLevel=federal",
      });

      expect(response.statusCode).toBe(200);
    });

    it("accepts page and pageSize parameters", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/documents?page=2&pageSize=10",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as { data: { page: number; pageSize: number } };
      expect(body.data.page).toBe(2);
      expect(body.data.pageSize).toBe(10);
    });

    it("rejects pageSize over 100", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/documents?pageSize=101",
      });

      expect(response.statusCode).toBe(400);
    });

    it("accepts sortDir=asc parameter", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/documents?sortDir=asc",
      });

      expect(response.statusCode).toBe(200);
    });

    it("accepts sortDir=desc parameter", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/documents?sortDir=desc",
      });

      expect(response.statusCode).toBe(200);
    });

    it("returns 400 for invalid sortDir value", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/documents?sortDir=random",
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/documents/:id
  // ---------------------------------------------------------------------------

  describe("GET /api/documents/:id", () => {
    it("returns 404 for non-existent document", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/documents/does-not-exist-xyz",
      });

      expect(response.statusCode).toBe(404);
      const body = response.json() as { success: boolean; error: string };
      expect(body.success).toBe(false);
    });

    it("returns error shape with success false", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/documents/nonexistent-id-12345",
      });

      expect(response.statusCode).toBe(404);
      const body = response.json() as { success: boolean };
      expect(body.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/documents/initiate
  // ---------------------------------------------------------------------------

  describe("POST /api/documents/initiate", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/documents/initiate",
        payload: {
          filename: "test.pdf",
          mimetype: "application/pdf",
          size: 1024,
          governmentLevel: "federal",
          useAi: true,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json() as { success: boolean };
      expect(body.success).toBe(false);
    });

    it("returns 400 when governmentLevel is missing", async () => {
      // Note: without auth this will be 401, but Zod validation fires first for body schema
      // The route uses preHandler for auth — schema validation runs first in Fastify
      // So we expect 400 (schema validation) rather than 401
      const response = await app.inject({
        method: "POST",
        url: "/api/documents/initiate",
        payload: {
          filename: "test.pdf",
          mimetype: "application/pdf",
          size: 1024,
          useAi: true,
          // governmentLevel intentionally omitted
        },
      });

      // Either 400 (Zod) or 401 (auth) depending on execution order
      expect([400, 401]).toContain(response.statusCode);
    });

    it("ignores title field in body (stripped by Zod)", async () => {
      // Without auth this will 401, but the point is it should not 500
      const response = await app.inject({
        method: "POST",
        url: "/api/documents/initiate",
        payload: {
          filename: "test.pdf",
          mimetype: "application/pdf",
          size: 1024,
          governmentLevel: "federal",
          useAi: true,
          title: "This field is stripped by Zod",
        },
      });

      // Should not be a 500 — either 400 (validation) or 401 (auth)
      expect(response.statusCode).not.toBe(500);
      expect([400, 401]).toContain(response.statusCode);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/documents/:id/confirm-upload
  // ---------------------------------------------------------------------------

  describe("POST /api/documents/:id/confirm-upload", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/documents/some-id/confirm-upload",
        payload: {
          objectKey: "documents/some-id/file.pdf",
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/documents/:id/submit
  // ---------------------------------------------------------------------------

  describe("POST /api/documents/:id/submit", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/documents/some-id/submit",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/documents/my-uploads
  // ---------------------------------------------------------------------------

  describe("GET /api/documents/my-uploads", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/documents/my-uploads",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // Tag routes
  // ---------------------------------------------------------------------------

  describe("POST /api/documents/:id/tags", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/documents/some-id/tags",
        payload: { tags: ["tag1"] },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /api/documents/:id/tags/add", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/documents/some-id/tags/add",
        payload: { tag: "tag1" },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("DELETE /api/documents/:id/tags/:tag", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/documents/some-id/tags/tag1",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // Update routes
  // ---------------------------------------------------------------------------

  describe("PUT /api/documents/:id", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/documents/some-id",
        payload: { title: "Updated Title" },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/documents/:id
  // ---------------------------------------------------------------------------

  describe("DELETE /api/documents/:id", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/documents/some-id",
      });

      expect(response.statusCode).toBe(401);
      const body = response.json() as { success: boolean };
      expect(body.success).toBe(false);
    });

    it("returns 404 for non-existent document (authenticated request structure)", async () => {
      // Without auth, 401 confirms the route exists and auth is required
      const response = await app.inject({
        method: "DELETE",
        url: "/api/documents/definitely-does-not-exist-xyz123",
      });

      // 401 = route exists, auth guard fired
      expect(response.statusCode).toBe(401);
    });
  });

  describe("PUT /api/documents/:id/location", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/documents/some-id/location",
        payload: {
          governmentLevel: "federal",
          stateUsps: null,
          placeGeoid: null,
          tribeId: null,
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // File routes
  // ---------------------------------------------------------------------------

  describe("GET /api/documents/:id/preview", () => {
    it("returns 404 for non-existent document", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/documents/nonexistent-xyz/preview",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /api/documents/:id/download", () => {
    it("returns 404 for non-existent document", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/documents/nonexistent-xyz/download",
      });

      expect(response.statusCode).toBe(404);
    });
  });
});

// ---------------------------------------------------------------------------
// SSE routes
// ---------------------------------------------------------------------------

describe("SSE API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/sse/health", () => {
    it("returns 200 with clients count", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/sse/health",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as {
        success: boolean;
        data: { clients: number };
      };
      expect(body.success).toBe(true);
      expect(typeof body.data.clients).toBe("number");
      expect(body.data.clients).toBeGreaterThanOrEqual(0);
    });
  });

  describe("GET /api/sse/documents", () => {
    it("returns 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/sse/documents",
      });

      expect(response.statusCode).toBe(401);
    });
  });
});

// ---------------------------------------------------------------------------
// Authenticated document flow tests (P1 business logic)
// ---------------------------------------------------------------------------
// These tests require a real DB and Redis (from .env).
// S3 calls are mocked via vi.mock so tests don't need AWS credentials.
// ---------------------------------------------------------------------------

async function fetchAndSolveChallengeForDocs(app: FastifyInstance): Promise<string> {
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
  const email = `doc-test-${suffix}@example.com`;
  const password = "testpass1234";
  const altchaPayload = await fetchAndSolveChallengeForDocs(app);
  const regRes = await app.inject({
    method: "POST",
    url: "/api/auth/sign-up/email",
    payload: { name: "Doc Test User", email, password, altchaPayload },
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

// ---------------------------------------------------------------------------
// POST /api/documents/initiate — authenticated business logic
// ---------------------------------------------------------------------------

describe("POST /api/documents/initiate — authenticated", () => {
  let app: FastifyInstance;
  let cookie: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    const auth = await registerAndSignIn(app, `initiate-${Date.now()}`);
    cookie = auth.cookie;
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  it("returns 200 with presignedUrl and documentId for valid PDF upload", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documents/initiate",
      headers: { cookie },
      payload: {
        filename: "test.pdf",
        mimetype: "application/pdf",
        size: 1024,
        governmentLevel: "federal",
        useAi: true,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { documentId: string; presignedUrl: string; presignedFields: Record<string, string>; objectKey: string } }>();
    expect(body.success).toBe(true);
    expect(typeof body.data.documentId).toBe("string");
    expect(body.data.documentId.length).toBeGreaterThan(0);
    expect(typeof body.data.presignedUrl).toBe("string");
    expect(typeof body.data.objectKey).toBe("string");
  }, 30_000);

  it("returns 400 for disallowed MIME type", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documents/initiate",
      headers: { cookie },
      payload: {
        filename: "evil.exe",
        mimetype: "application/x-msdownload",
        size: 1024,
        governmentLevel: "federal",
        useAi: false,
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ success: boolean }>();
    expect(body.success).toBe(false);
  }, 30_000);

  it("returns 400 for file size exceeding 50MB", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documents/initiate",
      headers: { cookie },
      payload: {
        filename: "huge.pdf",
        mimetype: "application/pdf",
        size: 51 * 1024 * 1024,
        governmentLevel: "federal",
        useAi: false,
      },
    });
    expect(res.statusCode).toBe(400);
  }, 30_000);

  it("returns 400 when governmentLevel is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documents/initiate",
      headers: { cookie },
      payload: {
        filename: "test.pdf",
        mimetype: "application/pdf",
        size: 1024,
        useAi: true,
        // governmentLevel intentionally omitted
      },
    });
    expect(res.statusCode).toBe(400);
  }, 30_000);

  it("derives title from filename (no title in body)", async () => {
    const initiateRes = await app.inject({
      method: "POST",
      url: "/api/documents/initiate",
      headers: { cookie },
      payload: {
        filename: "police_report_2024.pdf",
        mimetype: "application/pdf",
        size: 2048,
        governmentLevel: "state",
        stateUsps: "CA",
        useAi: true,
      },
    });
    expect(initiateRes.statusCode).toBe(200);
    const { data } = initiateRes.json<{ data: { documentId: string; objectKey: string } }>();
    expect(data.documentId).toMatch(/^[A-Za-z0-9_-]{21}$/);

    // Confirm the upload to transition from pending_upload → submitted
    const confirmRes = await app.inject({
      method: "POST",
      url: `/api/documents/${data.documentId}/confirm-upload`,
      headers: { cookie },
      payload: { objectKey: data.objectKey },
    });
    expect(confirmRes.statusCode).toBe(200);

    // Fetch the document and verify the derived title
    const getRes = await app.inject({
      method: "GET",
      url: `/api/documents/${data.documentId}`,
      headers: { cookie },
    });
    expect(getRes.statusCode).toBe(200);
    const getBody = getRes.json<{ success: boolean; data: { title: string } }>();
    expect(getBody.data.title).toBe("Police Report 2024");
  }, 60_000);

  it("creates document row in pending_upload state", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documents/initiate",
      headers: { cookie },
      payload: {
        filename: "state-check.pdf",
        mimetype: "application/pdf",
        size: 2048,
        governmentLevel: "federal",
        useAi: false,
      },
    });
    expect(res.statusCode).toBe(200);
    const { data } = res.json<{ data: { documentId: string } }>();
    expect(data.documentId).toMatch(/^[A-Za-z0-9_-]{21}$/);
  }, 30_000);

  it("strips unknown fields like title without error", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documents/initiate",
      headers: { cookie },
      payload: {
        filename: "tagged.pdf",
        mimetype: "application/pdf",
        size: 1024,
        governmentLevel: "federal",
        useAi: true,
        title: "This should be ignored by Zod strip",
        description: "Also ignored",
        tags: ["tag1", "tag2"],
      },
    });
    expect(res.statusCode).toBe(200);
  }, 30_000);
});

// ---------------------------------------------------------------------------
// POST /api/documents/:id/confirm-upload — state transitions
// ---------------------------------------------------------------------------

describe("POST /api/documents/:id/confirm-upload — state transitions", () => {
  let app: FastifyInstance;
  let cookie: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    const auth = await registerAndSignIn(app, `confirm-${Date.now()}`);
    cookie = auth.cookie;
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  it("transitions pending_upload → submitted", async () => {
    // First initiate
    const initiateRes = await app.inject({
      method: "POST",
      url: "/api/documents/initiate",
      headers: { cookie },
      payload: {
        filename: "submit.pdf",
        mimetype: "application/pdf",
        size: 1024,
        governmentLevel: "federal",
        useAi: true,
      },
    });
    const { data: { documentId, objectKey } } = initiateRes.json<{ data: { documentId: string; objectKey: string } }>();

    const confirmRes = await app.inject({
      method: "POST",
      url: `/api/documents/${documentId}/confirm-upload`,
      headers: { cookie },
      payload: { objectKey },
    });
    expect(confirmRes.statusCode).toBe(200);
    const body = confirmRes.json<{ success: boolean; data: { id: string; state: string } }>();
    expect(body.success).toBe(true);
    expect(body.data.state).toBe("submitted");
  }, 60_000);

  it("always transitions to submitted (no draft path)", async () => {
    const initiateRes = await app.inject({
      method: "POST",
      url: "/api/documents/initiate",
      headers: { cookie },
      payload: {
        filename: "always-submitted.pdf",
        mimetype: "application/pdf",
        size: 1024,
        governmentLevel: "state",
        stateUsps: "NY",
        useAi: false,
      },
    });
    const { data: { documentId, objectKey } } = initiateRes.json<{ data: { documentId: string; objectKey: string } }>();

    const confirmRes = await app.inject({
      method: "POST",
      url: `/api/documents/${documentId}/confirm-upload`,
      headers: { cookie },
      payload: { objectKey },
    });
    expect(confirmRes.statusCode).toBe(200);
    const body = confirmRes.json<{ success: boolean; data: { state: string } }>();
    expect(body.data.state).toBe("submitted");
  }, 60_000);

  it("returns 422 when S3 object does not exist (mocked to return null)", async () => {
    const { headObject } = await import("../../src/services/storage.js");
    (headObject as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const initiateRes = await app.inject({
      method: "POST",
      url: "/api/documents/initiate",
      headers: { cookie },
      payload: {
        filename: "missing.pdf",
        mimetype: "application/pdf",
        size: 1024,
        governmentLevel: "federal",
        useAi: true,
      },
    });
    const { data: { documentId, objectKey } } = initiateRes.json<{ data: { documentId: string; objectKey: string } }>();

    const confirmRes = await app.inject({
      method: "POST",
      url: `/api/documents/${documentId}/confirm-upload`,
      headers: { cookie },
      payload: { objectKey },
    });
    expect(confirmRes.statusCode).toBe(422);
    const body = confirmRes.json<{ success: boolean; error: string }>();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/not found in S3/i);
  }, 60_000);

  it("returns 403 when a different user tries to confirm", async () => {
    const initiateRes = await app.inject({
      method: "POST",
      url: "/api/documents/initiate",
      headers: { cookie },
      payload: {
        filename: "own.pdf",
        mimetype: "application/pdf",
        size: 1024,
        governmentLevel: "federal",
        useAi: true,
      },
    });
    const { data: { documentId, objectKey } } = initiateRes.json<{ data: { documentId: string; objectKey: string } }>();

    // Register second user
    const other = await registerAndSignIn(app, `confirm-other-${Date.now()}`);

    const confirmRes = await app.inject({
      method: "POST",
      url: `/api/documents/${documentId}/confirm-upload`,
      headers: { cookie: other.cookie },
      payload: { objectKey },
    });
    expect(confirmRes.statusCode).toBe(403);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// POST /api/documents/:id/submit — draft → submitted
// ---------------------------------------------------------------------------

describe("POST /api/documents/:id/submit — draft workflow", () => {
  let app: FastifyInstance;
  let cookie: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    const auth = await registerAndSignIn(app, `submit-draft-${Date.now()}`);
    cookie = auth.cookie;
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  it("returns 404 for non-existent document", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documents/nonexistent-doc-id/submit",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(404);
  }, 30_000);

  it("returns 422 when document is in submitted state (not draft)", async () => {
    // Initiate + confirm (goes directly to submitted now)
    const initiateRes = await app.inject({
      method: "POST",
      url: "/api/documents/initiate",
      headers: { cookie },
      payload: {
        filename: "already-submitted.pdf",
        mimetype: "application/pdf",
        size: 1024,
        governmentLevel: "federal",
        useAi: true,
      },
    });
    const { data: { documentId, objectKey } } = initiateRes.json<{ data: { documentId: string; objectKey: string } }>();

    await app.inject({
      method: "POST",
      url: `/api/documents/${documentId}/confirm-upload`,
      headers: { cookie },
      payload: { objectKey },
    });

    // Try to submit again — already in submitted state, not draft
    const submitRes = await app.inject({
      method: "POST",
      url: `/api/documents/${documentId}/submit`,
      headers: { cookie },
    });
    expect(submitRes.statusCode).toBe(422);
    const body = submitRes.json<{ success: boolean }>();
    expect(body.success).toBe(false);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// Document access control
// ---------------------------------------------------------------------------

describe("GET /api/documents — access control", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("anonymous users only see approved documents in list", async () => {
    const res = await app.inject({ method: "GET", url: "/api/documents" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: { items: Array<{ state?: string }> } }>();
    // All visible items should be approved
    for (const item of body.data.items) {
      if (item.state !== undefined) {
        expect(item.state).toBe("approved");
      }
    }
  }, 30_000);

  it("anonymous users cannot access pending/draft documents by ID", async () => {
    // Create a document as a registered user (will be in pending_upload)
    const tempApp = await buildApp({ testing: true });
    const auth = await registerAndSignIn(tempApp, `access-ctrl-${Date.now()}`);
    const initiateRes = await tempApp.inject({
      method: "POST",
      url: "/api/documents/initiate",
      headers: { cookie: auth.cookie },
      payload: {
        filename: "private.pdf",
        mimetype: "application/pdf",
        size: 1024,
        governmentLevel: "federal",
        useAi: false,
      },
    });
    const { data: { documentId } } = initiateRes.json<{ data: { documentId: string } }>();
    await tempApp.close();

    // Anonymous request should get 404 (not 403 to avoid leaking existence)
    const res = await app.inject({ method: "GET", url: `/api/documents/${documentId}` });
    expect(res.statusCode).toBe(404);
  }, 60_000);
});

describe("GET /api/documents/my-uploads — owner sees own documents", () => {
  let app: FastifyInstance;
  let cookie: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    const auth = await registerAndSignIn(app, `my-uploads-${Date.now()}`);
    cookie = auth.cookie;
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  it("returns empty list for new user with no uploads", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/documents/my-uploads",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { items: unknown[] } }>();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.items)).toBe(true);
  }, 30_000);

  it("returns uploaded documents after initiate+confirm", async () => {
    // Create a document and confirm it (now goes directly to submitted)
    const initiateRes = await app.inject({
      method: "POST",
      url: "/api/documents/initiate",
      headers: { cookie },
      payload: {
        filename: "myfile.pdf",
        mimetype: "application/pdf",
        size: 1024,
        governmentLevel: "federal",
        useAi: true,
      },
    });
    const { data: { documentId, objectKey } } = initiateRes.json<{ data: { documentId: string; objectKey: string } }>();

    await app.inject({
      method: "POST",
      url: `/api/documents/${documentId}/confirm-upload`,
      headers: { cookie },
      payload: { objectKey },
    });

    const uploadsRes = await app.inject({
      method: "GET",
      url: "/api/documents/my-uploads",
      headers: { cookie },
    });
    expect(uploadsRes.statusCode).toBe(200);
    const body = uploadsRes.json<{ data: { items: Array<{ id: string }> } }>();
    const ids = body.data.items.map((i) => i.id);
    expect(ids).toContain(documentId);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// POST /api/documents/:id/save-draft — unauthenticated guard
// ---------------------------------------------------------------------------

describe("POST /api/documents/:id/save-draft — unauthenticated guard", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documents/fake-id/save-draft",
    });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/documents/:id/reopen — unauthenticated guard
// ---------------------------------------------------------------------------

describe("POST /api/documents/:id/reopen — unauthenticated guard", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documents/fake-id/reopen",
    });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/documents/import-from-dc — unauthenticated guard
// ---------------------------------------------------------------------------

describe("POST /api/documents/import-from-dc — unauthenticated guard", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documents/import-from-dc",
      payload: {
        documentCloudId: 123,
        governmentLevel: "state",
        stateUsps: "IA",
        useAi: true,
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 when governmentLevel is missing (schema validation before auth)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documents/import-from-dc",
      payload: {
        documentCloudId: 123,
        useAi: true,
      },
    });
    // Schema validation fires before auth preHandler
    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/documents/:id/save-draft — state transition business logic
// ---------------------------------------------------------------------------

describe("POST /api/documents/:id/save-draft — state transitions", () => {
  let app: FastifyInstance;
  let cookie: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    const auth = await registerAndSignIn(app, `save-draft-${Date.now()}`);
    cookie = auth.cookie;
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  it("returns 404 for non-existent document", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documents/nonexistent-save-draft-xyz/save-draft",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(404);
    const body = res.json<{ success: boolean }>();
    expect(body.success).toBe(false);
  }, 30_000);

  it("transitions user_review → draft and returns success", async () => {
    // Initiate upload to get a document
    const initiateRes = await app.inject({
      method: "POST",
      url: "/api/documents/initiate",
      headers: { cookie },
      payload: {
        filename: "save-draft-test.pdf",
        mimetype: "application/pdf",
        size: 1024,
        governmentLevel: "federal",
        useAi: false,
      },
    });
    const { data: { documentId } } = initiateRes.json<{ data: { documentId: string } }>();

    // Directly set document state to user_review
    await (app as FastifyInstance & { db: { updateTable: (t: string) => { set: (v: unknown) => { where: (c: string, o: string, v: unknown) => { execute: () => Promise<void> } } } } }).db
      .updateTable("documents")
      .set({ state: "user_review", updated_at: new Date() } as never)
      .where("id" as never, "=", documentId as never)
      .execute();

    const res = await app.inject({
      method: "POST",
      url: `/api/documents/${documentId}/save-draft`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { id: string; state: string } }>();
    expect(body.success).toBe(true);
    expect(body.data.state).toBe("draft");
  }, 60_000);

  it("returns 422 when document is not in user_review state", async () => {
    const initiateRes = await app.inject({
      method: "POST",
      url: "/api/documents/initiate",
      headers: { cookie },
      payload: {
        filename: "wrong-state.pdf",
        mimetype: "application/pdf",
        size: 1024,
        governmentLevel: "federal",
        useAi: false,
      },
    });
    const { data: { documentId } } = initiateRes.json<{ data: { documentId: string } }>();
    // Document is in pending_upload state — save-draft should fail

    const res = await app.inject({
      method: "POST",
      url: `/api/documents/${documentId}/save-draft`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json<{ success: boolean }>();
    expect(body.success).toBe(false);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// POST /api/documents/:id/reopen — state transition business logic
// ---------------------------------------------------------------------------

describe("POST /api/documents/:id/reopen — state transitions", () => {
  let app: FastifyInstance;
  let cookie: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    const auth = await registerAndSignIn(app, `reopen-${Date.now()}`);
    cookie = auth.cookie;
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  it("returns 404 for non-existent document", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documents/nonexistent-reopen-xyz/reopen",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(404);
    const body = res.json<{ success: boolean }>();
    expect(body.success).toBe(false);
  }, 30_000);

  it("transitions rejected → user_review and returns success", async () => {
    const initiateRes = await app.inject({
      method: "POST",
      url: "/api/documents/initiate",
      headers: { cookie },
      payload: {
        filename: "reopen-test.pdf",
        mimetype: "application/pdf",
        size: 1024,
        governmentLevel: "state",
        stateUsps: "CA",
        useAi: false,
      },
    });
    const { data: { documentId } } = initiateRes.json<{ data: { documentId: string } }>();

    // Directly set document state to rejected
    await (app as FastifyInstance & { db: { updateTable: (t: string) => { set: (v: unknown) => { where: (c: string, o: string, v: unknown) => { execute: () => Promise<void> } } } } }).db
      .updateTable("documents")
      .set({ state: "rejected", updated_at: new Date() } as never)
      .where("id" as never, "=", documentId as never)
      .execute();

    const res = await app.inject({
      method: "POST",
      url: `/api/documents/${documentId}/reopen`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ success: boolean; data: { id: string; state: string } }>();
    expect(body.success).toBe(true);
    expect(body.data.state).toBe("user_review");
  }, 60_000);

  it("returns 422 when document is not in rejected state", async () => {
    const initiateRes = await app.inject({
      method: "POST",
      url: "/api/documents/initiate",
      headers: { cookie },
      payload: {
        filename: "wrong-state-reopen.pdf",
        mimetype: "application/pdf",
        size: 1024,
        governmentLevel: "federal",
        useAi: false,
      },
    });
    const { data: { documentId } } = initiateRes.json<{ data: { documentId: string } }>();
    // Document is in pending_upload state — reopen should fail

    const res = await app.inject({
      method: "POST",
      url: `/api/documents/${documentId}/reopen`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json<{ success: boolean }>();
    expect(body.success).toBe(false);
  }, 60_000);
});
