/**
 * Role-based rendering gate for CBS Banking Application
 * @file src/components/atoms/RoleGate.tsx
 *
 * Zero Trust: this component only controls UI visibility.
 * The backend MUST independently verify roles/permissions.
 *
 * §9 Compliance: This component accepts `userRoles` as an optional
 * prop so it can be used as a pure, store-free atom in the component
 * library. When `userRoles` is not provided, it falls back to
 * reading from `useAuthStore` for backward compatibility with
 * existing application code.
 *
 * Usage (preferred — pure, no store dependency):
 *   <RoleGate roles={['MANAGER', 'ADMIN_HO']} userRoles={currentUser.roles}>
 *     <ApproveButton />
 *   </RoleGate>
 *
 * Usage (legacy — reads from store):
 *   <RoleGate roles={['ADMIN_HO']} fallback={<AccessDenied />}>
 *     <AdminPanel />
 *   </RoleGate>
 */

'use client';

import React from 'react';
import { UserRole } from '@/types/entities';
import { useAuthStore } from '@/store/authStore';

export interface RoleGateProps {
  /** User must have at least ONE of these roles to see children */
  roles: UserRole[];
  /** If true, user must have ALL specified roles */
  requireAll?: boolean;
  /**
   * The current user's roles. When provided, the component is a
   * pure renderer with no store dependency (§9 compliant).
   * When omitted, falls back to useAuthStore for backward compat.
   */
  userRoles?: UserRole[];
  /** Optional fallback when access is denied */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

const RoleGate: React.FC<RoleGateProps> = ({
  roles,
  requireAll = false,
  userRoles: userRolesProp,
  fallback = null,
  children,
}) => {
  // §9: prefer prop-injected roles (pure). Fall back to store (legacy).
  const storeUser = useAuthStore((state) => state.user);
  const effectiveRoles = userRolesProp ?? storeUser?.roles;

  if (!effectiveRoles || effectiveRoles.length === 0) {
    return <>{fallback}</>;
  }

  const hasAccess = requireAll
    ? roles.every((role) => effectiveRoles.includes(role))
    : roles.some((role) => effectiveRoles.includes(role));

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

RoleGate.displayName = 'RoleGate';

export { RoleGate };
