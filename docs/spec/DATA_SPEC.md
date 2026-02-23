# Data Model Specification — Open Panopticon Rebuild

> Canonical data model. Zod schemas are the source of truth. Database schema and API types derive from them.

---

## 1. ID Convention

All application tables use `nanoid` string primary keys. Better Auth tables use their own ID format (string). All application columns use `snake_case`. Better Auth columns use `camelCase` (framework convention — do not change).

---

## 2. Entity Definitions

### 2.1 User (Better Auth managed)

Better Auth owns the `user`, `session`, `account`, `verification`, `two_factor`, `passkey`, and `jwks` tables. The application adds:

- A `role` column (default: `"user"`)
- A `tier` column (default: `1`, FK → `user_tiers.id`)

```typescript
// constants/roles.ts
export const ROLES = {
  ADMIN: "admin",
  MODERATOR: "moderator",
  USER: "user",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_HIERARCHY: Record<Role, number> = {
  [ROLES.ADMIN]: 3,
  [ROLES.MODERATOR]: 2,
  [ROLES.USER]: 1,
};

export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0);
}
```

```typescript
// types/user.ts
import { z } from "zod";

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: z.enum(["admin", "moderator", "user"]),
  tier: z.number().int().positive(),
  emailVerified: z.boolean(),
  image: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type AppUser = z.infer<typeof userSchema>;

export interface PublicUser {
  id: string;
  name: string | null;
  role: Role;
}

export interface UserUsage {
  limitType: string;
  used: number;
  limit: number;
  remaining: number;
  resetAt: string; // ISO timestamp (midnight Central Time)
}

export interface UserTierInfo {
  tier: number;
  tierLabel: string;
  usage: UserUsage[];
  isExempt: boolean;
  hasCustomOpenRouterKey?: boolean;
  hasSystemOpenRouterKey?: boolean;
}
```

**Database columns (application-added on `user` table):**

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `role` | `varchar(20)` | `'user'` | admin, moderator, user |
| `tier` | `integer` | `1` | FK → `user_tiers.id` |

---

### 2.2 User Profile

```typescript
// types/user.ts (continued)
export const userProfileSchema = z.object({
  userId: z.string(),
  placeGeoid: z.string().nullable(),
  stateUsps: z.string().length(2).nullable(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;

export const updateLocationSchema = z.object({
  stateUsps: z.string().length(2).nullable(),
  placeGeoid: z.string().nullable(),
});

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
```

**Table: `user_profiles`**

| Column | Type | Constraints |
|--------|------|-------------|
| `user_id` | `varchar` | PK, FK → `user.id` ON DELETE CASCADE |
| `place_geoid` | `varchar` | FK → `places.geoid`, nullable |
| `state_usps` | `varchar(2)` | FK → `states.usps`, nullable |

---

### 2.3 User API Keys

```typescript
// types/user.ts (continued)
export const setApiKeySchema = z.object({
  key: z.string().min(20).startsWith("sk-or-"),
});

export const updateApiKeySettingsSchema = z.object({
  dailyLimit: z.number().int().min(1).max(100),
});
```

**Table: `user_api_keys`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar` | PK (nanoid) |
| `user_id` | `varchar` | FK → `user.id` ON DELETE CASCADE, UNIQUE |
| `encrypted_key` | `text` | NOT NULL (see format below) |
| `key_hash` | `varchar` | NOT NULL (SHA-256 of plaintext key) |
| `daily_limit` | `integer` | NOT NULL, DEFAULT 10 |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() |

**Encryption storage format for `encrypted_key`:**

The column stores a single base64-encoded string: `base64(iv || authTag || ciphertext)`

- IV: 12 bytes, cryptographically random, unique per encryption
- Auth Tag: 16 bytes, from AES-256-GCM
- Ciphertext: variable length

On read: decode base64, split at fixed offsets (bytes 0-11 = IV, bytes 12-27 = auth tag, bytes 28+ = ciphertext), decrypt with AES-256-GCM.

The AES key is derived from `API_KEY_ENCRYPTION_SECRET` using HKDF-SHA256 with a fixed application-specific salt (e.g., `"opo-api-key-encryption"`). Never use the raw env var as the key.

---

### 2.4 User Tiers

```typescript
// types/tier.ts
import { z } from "zod";

export interface TierLimit {
  limitType: string;
  limitValue: number;
}

export interface Tier {
  id: number;
  name: string;
  description: string | null;
  isDefault: boolean;
  sortOrder: number;
  limits: TierLimit[];
  userCount?: number;
}

export const createTierSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(50),
  description: z.string().max(255).optional(),
  isDefault: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional(),
  limits: z.array(z.object({
    limitType: z.string().min(1),
    limitValue: z.number().int().nonnegative(),
  })).optional().default([]),
});

