# Upload & Review Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the document upload/review flow: simplified upload form (file or DC + Document Source + AI toggle), state-driven `/documents/:id` page, dual-mode review UI, SSE notifications, and a consolidated profile API with AI availability.

**Architecture:** The document detail page at `/documents/:id` becomes state-driven — rendering a processing banner, dual-mode review view, rejected controls, or read-only detail based on `document.state`. SSE events (`document:ready_for_review`, `profile:updated`) drive live UI transitions without navigation. The upload form collapses to a single page; all metadata collection moves to the review stage.

**Tech Stack:** Fastify + Zod + Kysely (server), Vue 3 + TanStack Query + PrimeVue v4 (frontend), PostgreSQL LISTEN/NOTIFY + EventSource (SSE), Graphile Worker (processing pipeline).

**Design doc:** `docs/plans/2026-02-23-upload-review-flow-design.md`

---

## Reading before starting

Before touching any code, read these files in full:
- `packages/shared/src/constants/status.ts`
- `packages/shared/src/types/document.ts`
- `packages/server/src/routes/documents/upload.ts`
- `packages/server/src/routes/profile/index.ts`
- `packages/server/src/jobs/tasks/pipeline-complete.ts`
- `packages/server/src/services/sse.ts`
- `packages/web/src/composables/useDocumentSSE.ts`
- `packages/web/src/views/UploadView.vue`
- `packages/web/src/views/DocumentDetailView.vue`

---

## Task 1: Update shared state machine

