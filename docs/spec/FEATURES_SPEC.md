# Feature Specifications — Open Panopticon Rebuild

> Ordered by implementation priority. Each feature includes acceptance criteria, API surface, frontend components, state management, validation, test requirements, and dependencies.

---

## Implementation Phases

| Phase | Features | Rationale |
|-------|----------|-----------|
| **Phase 1 — Foundation** | F01, F08, F03, F15, F10 | Auth, catalog, locations, categories, and tiers are prerequisites for everything else |
| **Phase 2 — Core Document Flow** | F02, F06, F19, F04, F05, F20, F13 | Upload, processing, drafts, viewing, browsing, tags, real-time updates |
| **Phase 3 — Review & Moderation** | F07, F09, F14 | AI review, moderation queue, document editing |
| **Phase 4 — Administration** | F16, F11, F17, F18, F21 | Admin dashboard, API keys, agencies, profile, ALTCHA |
| **Phase 5 — Integration & Polish** | F12, F22, F23, F24, F25 | DocumentCloud, policy cards, draft cleanup, home page, document-document associations |

---

## F01 — User Registration & Authentication

**Priority:** 1-HIGH

**Acceptance Criteria:**

- Users can register with email, name, and password after solving an ALTCHA challenge
- Users can sign in with email/password
- Users can register and authenticate with passkeys
- Users can enable TOTP two-factor authentication with QR code and backup codes
- Sessions last 7 days, refresh every 24 hours
- First registered user is auto-promoted to admin
- All authenticated routes redirect to `/login` with return URL
- Admin/moderator routes enforce role hierarchy

**API Endpoints:**

- `POST /api/auth/sign-up/email` — Register (ALTCHA verified in hook)
- `POST /api/auth/sign-in/email` — Sign in
- `POST /api/auth/sign-out` — Sign out
- `GET /api/auth/get-session` — Get current session
- Better Auth handles passkey and 2FA endpoints automatically

**Frontend Components:**

- `LoginView` — Email/password sign-in form
- `RegisterView` — Registration form with ALTCHA widget
- `SecuritySettingsView` — Passkey management, 2FA setup
- `TwoFactorView` — 2FA verification during sign-in

**State Management:**

