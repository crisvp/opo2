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
  limits: z
    .array(
      z.object({
        limitType: z.string().min(1),
        limitValue: z.number().int().nonnegative(),
      }),
    )
    .optional()
    .default([]),
});

export type CreateTierInput = z.infer<typeof createTierSchema>;

export const updateTierSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(255).nullable().optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export type UpdateTierInput = z.infer<typeof updateTierSchema>;

export const updateTierLimitsSchema = z.object({
  limits: z.array(
    z.object({
      limitType: z.string().min(1),
      limitValue: z.number().int().nonnegative(),
    }),
  ),
});

export type UpdateTierLimitsInput = z.infer<typeof updateTierLimitsSchema>;