**Files:**
- Modify: `packages/shared/src/constants/status.ts`
- Test: `packages/shared/tests/status.test.ts` (create if it doesn't exist)

**Step 1: Write failing tests**

```typescript
// packages/shared/tests/status.test.ts
import { describe, it, expect } from "vitest";
import {
  VALID_STATE_TRANSITIONS,
  REVIEW_STATES,
  DELETABLE_STATES,
  TERMINAL_STATES,
  isValidStateTransition,
} from "../src/constants/status";

describe("VALID_STATE_TRANSITIONS", () => {
  it("pending_upload only transitions to submitted (not draft)", () => {
    expect(VALID_STATE_TRANSITIONS.pending_upload).toEqual(["submitted"]);
  });
  it("draft transitions to moderator_review only", () => {
    expect(VALID_STATE_TRANSITIONS.draft).toEqual(["moderator_review"]);
  });
  it("user_review can transition to draft or moderator_review", () => {
    expect(VALID_STATE_TRANSITIONS.user_review).toContain("draft");
    expect(VALID_STATE_TRANSITIONS.user_review).toContain("moderator_review");
  });
  it("rejected can transition to submitted or user_review", () => {
    expect(VALID_STATE_TRANSITIONS.rejected).toContain("submitted");
    expect(VALID_STATE_TRANSITIONS.rejected).toContain("user_review");
  });
  it("approved has no transitions", () => {
    expect(VALID_STATE_TRANSITIONS.approved).toEqual([]);
  });
});

describe("REVIEW_STATES", () => {
  it("contains user_review and draft", () => {
    expect(REVIEW_STATES).toContain("user_review");
    expect(REVIEW_STATES).toContain("draft");
  });
});

describe("TERMINAL_STATES", () => {
  it("only contains approved (not rejected)", () => {
    expect(TERMINAL_STATES).toEqual(["approved"]);
  });
});

describe("isValidStateTransition", () => {
  it("allows user_review → draft", () => {
    expect(isValidStateTransition("user_review", "draft")).toBe(true);
  });
  it("allows draft → moderator_review", () => {
    expect(isValidStateTransition("draft", "moderator_review")).toBe(true);
  });
  it("allows rejected → user_review", () => {
    expect(isValidStateTransition("rejected", "user_review")).toBe(true);
  });
  it("disallows pending_upload → draft", () => {
    expect(isValidStateTransition("pending_upload", "draft")).toBe(false);
  });
  it("disallows draft → submitted", () => {
    expect(isValidStateTransition("draft", "submitted")).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd packages/shared && npx vitest run tests/status.test.ts
```

Expected: FAIL — transition assertions don't match current values.

**Step 3: Update `packages/shared/src/constants/status.ts`**

Replace `VALID_STATE_TRANSITIONS` and state groups:

```typescript
export const VALID_STATE_TRANSITIONS: Record<DocumentState, DocumentState[]> = {
  pending_upload: ["submitted"],
  draft: ["moderator_review"],
  submitted: ["processing"],
  processing: ["user_review", "moderator_review", "processing_failed"],
  processing_failed: ["submitted"],
  user_review: ["draft", "moderator_review"],
  moderator_review: ["approved", "rejected"],
  approved: [],
  rejected: ["submitted", "user_review"],
};

export const PROCESSING_STATES: DocumentState[] = ["submitted", "processing"];
export const REVIEW_STATES: DocumentState[] = ["user_review", "draft"];
export const DELETABLE_STATES: DocumentState[] = ["draft", "processing_failed", "rejected", "pending_upload"];
export const TERMINAL_STATES: DocumentState[] = ["approved"];
// EDITABLE_STATES removed — editing happens inside the review view
```

**Step 4: Run tests**

```bash
cd packages/shared && npx vitest run tests/status.test.ts
```

Expected: PASS

**Step 5: Check for usages of EDITABLE_STATES and fix them**

```bash
grep -r "EDITABLE_STATES" packages/ --include="*.ts" --include="*.vue" -l
```

For each file found: replace with `REVIEW_STATES` where logic is about review mode, or `DELETABLE_STATES` where logic is about deletion.

**Step 6: Commit**

```bash
git add packages/shared/src/constants/status.ts packages/shared/tests/status.test.ts
git commit -m "feat(shared): update state machine for upload/review flow redesign"
```

---

## Task 2: Update shared Zod schemas

**Files:**
- Modify: `packages/shared/src/types/document.ts`
- Modify: `packages/shared/src/types/user.ts`

**Step 1: Update `createDocumentSchema` in `packages/shared/src/types/document.ts`**

Remove `title`, `description`, `documentDate`, `category`, `tags`, `governmentEntityId`, `saveAsDraft`. Make `governmentLevel` required. Add `useAi`.

```typescript
export const initiateUploadSchema = z.object({
  filename: z.string().min(1).max(500),
  mimetype: z.string().min(1),
  size: z.number().int().positive().max(52_428_800), // 50 MB
  governmentLevel: z.enum(["federal", "state", "place", "tribal"]),
  stateUsps: z.string().length(2).optional(),
  placeGeoid: z.string().optional(),
  tribeId: z.string().optional(),
  useAi: z.boolean(),
});

export type InitiateUploadInput = z.infer<typeof initiateUploadSchema>;

export const confirmUploadSchema = z.object({
  objectKey: z.string().min(1),
});

export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;

export const importFromDcSchema = z.object({
  documentCloudId: z.number().int().positive(),
  governmentLevel: z.enum(["federal", "state", "place", "tribal"]),
  stateUsps: z.string().length(2).optional(),
  placeGeoid: z.string().optional(),
  tribeId: z.string().optional(),
  useAi: z.boolean(),
});

export type ImportFromDcInput = z.infer<typeof importFromDcSchema>;
```

Keep the existing `updateDocumentSchema`, `updateDocumentLocationSchema`, etc. — they are still used in the review Edit tab.

Keep `createDocumentSchema` for now but mark it deprecated (the server upload route will switch to `initiateUploadSchema`).

**Step 2: Add `aiSuggestionsEnabled` to user type in `packages/shared/src/types/user.ts`**

```typescript
export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: z.enum(["admin", "moderator", "user"]),
  tier: z.number().int().positive(),
  emailVerified: z.boolean(),
  image: z.string().nullable().optional(),
  aiSuggestionsEnabled: z.boolean().default(true),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
```

Add profile response schema:

```typescript
export const profileResponseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().email(),
  role: z.enum(["admin", "moderator", "user"]),
  tier: z.number().int().positive(),
  tierName: z.string(),
  aiSuggestions: z.object({
    enabled: z.boolean(),
    available: z.boolean(),
    usingOwnKey: z.boolean(),
    limits: z.object({
      monthly: z.number().nullable(),
      used: z.number(),
      remaining: z.number().nullable(),
    }),
  }),
  location: z.object({
    stateUsps: z.string().nullable(),
    placeGeoid: z.string().nullable(),
  }),
  createdAt: z.coerce.date(),
});

export type ProfileResponse = z.infer<typeof profileResponseSchema>;

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  aiSuggestionsEnabled: z.boolean().optional(),
  stateUsps: z.string().length(2).nullable().optional(),
  placeGeoid: z.string().nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
```

**Step 3: Build shared to check for type errors**

```bash
cd packages/shared && npx tsc --noEmit
```

Expected: no errors (or only errors in files that used the old schemas — fix those).

**Step 4: Commit**

```bash
git add packages/shared/src/types/
git commit -m "feat(shared): add upload/review schemas and profile response type"
```

---

## Task 3: Database migration

**Files:**
- Create: `packages/server/migrations/005_upload_review_flow.sql`
- Modify: `packages/server/src/migrations/run.ts` (add to hardcoded list)

**Step 1: Create the migration SQL**

```sql
-- packages/server/migrations/005_upload_review_flow.sql

-- Add ai_suggestions_enabled to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS ai_suggestions_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Add user_id, used_system_key, total_tokens to llm_call_logs
ALTER TABLE llm_call_logs
  ADD COLUMN IF NOT EXISTS user_id VARCHAR REFERENCES "user"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS used_system_key BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS total_tokens INTEGER;

-- Index for monthly usage queries
CREATE INDEX IF NOT EXISTS idx_llm_call_logs_user_id_started_at
  ON llm_call_logs (user_id, started_at);

-- Trigger function for profile:updated SSE notifications
CREATE OR REPLACE FUNCTION notify_profile_changed()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('op_profile_changed', json_build_object('userId', NEW.id)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on user table
DROP TRIGGER IF EXISTS user_profile_notify ON "user";
CREATE TRIGGER user_profile_notify
  AFTER UPDATE ON "user"
  FOR EACH ROW EXECUTE FUNCTION notify_profile_changed();

-- Trigger function for user_api_keys (uses user_id column)
CREATE OR REPLACE FUNCTION notify_profile_changed_api_keys()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('op_profile_changed', json_build_object('userId', NEW.user_id)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on user_api_keys table
DROP TRIGGER IF EXISTS user_api_keys_profile_notify ON user_api_keys;
CREATE TRIGGER user_api_keys_profile_notify
  AFTER UPDATE ON user_api_keys
  FOR EACH ROW EXECUTE FUNCTION notify_profile_changed_api_keys();
```

**Step 2: Register migration in `packages/server/src/migrations/run.ts`**

Find the hardcoded migration list array and add the new file:

```typescript
// Before:
const migrations = [
  "001_initial_schema.sql",
  "002_add_two_factor_enabled.sql",
  "003_seed_catalog_assoc_types.sql",
  "004_widen_places_lsad.sql",
];

// After:
const migrations = [
  "001_initial_schema.sql",
  "002_add_two_factor_enabled.sql",
  "003_seed_catalog_assoc_types.sql",
  "004_widen_places_lsad.sql",
  "005_upload_review_flow.sql",
];
```

**Step 3: Run the migration**

```bash
cd packages/server && npm run migrate
```

Expected: `005_upload_review_flow.sql applied successfully`

**Step 4: Update Kysely types** — if the project generates Kysely types from the DB schema (check for a codegen script in `package.json`), run it now. If types are maintained manually, add `ai_suggestions_enabled` to the User interface in the Kysely type file (look in `packages/server/src/db/` or `packages/server/src/types/db.ts`).

**Step 5: Commit**

```bash
git add packages/server/migrations/005_upload_review_flow.sql packages/server/src/migrations/run.ts
git commit -m "feat(server): migration for upload/review flow (ai_suggestions_enabled, llm_call_logs columns, profile triggers)"
```

---

## Task 4: AI availability service

**Files:**
- Create: `packages/server/src/services/ai-availability.ts`
- Test: `packages/server/tests/services/ai-availability.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/server/tests/services/ai-availability.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// We'll mock the db and env; test the pure logic
describe("getAiAvailability", () => {
  it("returns available=true, usingOwnKey=true when user has own API key", async () => {
    // Mock db to return a user_api_keys row
    // Mock no system key needed
    // Assert: available=true, usingOwnKey=true, limits.monthly=null
  });

  it("returns available=true, usingOwnKey=false when system key exists and user within limits", async () => {
    // Mock: no user api key, system key in env, user used 5 of 10 monthly calls
    // Assert: available=true, usingOwnKey=false, limits.monthly=10, used=5, remaining=5
  });

  it("returns available=false when no user key and no system key configured", async () => {
    // Mock: no user api key, no OPENROUTER_API_KEY in env
    // Assert: available=false
  });

  it("returns available=false when system key exists but user exhausted monthly limit", async () => {
    // Mock: no user api key, system key in env, user used 10 of 10 monthly calls
    // Assert: available=false, limits.used=10, remaining=0
  });
});
```

Note: write these as proper tests once you see the DB query pattern. The key logic:
- If `user_api_keys` row exists for userId → `usingOwnKey=true`, `available=true`, no limits
- Else if `process.env.OPENROUTER_API_KEY` is set: check `tier_limits` for `limit_type='llm_calls_monthly'` and count `llm_call_logs` for this user in current calendar month
  - If used < limit (or no limit): `available=true`
  - Else: `available=false`
- Else: `available=false`

**Step 2: Implement `packages/server/src/services/ai-availability.ts`**

```typescript
import { getDb } from "../util/db.js";

export interface AiAvailabilityResult {
  available: boolean;
  usingOwnKey: boolean;
  limits: {
    monthly: number | null;
    used: number;
    remaining: number | null;
  };
}

export async function getAiAvailability(
  userId: string,
  userTier: number,
  databaseUrl: string,
): Promise<AiAvailabilityResult> {
  const db = getDb(databaseUrl);

  // Check for user's own API key
  const ownKey = await db
    .selectFrom("user_api_keys")
    .select("id")
    .where("user_id", "=", userId)
    .executeTakeFirst();

  if (ownKey) {
    return {
      available: true,
      usingOwnKey: true,
      limits: { monthly: null, used: 0, remaining: null },
    };
  }

  // Check for system key
  const hasSystemKey = !!process.env.OPENROUTER_API_KEY;
  if (!hasSystemKey) {
    return {
      available: false,
      usingOwnKey: false,
      limits: { monthly: null, used: 0, remaining: null },
    };
  }

  // Check tier limit
  const tierLimit = await db
    .selectFrom("tier_limits")
    .select("limit_value")
    .where("tier_id", "=", userTier)
    .where("limit_type", "=", "llm_calls_monthly")
    .executeTakeFirst();

  const monthlyLimit = tierLimit?.limit_value ?? null;

  // Count calls this calendar month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const countResult = await db
    .selectFrom("llm_call_logs")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where("user_id", "=", userId)
    .where("used_system_key", "=", true)
    .where("started_at", ">=", monthStart)
    .executeTakeFirst();

  const used = Number(countResult?.count ?? 0);
  const remaining = monthlyLimit !== null ? Math.max(0, monthlyLimit - used) : null;
  const available = monthlyLimit === null || used < monthlyLimit;

  return {
    available,
    usingOwnKey: false,
    limits: { monthly: monthlyLimit, used, remaining },
  };
}
```

**Step 3: Run tests**

```bash
cd packages/server && npx vitest run tests/services/ai-availability.test.ts
```

**Step 4: Commit**

```bash
git add packages/server/src/services/ai-availability.ts packages/server/tests/services/ai-availability.test.ts
git commit -m "feat(server): add AI availability service"
```

---

## Task 5: Consolidated profile API

**Files:**
- Create: `packages/server/src/routes/profile/consolidated.ts`
- Modify: `packages/server/src/routes/profile/index.ts`
- Modify: `packages/server/tests/routes/profile.test.ts`

**Step 1: Add failing tests for the new endpoints**

Add to `packages/server/tests/routes/profile.test.ts`:

```typescript
describe("GET /api/profile", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/api/profile" });
    expect(res.statusCode).toBe(401);
  });

  it("does not return 501", async () => {
    const res = await app.inject({ method: "GET", url: "/api/profile" });
    expect(res.statusCode).not.toBe(501);
  });
});

describe("PUT /api/profile", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/profile",
      payload: { aiSuggestionsEnabled: true },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 for invalid payload", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/profile",
      payload: { aiSuggestionsEnabled: "not-a-boolean" },
    });
    expect(res.statusCode).toBe(400);
  });
});
```

**Step 2: Run tests to verify they fail with 404**

```bash
cd packages/server && npx vitest run tests/routes/profile.test.ts
```

Expected: `GET /api/profile` returns 404 (not yet implemented).

**Step 3: Create `packages/server/src/routes/profile/consolidated.ts`**

Follow the exact pattern of `packages/server/src/routes/profile/usage.ts` as a reference. The route needs:
- `requireAuth` preHandler (look at how other routes apply auth)
- `GET /` — build and return `ProfileResponse`
- `PUT /` — accept `updateProfileSchema` body, update `user` and `user_profiles` tables

```typescript
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { profileResponseSchema, updateProfileSchema } from "@opo/shared";
import { getAiAvailability } from "../../services/ai-availability.js";
import { getDb } from "../../util/db.js";

const consolidatedProfileRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/profile
  fastify.get(
    "/",
    {
      schema: { response: { 200: profileResponseSchema } },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const userId = request.user.id;
      const db = getDb(process.env.DATABASE_URL!);

      const [user, profile, tier] = await Promise.all([
        db.selectFrom("user").selectAll().where("id", "=", userId).executeTakeFirstOrThrow(),
        db.selectFrom("user_profiles").selectAll().where("user_id", "=", userId).executeTakeFirst(),
        db
          .selectFrom("user_tiers")
          .select(["id", "name"])
          .where("id", "=", request.user.tier)
          .executeTakeFirst(),
      ]);

      const aiAvailability = await getAiAvailability(userId, user.tier, process.env.DATABASE_URL!);

      return reply.send({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tier: user.tier,
        tierName: tier?.name ?? "Unknown",
        aiSuggestions: {
          enabled: user.ai_suggestions_enabled ?? true,
          ...aiAvailability,
        },
        location: {
          stateUsps: profile?.state_usps ?? null,
          placeGeoid: profile?.place_geoid ?? null,
        },
        createdAt: user.createdAt,
      });
    },
  );

  // PUT /api/profile
  fastify.put(
    "/",
    {
      schema: { body: updateProfileSchema },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const userId = request.user.id;
      const body = request.body as z.infer<typeof updateProfileSchema>;
      const db = getDb(process.env.DATABASE_URL!);

      // Update user table fields
      const userUpdates: Record<string, unknown> = {};
      if (body.name !== undefined) userUpdates.name = body.name;
      if (body.aiSuggestionsEnabled !== undefined)
        userUpdates.ai_suggestions_enabled = body.aiSuggestionsEnabled;

      if (Object.keys(userUpdates).length > 0) {
        await db.updateTable("user").set(userUpdates).where("id", "=", userId).execute();
      }

      // Update user_profiles table fields
      if (body.stateUsps !== undefined || body.placeGeoid !== undefined) {
        await db
          .insertInto("user_profiles")
          .values({
            user_id: userId,
            state_usps: body.stateUsps ?? null,
            place_geoid: body.placeGeoid ?? null,
          })
          .onConflict((oc) =>
            oc.column("user_id").doUpdateSet({
              state_usps: (eb) => eb.ref("excluded.state_usps"),
              place_geoid: (eb) => eb.ref("excluded.place_geoid"),
            }),
          )
          .execute();
      }

      return reply.send({ success: true });
    },
  );
};

export default consolidatedProfileRoutes;
```

**Step 4: Register in `packages/server/src/routes/profile/index.ts`**

```typescript
const profileRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(import("./consolidated.js")); // GET / and PUT /
  await fastify.register(import("./location.js"));
  await fastify.register(import("./usage.js"));
  await fastify.register(import("./api-keys.js"));
};
```

**Step 5: Run tests**

```bash
cd packages/server && npx vitest run tests/routes/profile.test.ts
```

Expected: 401 tests PASS. The `not 501` test will now pass with 401 too.

**Step 6: Commit**

```bash
git add packages/server/src/routes/profile/ packages/server/tests/routes/profile.test.ts
git commit -m "feat(server): add consolidated GET/PUT /api/profile endpoint"
```

---

## Task 6: Simplify upload endpoints

**Files:**
- Modify: `packages/server/src/routes/documents/upload.ts`
- Modify: `packages/server/tests/routes/documents/upload.test.ts` (or wherever upload tests live — check `packages/server/tests/routes/`)

**Step 1: Read `packages/server/src/routes/documents/upload.ts` in full**

Understand the current initiate and confirm-upload implementations before modifying.

**Step 2: Update initiate handler**

Change the request body schema from `createDocumentSchema` to `initiateUploadSchema` (from `@opo/shared`). The document title is auto-derived from the filename:

```typescript
// Derive a placeholder title from filename
function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")          // strip extension
    .replace(/[_-]+/g, " ")           // underscores/hyphens → spaces
    .replace(/\b\w/g, (c) => c.toUpperCase()) // capitalize words
    .trim() || "Untitled Document";
}
```

Set `use_ai_extraction` from `body.useAi` when creating the document row.
Remove `saveAsDraft` — all uploads go to `pending_upload` and then directly to `submitted` on confirm.

**Step 3: Update confirm-upload handler**

Change schema to `confirmUploadSchema` (just `{ objectKey }`). Always transition `pending_upload → submitted` and enqueue the processing pipeline. Remove the `saveAsDraft` branch.

**Step 4: Write/update tests for the upload route**

Look for existing upload tests in `packages/server/tests/routes/`. Add:

```typescript
describe("POST /api/documents/initiate", () => {
  it("returns 401 without authentication", async () => { ... });
  it("returns 400 when governmentLevel is missing", async () => {
    // body without governmentLevel
    expect(res.statusCode).toBe(400);
  });
  it("returns 400 when title is provided (no longer accepted)", async () => {
    // title was removed from schema — verify server rejects or ignores extra fields
    // Zod strips unknown keys by default, so this should still return 200 if other fields valid
  });
});
```

**Step 5: Run tests**

```bash
cd packages/server && npx vitest run tests/routes/documents/
```

Expected: all upload tests PASS.

**Step 6: Commit**

```bash
git add packages/server/src/routes/documents/upload.ts packages/server/tests/routes/documents/
git commit -m "feat(server): simplify upload endpoints - remove metadata fields, add useAi"
```

---

## Task 7: New document action endpoints

**Files:**
- Create: `packages/server/src/routes/documents/actions.ts`
- Modify: `packages/server/src/routes/documents/index.ts`
- Test: `packages/server/tests/routes/documents/actions.test.ts`

These endpoints handle: `save-draft`, `reopen`, `import-from-dc`.

**Step 1: Write failing tests**

```typescript
// packages/server/tests/routes/documents/actions.test.ts
describe("POST /api/documents/:id/save-draft", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({ method: "POST", url: "/api/documents/fake-id/save-draft" });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/documents/:id/reopen", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({ method: "POST", url: "/api/documents/fake-id/reopen" });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/documents/import-from-dc", () => {
  it("returns 401 without authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documents/import-from-dc",
      payload: { documentCloudId: 123, governmentLevel: "state", stateUsps: "IA", useAi: true },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 when governmentLevel is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/documents/import-from-dc",
      payload: { documentCloudId: 123, useAi: true },
    });
    expect(res.statusCode).toBe(400);
  });
});
```

**Step 2: Run to verify 404**

```bash
cd packages/server && npx vitest run tests/routes/documents/actions.test.ts
```

**Step 3: Implement `packages/server/src/routes/documents/actions.ts`**

Each handler follows the same pattern as existing document action handlers (look at `moderation.ts` for reference):
1. Auth check (preHandler)
2. Fetch document, verify ownership and current state using `isValidStateTransition`
3. Update state
4. Return success

```typescript
// save-draft: user_review → draft
fastify.post("/:id/save-draft", { preHandler: [fastify.authenticate] }, async (req, reply) => {
  const { id } = req.params as { id: string };
  const userId = req.user.id;
  const doc = await db.selectFrom("documents").select(["id", "state", "uploader_id"])
    .where("id", "=", id).executeTakeFirst();
  if (!doc) return reply.status(404).send({ success: false, error: "Not found" });
  if (doc.uploader_id !== userId) return reply.status(403).send({ success: false, error: "Forbidden" });
  if (!isValidStateTransition(doc.state as DocumentState, "draft"))
    return reply.status(400).send({ success: false, error: `Cannot transition from ${doc.state} to draft` });
  await db.updateTable("documents").set({ state: "draft" }).where("id", "=", id).execute();
  return reply.send({ success: true });
});

// reopen: rejected → user_review
fastify.post("/:id/reopen", { preHandler: [fastify.authenticate] }, async (req, reply) => {
  // same pattern, target state: "user_review"
});
```

For `import-from-dc`, look at the existing `POST /api/documentcloud/import` for the pattern, then simplify for a single user-facing import. Key differences:
- Requires `governmentLevel` + location fields
- Sets `use_ai_extraction` from `body.useAi`
- Available to all authenticated users (not moderator-only)

**Step 4: Register in `packages/server/src/routes/documents/index.ts`**

```typescript
await fastify.register(import("./actions.js"));
```

**Step 5: Run tests**

```bash
cd packages/server && npx vitest run tests/routes/documents/actions.test.ts
```

Expected: 401/400 tests PASS.

**Step 6: Commit**

```bash
git add packages/server/src/routes/documents/actions.ts packages/server/src/routes/documents/index.ts packages/server/tests/routes/documents/actions.test.ts
git commit -m "feat(server): add save-draft, reopen, and import-from-dc endpoints"
```

---

## Task 8: Pipeline complete — emit `document:ready_for_review`

**Files:**
- Modify: `packages/server/src/jobs/tasks/pipeline-complete.ts`
- Modify: `packages/server/tests/jobs/pipeline-complete.test.ts`

**Step 1: Read the current test file**

```bash
cat packages/server/tests/jobs/pipeline-complete.test.ts
```

Understand what's already tested.

**Step 2: Add failing test for the new event**

Add to the test file:

```typescript
it("sends document:ready_for_review SSE event when transitioning to user_review", async () => {
  // Mock pg_notify call or broadcastToUser from SSE service
  // Mock sieve_category as null (→ user_review)
  // Verify broadcastToUser is called with "document:ready_for_review" and { id, title }
});
```

Look at how the current test mocks `pg_notify` to understand the approach.

**Step 3: Update `pipeline-complete.ts`**

After the state update, when `state === "user_review"`, fetch the document title and broadcast the SSE event using `broadcastToUser` from `../../services/sse.js`:

```typescript
import { broadcastToUser } from "../../services/sse.js";

// After state update...
if (state === "user_review") {
  // Fetch document for title and uploader_id
  const doc = await db
    .selectFrom("documents")
    .select(["title", "uploader_id"])
    .where("id", "=", documentId)
    .executeTakeFirst();

  if (doc?.uploader_id) {
    broadcastToUser(doc.uploader_id, "document:ready_for_review", {
      id: documentId,
      title: doc.title,
    });
  }
}
```

**Step 4: Run pipeline-complete tests**

```bash
cd packages/server && npx vitest run tests/jobs/pipeline-complete.test.ts
```

**Step 5: Commit**

```bash
git add packages/server/src/jobs/tasks/pipeline-complete.ts packages/server/tests/jobs/pipeline-complete.test.ts
git commit -m "feat(server): emit document:ready_for_review SSE event on pipeline complete"
```

---

## Task 9: SSE — `profile:updated` LISTEN handler

**Files:**
- Modify: `packages/server/src/routes/sse.ts`

**Step 1: Read `packages/server/src/routes/sse.ts` in full**

Find where `document_status` NOTIFY is handled (the `LISTEN` setup). Understand the pattern.

**Step 2: Add a second LISTEN channel for `op_profile_changed`**

Following the same pattern as the existing `document_status` listener, add a listener for `op_profile_changed`:

```typescript
// In the LISTEN setup section:
pgClient.on("notification", (msg) => {
  if (msg.channel === "document_status") {
    // existing handler...
  } else if (msg.channel === "op_profile_changed") {
    try {
      const payload = JSON.parse(msg.payload ?? "{}") as { userId: string };
      broadcastToUser(payload.userId, "profile:updated", { userId: payload.userId });
    } catch {
      // ignore parse errors
    }
  }
});

// Also add LISTEN for the new channel:
await pgClient.query("LISTEN op_profile_changed");
```

**Step 3: Run the existing SSE tests if any exist**

```bash
cd packages/server && npx vitest run tests/routes/sse.test.ts
```

**Step 4: Commit**

```bash
git add packages/server/src/routes/sse.ts
git commit -m "feat(server): listen for op_profile_changed and broadcast profile:updated SSE"
```

---

## Task 10: LLM call logging — add user_id and used_system_key

**Files:**
- Modify: `packages/server/src/jobs/tasks/sieve.ts`
- Modify: `packages/server/src/jobs/tasks/extractor.ts`

**Step 1: Read both files**

Find where `llm_call_logs` is inserted. Identify how the document's `uploader_id` and `use_ai_extraction` are currently accessed.

**Step 2: Update sieve.ts**

When inserting into `llm_call_logs`, add `user_id` (from the document's `uploader_id`), `used_system_key` (true if using system key, false if user key — check which key was used), and `total_tokens` (input + output):

```typescript
// When logging the LLM call:
await db.insertInto("llm_call_logs").values({
  // existing fields...
  user_id: document.uploader_id ?? null,
  used_system_key: !usingUserKey, // set this based on which key was used
  total_tokens: (inputTokens ?? 0) + (outputTokens ?? 0),
}).execute();
```

The key selection logic is already in the service — find where `process.env.OPENROUTER_API_KEY` vs user key is chosen, and pass that boolean through to the log insert.

**Step 3: Apply same changes to extractor.ts**

**Step 4: Run job tests**

```bash
cd packages/server && npx vitest run tests/jobs/sieve.test.ts tests/jobs/extractor.test.ts
```

Fix any test failures caused by the new required fields.

**Step 5: Commit**

```bash
git add packages/server/src/jobs/tasks/sieve.ts packages/server/src/jobs/tasks/extractor.ts
git commit -m "feat(server): log user_id, used_system_key, total_tokens on every LLM call"
```

---

## Task 11: Frontend — `useAiPreference` composable and profile query

**Files:**
- Create: `packages/web/src/composables/useAiPreference.ts`
- Create: `packages/web/src/api/queries/profile.ts`

**Step 1: Create `packages/web/src/api/queries/profile.ts`**

Follow the `documents.ts` TanStack Query pattern:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import type { ProfileResponse, UpdateProfileInput } from "@opo/shared";
import { apiClient } from "../client";

export const profileKeys = {
  all: ["profile"] as const,
  me: () => [...profileKeys.all, "me"] as const,
};

export function useProfile() {
  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: () => apiClient.get<ProfileResponse>("/profile"),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateProfileInput) => apiClient.put("/profile", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}
```

**Step 2: Create `packages/web/src/composables/useAiPreference.ts`**

```typescript
import { ref, watch } from "vue";
import { useProfile, useUpdateProfile } from "../api/queries/profile";

export function useAiPreference() {
  const { data: profile } = useProfile();
  const { mutate: updateProfile } = useUpdateProfile();

  // Session override — starts as undefined (will sync from profile on load)
  const sessionOverride = ref<boolean | undefined>(undefined);

  const enabled = ref(true); // default until profile loads

  watch(
    () => profile.value?.aiSuggestions.enabled,
    (val) => {
      if (val !== undefined && sessionOverride.value === undefined) {
        enabled.value = val;
      }
    },
    { immediate: true },
  );

  function setEnabled(val: boolean) {
    sessionOverride.value = val;
    enabled.value = val;
  }

  async function persistToProfile() {
    updateProfile({ aiSuggestionsEnabled: enabled.value });
  }

  return { enabled, setEnabled, persistToProfile };
}
```

**Step 3: Verify TypeScript compiles**

```bash
cd packages/web && npx vue-tsc --noEmit
```

**Step 4: Commit**

```bash
git add packages/web/src/api/queries/profile.ts packages/web/src/composables/useAiPreference.ts
git commit -m "feat(web): add profile TanStack Query composable and useAiPreference"
```

---

## Task 12: Frontend — `DocumentSourceAutocomplete` component

**Files:**
- Create: `packages/web/src/components/upload/DocumentSourceAutocomplete.vue`

This component searches states, places, and tribes simultaneously and returns a structured location object.

**Step 1: Check existing location autocomplete components**

Read `packages/web/src/components/` for `PlaceAutocomplete.vue`, `TribeAutocomplete.vue` — these are the building blocks. Also check what API endpoints are available for combined search (`GET /api/locations/states`, `GET /api/locations/states/:usps/places`, etc.).

**Step 2: Create the component**

The component accepts no required props, emits `update:modelValue` with `{ governmentLevel, stateUsps?, placeGeoid?, tribeId?, label: string } | null`.

Use PrimeVue v4 `AutoComplete` with a custom search function that:
1. Queries states matching the input (search by name)
2. Queries places matching the input (use a search endpoint — check if one exists, or use the existing places list filtered client-side)
3. Queries tribes matching the input
4. Merges results with type prefix: `"Iowa (State)"`, `"City of Dubuque, IA"`, `"Dubuque County, IA"`, `"Sac and Fox Nation (Tribal)"`

For disambiguation, use the `lsad` field on places (e.g., "city", "county") to build the label.

**Step 3: Add a minimum viable test**

```typescript
// packages/web/src/components/upload/DocumentSourceAutocomplete.test.ts
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import DocumentSourceAutocomplete from "./DocumentSourceAutocomplete.vue";

it("renders without error", () => {
  const wrapper = mount(DocumentSourceAutocomplete, {
    global: { plugins: [...] } // add required plugins
  });
  expect(wrapper.exists()).toBe(true);
});
```

**Step 4: Commit**

```bash
git add packages/web/src/components/upload/DocumentSourceAutocomplete.vue
git commit -m "feat(web): add DocumentSourceAutocomplete component"
```

---

## Task 13: Frontend — Upload form redesign

**Files:**
- Modify: `packages/web/src/views/UploadView.vue`
- Modify: `packages/web/src/stores/upload-wizard.ts`
- Modify: `packages/web/src/api/queries/documents.ts` (add import-from-dc mutation)

**Step 1: Read `packages/web/src/stores/upload-wizard.ts` in full**

Understand the current multi-step state structure before replacing it.

**Step 2: Simplify `upload-wizard.ts`**

Replace the multi-step state with:

```typescript
import { defineStore } from "pinia";
import { ref } from "vue";

interface DcSelection {
  documentCloudId: number;
  title: string;
}

export const useUploadWizardStore = defineStore("upload-wizard", () => {
  const file = ref<File | null>(null);
  const dcSelection = ref<DcSelection | null>(null);
  const documentSource = ref<{
    governmentLevel: "federal" | "state" | "place" | "tribal";
    stateUsps?: string;
    placeGeoid?: string;
    tribeId?: string;
    label: string;
  } | null>(null);
  const useAi = ref(true); // overridden by useAiPreference

  function reset() {
    file.value = null;
    dcSelection.value = null;
    documentSource.value = null;
  }

  function setFile(f: File) {
    file.value = f;
    dcSelection.value = null;
  }

  function setDcSelection(dc: DcSelection) {
    dcSelection.value = dc;
    file.value = null;
  }

  const canSubmit = computed(
    () => (file.value || dcSelection.value) && documentSource.value !== null,
  );

  return { file, dcSelection, documentSource, useAi, reset, setFile, setDcSelection, canSubmit };
});
```

**Step 3: Add `useImportFromDc` mutation to `documents.ts`**

```typescript
export function useImportFromDc() {
  return useMutation({
    mutationFn: (data: ImportFromDcInput) =>
      apiClient.post<{ documentId: string }>("/documents/import-from-dc", data),
  });
}
```

**Step 4: Rewrite `UploadView.vue`**

Replace the 4-step wizard with a single page. Structure:

```vue
<template>
  <div class="max-w-2xl mx-auto py-8 px-4">
    <h1>Upload Document</h1>

    <!-- Source toggle tabs -->
    <Tabs v-model:value="activeTab">
      <TabList>
        <Tab value="file">Upload File</Tab>
        <Tab value="dc">Import from DocumentCloud</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="file">
          <FileDropzone @file-selected="store.setFile" />
        </TabPanel>
        <TabPanel value="dc">
          <!-- Reuse DocumentCloudResultCard + useDocumentCloudSearch -->
          <DcSearchPanel @selected="store.setDcSelection" />
        </TabPanel>
      </TabPanels>
    </Tabs>

    <!-- Document Source (always shown) -->
    <DocumentSourceAutocomplete v-model="store.documentSource" class="mt-6" />

    <!-- AI toggle (shown only when available) -->
    <div v-if="profile?.aiSuggestions.available" class="mt-4">
      <Checkbox v-model="store.useAi" label="Analyze with AI" />
    </div>

    <!-- Submit -->
    <Button
      :disabled="!store.canSubmit || isSubmitting"
      @click="handleSubmit"
      class="mt-6"
    >
      Upload
    </Button>
  </div>
</template>
```

The `handleSubmit` method:
1. If `store.file`: call initiate → upload to S3 → confirm → navigate to `/documents/:id`
2. If `store.dcSelection`: call `useImportFromDc` → navigate to `/documents/:id`

**Step 5: Create `DcSearchPanel.vue` sub-component**

Extract the DC search UI into `packages/web/src/components/upload/DcSearchPanel.vue`. It wraps `useDocumentCloudSearch` and renders `DocumentCloudResultCard` for each result with single-select behavior. Emits `selected` with the `DocumentCloudDocument`.

**Step 6: Run type check**

```bash
cd packages/web && npx vue-tsc --noEmit
```

**Step 7: Commit**

```bash
git add packages/web/src/views/UploadView.vue packages/web/src/stores/upload-wizard.ts packages/web/src/api/queries/documents.ts packages/web/src/components/upload/
git commit -m "feat(web): redesign upload form - single page with DC import tab and Document Source"
```

---

## Task 14: Frontend — SSE updates (refetch + toast + new events)

**Files:**
- Modify: `packages/web/src/composables/useDocumentSSE.ts`
- Create: `packages/web/src/composables/useUserReviewCount.ts`

**Step 1: Update `useDocumentSSE.ts`**

Changes:
1. Replace `invalidateQueries` with `invalidateQueries` + `refetchQueries` for the same key
2. Add `document:ready_for_review` handler
3. Add `profile:updated` handler

```typescript
import { useToast } from "primevue/usetoast";
import { useRouter, useRoute } from "vue-router";
import { profileKeys } from "../api/queries/profile";

export function useDocumentSSE() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const route = useRoute();

  // helper: invalidate + immediately refetch
  function invalidateAndRefetch(queryKey: unknown[]) {
    queryClient.invalidateQueries({ queryKey });
    queryClient.refetchQueries({ queryKey });
  }

  // document:updated
  eventSource.addEventListener("document:updated", (event) => {
    const data = JSON.parse(event.data) as { id: string };
    invalidateAndRefetch(documentKeys.detail(data.id));
    invalidateAndRefetch(documentKeys.lists());
  });

  // document:state_changed
  eventSource.addEventListener("document:state_changed", (event) => {
    const data = JSON.parse(event.data) as { id: string };
    invalidateAndRefetch(documentKeys.detail(data.id));
    invalidateAndRefetch(documentKeys.myUploads());
  });

  // document:ready_for_review — new
  eventSource.addEventListener("document:ready_for_review", (event) => {
    const data = JSON.parse(event.data) as { id: string; title: string };
    invalidateAndRefetch(documentKeys.detail(data.id));
    invalidateAndRefetch(documentKeys.myUploads());

    // Show toast only if not currently viewing this document
    const isOnDocPage = route.name === "document-detail" && route.params.id === data.id;
    if (!isOnDocPage) {
      toast.add({
        severity: "info",
        summary: "Document ready for review",
        detail: data.title,
        life: 8000,
      });
    }
  });

  // profile:updated — new
  eventSource.addEventListener("profile:updated", () => {
    invalidateAndRefetch(profileKeys.me());
  });
}
```

**Step 2: Ensure `<Toast />` is present in the app root**

Check `packages/web/src/App.vue` — if `<Toast />` isn't already there, add it. PrimeVue's toast service requires the `<Toast />` component mounted somewhere in the tree.

**Step 3: Create `packages/web/src/composables/useUserReviewCount.ts`**

```typescript
import { computed } from "vue";
import { useMyUploads } from "../api/queries/documents";

export function useUserReviewCount() {
  const { data } = useMyUploads();

  const count = computed(() => {
    if (!data.value?.items) return 0;
    return data.value.items.filter((d) => d.state === "user_review").length;
  });

  return { count };
}
```

**Step 4: Add badge to "My Uploads" nav item**

Find the sidebar/nav component (likely `packages/web/src/components/AppSidebar.vue` or `AppLayout.vue`). Import `useUserReviewCount` and render a PrimeVue `Badge` on the "My Uploads" nav item when `count > 0`.

**Step 5: Commit**

```bash
git add packages/web/src/composables/useDocumentSSE.ts packages/web/src/composables/useUserReviewCount.ts packages/web/src/components/AppSidebar.vue
git commit -m "feat(web): SSE refetch, ready_for_review toast, profile:updated handler, My Uploads badge"
```

---

## Task 15: Frontend — State-driven `DocumentDetailView`

**Files:**
- Modify: `packages/web/src/views/DocumentDetailView.vue`

This is the largest frontend task. Read the existing `DocumentDetailView.vue` in full before starting.

**Step 1: Add state-to-mode mapping logic**

```typescript
const PROCESSING_STATES = ["pending_upload", "submitted", "processing"] as const;
const REVIEW_STATES = ["user_review", "draft"] as const;

const viewMode = computed(() => {
  const state = document.value?.state;
  if (!state) return "loading";
  if (PROCESSING_STATES.includes(state as any)) return "processing";
  if (REVIEW_STATES.includes(state as any)) return "review";
  if (state === "rejected") return "rejected";
  if (state === "processing_failed") return "failed";
  return "readonly"; // moderator_review, approved
});
```

**Step 2: Add the processing banner mode**

```vue
<template v-if="viewMode === 'processing'">
  <div class="processing-banner">
    <ProgressSpinner />
    <p>Your document is being processed. You can safely leave this page and come back.</p>
    <p v-if="document">Uploaded: {{ document.filename }}</p>
  </div>
</template>
```

The banner disappears automatically when SSE fires `document:ready_for_review` and TanStack Query refetches.

**Step 3: Add the rejected mode**

```vue
<template v-else-if="viewMode === 'rejected'">
  <!-- Read-only detail (existing component) -->
  <DocumentDetailReadOnly :document="document" />
  <!-- Rejection reason -->
  <Message severity="error">{{ document.rejectionReason }}</Message>
  <!-- Actions -->
  <div class="flex gap-3 mt-6">
    <Button label="Reimport" @click="router.push('/upload')" />
    <Button label="Edit submission" @click="handleReopen" />
  </div>
</template>
```

`handleReopen` calls `POST /api/documents/:id/reopen` then refetches the document.

**Step 4: Add the processing_failed mode**

```vue
<template v-else-if="viewMode === 'failed'">
  <DocumentDetailReadOnly :document="document" />
  <Message severity="warn">Processing failed. You can retry or reimport.</Message>
  <Button label="Retry" @click="handleRetry" />
</template>
```

**Step 5: Add the review mode (placeholder for now)**

```vue
<template v-else-if="viewMode === 'review'">
  <ReviewView :document-id="documentId" />
</template>
```

`ReviewView` is implemented in Task 16.

**Step 6: Commit**

```bash
git add packages/web/src/views/DocumentDetailView.vue
git commit -m "feat(web): make DocumentDetailView state-driven (processing/review/rejected/failed/readonly modes)"
```

---

## Task 16: Frontend — `ReviewView` dual-mode component

**Files:**
- Create: `packages/web/src/components/review/ReviewView.vue`
- Create: `packages/web/src/components/review/AiSuggestionRow.vue`
- Modify: `packages/web/src/api/queries/documents.ts` (add save-draft and reopen mutations)

**Step 1: Add mutations to `documents.ts`**

```typescript
export function useSaveDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/documents/${id}/save-draft`, {}),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: documentKeys.myUploads() });
    },
  });
}

export function useSubmitForModeration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/documents/${id}/submit-for-moderation`, {}),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: documentKeys.myUploads() });
    },
  });
}
```

**Step 2: Create `AiSuggestionRow.vue`**

A single field row showing: field label, AI-suggested value, and three actions (Accept ✓, Edit ✎, Discard ✕).

```vue
<!-- props: fieldKey, label, aiValue (string | null), modelValue (string | null), status ('pending'|'accepted'|'edited'|'discarded') -->
<!-- emits: update:modelValue, update:status -->
```

When Edit is clicked, show an inline text input (or a `Dialog` for long text). When value is saved, emit `update:status='edited'` and `update:modelValue=newValue`.

**Step 3: Create `ReviewView.vue`**

```vue
<script setup lang="ts">
const props = defineProps<{ documentId: string }>();