export const updateTierSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(255).nullable().optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const updateTierLimitsSchema = z.object({
  limits: z.array(z.object({
    limitType: z.string().min(1),
    limitValue: z.number().int().nonnegative(),
  })),
});
```

**Table: `user_tiers`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `integer` | PK |
| `name` | `varchar(50)` | NOT NULL |
| `description` | `varchar(255)` | nullable |
| `is_default` | `boolean` | NOT NULL, DEFAULT false |
| `sort_order` | `integer` | NOT NULL, DEFAULT 0 |

**Table: `tier_limits`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar` | PK (nanoid) |
| `tier_id` | `integer` | FK → `user_tiers.id` ON DELETE CASCADE |
| `limit_type` | `varchar` | NOT NULL |
| `limit_value` | `integer` | NOT NULL |
| UNIQUE | | (`tier_id`, `limit_type`) |

**Table: `user_api_call_log`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar` | PK (nanoid) |
| `user_id` | `varchar` | FK → `user.id` ON DELETE CASCADE |
| `limit_type` | `varchar` | NOT NULL |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() |

**Seed data:**

| ID | Name | Uploads | LLM Metadata |
|----|------|---------|-------------|
| 1 | Basic | 10 | 10 |
| 2 | Standard | 50 | 50 |
| 3 | Premium | 500 | 500 |

---

### 2.5 Documents

```typescript
// constants/status.ts
export const DOCUMENT_STATE = {
  PENDING_UPLOAD: "pending_upload",
  DRAFT: "draft",
  SUBMITTED: "submitted",
  PROCESSING: "processing",
  PROCESSING_FAILED: "processing_failed",
  USER_REVIEW: "user_review",
  MODERATOR_REVIEW: "moderator_review",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type DocumentState = (typeof DOCUMENT_STATE)[keyof typeof DOCUMENT_STATE];

export const VALID_STATE_TRANSITIONS: Record<DocumentState, DocumentState[]> = {
  pending_upload: ["draft", "submitted"],  // confirm-upload decides based on saveAsDraft
  draft: ["submitted"],
  submitted: ["processing"],
  processing: ["user_review", "moderator_review", "processing_failed"],
  processing_failed: ["submitted"],
  user_review: ["moderator_review"],
  moderator_review: ["approved", "rejected"],
  approved: [],
  rejected: ["submitted"],
};

export function isValidStateTransition(from: DocumentState, to: DocumentState): boolean {
  return VALID_STATE_TRANSITIONS[from]?.includes(to) ?? false;
}

// State groups
export const PROCESSING_STATES: DocumentState[] = ["submitted", "processing"];
export const EDITABLE_STATES: DocumentState[] = ["draft", "processing_failed", "rejected"];
export const DELETABLE_STATES: DocumentState[] = ["draft", "processing_failed", "rejected", "pending_upload"];
export const TERMINAL_STATES: DocumentState[] = ["approved", "rejected"];

// pending_upload documents are transient — cleaned up after 1 hour by the
// cleanup task. They are never shown in user-facing lists.
```

```typescript
// types/document.ts
import { z } from "zod";

export const createDocumentSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  documentDate: z.string().optional(), // ISO date
  governmentLevel: z.enum(["federal", "state", "place", "tribal"]).optional(),
  stateUsps: z.string().length(2).optional(),
  placeGeoid: z.string().optional(),
  tribeId: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  governmentEntityId: z.string().optional(),
  saveAsDraft: z.boolean().optional().default(false),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  documentDate: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
});

export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

export const updateDocumentLocationSchema = z.object({
  governmentLevel: z.enum(["federal", "state", "place", "tribal"]).nullable(),
  stateUsps: z.string().length(2).nullable(),
  placeGeoid: z.string().nullable(),
  tribeId: z.string().nullable(),
});

export type UpdateDocumentLocationInput = z.infer<typeof updateDocumentLocationSchema>;

