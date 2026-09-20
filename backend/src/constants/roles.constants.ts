/**
 * Role hierarchy — the single source of truth for privilege levels.
 *
 *   owner   (apex)
 *     └── admin
 *           └── moderator
 *                 └── user
 *
 * A role inherits every privilege of the roles beneath it. So a guard that asks
 * for a minimum role also admits every role ranked above that minimum:
 *
 *   requireRole("moderator") -> moderator, admin, owner
 *   requireRole("admin")     -> admin, owner
 *   requireRole("owner")     -> owner only
 *
 * Keep this file and `frontend/src/lib/roles.ts` in sync — the frontend mirrors
 * the same ladder so the UI shows exactly what the API will allow.
 */

/** Every role, ordered from least to most privileged. */
export const USER_ROLES = ["user", "moderator", "admin", "owner"] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Ascending privilege — a higher number means more authority. */
export const ROLE_RANK: Record<UserRole, number> = {
  user: 0,
  moderator: 1,
  admin: 2,
  owner: 3,
};

/** Lowest role that may reach the admin area (overview, users, interviews). */
export const ADMIN_AREA_MIN_ROLE: UserRole = "moderator";

/** Lowest role that may change another user's role. */
export const ROLE_MANAGEMENT_MIN_ROLE: UserRole = "admin";

/** Roles that reach the admin area, most privileged first. */
export const ADMIN_AREA_ROLES: readonly UserRole[] = [...USER_ROLES]
  .filter((role) => ROLE_RANK[role] >= ROLE_RANK[ADMIN_AREA_MIN_ROLE])
  .reverse();

/** Human-readable ladder for error messages: `owner > admin > moderator > user`. */
export const ROLE_LADDER = [...USER_ROLES].reverse().join(" > ");

/**
 * Rank of a role, or `-1` when the value is missing or not a known role.
 * An unknown role therefore never satisfies a minimum-role check.
 */
export function getRoleRank(role: string | null | undefined): number {
  if (!role) return -1;
  return Object.prototype.hasOwnProperty.call(ROLE_RANK, role)
    ? ROLE_RANK[role as UserRole]
    : -1;
}

/** Type guard for a valid role string. */
export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}

/** True when `role` sits at or above `minRole` in the hierarchy. */
export function hasRoleAtLeast(
  role: string | null | undefined,
  minRole: UserRole
): boolean {
  return getRoleRank(role) >= ROLE_RANK[minRole];
}

/**
 * True when `actorRole` outranks `targetRole`.
 * Only the owner (apex) is allowed to act on a peer; see `admin.service`.
 */
export function outranks(
  actorRole: string | null | undefined,
  targetRole: string | null | undefined
): boolean {
  return getRoleRank(actorRole) > getRoleRank(targetRole);
}
