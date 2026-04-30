'use client';

/**
 * Customer cash-deposit capture form.
 *
 * Slice 2 of the teller module. Captures account number, amount,
 * denomination breakdown, and (when applicable) PMLA Rule 9 KYC
 * fields. The form enforces three pre-submit guards client-side
 * — the server is still authoritative on every one — so the
 * operator gets immediate feedback before a network round-trip:
 *
 *   1. Cross-foot: Σ(face × unitCount) === amount, paisa-exact.
 *      Server enforces with `CBS-TELLER-004` (HTTP 400) but a typo
 *      caught at the boundary saves a round-trip and keeps the
 *      audit log cleaner.
 *   2. PMLA Rule 9 (CTR threshold): cash deposits ≥ ₹50,000 require
 *      either a PAN or a Form 60/61 reference. Server enforces with
 *      `CBS-COMP-002` (HTTP 422). Client gates the submit button so
 *      the operator captures the data BEFORE the customer leaves
 *      the counter.
 *   3. FICN advisory: when total counterfeit count ≥ 5 the RBI
 *      threshold for mandatory FIR is hit. The form shows a warning
 *      so the operator knows to expect the FICN slip + FIR
 *      follow-up. Server-authoritative on `firRequired`.
 *
 * IDEMPOTENCY CONTRACT — see TELLER_API_CONTRACT.md §"Idempotency
 * Contract". The key is minted at FORM MOUNT (once), stored in
 * component state, and reused VERBATIM on every retry of the same
 * logical deposit. A network failure does NOT regenerate the key —
 * the server treats the retry as the same logical action and returns
 * the prior receipt byte-for-byte if the original POST actually
 * committed. The key is regenerated only after a SETTLED outcome
 * (POSTED receipt printed, or FICN slip acknowledged) and the
 * operator clicks "Start new deposit".
 *
 * @file src/components/teller/CashDepositForm.tsx
 */
import { useState } from 'react';
import { useTellerStore } from '@/store/tellerStore';
import { DenominationBreakdownInput } from './DenominationBreakdownInput';
import type { DenominationInput } from '@/types/teller.types';
import {
  normaliseDenominationsForRequest,
  totalCounterfeitCount,
  totalDenominationValue,
} from '@/utils/denominations';
import { formatCurrency } from '@/utils/formatters';

/**
 * RBI threshold for mandatory FIR on counterfeit notes — total count
 * across all denominations in a single transaction. Mirrors the
 * server's `firRequired` derivation on `FicnAcknowledgement`.
 */
const FICN_FIR_THRESHOLD = 5;

/**
 * PMLA Rule 9 cash-transaction reporting threshold. Deposits at or
 * above this amount require either PAN or a Form 60/61 reference.
 * Server enforces with `CBS-COMP-002` (HTTP 422).
 */
const PMLA_CTR_THRESHOLD = 50000;

/** Indian PAN format — 5 letters, 4 digits, 1 letter, all uppercase. */
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/**
 * Mint a stable idempotency key. Uses the platform's UUID v4 generator
 * when available; falls back to a non-RFC4122 random string (sufficient
 * for collision-resistance — the server scope is per
 * `(tenant_id, idempotency_key)` per the contract).
 */
function mintIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

interface ValidationProblem {
  /** Field name (form-level when undefined). */
  field?: 'accountNumber' | 'amount' | 'denominations' | 'pan';
  message: string;
}

