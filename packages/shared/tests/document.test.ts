import { describe, it, expect } from "vitest";

import {
  DOCUMENT_STATE,
  VALID_STATE_TRANSITIONS,
  isValidStateTransition,
  DELETABLE_STATES,
} from "../src/constants/status.js";

import {
  createDocumentSchema,
  updateDocumentSchema,
  syncTagsSchema,
} from "../src/types/document.js";

describe("DOCUMENT_STATE", () => {
  it("has PENDING_UPLOAD value 'pending_upload'", () => {
    expect(DOCUMENT_STATE.PENDING_UPLOAD).toBe("pending_upload");
  });

  it("has DRAFT value 'draft'", () => {
    expect(DOCUMENT_STATE.DRAFT).toBe("draft");
  });

  it("has SUBMITTED value 'submitted'", () => {
    expect(DOCUMENT_STATE.SUBMITTED).toBe("submitted");
  });

  it("has PROCESSING value 'processing'", () => {
    expect(DOCUMENT_STATE.PROCESSING).toBe("processing");
  });

  it("has PROCESSING_FAILED value 'processing_failed'", () => {
    expect(DOCUMENT_STATE.PROCESSING_FAILED).toBe("processing_failed");
  });

  it("has USER_REVIEW value 'user_review'", () => {
    expect(DOCUMENT_STATE.USER_REVIEW).toBe("user_review");
  });

  it("has MODERATOR_REVIEW value 'moderator_review'", () => {
    expect(DOCUMENT_STATE.MODERATOR_REVIEW).toBe("moderator_review");
  });

  it("has APPROVED value 'approved'", () => {
    expect(DOCUMENT_STATE.APPROVED).toBe("approved");
  });

  it("has REJECTED value 'rejected'", () => {
    expect(DOCUMENT_STATE.REJECTED).toBe("rejected");
  });

  it("has exactly 9 states", () => {
    expect(Object.keys(DOCUMENT_STATE)).toHaveLength(9);
  });
});

describe("VALID_STATE_TRANSITIONS", () => {
  it("covers all document states", () => {
    for (const state of Object.values(DOCUMENT_STATE)) {
      expect(VALID_STATE_TRANSITIONS).toHaveProperty(state);
    }
  });

  it("pending_upload can only transition to submitted", () => {
    expect(VALID_STATE_TRANSITIONS.pending_upload).toEqual(["submitted"]);
  });

  it("draft can only transition to moderator_review", () => {
    expect(VALID_STATE_TRANSITIONS.draft).toEqual(["moderator_review"]);
  });

  it("submitted can only transition to processing", () => {
    expect(VALID_STATE_TRANSITIONS.submitted).toEqual(["processing"]);
  });

  it("processing can transition to user_review, moderator_review, or processing_failed", () => {
    expect(VALID_STATE_TRANSITIONS.processing).toContain("user_review");
    expect(VALID_STATE_TRANSITIONS.processing).toContain("moderator_review");
    expect(VALID_STATE_TRANSITIONS.processing).toContain("processing_failed");
  });

  it("user_review can transition to draft or moderator_review", () => {
    expect(VALID_STATE_TRANSITIONS.user_review).toContain("draft");
    expect(VALID_STATE_TRANSITIONS.user_review).toContain("moderator_review");
  });

  it("approved has no transitions (terminal state)", () => {
    expect(VALID_STATE_TRANSITIONS.approved).toEqual([]);
  });

  it("rejected can transition to submitted (reimport) or user_review (edit)", () => {
    expect(VALID_STATE_TRANSITIONS.rejected).toContain("submitted");
    expect(VALID_STATE_TRANSITIONS.rejected).toContain("user_review");
  });
});

describe("isValidStateTransition", () => {
  it("returns true for valid transitions", () => {
    expect(isValidStateTransition("pending_upload", "submitted")).toBe(true);
    expect(isValidStateTransition("draft", "moderator_review")).toBe(true);
    expect(isValidStateTransition("submitted", "processing")).toBe(true);
    expect(isValidStateTransition("user_review", "draft")).toBe(true);
    expect(isValidStateTransition("user_review", "moderator_review")).toBe(true);
    expect(isValidStateTransition("moderator_review", "approved")).toBe(true);
    expect(isValidStateTransition("moderator_review", "rejected")).toBe(true);
    expect(isValidStateTransition("rejected", "submitted")).toBe(true);
    expect(isValidStateTransition("rejected", "user_review")).toBe(true);
    expect(isValidStateTransition("processing_failed", "submitted")).toBe(true);
  });

  it("returns false for invalid transitions", () => {
    expect(isValidStateTransition("pending_upload", "draft")).toBe(false);
    expect(isValidStateTransition("draft", "submitted")).toBe(false);
    expect(isValidStateTransition("draft", "approved")).toBe(false);
    expect(isValidStateTransition("approved", "draft")).toBe(false);
    expect(isValidStateTransition("approved", "submitted")).toBe(false);
    expect(isValidStateTransition("submitted", "approved")).toBe(false);
    expect(isValidStateTransition("pending_upload", "approved")).toBe(false);
    expect(isValidStateTransition("processing", "draft")).toBe(false);
  });

  it("approved has no valid outgoing transitions", () => {
    for (const state of Object.values(DOCUMENT_STATE)) {
      expect(isValidStateTransition("approved", state)).toBe(false);
    }
  });
});

