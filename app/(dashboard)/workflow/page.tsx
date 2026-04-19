'use client';

/**
 * FINVANTA CBS - Maker-Checker Workflow Queue (stub).
 *
 * The React maker-checker inbox is gated behind a dedicated REST
 * surface (WorkflowController needs to be migrated from JSP MVC to
 * `@RestController` with allowedActions[] on every GET DTO). Until
 * that is landed, this page renders an explicit "coming soon"
 * placeholder -- the JSP inbox at `/workflow` remains the single
 * source of truth for approvals and is reachable via the legacy
 * bridge at `/legacy/workflow`.
 *
 * Per RBI dual-authorisation and our existing backend constraints:
 *   - Self-approval prevention, optimistic locking (@Version), and
 *     consumption-lock semantics are all enforced server-side via
 *     ApprovalWorkflowService; no UI-side approximation.
 *   - Allowed actions are returned by the backend per-row; the UI
 *     never computes its own action list.
 */

import Link from 'next/link';

export default function WorkflowPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-cbs-ink">Maker-Checker Queue</h1>
        <p className="text-xs text-cbs-steel-600">
          Pending actions awaiting checker review. Self-approval is
          prevented server-side per RBI dual-authorisation.
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
            The React maker-checker inbox ships with the next release
            once the backend exposes `/api/v1/workflow/**` as a REST
            surface with server-supplied `allowedActions[]` and
            optimistic-lock semantics.
          </p>
          <p>
            Until then, use the existing JSP workflow inbox -- it is
            served over the same authenticated session via the legacy
            bridge and enforces the full ApprovalWorkflowService
            contract (self-approval prevention, version guard,
            consumption lock).
          </p>
          <div className="pt-2">
            <Link href="/legacy/workflow" className="cbs-btn cbs-btn-secondary">
              Open legacy workflow inbox
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
