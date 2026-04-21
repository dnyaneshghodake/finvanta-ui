/**
 * UI state Zustand store for CBS Banking Application.
 * @file src/store/uiStore.ts
 *
 * Per Tier-1 CBS Enterprise Sidebar UX Blueprint §9 and §15:
 *   - isSidebarOpen   = mobile drawer visibility (< lg breakpoint)
 *   - isSidebarCollapsed = desktop rail mode (72px icon-only, ≥ lg)
 *
 * The two states are independent:
 *   - On mobile (< 1024px): isSidebarOpen controls the overlay drawer.
 *     isSidebarCollapsed is irrelevant (drawer is always full-width).
 *   - On desktop (≥ 1024px): isSidebarCollapsed toggles between
 *     272px expanded and 72px collapsed rail. isSidebarOpen is
 *     always true on desktop.
 */

import { create } from 'zustand';
import { Toast } from '@/types/ui';

/**
 * UI store state interface
 */
interface UIState {
  isSidebarOpen: boolean;
  /** Desktop rail mode — 72px icon-only when true (Blueprint §9). */
  isSidebarCollapsed: boolean;
  isDarkMode: boolean;
  toasts: Toast[];
  modals: Record<string, boolean>;
  loading: boolean;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  /** Toggle between 272px expanded and 72px collapsed rail (Blueprint §9). */
  toggleSidebarCollapse: () => void;
  setSidebarCollapsed: (isCollapsed: boolean) => void;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  openModal: (modalName: string) => void;
  closeModal: (modalName: string) => void;
  toggleModal: (modalName: string) => void;
  setLoading: (isLoading: boolean) => void;
}

/**
 * Create UI store
 */
export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: true,
  isSidebarCollapsed: false,
  isDarkMode: false,
  toasts: [],
  modals: {},
  loading: false,

  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

  setSidebarOpen: (isOpen: boolean) => set({ isSidebarOpen: isOpen }),

  toggleSidebarCollapse: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  setSidebarCollapsed: (isCollapsed: boolean) => set({ isSidebarCollapsed: isCollapsed }),

  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),

  setDarkMode: (isDark: boolean) => set({ isDarkMode: isDark }),

  addToast: (toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));

    // Auto-remove after duration
    if (toast.duration) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, toast.duration);
    }

    return id;
  },

  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  openModal: (modalName: string) => {
    set((state) => ({
      modals: { ...state.modals, [modalName]: true },
    }));
  },

  closeModal: (modalName: string) => {
    set((state) => ({
      modals: { ...state.modals, [modalName]: false },
    }));
  },

  toggleModal: (modalName: string) => {
    set((state) => ({
      modals: {
        ...state.modals,
        [modalName]: !state.modals[modalName],
      },
    }));
  },

  setLoading: (isLoading: boolean) => set({ loading: isLoading }),
}));
