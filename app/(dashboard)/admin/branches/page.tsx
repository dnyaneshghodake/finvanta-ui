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

import { useAuthStore } from '@/store/authStore';
import { KeyValue, StatusRibbon } from '@/components/cbs';
import Link from 'next/link';

const DEMO_BRANCHES = [
  { code: 'HQ001', name: 'Head Office', city: 'Mumbai', state: 'Maharashtra', status: 'ACTIVE' as const, ifsc: 'FVNT0HQ0001', type: 'Head Office' },
  { code: 'DEL001', name: 'New Delhi Main', city: 'New Delhi', state: 'Delhi', status: 'ACTIVE' as const, ifsc: 'FVNT0DEL001', type: 'Branch' },
  { code: 'BLR001', name: 'Bangalore MG Road', city: 'Bangalore', state: 'Karnataka', status: 'ACTIVE' as const, ifsc: 'FVNT0BLR001', type: 'Branch' },
  { code: 'CHN001', name: 'Chennai Anna Nagar', city: 'Chennai', state: 'Tamil Nadu', status: 'ACTIVE' as const, ifsc: 'FVNT0CHN001', type: 'Branch' },
];

export default function BranchManagementPage() {
  const user = useAuthStore((s) => s.user);
  const currentBranch = user?.branchCode || 'HQ001';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-cbs-ink">Branch Management</h1>
          <p className="text-xs text-cbs-steel-600 mt-0.5">
            Manage bank branches, SOL IDs, and IFSC codes. Each branch
            operates as an independent operational unit with its own GL.
          </p>
        </div>
        <Link href="/legacy/admin/branch/new" className="cbs-btn cbs-btn-primary">
          + New Branch
        </Link>
      </div>

      {/* Branch List */}
      <section className="cbs-surface">
        <div className="cbs-surface-header">
          <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
            All Branches
          </span>
          <span className="text-xs text-cbs-steel-500 cbs-tabular">
            {DEMO_BRANCHES.length} branches
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="cbs-grid-table">
            <thead>
              <tr>
                <th>Branch Code</th>
                <th>Branch Name</th>
                <th>IFSC</th>
                <th>City</th>
                <th>State</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_BRANCHES.map((b) => (
                <tr key={b.code}>
                  <td>
                    <span className="cbs-tabular font-semibold text-cbs-navy-700">
                      {b.code}
                      {b.code === currentBranch && (
                        <span className="ml-1.5 text-[10px] text-cbs-olive-700 font-normal">(current)</span>
                      )}
                    </span>
                  </td>
                  <td className="text-cbs-ink font-medium">{b.name}</td>
                  <td className="cbs-tabular text-cbs-steel-700">{b.ifsc}</td>
                  <td>{b.city}</td>
                  <td>{b.state}</td>
                  <td>
                    <span className="text-xs text-cbs-steel-600">{b.type}</span>
                  </td>
                  <td>
                    <StatusRibbon status={b.status} />
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