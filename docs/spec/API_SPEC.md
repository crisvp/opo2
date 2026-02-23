# REST API Specification — Open Panopticon Rebuild

> Complete API surface. Every endpoint is typed. Grouped by resource domain. All endpoints are under `/api/`.

---

## Authentication Convention

All authenticated endpoints require a valid session cookie (set by Better Auth). The Fastify middleware extracts the session and attaches `request.user` and `request.session`. Role checks use the `hasRole()` utility.

| Auth Level | Meaning |
|------------|---------|
| **Public** | No authentication required |
| **Auth** | Valid session required |
| **Moderator** | Session + role ≥ moderator |
| **Admin** | Session + role = admin |

---

## Standard Response Envelope

All responses use a consistent envelope:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

Errors return appropriate HTTP status codes with the envelope:

- `400` — Validation error (Zod parse failure)
- `401` — Not authenticated
- `403` — Insufficient role
- `404` — Resource not found
- `409` — Conflict (duplicate)
- `413` — File too large
- `415` — Unsupported media type
- `422` — Unprocessable entity (e.g., S3 object missing after presigned upload)
- `429` — Rate limit exceeded
- `500` — Internal server error

---

## Rate Limiting

All endpoints are rate-limited via `@fastify/rate-limit` backed by Redis (see SPEC.md SEC-8). Rate limit state is shared across all PM2 cluster instances.

### Response Headers

Every response includes rate limit headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in the current window |
| `X-RateLimit-Remaining` | Remaining requests in the current window |
| `X-RateLimit-Reset` | Unix timestamp (seconds) when the window resets |
| `Retry-After` | Seconds until the client can retry (only on `429` responses) |

### Default Limits

| Scope | Window | Max Requests |
|-------|--------|-------------|
| Global (per IP) | 1 minute | 100 |
| Auth endpoints (`/api/auth/*`) | 15 minutes | 10 |
| Upload initiation (`/api/documents/initiate`) | 1 hour | 50 (also gated by tier limits) |
| ALTCHA challenge (`/api/altcha/challenge`) | 1 minute | 10 |

Authenticated requests are keyed by user ID. Unauthenticated requests are keyed by IP address.

---

## 1. Auth (`/api/auth/*`)

Handled by Better Auth. These are not custom Fastify routes — Better Auth mounts its own handler.

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `POST` | `/api/auth/sign-up/email` | Public | Register (ALTCHA verified) | F01 |
| `POST` | `/api/auth/sign-in/email` | Public | Sign in | F01 |
| `POST` | `/api/auth/sign-out` | Auth | Sign out | F01 |
| `GET` | `/api/auth/get-session` | Auth | Get current session | F01 |
| Various | `/api/auth/passkey/*` | Auth | Passkey operations | F01 |
| Various | `/api/auth/two-factor/*` | Auth | 2FA operations | F01 |

---

## 2. ALTCHA (`/api/altcha`)

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/altcha/challenge` | Public | Generate ALTCHA challenge | F21 |

**Response:**
```typescript
// Challenge object (ALTCHA format)
{ algorithm: string; challenge: string; salt: string; signature: string; }
```

---

## 3. Health (`/api/health`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | Public | Health check |

**Response:** `{ status: "ok"; timestamp: string; }`

---

## 4. Documents (`/api/documents`)

### 4.1 Initiate Upload (Presigned URL)

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `POST` | `/api/documents/initiate` | Auth | Create draft + get presigned upload URL | F02 |

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `filename` | string | Yes | 1-255 chars |
| `contentType` | string | Yes | Allowed MIME type (see F02 allowed types) |
| `contentLength` | number | Yes | 1 – 52,428,800 (50 MB) |
| `title` | string | Yes | 1-500 chars |
| `description` | string | No | Max 5000 chars |
| `documentDate` | string | No | ISO date |
| `governmentLevel` | string | No | federal\|state\|place\|tribal |
| `stateUsps` | string | No | 2 chars |
| `placeGeoid` | string | No | |
| `tribeId` | string | No | |
| `category` | string | No | Valid category ID |
| `tags` | string[] | No | Each 1-100 chars |
| `governmentEntityId` | string | No | Valid catalog entry |

**Response:**

```typescript
ApiResponse<{
  id: string;                  // Document ID (nanoid)
  state: "pending_upload";
  presignedUrl: string;        // S3 presigned POST URL
  presignedFields: Record<string, string>;  // Form fields to include in the S3 POST
  expiresAt: string;           // ISO timestamp — presigned URL expiry
}>
```

**Flow:**
1. Server validates request, checks tier limits, creates DB record in `pending_upload` state.
2. Server generates presigned POST URL for S3 with content-type and size constraints baked in.
3. Client uploads file directly to S3 using the presigned URL and fields.
4. Client calls `POST /api/documents/:id/confirm-upload` after S3 upload completes.

**Errors:** 415 (disallowed MIME type), 413 (content length exceeds limit), 429 (tier limit exceeded)

### 4.2 Confirm Upload

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `POST` | `/api/documents/:id/confirm-upload` | Auth | Verify S3 object and transition to draft/submitted | F02 |

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `s3Key` | string | Yes | S3 object key returned from presigned upload |
| `saveAsDraft` | boolean | No | Default false |

**Response:** `ApiResponse<{ id: string; state: DocumentState; }>`

**Server-side steps:**
1. Verify the document exists, is owned by the requester, and is in `pending_upload` state.
2. Issue a `HeadObject` call to S3 to confirm the object exists and matches expected size/content-type.
3. If `saveAsDraft` is true, transition state to `draft`. Otherwise transition to `submitted` and enqueue the processing pipeline.
4. Return the updated document.

**Errors:** 403 (not owner), 404 (document not found), 409 (not in `pending_upload` state), 422 (S3 object missing or mismatched)

### 4.3 List & Search

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/documents` | Public | Search/list documents | F05 |

