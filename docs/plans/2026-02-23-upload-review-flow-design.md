# Upload & Review Flow — Design

**Date:** 2026-02-23
**Status:** Approved

---

## Overview

This design replaces the 4-step upload wizard and the disconnected AI review page with a unified, state-driven document flow:

**upload → [processing] → review → (optional) draft → submit for moderation**

The document's page at `/documents/:id` adapts its UI to the document's current state, eliminating unnecessary route changes and making SSE-driven transitions seamless.

---

## 1. State Machine (updated)

| From | To | Trigger |
|---|---|---|
| `pending_upload` | `submitted` | Upload confirmed (draft option removed from upload) |
| `submitted` | `processing` | Worker picks up job |
| `processing` | `user_review` | Pipeline complete (AI performed) |
| `processing` | `moderator_review` | Pipeline complete (AI skipped, no review needed) |
| `processing` | `processing_failed` | Any pipeline stage failed |
| `user_review` | `draft` | User saves as draft during review |
| `user_review` | `moderator_review` | User submits after review |
| `draft` | `moderator_review` | User submits (always to moderation — file was already processed) |
| `moderator_review` | `approved` | Moderator approves |
| `moderator_review` | `rejected` | Moderator rejects with reason |
| `rejected` | `submitted` | User clicks "Reimport" (starts fresh, re-runs pipeline) |
| `rejected` | `user_review` | User clicks "Edit submission" (returns to review without reprocessing) |
| `processing_failed` | `submitted` | User clicks "Retry" |

**Removed:** `pending_upload → draft`. Draft no longer originates at upload.

**`draft` semantics change:** Draft now exclusively means "saved mid-review". A document in `draft` has already been through the processing pipeline. Submitting it goes directly to `moderator_review`, never back through processing.

### State Groups (updated)

```typescript
export const PROCESSING_STATES: DocumentState[] = ["submitted", "processing"];
export const REVIEW_STATES: DocumentState[] = ["user_review", "draft"];
export const DELETABLE_STATES: DocumentState[] = ["draft", "processing_failed", "rejected", "pending_upload"];
export const TERMINAL_STATES: DocumentState[] = ["approved"];
```

Note: `EDITABLE_STATES` is removed — editing now happens inside the review view for `user_review`/`draft`, and documents in `rejected`/`processing_failed` use "Reimport" or retry flows rather than in-place editing.

---

## 2. Upload Form

The 4-step wizard is replaced by a single-page form with four elements:

### 2a. Source Toggle (mutually exclusive tabs)

**Tab 1 — Upload File**
- Existing `FileDropzone` component (MIME types, 50 MB limit, unchanged)

**Tab 2 — Import from DocumentCloud**
- Reuses `DocumentCloudResultCard` and `useDocumentCloudSearch` from `DocumentCloudSearchView`
- User searches and selects **one** document (single selection only)
- "Already imported" documents are non-selectable
- Selecting a DC result clears any file selection, and vice versa
- Batch import remains on the moderator-only `DocumentCloudSearchView`
- A new endpoint `POST /api/documents/import-from-dc` is created for regular users (single document, requires Document Source)

### 2b. Document Source (required)

Single autocomplete field searching `states`, `places`, and `tribes` tables simultaneously.

Result labels always include type and state context to prevent ambiguity:
- States: `"Iowa (State)"`
- Places: `"City of Dubuque, IA"`, `"Dubuque County, IA"` (LSAD used for disambiguation)
- Tribes: `"Sac and Fox Nation of Missouri (Tribal)"`

Submission is blocked until a Document Source is selected.

The field resolves to a `{ governmentLevel, stateUsps?, placeGeoid?, tribeId? }` tuple internally.

### 2c. AI Analysis Toggle

- Shown only when AI is available (see Section 5)
- Default value: user's `ai_suggestions_enabled` profile preference
- Per-session override stored in `useAiPreference` composable
- When AI is unavailable, the toggle is hidden and AI is silently skipped

### 2d. Submit

- Disabled until both a file/DC selection and a Document Source are filled
- **File upload path:** `POST /api/documents/initiate` → S3 upload → `POST /api/documents/:id/confirm-upload`
  - Initiate payload: `{ filename, mimetype, size, governmentLevel, stateUsps?, placeGeoid?, tribeId? }`
  - Confirm payload: `{ objectKey, useAi: boolean }`
  - All metadata fields (title, description, date, tags, category) removed from initiate
  - `saveAsDraft` removed from confirm
- **DC import path:** `POST /api/documents/import-from-dc`
  - Payload: `{ documentCloudId, governmentLevel, stateUsps?, placeGeoid?, tribeId?, useAi: boolean }`
  - Server creates document + enqueues worker job, returns `{ documentId }`
- Both paths navigate to `/documents/:id` after submission

**Removed from upload:** title, description, document date, tags, category, save-as-draft checkbox.

---

## 3. State-Driven Document View (`/documents/:id`)

The document detail page renders one of four modes based on the document's current state. TanStack Query refetches on SSE events, causing seamless mode transitions without programmatic navigation.