export interface Document {
  id: string;
  title: string;
  description: string | null;
  filename: string;
  filepath: string;
  mimetype: string;
  size: number;
  uploaderId: string;
  governmentLevel: string | null;
  stateUsps: string | null;
  placeGeoid: string | null;
  tribeId: string | null;
  documentDate: string | null;
  category: string | null;
  state: DocumentState;
  useAiExtraction: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  processingStartedAt: string | null;
  processingCompletedAt: string | null;
  sourceId: string | null;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentListItem {
  id: string;
  title: string;
  description: string | null;
  filename: string;
  mimetype: string;
  size: number;
  state: DocumentState;
  category: string | null;
  categoryName: string | null;
  governmentLevel: string | null;
  stateUsps: string | null;
  stateName: string | null;
  placeGeoid: string | null;
  placeName: string | null;
  uploaderId: string;
  uploaderName: string | null;
  documentDate: string | null;
  sourceId: string | null;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  vendors: { id: string; name: string }[];
  technologies: { id: string; name: string }[];
}
```

**Table: `documents`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar` | PK (nanoid) |
| `title` | `varchar(500)` | NOT NULL |
| `description` | `text` | nullable |
| `filename` | `varchar(500)` | NOT NULL |
| `filepath` | `varchar(1000)` | NOT NULL |
| `mimetype` | `varchar(255)` | NOT NULL |
| `size` | `bigint` | NOT NULL |
| `uploader_id` | `varchar` | FK → `user.id` ON DELETE SET NULL, nullable |
| `government_level` | `varchar(20)` | nullable |
| `state_usps` | `varchar(2)` | FK → `states.usps`, nullable |
| `place_geoid` | `varchar` | FK → `places.geoid`, nullable |
| `tribe_id` | `varchar` | FK → `tribes.id`, nullable |
| `document_date` | `date` | nullable |
| `category` | `varchar` | FK → `document_categories.id`, nullable |
| `state` | `varchar(30)` | NOT NULL, DEFAULT 'pending_upload' |
| `use_ai_extraction` | `boolean` | NOT NULL, DEFAULT true |
| `reviewed_by` | `varchar` | FK → `user.id`, nullable |
| `reviewed_at` | `timestamptz` | nullable |
| `rejection_reason` | `text` | nullable |
| `processing_started_at` | `timestamptz` | nullable |
| `processing_completed_at` | `timestamptz` | nullable |
| `source_id` | `varchar` | FK → `document_sources.id`, nullable |
| `external_id` | `varchar` | nullable |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() |

**Indexes:**
- `idx_documents_uploader_id` on `uploader_id`
- `idx_documents_state` on `state`
- `idx_documents_state_usps` on `state_usps`
- `idx_documents_place_geoid` on `place_geoid`
- `idx_documents_category` on `category`
- `idx_documents_created_at` on `created_at DESC`
- Full-text index on `title` and `description` (tsvector)

**Trigger:** `document_state_notify` — sends PostgreSQL NOTIFY on `document_status_changes` channel when `state` column changes.

**Note on user deletion:** The FK uses `ON DELETE SET NULL`. When an admin "deletes" a user, the application deletes the user row, and PostgreSQL automatically NULLs `uploader_id` on all their documents. Documents and S3 files are preserved. The UI displays "Deleted User" when `uploader_id` is NULL.

---

### 2.6 Document Tags

```typescript
// types/document.ts (continued)
export const syncTagsSchema = z.object({
  tags: z.array(z.string().min(1).max(100).transform(s => s.trim().toLowerCase())),
});
```

**Table: `document_tags`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar` | PK (nanoid) |
| `document_id` | `varchar` | FK → `documents.id` ON DELETE CASCADE |
| `tag` | `varchar(100)` | NOT NULL |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() |
| UNIQUE | | (`document_id`, `tag`) |

---

### 2.7 Document Categories

```typescript
// types/category.ts
import { z } from "zod";

export const DOCUMENT_CATEGORIES = {
  CONTRACT: "contract",
  PROPOSAL: "proposal",
  POLICY: "policy",
  MEETING_AGENDA: "meeting_agenda",
  MEETING_MINUTES: "meeting_minutes",
  INVOICE: "invoice",
  CORRESPONDENCE: "correspondence",
  AUDIT_REPORT: "audit_report",
  TRAINING_MATERIAL: "training_material",
  FOIA_REQUEST: "foia_request",
  PROCUREMENT: "procurement",
  COMPLIANCE: "compliance",
  OTHER: "other",
} as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[keyof typeof DOCUMENT_CATEGORIES];

export const createCategorySchema = z.object({
  id: z.string().min(1).max(50).regex(/^[a-z][a-z0-9_]*$/,
    "ID must be lowercase letters, numbers, and underscores, starting with a letter"),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
});
```

**Table: `document_categories`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar(50)` | PK |
| `name` | `varchar(200)` | NOT NULL |
| `description` | `text` | nullable |
| `min_vendors` | `integer` | nullable |
| `max_vendors` | `integer` | nullable |
| `min_products` | `integer` | nullable |
| `max_products` | `integer` | nullable |
| `min_technologies` | `integer` | nullable |
| `max_technologies` | `integer` | nullable |
| `min_government_entities` | `integer` | nullable |
| `max_government_entities` | `integer` | nullable |
| `require_government_location` | `boolean` | nullable |

---

### 2.8 Metadata Field Definitions

```typescript
// types/metadata.ts
import { z } from "zod";

export const FIELD_TYPES = {
  TEXT: "text",
  NUMBER: "number",
  DATE: "date",
  BOOLEAN: "boolean",
  CURRENCY: "currency",
  ENUM: "enum",
} as const;

export type FieldType = (typeof FIELD_TYPES)[keyof typeof FIELD_TYPES];

export const METADATA_SOURCES = {
  USER: "user",
  AI: "ai",
  SYSTEM: "system",
  MIGRATION: "migration",
} as const;

export type MetadataSource = (typeof METADATA_SOURCES)[keyof typeof METADATA_SOURCES];

export const validationRulesSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().positive().optional(),
  pattern: z.string().optional(),
}).optional();

export const createFieldDefinitionSchema = z.object({
  categoryId: z.string(),
  fieldKey: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/),
  displayName: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  valueType: z.enum(["text", "number", "date", "boolean", "currency", "enum"]),
  enumValues: z.array(z.string()).optional(),
  isRequired: z.boolean().optional().default(false),
  isAiExtractable: z.boolean().optional().default(false),
  validationRules: validationRulesSchema,
  displayOrder: z.number().int().optional().default(0),
});

export const updateFieldDefinitionSchema = createFieldDefinitionSchema.partial().omit({ categoryId: true });

export interface MetadataFieldDefinition {
  id: string;
  categoryId: string;
  fieldKey: string;
  displayName: string;
  description: string | null;
  valueType: FieldType;
  enumValues: string[] | null;
  isRequired: boolean;
  isAiExtractable: boolean;
  validationRules: { min?: number; max?: number; minLength?: number; maxLength?: number; pattern?: string } | null;
  displayOrder: number;
}
```

**Table: `metadata_field_definitions`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar` | PK (nanoid) |
| `category_id` | `varchar` | FK → `document_categories.id` ON DELETE CASCADE |
| `field_key` | `varchar(100)` | NOT NULL |
| `display_name` | `varchar(200)` | NOT NULL |
| `description` | `text` | nullable |
| `value_type` | `varchar(20)` | NOT NULL |
| `enum_values` | `jsonb` | nullable |
| `is_required` | `boolean` | NOT NULL, DEFAULT false |
| `is_ai_extractable` | `boolean` | NOT NULL, DEFAULT false |
| `validation_rules` | `jsonb` | nullable |
| `display_order` | `integer` | NOT NULL, DEFAULT 0 |
| UNIQUE | | (`category_id`, `field_key`) |

---

### 2.9 Document Metadata

```typescript
// types/metadata.ts (continued)
export const setMetadataValueSchema = z.object({
  fieldKey: z.string(),
  fieldDefinitionId: z.string().optional(),
  valueText: z.string().nullable().optional(),
  valueNumber: z.number().nullable().optional(),
  valueDate: z.string().nullable().optional(),
  valueBoolean: z.boolean().nullable().optional(),
  valueJson: z.unknown().nullable().optional(),
  source: z.enum(["user", "ai", "system", "migration"]).optional().default("user"),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

export interface DocumentMetadata {
  id: string;
  documentId: string;
  fieldKey: string;
  fieldDefinitionId: string | null;
  valueText: string | null;
  valueNumber: number | null;
  valueDate: string | null;
  valueBoolean: boolean | null;
  valueJson: unknown | null;
  source: MetadataSource;
  confidence: number | null;
}
```

**Table: `document_metadata`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar` | PK (nanoid) |
| `document_id` | `varchar` | FK → `documents.id` ON DELETE CASCADE |
| `field_key` | `varchar(100)` | NOT NULL |
| `field_definition_id` | `varchar` | FK → `metadata_field_definitions.id`, nullable |
| `value_text` | `text` | nullable |
| `value_number` | `numeric` | nullable |
| `value_date` | `date` | nullable |
| `value_boolean` | `boolean` | nullable |
| `value_json` | `jsonb` | nullable |
| `source` | `varchar(20)` | NOT NULL, DEFAULT 'user' |
| `confidence` | `numeric(3,2)` | nullable |
| UNIQUE | | (`document_id`, `field_key`) |

---

### 2.10 Catalog System

```typescript
// types/catalog.ts
import { z } from "zod";

export const CATALOG_TYPES = {
  VENDOR: "vendor",
  PRODUCT: "product",
  TECHNOLOGY: "technology",
  GOVERNMENT_ENTITY: "government_entity",
  PERSON: "person",
  ORGANIZATION: "organization",
} as const;

export type CatalogTypeId = (typeof CATALOG_TYPES)[keyof typeof CATALOG_TYPES];

export interface CatalogType {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  attributeSchema: Record<string, unknown> | null;
  isSystem: boolean;
  sortOrder: number;
}

export const createCatalogEntrySchema = z.object({
  typeId: z.string(),
  name: z.string().min(1).max(500),
  attributes: z.record(z.unknown()).optional(),
  isVerified: z.boolean().optional().default(false),
});

export const updateCatalogEntrySchema = z.object({
  name: z.string().min(1).max(500).optional(),
  attributes: z.record(z.unknown()).optional(),
  isVerified: z.boolean().optional(),
});

export interface CatalogEntry {
  id: string;
  typeId: string;
  name: string;
  attributes: Record<string, unknown> | null;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  aliases?: CatalogAlias[];
  typeName?: string;
}

export const ALIAS_SOURCES = {
  MANUAL: "manual",
  AI_SUGGESTION: "ai_suggestion",
  IMPORT: "import",
} as const;

export const createAliasSchema = z.object({
  alias: z.string().min(1).max(500),
  source: z.enum(["manual", "ai_suggestion", "import"]).optional().default("manual"),
});

export interface CatalogAlias {
  id: string;
  entryId: string;
  alias: string;
  normalizedAlias: string;
  source: string;
  createdAt: string;
}
```

**Table: `catalog_types`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar` | PK |
| `name` | `varchar(100)` | NOT NULL |
| `description` | `text` | nullable |
| `icon` | `varchar(50)` | nullable |
| `color` | `varchar(20)` | nullable |
| `attribute_schema` | `jsonb` | nullable |
| `is_system` | `boolean` | NOT NULL, DEFAULT false |
| `sort_order` | `integer` | NOT NULL, DEFAULT 0 |

**Table: `catalog_entries`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar` | PK (nanoid) |
| `type_id` | `varchar` | FK → `catalog_types.id` |
| `name` | `varchar(500)` | NOT NULL |
| `attributes` | `jsonb` | nullable |
| `is_verified` | `boolean` | NOT NULL, DEFAULT false |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() |
| UNIQUE | | (`type_id`, `name`) |

**Table: `catalog_aliases`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar` | PK (nanoid) |
| `entry_id` | `varchar` | FK → `catalog_entries.id` ON DELETE CASCADE |
| `alias` | `varchar(500)` | NOT NULL |
| `normalized_alias` | `varchar(500)` | NOT NULL |
| `source` | `varchar(20)` | NOT NULL, DEFAULT 'manual' |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() |
| UNIQUE | | (`entry_id`, `normalized_alias`) |

**Index:** GIN trigram index on `catalog_entries.name` and `catalog_aliases.normalized_alias` for fuzzy search.

---

### 2.11 Association Types

```typescript
// types/catalog.ts (continued)
export const ASSOCIATION_SCOPES = {
  DOCUMENT_CATALOG: "document_catalog",
  DOCUMENT_DOCUMENT: "document_document",
  CATALOG_CATALOG: "catalog_catalog",
} as const;

export interface AssociationType {
  id: string;
  name: string;
  description: string | null;
  appliesTo: string; // document_catalog | document_document | catalog_catalog
  isDirectional: boolean;
  inverseId: string | null;
  isSystem: boolean;
  sortOrder: number;
}
```

**Table: `association_types`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar` | PK |
| `name` | `varchar(100)` | NOT NULL |
| `description` | `text` | nullable |
| `applies_to` | `varchar(30)` | NOT NULL |
| `is_directional` | `boolean` | NOT NULL, DEFAULT false |
| `inverse_id` | `varchar` | FK → self, nullable |
| `is_system` | `boolean` | NOT NULL, DEFAULT false |
| `sort_order` | `integer` | NOT NULL, DEFAULT 0 |

**Seed data (document-document types):**

| ID | Name | Directional | Inverse |
|----|------|-------------|---------|
| `supersedes` | Supersedes | Yes | `superseded_by` |
| `superseded_by` | Superseded By | Yes | `supersedes` |
| `amends` | Amends | Yes | `amended_by` |
| `amended_by` | Amended By | Yes | `amends` |
| `references` | References | No | null |
| `attachment_of` | Attachment Of | Yes | `has_attachment` |
| `has_attachment` | Has Attachment | Yes | `attachment_of` |

---

### 2.12 Document-Catalog Associations

```typescript
// types/catalog.ts (continued)
export const PARTY_ROLES = {
  PARTY: "party",
  CONTRACTOR: "contractor",
  SUBCONTRACTOR: "subcontractor",
  JURISDICTION: "jurisdiction",
} as const;

export const syncDocumentAssociationsSchema = z.object({
  associations: z.array(z.object({
    entryId: z.string(),
    associationTypeId: z.string().optional(),
    role: z.enum(["party", "contractor", "subcontractor", "jurisdiction"]).optional(),
    context: z.string().max(1000).optional(),
  })),
});

export interface DocumentCatalogAssociation {
  id: string;
  documentId: string;
  entryId: string;
  associationTypeId: string | null;
  role: string | null;
  context: string | null;
  createdAt: string;
  entryName?: string;
  entryTypeId?: string;
}
```

**Table: `document_catalog_associations`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar` | PK (nanoid) |
| `document_id` | `varchar` | FK → `documents.id` ON DELETE CASCADE |
| `entry_id` | `varchar` | FK → `catalog_entries.id` ON DELETE CASCADE |
| `association_type_id` | `varchar` | FK → `association_types.id`, nullable |
| `role` | `varchar(30)` | nullable |
| `context` | `text` | nullable |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() |
| UNIQUE | | (`document_id`, `entry_id`, `role`) |

---

### 2.13 Document-Document Associations

```typescript
// types/catalog.ts (continued)
export const createDocumentAssociationSchema = z.object({
  targetDocumentId: z.string(),
  associationTypeId: z.string(),
  context: z.string().max(1000).optional(),
});

export interface DocumentDocumentAssociation {
  id: string;
  sourceDocumentId: string;
  targetDocumentId: string;
  associationTypeId: string;
  context: string | null;
  createdAt: string;
  targetDocumentTitle?: string;
}
```

**Table: `document_document_associations`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar` | PK (nanoid) |
| `source_document_id` | `varchar` | FK → `documents.id` ON DELETE CASCADE |
| `target_document_id` | `varchar` | FK → `documents.id` ON DELETE CASCADE |
| `association_type_id` | `varchar` | FK → `association_types.id` |
| `context` | `text` | nullable |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() |
| UNIQUE | | (`source_document_id`, `target_document_id`, `association_type_id`) |

---

### 2.14 Catalog Entry Associations

**Table: `catalog_entry_associations`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar` | PK (nanoid) |
| `source_entry_id` | `varchar` | FK → `catalog_entries.id` ON DELETE CASCADE |
| `target_entry_id` | `varchar` | FK → `catalog_entries.id` ON DELETE CASCADE |
| `association_type_id` | `varchar` | FK → `association_types.id` |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() |
| UNIQUE | | (`source_entry_id`, `target_entry_id`, `association_type_id`) |

---

### 2.15 Location Tables

```typescript
// types/location.ts
import { z } from "zod";

export const GOVERNMENT_LEVELS = {
  FEDERAL: "federal",
  STATE: "state",
  PLACE: "place",
  TRIBAL: "tribal",
} as const;

export type GovernmentLevel = (typeof GOVERNMENT_LEVELS)[keyof typeof GOVERNMENT_LEVELS];

export const locationInputSchema = z.object({
  governmentLevel: z.enum(["federal", "state", "place", "tribal"]).nullable(),
  stateUsps: z.string().length(2).nullable(),
  placeGeoid: z.string().nullable(),
  tribeId: z.string().nullable(),
}).refine(data => {
  if (data.governmentLevel === "federal") return !data.stateUsps && !data.placeGeoid && !data.tribeId;
  if (data.governmentLevel === "state") return !!data.stateUsps && !data.placeGeoid && !data.tribeId;
  if (data.governmentLevel === "place") return !!data.stateUsps && !!data.placeGeoid && !data.tribeId;
  if (data.governmentLevel === "tribal") return !data.stateUsps && !data.placeGeoid && !!data.tribeId;
  return true;
});

export interface State {
  usps: string;
  name: string;
  isTerritory: boolean;
}

export interface Place {
  geoid: string;
  usps: string;
  name: string;
  lsad: string | null;
  lat: number;
  lon: number;
}

export interface Tribe {
  id: string;
  name: string;
  isAlaskaNative: boolean;
}

export const nearestPlacesRequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  limit: z.number().int().min(1).max(50).optional().default(10),
});
```

**Table: `states`** (seeded from Census data)

| Column | Type | Constraints |
|--------|------|-------------|
| `usps` | `varchar(2)` | PK |
| `name` | `varchar(100)` | NOT NULL |
| `is_territory` | `boolean` | NOT NULL, DEFAULT false |

**Table: `places`** (seeded from Census gazetteer, ~30,000 rows)

| Column | Type | Constraints |
|--------|------|-------------|
| `geoid` | `varchar` | PK |
| `usps` | `varchar(2)` | FK → `states.usps` |
| `name` | `varchar(200)` | NOT NULL |
| `lsad` | `varchar(10)` | nullable |
| `funcstat` | `varchar(5)` | nullable |
| `lat` | `numeric(10,7)` | NOT NULL |
| `lon` | `numeric(11,7)` | NOT NULL |
| `aland_sqmi` | `numeric` | nullable |

**Table: `tribes`** (seeded)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar` | PK |
| `name` | `varchar(500)` | NOT NULL |
| `is_alaska_native` | `boolean` | NOT NULL, DEFAULT false |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() |

---

### 2.16 State Agencies & Metadata

```typescript
// types/agency.ts
import { z } from "zod";

export const AGENCY_CATEGORIES = {
  LAW_ENFORCEMENT: "law_enforcement",
  CORRECTIONS: "corrections",
  HEALTH: "health",
  TRANSPORTATION: "transportation",
  EDUCATION: "education",
  ENVIRONMENT: "environment",
  SOCIAL_SERVICES: "social_services",
  REGULATORY: "regulatory",
  OTHER: "other",
} as const;

export type AgencyCategory = (typeof AGENCY_CATEGORIES)[keyof typeof AGENCY_CATEGORIES];

export const createAgencySchema = z.object({
  stateUsps: z.string().length(2).toUpperCase(),
  name: z.string().min(1).max(200),
  abbreviation: z.string().max(20).optional().nullable(),
  category: z.enum(["law_enforcement", "corrections", "health", "transportation",
    "education", "environment", "social_services", "regulatory", "other"]).optional().nullable(),
  websiteUrl: z.string().url().max(500).optional().nullable(),
});

export const updateAgencySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  abbreviation: z.string().max(20).optional().nullable(),
  category: z.enum(["law_enforcement", "corrections", "health", "transportation",
    "education", "environment", "social_services", "regulatory", "other"]).optional().nullable(),
  websiteUrl: z.string().url().max(500).optional().nullable(),
});

export interface StateAgency {
  id: string;
  stateUsps: string;
  name: string;
  abbreviation: string | null;
  category: string | null;
  websiteUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export const createStateMetadataSchema = z.object({
  stateUsps: z.string().length(2).toUpperCase(),
  key: z.string().min(1).max(100),
  value: z.string().min(1).max(2000),
  url: z.string().url().max(500).optional().nullable(),
});

export const updateStateMetadataSchema = z.object({
  value: z.string().min(1).max(2000),
  url: z.string().url().max(500).optional().nullable(),
});
```

**Table: `state_agencies`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar` | PK (nanoid) |
| `state_usps` | `varchar(2)` | FK → `states.usps` |
| `name` | `varchar(200)` | NOT NULL |
| `abbreviation` | `varchar(20)` | nullable |
| `category` | `varchar(30)` | nullable |
| `website_url` | `varchar(500)` | nullable |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() |

**Table: `document_agencies`**

| Column | Type | Constraints |
|--------|------|-------------|
| `document_id` | `varchar` | FK → `documents.id` ON DELETE CASCADE |
| `agency_id` | `varchar` | FK → `state_agencies.id` ON DELETE CASCADE |
| PK | | (`document_id`, `agency_id`) |

**Table: `state_metadata`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar` | PK (nanoid) |
| `state_usps` | `varchar(2)` | FK → `states.usps` |
| `key` | `varchar(100)` | NOT NULL |
| `value` | `varchar(2000)` | NOT NULL |
| `url` | `varchar(500)` | nullable |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() |
| UNIQUE | | (`state_usps`, `key`) |

---

### 2.17 Document Mentions

```typescript
// types/mentions.ts
import { z } from "zod";

export interface DocumentMention {
  id: string;
  documentId: string;
  typeId: string;
  mentionedName: string;
  normalizedName: string;
  contextAttributes: Record<string, unknown> | null;
  confidence: number | null;
  resolvedEntryId: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export const createMentionSchema = z.object({
  documentId: z.string(),
  typeId: z.string(),
  mentionedName: z.string().min(1),
  normalizedName: z.string().min(1),
  contextAttributes: z.record(z.unknown()).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/[.,;:'"!?()[\]{}]/g, "").replace(/\s+/g, " ");
}
```

**Table: `document_mentions`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar` | PK (nanoid) |
| `document_id` | `varchar` | FK → `documents.id` ON DELETE CASCADE |
| `type_id` | `varchar` | FK → `catalog_types.id` |
| `mentioned_name` | `varchar(500)` | NOT NULL |
| `normalized_name` | `varchar(500)` | NOT NULL |
| `context_attributes` | `jsonb` | nullable |
| `confidence` | `numeric(3,2)` | nullable |
| `resolved_entry_id` | `varchar` | FK → `catalog_entries.id`, nullable |
| `resolved_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() |

---

### 2.18 Processing Tables

**Table: `document_processing_results`**

| Column | Type | Constraints |
|--------|------|-------------|
| `document_id` | `varchar` | PK, FK → `documents.id` ON DELETE CASCADE |
| `virus_scan_passed` | `boolean` | nullable |
| `virus_scan_details` | `text` | nullable |
| `virus_scan_completed_at` | `timestamptz` | nullable |
| `conversion_performed` | `boolean` | nullable |
| `original_mimetype` | `varchar(255)` | nullable |
| `converted_filepath` | `varchar(1000)` | nullable |
| `conversion_completed_at` | `timestamptz` | nullable |
| `sieve_performed` | `boolean` | nullable |
| `sieve_category` | `varchar(30)` | nullable |
| `sieve_nexus_score` | `numeric` | nullable |
| `sieve_junk_score` | `numeric` | nullable |
| `sieve_confidence` | `numeric` | nullable |
| `sieve_reasoning` | `text` | nullable |
| `sieve_model` | `varchar(100)` | nullable |
| `sieve_processing_time_ms` | `integer` | nullable |
| `sieve_completed_at` | `timestamptz` | nullable |
| `ai_extraction_performed` | `boolean` | nullable |
| `ai_extraction_model` | `varchar(100)` | nullable |
| `ai_extracted_metadata` | `text` | nullable (JSON) |
| `ai_extraction_error` | `text` | nullable |
| `ai_extraction_completed_at` | `timestamptz` | nullable |

**Table: `job_execution_logs`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar` | PK (nanoid) |
| `document_id` | `varchar` | FK → `documents.id`, nullable |
| `graphile_job_id` | `varchar` | NOT NULL |
| `task_identifier` | `varchar(100)` | NOT NULL |
| `log_entries` | `jsonb` | nullable |
| `started_at` | `timestamptz` | NOT NULL |
| `completed_at` | `timestamptz` | nullable |
| `duration_ms` | `integer` | nullable |
| `status` | `varchar(20)` | NOT NULL |
| `final_error` | `text` | nullable |

**Table: `llm_call_logs`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar` | PK (nanoid) |
| `document_id` | `varchar` | FK → `documents.id`, nullable |
| `job_id` | `varchar` | nullable |
| `task_type` | `varchar(30)` | NOT NULL |
| `model_id` | `varchar(100)` | NOT NULL |
| `status` | `varchar(20)` | NOT NULL |
| `started_at` | `timestamptz` | NOT NULL |
| `completed_at` | `timestamptz` | nullable |
| `processing_time_ms` | `integer` | nullable |
| `input_tokens` | `integer` | nullable |
| `output_tokens` | `integer` | nullable |
| `cost_cents` | `numeric(10,4)` | nullable |
| `error_code` | `varchar(50)` | nullable |
| `error_message` | `text` | nullable |
| `response_summary` | `jsonb` | nullable |

---

### 2.19 Import Tables

**Table: `document_sources`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar` | PK |
| `name` | `varchar(100)` | NOT NULL |
| `base_url` | `varchar(500)` | NOT NULL |
| `is_enabled` | `boolean` | NOT NULL, DEFAULT true |
| `rate_limit_per_second` | `integer` | nullable |
| `rate_limit_per_day` | `integer` | nullable |
| `requires_auth` | `boolean` | NOT NULL, DEFAULT false |

**Table: `document_import_jobs`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar` | PK (nanoid) |
| `source_id` | `varchar` | FK → `document_sources.id` |
| `user_id` | `varchar` | FK → `user.id` |
| `search_query` | `jsonb` | nullable |
| `document_ids` | `jsonb` | nullable |
| `status` | `varchar(20)` | NOT NULL, DEFAULT 'pending' |
| `total_requested` | `integer` | nullable |
| `imported_count` | `integer` | NOT NULL, DEFAULT 0 |
| `skipped_count` | `integer` | NOT NULL, DEFAULT 0 |
| `error_count` | `integer` | NOT NULL, DEFAULT 0 |
| `error_details` | `jsonb` | nullable |
| `started_at` | `timestamptz` | nullable |
| `completed_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() |

---

### 2.20 Policy Types

**Table: `policy_types`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `varchar(50)` | PK |
| `name` | `varchar(100)` | NOT NULL |
| `description` | `text` | nullable |
| `sort_order` | `integer` | NOT NULL, DEFAULT 0 |

**Seed data:** purchasing, alpr, surveillance

---

### 2.21 Redis Ephemeral Storage

Redis is used for ephemeral data that does not belong in PostgreSQL. All Redis keys use a namespaced prefix.

| Key Pattern | Value | TTL | Purpose |
|-------------|-------|-----|---------|
| `altcha:spent:{salt}` | `"1"` | 5 minutes | Prevents ALTCHA challenge replay attacks |
| `rl:{ip}:{route}` | counter | varies | @fastify/rate-limit distributed counters |

Redis is **not** a persistence layer. All data in Redis is expendable. If Redis is flushed, the only effects are:
- Rate limit counters reset (minor)
- Recently spent ALTCHA challenges could be replayed within their TTL window (acceptable risk for a cache flush)

---

## 3. Entity Relationship Summary

```
user ──1:1──> user_profiles
user ──1:N──> user_api_keys
user ──1:N──> user_api_call_log
user ──N:1──> user_tiers ──1:N──> tier_limits
user ──1:N──> documents (uploader_id, SET NULL on delete)
user ──1:N──> document_import_jobs

documents ──1:1──> document_processing_results
documents ──1:N──> document_metadata
documents ──1:N──> document_tags
documents ──N:M──> catalog_entries  (via document_catalog_associations)
documents ──N:M──> documents        (via document_document_associations)
documents ──N:M──> state_agencies   (via document_agencies)
documents ──1:N──> document_mentions
documents ──N:1──> states
documents ──N:1──> places
documents ──N:1──> tribes
documents ──N:1──> document_categories

catalog_entries ──N:1──> catalog_types
catalog_entries ──1:N──> catalog_aliases
catalog_entries ──N:M──> catalog_entries (via catalog_entry_associations)

state_agencies ──N:1──> states
state_metadata ──N:1──> states
places ──N:1──> states
```

---

## 4. Migration Considerations

The rebuild starts with a single initial migration containing the full schema. No migration history is preserved from the old codebase.

**Seed data required in initial migration:**
- States and territories (from Census data)
- Places (from Census gazetteer)
- Tribes
- Catalog types (vendor, product, technology, government_entity, person, organization)
- Association types (document-document and catalog relationships)
- Default document categories (13 categories)
- Default tiers (3 tiers with limits)
- Default policy types (purchasing, alpr, surveillance)
- DocumentCloud source entry
