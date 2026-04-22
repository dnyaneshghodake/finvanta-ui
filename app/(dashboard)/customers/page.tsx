'use client';

/**
 * FINVANTA CBS — Customer Search / Inquiry (Phase 3.1).
 *
 * This is the first module with real Spring REST API integration.
 * Calls GET /api/v1/customers/search via the BFF proxy.
 *
 * Search by: Customer Number, PAN, Aadhaar (masked), Name, Mobile.
 * Results show CIF number, name, KYC status, branch, and actions.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { apiClient } from '@/services/api/apiClient';
import { StatusRibbon, KeyValue, maskPan, maskAadhaar, Breadcrumb } from '@/components/cbs';
import { Button, Spinner } from '@/components/atoms';
import { R, resolvePath } from '@/config/routes';

const searchSchema = z.object({
  query: z.string().min(2, 'Enter at least 2 characters'),
  searchBy: z.enum(['name', 'pan', 'aadhaar', 'mobile', 'customerNumber']),
});

type SearchForm = z.infer<typeof searchSchema>;

interface CustomerResult {
  id: number;
  customerNumber: string;
  firstName: string;
  lastName: string;
  pan?: string;
  mobile?: string;
  kycStatus: string;
  status: string;
  branchCode?: string;
}

export default function CustomerSearchPage() {
  const [results, setResults] = useState<CustomerResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<SearchForm>({
    resolver: zodResolver(searchSchema),
    defaultValues: { query: '', searchBy: 'name' },
  });

  const onSearch = async (data: SearchForm) => {
    setLoading(true);
    setSearched(true);
    try {
      const res = await apiClient.get<{
        status: string;
        data?: CustomerResult[];
      }>('/customers/search', {
        params: { [data.searchBy]: data.query },
      });
      setResults(res.data?.data ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: R.dashboard.home.label, href: R.dashboard.home.path as string }, { label: R.customers.search.label }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-cbs-ink">Customer Search</h1>
          <p className="text-xs text-cbs-steel-600 mt-0.5">
            Search by CIF number, PAN, Aadhaar, name, or mobile number.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={R.customers.kyc.path as string} className="cbs-btn cbs-btn-secondary">KYC Verification</Link>
          <Link href={R.customers.create.path as string} className="cbs-btn cbs-btn-primary">+ New Customer</Link>
        </div>
      </div>

      {/* Search Form */}
      <section className="cbs-surface">
        <div className="cbs-surface-header">
          <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
            Search Criteria
          </span>
        </div>
        <form onSubmit={handleSubmit(onSearch)} className="cbs-surface-body">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="w-40">
              <label className="cbs-field-label block mb-1">Search By</label>
              <select className="cbs-input" {...register('searchBy')}>
                <option value="name">Name</option>
                <option value="customerNumber">CIF Number</option>
                <option value="pan">PAN</option>
                <option value="aadhaar">Aadhaar</option>
                <option value="mobile">Mobile</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="cbs-field-label block mb-1">Search Value</label>
              <input
                type="text"
                className="cbs-input"
                placeholder="Enter search value..."
                {...register('query')}
              />
              {errors.query && (
                <p className="text-xs text-cbs-crimson-700 mt-1">{errors.query.message}</p>
              )}
            </div>
            <div className="flex items-end">
              <Button type="submit" size="md" isLoading={loading}>
                Search
              </Button>
            </div>
          </div>
        </form>
      </section>

      {/* Results */}
      {loading && (
        <div className="flex justify-center py-8">
          <Spinner size="md" message="Searching customers..." />
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <div className="cbs-surface text-center py-8">
          <p className="text-sm text-cbs-steel-500">No customers found matching your criteria.</p>
        </div>
      )}

      {results.length > 0 && (
        <section className="cbs-surface">
          <div className="cbs-surface-header">
            <span className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
              Search Results
            </span>
            <span className="text-xs text-cbs-steel-500 cbs-tabular">
              {results.length} record{results.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="cbs-grid-table">
              <thead>
                <tr>
                  <th>CIF Number</th>
                  <th>Customer Name</th>
                  <th>PAN</th>
                  <th>Mobile</th>
                  <th>Branch</th>
                  <th>KYC</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link
                        href={resolvePath(R.customers.view as import('@/config/routes').RouteEntry, String(c.id))}
                        className="cbs-tabular font-semibold text-cbs-navy-700 hover:underline"
                      >
                        {c.customerNumber}
                      </Link>
                    </td>
                    <td className="text-cbs-ink font-medium">
                      {c.firstName} {c.lastName}
                    </td>
                    <td className="cbs-tabular text-cbs-steel-600">
                      {c.pan ? maskPan(c.pan) : '—'}
                    </td>
                    <td className="cbs-tabular text-cbs-steel-600">
                      {c.mobile || '—'}
                    </td>
                    <td className="cbs-tabular text-cbs-steel-700">
                      {c.branchCode || '—'}
                    </td>
                    <td>
                      <StatusRibbon status={c.kycStatus === 'VERIFIED' ? 'APPROVED' : c.kycStatus === 'PENDING' ? 'PENDING_APPROVAL' : 'REJECTED'} />
                    </td>
                    <td>
                      <StatusRibbon status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}