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

interface AuthState {
  user: User | null;
  csrfToken: string | null;
  expiresAt: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;

  setError: (error: string | null) => void;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  csrfToken: null,
  expiresAt: null,
  isAuthenticated: false,
  isLoading: false,
  isHydrated: false,
  error: null,

  setError: (error) => set({ error }),

  login: async (emailOrUsername, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.login({
        email: emailOrUsername,
        password,
      });
      if (!response.success || !response.data) {
        const message = response.error?.message || "Login failed";
        set({ isLoading: false, error: message, isAuthenticated: false });
        throw new Error(message);
      }
      set({
        user: response.data.user,
        csrfToken: response.data.csrfToken,
        expiresAt: response.data.expiresAt,
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
        isAuthenticated: false,
        isLoading: false,
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
      isAuthenticated: false,
      isHydrated: true,
    });
  },

  clearAuth: () =>
    set({
      user: null,
      csrfToken: null,
      expiresAt: null,
      isAuthenticated: false,
    }),
}));