### Mode 1 — Processing (`pending_upload`, `submitted`, `processing`)

Read-only detail (partial — only Document Source and filename shown since no other metadata exists yet) with a prominent banner:

> "Your document is being processed. You can safely leave this page and come back."

When the SSE `document:ready_for_review` event fires:
- TanStack Query refetches the document
- The page re-renders into Mode 2 (review) automatically
- No navigation required

### Mode 2 — Review (`user_review`, `draft`)

Dual-mode review view (see Section 4).

### Mode 3 — Rejected (`rejected`)

Read-only detail with rejection reason and two action buttons:
- **"Reimport"** — navigates to `/upload` (pre-seeded with Document Source if possible)
- **"Edit submission"** — calls `POST /api/documents/:id/reopen` → `rejected → user_review`, then page re-renders into Mode 2

### Mode 4 — Read-only (`moderator_review`, `approved`, `processing_failed`)

Existing read-only detail view, unchanged except:
- `processing_failed` gains a **"Retry"** button (`POST /api/documents/:id/retry`)
- `moderator_review` / `approved`: no action buttons for the owner

---

## 4. Review View (dual-mode, Mode 2)

When the document is in `user_review` or `draft`, the page shows two tabs sharing underlying reactive form state.

### Tab: Review (default when AI data exists)

One row per field: title, description, document date, category, tags, dynamic metadata fields.

Each row shows:
- The AI-suggested value (or empty prompt if no suggestion)
- Three inline actions: **Accept** ✓ | **Edit** ✎ (inline editor or small modal) | **Discard** ✕

Fields without an AI suggestion show an "Add" prompt. Discarded fields are explicitly blank.

**Submit is enabled only after every field has been explicitly accepted, edited, or discarded.** This ensures intentional review of each value.

Bottom actions:
- **Save as Draft** → `POST /api/documents/:id/save-draft` → `user_review → draft`
- **Submit** → `POST /api/documents/:id/submit-for-moderation` → `user_review → moderator_review`

### Tab: Edit (default when no AI data, or AI was disabled at upload)

Reuses existing components: `DocumentEditForm`, `DynamicMetadataForm`, `DocumentAssociationsEditor`.

Full form editor for all fields. Same bottom actions: **Save as Draft** and **Submit**.

### Tab switching

Switching tabs preserves in-progress edits via shared reactive form state. The active tab is not persisted — the default on load is Review if AI data exists, Edit otherwise.

---

## 5. AI Availability & Usage Tracking

### Availability Check

`GET /api/profile` response includes an `aiSuggestions` block (see Section 6). AI is available when:
1. User has a valid OpenRouter API key stored (`user_api_keys` row exists) — **no limits apply**
2. A system OpenRouter key is configured in environment AND the user is within their tier's monthly AI call limit

Both conditions are evaluated server-side. The frontend shows the AI toggle only when `aiSuggestions.available === true`.

### Usage Tracking

