/**
 * Authentication Zustand store.
 *
 * Source of truth is the server-side session cookie. This store only
 * caches the User object and a mirror of fv_csrf for convenience in
 * interceptors. No JWT is held in memory or storage. `loadSession`
 * rehydrates state from `/api/cbs/auth/me` on page load.
 */
import { create } from "zustand";
import { authService } from "@/services/api/authService";
import type { User } from "@/types/entities";
import { logger } from "@/utils/logger";

/** Business day context from Spring `data.businessDay`. */
interface BusinessDay {
  businessDate: string;
  dayStatus: string;
  isHoliday: boolean;
  previousBusinessDate?: string;
  nextBusinessDate?: string;
}

/** Operational config from Spring `data.operationalConfig`. */
interface OperationalConfig {
  baseCurrency: string;
  decimalPrecision: number;
  roundingMode: string;
  fiscalYearStartMonth: number;
  businessDayPolicy: string;
}

interface AuthState {
  user: User | null;
  csrfToken: string | null;
  expiresAt: number | null;
  /** Server-authoritative business date (YYYY-MM-DD). Header reads this. */
  businessDate: string | null;
  /** Full business day context (day status, holiday flag, prev/next dates). */
  businessDay: BusinessDay | null;
  /** Operational config (currency, precision, rounding, fiscal year). */
  operationalConfig: OperationalConfig | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;

  setError: (error: string | null) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  csrfToken: null,
  expiresAt: null,
  businessDate: null,
  businessDay: null,
  operationalConfig: null,
  isAuthenticated: false,
  isLoading: false,
  isHydrated: false,
  error: null,

  setError: (error) => set({ error }),

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.login({
        username,
        password,
      });
      if (!response.success || !response.data) {
        const message =
          response.message || response.error?.message || "Login failed";
        set({ isLoading: false, error: message, isAuthenticated: false });
        throw new Error(message);
      }
      set({
        user: response.data.user,
        csrfToken: response.data.csrfToken,
        expiresAt: response.data.expiresAt,
        businessDate: response.data.businessDate ?? null,
        businessDay: response.data.businessDay ?? null,
        operationalConfig: response.data.operationalConfig ?? null,
        isAuthenticated: true,
        isHydrated: true,
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      set({ isLoading: false, error: message, isAuthenticated: false });
      throw err;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
    } catch (error) {
      logger.error("Logout call failed", error);
    } finally {
      set({
        user: null,
        csrfToken: null,
        expiresAt: null,
        businessDate: null,
        businessDay: null,
        operationalConfig: null,
        isAuthenticated: false,
        isHydrated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  loadSession: async () => {
    try {
      const response = await authService.getCurrentUser();
      if (response.success && response.data) {
        set({
          user: response.data.user,
          csrfToken: response.data.csrfToken,
          expiresAt: response.data.expiresAt,
          businessDate: response.data.businessDate ?? null,
          businessDay: response.data.businessDay ?? null,
          operationalConfig: response.data.operationalConfig ?? null,
          isAuthenticated: true,
          isHydrated: true,
        });
        return;
      }
    } catch (error) {
      logger.debug("No active session", error);
    }
    set({
      user: null,
      csrfToken: null,
      expiresAt: null,
      businessDate: null,
      businessDay: null,
      operationalConfig: null,
      isAuthenticated: false,
      isHydrated: true,
    });
  },

  clearAuth: () =>
    set({
      user: null,
      csrfToken: null,
      expiresAt: null,
      businessDate: null,
      businessDay: null,
      operationalConfig: null,
      isAuthenticated: false,
    }),
}));
