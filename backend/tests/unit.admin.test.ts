/**
 * unit.admin.test.ts — Admin service rank-guard unit tests
 */

import { describe, it, expect } from "vitest";
import { getRoleRank, ROLE_RANK, outranks } from "../src/constants/roles.constants.js";

// Mirror the assertActorOutranksOrIsOwner logic for isolated unit testing.
function canAct(actorRole: string, targetRole: string): boolean {
  const actorRank = getRoleRank(actorRole);
  const targetRank = getRoleRank(targetRole);
  const actorIsOwner = actorRole === "owner";
  return actorIsOwner || actorRank > targetRank;
}

describe("Admin rank-guard logic (assertActorOutranksOrIsOwner)", () => {
  it("owner can act on any role including another owner", () => {
    expect(canAct("owner", "owner")).toBe(true);
    expect(canAct("owner", "admin")).toBe(true);
    expect(canAct("owner", "moderator")).toBe(true);
    expect(canAct("owner", "user")).toBe(true);
  });

  it("admin can act on moderator and user but not on admin or owner", () => {
    expect(canAct("admin", "moderator")).toBe(true);
    expect(canAct("admin", "user")).toBe(true);
    expect(canAct("admin", "admin")).toBe(false);
    expect(canAct("admin", "owner")).toBe(false);
  });

  it("moderator can act on user but not on moderator, admin, or owner", () => {
    expect(canAct("moderator", "user")).toBe(true);
    expect(canAct("moderator", "moderator")).toBe(false);
    expect(canAct("moderator", "admin")).toBe(false);
    expect(canAct("moderator", "owner")).toBe(false);
  });

  it("user cannot act on anyone", () => {
    expect(canAct("user", "user")).toBe(false);
    expect(canAct("user", "moderator")).toBe(false);
    expect(canAct("user", "admin")).toBe(false);
    expect(canAct("user", "owner")).toBe(false);
  });

  it("ROLE_RANK values are strictly ordered", () => {
    expect(ROLE_RANK.user).toBeLessThan(ROLE_RANK.moderator);
    expect(ROLE_RANK.moderator).toBeLessThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeLessThan(ROLE_RANK.owner);
  });

  it("outranks returns true only when actor strictly outranks target", () => {
    expect(outranks("admin", "moderator")).toBe(true);
    expect(outranks("admin", "admin")).toBe(false);
    expect(outranks("moderator", "admin")).toBe(false);
  });

  it("getRoleRank returns -1 for unknown or missing roles", () => {
    expect(getRoleRank(undefined)).toBe(-1);
    expect(getRoleRank(null)).toBe(-1);
    expect(getRoleRank("superuser")).toBe(-1);
  });
});