**Query Parameters:**

| Param | Type | Default | Validation |
|-------|------|---------|------------|
| `search` | string | — | Full-text search |
| `governmentLevel` | string | — | federal\|state\|place\|tribal |
| `stateUsps` | string | — | 2 chars |
| `placeGeoid` | string | — | |
| `vendorId` | string | — | Catalog entry ID |
| `technologyId` | string | — | Catalog entry ID |
| `category` | string | — | Category ID |
| `tag` | string | — | Tag text |
| `sort` | string | `createdAt` | createdAt\|title\|stateName |
| `sortDir` | string | `desc` | asc\|desc |
| `page` | number | 1 | Positive integer |
| `pageSize` | number | 20 | 1-100 |

**Response:** `ApiResponse<PaginatedResponse<DocumentListItem>>`

### 4.4 My Uploads

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/documents/my-uploads` | Auth | List user's documents | F19 |

**Response:** `ApiResponse<DocumentListItem[]>`

### 4.5 Document Detail

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/documents/:id` | Public* | Get document detail | F04 |

*Access control: approved docs are public; owner sees own; moderators see moderator_review; admins see all.

**Response:** `ApiResponse<Document & { tags: string[]; associations: DocumentCatalogAssociation[]; metadata: DocumentMetadata[]; relatedDocuments: DocumentDocumentAssociation[]; }>`

### 4.6 Update Document

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `PUT` | `/api/documents/:id` | Auth | Update document metadata | F14 |

**Request Body:** `UpdateDocumentInput` (see DATA_SPEC)

**Response:** `ApiResponse<Document>`

**Errors:** 403 (not owner or not editable state)

### 4.7 Update Location

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `PUT` | `/api/documents/:id/location` | Auth | Update document location | F14 |

**Request Body:** `UpdateDocumentLocationInput`

**Response:** `ApiResponse<Document>`

### 4.8 File Operations

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/documents/:id/preview` | Public* | Stream PDF preview | F04 |
| `GET` | `/api/documents/:id/download` | Public* | Download original file | F04 |

*Same access control as document detail.

**Response:** Binary stream with appropriate Content-Type and Content-Disposition headers.

### 4.9 Submit Draft

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `POST` | `/api/documents/:id/submit` | Auth | Submit draft for processing | F19 |

**Response:** `ApiResponse<{ id: string; state: "submitted"; }>`

**Errors:** 403 (not owner), 409 (not in DRAFT state), 429 (tier limit)

### 4.10 Tags

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `POST` | `/api/documents/:id/tags` | Auth | Sync tags (replace all) | F20 |
| `POST` | `/api/documents/:id/tags/add` | Auth | Add single tag | F20 |
| `DELETE` | `/api/documents/:id/tags/:tag` | Auth | Remove tag | F20 |

**Sync Body:** `{ tags: string[]; }`
**Add Body:** `{ tag: string; }`

### 4.11 Catalog Associations

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `POST` | `/api/documents/:id/associations` | Auth | Sync catalog associations | F14 |

**Request Body:** `SyncDocumentAssociationsInput` (see DATA_SPEC)

**Response:** `ApiResponse<DocumentCatalogAssociation[]>`

### 4.12 Metadata

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `PUT` | `/api/documents/:id/metadata` | Auth | Set/update metadata values | F14 |
| `DELETE` | `/api/documents/:id/metadata/:fieldKey` | Auth | Delete metadata value | F14 |

**Set Body:** `{ values: SetMetadataValueInput[]; }`

### 4.13 AI Metadata

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/documents/:id/ai-metadata` | Auth | Get AI extraction results | F07 |
| `POST` | `/api/documents/:id/submit-for-moderation` | Auth | Submit after review | F07 |
| `POST` | `/api/documents/:id/retry-extraction` | Auth | Retry AI extraction | F07 |
| `POST` | `/api/documents/:id/admin-rerun-extraction` | Admin | Force re-run extraction | F07 |

