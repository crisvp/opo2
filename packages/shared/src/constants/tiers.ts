export const DEFAULT_TIER_ID = 1;

export const TIER_LIMIT_TYPES = {
  UPLOADS: "uploads",
  LLM_METADATA: "llm_metadata",
} as const;

export type TierLimitType = (typeof TIER_LIMIT_TYPES)[keyof typeof TIER_LIMIT_TYPES];
