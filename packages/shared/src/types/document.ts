import { z } from "zod";

import type { DocumentState } from "../constants/status.js";

export const createDocumentSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  documentDate: z.string().optional(),
  governmentLevel: z.enum(["federal", "state", "county", "place", "tribal"]).optional(),
  stateUsps: z.string().length(2).optional(),
  placeGeoid: z.string().optional(),
  tribeId: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  governmentEntityId: z.string().optional(),
  saveAsDraft: z.boolean().optional().default(false),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const initiateUploadSchema = createDocumentSchema.extend({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  contentLength: z.number().int().min(1).max(52_428_800),
});

export type InitiateUploadInput = z.infer<typeof initiateUploadSchema>;

export const confirmUploadSchema = z.object({
  s3Key: z.string().min(1),
  saveAsDraft: z.boolean().optional().default(false),
});

export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  documentDate: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
});

export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

export const updateDocumentLocationSchema = z.object({
  governmentLevel: z.enum(["federal", "state", "county", "place", "tribal"]).nullable(),
  stateUsps: z.string().length(2).nullable(),
  placeGeoid: z.string().nullable(),
  tribeId: z.string().nullable(),
});

export type UpdateDocumentLocationInput = z.infer<typeof updateDocumentLocationSchema>;

export const syncTagsSchema = z.object({
  tags: z
    .array(z.string().min(1).max(100))
    .transform((tags) => tags.map((t) => t.trim().toLowerCase())),
});

export type SyncTagsInput = z.infer<typeof syncTagsSchema>;

export interface Document {
  id: string;
  title: string;
  description: string | null;
  filename: string;
  filepath: string;
  mimetype: string;
  size: number;
  uploaderId: string | null;
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

export interface DocumentAssociation {
  id: string;
  entryId: string;
  entryName: string;
  typeId: string | null;
  typeName: string | null;
  role: string | null;
  context: string | null;
}

export interface DocumentMetadataEntry {
  id: string;
  documentId: string;
  fieldKey: string;
  fieldDefinitionId: string | null;
  valueText: string | null;
  valueNumber: number | null;
  valueDate: string | null;
  valueBoolean: boolean | null;
  valueJson: unknown;
  source: string | null;
  confidence: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail extends Document {
  uploaderName: string | null;
  stateName: string | null;
  placeName: string | null;
  categoryName: string | null;
  tags: string[];
  associations: DocumentAssociation[];
  metadata: DocumentMetadataEntry[];
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
  uploaderId: string | null;
  uploaderName: string | null;
  documentDate: string | null;
  sourceId: string | null;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  vendors: { id: string; name: string }[];
  technologies: { id: string; name: string }[];
}

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
] as const;
