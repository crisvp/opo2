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

export type CreateMentionInput = z.infer<typeof createMentionSchema>;

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[.,;:'"!?()[\]{}]/g, "")
    .replace(/\s+/g, " ");
}
