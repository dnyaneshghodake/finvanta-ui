/**
 * Auth store unit tests — session integrity validation.
 * @file src/store/__tests__/authStore.test.ts
 *
 * Per RBI IT Governance Direction 2023 §8.3: session management
 * logic (login, logout, session hydration, state clearing) MUST
 * have automated regression tests. These tests validate that:
 *   - Login populates all session fields correctly
 *   - Logout clears ALL sensitive state (no residual data)
 *   - Session hydration (loadSession) restores state from BFF
 *   - Error states are set and cleared correctly
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../authStore';

// ── Mock authService ───────────────────────────────────────────────

const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockGetCurrentUser = vi.fn();

vi.mock('@/services/api/authService', () => ({
  authService: {
    login: (...args: unknown[]) => mockLogin(...args),
    logout: (...args: unknown[]) => mockLogout(...args),
    getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────

const MOCK_USER = {
  username: 'maker1',
  roles: ['MAKER' as const],
  branchCode: 'HQ001',
  branchName: 'Head Office',
  tenantId: 'DEFAULT',
  displayName: 'Rajesh Kumar',
};

const MOCK_LOGIN_RESPONSE = {
  success: true,
  data: {
    user: MOCK_USER,
    expiresAt: Date.now() + 900_000,
    csrfToken: 'csrf-token-123',
    businessDate: '2026-04-19',
    businessDay: {
      businessDate: '2026-04-19',
      dayStatus: 'DAY_OPEN',
      isHoliday: false,
    },
    operationalConfig: {
      baseCurrency: 'INR',
      decimalPrecision: 2,
      roundingMode: 'HALF_UP',
      fiscalYearStartMonth: 4,
      businessDayPolicy: 'MON_TO_SAT',
    },
  },
};

function resetStore() {
  useAuthStore.setState({
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
  });
}

// ── Tests ──────────────────────────────────────────────────────────

describe('authStore', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts unauthenticated with null user', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isHydrated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.businessDate).toBeNull();
      expect(state.businessDay).toBeNull();
      expect(state.operationalConfig).toBeNull();
    });
  });

  describe('login', () => {
    it('sets all session fields on successful login', async () => {
      mockLogin.mockResolvedValueOnce(MOCK_LOGIN_RESPONSE);

      await useAuthStore.getState().login('maker1', 'password');

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.isHydrated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.user?.username).toBe('maker1');
      expect(state.user?.branchCode).toBe('HQ001');
      expect(state.csrfToken).toBe('csrf-token-123');
      expect(state.businessDate).toBe('2026-04-19');
      expect(state.businessDay?.dayStatus).toBe('DAY_OPEN');
      expect(state.operationalConfig?.baseCurrency).toBe('INR');
    });

    it('sets error on failed login', async () => {
      mockLogin.mockResolvedValueOnce({
        success: false,
        message: 'Invalid credentials',
      });

      await expect(
        useAuthStore.getState().login('bad', 'creds'),
      ).rejects.toThrow('Invalid credentials');

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe('Invalid credentials');
      expect(state.isLoading).toBe(false);
    });

    it('sets loading state during login', async () => {
      let resolveLogin: (value: unknown) => void;
      const loginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });
      mockLogin.mockReturnValueOnce(loginPromise);

      const loginAction = useAuthStore.getState().login('user', 'pass');
      expect(useAuthStore.getState().isLoading).toBe(true);

      resolveLogin!(MOCK_LOGIN_RESPONSE);
      await loginAction;

      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('logout', () => {
    it('clears ALL session state (no residual data)', async () => {
      // First login
      mockLogin.mockResolvedValueOnce(MOCK_LOGIN_RESPONSE);
      await useAuthStore.getState().login('maker1', 'password');

      // Then logout
      mockLogout.mockResolvedValueOnce({ success: true });
      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.csrfToken).toBeNull();
      expect(state.expiresAt).toBeNull();
      expect(state.businessDate).toBeNull();
      expect(state.businessDay).toBeNull();
      expect(state.operationalConfig).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isHydrated).toBe(false);
      expect(state.error).toBeNull();
    });

    it('clears state even when logout API fails', async () => {
      mockLogin.mockResolvedValueOnce(MOCK_LOGIN_RESPONSE);
      await useAuthStore.getState().login('maker1', 'password');

      mockLogout.mockRejectedValueOnce(new Error('Network error'));
      await useAuthStore.getState().logout();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe('loadSession', () => {
    it('restores session from BFF /auth/me', async () => {
      mockGetCurrentUser.mockResolvedValueOnce(MOCK_LOGIN_RESPONSE);

      await useAuthStore.getState().loadSession();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.isHydrated).toBe(true);
      expect(state.user?.username).toBe('maker1');
      expect(state.businessDate).toBe('2026-04-19');
    });

    it('sets unauthenticated when no session exists', async () => {
      mockGetCurrentUser.mockResolvedValueOnce({ success: false });

      await useAuthStore.getState().loadSession();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isHydrated).toBe(true);
      expect(state.user).toBeNull();
    });

    it('handles network errors gracefully', async () => {
      mockGetCurrentUser.mockRejectedValueOnce(new Error('Network error'));

      await useAuthStore.getState().loadSession();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isHydrated).toBe(true);
    });
  });

  describe('clearAuth', () => {
    it('clears auth state without API call', async () => {
      mockLogin.mockResolvedValueOnce(MOCK_LOGIN_RESPONSE);
      await useAuthStore.getState().login('maker1', 'password');

      useAuthStore.getState().clearAuth();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.businessDate).toBeNull();
    });
  });

  describe('setError', () => {
    it('sets error message', () => {
      useAuthStore.getState().setError('Something went wrong');
      expect(useAuthStore.getState().error).toBe('Something went wrong');
    });

    it('clears error with null', () => {
      useAuthStore.getState().setError('error');
      useAuthStore.getState().setError(null);
      expect(useAuthStore.getState().error).toBeNull();
    });
  });
});