const { data: aiMetadata } = useAiMetadata(computed(() => props.documentId));
const { data: document } = useDocumentDetail(computed(() => props.documentId));

// Determine default tab: 'review' if AI data exists, 'edit' otherwise
const defaultTab = computed(() =>
  aiMetadata.value?.fields?.length ? "review" : "edit"
);

// Shared form state (used by both tabs)
const formState = reactive<Record<string, string | null>>({});
const fieldStatuses = reactive<Record<string, "pending" | "accepted" | "edited" | "discarded">>({});

// Sync AI suggestions into formState on load
watch(aiMetadata, (data) => {
  if (data?.fields) {
    for (const f of data.fields) {
      formState[f.key] = f.aiValue;
      fieldStatuses[f.key] = "pending";
    }
  }
}, { immediate: true });

const allResolved = computed(() =>
  Object.values(fieldStatuses).every((s) => s !== "pending")
);

const { mutate: saveDraft } = useSaveDraft();
const { mutate: submitForModeration } = useSubmitForModeration();
</script>

<template>
  <Tabs :value="defaultTab">
    <TabList>
      <Tab value="review" :disabled="!aiMetadata?.fields?.length">Review</Tab>
      <Tab value="edit">Edit</Tab>
    </TabList>
    <TabPanels>
      <!-- Review tab -->
      <TabPanel value="review">
        <AiSuggestionRow
          v-for="field in aiMetadata?.fields"
          :key="field.key"
          :field-key="field.key"
          :label="field.label"
          :ai-value="field.aiValue"
          v-model="formState[field.key]"
          v-model:status="fieldStatuses[field.key]"
        />
      </TabPanel>
      <!-- Edit tab -->
      <TabPanel value="edit">
        <!-- Reuse existing edit components -->
        <DocumentEditForm :document-id="documentId" v-model="formState" />
      </TabPanel>
    </TabPanels>
  </Tabs>

  <!-- Bottom actions (shared) -->
  <div class="flex gap-3 mt-6">
    <Button label="Save as Draft" severity="secondary" @click="saveDraft(documentId)" />
    <Button
      label="Submit"
      :disabled="activeTab === 'review' && !allResolved"
      @click="submitForModeration(documentId)"
    />
  </div>
