import { describe, it, expect } from 'vitest';
import {
  ADMIN_AREA_MIN_ROLE,
  ADMIN_AREA_ROLES,
  ROLE_LADDER,
  ROLE_LABELS,
  ROLE_RANK,
  USER_ROLES,
  canAccessAdmin,
  canManageRoles,
  getRoleRank,
  outranks,
} from '@/lib/roles';

describe('role hierarchy (user < moderator < admin < owner)', () => {
  it('orders roles from least to most privileged', () => {
    expect(USER_ROLES).toEqual(['user', 'moderator', 'admin', 'owner']);
    expect(ROLE_LADDER).toBe('owner > admin > moderator > user');
  });

  it('ranks owner above admin above moderator above user', () => {
    expect(ROLE_RANK.owner).toBeGreaterThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeGreaterThan(ROLE_RANK.moderator);
    expect(ROLE_RANK.moderator).toBeGreaterThan(ROLE_RANK.user);
  });

  it('exposes every role label', () => {
    expect(ROLE_LABELS).toEqual({
      user: 'User',
      moderator: 'Moderator',
      admin: 'Admin',
      owner: 'Owner',
    });
  });
});

describe('canAccessAdmin', () => {
  it('admits moderator, admin and owner', () => {
    expect(canAccessAdmin('moderator')).toBe(true);
    expect(canAccessAdmin('admin')).toBe(true);
    expect(canAccessAdmin('owner')).toBe(true);
  });

  it('rejects a plain user', () => {
    expect(canAccessAdmin('user')).toBe(false);
  });

  it('rejects missing or unknown roles', () => {
    expect(canAccessAdmin(undefined)).toBe(false);
    expect(canAccessAdmin(null)).toBe(false);
    expect(canAccessAdmin('')).toBe(false);
    expect(canAccessAdmin('superadmin')).toBe(false);
  });
});

describe('canManageRoles', () => {
  it('is true only for admin and owner', () => {
    expect(canManageRoles('admin')).toBe(true);
    expect(canManageRoles('owner')).toBe(true);
    expect(canManageRoles('moderator')).toBe(false);
    expect(canManageRoles('user')).toBe(false);
    expect(canManageRoles(undefined)).toBe(false);
  });
});

describe('outranks', () => {
  it('is true for strictly higher roles only', () => {
    expect(outranks('owner', 'admin')).toBe(true);
    expect(outranks('admin', 'moderator')).toBe(true);
    expect(outranks('moderator', 'user')).toBe(true);
  });

  it('is false for peers, lower roles, and unknown actors', () => {
    expect(outranks('owner', 'owner')).toBe(false);
    expect(outranks('admin', 'owner')).toBe(false);
    expect(outranks(undefined, 'user')).toBe(false);
  });
});

describe('getRoleRank', () => {
  it('returns -1 for unknown/nullish roles', () => {
    expect(getRoleRank(undefined)).toBe(-1);
    expect(getRoleRank('ghost')).toBe(-1);
  });

  it('admits every USER_ROLES entry above the moderator floor into the admin area', () => {
    // ADMIN_AREA_MIN_ROLE is the moderator floor; ADMIN_AREA_ROLES is ordered
    // most-privileged-first.
    expect(ADMIN_AREA_MIN_ROLE).toBe('moderator');
    expect(ADMIN_AREA_ROLES).toEqual(['owner', 'admin', 'moderator']);
    expect(ADMIN_AREA_ROLES.every((r) => canAccessAdmin(r))).toBe(true);
    expect(canAccessAdmin('user')).toBe(false);
  });
});