export function CashDepositForm() {
  const cashDeposit = useTellerStore((s) => s.cashDeposit);
  const isDepositing = useTellerStore((s) => s.isDepositing);
  const depositError = useTellerStore((s) => s.depositError);
  const lastDeposit = useTellerStore((s) => s.lastDeposit);
  const resetDeposit = useTellerStore((s) => s.resetDeposit);

  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [denominations, setDenominations] = useState<DenominationInput[]>([]);
  const [depositorName, setDepositorName] = useState('');
  const [depositorMobile, setDepositorMobile] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [form60Reference, setForm60Reference] = useState('');
  const [narration, setNarration] = useState('');

  // The idempotency key is minted ONCE at form mount and is reused on
  // every retry of the same logical deposit. Lazy initialiser ensures
  // the mint runs exactly once, not on every re-render.
  const [idempotencyKey, setIdempotencyKey] = useState<string>(
    () => mintIdempotencyKey(),
  );

  const [problems, setProblems] = useState<ValidationProblem[]>([]);

  // Form is locked once a settled outcome (POSTED or FICN) has landed.
  // The container page renders the receipt / FICN slip above the form;
  // the form itself shows a "Start new deposit" affordance instead of
  // the submit button.
  const isSettled = lastDeposit !== null;

  // Live-computed numerics for the cross-foot panel.
  const enteredAmount = (() => {
    const n = Number(amount);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  })();
  const denominationTotal = totalDenominationValue(denominations);
  const counterfeitTotal = totalCounterfeitCount(denominations);
  // Compare in paisa (integer) to avoid floating-point drift on the
  // cross-foot. Two-decimal rupee amounts × 100 = exact int.
  const crossFootMatches =
    enteredAmount > 0 &&
    Math.round(enteredAmount * 100) === Math.round(denominationTotal * 100);
  const ctrTriggered = enteredAmount >= PMLA_CTR_THRESHOLD;
  const pmlaSatisfied =
    !ctrTriggered ||
    PAN_REGEX.test(panNumber.trim().toUpperCase()) ||
    form60Reference.trim().length > 0;
  const ficnAdvisory = counterfeitTotal >= FICN_FIR_THRESHOLD;

  const startNewDeposit = () => {
    // Clearing `lastDeposit` returns the page to the empty-form state.
    // Mint a fresh idempotency key — this is a NEW logical deposit,
    // not a retry of the previous one.
    resetDeposit();
    setAccountNumber('');
    setAmount('');
    setDenominations([]);
    setDepositorName('');
    setDepositorMobile('');
    setPanNumber('');
    setForm60Reference('');
    setNarration('');
    setProblems([]);
    setIdempotencyKey(mintIdempotencyKey());
  };

  const validate = (): ValidationProblem[] => {
    const issues: ValidationProblem[] = [];
    if (accountNumber.trim() === '') {
      issues.push({ field: 'accountNumber', message: 'Account number is required.' });
    }
    if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
      issues.push({ field: 'amount', message: 'Amount must be greater than zero.' });
    }
    if (denominations.length === 0 || denominationTotal <= 0) {
      issues.push({
        field: 'denominations',
        message: 'Enter at least one denomination row.',
      });
    } else if (!crossFootMatches) {
      issues.push({
        field: 'denominations',
        message: `Denomination total ${formatCurrency(denominationTotal)} does not match amount ${formatCurrency(enteredAmount)}.`,
      });
    }
    if (ctrTriggered && !pmlaSatisfied) {
      issues.push({
        field: 'pan',
        message:
          'Deposits at or above ₹50,000 require a PAN (or a Form 60/61 reference) per PMLA Rule 9.',
      });
    }
    if (
      panNumber.trim() !== '' &&
      !PAN_REGEX.test(panNumber.trim().toUpperCase())
    ) {
      issues.push({
        field: 'pan',
        message: 'PAN must be in the format AAAAA9999A (5 letters, 4 digits, 1 letter).',
      });
    }
    return issues;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const issues = validate();
    setProblems(issues);
    if (issues.length > 0) return;

    await cashDeposit({
      accountNumber: accountNumber.trim(),
      amount: enteredAmount,
      denominations: normaliseDenominationsForRequest(denominations),
      idempotencyKey,
      depositorName: depositorName.trim() || null,
      depositorMobile: depositorMobile.trim() || null,
      panNumber: panNumber.trim() ? panNumber.trim().toUpperCase() : null,
      form60Reference: form60Reference.trim() || null,
      narration: narration.trim() || null,
    });
  };

  const fieldHasError = (field: ValidationProblem['field']): boolean =>
    problems.some((p) => p.field === field);

  // When the operator has settled the previous deposit (POSTED or
  // FICN), the form body is locked and a single CTA replaces the
  // submit button. The container page renders the receipt / slip
  // above the form, so we don't repeat that summary here.
  if (isSettled) {
    return (
      <section
        className="cbs-surface cbs-no-print"
        aria-labelledby="cash-deposit-heading-settled"
      >
        <div className="cbs-surface-header">
          <div
            id="cash-deposit-heading-settled"
            className="text-sm font-semibold tracking-wide uppercase text-cbs-steel-700"
          >
            Cash Deposit
          </div>
          <span className="cbs-ribbon text-cbs-steel-600 bg-cbs-mist">
            Settled
          </span>
        </div>
        <div className="cbs-surface-body space-y-3">
          <p className="text-sm text-cbs-steel-600">
            {lastDeposit?.kind === 'FICN'
              ? 'Counterfeit notes were impounded on the previous attempt. Acknowledge the FICN slip above, then start a fresh deposit.'
              : 'The previous deposit has been posted. Print or acknowledge the receipt above, then start a fresh deposit.'}
          </p>
          <button
            type="button"
            onClick={startNewDeposit}
            className="cbs-btn cbs-btn-primary text-sm uppercase tracking-wider"
            style={{ height: 40 }}
          >
            Start New Deposit
          </button>
        </div>
      </section>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="cbs-surface cbs-no-print"
      noValidate
      aria-labelledby="cash-deposit-form-heading"
    >
      <div className="cbs-surface-header">
        <div
          id="cash-deposit-form-heading"
          className="text-sm font-semibold tracking-wide uppercase text-cbs-steel-700"
        >
          Cash Deposit
        </div>
        <span className="cbs-ribbon text-cbs-navy-700 bg-cbs-navy-50">
          Customer Counter
        </span>
      </div>
      <div className="cbs-surface-body space-y-5">
        {/* Server-side error from a prior submit attempt — distinct
            from local validation, which is rendered per-field. The
            same idempotency key is reused on retry per contract. */}
        {depositError && (
          <div role="alert" className="cbs-alert cbs-alert-error">
            <div className="font-semibold text-sm">Deposit could not be posted</div>
            <div className="mt-1 text-sm">{depositError}</div>
            <div className="mt-1 text-xs">
              The same idempotency key will be reused on retry — the
              server will return the prior receipt verbatim if the
              original attempt actually committed.
            </div>
          </div>
        )}

        {/* PMLA Rule 9 advisory — informational once amount crosses
            the ₹50k threshold; escalates to a hard-block error if PAN
            and Form 60/61 are both missing on submit. */}
        {ctrTriggered && pmlaSatisfied && (
          <div className="cbs-alert cbs-alert-info">
            <div className="font-semibold text-sm">
              CTR Reportable (PMLA Rule 9)
            </div>
            <div className="mt-1 text-sm">
              This deposit meets the ₹50,000 reporting threshold. Ensure
              the customer's PAN (or Form 60/61) is on file.
            </div>
          </div>
        )}

        {/* FICN advisory — operator-facing only. The server is
            authoritative on `firRequired` (returned on the slip when
            the deposit is actually rejected). This warning gives the
            operator early notice so they can prepare the FICN
            workflow before submitting. */}
        {ficnAdvisory && (
          <div className="cbs-alert cbs-alert-warning">
            <div className="font-semibold text-sm">
              Counterfeit threshold reached — FIR likely mandatory
            </div>
            <div className="mt-1 text-sm">
              You have flagged {counterfeitTotal} counterfeit notes
              across this deposit (RBI threshold: ≥ 5). On submit, the
              server will impound the notes and emit a FICN customer
              slip with `firRequired = true`. Prepare the police
              follow-up and currency-chest dispatch before printing.
            </div>
          </div>
        )}

        {/* ── Account + amount ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="accountNumber" className="cbs-field-label block mb-1">
              Account Number
            </label>
            <input
              id="accountNumber"
              type="text"
              required
              autoFocus
              autoComplete="off"
              className="cbs-input cbs-tabular"
              aria-invalid={fieldHasError('accountNumber')}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="e.g. SB-BR001-000001"
            />
          </div>
          <div>
            <label htmlFor="amount" className="cbs-field-label block mb-1">
              Amount (INR)
            </label>
            <input
              id="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              required
              className="cbs-input cbs-tabular"
              aria-invalid={fieldHasError('amount')}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        {/* ── Denomination breakdown ── */}
        <fieldset className="cbs-fieldset">
          <legend className="cbs-fieldset-legend">Denomination Breakdown</legend>
          <div className="cbs-fieldset-body space-y-3">
            <DenominationBreakdownInput
              value={denominations}
              onChange={setDenominations}
              disabled={isDepositing}
            />
            {/* Cross-foot panel — server-authoritative on the actual
                posting; this is operator-facing live feedback so a typo
                is caught BEFORE submit (server's CBS-TELLER-004 round-
                trip is more expensive). Compared in paisa to avoid
                floating-point drift. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <div className="cbs-field-label">Denomination total</div>
                <div className="cbs-tabular text-cbs-ink mt-1">
                  {formatCurrency(denominationTotal)}
                </div>
              </div>
              <div>
                <div className="cbs-field-label">Amount entered</div>
                <div className="cbs-tabular text-cbs-ink mt-1">
                  {formatCurrency(enteredAmount)}
                </div>
              </div>
              <div>
                <div className="cbs-field-label">Cross-foot</div>
                <div
                  className={`cbs-tabular mt-1 font-semibold ${
                    crossFootMatches
                      ? 'text-cbs-olive-700'
                      : enteredAmount > 0 && denominationTotal > 0
                        ? 'text-cbs-crimson-700'
                        : 'text-cbs-steel-600'
                  }`}
                >
                  {crossFootMatches
                    ? 'Balanced'
                    : enteredAmount > 0 && denominationTotal > 0
                      ? `Δ ${formatCurrency(denominationTotal - enteredAmount)}`
                      : '—'}
                </div>
              </div>
            </div>
            {fieldHasError('denominations') && (
              <div role="alert" className="cbs-alert cbs-alert-error">
                <div className="text-sm">
                  {problems.find((p) => p.field === 'denominations')?.message}
                </div>
              </div>
            )}
          </div>
        </fieldset>

        {/* ── Depositor identification + PMLA Rule 9 ── */}
        <fieldset className="cbs-fieldset">
          <legend className="cbs-fieldset-legend">
            Depositor Details
            {ctrTriggered && (
              <span className="ml-2 normal-case tracking-normal text-cbs-gold-700">
                — PAN or Form 60/61 required (≥ ₹50,000)
              </span>
            )}
          </legend>
          <div className="cbs-fieldset-body space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="depositorName" className="cbs-field-label block mb-1">
                  Depositor Name (optional)
                </label>
                <input
                  id="depositorName"
                  type="text"
                  maxLength={200}
                  autoComplete="off"
                  className="cbs-input"
                  value={depositorName}
                  onChange={(e) => setDepositorName(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="depositorMobile" className="cbs-field-label block mb-1">
                  Mobile (optional)
                </label>
                <input
                  id="depositorMobile"
                  type="tel"
                  inputMode="tel"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  autoComplete="off"
                  className="cbs-input cbs-tabular"
                  value={depositorMobile}
                  onChange={(e) => setDepositorMobile(e.target.value)}
                  placeholder="10-digit mobile"
                />
              </div>
              <div>
                <label htmlFor="panNumber" className="cbs-field-label block mb-1">
                  PAN {ctrTriggered ? <span className="text-cbs-crimson-700">*</span> : '(optional)'}
                </label>
                <input
                  id="panNumber"
                  type="text"
                  maxLength={10}
                  autoComplete="off"
                  className="cbs-input cbs-tabular"
                  aria-invalid={fieldHasError('pan')}
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  placeholder="AAAAA9999A"
                />
              </div>
              <div>
                <label htmlFor="form60Reference" className="cbs-field-label block mb-1">
                  Form 60/61 Reference {ctrTriggered ? '(if no PAN)' : '(optional)'}
                </label>
                <input
                  id="form60Reference"
                  type="text"
                  maxLength={50}
                  autoComplete="off"
                  className="cbs-input cbs-tabular"
                  value={form60Reference}
                  onChange={(e) => setForm60Reference(e.target.value)}
                />
              </div>
            </div>
            {fieldHasError('pan') && (
              <div role="alert" className="cbs-alert cbs-alert-error">
                <div className="text-sm">
                  {problems.find((p) => p.field === 'pan')?.message}
                </div>
              </div>
            )}
          </div>
        </fieldset>

        {/* ── Narration ── */}
        <div>
          <label htmlFor="narration" className="cbs-field-label block mb-1">
            Narration (optional)
          </label>
          <input
            id="narration"
            type="text"
            maxLength={500}
            className="cbs-input"
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            placeholder="e.g. Salary deposit"
          />
        </div>

        {/* Per-field validation summary for accountNumber/amount —
            denominations + PAN errors are rendered inline above. */}
        {(fieldHasError('accountNumber') || fieldHasError('amount')) && (
          <div role="alert" className="cbs-alert cbs-alert-error">
            <ul className="text-sm list-disc pl-5 space-y-1">
              {problems
                .filter((p) => p.field === 'accountNumber' || p.field === 'amount')
                .map((p, i) => (
                  <li key={i}>{p.message}</li>
                ))}
            </ul>
          </div>
        )}

        {/* Idempotency-key footnote — informational so the operator
            can quote it if support requests. The key is hidden from
            normal flow but discoverable via the audit panel. */}
        <div className="text-xs text-cbs-steel-600">
          <span className="cbs-field-label">Idempotency Key</span>{' '}
          <span className="cbs-tabular">{idempotencyKey}</span>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="submit"
            disabled={isDepositing}
            className="cbs-btn cbs-btn-primary text-sm uppercase tracking-wider"
            style={{ height: 40 }}
          >
            {isDepositing ? 'Posting…' : 'Post Cash Deposit'}
          </button>
        </div>
      </div>
    </form>
  );
}
