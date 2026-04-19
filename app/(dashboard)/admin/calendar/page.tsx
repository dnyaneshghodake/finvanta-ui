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

import { StatusRibbon, KeyValue } from '@/components/cbs';
import Link from 'next/link';

const CURRENT_YEAR = new Date().getFullYear();

const DEMO_HOLIDAYS = [
  { date: '26-JAN-' + CURRENT_YEAR, name: 'Republic Day', type: 'National', scope: 'All Branches' },
  { date: '14-APR-' + CURRENT_YEAR, name: 'Dr. Ambedkar Jayanti', type: 'National', scope: 'All Branches' },
  { date: '01-MAY-' + CURRENT_YEAR, name: 'Maharashtra Day', type: 'State', scope: 'Maharashtra' },
  { date: '15-AUG-' + CURRENT_YEAR, name: 'Independence Day', type: 'National', scope: 'All Branches' },
  { date: '02-OCT-' + CURRENT_YEAR, name: 'Gandhi Jayanti', type: 'National', scope: 'All Branches' },
  { date: '01-NOV-' + CURRENT_YEAR, name: 'Karnataka Rajyotsava', type: 'State', scope: 'Karnataka' },
  { date: '25-DEC-' + CURRENT_YEAR, name: 'Christmas', type: 'National', scope: 'All Branches' },
];

export default function CalendarPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-cbs-ink">Calendar & Holidays</h1>
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
            <span className="cbs-tabular font-semibold">{DEMO_HOLIDAYS.length}</span>
          </KeyValue>
          <KeyValue label="Working Days">
            <span className="cbs-tabular font-semibold">~245</span>
          </KeyValue>
        </div>
      </section>

      {/* Holiday List */}
      <section className="cbs-surface">
        <div className="cbs-surface-header">
          <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
            Holiday Calendar — {CURRENT_YEAR}
          </span>
          <span className="text-xs text-cbs-steel-500 cbs-tabular">
            {DEMO_HOLIDAYS.length} holidays
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="cbs-grid-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Holiday Name</th>
                <th>Type</th>
                <th>Scope</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_HOLIDAYS.map((h) => (
                <tr key={h.date}>
                  <td className="cbs-tabular font-medium text-cbs-ink">{h.date}</td>
                  <td className="text-cbs-ink font-medium">{h.name}</td>
                  <td>
                    <span className={`cbs-ribbon ${
                      h.type === 'National'
                        ? 'text-cbs-crimson-700 bg-cbs-crimson-50 border-cbs-crimson-600'
                        : 'text-cbs-gold-700 bg-cbs-gold-50 border-cbs-gold-600'
                    }`}>
                      {h.type}
                    </span>
                  </td>
                  <td className="text-xs text-cbs-steel-600">{h.scope}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}