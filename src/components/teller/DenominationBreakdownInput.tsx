'use client';

/**
 * Reusable denomination-breakdown input grid.
 *
 * Renders one row per RBI-issued denomination (highest face value
 * first, COIN_BUCKET last). Each row has:
 *   - Unit count (number of pieces; for COIN_BUCKET, rupee total)
 *   - Counterfeit count (deposit only — withdrawal hides this column
 *     because the bank never pays out counterfeits)
 *   - Server-computed-equivalent line total (face × unitCount), shown
 *     for live cross-foot validation against the operator-entered
 *     transaction amount
 *
 * Uncontrolled values are stored as strings so a half-typed digit
 * doesn't trigger NaN paths. The parent form converts to numbers on
 * submit and calls `onChange` with the canonicalised array.
 *
 * @file src/components/teller/DenominationBreakdownInput.tsx
 */
import type {
  DenominationInput,
  IndianCurrencyDenomination,
} from '@/types/teller.types';
import {
  DENOMINATION_FACE_VALUE,
  DENOMINATION_LABEL,
  DENOMINATION_ORDER,
} from '@/utils/denominations';
import { formatCurrency } from '@/utils/formatters';

export interface DenominationBreakdownInputProps {
  /** Current breakdown — keyed by denomination, missing entries treated as zero. */
  value: ReadonlyArray<DenominationInput>;
  onChange: (next: DenominationInput[]) => void;
  /** When true, hides the counterfeit column (withdrawal flow). */
  hideCounterfeit?: boolean;
  /** Disable all inputs (form submit in flight). */
  disabled?: boolean;
}

function findLine(
  lines: ReadonlyArray<DenominationInput>,
  d: IndianCurrencyDenomination,
): DenominationInput | undefined {
  return lines.find((l) => l.denomination === d);
}

export function DenominationBreakdownInput({
  value,
  onChange,
  hideCounterfeit = false,
  disabled = false,
}: DenominationBreakdownInputProps) {
  const update = (
    d: IndianCurrencyDenomination,
    patch: Partial<Omit<DenominationInput, 'denomination'>>,
  ) => {
    const existing = findLine(value, d);
    const merged: DenominationInput = {
      denomination: d,
      unitCount: patch.unitCount ?? existing?.unitCount ?? 0,
      counterfeitCount: patch.counterfeitCount ?? existing?.counterfeitCount ?? 0,
    };
    const without = value.filter((l) => l.denomination !== d);
    onChange([...without, merged]);
  };

  return (
    <table
      className="w-full border-collapse text-sm"
      role="grid"
      aria-label="Denomination breakdown"
    >
      <thead>
        <tr className="text-left text-xs uppercase tracking-wider text-cbs-steel-600 border-b border-cbs-steel-100">
          <th scope="col" className="py-2 pr-3 font-medium">
            Denomination
          </th>
          <th scope="col" className="py-2 px-3 font-medium">
            {DENOMINATION_ORDER[0] === 'NOTE_2000' ? 'Unit count' : 'Count'}
          </th>
          {!hideCounterfeit && (
            <th scope="col" className="py-2 px-3 font-medium">
              Counterfeit
            </th>
          )}
          <th scope="col" className="py-2 pl-3 font-medium text-right">
            Line total
          </th>
        </tr>
      </thead>
      <tbody>
        {DENOMINATION_ORDER.map((d) => {
          const line = findLine(value, d);
          const unitCount = line?.unitCount ?? 0;
          const counterfeitCount = line?.counterfeitCount ?? 0;
          const lineTotal = DENOMINATION_FACE_VALUE[d] * unitCount;
          return (
            <tr key={d} className="border-b border-cbs-steel-50">
              <th scope="row" className="py-2 pr-3 font-normal text-cbs-ink">
                {DENOMINATION_LABEL[d]}
              </th>
              <td className="py-2 px-3">
                <input
                  type="number"
                  inputMode="numeric"
                  step={1}
                  min={0}
                  disabled={disabled}
                  className="cbs-input cbs-tabular w-24 text-right"
                  value={unitCount === 0 ? '' : String(unitCount)}
                  onChange={(e) => {
                    const n = e.target.value === '' ? 0 : Number(e.target.value);
                    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return;
                    update(d, { unitCount: n });
                  }}
                  aria-label={`Unit count for ${DENOMINATION_LABEL[d]}`}
                />
              </td>
              {!hideCounterfeit && (
                <td className="py-2 px-3">
                  <input
                    type="number"
                    inputMode="numeric"
                    step={1}
                    min={0}
                    disabled={disabled}
                    className="cbs-input cbs-tabular w-20 text-right"
                    value={counterfeitCount === 0 ? '' : String(counterfeitCount)}
                    onChange={(e) => {
                      const n = e.target.value === '' ? 0 : Number(e.target.value);
                      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return;
                      update(d, { counterfeitCount: n });
                    }}
                    aria-label={`Counterfeit count for ${DENOMINATION_LABEL[d]}`}
                  />
                </td>
              )}
              <td className="py-2 pl-3 cbs-tabular text-right text-cbs-ink">
                {lineTotal === 0 ? '—' : formatCurrency(lineTotal)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
