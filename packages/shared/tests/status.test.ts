import { describe, expect, it } from "vitest";

import { DOCUMENT_STATE, isValidStateTransition } from "../src/constants/status.js";
import { hasRole, ROLES } from "../src/constants/roles.js";

describe("isValidStateTransition", () => {
  it("allows pending_upload → draft", () => {
    expect(isValidStateTransition("pending_upload", "draft")).toBe(true);
  });

  it("allows pending_upload → submitted", () => {
    expect(isValidStateTransition("pending_upload", "submitted")).toBe(true);
  });

  it("allows draft → submitted", () => {
    expect(isValidStateTransition("draft", "submitted")).toBe(true);
  });

  it("disallows draft → approved", () => {
    expect(isValidStateTransition("draft", "approved")).toBe(false);
  });

  it("allows moderator_review → approved", () => {
    expect(isValidStateTransition("moderator_review", "approved")).toBe(true);
  });

  it("allows moderator_review → rejected", () => {
    expect(isValidStateTransition("moderator_review", "rejected")).toBe(true);
  });

  it("disallows approved → any transition", () => {
    for (const state of Object.values(DOCUMENT_STATE)) {
      expect(isValidStateTransition("approved", state)).toBe(false);
    }
  });

  it("allows rejected → submitted (resubmit)", () => {
    expect(isValidStateTransition("rejected", "submitted")).toBe(true);
  });

  it("allows processing_failed → submitted (retry)", () => {
    expect(isValidStateTransition("processing_failed", "submitted")).toBe(true);
  });
});

describe("hasRole", () => {
  it("admin has admin role", () => {
    expect(hasRole(ROLES.ADMIN, ROLES.ADMIN)).toBe(true);
  });

  it("admin has moderator role", () => {
    expect(hasRole(ROLES.ADMIN, ROLES.MODERATOR)).toBe(true);
  });

  it("admin has user role", () => {
    expect(hasRole(ROLES.ADMIN, ROLES.USER)).toBe(true);
  });

  it("moderator does not have admin role", () => {
    expect(hasRole(ROLES.MODERATOR, ROLES.ADMIN)).toBe(false);
  });

  it("moderator has moderator role", () => {
    expect(hasRole(ROLES.MODERATOR, ROLES.MODERATOR)).toBe(true);
  });

  it("user does not have moderator role", () => {
    expect(hasRole(ROLES.USER, ROLES.MODERATOR)).toBe(false);
  });
});
