/**
 * UI state Zustand store for CBS Banking Application
 * @file src/store/uiStore.ts
 */

import { create } from 'zustand';
import { Toast } from '@/types/ui';

/**
 * UI store state interface
 */
interface UIState {
  isSidebarOpen: boolean;
  isDarkMode: boolean;
  toasts: Toast[];
  modals: Record<string, boolean>;
  loading: boolean;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
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
  isDarkMode: false,
  toasts: [],
  modals: {},
  loading: false,

  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

  setSidebarOpen: (isOpen: boolean) => set({ isSidebarOpen: isOpen }),

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
