import { describe, it, expect } from "vitest";

import { hasRole, ROLES } from "../src/constants/roles.js";

describe("hasRole — role hierarchy", () => {
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

  it("moderator has user role", () => {
    expect(hasRole(ROLES.MODERATOR, ROLES.USER)).toBe(true);
  });

  it("user does not have admin role", () => {
    expect(hasRole(ROLES.USER, ROLES.ADMIN)).toBe(false);
  });

  it("user does not have moderator role", () => {
    expect(hasRole(ROLES.USER, ROLES.MODERATOR)).toBe(false);
  });

  it("user has user role", () => {
    expect(hasRole(ROLES.USER, ROLES.USER)).toBe(true);
  });
});
