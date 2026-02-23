-- =============================================================================
-- 001_initial_schema.sql
-- Complete initial schema for Open Panopticon rebuild
-- =============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- =============================================================================
-- LOCATION TABLES (seeded from Census data)
-- =============================================================================

CREATE TABLE states (
  usps        VARCHAR(2)   PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  is_territory BOOLEAN     NOT NULL DEFAULT false
);

CREATE TABLE places (
  geoid       VARCHAR      PRIMARY KEY,
  usps        VARCHAR(2)   NOT NULL REFERENCES states(usps),
  name        VARCHAR(200) NOT NULL,
  lsad        VARCHAR(10),
  funcstat    VARCHAR(5),
  lat         NUMERIC(10,7) NOT NULL,
  lon         NUMERIC(11,7) NOT NULL,
  aland_sqmi  NUMERIC
);

CREATE INDEX idx_places_usps ON places(usps);
CREATE INDEX idx_places_name_trgm ON places USING GIN (name gin_trgm_ops);

CREATE TABLE tribes (
  id               VARCHAR      PRIMARY KEY,
  name             VARCHAR(500) NOT NULL,
  is_alaska_native BOOLEAN      NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_tribes_name_trgm ON tribes USING GIN (name gin_trgm_ops);

-- =============================================================================
-- CATALOG TYPES
-- =============================================================================

CREATE TABLE catalog_types (
  id               VARCHAR      PRIMARY KEY,
  name             VARCHAR(100) NOT NULL,
  description      TEXT,
  icon             VARCHAR(50),
  color            VARCHAR(20),
  attribute_schema JSONB,
  is_system        BOOLEAN      NOT NULL DEFAULT false,
  sort_order       INTEGER      NOT NULL DEFAULT 0
);

-- =============================================================================
-- ASSOCIATION TYPES
-- =============================================================================

CREATE TABLE association_types (
  id             VARCHAR      PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  description    TEXT,
  applies_to     VARCHAR(30)  NOT NULL,
  is_directional BOOLEAN      NOT NULL DEFAULT false,
  inverse_id     VARCHAR      REFERENCES association_types(id),
  is_system      BOOLEAN      NOT NULL DEFAULT false,
  sort_order     INTEGER      NOT NULL DEFAULT 0
);

-- =============================================================================
-- DOCUMENT CATEGORIES
-- =============================================================================

CREATE TABLE document_categories (
  id                        VARCHAR(50)  PRIMARY KEY,
  name                      VARCHAR(200) NOT NULL,
  description               TEXT,
  min_vendors               INTEGER,
  max_vendors               INTEGER,
  min_products              INTEGER,
  max_products              INTEGER,
  min_technologies          INTEGER,
  max_technologies          INTEGER,
  min_government_entities   INTEGER,
  max_government_entities   INTEGER,
  require_government_location BOOLEAN
);

-- =============================================================================
-- METADATA FIELD DEFINITIONS
-- =============================================================================

CREATE TABLE metadata_field_definitions (
  id               VARCHAR      PRIMARY KEY,
  category_id      VARCHAR      NOT NULL REFERENCES document_categories(id) ON DELETE CASCADE,
  field_key        VARCHAR(100) NOT NULL,
  display_name     VARCHAR(200) NOT NULL,
  description      TEXT,
  value_type       VARCHAR(20)  NOT NULL,
  enum_values      JSONB,
  is_required      BOOLEAN      NOT NULL DEFAULT false,
  is_ai_extractable BOOLEAN     NOT NULL DEFAULT false,
  validation_rules JSONB,
  display_order    INTEGER      NOT NULL DEFAULT 0,
  UNIQUE (category_id, field_key)
);

-- =============================================================================
-- USER TIERS
-- =============================================================================

CREATE TABLE user_tiers (
  id          INTEGER      PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL,
  description VARCHAR(255),
  is_default  BOOLEAN      NOT NULL DEFAULT false,
  sort_order  INTEGER      NOT NULL DEFAULT 0
);

CREATE TABLE tier_limits (
  id          VARCHAR      PRIMARY KEY,
  tier_id     INTEGER      NOT NULL REFERENCES user_tiers(id) ON DELETE CASCADE,
  limit_type  VARCHAR      NOT NULL,
  limit_value INTEGER      NOT NULL,
  UNIQUE (tier_id, limit_type)
);

-- =============================================================================
-- POLICY TYPES
-- =============================================================================

CREATE TABLE policy_types (
  id          VARCHAR(50)  PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order  INTEGER      NOT NULL DEFAULT 0
);

-- =============================================================================
-- DOCUMENT SOURCES
-- =============================================================================

CREATE TABLE document_sources (
  id                   VARCHAR      PRIMARY KEY,
  name                 VARCHAR(100) NOT NULL,
  base_url             VARCHAR(500) NOT NULL,
  is_enabled           BOOLEAN      NOT NULL DEFAULT true,
  rate_limit_per_second INTEGER,
  rate_limit_per_day   INTEGER,
  requires_auth        BOOLEAN      NOT NULL DEFAULT false
);

-- =============================================================================
-- BETTER AUTH TABLES
-- (Better Auth will manage these, but we create them explicitly for control)
-- =============================================================================

CREATE TABLE "user" (
  id                    VARCHAR   PRIMARY KEY,
  name                  TEXT      NOT NULL,
  email                 TEXT      NOT NULL UNIQUE,
  "emailVerified"       BOOLEAN   NOT NULL DEFAULT false,
  image                 TEXT,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- twoFactor plugin column
  "twoFactorEnabled"    BOOLEAN   NOT NULL DEFAULT false,
  -- Application columns
  role                  VARCHAR(20) NOT NULL DEFAULT 'user',
  tier                  INTEGER     NOT NULL DEFAULT 1 REFERENCES user_tiers(id)
);

CREATE TABLE session (
  id            VARCHAR     PRIMARY KEY,
  "expiresAt"   TIMESTAMPTZ NOT NULL,
  token         TEXT        NOT NULL UNIQUE,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "ipAddress"   TEXT,
  "userAgent"   TEXT,
  "userId"      VARCHAR     NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE account (
  id                       VARCHAR     PRIMARY KEY,
  "accountId"              TEXT        NOT NULL,
  "providerId"             TEXT        NOT NULL,
  "userId"                 VARCHAR     NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "accessToken"            TEXT,
  "refreshToken"           TEXT,
  "idToken"                TEXT,
  "accessTokenExpiresAt"   TIMESTAMPTZ,
  "refreshTokenExpiresAt"  TIMESTAMPTZ,
  scope                    TEXT,
  password                 TEXT,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE verification (
  id          VARCHAR     PRIMARY KEY,
  identifier  TEXT        NOT NULL,
  value       TEXT        NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now(),
  "updatedAt" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE two_factor (
  id          VARCHAR NOT NULL,
  secret      TEXT    NOT NULL,
  backupCodes TEXT    NOT NULL,
  "userId"    VARCHAR NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE passkey (
  id                 VARCHAR     NOT NULL PRIMARY KEY,
  name               TEXT,
  "publicKey"        TEXT        NOT NULL,
  "userId"           VARCHAR     NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "webauthnUserID"   TEXT        NOT NULL,
  counter            INTEGER     NOT NULL,
  "deviceType"       TEXT        NOT NULL,
  "backedUp"         BOOLEAN     NOT NULL,
  transports         TEXT,
  "createdAt"        TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- USER PROFILE & API KEYS
-- =============================================================================

CREATE TABLE user_profiles (
  user_id      VARCHAR    PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  place_geoid  VARCHAR    REFERENCES places(geoid),
  state_usps   VARCHAR(2) REFERENCES states(usps)
);

CREATE TABLE user_api_keys (
  id            VARCHAR    PRIMARY KEY,
  user_id       VARCHAR    NOT NULL REFERENCES "user"(id) ON DELETE CASCADE UNIQUE,
  encrypted_key TEXT       NOT NULL,
  key_hash      VARCHAR    NOT NULL,
  daily_limit   INTEGER    NOT NULL DEFAULT 10,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_api_call_log (
  id          VARCHAR    PRIMARY KEY,
  user_id     VARCHAR    NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  limit_type  VARCHAR    NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_api_call_log_user_id ON user_api_call_log(user_id);
CREATE INDEX idx_user_api_call_log_created_at ON user_api_call_log(created_at DESC);

-- =============================================================================
-- DOCUMENTS
-- =============================================================================

CREATE TABLE documents (
  id                     VARCHAR       PRIMARY KEY,
  title                  VARCHAR(500)  NOT NULL,
  description            TEXT,
  filename               VARCHAR(500)  NOT NULL,
  filepath               VARCHAR(1000) NOT NULL,
  mimetype               VARCHAR(255)  NOT NULL,
  size                   BIGINT        NOT NULL,
  uploader_id            VARCHAR       REFERENCES "user"(id) ON DELETE SET NULL,
  government_level       VARCHAR(20),
  state_usps             VARCHAR(2)    REFERENCES states(usps),
  place_geoid            VARCHAR       REFERENCES places(geoid),
  tribe_id               VARCHAR       REFERENCES tribes(id),
  document_date          DATE,
  category               VARCHAR       REFERENCES document_categories(id),
  state                  VARCHAR(30)   NOT NULL DEFAULT 'pending_upload',
  use_ai_extraction      BOOLEAN       NOT NULL DEFAULT true,
  reviewed_by            VARCHAR       REFERENCES "user"(id),
  reviewed_at            TIMESTAMPTZ,
  rejection_reason       TEXT,
  processing_started_at  TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  source_id              VARCHAR       REFERENCES document_sources(id),
  external_id            VARCHAR,
  created_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_uploader_id ON documents(uploader_id);
CREATE INDEX idx_documents_state ON documents(state);
CREATE INDEX idx_documents_state_usps ON documents(state_usps);
CREATE INDEX idx_documents_place_geoid ON documents(place_geoid);
CREATE INDEX idx_documents_category ON documents(category);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX idx_documents_fts ON documents
  USING GIN (to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Trigger to notify on state changes
CREATE OR REPLACE FUNCTION notify_document_state_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.state IS DISTINCT FROM NEW.state THEN
    PERFORM pg_notify(
      'document_status_changes',
      json_build_object(
        'documentId', NEW.id,
        'state', NEW.state,
        'previousState', OLD.state
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_state_notify
AFTER UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION notify_document_state_change();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- DOCUMENT TAGS
-- =============================================================================

CREATE TABLE document_tags (
  id          VARCHAR     PRIMARY KEY,
  document_id VARCHAR     NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag         VARCHAR(100) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, tag)
);

CREATE INDEX idx_document_tags_document_id ON document_tags(document_id);
CREATE INDEX idx_document_tags_tag ON document_tags(tag);

-- =============================================================================
-- CATALOG ENTRIES & ALIASES
-- =============================================================================

CREATE TABLE catalog_entries (
  id          VARCHAR      PRIMARY KEY,
  type_id     VARCHAR      NOT NULL REFERENCES catalog_types(id),
  name        VARCHAR(500) NOT NULL,
  attributes  JSONB,
  is_verified BOOLEAN      NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (type_id, name)
);

CREATE INDEX idx_catalog_entries_type_id ON catalog_entries(type_id);
CREATE INDEX idx_catalog_entries_name_trgm ON catalog_entries USING GIN (name gin_trgm_ops);

CREATE TRIGGER catalog_entries_updated_at
BEFORE UPDATE ON catalog_entries
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TABLE catalog_aliases (
  id               VARCHAR      PRIMARY KEY,
  entry_id         VARCHAR      NOT NULL REFERENCES catalog_entries(id) ON DELETE CASCADE,
  alias            VARCHAR(500) NOT NULL,
  normalized_alias VARCHAR(500) NOT NULL,
  source           VARCHAR(20)  NOT NULL DEFAULT 'manual',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (entry_id, normalized_alias)
);

CREATE INDEX idx_catalog_aliases_entry_id ON catalog_aliases(entry_id);
CREATE INDEX idx_catalog_aliases_normalized_trgm ON catalog_aliases USING GIN (normalized_alias gin_trgm_ops);

-- =============================================================================
-- ASSOCIATIONS
-- =============================================================================

CREATE TABLE document_catalog_associations (
  id                  VARCHAR    PRIMARY KEY,
  document_id         VARCHAR    NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  entry_id            VARCHAR    NOT NULL REFERENCES catalog_entries(id) ON DELETE CASCADE,
  association_type_id VARCHAR    REFERENCES association_types(id),
  role                VARCHAR(30),
  context             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, entry_id, role)
);

CREATE INDEX idx_doc_catalog_assoc_document_id ON document_catalog_associations(document_id);
CREATE INDEX idx_doc_catalog_assoc_entry_id ON document_catalog_associations(entry_id);

CREATE TABLE document_document_associations (
  id                  VARCHAR    PRIMARY KEY,
  source_document_id  VARCHAR    NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  target_document_id  VARCHAR    NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  association_type_id VARCHAR    NOT NULL REFERENCES association_types(id),
  context             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_document_id, target_document_id, association_type_id)
);

CREATE TABLE catalog_entry_associations (
  id                  VARCHAR    PRIMARY KEY,
  source_entry_id     VARCHAR    NOT NULL REFERENCES catalog_entries(id) ON DELETE CASCADE,
  target_entry_id     VARCHAR    NOT NULL REFERENCES catalog_entries(id) ON DELETE CASCADE,
  association_type_id VARCHAR    NOT NULL REFERENCES association_types(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_entry_id, target_entry_id, association_type_id)
);

-- =============================================================================
-- DOCUMENT METADATA
-- =============================================================================

CREATE TABLE document_metadata (
  id                  VARCHAR     PRIMARY KEY,
  document_id         VARCHAR     NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  field_key           VARCHAR(100) NOT NULL,
  field_definition_id VARCHAR     REFERENCES metadata_field_definitions(id),
  value_text          TEXT,
  value_number        NUMERIC,
  value_date          DATE,
  value_boolean       BOOLEAN,
  value_json          JSONB,
  source              VARCHAR(20) NOT NULL DEFAULT 'user',
  confidence          NUMERIC(3,2),
  UNIQUE (document_id, field_key)
);

CREATE INDEX idx_document_metadata_document_id ON document_metadata(document_id);

-- =============================================================================
-- STATE AGENCIES & METADATA
-- =============================================================================

CREATE TABLE state_agencies (
  id           VARCHAR      PRIMARY KEY,
  state_usps   VARCHAR(2)   NOT NULL REFERENCES states(usps),
  name         VARCHAR(200) NOT NULL,
  abbreviation VARCHAR(20),
  category     VARCHAR(30),
  website_url  VARCHAR(500),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TRIGGER state_agencies_updated_at
BEFORE UPDATE ON state_agencies
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TABLE document_agencies (
  document_id VARCHAR NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  agency_id   VARCHAR NOT NULL REFERENCES state_agencies(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, agency_id)
);

CREATE TABLE state_metadata (
  id         VARCHAR      PRIMARY KEY,
  state_usps VARCHAR(2)   NOT NULL REFERENCES states(usps),
  key        VARCHAR(100) NOT NULL,
  value      VARCHAR(2000) NOT NULL,
  url        VARCHAR(500),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (state_usps, key)
);

CREATE TRIGGER state_metadata_updated_at
BEFORE UPDATE ON state_metadata
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- DOCUMENT MENTIONS
-- =============================================================================

CREATE TABLE document_mentions (
  id               VARCHAR      PRIMARY KEY,
  document_id      VARCHAR      NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  type_id          VARCHAR      NOT NULL REFERENCES catalog_types(id),
  mentioned_name   VARCHAR(500) NOT NULL,
  normalized_name  VARCHAR(500) NOT NULL,
  context_attributes JSONB,
  confidence       NUMERIC(3,2),
  resolved_entry_id VARCHAR     REFERENCES catalog_entries(id),
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_mentions_document_id ON document_mentions(document_id);
CREATE INDEX idx_document_mentions_normalized_name ON document_mentions(normalized_name);

-- =============================================================================
-- PROCESSING RESULTS & LOGS
-- =============================================================================

CREATE TABLE document_processing_results (
  document_id                 VARCHAR      PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  virus_scan_passed           BOOLEAN,
  virus_scan_details          TEXT,
  virus_scan_completed_at     TIMESTAMPTZ,
  conversion_performed        BOOLEAN,
  original_mimetype           VARCHAR(255),
  converted_filepath          VARCHAR(1000),
  conversion_completed_at     TIMESTAMPTZ,
  sieve_performed             BOOLEAN,
  sieve_category              VARCHAR(30),
  sieve_nexus_score           NUMERIC,
  sieve_junk_score            NUMERIC,
  sieve_confidence            NUMERIC,
  sieve_reasoning             TEXT,
  sieve_model                 VARCHAR(100),
  sieve_processing_time_ms    INTEGER,
  sieve_completed_at          TIMESTAMPTZ,
  ai_extraction_performed     BOOLEAN,
  ai_extraction_model         VARCHAR(100),
  ai_extracted_metadata       TEXT,
  ai_extraction_error         TEXT,
  ai_extraction_completed_at  TIMESTAMPTZ
);

CREATE TABLE job_execution_logs (
  id               VARCHAR      PRIMARY KEY,
  document_id      VARCHAR      REFERENCES documents(id),
  graphile_job_id  VARCHAR      NOT NULL,
  task_identifier  VARCHAR(100) NOT NULL,
  log_entries      JSONB,
  started_at       TIMESTAMPTZ  NOT NULL,
  completed_at     TIMESTAMPTZ,
  duration_ms      INTEGER,
  status           VARCHAR(20)  NOT NULL,
  final_error      TEXT
);

CREATE INDEX idx_job_execution_logs_document_id ON job_execution_logs(document_id);
CREATE INDEX idx_job_execution_logs_started_at ON job_execution_logs(started_at DESC);

CREATE TABLE llm_call_logs (
  id                 VARCHAR      PRIMARY KEY,
  document_id        VARCHAR      REFERENCES documents(id),
  job_id             VARCHAR,
  task_type          VARCHAR(30)  NOT NULL,
  model_id           VARCHAR(100) NOT NULL,
  status             VARCHAR(20)  NOT NULL,
  started_at         TIMESTAMPTZ  NOT NULL,
  completed_at       TIMESTAMPTZ,
  processing_time_ms INTEGER,
  input_tokens       INTEGER,
  output_tokens      INTEGER,
  cost_cents         NUMERIC(10,4),
  error_code         VARCHAR(50),
  error_message      TEXT,
  response_summary   JSONB
);

CREATE INDEX idx_llm_call_logs_document_id ON llm_call_logs(document_id);
CREATE INDEX idx_llm_call_logs_started_at ON llm_call_logs(started_at DESC);

-- =============================================================================
-- DOCUMENT IMPORT JOBS
-- =============================================================================

CREATE TABLE document_import_jobs (
  id              VARCHAR    PRIMARY KEY,
  source_id       VARCHAR    NOT NULL REFERENCES document_sources(id),
  user_id         VARCHAR    NOT NULL REFERENCES "user"(id),
  search_query    JSONB,
  document_ids    JSONB,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  total_requested INTEGER,
  imported_count  INTEGER     NOT NULL DEFAULT 0,
  skipped_count   INTEGER     NOT NULL DEFAULT 0,
  error_count     INTEGER     NOT NULL DEFAULT 0,
  error_details   JSONB,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- SEED DATA
-- =============================================================================

-- Catalog types
INSERT INTO catalog_types (id, name, description, is_system, sort_order) VALUES
  ('vendor',            'Vendor',            'Companies and organizations selling products/services', true, 1),
  ('product',           'Product',           'Specific products, systems, or tools',                  true, 2),
  ('technology',        'Technology',        'Technologies and technical approaches',                  true, 3),
  ('government_entity', 'Government Entity', 'Government agencies and departments',                   true, 4),
  ('person',            'Person',            'Individual people',                                     true, 5),
  ('organization',      'Organization',      'Non-government organizations',                          true, 6);

-- Association types
INSERT INTO association_types (id, name, applies_to, is_directional, inverse_id, is_system, sort_order) VALUES
  ('supersedes',    'Supersedes',    'document_document', true,  'superseded_by', true, 1),
  ('superseded_by', 'Superseded By', 'document_document', true,  'supersedes',    true, 2),
  ('amends',        'Amends',        'document_document', true,  'amended_by',    true, 3),
  ('amended_by',    'Amended By',    'document_document', true,  'amends',        true, 4),
  ('references',    'References',    'document_document', false, NULL,            true, 5),
  ('attachment_of', 'Attachment Of', 'document_document', true,  'has_attachment', true, 6),
  ('has_attachment','Has Attachment','document_document', true,  'attachment_of', true, 7);

-- Document categories (13 default categories)
INSERT INTO document_categories (id, name) VALUES
  ('contract',          'Contract'),
  ('proposal',          'Proposal'),
  ('policy',            'Policy'),
  ('meeting_agenda',    'Meeting Agenda'),
  ('meeting_minutes',   'Meeting Minutes'),
  ('invoice',           'Invoice'),
  ('correspondence',    'Correspondence'),
  ('audit_report',      'Audit Report'),
  ('training_material', 'Training Material'),
  ('foia_request',      'FOIA Request'),
  ('procurement',       'Procurement'),
  ('compliance',        'Compliance'),
  ('other',             'Other');

-- User tiers
INSERT INTO user_tiers (id, name, description, is_default, sort_order) VALUES
  (1, 'Basic',    'Basic tier with standard limits', true,  1),
  (2, 'Standard', 'Standard tier with higher limits', false, 2),
  (3, 'Premium',  'Premium tier with high limits',    false, 3);

INSERT INTO tier_limits (id, tier_id, limit_type, limit_value) VALUES
  ('tl_1_uploads',   1, 'uploads',      10),
  ('tl_1_llm',       1, 'llm_metadata', 10),
  ('tl_2_uploads',   2, 'uploads',      50),
  ('tl_2_llm',       2, 'llm_metadata', 50),
  ('tl_3_uploads',   3, 'uploads',      500),
  ('tl_3_llm',       3, 'llm_metadata', 500);

-- Policy types
INSERT INTO policy_types (id, name, sort_order) VALUES
  ('purchasing',   'Purchasing Policy',   1),
  ('alpr',         'ALPR Policy',         2),
  ('surveillance', 'Surveillance Policy', 3);

-- Document sources
INSERT INTO document_sources (id, name, base_url, is_enabled, requires_auth) VALUES
  ('documentcloud', 'DocumentCloud', 'https://www.documentcloud.org', true, false);

-- Grant permissions to app role (only if role exists — skipped in dev where opo_admin is used directly)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'opo_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO opo_app';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO opo_app';
  END IF;
END
$$;
