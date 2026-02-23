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

export type CreateCatalogEntryInput = z.infer<typeof createCatalogEntrySchema>;

export const updateCatalogEntrySchema = z.object({
  name: z.string().min(1).max(500).optional(),
  attributes: z.record(z.unknown()).optional(),
  isVerified: z.boolean().optional(),
});

export type UpdateCatalogEntryInput = z.infer<typeof updateCatalogEntrySchema>;

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

export type CreateAliasInput = z.infer<typeof createAliasSchema>;

export interface CatalogAlias {
  id: string;
  entryId: string;
  alias: string;
  normalizedAlias: string;
  source: string;
  createdAt: string;
}

export const ASSOCIATION_SCOPES = {
  DOCUMENT_CATALOG: "document_catalog",
  DOCUMENT_DOCUMENT: "document_document",
  CATALOG_CATALOG: "catalog_catalog",
} as const;

export interface AssociationType {
  id: string;
  name: string;
  description: string | null;
  appliesTo: string;
  isDirectional: boolean;
  inverseId: string | null;
  isSystem: boolean;
  sortOrder: number;
}

export const PARTY_ROLES = {
  PARTY: "party",
  CONTRACTOR: "contractor",
  SUBCONTRACTOR: "subcontractor",
  JURISDICTION: "jurisdiction",
} as const;

export const syncDocumentAssociationsSchema = z.object({
  associations: z.array(
    z.object({
      entryId: z.string(),
      associationTypeId: z.string().optional(),
      role: z.enum(["party", "contractor", "subcontractor", "jurisdiction"]).optional(),
      context: z.string().max(1000).optional(),
    }),
  ),
});

export type SyncDocumentAssociationsInput = z.infer<typeof syncDocumentAssociationsSchema>;

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

export const createDocumentAssociationSchema = z.object({
  targetDocumentId: z.string(),
  associationTypeId: z.string(),
  context: z.string().max(1000).optional(),
});

export type CreateDocumentAssociationInput = z.infer<typeof createDocumentAssociationSchema>;

export interface DocumentDocumentAssociation {
  id: string;
  sourceDocumentId: string;
  targetDocumentId: string;
  associationTypeId: string;
  context: string | null;
  createdAt: string;
  targetDocumentTitle?: string;
}

export interface CatalogEntryAssociation {
  id: string;
  sourceEntryId: string;
  sourceName?: string;
  targetEntryId: string;
  targetName?: string;
  associationTypeId: string;
  createdAt: string;
}

export const createCatalogAssociationSchema = z.object({
  targetEntryId: z.string().min(1),
  associationTypeId: z.string().min(1),
});

export type CreateCatalogAssociationInput = z.infer<typeof createCatalogAssociationSchema>;
