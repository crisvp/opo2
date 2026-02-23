import { z } from "zod";

import type { Role } from "../constants/roles.js";

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
  resetAt: string;
}

export interface UserTierInfo {
  tier: number;
  tierLabel: string;
  usage: UserUsage[];
  isExempt: boolean;
  hasCustomOpenRouterKey?: boolean;
  hasSystemOpenRouterKey?: boolean;
}

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

export const setApiKeySchema = z.object({
  key: z.string().min(20).startsWith("sk-or-"),
});

export type SetApiKeyInput = z.infer<typeof setApiKeySchema>;

export const updateApiKeySettingsSchema = z.object({
  dailyLimit: z.number().int().min(1).max(100),
});

export type UpdateApiKeySettingsInput = z.infer<typeof updateApiKeySettingsSchema>;
