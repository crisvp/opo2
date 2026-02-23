import { describe, it, expect } from "vitest";
import {
  VALID_STATE_TRANSITIONS,
  REVIEW_STATES,
  DELETABLE_STATES,
  TERMINAL_STATES,
  PROCESSING_STATES,
  isValidStateTransition,
} from "../src/constants/status";

describe("VALID_STATE_TRANSITIONS", () => {
  it("pending_upload only transitions to submitted (not draft)", () => {
    expect(VALID_STATE_TRANSITIONS.pending_upload).toEqual(["submitted"]);
  });
  it("draft transitions to moderator_review only", () => {
    expect(VALID_STATE_TRANSITIONS.draft).toEqual(["moderator_review"]);
  });
  it("user_review can transition to draft or moderator_review", () => {
    expect(VALID_STATE_TRANSITIONS.user_review).toContain("draft");
    expect(VALID_STATE_TRANSITIONS.user_review).toContain("moderator_review");
  });
  it("rejected can transition to submitted or user_review", () => {
    expect(VALID_STATE_TRANSITIONS.rejected).toContain("submitted");
    expect(VALID_STATE_TRANSITIONS.rejected).toContain("user_review");
  });
  it("approved has no transitions", () => {
    expect(VALID_STATE_TRANSITIONS.approved).toEqual([]);
  });
});

describe("PROCESSING_STATES", () => {
  it("contains submitted", () => {
    expect(PROCESSING_STATES).toContain("submitted");
  });
  it("contains processing", () => {
    expect(PROCESSING_STATES).toContain("processing");
  });
  it("does not contain user_review", () => {
    expect(PROCESSING_STATES).not.toContain("user_review");
  });
  it("does not contain draft", () => {
    expect(PROCESSING_STATES).not.toContain("draft");
  });
});

describe("REVIEW_STATES", () => {
  it("contains user_review and draft", () => {
    expect(REVIEW_STATES).toContain("user_review");
    expect(REVIEW_STATES).toContain("draft");
  });
});

describe("TERMINAL_STATES", () => {
  it("only contains approved (not rejected)", () => {
    expect(TERMINAL_STATES).toEqual(["approved"]);
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

describe("isValidStateTransition", () => {
  it("allows user_review → draft", () => {
    expect(isValidStateTransition("user_review", "draft")).toBe(true);
  });
  it("allows draft → moderator_review", () => {
    expect(isValidStateTransition("draft", "moderator_review")).toBe(true);
  });
  it("allows rejected → user_review", () => {
    expect(isValidStateTransition("rejected", "user_review")).toBe(true);
  });
  it("disallows pending_upload → draft", () => {
    expect(isValidStateTransition("pending_upload", "draft")).toBe(false);
  });
  it("disallows draft → submitted", () => {
    expect(isValidStateTransition("draft", "submitted")).toBe(false);
  });
  it("disallows processing → approved (must pass through review)", () => {
    expect(isValidStateTransition("processing", "approved")).toBe(false);
  });
  it("disallows moderator_review → draft", () => {
    expect(isValidStateTransition("moderator_review", "draft")).toBe(false);
  });
  it("disallows approved → rejected (terminal state)", () => {
    expect(isValidStateTransition("approved", "rejected")).toBe(false);
  });
});