**AI Metadata Response:**
```typescript
ApiResponse<{
  processingResults: DocumentProcessingResults;
  extractedMetadata: Record<string, unknown> | null;
  catalogMatches: { typeId: string; name: string; entryId: string | null; confidence: number; }[];
}>
```

### 4.14 Moderation

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `POST` | `/api/documents/:id/approve` | Moderator | Approve document | F09 |
| `POST` | `/api/documents/:id/reject` | Moderator | Reject document | F09 |

**Reject Body:** `{ reason: string; }` (1-1000 chars)

### 4.15 Document-Document Associations

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/documents/:id/related` | Public* | List related documents | F25 |
| `POST` | `/api/documents/:id/related` | Auth | Add document association | F25 |
| `DELETE` | `/api/document-associations/:id` | Auth | Remove association | F25 |

**Add Body:** `{ targetDocumentId: string; associationTypeId: string; context?: string; }`

---

## 5. Moderation Queue (`/api/moderation`)

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/moderation/queue` | Moderator | List pending documents | F09 |

**Query Params:** `page`, `pageSize`

**Response:** `ApiResponse<PaginatedResponse<DocumentListItem>>`

---

## 6. Catalog (`/api/catalog`)

### 6.1 Types

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/catalog/types` | Public | List catalog types | F08 |

**Response:** `ApiResponse<CatalogType[]>`

### 6.2 Entries

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/catalog/entries` | Public | List/search entries | F08 |
| `GET` | `/api/catalog/entries/:id` | Public | Get entry with aliases | F08 |
| `POST` | `/api/catalog/entries` | Moderator | Create entry | F08 |
| `PUT` | `/api/catalog/entries/:id` | Moderator | Update entry | F08 |
| `DELETE` | `/api/catalog/entries/:id` | Moderator | Delete entry | F08 |

**List Query Params:** `typeId`, `search`, `verified` (boolean), `page`, `pageSize`

**Response (list):** `ApiResponse<PaginatedResponse<CatalogEntry>>`
**Response (detail):** `ApiResponse<CatalogEntry & { aliases: CatalogAlias[]; associations: CatalogEntryAssociation[]; }>`

### 6.3 Aliases

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `POST` | `/api/catalog/entries/:id/aliases` | Moderator | Add alias | F08 |
| `DELETE` | `/api/catalog/aliases/:id` | Moderator | Remove alias | F08 |

**Add Body:** `{ alias: string; source?: "manual" | "ai_suggestion" | "import"; }`

### 6.4 Search

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/catalog/search` | Public | Trigram search | F08 |

**Query Params:** `q` (required), `typeId` (optional), `limit` (default 20)

**Response:** `ApiResponse<{ id: string; name: string; typeId: string; typeName: string; similarity: number; }[]>`

### 6.5 Entry Associations

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `POST` | `/api/catalog/entries/:id/associations` | Moderator | Create catalog entry association | F08 |
| `DELETE` | `/api/catalog/associations/:id` | Moderator | Remove catalog entry association | F08 |

**Create Body:** `{ targetEntryId: string; associationTypeId: string; }`

**Response (create):** `ApiResponse<{ id: string; sourceEntryId: string; targetEntryId: string; associationTypeId: string; createdAt: string; }>`

### 6.6 Association Types

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/association-types` | Public | List association types | F08 |

**Response:** `ApiResponse<AssociationType[]>`

---

