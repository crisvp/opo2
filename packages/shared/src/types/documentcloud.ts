import { z } from "zod";

export const documentCloudDocumentSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  description: z.string().nullable(),
  pages: z.number().int(),
  canonicalUrl: z.string(),
  organization: z.object({ name: z.string() }).nullable(),
  createdAt: z.string(),
  alreadyImported: z.boolean(),
});

export const documentCloudSearchResponseSchema = z.object({
  results: z.array(documentCloudDocumentSchema),
  count: z.number().int(),
  page: z.number().int(),
  perPage: z.number().int(),
});

export const documentCloudImportOptionsSchema = z.object({
  addTags: z.array(z.string()).optional(),
  governmentLevel: z.string().optional(),
  stateUsps: z.string().optional(),
  placeGeoid: z.string().optional(),
  tribeId: z.string().optional(),
});

export const documentCloudImportJobSchema = z.object({
  id: z.string(),
  status: z.string(),
  totalRequested: z.number().int(),
  importedCount: z.number().int(),
  errorCount: z.number().int(),
  createdAt: z.string(),
  completedAt: z.string().optional().nullable(),
});

export type DocumentCloudDocument = z.infer<typeof documentCloudDocumentSchema>;
export type DocumentCloudSearchResponse = z.infer<typeof documentCloudSearchResponseSchema>;
export type DocumentCloudImportOptions = z.infer<typeof documentCloudImportOptionsSchema>;
export type DocumentCloudImportJob = z.infer<typeof documentCloudImportJobSchema>;
