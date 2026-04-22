'use client';

/**
 * CBS Transaction Receipt — printable voucher for counter operations.
 * @file src/components/cbs/TransactionReceipt.tsx
 *
 * Per RBI IT Governance 2023 §8.5 and CBS counter operations:
 * every financial posting must produce a printable receipt showing
 * transaction reference, amount, parties, timestamp, and audit hash.
 * Operators at bank counters print this for the customer as proof
 * of transaction.
 *
 * CBS benchmark:
 *   Finacle:  HFINLOG voucher print — shows txn ref, amount, branch
 *   T24:      STMT.ENTRY print — transaction slip with audit trail
 *   FLEXCUBE: CSTB_TXN_RECEIPT — printable receipt with QR code
 *
 * Usage:
 *   <TransactionReceipt
 *     transactionRef="TXN-2026-04-19-0001"
 *     transactionType="Internal Transfer"
 *     amount={50000}
 *     fromAccount="SB-HQ001-000001"
 *     toAccount="SB-HQ001-000042"
 *     status="POSTED"
 *     postedAt="2026-04-19T10:42:00Z"
 *     operatorName="Maker1"
 *     branchCode="HQ001"
 *   />
 *
 * The component renders a print-optimized layout that uses the
 * browser's native print dialog. The `cbs-no-print` class on
 * non-receipt elements (sidebar, header) ensures only the receipt
 * appears in the print output.
 */

import { useRef } from 'react';
import { Printer, CheckCircle, XCircle, Clock } from 'lucide-react';
import { formatCurrency, formatCbsTimestamp } from '@/utils/formatters';
import { useAuthStore } from '@/store/authStore';

/* ── Types ─────────────────────────────────────────────────────── */

export interface TransactionReceiptField {
  label: string;
  value: string | number;
  /** Right-align and use tabular-nums (for amounts). */
  isAmount?: boolean;
}

export interface TransactionReceiptProps {
  /** Unique transaction reference (e.g. "TXN-2026-04-19-0001"). */
  transactionRef: string;
  /** Transaction type label (e.g. "Internal Transfer", "Cash Deposit"). */
  transactionType: string;
  /** Primary amount. */
  amount: number;
  /** Currency code. Default: INR. */
  currency?: string;
  /** Source account number. */
  fromAccount?: string;
  /** Destination account number. */
  toAccount?: string;
  /** Narration / description. */
  narration?: string;
  /** Transaction status. */
  status: 'POSTED' | 'PENDING_APPROVAL' | 'FAILED' | string;
  /** ISO timestamp when the transaction was posted. */
  postedAt?: string;
  /** Operator who initiated the transaction. */
  operatorName?: string;
  /** Branch code where the transaction was posted. */
  branchCode?: string;
  /** SHA-256 audit hash prefix from TransactionEngine (first 12 hex chars). */
  auditHashPrefix?: string;
  /** Correlation ID for IT support reference. */
  correlationId?: string;
  /** Additional fields to display. */
  extraFields?: TransactionReceiptField[];
  /** Callback after print dialog closes. */
  onPrintComplete?: () => void;
}

/* ── Status styling ────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const upper = status.toUpperCase();
  if (upper === 'POSTED' || upper === 'COMPLETED' || upper === 'SUCCESS') {
    return (
      <span className="inline-flex items-center gap-1 text-cbs-olive-700 font-bold text-sm">
        <CheckCircle size={16} /> POSTED
      </span>
    );
  }
  if (upper === 'FAILED' || upper === 'REJECTED') {
    return (
      <span className="inline-flex items-center gap-1 text-cbs-crimson-700 font-bold text-sm">
        <XCircle size={16} /> FAILED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-cbs-gold-700 font-bold text-sm">
      <Clock size={16} /> {upper}
    </span>
  );
}

/* ── Component ─────────────────────────────────────────────────── */