## 7. Categories (`/api/categories`)

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/categories` | Public | List categories with rules | F15 |
| `GET` | `/api/categories/:id` | Public | Get category detail | F15 |
| `POST` | `/api/categories` | Moderator | Create category | F15 |
| `PUT` | `/api/categories/:id` | Moderator | Update category | F15 |
| `DELETE` | `/api/categories/:id` | Moderator | Delete category | F15 |
| `GET` | `/api/categories/:id/fields` | Public | List field definitions | F15 |
| `POST` | `/api/categories/:id/fields` | Moderator | Create field definition | F15 |
| `PUT` | `/api/field-definitions/:id` | Moderator | Update field definition | F15 |
| `DELETE` | `/api/field-definitions/:id` | Moderator | Delete field definition | F15 |
| `PUT` | `/api/categories/:id/rules` | Moderator | Update association rules | F15 |

**Category List Response:** `ApiResponse<(DocumentCategoryRecord & { associationRules: CategoryAssociationRules; fieldCount: number; })[]>`

---

## 8. Policy Types (`/api/policy-types`)

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/policy-types` | Public | List policy types | F22 |
| `POST` | `/api/policy-types` | Admin | Create policy type | F22 |
| `DELETE` | `/api/policy-types/:id` | Admin | Delete policy type | F22 |

---

## 9. Locations (`/api/locations`)

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/locations/states` | Public | List all states | F03 |
| `GET` | `/api/locations/states/:usps/places` | Public | List places in state | F03 |
| `GET` | `/api/locations/tribes` | Public | List/search tribes | F03 |
| `POST` | `/api/locations/nearest` | Public | Find nearest places | F03 |
| `GET` | `/api/locations/overview/:level/:state?/:place?` | Public | Location overview | F03 |

**Nearest Body:** `{ lat: number; lon: number; limit?: number; }`

**Overview Response:**
```typescript
ApiResponse<{
  documentCount: number;
  documentsByCategory: Record<string, number>;
  policies: { typeId: string; typeName: string; exists: boolean; documentId: string | null; }[];
  vendors: { id: string; name: string; documentCount: number; }[];
  technologies: { id: string; name: string; documentCount: number; }[];
  agencies: { id: string; name: string; category: string | null; documentCount: number; }[];
  stateMetadata: { key: string; value: string; url: string | null; }[];
}>
```

---

## 10. Tiers (`/api/tiers`)

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/tiers` | Public | List all tiers | F10 |
| `GET` | `/api/tiers/:id` | Public | Get tier detail | F10 |
| `POST` | `/api/tiers` | Admin | Create tier | F10 |
| `PUT` | `/api/tiers/:id` | Admin | Update tier | F10 |
| `PUT` | `/api/tiers/:id/limits` | Admin | Update tier limits | F10 |
| `DELETE` | `/api/tiers/:id` | Admin | Delete tier | F10 |

---

## 11. Profile (`/api/profile`)

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/profile/location` | Auth | Get location preference | F18 |
| `PUT` | `/api/profile/location` | Auth | Update location preference | F18 |
| `GET` | `/api/profile/usage` | Auth | Get tier and usage info | F18, F10 |
| `GET` | `/api/profile/api-keys` | Auth | Get API key status | F11 |
| `PUT` | `/api/profile/api-keys/openrouter` | Auth | Set OpenRouter key | F11 |
| `DELETE` | `/api/profile/api-keys/openrouter` | Auth | Delete key | F11 |
| `PUT` | `/api/profile/api-keys/openrouter/settings` | Auth | Update key settings | F11 |

---

## 12. Agencies (`/api/agencies`)

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/agencies` | Public | List agencies | F17 |
| `GET` | `/api/agencies/:id` | Public | Get agency detail | F17 |
| `POST` | `/api/agencies` | Moderator | Create agency | F17 |
| `PUT` | `/api/agencies/:id` | Moderator | Update agency | F17 |
| `DELETE` | `/api/agencies/:id` | Moderator | Delete agency | F17 |

**List Query Params:** `stateUsps`, `category`, `page`, `pageSize`

---

## 13. State Metadata (`/api/state-metadata`)

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/state-metadata` | Public | List metadata | F17 |
| `POST` | `/api/state-metadata` | Moderator | Create entry | F17 |
| `PUT` | `/api/state-metadata/:id` | Moderator | Update entry | F17 |
| `DELETE` | `/api/state-metadata/:id` | Moderator | Delete entry | F17 |

**List Query Params:** `stateUsps`

---

## 14. Admin (`/api/admin`)

### 14.1 Stats

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/admin/stats` | Admin | Platform statistics | F16 |

