/**
 * Role-based rendering gate for CBS Banking Application
 * @file src/components/atoms/RoleGate.tsx
 *
 * Zero Trust: this component only controls UI visibility.
 * The backend MUST independently verify roles/permissions.
 *
 * Usage:
 *   <RoleGate roles={['MANAGER', 'ADMIN_HO']}>
 *     <ApproveButton />
 *   </RoleGate>
 *
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
  /** Optional fallback when access is denied */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

const RoleGate: React.FC<RoleGateProps> = ({
  roles,
  requireAll = false,
  fallback = null,
  children,
}) => {
  const user = useAuthStore((state) => state.user);

  if (!user || !user.roles) {
    return <>{fallback}</>;
  }

  const hasAccess = requireAll
    ? roles.every((role) => user.roles.includes(role))
    : roles.some((role) => user.roles.includes(role));

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

RoleGate.displayName = 'RoleGate';

export { RoleGate };