export function TransactionReceipt({
  transactionRef,
  transactionType,
  amount,
  currency = 'INR',
  fromAccount,
  toAccount,
  narration,
  status,
  postedAt,
  operatorName,
  branchCode,
  auditHashPrefix,
  correlationId,
  extraFields,
  onPrintComplete,
}: TransactionReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const businessDate = useAuthStore((s) => s.businessDate);
  const user = useAuthStore((s) => s.user);

  const effectiveBranch = branchCode || user?.branchCode || '—';
  const effectiveOperator = operatorName || user?.displayName || user?.username || '—';

  const handlePrint = () => {
    window.print();
    onPrintComplete?.();
  };

  const fields: { label: string; value: string }[] = [
    { label: 'Transaction Ref', value: transactionRef },
    { label: 'Type', value: transactionType },
    ...(fromAccount ? [{ label: 'From Account', value: fromAccount }] : []),
    ...(toAccount ? [{ label: 'To Account', value: toAccount }] : []),
    { label: 'Amount', value: formatCurrency(amount, currency) },
    ...(narration ? [{ label: 'Narration', value: narration }] : []),
    { label: 'Business Date', value: businessDate || '—' },
    ...(postedAt ? [{ label: 'Posted At', value: formatCbsTimestamp(postedAt) }] : []),
    { label: 'Branch', value: effectiveBranch },
    { label: 'Operator', value: effectiveOperator },
    ...(extraFields || []).map((f) => ({
      label: f.label,
      value: f.isAmount && typeof f.value === 'number'
        ? formatCurrency(f.value, currency)
        : String(f.value),
    })),
  ];

  return (
    <div>
      {/* ── Print Button (hidden in print output) ────────────── */}
      <div className="flex justify-end mb-3 cbs-no-print">
        <button
          type="button"
          onClick={handlePrint}
          className="cbs-btn cbs-btn-secondary flex items-center gap-1.5 text-sm"
        >
          <Printer size={14} />
          Print Receipt
        </button>
      </div>

      {/* ── Receipt Body (print-optimized) ────────────────────── */}
      <div
        ref={receiptRef}
        className="bg-cbs-paper border border-cbs-steel-200 rounded-sm max-w-lg mx-auto print:border-none print:max-w-full print:mx-0"
      >
        {/* Header */}
        <div className="border-b border-cbs-steel-200 px-6 py-4 text-center">
          <div className="text-xs text-cbs-steel-500 uppercase tracking-widest font-semibold">
            FINVANTA CBS
          </div>
          <div className="text-base font-bold text-cbs-ink mt-1">
            Transaction Receipt
          </div>
          <div className="text-xs text-cbs-steel-600 mt-0.5">
            Branch: {effectiveBranch}
          </div>
        </div>

        {/* Status + Amount */}
        <div className="px-6 py-4 border-b border-cbs-steel-200 bg-cbs-mist text-center">
          <StatusBadge status={status} />
          <div className="text-2xl font-bold cbs-tabular text-cbs-ink mt-2">
            {formatCurrency(amount, currency)}
          </div>
          <div className="text-xs text-cbs-steel-500 mt-1">
            {transactionType}
          </div>
        </div>

        {/* Transaction Details */}
        <div className="px-6 py-4 space-y-2">
          {fields.map((field) => (
            <div
              key={field.label}
              className="flex items-start justify-between py-1.5 border-b border-cbs-steel-100 last:border-0"
            >
              <span className="text-xs text-cbs-steel-600 font-medium shrink-0 mr-4">
                {field.label}
              </span>
              <span className="text-xs text-cbs-ink font-semibold text-right cbs-tabular">
                {field.value}
              </span>
            </div>
          ))}
        </div>

        {/* Audit Footer */}
        <div className="px-6 py-3 border-t border-cbs-steel-200 bg-cbs-mist space-y-1">
          {auditHashPrefix && (
            <div className="text-[10px] text-cbs-steel-500 cbs-tabular">
              Audit Hash: {auditHashPrefix}
            </div>
          )}
          {correlationId && (
            <div className="text-[10px] text-cbs-steel-500 cbs-tabular">
              Ref: {correlationId}
            </div>
          )}
          <div className="text-[10px] text-cbs-steel-400 text-center pt-1">
            This is a computer-generated receipt. No signature required.
          </div>
        </div>
      </div>
    </div>
  );
}
