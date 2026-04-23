'use client';

/**
 * FINVANTA CBS — Calendar & Holiday Management (Admin).
 *
 * The business calendar controls:
 *   - Which days are working days vs holidays
 *   - Value date defaulting (next working day if holiday)
 *   - Interest accrual periods
 *   - Clearing cycle scheduling
 *   - Day-open / day-close ceremony eligibility
 *
 * Per RBI guidelines, banks must observe national holidays, state
 * holidays (per branch location), and RBI-declared holidays.
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Breadcrumb, KeyValue, CbsTableSkeleton } from '@/components/cbs';
import { AdminPageGuard } from '@/components/atoms';
import { useUIStore } from '@/store/uiStore';
import { holidayService } from '@/services/api/adminService';
import { formatCbsDate } from '@/utils/formatters';
import type { Holiday } from '@/types/entities';

const CURRENT_YEAR = new Date().getFullYear();

const TYPE_TONE: Record<string, string> = {
  NATIONAL: 'text-cbs-crimson-700 bg-cbs-crimson-50 border-cbs-crimson-600',
  STATE: 'text-cbs-gold-700 bg-cbs-gold-50 border-cbs-gold-600',
  RBI: 'text-cbs-navy-700 bg-cbs-navy-50 border-cbs-navy-200',
  CUSTOM: 'text-cbs-steel-700 bg-cbs-mist border-cbs-steel-300',
};

export default function CalendarPage() {
  const { addToast } = useUIStore();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadHolidays = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await holidayService.list({ year: CURRENT_YEAR, page: 0, size: 100 });
      if (res.success && res.data) {
        setHolidays(res.data.items);
        setTotal(res.data.total);
      } else { setHolidays([]); setTotal(0); }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to load holidays', duration: 3000 });
      setHolidays([]);
    } finally { setIsLoading(false); }
  }, [addToast]);

  // `loadHolidays` opens with `setIsLoading(true)` — see the note on
  // the sibling /admin pages for the React Compiler exception.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadHolidays(); }, [loadHolidays]);

  const scopeLabel = (h: Holiday) => {
    if (h.scope === 'ALL_BRANCHES') return 'All Branches';
    if (h.scope === 'STATE' && h.stateCode) return h.stateCode;
    if (h.scope === 'BRANCH' && h.branchCode) return h.branchCode;
    return h.scope;
  };

  return (
    <AdminPageGuard>
      <div className="space-y-4">
        <Breadcrumb items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Administration' },
          { label: 'Calendar & Holidays' },
        ]} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-cbs-ink">Calendar & Holidays</h1>
            <p className="text-xs text-cbs-steel-600 mt-0.5">
              Business calendar configuration. Controls value date defaulting,
              interest accrual, and clearing cycle scheduling.
            </p>
          </div>
          <Link href="/legacy/calendar/holiday/new" className="cbs-btn cbs-btn-primary">
            + Add Holiday
          </Link>
        </div>

        {/* Calendar Configuration */}
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
              Calendar Configuration
            </span>
            <span className="cbs-tabular text-xs text-cbs-steel-500">
              FY {CURRENT_YEAR}-{(CURRENT_YEAR + 1).toString().slice(-2)}
            </span>
          </div>
          <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-4 gap-4">
            <KeyValue label="Financial Year">
              <span className="cbs-tabular">APR {CURRENT_YEAR} — MAR {CURRENT_YEAR + 1}</span>
            </KeyValue>
            <KeyValue label="Week-off Pattern">
              <span>Sun + 2nd/4th Sat</span>
            </KeyValue>
            <KeyValue label="Total Holidays">
              <span className="cbs-tabular font-semibold">{total}</span>
            </KeyValue>
            <KeyValue label="Working Days">
              <span className="cbs-tabular font-semibold">~{Math.max(245 - total, 200)}</span>
            </KeyValue>
          </div>
        </section>

        {/* Holiday List */}
        {isLoading ? <CbsTableSkeleton rows={5} /> : holidays.length === 0 ? (
          <section className="cbs-surface text-center py-10">
            <h3 className="text-sm font-semibold text-cbs-ink">No Holidays Configured</h3>
            <p className="text-xs text-cbs-steel-600 mt-1">
              Add national, state, and RBI holidays for FY {CURRENT_YEAR}.
            </p>
          </section>
        ) : (
          <section className="cbs-surface">
            <div className="cbs-surface-header">
              <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
                Holiday Calendar — {CURRENT_YEAR}
              </span>
              <span className="text-xs text-cbs-steel-500 cbs-tabular">{total} holidays</span>
            </div>
            <div className="overflow-x-auto">
              <table className="cbs-grid-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Holiday Name</th><th>Type</th><th>Scope</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((h) => (
                    <tr key={h.id}>
                      <td className="cbs-tabular font-medium text-cbs-ink">{formatCbsDate(h.date)}</td>
                      <td className="text-cbs-ink font-medium">{h.name}</td>
                      <td>
                        <span className={`cbs-ribbon ${TYPE_TONE[h.type] || TYPE_TONE.CUSTOM}`}>
                          {h.type}
                        </span>
                      </td>
                      <td className="text-xs text-cbs-steel-600">{scopeLabel(h)}</td>
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