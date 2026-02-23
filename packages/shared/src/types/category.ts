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
  id: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z][a-z0-9_]*$/, "ID must be lowercase letters, numbers, and underscores"),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
});

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export interface DocumentCategoryRecord {
  id: string;
  name: string;
  description: string | null;
  minVendors: number | null;
  maxVendors: number | null;
  minProducts: number | null;
  maxProducts: number | null;
  minTechnologies: number | null;
  maxTechnologies: number | null;
  minGovernmentEntities: number | null;
  maxGovernmentEntities: number | null;
  requireGovernmentLocation: boolean | null;
}

export interface CategoryAssociationRules {
  minVendors: number | null;
  maxVendors: number | null;
  minProducts: number | null;
  maxProducts: number | null;
  minTechnologies: number | null;
  maxTechnologies: number | null;
  minGovernmentEntities: number | null;
  maxGovernmentEntities: number | null;
  requireGovernmentLocation: boolean | null;
}

export const updateCategoryRulesSchema = z.object({
  minVendors: z.number().int().nonnegative().nullable().optional(),
  maxVendors: z.number().int().nonnegative().nullable().optional(),
  minProducts: z.number().int().nonnegative().nullable().optional(),
  maxProducts: z.number().int().nonnegative().nullable().optional(),
  minTechnologies: z.number().int().nonnegative().nullable().optional(),
  maxTechnologies: z.number().int().nonnegative().nullable().optional(),
  minGovernmentEntities: z.number().int().nonnegative().nullable().optional(),
  maxGovernmentEntities: z.number().int().nonnegative().nullable().optional(),
  requireGovernmentLocation: z.boolean().nullable().optional(),
});

export type UpdateCategoryRulesInput = z.infer<typeof updateCategoryRulesSchema>;
