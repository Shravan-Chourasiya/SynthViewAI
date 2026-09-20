/**
 * unit.roles.test.ts
 * Unit tests for the role hierarchy constants and helpers.
 */

import { describe, it, expect } from "vitest";
import {
  ADMIN_AREA_MIN_ROLE,
  ADMIN_AREA_ROLES,
  ROLE_LADDER,
  ROLE_MANAGEMENT_MIN_ROLE,
  ROLE_RANK,
  USER_ROLES,
  getRoleRank,
  hasRoleAtLeast,
  isUserRole,
  outranks,
} from "../src/constants/roles.constants.js";

describe("role hierarchy", () => {
  it("orders roles from least to most privileged", () => {
    expect(USER_ROLES).toEqual(["user", "moderator", "admin", "owner"]);
  });

  it("ranks the owner strictly above admin, above moderator, above user", () => {
    expect(ROLE_RANK.owner).toBeGreaterThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeGreaterThan(ROLE_RANK.moderator);
    expect(ROLE_RANK.moderator).toBeGreaterThan(ROLE_RANK.user);
  });

  it("renders the ladder for error messages", () => {
    expect(ROLE_LADDER).toBe("owner > admin > moderator > user");
  });

  it("puts the moderator floor on the admin area and the admin floor on role management", () => {
    expect(ADMIN_AREA_MIN_ROLE).toBe("moderator");
    expect(ROLE_MANAGEMENT_MIN_ROLE).toBe("admin");
    // The admin area therefore admits exactly the top three roles.
    expect(ADMIN_AREA_ROLES).toEqual(["owner", "admin", "moderator"]);
  });
});

describe("getRoleRank", () => {
  it("returns the rank for every known role", () => {
    expect(getRoleRank("user")).toBe(ROLE_RANK.user);
    expect(getRoleRank("owner")).toBe(ROLE_RANK.owner);
  });

  it("returns -1 for nullish and unknown roles so they never pass a check", () => {
    expect(getRoleRank(undefined)).toBe(-1);
    expect(getRoleRank(null)).toBe(-1);
    expect(getRoleRank("")).toBe(-1);
    expect(getRoleRank("superadmin")).toBe(-1);
  });
});

describe("isUserRole", () => {
  it("accepts known roles and rejects everything else", () => {
    for (const role of USER_ROLES) {
      expect(isUserRole(role)).toBe(true);
    }
    expect(isUserRole("root")).toBe(false);
    expect(isUserRole(42)).toBe(false);
    expect(isUserRole(null)).toBe(false);
  });
});

describe("hasRoleAtLeast", () => {
  it("is true when the role matches the minimum", () => {
    expect(hasRoleAtLeast("moderator", "moderator")).toBe(true);
  });

  it("is true for every role above the minimum", () => {
    expect(hasRoleAtLeast("admin", "moderator")).toBe(true);
    expect(hasRoleAtLeast("owner", "moderator")).toBe(true);
    expect(hasRoleAtLeast("owner", "admin")).toBe(true);
  });

  it("is false for every role below the minimum", () => {
    expect(hasRoleAtLeast("user", "moderator")).toBe(false);
    expect(hasRoleAtLeast("moderator", "admin")).toBe(false);
    expect(hasRoleAtLeast("admin", "owner")).toBe(false);
  });

  it("is false for unknown roles regardless of the minimum", () => {
    expect(hasRoleAtLeast(undefined, "user")).toBe(false);
    expect(hasRoleAtLeast("hacker", "user")).toBe(false);
  });
});

describe("outranks", () => {
  it("is true only for strictly higher roles", () => {
    expect(outranks("owner", "admin")).toBe(true);
    expect(outranks("admin", "moderator")).toBe(true);
    expect(outranks("moderator", "user")).toBe(true);
  });

  it("is false for peers and lower roles", () => {
    expect(outranks("owner", "owner")).toBe(false);
    expect(outranks("admin", "admin")).toBe(false);
    expect(outranks("moderator", "admin")).toBe(false);
    expect(outranks("user", "owner")).toBe(false);
  });

  it("treats an unknown actor as outranking nobody", () => {
    expect(outranks(undefined, "user")).toBe(false);
  });
});
