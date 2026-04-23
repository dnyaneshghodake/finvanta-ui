'use client';

/**
 * FINVANTA CBS — Branch Management (Admin).
 *
 * Branches are the operational units of the bank. Each branch has a
 * unique SOL ID (branch code), belongs to a tenant, and has its own
 * GL sub-ledger. Operators are assigned to branches at user creation.
 *
 * The BFF injects X-Branch-Code from the session on every API call —
 * the browser cannot override branch context. HO operators can switch
 * branches via the session/switch-branch endpoint.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { Breadcrumb, StatusRibbon, CbsTableSkeleton } from '@/components/cbs';
import { AdminPageGuard } from '@/components/atoms';
import { useUIStore } from '@/store/uiStore';
import { branchService } from '@/services/api/adminService';
import { useCbsKeyboard } from '@/hooks/useCbsKeyboard';
import type { Branch } from '@/types/entities';
import { Search } from 'lucide-react';

export default function BranchManagementPage() {
  const user = useAuthStore((s) => s.user);
  const currentBranch = user?.branchCode || '';
  const { addToast } = useUIStore();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const loadBranches = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await branchService.list({ page: 0, size: 100 });
      if (res.success && res.data) {
        setBranches(res.data.items);
        setTotal(res.data.total);
      } else { setBranches([]); setTotal(0); }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to load branches', duration: 3000 });
      setBranches([]);
    } finally { setIsLoading(false); }
  }, [addToast]);

  // `loadBranches` starts with `setIsLoading(true)` which React
  // Compiler flags as set-state-in-effect. This is the standard
  // fetch-on-mount pattern; the lint rule is overly strict here.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadBranches(); }, [loadBranches]);

  // CBS keyboard shortcuts: F3 = Focus search, F5 = Refresh list
  const shortcuts = useMemo(() => ({
    F3: () => { searchRef.current?.focus(); },
    F5: () => { void loadBranches(); },
  }), [loadBranches]);
  useCbsKeyboard(shortcuts);

  const filtered = search
    ? branches.filter((b) =>
        b.branchCode.toLowerCase().includes(search.toLowerCase()) ||
        b.branchName.toLowerCase().includes(search.toLowerCase()) ||
        b.city.toLowerCase().includes(search.toLowerCase()))
    : branches;

  const TYPE_LABEL: Record<string, string> = {
    HEAD_OFFICE: 'Head Office', REGIONAL_OFFICE: 'Regional Office',
    BRANCH: 'Branch', EXTENSION_COUNTER: 'Extension Counter',
  };

  return (
    <AdminPageGuard>
      <div className="space-y-4">
        <Breadcrumb items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Administration' },
          { label: 'Branch Management' },
        ]} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-cbs-ink">Branch Management</h1>
            <p className="text-xs text-cbs-steel-600 mt-0.5">
              Manage bank branches, SOL IDs, and IFSC codes. Each branch
              operates as an independent operational unit with its own GL.
            </p>
          </div>
          <Link href="/legacy/admin/branch/new" className="cbs-btn cbs-btn-primary">
            + New Branch
          </Link>
        </div>

        {/* Search */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cbs-steel-400" />
            <input ref={searchRef} type="text" placeholder="Search branch code, name, or city… (F3)" value={search}
              onChange={(e) => setSearch(e.target.value)} className="cbs-input pl-8 w-full" />
          </div>
        </div>

        {isLoading ? <CbsTableSkeleton rows={5} /> : filtered.length === 0 ? (
          <section className="cbs-surface text-center py-10">
            <h3 className="text-sm font-semibold text-cbs-ink">No Branches Found</h3>
            <p className="text-xs text-cbs-steel-600 mt-1">
              {search ? 'No results match your search.' : 'No branches configured yet.'}
            </p>
          </section>
        ) : (
          <section className="cbs-surface">
            <div className="cbs-surface-header">
              <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">All Branches</span>
              <span className="text-xs text-cbs-steel-500 cbs-tabular">{filtered.length} of {total} branches</span>
            </div>
            <div className="overflow-x-auto">
              <table className="cbs-grid-table">
                <thead>
                  <tr>
                    <th>Branch Code</th><th>Branch Name</th><th>IFSC</th>
                    <th>City</th><th>State</th><th>Type</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <span className="cbs-tabular font-semibold text-cbs-navy-700">
                          {b.branchCode}
                          {b.branchCode === currentBranch && (
                            <span className="ml-1.5 text-[10px] text-cbs-olive-700 font-normal">(current)</span>
                          )}
                        </span>
                      </td>
                      <td className="text-cbs-ink font-medium">{b.branchName}</td>
                      <td className="cbs-tabular text-cbs-steel-700">{b.ifscCode}</td>
                      <td>{b.city}</td>
                      <td>{b.state}</td>
                      <td><span className="text-xs text-cbs-steel-600">{TYPE_LABEL[b.type] || b.type}</span></td>
                      <td><StatusRibbon status={b.status} /></td>
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