'use client';

/**
 * FINVANTA CBS — User Management (Admin).
 *
 * Operator accounts are provisioned by admins under maker-checker
 * governance per RBI Master Direction on IT Governance 2023 §8.
 * There is no self-registration. Password resets are admin-initiated.
 *
 * Each user is assigned:
 *   - A branch (SOL ID) — determines data isolation
 *   - One or more roles (MAKER/CHECKER/ADMIN/AUDITOR/VIEWER)
 *   - Optional MFA enrollment
 */

import { StatusRibbon } from '@/components/cbs';
import Link from 'next/link';

const DEMO_USERS = [
  { username: 'maker1', name: 'Rajesh Kumar', role: 'MAKER', branch: 'HQ001', status: 'ACTIVE' as const, lastLogin: '19-APR-2026 09:15' },
  { username: 'maker2', name: 'Priya Sharma', role: 'MAKER', branch: 'DEL001', status: 'ACTIVE' as const, lastLogin: '19-APR-2026 08:45' },
  { username: 'checker1', name: 'Amit Patel', role: 'CHECKER', branch: 'HQ001', status: 'ACTIVE' as const, lastLogin: '19-APR-2026 09:30' },
  { username: 'checker2', name: 'Sunita Reddy', role: 'CHECKER', branch: 'DEL001', status: 'ACTIVE' as const, lastLogin: '18-APR-2026 17:20' },
  { username: 'admin', name: 'Vikram Singh', role: 'ADMIN_HO', branch: 'HQ001', status: 'ACTIVE' as const, lastLogin: '19-APR-2026 10:00' },
  { username: 'auditor1', name: 'Meera Nair', role: 'AUDITOR', branch: 'HQ001', status: 'ACTIVE' as const, lastLogin: '17-APR-2026 14:30' },
];

export default function UserManagementPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-cbs-ink">User Management</h1>
          <p className="text-xs text-cbs-steel-600 mt-0.5">
            Operator provisioning under maker-checker governance.
            No self-registration per RBI IT Governance Direction 2023.
          </p>
        </div>
        <Link href="/legacy/admin/users/new" className="cbs-btn cbs-btn-primary">
          + New Operator
        </Link>
      </div>

      {/* User List */}
      <section className="cbs-surface">
        <div className="cbs-surface-header">
          <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
            Operators
          </span>
          <span className="text-xs text-cbs-steel-500 cbs-tabular">
            {DEMO_USERS.length} users
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="cbs-grid-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name</th>
                <th>Role</th>
                <th>Branch</th>
                <th>Last Login</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_USERS.map((u) => (
                <tr key={u.username}>
                  <td className="cbs-tabular font-semibold text-cbs-navy-700">{u.username}</td>
                  <td className="text-cbs-ink font-medium">{u.name}</td>
                  <td>
                    <span className={`cbs-ribbon ${
                      u.role === 'MAKER' ? 'text-cbs-violet-700 bg-cbs-violet-50 border-cbs-violet-600' :
                      u.role === 'CHECKER' ? 'text-cbs-navy-700 bg-cbs-navy-50 border-cbs-navy-200' :
                      u.role === 'ADMIN_HO' ? 'text-cbs-crimson-700 bg-cbs-crimson-50 border-cbs-crimson-600' :
                      'text-cbs-steel-700 bg-cbs-mist border-cbs-steel-300'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="cbs-tabular text-cbs-steel-700">{u.branch}</td>
                  <td className="cbs-tabular text-xs text-cbs-steel-600">{u.lastLogin}</td>
                  <td>
                    <StatusRibbon status={u.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}