**Response:**
```typescript
ApiResponse<{
  userCount: number;
  documentCounts: Record<DocumentState, number>;
  totalDocuments: number;
}>
```

### 14.2 Users

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/admin/users` | Admin | List users | F16 |
| `GET` | `/api/admin/users/:id` | Admin | User detail | F16 |
| `PUT` | `/api/admin/users/:id/role` | Admin | Change role | F16 |
| `PUT` | `/api/admin/users/:id/tier` | Admin | Change tier | F16 |
| `DELETE` | `/api/admin/users/:id` | Admin | Anonymize user | F16 |

**List Query Params:** `search`, `role`, `page`, `pageSize`

**Role Body:** `{ role: "admin" | "moderator" | "user"; }`
**Tier Body:** `{ tier: number; }`

### 14.3 Failed Processing

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/admin/failed-processing` | Admin | List failed docs | F16 |
| `POST` | `/api/admin/failed-processing/:id/retry` | Admin | Retry processing | F16 |
| `DELETE` | `/api/admin/failed-processing/:id` | Admin | Delete failed doc | F16 |

### 14.4 Stuck Processing

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/admin/stuck-processing` | Admin | Detect stuck docs | F16 |

### 14.5 Jobs

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/admin/jobs` | Admin | List jobs | F16 |
| `GET` | `/api/admin/jobs/:id` | Admin | Job detail with logs | F16 |
| `POST` | `/api/admin/jobs/:id/retry` | Admin | Retry job | F16 |
| `POST` | `/api/admin/jobs/:id/cancel` | Admin | Cancel job | F16 |
| `POST` | `/api/admin/jobs/bulk-retry` | Admin | Bulk retry failed | F16 |
| `DELETE` | `/api/admin/jobs/completed` | Admin | Clear completed logs | F16 |

**List Query Params:** `status`, `taskIdentifier`, `page`, `pageSize`

**Job Detail Response:**
```typescript
ApiResponse<{
  job: { id: string; taskIdentifier: string; payload: unknown; status: string; attempts: number; createdAt: string; };
  executionLogs: JobExecutionLog[];
  llmCallLogs: LlmCallLog[];
}>
```

---

## 15. DocumentCloud (`/api/documentcloud`)

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/documentcloud/status` | Auth | Check DC availability | F12 |
| `GET` | `/api/documentcloud/search` | Auth | Search DocumentCloud | F12 |
| `POST` | `/api/documentcloud/import` | Moderator | Import single doc | F12 |
| `POST` | `/api/documentcloud/import/batch` | Moderator | Batch import | F12 |
| `GET` | `/api/documentcloud/import/:jobId` | Auth | Import job status | F12 |
| `GET` | `/api/documentcloud/jobs` | Auth | List import jobs | F12 |

**Search Query Params:** `q`, `organization`, `project`, `ordering`, `page`, `perPage`

**Import Body:** `{ documentCloudId: number; options?: { addTags?: string[]; governmentLevel?: string; stateUsps?: string; placeGeoid?: string; tribeId?: string; }; }`

**Batch Body:** `{ documentCloudIds: number[]; options?: { ... }; }` (max 100)

---

## 16. SSE (`/api/sse`)

| Method | Path | Auth | Description | Features |
|--------|------|------|-------------|----------|
| `GET` | `/api/sse/documents` | Auth | Document status stream | F13 |
| `GET` | `/api/sse/health` | Public | SSE service health | F13 |

**SSE Event Types:**
- `connected` — Initial connection acknowledgment
- `heartbeat` — 30-second keepalive
- `document:state_changed` — `{ documentId: string; state: DocumentState; previousState: DocumentState; }`
- `document:processing_update` — `{ documentId: string; stage: string; status: string; }`

---

## Summary

| Domain | Endpoint Count |
|--------|---------------|
| Auth (Better Auth) | 6+ |
| ALTCHA | 1 |
| Health | 1 |
| Documents | 21 |
| Moderation | 1 |
| Catalog | 8 |
| Categories | 10 |
| Policy Types | 3 |
| Locations | 5 |
| Tiers | 6 |
| Profile | 7 |
| Agencies | 5 |
| State Metadata | 4 |
| Admin | 13 |
| DocumentCloud | 6 |
| SSE | 2 |
| **Total** | **~99** |