</template>
```

**Step 4: Commit**

```bash
git add packages/web/src/components/review/ packages/web/src/api/queries/documents.ts
git commit -m "feat(web): add ReviewView dual-mode component with AI suggestion rows"
```

---

## Task 17: Frontend — Profile page AI preference toggle

**Files:**
- Modify: `packages/web/src/views/ProfileView.vue`

**Step 1: Read `ProfileView.vue` in full**

Understand the current layout and how it fetches data.

**Step 2: Switch to the consolidated profile query**

Replace existing calls to `GET /api/profile/usage` and `GET /api/profile/location` with the new `useProfile()` composable from Task 11.

**Step 3: Add `AiPreferenceToggle` section**

Add a new section to the profile page between the account info and the API key section:

```vue
<section>
  <h3>AI Analysis</h3>
  <p>When enabled, documents you upload will be analyzed by AI to suggest metadata.</p>
  <div class="flex items-center gap-3">
    <ToggleSwitch
      :model-value="profile?.aiSuggestions.enabled"
      @update:model-value="updateProfile({ aiSuggestionsEnabled: $event })"
    />
    <span>{{ profile?.aiSuggestions.enabled ? "Enabled" : "Disabled" }}</span>
  </div>
  <p v-if="!profile?.aiSuggestions.available" class="text-sm text-surface-500">
    AI analysis is currently unavailable (no API key configured or limit reached).
  </p>
