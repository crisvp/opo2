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

const agencyCategoryEnum = z.enum([
  "law_enforcement",
  "corrections",
  "health",
  "transportation",
  "education",
  "environment",
  "social_services",
  "regulatory",
  "other",
]);

export const createAgencySchema = z.object({
  stateUsps: z.string().length(2).toUpperCase(),
  name: z.string().min(1).max(200),
  abbreviation: z.string().max(20).optional().nullable(),
  category: agencyCategoryEnum.optional().nullable(),
  websiteUrl: z.string().url().max(500).optional().nullable(),
});

export type CreateAgencyInput = z.infer<typeof createAgencySchema>;

export const updateAgencySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  abbreviation: z.string().max(20).optional().nullable(),
  category: agencyCategoryEnum.optional().nullable(),
  websiteUrl: z.string().url().max(500).optional().nullable(),
});

export type UpdateAgencyInput = z.infer<typeof updateAgencySchema>;

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

export type CreateStateMetadataInput = z.infer<typeof createStateMetadataSchema>;

export const updateStateMetadataSchema = z.object({
  value: z.string().min(1).max(2000),
  url: z.string().url().max(500).optional().nullable(),
});

export type UpdateStateMetadataInput = z.infer<typeof updateStateMetadataSchema>;
