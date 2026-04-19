/**
 * Page-level admin role guard for CBS admin routes.
 * @file src/components/atoms/AdminPageGuard.tsx
 *
 * Wraps admin pages (/admin/**) to enforce ADMIN_HO or BRANCH_ADMIN
 * role before rendering content. Without this, any authenticated user
 * can access admin pages by typing the URL directly — the sidebar
 * only hides the nav link, not the route.
 *
 * Zero Trust: this is UI-only defence-in-depth. The backend MUST
 * independently verify roles on every admin API call.
 */

'use client';

import React from 'react';
import Link from 'next/link';
import type { UserRole } from '@/types/entities';
import { useAuthStore } from '@/store/authStore';
import { ShieldAlert } from 'lucide-react';

const ADMIN_ROLES: UserRole[] = ['ADMIN_HO', 'BRANCH_ADMIN'];

export interface AdminPageGuardProps {
  /** Override the default admin roles if a page needs stricter gating. */
  roles?: UserRole[];
  children: React.ReactNode;
}

const AdminPageGuard: React.FC<AdminPageGuardProps> = ({
  roles = ADMIN_ROLES,
  children,
}) => {
  const user = useAuthStore((state) => state.user);
  const userRoles = user?.roles ?? [];

  const hasAccess = roles.some((r) => userRoles.includes(r));

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <ShieldAlert size={48} strokeWidth={1.5} className="text-cbs-crimson-600" />
        <h1 className="text-lg font-semibold text-cbs-ink">Access Denied</h1>
        <p className="text-sm text-cbs-steel-600 text-center max-w-md">
          You do not have the required role to access this administration
          page. Contact your Head Office administrator if you believe
          this is an error.
        </p>
        <Link href="/dashboard" className="cbs-btn cbs-btn-secondary mt-2">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
};

AdminPageGuard.displayName = 'AdminPageGuard';

export { AdminPageGuard };