describe("DELETABLE_STATES", () => {
  it("contains draft", () => {
    expect(DELETABLE_STATES).toContain("draft");
  });

  it("contains pending_upload", () => {
    expect(DELETABLE_STATES).toContain("pending_upload");
  });

  it("contains processing_failed", () => {
    expect(DELETABLE_STATES).toContain("processing_failed");
  });

  it("contains rejected", () => {
    expect(DELETABLE_STATES).toContain("rejected");
  });

  it("does not contain approved", () => {
    expect(DELETABLE_STATES).not.toContain("approved");
  });
});

describe("createDocumentSchema", () => {
  it("accepts valid input with just title", () => {
    const result = createDocumentSchema.safeParse({ title: "My Document" });
    expect(result.success).toBe(true);
  });

  it("requires title", () => {
    const result = createDocumentSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty title", () => {
    const result = createDocumentSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects title longer than 500 characters", () => {
    const result = createDocumentSchema.safeParse({ title: "a".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("accepts title at maximum length", () => {
    const result = createDocumentSchema.safeParse({ title: "a".repeat(500) });
    expect(result.success).toBe(true);
  });

  it("accepts optional description", () => {
    const result = createDocumentSchema.safeParse({
      title: "Test",
      description: "A description",
    });
    expect(result.success).toBe(true);
  });

  it("rejects description longer than 5000 characters", () => {
    const result = createDocumentSchema.safeParse({
      title: "Test",
      description: "a".repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it("defaults saveAsDraft to false when not provided", () => {
    const result = createDocumentSchema.safeParse({ title: "Test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.saveAsDraft).toBe(false);
    }
  });

  it("accepts tags array", () => {
    const result = createDocumentSchema.safeParse({
      title: "Test",
      tags: ["tag1", "tag2"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts all government level values", () => {
    for (const level of ["federal", "state", "place", "tribal"]) {
      const result = createDocumentSchema.safeParse({
        title: "Test",
        governmentLevel: level,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid government level", () => {
    const result = createDocumentSchema.safeParse({
      title: "Test",
      governmentLevel: "county",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateDocumentSchema", () => {
  it("accepts empty object (all optional)", () => {
    const result = updateDocumentSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts title update", () => {
    const result = updateDocumentSchema.safeParse({ title: "New Title" });
    expect(result.success).toBe(true);
  });

  it("accepts null description (to clear)", () => {
    const result = updateDocumentSchema.safeParse({ description: null });
    expect(result.success).toBe(true);
  });

  it("accepts null documentDate", () => {
    const result = updateDocumentSchema.safeParse({ documentDate: null });
    expect(result.success).toBe(true);
  });

  it("rejects title longer than 500 characters", () => {
    const result = updateDocumentSchema.safeParse({ title: "a".repeat(501) });
    expect(result.success).toBe(false);
  });
});

describe("syncTagsSchema", () => {
  it("accepts array of tags", () => {
    const result = syncTagsSchema.safeParse({ tags: ["tag1", "tag2"] });
    expect(result.success).toBe(true);
  });

  it("lowercases tags via transform", () => {
    const result = syncTagsSchema.safeParse({ tags: ["TAG1", "Tag2"] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual(["tag1", "tag2"]);
    }
  });

  it("trims tags via transform", () => {
    const result = syncTagsSchema.safeParse({ tags: ["  tag1  ", " tag2"] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual(["tag1", "tag2"]);
    }
  });

  it("accepts empty tags array", () => {
    const result = syncTagsSchema.safeParse({ tags: [] });
    expect(result.success).toBe(true);
  });

  it("rejects tags with more than 100 characters", () => {
    const result = syncTagsSchema.safeParse({ tags: ["a".repeat(101)] });
    expect(result.success).toBe(false);
  });

  it("rejects empty string tags", () => {
    const result = syncTagsSchema.safeParse({ tags: [""] });
    expect(result.success).toBe(false);
  });
});
