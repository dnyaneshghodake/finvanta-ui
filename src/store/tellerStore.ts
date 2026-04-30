/**
 * Teller Zustand store.
 *
 * Mirrors the accountStore pattern (`src/store/accountStore.ts`):
 * services do the wire/mapping, the store holds normalised UI state
 * and the `isLoading` / `error` flags. No `persist` middleware —
 * authoritative state lives server-side; the store is rehydrated on
 * page load via the dedicated `fetchMyTill` action.
 *
 * Slice 1 covers the till lifecycle only. Vault and cash-posting
 * state will be added in subsequent slices to keep this file
 * reviewable.
 *
 * @file src/store/tellerStore.ts
 */
import { create } from 'zustand';
import { tellerService } from '@/services/api/tellerService';
import type {
  CashDepositReceipt,
  FicnAcknowledgement,
  TellerTill,
} from '@/types/teller.types';
import { logger } from '@/utils/logger';

/**
 * Result of the most recent cash-deposit submission. The form reads
 * this to drive the post-submit UI (success receipt vs FICN slip).
 * `null` means "no submission yet on this form mount".
 */
export type CashDepositOutcome =
  | { kind: 'POSTED'; receipt: CashDepositReceipt }
  | { kind: 'FICN'; slip: FicnAcknowledgement; message: string };

interface TellerState {
  /** Current operator's till for today (null when none open). */
  myTill: TellerTill | null;
  isLoading: boolean;
  error: string | null;
  /**
   * Distinguishes "the API said no till open today" (409 CBS-TELLER-001
   * — drive the operator to the open-till form) from a generic load
   * failure (network / 5xx — show a retry banner).
   */
  noTillOpen: boolean;

  /**
   * Last cash-deposit outcome (POSTED receipt or FICN slip). Cleared
   * by `resetDeposit` when the operator dismisses the receipt panel
   * to start a fresh capture (which also forces a NEW idempotency
   * key — see `CashDepositForm`).
   */
  lastDeposit: CashDepositOutcome | null;
  /** True while a cash-deposit POST is in flight. Distinct from
   *  `isLoading` so till-fetch and deposit-submit don't collide. */
  isDepositing: boolean;
  /** Last deposit-submit failure message (non-FICN). */
  depositError: string | null;

  fetchMyTill: () => Promise<void>;
  openTill: (req: Parameters<typeof tellerService.openTill>[0]) => Promise<void>;
  requestClose: (req: Parameters<typeof tellerService.requestClose>[0]) => Promise<void>;
  cashDeposit: (req: Parameters<typeof tellerService.cashDeposit>[0]) => Promise<CashDepositOutcome | null>;
  resetDeposit: () => void;
  clearError: () => void;
}

export const useTellerStore = create<TellerState>((set) => ({
  myTill: null,
  isLoading: false,
  error: null,
  noTillOpen: false,
  lastDeposit: null,
  isDepositing: false,
  depositError: null,

  fetchMyTill: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await tellerService.getMyTill();
      if (response.success && response.data) {
        set({ myTill: response.data, noTillOpen: false, isLoading: false });
        return;
      }
      // CBS-TELLER-001: no till open today is an EXPECTED state for
      // a teller at start-of-day — surface as `noTillOpen`, not as an
      // error banner. Anything else is a real failure.
      const code = response.error?.code;
      if (code === 'CBS-TELLER-001' || code === 'TILL_NOT_FOUND') {
        set({ myTill: null, noTillOpen: true, isLoading: false, error: null });
        return;
      }
      set({
        myTill: null,
        noTillOpen: false,
        isLoading: false,
        error: response.error?.message || 'Could not load till',
      });
    } catch (error) {
      logger.error('Fetch my-till error', error);
      set({
        myTill: null,
        noTillOpen: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Could not load till',
      });
    }
  },

  openTill: async (req) => {
    set({ isLoading: true, error: null });
    try {
      const response = await tellerService.openTill(req);
      if (response.success && response.data) {
        set({ myTill: response.data, noTillOpen: false, isLoading: false });
        return;
      }
      set({
        isLoading: false,
        error: response.error?.message || 'Could not open till',
      });
      throw new Error(response.error?.message || 'Could not open till');
    } catch (error) {
      logger.error('Open till error', error);
      const message = error instanceof Error ? error.message : 'Could not open till';
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  requestClose: async (req) => {
    set({ isLoading: true, error: null });
    try {
      const response = await tellerService.requestClose(req);
      if (response.success && response.data) {
        set({ myTill: response.data, isLoading: false });
        return;
      }
      set({
        isLoading: false,
        error: response.error?.message || 'Could not request close',
      });
      throw new Error(response.error?.message || 'Could not request close');
    } catch (error) {
      logger.error('Request close error', error);
      const message = error instanceof Error ? error.message : 'Could not request close';
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  /**
   * Submit a cash deposit. The caller (CashDepositForm) is responsible
   * for minting the `idempotencyKey` at form-mount and reusing it for
   * any retry — fresh-key-per-call would defeat server-side dedup.
   *
   * On a network/server failure (NOT a FICN rejection), `lastDeposit`
   * stays null and `depositError` carries the operator-facing message.
   * The form keeps the same `idempotencyKey` so the operator can
   * retry safely; the server treats both calls as the same logical
   * deposit and returns the prior receipt verbatim if the first call
   * actually committed.
   *
   * Returns the outcome (POSTED | FICN) on success, `null` on failure.
   */
  cashDeposit: async (req) => {
    set({ isDepositing: true, depositError: null });
    try {
      const response = await tellerService.cashDeposit(req);
      if (response.success && response.data) {
        set({ lastDeposit: response.data, isDepositing: false });
        // POSTED also mutated the till — refresh balance/state. We
        // intentionally don't await this so the form's success render
        // is not blocked on the secondary fetch.
        if (response.data.kind === 'POSTED') {
          void useTellerStore.getState().fetchMyTill();
        }
        return response.data;
      }
      const message = response.error?.message || 'Cash deposit could not be processed';
      set({ isDepositing: false, depositError: message });
      return null;
    } catch (error) {
      logger.error('Cash deposit error', error);
      const message = error instanceof Error ? error.message : 'Cash deposit could not be processed';
      set({ isDepositing: false, depositError: message });
      return null;
    }
  },

  resetDeposit: () =>
    set({ lastDeposit: null, depositError: null, isDepositing: false }),

  clearError: () => set({ error: null }),
}));
