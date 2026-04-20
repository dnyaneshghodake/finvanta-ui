/**
 * Role guard unit tests — access control validation.
 * @file src/security/__tests__/roleGuard.test.ts
 *
 * Per RBI IT Governance Direction 2023 §8.1: maker-checker separation,
 * self-approval prevention, and role-based access control MUST have
 * automated regression tests. These tests validate the UI-side guards
 * that control button/page visibility. The backend independently
 * enforces the same rules — these are defence-in-depth.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import {
  hasRole,
  hasAllRoles,
  hasPermission,
  hasModuleAccess,
  isMaker,
  isChecker,
  isHOAdmin,
  isAuditor,
  canApprove,
} from '../roleGuard';

// ── Test helpers ───────────────────────────────────────────────────

function setUser(overrides: Partial<Parameters<typeof useAuthStore.setState>[0]> & {
  user?: Partial<import('@/types/entities').User> | null;
}) {
  useAuthStore.setState({
    isAuthenticated: true,
    user: overrides.user === null ? null : {
      username: 'testuser',
      roles: [],
      ...overrides.user,
    } as import('@/types/entities').User,
  });
}

function clearUser() {
  useAuthStore.setState({
    isAuthenticated: false,
    user: null,
  });
}

// ── hasRole ────────────────────────────────────────────────────────

describe('hasRole', () => {
  beforeEach(clearUser);

  it('returns false when no user is authenticated', () => {
    expect(hasRole('MAKER')).toBe(false);
  });

  it('returns true when user has the role', () => {
    setUser({ user: { roles: ['MAKER', 'TELLER'] } });
    expect(hasRole('MAKER')).toBe(true);
  });

  it('returns true when user has ANY of the specified roles', () => {
    setUser({ user: { roles: ['CHECKER'] } });
    expect(hasRole('MAKER', 'CHECKER')).toBe(true);
  });

  it('returns false when user has none of the specified roles', () => {
    setUser({ user: { roles: ['AUDITOR'] } });
    expect(hasRole('MAKER', 'CHECKER')).toBe(false);
  });
});

// ── hasAllRoles ────────────────────────────────────────────────────

describe('hasAllRoles', () => {
  beforeEach(clearUser);

  it('returns false when no user', () => {
    expect(hasAllRoles('MAKER', 'CHECKER')).toBe(false);
  });

  it('returns true when user has ALL roles', () => {
    setUser({ user: { roles: ['MAKER', 'CHECKER', 'ADMIN'] } });
    expect(hasAllRoles('MAKER', 'CHECKER')).toBe(true);
  });

  it('returns false when user is missing one role', () => {
    setUser({ user: { roles: ['MAKER'] } });
    expect(hasAllRoles('MAKER', 'CHECKER')).toBe(false);
  });
});

// ── hasPermission ──────────────────────────────────────────────────

describe('hasPermission', () => {
  beforeEach(clearUser);

  it('returns false when no user', () => {
    expect(hasPermission('DEPOSIT_CREATE')).toBe(false);
  });

  it('checks flat permissions array', () => {
    setUser({ user: { roles: ['MAKER'], permissions: ['DEPOSIT_CREATE', 'DEPOSIT_VIEW'] } });
    expect(hasPermission('DEPOSIT_CREATE')).toBe(true);
    expect(hasPermission('LOAN_CREATE')).toBe(false);
  });

  it('checks permissionsByModule map', () => {
    setUser({
      user: {
        roles: ['MAKER'],
        permissionsByModule: {
          DEPOSIT: ['DEPOSIT_CREATE', 'DEPOSIT_VIEW'],
          LOAN: ['LOAN_VIEW'],
        },
      },
    });
    expect(hasPermission('DEPOSIT_CREATE')).toBe(true);
    expect(hasPermission('LOAN_VIEW')).toBe(true);
    expect(hasPermission('LOAN_CREATE')).toBe(false);
  });

  it('prefers flat array when both are present', () => {
    setUser({
      user: {
        roles: ['MAKER'],
        permissions: ['DEPOSIT_CREATE'],
        permissionsByModule: { LOAN: ['LOAN_CREATE'] },
      },
    });
    expect(hasPermission('DEPOSIT_CREATE')).toBe(true);
    expect(hasPermission('LOAN_CREATE')).toBe(true);
  });
});

// ── hasModuleAccess (fail-closed) ──────────────────────────────────

describe('hasModuleAccess', () => {
  beforeEach(clearUser);

  it('returns false when no user', () => {
    expect(hasModuleAccess('DEPOSIT')).toBe(false);
  });

  it('returns false when allowedModules is absent (fail-closed)', () => {
    setUser({ user: { roles: ['MAKER'] } });
    expect(hasModuleAccess('DEPOSIT')).toBe(false);
  });

  it('returns false when allowedModules is empty (fail-closed)', () => {
    setUser({ user: { roles: ['MAKER'], allowedModules: [] } });
    expect(hasModuleAccess('DEPOSIT')).toBe(false);
  });

  it('returns true when module is in allowedModules', () => {
    setUser({ user: { roles: ['MAKER'], allowedModules: ['DEPOSIT', 'LOAN'] } });
    expect(hasModuleAccess('DEPOSIT')).toBe(true);
    expect(hasModuleAccess('CLEARING')).toBe(false);
  });
});

// ── isMaker / isChecker ────────────────────────────────────────────

describe('isMaker', () => {
  beforeEach(clearUser);

  it('returns true for MAKER role', () => {
    setUser({ user: { roles: ['MAKER'] } });
    expect(isMaker()).toBe(true);
  });

  it('returns true for TELLER role', () => {
    setUser({ user: { roles: ['TELLER'] } });
    expect(isMaker()).toBe(true);
  });

  it('returns true when makerCheckerRole is MAKER', () => {
    setUser({ user: { roles: [], makerCheckerRole: 'MAKER' } });
    expect(isMaker()).toBe(true);
  });

  it('returns true when makerCheckerRole is BOTH', () => {
    setUser({ user: { roles: [], makerCheckerRole: 'BOTH' } });
    expect(isMaker()).toBe(true);
  });

  it('returns false for CHECKER-only user', () => {
    setUser({ user: { roles: ['CHECKER'] } });
    expect(isMaker()).toBe(false);
  });
});

describe('isChecker', () => {
  beforeEach(clearUser);

  it('returns true for CHECKER role', () => {
    setUser({ user: { roles: ['CHECKER'] } });
    expect(isChecker()).toBe(true);
  });

  it('returns true for MANAGER role', () => {
    setUser({ user: { roles: ['MANAGER'] } });
    expect(isChecker()).toBe(true);
  });

  it('returns true when makerCheckerRole is BOTH', () => {
    setUser({ user: { roles: [], makerCheckerRole: 'BOTH' } });
    expect(isChecker()).toBe(true);
  });

  it('returns false for MAKER-only user', () => {
    setUser({ user: { roles: ['MAKER'] } });
    expect(isChecker()).toBe(false);
  });
});

// ── Self-approval prevention (RBI mandate) ─────────────────────────

describe('canApprove', () => {
  beforeEach(clearUser);

  it('returns false when no user', () => {
    expect(canApprove('1')).toBe(false);
  });

  it('returns false when user has no id (fail-safe)', () => {
    setUser({ user: { roles: ['CHECKER'] } });
    expect(canApprove('1')).toBe(false);
  });

  it('blocks self-approval (same user ID)', () => {
    setUser({ user: { id: 1, roles: ['CHECKER'] } });
    expect(canApprove('1')).toBe(false);
  });

  it('blocks self-approval with string/number coercion', () => {
    // Spring returns id as number, workflow JSON has string
    setUser({ user: { id: 42, roles: ['CHECKER'] } });
    expect(canApprove('42')).toBe(false);
  });

  it('allows approval by different checker', () => {
    setUser({ user: { id: 2, roles: ['CHECKER'] } });
    expect(canApprove('1')).toBe(true);
  });

  it('returns false for maker trying to approve', () => {
    setUser({ user: { id: 2, roles: ['MAKER'] } });
    expect(canApprove('1')).toBe(false);
  });
});

// ── Convenience role checks ────────────────────────────────────────

describe('isHOAdmin', () => {
  beforeEach(clearUser);

  it('returns true for ADMIN_HO', () => {
    setUser({ user: { roles: ['ADMIN_HO'] } });
    expect(isHOAdmin()).toBe(true);
  });

  it('returns false for branch admin', () => {
    setUser({ user: { roles: ['BRANCH_ADMIN'] } });
    expect(isHOAdmin()).toBe(false);
  });
});

describe('isAuditor', () => {
  beforeEach(clearUser);

  it('returns true for AUDITOR', () => {
    setUser({ user: { roles: ['AUDITOR'] } });
    expect(isAuditor()).toBe(true);
  });

  it('returns false for non-auditor', () => {
    setUser({ user: { roles: ['MAKER'] } });
    expect(isAuditor()).toBe(false);
  });
});
