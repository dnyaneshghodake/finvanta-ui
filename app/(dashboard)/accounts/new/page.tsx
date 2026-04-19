'use client';

/**
 * FINVANTA CBS - Account Opening (stub).
 *
 * Account opening is a MAKER-only action on Spring
 * (`POST /api/v1/accounts/open`) governed by the branch account-
 * opening workflow with maker-checker approval. The self-service
 * form from the legacy JSP stack is not part of the Tier-1 branch
 * workflow. Until the React account-opening form is wired to the
 * maker-checker pipeline, this page shows an explicit notice and
 * links to the legacy bridge.
 */

import Link from 'next/link';

export default function CreateAccountPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-cbs-ink">Open New Account</h1>
        <p className="text-xs text-cbs-steel-600">
          CASA account opening is a maker-checker workflow performed
          through the branch operations module.
        </p>
      </div>

      <section className="cbs-surface">
        <div className="cbs-surface-header">
          <div className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
            Coming soon
          </div>
        </div>
        <div className="cbs-surface-body space-y-3 text-sm text-cbs-steel-700">
          <p>
            The React account-opening form ships with the next release
            once it is wired to the maker-checker approval pipeline on
            Spring. Account opening requires dual authorisation per RBI
            IT Governance 2023.
          </p>
          <p>
            Until then, use the existing JSP account-opening flow — it
            is served over the same authenticated session via the legacy
            bridge.
          </p>
          <div className="flex gap-2 pt-2">
            <Link href="/legacy/deposit/open" className="cbs-btn cbs-btn-secondary">
              Open via legacy workflow
            </Link>
            <Link href="/accounts" className="cbs-btn cbs-btn-secondary">
              Back to accounts
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
