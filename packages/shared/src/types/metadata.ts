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

export const validationRulesSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().optional(),
    pattern: z.string().optional(),
  })
  .optional();

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

export type CreateFieldDefinitionInput = z.infer<typeof createFieldDefinitionSchema>;

export const updateFieldDefinitionSchema = createFieldDefinitionSchema
  .partial()
  .omit({ categoryId: true });

export type UpdateFieldDefinitionInput = z.infer<typeof updateFieldDefinitionSchema>;

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
  validationRules: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  } | null;
  displayOrder: number;
}

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

export type SetMetadataValueInput = z.infer<typeof setMetadataValueSchema>;

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
