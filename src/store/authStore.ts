/**
 * Authentication Zustand store for CBS Banking Application
 * @file src/store/authStore.ts
 */

import { create } from 'zustand';
import { User } from '@/types/entities';
import { authService } from '@/services/api/authService';
import { logger } from '@/utils/logger';

/**
 * Auth store state interface
 */
interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setRefreshToken: (token: string | null) => void;
  setError: (error: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuthToken: () => Promise<void>;
  loadUserFromStorage: () => void;
  clearAuth: () => void;
}

/**
 * Create auth store
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  setUser: (user) => set({ user, isAuthenticated: user !== null }),

  setToken: (token) => set({ token }),

  setRefreshToken: (token) => set({ refreshToken: token }),

  setError: (error) => set({ error }),

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.login({ email, password });
      
      if (response.success && response.data) {
        const { accessToken, refreshToken } = response.data;
        
        // Store tokens
        if (typeof window !== 'undefined') {
          localStorage.setItem('cbs_access_token', accessToken);
          localStorage.setItem('cbs_refresh_token', refreshToken);
        }

        set({
          token: accessToken,
          refreshToken: refreshToken,
          isAuthenticated: true,
        });

        // Fetch user profile
        try {
          const userResponse = await authService.getCurrentUser();
          if (userResponse.success && userResponse.data) {
            set({ user: userResponse.data });
            if (typeof window !== 'undefined') {
              localStorage.setItem('cbs_user', JSON.stringify(userResponse.data));
            }
          }
        } catch (error) {
          logger.error('Failed to fetch user profile', error);
        }
      }

      set({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      set({ 
        isLoading: false, 
        error: message,
        isAuthenticated: false 
      });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
    } catch (error) {
      logger.error('Logout API call failed', error);
    } finally {
      get().clearAuth();
      set({ isLoading: false });
    }
  },

  refreshAuthToken: async () => {
    const { refreshToken } = get();
    
    if (!refreshToken) {
      get().clearAuth();
      throw new Error('No refresh token available');
    }

    try {
      const response = await authService.refreshToken(refreshToken);
      
      if (response.success && response.data) {
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('cbs_access_token', accessToken);
          localStorage.setItem('cbs_refresh_token', newRefreshToken);
        }

        set({
          token: accessToken,
          refreshToken: newRefreshToken,
        });
      }
    } catch (error) {
      logger.error('Token refresh failed', error);
      get().clearAuth();
      throw error;
    }
  },

  loadUserFromStorage: () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('cbs_access_token');
      const refreshToken = localStorage.getItem('cbs_refresh_token');
      const userJson = localStorage.getItem('cbs_user');

      if (token && userJson) {
        try {
          const user = JSON.parse(userJson);
          set({
            token,
            refreshToken,
            user,
            isAuthenticated: true,
          });
        } catch (error) {
          logger.error('Failed to parse stored user', error);
          get().clearAuth();
        }
      }
    }
  },

  clearAuth: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cbs_access_token');
      localStorage.removeItem('cbs_refresh_token');
      localStorage.removeItem('cbs_user');
    }

    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      error: null,
    });
  },
}));
