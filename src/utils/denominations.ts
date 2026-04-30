/**
 * RBI-issued Indian currency denomination math.
 *
 * @file src/utils/denominations.ts
 *
 * Single source of truth for the rupee value of each denomination
 * enum used by the teller cash-counter flows. The CLIENT computes
 * `totalValue` only for live cross-foot validation (so the operator
 * sees `2 × ₹500 + 0 × ₹100 = ₹1,000` while typing); the SERVER
 * recomputes from its own enum and is authoritative on the receipt
 * (anti-tampering, see TELLER_API_CONTRACT.md §B3).
 */
import type {
  DenominationInput,
  IndianCurrencyDenomination,
} from '@/types/teller.types';

/**
 * Face value of each denomination in INR. `COIN_BUCKET` is a catch-
 * all bucket for sub-₹5 coins; the teller enters the rupee total of
 * the bucket directly via `unitCount` (interpreted as rupees, not
 * pieces — the contract does not split coin denominations further).
 *
 * NOTE on COIN_BUCKET semantics: per the contract example payloads,
 * `unitCount` carries the rupee total for COIN_BUCKET (not a piece
 * count). This util therefore treats COIN_BUCKET face value as 1 so
 * `unitCount × faceValue` equals the rupee amount as the operator
 * entered it. If the backend ever splits coin denominations, replace
 * COIN_BUCKET here with explicit COIN_2/COIN_1 etc. enums.
 */
export const DENOMINATION_FACE_VALUE: Record<IndianCurrencyDenomination, number> = {
  NOTE_2000: 2000,
  NOTE_500: 500,
  NOTE_200: 200,
  NOTE_100: 100,
  NOTE_50: 50,
  NOTE_20: 20,
  NOTE_10: 10,
  NOTE_5: 5,
  COIN_BUCKET: 1,
};

/**
 * Display label for a denomination — used in the breakdown table
 * header. Kept here so the i18n pass has a single hook to localise.
 */
export const DENOMINATION_LABEL: Record<IndianCurrencyDenomination, string> = {
  NOTE_2000: '₹2000',
  NOTE_500: '₹500',
  NOTE_200: '₹200',
  NOTE_100: '₹100',
  NOTE_50: '₹50',
  NOTE_20: '₹20',
  NOTE_10: '₹10',
  NOTE_5: '₹5',
  COIN_BUCKET: 'Coins (₹ total)',
};

/**
 * Stable display order — highest face value first, COIN_BUCKET last.
 * Matches the physical layout of a teller drawer.
 */
export const DENOMINATION_ORDER: ReadonlyArray<IndianCurrencyDenomination> = [
  'NOTE_2000',
  'NOTE_500',
  'NOTE_200',
  'NOTE_100',
  'NOTE_50',
  'NOTE_20',
  'NOTE_10',
  'NOTE_5',
  'COIN_BUCKET',
];

/**
 * Sum the rupee total of an array of denomination inputs. Filters out
 * lines whose `unitCount` is zero (those don't get sent to the server).
 */
export function totalDenominationValue(lines: DenominationInput[]): number {
  return lines.reduce((acc, line) => {
    const face = DENOMINATION_FACE_VALUE[line.denomination] ?? 0;
    return acc + face * line.unitCount;
  }, 0);
}

/**
 * Total counterfeit-note count across all lines (RBI threshold for
 * mandatory FIR is `>= 5`). Pure client-side preview — the FICN
 * workflow runs server-side, but the form can warn the operator
 * before submission.
 */
export function totalCounterfeitCount(lines: DenominationInput[]): number {
  return lines.reduce((acc, line) => acc + line.counterfeitCount, 0);
}

/**
 * Normalise a denomination breakdown for transmission: drops zero-
 * count lines so the request body stays minimal, and guarantees the
 * server-side display order. Counterfeit-only lines (unitCount=0,
 * counterfeitCount>0) are kept since the server needs them to drive
 * the FICN workflow.
 */
export function normaliseDenominationsForRequest(
  lines: DenominationInput[],
): DenominationInput[] {
  const byKey = new Map<IndianCurrencyDenomination, DenominationInput>();
  for (const line of lines) {
    if (line.unitCount === 0 && line.counterfeitCount === 0) continue;
    byKey.set(line.denomination, line);
  }
  return DENOMINATION_ORDER.flatMap((d) => {
    const line = byKey.get(d);
    return line ? [line] : [];
  });
}
