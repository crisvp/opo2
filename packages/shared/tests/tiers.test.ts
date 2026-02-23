import { describe, it, expect } from "vitest";

import {
  createTierSchema,
  updateTierSchema,
  updateTierLimitsSchema,
  TIER_LIMIT_TYPES,
  DEFAULT_TIER_ID,
} from "../src/index.js";
import type { TierLimitType } from "../src/index.js";

describe("createTierSchema", () => {
  it("accepts a valid tier with only required fields", () => {
    const result = createTierSchema.safeParse({ id: 1, name: "Basic" });
    expect(result.success).toBe(true);
  });

  it("accepts a valid tier with all optional fields", () => {
    const result = createTierSchema.safeParse({
      id: 2,
      name: "Pro",
      description: "Professional plan",
      isDefault: false,
      sortOrder: 1,
      limits: [{ limitType: "uploads", limitValue: 50 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects id of 0 (must be positive)", () => {
    expect(createTierSchema.safeParse({ id: 0, name: "Basic" }).success).toBe(false);
  });

  it("rejects negative id", () => {
    expect(createTierSchema.safeParse({ id: -1, name: "Basic" }).success).toBe(false);
  });

  it("rejects non-integer id (float)", () => {
    expect(createTierSchema.safeParse({ id: 1.5, name: "Basic" }).success).toBe(false);
  });

  it("rejects empty name", () => {
    expect(createTierSchema.safeParse({ id: 1, name: "" }).success).toBe(false);
  });

  it("rejects name longer than 50 characters", () => {
    expect(createTierSchema.safeParse({ id: 1, name: "a".repeat(51) }).success).toBe(false);
  });

  it("accepts name of exactly 50 characters", () => {
    expect(createTierSchema.safeParse({ id: 1, name: "a".repeat(50) }).success).toBe(true);
  });

  it("rejects description longer than 255 characters", () => {
    expect(
      createTierSchema.safeParse({ id: 1, name: "Basic", description: "a".repeat(256) }).success,
    ).toBe(false);
  });

  it("accepts description of exactly 255 characters", () => {
    expect(
      createTierSchema.safeParse({ id: 1, name: "Basic", description: "a".repeat(255) }).success,
    ).toBe(true);
  });

  it("defaults isDefault to false when not provided", () => {
    const result = createTierSchema.safeParse({ id: 1, name: "Basic" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isDefault).toBe(false);
    }
  });

  it("defaults limits to empty array when not provided", () => {
    const result = createTierSchema.safeParse({ id: 1, name: "Basic" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limits).toEqual([]);
    }
  });

  it("rejects limit with empty limitType", () => {
    const result = createTierSchema.safeParse({
      id: 1,
      name: "Basic",
      limits: [{ limitType: "", limitValue: 10 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects limit with negative limitValue", () => {
    const result = createTierSchema.safeParse({
      id: 1,
      name: "Basic",
      limits: [{ limitType: "uploads", limitValue: -1 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts limit with limitValue of 0", () => {
    const result = createTierSchema.safeParse({
      id: 1,
      name: "Basic",
      limits: [{ limitType: "uploads", limitValue: 0 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing id", () => {
    expect(createTierSchema.safeParse({ name: "Basic" }).success).toBe(false);
  });

  it("rejects missing name", () => {
    expect(createTierSchema.safeParse({ id: 1 }).success).toBe(false);
  });
});

describe("updateTierSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(updateTierSchema.safeParse({}).success).toBe(true);
  });

  it("accepts only name", () => {
    expect(updateTierSchema.safeParse({ name: "Updated" }).success).toBe(true);
  });

  it("accepts null description (to clear it)", () => {
    expect(updateTierSchema.safeParse({ description: null }).success).toBe(true);
  });

  it("accepts all fields", () => {
    const result = updateTierSchema.safeParse({
      name: "New Name",
      description: "New description",
      isDefault: true,
      sortOrder: 5,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name string", () => {
    expect(updateTierSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects name longer than 50 characters", () => {
    expect(updateTierSchema.safeParse({ name: "a".repeat(51) }).success).toBe(false);
  });

  it("rejects description longer than 255 characters", () => {
    expect(updateTierSchema.safeParse({ description: "a".repeat(256) }).success).toBe(false);
  });

  it("rejects non-integer sortOrder", () => {
    expect(updateTierSchema.safeParse({ sortOrder: 1.5 }).success).toBe(false);
  });
});

describe("updateTierLimitsSchema", () => {
  it("accepts empty limits array", () => {
    expect(updateTierLimitsSchema.safeParse({ limits: [] }).success).toBe(true);
  });

  it("accepts valid limits array", () => {
    const result = updateTierLimitsSchema.safeParse({
      limits: [
        { limitType: "uploads", limitValue: 10 },
        { limitType: "llm_metadata", limitValue: 5 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing limits field", () => {
    expect(updateTierLimitsSchema.safeParse({}).success).toBe(false);
  });

  it("rejects limit with empty limitType", () => {
    expect(
      updateTierLimitsSchema.safeParse({ limits: [{ limitType: "", limitValue: 10 }] }).success,
    ).toBe(false);
  });

  it("rejects limit with negative limitValue", () => {
    expect(
      updateTierLimitsSchema.safeParse({ limits: [{ limitType: "uploads", limitValue: -5 }] }).success,
    ).toBe(false);
  });

  it("accepts limitValue of 0 (non-negative)", () => {
    expect(
      updateTierLimitsSchema.safeParse({ limits: [{ limitType: "uploads", limitValue: 0 }] }).success,
    ).toBe(true);
  });

  it("rejects non-integer limitValue", () => {
    expect(
      updateTierLimitsSchema.safeParse({ limits: [{ limitType: "uploads", limitValue: 1.5 }] }).success,
    ).toBe(false);
  });
});

describe("TIER_LIMIT_TYPES", () => {
  it("has UPLOADS constant with value 'uploads'", () => {
    expect(TIER_LIMIT_TYPES.UPLOADS).toBe("uploads");
  });

  it("has LLM_METADATA constant with value 'llm_metadata'", () => {
    expect(TIER_LIMIT_TYPES.LLM_METADATA).toBe("llm_metadata");
  });

  it("is frozen / has exactly two entries", () => {
    const keys = Object.keys(TIER_LIMIT_TYPES);
    expect(keys).toHaveLength(2);
    expect(keys).toContain("UPLOADS");
    expect(keys).toContain("LLM_METADATA");
  });
});

describe("DEFAULT_TIER_ID", () => {
  it("equals 1", () => {
    expect(DEFAULT_TIER_ID).toBe(1);
  });

  it("is a number", () => {
    expect(typeof DEFAULT_TIER_ID).toBe("number");
  });
});

describe("TierLimitType type coverage", () => {
  it("UPLOADS value satisfies TierLimitType", () => {
    const val: TierLimitType = TIER_LIMIT_TYPES.UPLOADS;
    expect(val).toBe("uploads");
  });

  it("LLM_METADATA value satisfies TierLimitType", () => {
    const val: TierLimitType = TIER_LIMIT_TYPES.LLM_METADATA;
    expect(val).toBe("llm_metadata");
  });
});
