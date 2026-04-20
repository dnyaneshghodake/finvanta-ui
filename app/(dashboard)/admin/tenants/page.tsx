'use client';

/**
 * FINVANTA CBS — Tenant Setup (Admin).
 *
 * The tenant is the top-level isolation boundary in a multi-tenant CBS.
 * Every branch, user, account, and GL entry belongs to exactly one tenant.
 * In a single-bank deployment, there is typically one tenant (DEFAULT).
 *
 * This screen displays the current tenant configuration from the
 * operator's session. Full tenant CRUD requires the Spring Admin API
 * which is not yet migrated to REST — the legacy bridge is linked
 * for management operations.
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Breadcrumb, KeyValue, CbsTableSkeleton } from '@/components/cbs';
import { AdminPageGuard } from '@/components/atoms';
import { useUIStore } from '@/store/uiStore';
import { tenantService } from '@/services/api/adminService';
import type { Tenant } from '@/types/entities';
import Link from 'next/link';

export default function TenantSetupPage() {
  const user = useAuthStore((s) => s.user);
  const sessionTenantId = user?.tenantId || 'DEFAULT';
  const { addToast } = useUIStore();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadTenant = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await tenantService.getCurrent();
      if (res.success && res.data) {
        setTenant(res.data);
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to load tenant configuration', duration: 3000 });
    } finally { setIsLoading(false); }
  }, [addToast]);

  useEffect(() => { void loadTenant(); }, [loadTenant]);

  const t = tenant;

  return (
    <AdminPageGuard>
      <div className="space-y-4">
        <Breadcrumb items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Administration' },
          { label: 'Tenant Setup' },
        ]} />

        <div>
          <h1 className="text-xl font-semibold text-cbs-ink">Tenant Setup</h1>
          <p className="text-xs text-cbs-steel-600 mt-0.5">
            Multi-tenant isolation configuration. Each tenant operates as an
            independent banking entity with its own branches, GL, and users.
          </p>
        </div>

        {isLoading ? <CbsTableSkeleton rows={3} /> : (
          <>
            {/* Current Tenant */}
            <section className="cbs-surface">
              <div className="cbs-surface-header">
                <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
                  Current Tenant
                </span>
                <span className="cbs-ribbon text-cbs-olive-700 bg-cbs-olive-50 border-cbs-olive-600">
                  {t?.status || 'ACTIVE'}
                </span>
              </div>
              <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-3 gap-4">
                <KeyValue label="Tenant ID">
                  <span className="cbs-tabular font-semibold">{t?.tenantId || sessionTenantId}</span>
                </KeyValue>
                <KeyValue label="Tenant Name">
                  <span>{t?.tenantName || 'FINVANTA Bank'}</span>
                </KeyValue>
                <KeyValue label="Country">
                  <span>{t?.country || 'India (IN)'}</span>
                </KeyValue>
                <KeyValue label="Base Currency">
                  <span className="cbs-tabular">{t?.baseCurrency || 'INR'}</span>
                </KeyValue>
                <KeyValue label="Regulatory Body">
                  <span>{t?.regulatoryBody || 'Reserve Bank of India (RBI)'}</span>
                </KeyValue>
                <KeyValue label="License Type">
                  <span>{t?.licenseType || 'Scheduled Commercial Bank'}</span>
                </KeyValue>
                {t?.branchCount !== undefined && (
                  <KeyValue label="Branches">
                    <span className="cbs-tabular font-semibold">{t.branchCount}</span>
                  </KeyValue>
                )}
                {t?.userCount !== undefined && (
                  <KeyValue label="Operators">
                    <span className="cbs-tabular font-semibold">{t.userCount}</span>
                  </KeyValue>
                )}
              </div>
            </section>

            {/* Tenant Configuration */}
            <section className="cbs-surface">
              <div className="cbs-surface-header">
                <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
                  Configuration
                </span>
              </div>
              <div className="cbs-surface-body grid grid-cols-1 md:grid-cols-3 gap-4">
                <KeyValue label="Financial Year Start">
                  <span className="cbs-tabular">{t?.financialYearStart || '01-APR'}</span>
                </KeyValue>
                <KeyValue label="Week-off Days">
                  <span>{t?.weekOffPattern || 'Sunday, 2nd & 4th Saturday'}</span>
                </KeyValue>
                <KeyValue label="Interest Calculation">
                  <span>{t?.interestCalculation || 'Actual/365'}</span>
                </KeyValue>
                <KeyValue label="Decimal Precision">
                  <span className="cbs-tabular">{t?.decimalPrecision ?? 2}</span>
                </KeyValue>
                <KeyValue label="Amount Rounding">
                  <span>{t?.amountRounding || 'Round Half Up'}</span>
                </KeyValue>
                <KeyValue label="PII Encryption">
                  <span className="cbs-ribbon text-cbs-olive-700 bg-cbs-olive-50 border-cbs-olive-600">
                    {t?.piiEncryption || 'AES-256-GCM'}
                  </span>
                </KeyValue>
              </div>
            </section>
          </>
        )}

        {/* Setup Navigation — CBS bank setup ceremony */}
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
              Bank Setup Steps
            </span>
          </div>
          <div className="cbs-surface-body flex flex-wrap gap-2">
            <span className="cbs-ribbon text-cbs-olive-700 bg-cbs-olive-50 border-cbs-olive-600">1. TENANT ✓</span>
            <Link href="/admin/calendar" className="cbs-btn cbs-btn-secondary">2. Calendar →</Link>
            <Link href="/admin/branches" className="cbs-btn cbs-btn-secondary">3. Branches →</Link>
            <Link href="/admin/users" className="cbs-btn cbs-btn-secondary">4. Users →</Link>
            <Link href="/admin/gl" className="cbs-btn cbs-btn-secondary">5. GL Setup →</Link>
            <Link href="/admin/products" className="cbs-btn cbs-btn-secondary">6. Products →</Link>
          </div>
        </section>
      </div>
    </AdminPageGuard>
  );
}