Every LLM call (sieve, extractor) logs to `llm_call_logs`. New columns added:
- `user_id` — FK → `user.id` (who triggered the call)
- `used_system_key` — boolean (true if system key was used, false if user's own key)
- `total_tokens` — computed from prompt + completion (for convenience)

OpenRouter returns token counts and cost in every response. All available fields are stored: `input_tokens`, `output_tokens`, `total_tokens`, `cost_usd` (converted from cost_cents for display; stored as `cost_cents` numeric(10,4)).

Monthly AI usage is aggregated from `llm_call_logs` per user per calendar month. Tier limits use a `limit_type` of `"llm_calls_monthly"`.

### `useAiPreference` Composable

```typescript
// packages/web/src/composables/useAiPreference.ts
// Reads from profile on mount, allows per-session override
// Returns: { enabled: Ref<boolean>, toggle: () => void, persistToProfile: () => Promise<void> }
```

The session override is in-memory only (reactive ref). `persistToProfile` calls `PUT /api/profile` to save permanently.

---

## 6. Profile API (consolidated)

`GET /api/profile` replaces the scattered profile sub-endpoints and returns all non-sensitive user data in one response:

```typescript
{
  id: string,
  name: string | null,
  email: string,
  role: "admin" | "moderator" | "user",
  tier: number,
  tierName: string,
  aiSuggestions: {
    enabled: boolean,          // user preference (ai_suggestions_enabled)
    available: boolean,        // can AI run right now
    usingOwnKey: boolean,      // true if own API key present
    limits: {
      monthly: number | null,  // null = unlimited (own key or admin)
      used: number,            // calls this calendar month
      remaining: number | null // null = unlimited
    }
  },
  location: {
    stateUsps: string | null,
    placeGeoid: string | null
  },
  createdAt: string
}
```

`PUT /api/profile` accepts partial updates: `{ name?, aiSuggestionsEnabled?, stateUsps?, placeGeoid? }`.

Legacy sub-endpoints (`/api/profile/location`, `/api/profile/usage`) are deprecated in favour of the consolidated endpoint. API key endpoints (`/api/profile/api-keys/*`) remain separate.

### SSE for Profile Changes

PostgreSQL triggers on `user` and `user_api_keys` tables fire `NOTIFY op_profile_changed` with `{ userId }` payload on any UPDATE. The server's LISTEN handler broadcasts `profile:updated` SSE event targeted to that user only.

Frontend `useDocumentSSE` (or a dedicated `useProfileSSE`) handles `profile:updated` and refetches the profile query. No polling needed for profile data.

---

## 7. SSE Updates

### New Event: `document:ready_for_review`

Emitted by `pipeline_complete` job when state transitions to `user_review`.

Payload: `{ id: string, title: string }`

Frontend behavior:
- If user is on `/documents/:id` for that document → TanStack Query refetch only (page re-renders automatically)
- Otherwise → PrimeVue Toast: *"[title] is ready for review"* with link to document

### New Event: `profile:updated`

Emitted via PostgreSQL trigger on `user` / `user_api_keys` UPDATE.

Payload: `{ userId: string }`

Frontend behavior: refetch profile query for the current user.

### Fix: Refetch on Events

`useDocumentSSE` currently only invalidates TanStack Query cache on `document:updated` and `document:state_changed`. This is changed to **invalidate + immediately refetch** so the UI updates without waiting for the next interaction.

### Badge: My Uploads Notification

`useUserReviewCount` composable: counts documents in `user_review` state from the `my-uploads` query. Displayed as a badge on the "My Uploads" nav item.

- Increments: when `document:ready_for_review` fires (TanStack refetch recounts)
- Decrements: when user transitions a document out of `user_review` (→ `draft` or → `moderator_review`); both actions invalidate `my-uploads` query

---

## 8. Schema Changes

### `user` table (application columns)

Add:
- `ai_suggestions_enabled` `boolean` NOT NULL DEFAULT `true`

### `llm_call_logs` table

Add:
- `user_id` `varchar` FK → `user.id` ON DELETE SET NULL, nullable
- `used_system_key` `boolean` NOT NULL DEFAULT `false`
- `total_tokens` `integer` nullable (= input_tokens + output_tokens, stored for convenience)

### `user` trigger (new)

```sql
CREATE OR REPLACE FUNCTION notify_profile_changed()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('op_profile_changed', json_build_object('userId', NEW.id)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profile_notify
  AFTER UPDATE ON "user"
  FOR EACH ROW EXECUTE FUNCTION notify_profile_changed();
```

### `user_api_keys` trigger (new)

Same `notify_profile_changed()` function, triggered on UPDATE:

```sql
CREATE TRIGGER user_api_keys_profile_notify
  AFTER UPDATE ON user_api_keys
  FOR EACH ROW EXECUTE FUNCTION notify_profile_changed();
```

---

## 9. New / Changed API Endpoints

| Method | Path | Auth | Change |
|--------|------|------|--------|
| `GET` | `/api/profile` | user | **New** — consolidated profile response |
| `PUT` | `/api/profile` | user | **New** — update name, ai_suggestions_enabled, location |
| `POST` | `/api/documents/import-from-dc` | user | **New** — single DC import for regular users |
| `POST` | `/api/documents/:id/save-draft` | owner | **New** — `user_review → draft` |
| `POST` | `/api/documents/:id/reopen` | owner | **New** — `rejected → user_review` |
| `POST` | `/api/documents/initiate` | user | **Changed** — remove title/description/date/tags/category/saveAsDraft from body |
| `POST` | `/api/documents/:id/confirm-upload` | owner | **Changed** — add `useAi: boolean` to body |
| `POST` | `/api/documents/:id/submit-for-moderation` | owner | **Unchanged** |
| `POST` | `/api/documents/:id/submit` | owner | **Changed** — draft now transitions to `moderator_review` (not `submitted`) |
| `POST /api/documentcloud/import` | — | moderator | **Unchanged** — batch remains moderator-only |

---

## 10. Components to Create / Update

### New
- `DocumentSourceAutocomplete` — searches states, places, tribes with disambiguating labels
- `useAiPreference` composable — session AI preference with profile persistence
- `useUserReviewCount` composable — count of `user_review` documents
- `useProfileSSE` composable (or extend `useDocumentSSE`) — handles `profile:updated`
- `ReviewView` (inline, not a route) — dual-mode review UI embedded in `DocumentDetailView`
- `AiSuggestionRow` — single field row with accept/edit/discard actions

### Updated
- `UploadView` — replace 4-step wizard with single-page form; add DC tab; add AI toggle
- `DocumentDetailView` — add state-driven mode switching; embed ReviewView for `user_review`/`draft`
- `useDocumentSSE` — invalidate + refetch; add `document:ready_for_review` handler
- `AppSidebar` (or equivalent) — add badge to "My Uploads" nav item
- `useUploadWizardStore` — simplify to only track file/DC selection, Document Source, useAi flag

### Removed
- `AiReviewView` (route `/documents/:id/ai-review`) — functionality moved into `DocumentDetailView`
- `DocumentEditView` (route `/documents/:id/edit`) — edit functionality moved into Review Edit tab
- Upload wizard step components: `UploadMetadataForm`, `UploadLocationForm`