- **Pinia:** `useAuthStore` — current user, session state, initialized flag
- **TanStack Query:** None (auth state is not cacheable server state; it's session identity)

**Validation:**

- Email: valid email format
- Password: minimum 8 characters
- Name: 1-100 characters
- ALTCHA payload: verified server-side via altcha-lib

**Test Cases:**

- Unit: ALTCHA verification, role hierarchy checks (`hasRole`)
- Integration: Registration flow, sign-in flow, session retrieval, role-based route protection
- E2E: Full registration → sign-in → sign-out flow

**Dependencies:** None (foundational)

---

## F08 — Unified Catalog System

**Priority:** 1-HIGH

**Acceptance Criteria:**

- Moderators/admins can CRUD catalog entries of types: vendor, product, technology, government_entity, person, organization
- Each entry has a name, optional attributes (JSON), and a verified flag
- Entries can have aliases (manual, AI-suggested, imported) for fuzzy matching
- Products can be associated with vendors; entries can have typed relationships
- Catalog search uses trigram matching for fuzzy search
- Documents link to catalog entries via document_catalog_associations with optional role and context

**API Endpoints:**

- `GET /api/catalog/types` — List catalog types
- `GET /api/catalog/entries` — List/search entries (query: `typeId`, `search`, `verified`, pagination)
- `GET /api/catalog/entries/:id` — Get entry with aliases and associations
- `POST /api/catalog/entries` — Create entry (moderator+)
- `PUT /api/catalog/entries/:id` — Update entry (moderator+)
- `DELETE /api/catalog/entries/:id` — Delete entry (moderator+)
- `POST /api/catalog/entries/:id/aliases` — Add alias (moderator+)
- `DELETE /api/catalog/aliases/:id` — Remove alias (moderator+)
- `GET /api/catalog/search` — Trigram search across all entries
- `POST /api/catalog/entries/:id/associations` — Create catalog entry association (moderator+)
- `DELETE /api/catalog/associations/:id` — Remove catalog entry association (moderator+)
- `GET /api/association-types` — List association types

**Frontend Components:**

- `CatalogManageView` — Admin page; hierarchical tree (vendor-view, technology-view, all-view tabs) + slide-out drawer
- `CatalogEntryDrawer` — Slide-out detail panel with Details / Aliases / Associations tabs
- `CatalogEntryForm` — Create/edit form for catalog entries
- `CatalogEntrySelect` — Autocomplete selector for linking entries to documents
- `CatalogAssociationsManager` — Bidirectional association editor (used inside CatalogEntryDrawer)
- `VendorProductSelector` — Specialized selector for vendor→product hierarchy
- `GovernmentEntitySelector` — Selector for government entities with location context
- `AliasManager` — Component for managing aliases on an entry

**State Management:**

- **TanStack Query:** All catalog queries (`catalogEntries`, `catalogTypes`, `associationTypes`, `catalogSearch`)
- **Pinia:** None

**Validation:**

- Entry name: 1-500 characters, unique per type
- Alias: 1-500 characters, unique per entry
- Alias source: one of `manual`, `ai_suggestion`, `import`
- Association type: must exist in `association_types`

**Test Cases:**

- Unit: Alias normalization, name uniqueness validation
- Integration: CRUD operations, trigram search, alias management
- Component: CatalogEntrySelect autocomplete behavior

**Dependencies:** None (foundational)

---

## F03 — Location System

**Priority:** 1-HIGH

**Acceptance Criteria:**

- Location index page shows all US states and territories
- State browse page shows places within a state with document counts
- Location overview page aggregates: document counts by category, policy status, technologies, vendors, agencies, state metadata
- Place autocomplete uses browser geolocation to find nearest places
- Tribal overview shows documents for a specific tribe
- Four government levels: federal, state, place, tribal

**API Endpoints:**

- `GET /api/locations/states` — List all states
- `GET /api/locations/states/:usps/places` — List places in a state (with document counts)
- `GET /api/locations/tribes` — List/search tribes
- `POST /api/locations/nearest` — Find nearest places by coordinates
- `GET /api/locations/overview/:level/:state?/:place?` — Location overview aggregation

**Frontend Components:**

- `LocationsIndexView` — States grid
- `StateBrowseView` — Places within a state
- `LocationOverviewView` — Aggregated location details (policies, vendors, technologies, agencies)
- `TribalOverviewView` — Tribal territory overview
- `LocationSelector` — Combined state/place/tribe selector
- `PlaceAutocomplete` — Search-as-you-type place selector
- `TribeAutocomplete` — Search-as-you-type tribe selector
- `GeolocationButton` — Browser geolocation trigger
- `LocationDisplay` — Read-only formatted location display

**State Management:**

- **TanStack Query:** State lists, place lists, tribal lists, nearest places, overview data
- **Pinia:** None

**Validation:**

- Coordinates: lat -90 to 90, lon -180 to 180
- State USPS: exactly 2 uppercase characters
- Place GEOID: valid string matching Census data
- Location consistency: federal has no state/place/tribe; state requires USPS only; place requires USPS + GEOID; tribal requires tribe ID

**Test Cases:**

- Unit: Location validation (government level + location consistency), `formatPlaceDisplayName`
- Integration: Nearest places query, overview aggregation
- Component: LocationSelector state transitions, PlaceAutocomplete

**Dependencies:** Seed data (states, places, tribes from Census gazetteer)

---

## F15 — Document Categories & Dynamic Metadata

**Priority:** 1-HIGH

**Acceptance Criteria:**

- 13 document categories exist (contract, proposal, policy, meeting_agenda, meeting_minutes, invoice, correspondence, audit_report, training_material, foia_request, procurement, compliance, other)
- Each category has configurable field definitions (text, number, date, boolean, currency, enum)
- Fields can be marked as required and/or AI-extractable
- Association rules per category define min/max for vendors, products, technologies, government entities
- Moderators manage categories, field definitions, and association rules via admin UI
- Policy types are configurable (defaults: purchasing, ALPR, surveillance)

**API Endpoints:**

- `GET /api/categories` — List all categories with field definitions and association rules
- `GET /api/categories/:id` — Get category detail with rules
- `POST /api/categories` — Create category (moderator+)
- `PUT /api/categories/:id` — Update category (moderator+)
- `DELETE /api/categories/:id` — Delete category (moderator+)
- `GET /api/categories/:id/fields` — List field definitions for category
- `POST /api/categories/:id/fields` — Create field definition (moderator+)
- `PUT /api/field-definitions/:id` — Update field definition (moderator+)
- `DELETE /api/field-definitions/:id` — Delete field definition (moderator+)
- `PUT /api/categories/:id/rules` — Update association rules (moderator+)
- `GET /api/policy-types` — List policy types
- `POST /api/policy-types` — Create policy type (admin)
- `DELETE /api/policy-types/:id` — Delete policy type (admin)

**Frontend Components:**

- `DocumentTypesManageView` — Admin page for categories and field definitions
- `CategoryForm` — Create/edit category form
- `FieldDefinitionForm` — Create/edit field definition form
- `AssociationRulesManager` — Min/max rule editor per category
- `CategorySelector` — Category picker for document forms
- `DynamicMetadataForm` — Renders field definitions as form inputs based on category

**State Management:**

- **TanStack Query:** Categories, field definitions, association rules, policy types
- **Pinia:** None

**Validation:**

- Category ID: lowercase letters, numbers, underscores, starts with letter, 1-50 chars
- Category name: 1-200 characters
- Field key: snake_case, 1-100 characters
- Field type: one of text, number, date, boolean, currency, enum
- Enum values: required array when field type is enum
- Association rule values: non-negative integers, min <= max when both specified

**Test Cases:**

- Unit: Field definition validation, association rule validation, dynamic form schema generation
- Integration: Category CRUD, field definition CRUD, rule updates
- Component: DynamicMetadataForm rendering for each field type

**Dependencies:** None (foundational)

---

## F10 — User Tier & Usage System

**Priority:** 1-HIGH

**Acceptance Criteria:**

- Users are assigned to a tier (default: Tier 1 "Basic")
- Each tier has daily limits for `uploads` and `llm_metadata`
- Default limits: Tier 1 (10/10), Tier 2 (50/50), Tier 3 (500/500)
- Usage resets daily at midnight Central Time
- Admins are exempt from all limits
- Users with custom OpenRouter API keys are exempt from LLM limits
- Admins can CRUD tier definitions and limits

**API Endpoints:**

- `GET /api/tiers` — List all tiers with limits (public)
- `GET /api/tiers/:id` — Get tier detail (public)
- `POST /api/tiers` — Create tier (admin)
- `PUT /api/tiers/:id` — Update tier (admin)
- `PUT /api/tiers/:id/limits` — Update tier limits (admin)
- `DELETE /api/tiers/:id` — Delete tier (admin, not default tier)

**Frontend Components:**

- `TierManageView` — Admin page for tier management
- `TierForm` — Create/edit tier form
- `TierBadge` — Displays user's current tier
- `UsageLimitBar` — Progress bar showing usage vs limit

**State Management:**

- **TanStack Query:** Tier definitions, user usage info
- **Pinia:** None

**Validation:**

- Tier ID: positive integer
- Tier name: 1-50 characters
- Limit type: string, min 1 character
- Limit value: non-negative integer

**Test Cases:**

- Unit: `getTierLimit`, `isValidTier`, limit checking logic
- Integration: Tier CRUD, limit enforcement during upload
- Component: UsageLimitBar rendering

**Dependencies:** F01 (auth for role checks)

---

## F02 — Document Upload

**Priority:** 1-HIGH (Phase 2)

**Acceptance Criteria:**

- Authenticated users can upload documents (PDF, Office formats, images, CSV, text)
- Upload wizard collects: file, title, description, document date, government level, location, category, tags, government entity
- File size limit: 50 MB
- **Files upload directly to S3 via presigned POST URL — never through Fastify**
- Users choose "Save as Draft" or "Submit" (triggers processing pipeline)
- Tier-based upload limits enforced (admins exempt)

**Upload Flow (two-step presigned URL):**

1. **Step 1 — Initiate:** `POST /api/documents/initiate` with metadata (title, description, filename, mimetype, size, etc.). Fastify validates metadata and tier limits, creates a `documents` row in `pending_upload` state, generates an S3 presigned POST URL scoped to a specific key, and returns both the document ID and presigned URL.
2. **Step 2 — Browser uploads file directly to S3** using the presigned URL. No data touches Fastify.
3. **Step 3 — Confirm:** `POST /api/documents/:id/confirm-upload`. Fastify verifies the S3 object exists and matches expected size/type, updates the document state from `pending_upload` to `draft` (if save-as-draft) or `submitted` (if immediate submit), and enqueues the processing pipeline if submitted.
4. **Abandoned uploads:** A cleanup task deletes `pending_upload` documents older than 1 hour (and their S3 objects if present).

**API Endpoints:**

- `POST /api/documents/initiate` — Create pending upload, get presigned URL
- `POST /api/documents/:id/confirm-upload` — Confirm file uploaded to S3

Request body (initiate, JSON):
- `title`: string (1-500)
- `filename`: string
- `mimetype`: string (validated against allowlist)
- `size`: number (max 50MB)
- `description`: string (optional, max 5000)
- `documentDate`: ISO date string (optional)
- `governmentLevel`: federal|state|place|tribal (optional)
- `stateUsps`: string(2) (optional)
- `placeGeoid`: string (optional)
- `tribeId`: string (optional)
- `category`: string (optional)
- `tags`: string[] (optional)
- `governmentEntityId`: string (optional)
- `saveAsDraft`: boolean (default false)

Response (initiate):
- `documentId`: string
- `presignedUrl`: string (S3 presigned POST URL)
- `presignedFields`: Record<string, string> (form fields for S3 POST)
- `objectKey`: string (the S3 key the file will be stored at)

Request body (confirm-upload, JSON):
- `objectKey`: string (must match the key from initiate)

**Frontend Components:**

- `UploadView` — Upload wizard page
- `FileDropzone` — Drag-and-drop file input
- `UploadMetadataForm` — Title, description, date, category, government entity
- `UploadLocationForm` — Location selector step
- `UploadProgress` — S3 direct upload progress indicator

**State Management:**

- **TanStack Query:** Initiate mutation, confirm mutation
- **Pinia:** `useUploadWizardStore` — Multi-step form state (file, metadata, location, tags). Reset on navigation away.

**Validation:**

- File: required, max 50 MB, allowed MIME types (PDF, JPEG, PNG, GIF, WebP, text, CSV, Word, Excel)
- MIME type validated both client-side (before initiate) and server-side (in initiate handler + S3 presigned conditions)
- Title: 1-500 characters
- Description: max 5000 characters
- Location consistency: validated per government level rules
- Confirm: S3 object must exist, size must match declared size within tolerance

**Test Cases:**

- Unit: File validation (MIME, size), location validation, presigned URL generation
- Integration: Initiate endpoint (tier limit enforcement), confirm endpoint (S3 verification), abandoned upload cleanup
- E2E: Full upload flow (file selection → metadata → S3 upload → confirm)

**Dependencies:** F01 (auth), F03 (location), F08 (catalog for government entity), F10 (tier limits), F15 (categories)

---

## F06 — Document Processing Pipeline

**Priority:** 1-HIGH (Phase 2)

**Acceptance Criteria:**

- After upload confirmation, document enters PROCESSING state
- Pipeline: virus_scan → pdf_convert → sieve → extractor → pipeline_complete
- Each stage records results in `document_processing_results`
- Virus scan via ClamAV; failed scan quarantines file
- PDF conversion via LibreOffice **Docker sidecar** for non-PDF files (never on the API/worker host)
- Sieve: vision LLM classifies document relevance (HIGH_RELEVANCE, ADMIN_FINANCE, JUNK, UNCERTAIN)
- Extractor: vision LLM extracts structured metadata (title, description, dates, entities, category)
- Pipeline complete: updates document state, sends PostgreSQL NOTIFY for SSE
- On failure: document moves to PROCESSING_FAILED
- Each stage logs execution details to `job_execution_logs`
- LLM calls logged to `llm_call_logs` with token counts and costs

**LibreOffice Isolation:**

The `pdf_convert` task communicates with a Docker sidecar container running LibreOffice. The sidecar:
- Runs as an unprivileged user (no root)
- Has no network access (internal Docker network only, no egress)
- Has a read-only filesystem except for a temp directory
- Exposes a simple HTTP API: `POST /convert` accepts a file, returns the converted PDF
- The worker uploads the source file to the sidecar, receives the PDF, and stores it in S3

If the sidecar is unreachable, the task fails and the document moves to PROCESSING_FAILED.

**Worker Job Timeouts:**

Each pipeline task has an explicit timeout. If a job exceeds its timeout, Graphile Worker marks it as failed.

| Task | Timeout | Rationale |
|------|---------|-----------|
| `virus_scan` | 2 minutes | ClamAV scans are fast; timeout catches hung connections |
| `pdf_convert` | 5 minutes | LibreOffice can be slow on large documents |
| `sieve` | 3 minutes | Single LLM API call with vision |
| `extractor` | 10 minutes | Multi-page vision extraction, may retry |
| `pipeline_complete` | 30 seconds | Database update + NOTIFY only |
| `cleanup_expired_drafts` | 5 minutes | Batch delete operation |
| `documentcloud_import` | 10 minutes | Downloads PDF from external API |

Timeouts are configured via `jobTimeout` in the Graphile Worker task definition. A timed-out job is treated as a failure: the document moves to PROCESSING_FAILED, and the job execution log records the timeout.

**Dead-letter behavior:** Jobs that fail after maximum retries (default: 3) remain in the failed state. They appear in the admin failed-processing view. Admins can retry or delete them. No automatic re-enqueue after final failure.

**API Endpoints:**

- None directly (pipeline is server-side worker tasks)

**Frontend Components:**

- Processing status shown via SSE (see F13)

**State Management:**

- N/A (server-side only)

**Validation:**

- Pipeline config loaded from YAML, validated with Zod schemas
- LLM structured output validated against extraction schema

**Test Cases:**

- Unit: Pipeline config loading, sieve/extractor response parsing, state transitions, timeout configuration
- Integration: Full pipeline (mocked external services), job execution logging, LLM call logging, timeout behavior, sidecar communication
- Integration: Verify timed-out jobs correctly transition document to PROCESSING_FAILED

**Dependencies:** ClamAV, LibreOffice sidecar (Docker), OpenRouter API, S3

---

## F19 — Document Draft Workflow

**Priority:** 1-HIGH (Phase 2)

**Acceptance Criteria:**

- Users can save uploads as drafts without triggering the processing pipeline
- Drafts do not count toward usage limits until submitted
- Users can edit drafts freely (DRAFT state is editable)
- Submitting a draft checks upload and LLM limits, then enqueues processing
- My Uploads page shows all user's documents grouped by state
- Documents in `pending_upload` state (awaiting S3 upload confirmation) are not shown in My Uploads and are cleaned up after 1 hour

**API Endpoints:**

- `POST /api/documents/:id/submit` — Submit a draft for processing
- `GET /api/documents/my-uploads` — List current user's documents (excludes `pending_upload`)

**Frontend Components:**

- `MyUploadsView` — User's document list grouped by state

**State Management:**

- **TanStack Query:** My uploads query, submit mutation

**Validation:**

- Submit: document must be in DRAFT state, owned by current user, tier limits checked

**Test Cases:**

- Unit: State transition validation (DRAFT → SUBMITTED)
- Integration: Submit draft endpoint, limit enforcement
- E2E: Upload as draft → edit → submit flow

**Dependencies:** F02 (upload), F06 (processing), F10 (tier limits)

---

## F04 — Document Viewing

**Priority:** 1-HIGH (Phase 2)

**Acceptance Criteria:**

- Approved documents visible to all users
- Document owner sees own drafts/pending documents
- Moderators see documents in `moderator_review` state
- PDF preview served inline; converted PDF shown for non-PDF originals
- CSV files shown in tabular viewer
- Download button provides original file
- Document detail shows: title, description, date, category, location, tags, catalog associations, metadata, document-document associations

**API Endpoints:**

- `GET /api/documents/:id` — Get document detail
- `GET /api/documents/:id/preview` — Get PDF preview (stream)
- `GET /api/documents/:id/download` — Download original file

**Frontend Components:**

- `DocumentDetailView` — Document detail page (route: `/documents/:id`)
- `DocumentPreviewPanel` — PDF/CSV preview sidebar
- `PdfViewer` — PDF.js-based viewer
- `CsvViewer` — PapaParse-based table viewer
- `DocumentMetadataPanel` — Displays metadata fields
- `DocumentAssociationsPanel` — Displays catalog associations
- `DocumentRelatedPanel` — Displays document-document associations

**State Management:**

- **TanStack Query:** Document detail query, preview URL

**Validation:**

- Access control: document visibility based on state + user role + ownership

**Test Cases:**

- Unit: Access control logic (who can see what state)
- Integration: Detail endpoint, preview endpoint, download endpoint
- Component: PdfViewer rendering, CsvViewer rendering

**Dependencies:** F01 (auth), F06 (for converted PDFs)

---

## F05 — Document Browsing & Search

**Priority:** 1-HIGH (Phase 2)

**Acceptance Criteria:**

- Full-text search across document titles and descriptions
- Filter by: government level, state, place, vendor, technology, category, tags
- Paginated results with sort options (created date, title, state)
- Only approved documents shown to anonymous/regular users
- Moderators see documents in moderator_review in addition

**API Endpoints:**

- `GET /api/documents` — Search/list documents (query params: `search`, `governmentLevel`, `stateUsps`, `placeGeoid`, `vendorId`, `technologyId`, `category`, `tag`, `sort`, `page`, `pageSize`)

**Frontend Components:**

- `BrowseView` — Search page with filters and results
- `DocumentFilterPanel` — Filter sidebar
- `DocumentCard` — Document result card
- `SearchInput` — Search text input with debounce

**State Management:**

- **TanStack Query:** Document search query (parameterized by filters)
- **Pinia:** `useBrowseFiltersStore` — Filter state (synced to URL query params)

**Validation:**

- Page: positive integer (default 1)
- PageSize: 1-100 (default 20)
- Sort: one of `createdAt`, `title`, `stateName`

**Test Cases:**

- Unit: Pagination validation, filter schema validation
- Integration: Search with various filter combinations, full-text search
- Component: Filter panel state management, URL sync

**Dependencies:** F03 (location filters), F08 (catalog filters)

---

## F20 — Tagging System

**Priority:** 2-MEDIUM (Phase 2)

**Acceptance Criteria:**

- Users can add freeform text tags to documents during upload or editing
- Tags displayed on document detail page
- Tags usable as search filter
- Tags can be synced (bulk replace) or added individually

**API Endpoints:**

- `POST /api/documents/:id/tags` — Sync tags (replace all)
- `POST /api/documents/:id/tags/add` — Add single tag
- `DELETE /api/documents/:id/tags/:tag` — Remove single tag

**Frontend Components:**

- `TagInput` — Multi-tag input with autocomplete from existing tags
- Tags displayed inline on `DocumentDetailView` and `DocumentCard`

**State Management:**

- **TanStack Query:** Tag mutations, existing tags query for autocomplete

**Validation:**

- Tag text: 1-100 characters, trimmed, lowercased

**Test Cases:**

- Unit: Tag normalization
- Integration: Tag sync, add, remove endpoints

**Dependencies:** F02 (upload), F14 (editing)

---

## F13 — Real-Time Updates (SSE)

**Priority:** 2-MEDIUM (Phase 2)

**Acceptance Criteria:**

- Authenticated users receive live document status updates via SSE
- Status changes appear without page refresh during processing
- Moderators/admins receive broadcast events for all document changes
- 30-second heartbeat keeps connection alive
- Graceful reconnection on disconnect
- PostgreSQL LISTEN/NOTIFY for cross-process communication

**API Endpoints:**

- `GET /api/sse/documents` — SSE stream (auth required)
- `GET /api/sse/health` — SSE service health check

**Frontend Components:**

- `useDocumentSSE` composable — Connects to SSE, invalidates TanStack Query caches on events

**State Management:**

- **TanStack Query:** SSE events trigger query invalidation (document detail, my uploads, moderation queue)
- **Pinia:** None

**Test Cases:**

- Unit: SSE message parsing, event routing logic
- Integration: SSE connection, PostgreSQL NOTIFY propagation

**Dependencies:** F01 (auth), PostgreSQL LISTEN/NOTIFY

---

## F07 — AI Metadata Review

**Priority:** 2-MEDIUM (Phase 3)

**Acceptance Criteria:**

- After processing completes (USER_REVIEW state), user sees AI-extracted metadata
- Simple review form shows AI suggestions alongside editable fields
- User can accept, modify, or discard each AI suggestion
- Catalog matches (vendors, technologies, people, organizations) shown for confirmation
- User submits for moderation after review
- Users can retry AI extraction if results are unsatisfactory
- Admins can force re-run extraction on any document

**API Endpoints:**

- `GET /api/documents/:id/ai-metadata` — Get extraction results
- `POST /api/documents/:id/submit-for-moderation` — Submit reviewed document
- `POST /api/documents/:id/retry-extraction` — Retry AI extraction (owner)
- `POST /api/documents/:id/admin-rerun-extraction` — Force re-run (admin)

**Frontend Components:**

- `AiReviewView` — AI metadata review page (route: `/documents/:id/ai-review`)
- `AiSuggestionField` — Shows AI value with accept/edit/discard actions
- `AiCatalogMatchesPanel` — Shows matched catalog entries for confirmation
- `AiExtractionStatus` — Shows extraction pipeline status

**State Management:**

- **TanStack Query:** AI metadata query, submit/retry mutations

**Validation:**

- Document must be in USER_REVIEW state for review
- Document must be owned by current user (or admin for re-run)

**Test Cases:**

- Unit: AI metadata response parsing
- Integration: AI metadata endpoint, submit-for-moderation flow, retry flow
- E2E: Full review → submit flow

**Dependencies:** F06 (processing pipeline), F08 (catalog for entity matching)

---

## F09 — Document Moderation

**Priority:** 2-MEDIUM (Phase 3)

**Acceptance Criteria:**

- Moderators see a queue of documents in `moderator_review` state
- Documents can be approved (→ APPROVED, becomes public) or rejected (→ REJECTED with reason)
- Rejected documents return to owner's uploads with rejection reason
- Moderation queue shows document count badge

**API Endpoints:**

- `GET /api/moderation/queue` — List documents pending moderation (moderator+)
- `POST /api/documents/:id/approve` — Approve document (moderator+)
- `POST /api/documents/:id/reject` — Reject document with reason (moderator+)

**Frontend Components:**

- `ModerationView` — Moderation queue page
- `ModerationDocumentCard` — Document card with approve/reject actions
- `RejectReasonDialog` — Modal for entering rejection reason

**State Management:**

- **TanStack Query:** Moderation queue query, approve/reject mutations

**Validation:**

- Document must be in MODERATOR_REVIEW state
- Rejection reason: 1-1000 characters

**Test Cases:**

- Unit: State transition validation
- Integration: Approve/reject endpoints, state transitions, queue filtering
- E2E: Moderator approve/reject flow

**Dependencies:** F01 (moderator role), F06 (processing completes first)

---

## F14 — Document Editing

**Priority:** 2-MEDIUM (Phase 3)

**Acceptance Criteria:**

- Document owners can edit documents in editable states (DRAFT, PROCESSING_FAILED, REJECTED)
- Editable fields: title, description, document date, location, category, tags, catalog associations, dynamic metadata
- Category change refreshes dynamic metadata form
- Association validation rules enforced per category

**API Endpoints:**

- `PUT /api/documents/:id` — Update document metadata
- `PUT /api/documents/:id/location` — Update document location
- `PUT /api/documents/:id/metadata` — Set/update dynamic metadata values
- `DELETE /api/documents/:id/metadata/:fieldKey` — Delete metadata value
- `POST /api/documents/:id/associations` — Sync catalog associations

**Frontend Components:**

- `DocumentEditView` — Document edit page (route: `/documents/:id/edit`)
- `DocumentEditForm` — Core metadata edit form
- `DynamicMetadataForm` — Category-specific field editor
- `DocumentAssociationsEditor` — Catalog association editor

**State Management:**

- **TanStack Query:** Document detail query, update mutations

**Validation:**

- Title: 1-500 characters
- Description: max 5000 characters
- Location: validated per government level rules
- Dynamic metadata: validated per field definition (type, required, min/max, pattern)
- Associations: validated per category rules (min/max)

**Test Cases:**

- Unit: Dynamic metadata validation, association rule validation
- Integration: Update endpoints, metadata CRUD, association sync
- E2E: Edit document → save flow

**Dependencies:** F01 (auth, ownership), F08 (catalog), F03 (location), F15 (categories)

---

## F16 — Admin Dashboard

**Priority:** 2-MEDIUM (Phase 4)

**Acceptance Criteria:**

- Dashboard shows: user count, document counts by state
- User management: list, view details, change roles, change tiers, anonymize users
- Failed processing: list failed documents with error details, retry processing, delete
- Stuck processing: detect documents in PROCESSING state with no active jobs
- Job overview: list Graphile Worker jobs (active + completed), filter by status
- Job detail: execution logs, LLM call logs (token counts, costs)
- Job operations: retry, cancel, bulk retry, clear completed logs

**API Endpoints:**

- `GET /api/admin/stats` — Platform statistics
- `GET /api/admin/users` — List users (pagination, search)
- `GET /api/admin/users/:id` — User detail
- `PUT /api/admin/users/:id/role` — Change user role
- `PUT /api/admin/users/:id/tier` — Change user tier
- `DELETE /api/admin/users/:id` — Anonymize user (preserves documents)
- `GET /api/admin/failed-processing` — List failed documents
- `POST /api/admin/failed-processing/:id/retry` — Retry failed processing
- `DELETE /api/admin/failed-processing/:id` — Delete failed document
- `GET /api/admin/stuck-processing` — Detect stuck documents
- `GET /api/admin/jobs` — List jobs (pagination, status filter)
- `GET /api/admin/jobs/:id` — Job detail with logs
- `POST /api/admin/jobs/:id/retry` — Retry job
- `POST /api/admin/jobs/:id/cancel` — Cancel job
- `POST /api/admin/jobs/bulk-retry` — Bulk retry failed jobs
- `DELETE /api/admin/jobs/completed` — Clear completed job logs

**Frontend Components:**

- `AdminView` — Dashboard with stats
- `AdminUsersView` — User management
- `AdminUserDetailView` — Single user detail
- `FailedProcessingView` — Failed document list
- `JobsOverviewView` — Job list and management
- `JobDetailView` — Single job detail with logs

**State Management:**

- **TanStack Query:** All admin queries and mutations

**Validation:**

- Role update: valid role (admin, moderator, user), cannot demote last admin
- Tier update: valid tier ID

**Test Cases:**

- Integration: Stats endpoint, user CRUD, job operations, failed processing management
- Component: Stats display, user list, job list

**Dependencies:** F01 (admin role), F06 (processing pipeline for job data)

---

## F11 — User API Keys (OpenRouter)

**Priority:** 2-MEDIUM (Phase 4)

**Acceptance Criteria:**

- Users can add an OpenRouter API key (must start with `sk-or-`)
- Key is encrypted with AES-256-GCM before storage
- Users can set a daily limit (1-100) for their own key usage
- Having a key exempts user from platform LLM extraction limits
- Profile shows key status (masked), daily limit, and today's usage
- Users can delete their key

**Encryption Storage Format:**

The `encrypted_key` column stores a single base64-encoded string containing all three AES-256-GCM components in a fixed format:

```
base64(iv || authTag || ciphertext)
```

- **IV (Initialization Vector):** 12 bytes, cryptographically random, unique per encryption
- **Auth Tag:** 16 bytes, produced by GCM mode
- **Ciphertext:** variable length

On read: decode base64, split at known offsets (0-12 = IV, 12-28 = auth tag, 28+ = ciphertext), decrypt.

The encryption key is derived from `API_KEY_ENCRYPTION_SECRET` env var using HKDF-SHA256 with a fixed salt. Do not use the env var directly as the AES key.

The `key_hash` column stores `SHA-256(plaintext_key)` for existence checks without decryption.

**API Endpoints:**

- `GET /api/profile/api-keys` — Get key status (has key, masked preview, daily limit, usage)
- `PUT /api/profile/api-keys/openrouter` — Set OpenRouter key
- `DELETE /api/profile/api-keys/openrouter` — Delete key
- `PUT /api/profile/api-keys/openrouter/settings` — Update daily limit

**Frontend Components:**

- API key section in `ProfileView`
- `ApiKeyForm` — Set/update API key form
- `ApiKeyStatus` — Shows key status, limit, usage

**State Management:**

- **TanStack Query:** API key status query, mutations

**Validation:**

- API key: must start with `sk-or-`, min 20 characters
- Daily limit: integer 1-100

**Test Cases:**

- Unit: API key format validation, encryption round-trip (encrypt then decrypt yields original), IV uniqueness, HKDF key derivation
- Integration: Key CRUD, limit enforcement, verify stored format is valid base64 with correct length

**Dependencies:** F01 (auth), F10 (tier system integration)

---

## F17 — State Agencies & Metadata

**Priority:** 2-MEDIUM (Phase 4)

**Acceptance Criteria:**

- Moderators manage state agencies (name, abbreviation, category, website URL)
- 9 agency categories: law_enforcement, corrections, health, transportation, education, environment, social_services, regulatory, other
- State metadata: arbitrary key-value pairs per state (e.g., transparency score, FOIA portal URL)
- Agencies and metadata displayed on state overview pages
- Documents can be linked to agencies

**API Endpoints:**

- `GET /api/agencies` — List agencies (query: `stateUsps`, pagination)
- `GET /api/agencies/:id` — Get agency detail
- `POST /api/agencies` — Create agency (moderator+)
- `PUT /api/agencies/:id` — Update agency (moderator+)
- `DELETE /api/agencies/:id` — Delete agency (moderator+)
- `GET /api/state-metadata` — List metadata (query: `stateUsps`)
- `POST /api/state-metadata` — Create metadata entry (moderator+)
- `PUT /api/state-metadata/:id` — Update metadata entry (moderator+)
- `DELETE /api/state-metadata/:id` — Delete metadata entry (moderator+)

**Frontend Components:**

- `AdminAgenciesView` — Agency management page
- `AgencyForm` — Create/edit agency form
- `StateAgencyCard` — Agency display card
- `AdminStateMetadataView` — State metadata management
- `StateMetadataForm` — Create/edit metadata form

**State Management:**

- **TanStack Query:** Agency queries, metadata queries

**Validation:**

- Agency name: 1-200 characters
- Abbreviation: max 20 characters
- Category: valid agency category enum
- Website URL: valid URL, max 500 characters
- State USPS: exactly 2 characters
- Metadata key: 1-100 characters
- Metadata value: 1-2000 characters

**Test Cases:**

- Integration: Agency CRUD, metadata CRUD, agency-document linking

**Dependencies:** F03 (location system)

---

## F18 — User Profile & Location Preference

**Priority:** 2-MEDIUM (Phase 4)

**Acceptance Criteria:**

- Users set a "home" location (state + optional place)
- Location persisted in `user_profiles` table
- Profile page shows: user info, location preference, tier/usage info, API key management, security settings
- Recent location tracked in localStorage for quick selection

**API Endpoints:**

- `GET /api/profile/location` — Get user location preference
- `PUT /api/profile/location` — Update location preference
- `GET /api/profile/usage` — Get user tier and usage info

**Frontend Components:**

- `ProfileView` — Profile page (combines location, usage, API keys)
- `LocationPreferenceForm` — Location selector for profile
- `useRecentLocation` composable — localStorage-based recent location

**State Management:**

- **TanStack Query:** Location preference query, usage query
- **Pinia:** `useAuthStore` (user location cached after fetch)

**Validation:**

- State USPS: 2 characters (optional)
- Place GEOID: valid string (optional, requires state)

**Test Cases:**

- Integration: Location CRUD, usage info endpoint
- Component: LocationPreferenceForm

**Dependencies:** F01 (auth), F03 (location data)

---

## F21 — ALTCHA Spam Protection

**Priority:** 2-MEDIUM (Phase 4)

**Acceptance Criteria:**

- Registration form includes ALTCHA challenge widget
- Challenge must be solved before form submission
- No visual CAPTCHA — computation happens in background
- HMAC key auto-generated during init
- **Solved challenges cannot be replayed** — each challenge salt is single-use

**Replay Prevention:**

When a challenge is generated, the server creates a unique salt. When a solved challenge is verified:

1. Check Redis for the salt key `altcha:spent:{salt}`
2. If found → reject (replay attack)
3. If not found → verify the solution, then store `altcha:spent:{salt}` in Redis with a TTL equal to the challenge expiry (default: 5 minutes)

This ensures each challenge can only be used once. Redis TTL automatically cleans up expired entries.

If Redis is unavailable, challenge verification fails closed (rejects all attempts) rather than silently allowing replays.

**API Endpoints:**

- `GET /api/altcha/challenge` — Generate ALTCHA challenge

**Frontend Components:**

- ALTCHA widget integrated into `RegisterView`

**State Management:**

- None

**Validation:**

- Challenge verification via altcha-lib (server-side)
- Replay check via Redis before verification

**Test Cases:**

- Integration: Challenge generation, verification flow, replay rejection (same salt used twice), Redis unavailability behavior

**Dependencies:** Redis

---

## F12 — DocumentCloud Integration

**Priority:** 3-LOW (Phase 5)

**Acceptance Criteria:**

- Authenticated users can search DocumentCloud
- Search results show title, description, page count, organization, canonical URL
- Already-imported documents flagged in search results
- Moderators can import individual documents or batch import (up to 100)
- Import options: add tags, set government location
- Import jobs tracked with progress (queued → running → completed)

**API Endpoints:**

- `GET /api/documentcloud/status` — DocumentCloud availability check
- `GET /api/documentcloud/search` — Search DocumentCloud
- `POST /api/documentcloud/import` — Import single document
- `POST /api/documentcloud/import/batch` — Batch import (max 100)
- `GET /api/documentcloud/import/:jobId` — Get import job status
- `GET /api/documentcloud/jobs` — List user's import jobs

**Frontend Components:**

- `DocumentCloudSearchView` — Search and import page
- `DocumentCloudResultCard` — Search result with import action
- `ImportJobStatus` — Progress display for import jobs

**State Management:**

- **TanStack Query:** Search query, import mutations, job status queries

**Validation:**

- DocumentCloud ID: positive integer
- Batch size: 1-100
- Import options: valid location and tag data

**Test Cases:**

- Integration: Search endpoint (mocked DC API), import flow, job tracking

**Dependencies:** F01 (auth), F06 (processing for imported documents), DocumentCloud API

---

## F22 — Policy Status Cards

**Priority:** 3-LOW (Phase 5)

**Acceptance Criteria:**

- Place-level location overviews show policy status cards
- Three default policy types: purchasing, ALPR, surveillance (configurable)
- Each card shows: exists (yes/no), link to the policy document if found
- Policy types are database-managed, admin-editable

**Frontend Components:**

- `PolicyStatusCard` — Policy existence indicator with document link

**State Management:**

- **TanStack Query:** Included in location overview query response

**Test Cases:**

- Component: PolicyStatusCard rendering for found/not-found states

**Dependencies:** F03 (location), F15 (categories), F04 (document viewing)

---

## F23 — Cleanup of Expired Drafts

**Priority:** 3-LOW (Phase 5)

**Acceptance Criteria:**

- Draft documents older than 14 days are automatically deleted
- Cleanup runs every hour via Graphile Worker scheduled task
- Deletion removes database record and S3 files
- Cleanup logged for audit purposes

**API Endpoints:**

- None (server-side scheduled task)

**Test Cases:**

- Integration: Cleanup task identifies and deletes expired drafts, S3 files removed

**Dependencies:** F19 (draft workflow)

---

## F24 — Home Page

**Priority:** 3-LOW (Phase 5)

**Acceptance Criteria:**

- Anonymous users: see platform description, sign-in/sign-up CTAs
- Authenticated users: see upload CTA, search CTA, recent activity summary
- Minimal design

**Frontend Components:**

- `HomeView` — Landing page

**State Management:**

- **TanStack Query:** Optional recent documents query for authenticated users

**Test Cases:**

- Component: Renders correct CTA based on auth state

**Dependencies:** F01 (auth state)

---

## F25 — Document-to-Document Associations

**Priority:** 3-LOW (Phase 5)

**Acceptance Criteria:**

- Documents can be linked to other documents with typed relationships
- Association types: supersedes, amends, references, attachment_of
- Associations are directional (with inverses)
- UI for managing associations on document edit and detail pages
- Search for target documents when creating associations

**API Endpoints:**

- `GET /api/documents/:id/related` — List related documents
- `POST /api/documents/:id/related` — Add document association
- `DELETE /api/document-associations/:id` — Remove association

**Frontend Components:**

- `DocumentRelatedPanel` — Display related documents on detail page
- `DocumentAssociationEditor` — Add/remove associations on edit page
- `DocumentSearchDialog` — Search for documents to link

**State Management:**

- **TanStack Query:** Related documents query, association mutations

**Validation:**

- Source and target document must both exist
- Association type must be a valid document-document type
- Cannot associate a document with itself

**Test Cases:**

- Integration: Association CRUD, inverse relationship creation
- Component: Association editor, document search dialog

**Dependencies:** F04 (document viewing), F14 (document editing)

---

## Summary

| Phase | Feature Count | Priority |
|-------|---------------|----------|
| Phase 1 — Foundation | 5 | 1-HIGH |
| Phase 2 — Core Document Flow | 6 | 1-HIGH / 2-MEDIUM |
| Phase 3 — Review & Moderation | 3 | 2-MEDIUM |
| Phase 4 — Administration | 5 | 2-MEDIUM |
| Phase 5 — Integration & Polish | 5 | 3-LOW |
| **Total** | **24** | |