</section>
```

**Step 4: Check TypeScript**

```bash
cd packages/web && npx vue-tsc --noEmit
```

**Step 5: Commit**

```bash
git add packages/web/src/views/ProfileView.vue
git commit -m "feat(web): add AI preference toggle to profile page"
```

---

## Task 18: End-to-end verification

**Step 1: Run all server tests**

```bash
cd packages/server && npm test
```

Expected: all tests PASS. Fix any regressions.

**Step 2: Run all shared tests**

```bash
cd packages/shared && npm test
```

**Step 3: Run frontend type check**

```bash
cd packages/web && npx vue-tsc --noEmit
```

**Step 4: Start the dev server and verify manually**

```bash
docker-compose up -d  # ensure postgres + redis are running
npm run dev           # from repo root (or per package)
```

Manual verification checklist:
- [ ] Upload a file with a Document Source → lands on processing banner → banner disappears when ready
- [ ] Upload same flow with AI disabled → Review tab shows empty fields → Edit tab is default
- [ ] Review tab: accept, edit, discard fields → Submit enabled only after all resolved
- [ ] Save as Draft → document shows in My Uploads as "draft"
- [ ] Return to draft → Submit goes directly to moderation
- [ ] Reject a doc as moderator → "Reimport" navigates to upload → "Edit submission" returns to review
- [ ] My Uploads badge increments when doc enters user_review
- [ ] Toast appears in another tab when doc is ready for review
- [ ] Profile page shows AI toggle and availability
- [ ] DC import tab appears on upload form, single-selects one document

**Step 5: Final commit if any fixes were needed**

```bash
git add -p  # stage only the fixes
git commit -m "fix: address regressions from upload/review flow"
```

---

## Notes on known complexities

**Document title at upload:** The `title` column is `NOT NULL`. Since title is now collected during review (via AI or manual edit), the server must auto-derive a placeholder title from the filename using `titleFromFilename()` defined in Task 6. The title will be updated when the user submits from review.

**`submit-for-moderation` also saves form state:** When the user clicks Submit from either Review or Edit tab, the form state (accepted/edited field values) must be persisted to the document before transitioning state. The `POST /api/documents/:id/submit-for-moderation` endpoint should accept an optional body with field updates, or the frontend should call the existing `PUT /api/documents/:id` endpoint first to save edits, then call `submit-for-moderation`. Prefer the two-call approach to keep endpoints single-purpose.

**`DocumentEditView` and `AiReviewView` removal:** These routes still exist in the router after this feature. Don't delete them in this plan — mark them for removal in a follow-up cleanup PR once the new flow is verified stable. Redirect them to `/documents/:id` for now.

**Kysely types:** After the migration, if the project uses generated Kysely types, regenerate them. Look for a `npm run codegen` or `npm run db:types` script. If types are manual, you'll need to add the new columns to the type definitions in `packages/server/src/db/types.ts` (or equivalent).
