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
import type { TellerTill } from '@/types/teller.types';
import { logger } from '@/utils/logger';

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

  fetchMyTill: () => Promise<void>;
  openTill: (req: Parameters<typeof tellerService.openTill>[0]) => Promise<void>;
  requestClose: (req: Parameters<typeof tellerService.requestClose>[0]) => Promise<void>;
  clearError: () => void;
}

export const useTellerStore = create<TellerState>((set) => ({
  myTill: null,
  isLoading: false,
  error: null,
  noTillOpen: false,

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

  clearError: () => set({ error: null }),
}));
