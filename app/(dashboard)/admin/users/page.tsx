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

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { Breadcrumb, StatusRibbon, CbsTableSkeleton } from '@/components/cbs';
import { AdminPageGuard } from '@/components/atoms';
import { useUIStore } from '@/store/uiStore';
import { operatorService } from '@/services/api/adminService';
import { formatCbsTimestamp } from '@/utils/formatters';
import { useCbsKeyboard } from '@/hooks/useCbsKeyboard';
import type { Operator } from '@/types/entities';
import { ShieldCheck, Lock, Unlock, KeyRound, Search } from 'lucide-react';

const ROLE_TONE: Record<string, string> = {
  MAKER: 'text-cbs-violet-700 bg-cbs-violet-50 border-cbs-violet-600',
  TELLER: 'text-cbs-violet-700 bg-cbs-violet-50 border-cbs-violet-600',
  CHECKER: 'text-cbs-navy-700 bg-cbs-navy-50 border-cbs-navy-200',
  MANAGER: 'text-cbs-navy-700 bg-cbs-navy-50 border-cbs-navy-200',
  ADMIN_HO: 'text-cbs-crimson-700 bg-cbs-crimson-50 border-cbs-crimson-600',
  AUDITOR: 'text-cbs-gold-700 bg-cbs-gold-50 border-cbs-gold-600',
};
const DEFAULT_TONE = 'text-cbs-steel-700 bg-cbs-mist border-cbs-steel-300';

export default function UserManagementPage() {
  const { addToast } = useUIStore();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const loadOperators = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await operatorService.list({
        page: 0, size: 50,
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      if (res.success && res.data) {
        setOperators(res.data.items);
        setTotal(res.data.total);
      } else { setOperators([]); setTotal(0); }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to load operators', duration: 3000 });
      setOperators([]);
    } finally { setIsLoading(false); }
  }, [addToast, statusFilter]);

  // Standard fetch-on-mount: `loadOperators` calls `setIsLoading(true)`.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadOperators(); }, [loadOperators]);

  const handleToggleLock = async (op: Operator) => {
    const lock = op.status === 'ACTIVE';
    try {
      const res = await operatorService.toggleLock(op.id, lock);
      if (res.success) {
        addToast({ type: 'success', title: 'Success', message: `${op.username} ${lock ? 'locked' : 'unlocked'}`, duration: 3000 });
        void loadOperators();
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Operation failed', duration: 3000 });
    }
  };

  const handleResetPassword = async (op: Operator) => {
    try {
      const res = await operatorService.resetPassword(op.id);
      if (res.success) {
        addToast({ type: 'success', title: 'Password Reset', message: `Temporary password issued for ${op.username}.`, duration: 6000 });
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Password reset failed', duration: 3000 });
    }
  };

  // CBS keyboard shortcuts: F3 = Focus search, F5 = Refresh list
  const shortcuts = useMemo(() => ({
    F3: () => { searchRef.current?.focus(); },
    F5: () => { void loadOperators(); },
  }), [loadOperators]);
  useCbsKeyboard(shortcuts);

  const filtered = search
    ? operators.filter((o) =>
        o.username.toLowerCase().includes(search.toLowerCase()) ||
        (o.displayName || '').toLowerCase().includes(search.toLowerCase()) ||
        o.branchCode.toLowerCase().includes(search.toLowerCase()))
    : operators;

  return (
    <AdminPageGuard>
      <div className="space-y-4">
        <Breadcrumb items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Administration' },
          { label: 'User Management' },
        ]} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-cbs-ink">User Management</h1>
            <p className="text-xs text-cbs-steel-600 mt-0.5">
              Operator provisioning under maker-checker governance.
              No self-registration per RBI IT Governance Direction 2023.
            </p>
          </div>
          <Link href="/legacy/admin/users/new" className="cbs-btn cbs-btn-primary">
            + New Operator
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cbs-steel-400" />
            <input ref={searchRef} type="text" placeholder="Search user ID, name, or branch… (F3)" value={search}
              onChange={(e) => setSearch(e.target.value)} className="cbs-input pl-8 w-full" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="cbs-input w-auto">
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="LOCKED">Locked</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </div>

        {isLoading ? <CbsTableSkeleton rows={6} /> : filtered.length === 0 ? (
          <section className="cbs-surface text-center py-10">
            <h3 className="text-sm font-semibold text-cbs-ink">No Operators Found</h3>
            <p className="text-xs text-cbs-steel-600 mt-1">
              {search ? 'No results match your search.' : 'No operator accounts provisioned yet.'}
            </p>
          </section>
        ) : (
          <section className="cbs-surface">
            <div className="cbs-surface-header">
              <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">Operators</span>
              <span className="text-xs text-cbs-steel-500 cbs-tabular">{filtered.length} of {total} users</span>
            </div>
            <div className="overflow-x-auto">
              <table className="cbs-grid-table">
                <thead>
                  <tr>
                    <th>User ID</th><th>Name</th><th>Role(s)</th><th>Branch</th>
                    <th>MFA</th><th>Last Login</th><th>Status</th><th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((op) => (
                    <tr key={op.id}>
                      <td className="cbs-tabular font-semibold text-cbs-navy-700">{op.username}</td>
                      <td className="text-cbs-ink font-medium">
                        {op.displayName || [op.firstName, op.lastName].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {op.roles.map((r) => (
                            <span key={r} className={`cbs-ribbon ${ROLE_TONE[r] || DEFAULT_TONE}`}>{r}</span>
                          ))}
                        </div>
                      </td>
                      <td className="cbs-tabular text-cbs-steel-700">{op.branchCode}</td>
                      <td>{op.mfaEnrolled
                        ? <ShieldCheck size={14} className="text-cbs-olive-700" aria-label="MFA enrolled" />
                        : <span className="text-[10px] text-cbs-steel-400">OFF</span>}
                      </td>
                      <td className="cbs-tabular text-xs text-cbs-steel-600">
                        {op.lastLoginAt ? formatCbsTimestamp(op.lastLoginAt) : '—'}
                      </td>
                      <td><StatusRibbon status={op.status} /></td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => void handleToggleLock(op)}
                            className="p-1.5 rounded hover:bg-cbs-mist" title={op.status === 'ACTIVE' ? 'Lock' : 'Unlock'}>
                            {op.status === 'LOCKED'
                              ? <Unlock size={14} className="text-cbs-olive-700" />
                              : <Lock size={14} className="text-cbs-crimson-700" />}
                          </button>
                          <button type="button" onClick={() => void handleResetPassword(op)}
                            className="p-1.5 rounded hover:bg-cbs-mist" title="Reset password">
                            <KeyRound size={14} className="text-cbs-steel-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </AdminPageGuard>
  );
}