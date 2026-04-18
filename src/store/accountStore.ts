/**
 * Accounts Zustand store for CBS Banking Application
 * @file src/store/accountStore.ts
 */

import { create } from 'zustand';
import { Account, Transaction, Beneficiary } from '@/types/entities';
import { accountService } from '@/services/api/accountService';
import { logger } from '@/utils/logger';

/**
 * Account store state interface
 */
interface AccountState {
  accounts: Account[];
  selectedAccount: Account | null;
  transactions: Transaction[];
  beneficiaries: Beneficiary[];
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };

  // Actions
  fetchAccounts: () => Promise<void>;
  selectAccount: (accountId: string) => void;
  fetchTransactions: (accountId: string, page?: number) => Promise<void>;
  fetchBeneficiaries: () => Promise<void>;
  addBeneficiary: (data: any) => Promise<void>;
  removeBeneficiary: (beneficiaryId: string) => Promise<void>;
  transfer: (accountId: string, data: any) => Promise<void>;
  setError: (error: string | null) => void;
  clearError: () => void;
}

/**
 * Create account store
 */
export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  selectedAccount: null,
  transactions: [],
  beneficiaries: [],
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0,
  },

  fetchAccounts: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await accountService.getAccounts({ page: 1, pageSize: 50 });
      
      if (response.success && response.data) {
        set({
          accounts: response.data.items,
          pagination: {
            page: response.data.page,
            pageSize: response.data.pageSize,
            total: response.data.total,
          },
        });

        // Auto-select first account if available
        if (response.data.items.length > 0 && !get().selectedAccount) {
          set({ selectedAccount: response.data.items[0] });
        }
      }

      set({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch accounts';
      logger.error('Fetch accounts error', error);
      set({ 
        isLoading: false, 
        error: message,
        accounts: [],
      });
      throw error;
    }
  },

  selectAccount: (accountId: string) => {
    const { accounts } = get();
    const account = accounts.find(a => a.id === accountId);
    if (account) {
      set({ selectedAccount: account });
    }
  },

  fetchTransactions: async (accountId: string, page: number = 1) => {
    set({ isLoading: true, error: null });
    try {
      const response = await accountService.getTransactions(accountId, { 
        page,
        pageSize: 20,
        sortBy: 'postingDate',
        sortOrder: 'DESC',
      });
      
      if (response.success && response.data) {
        set({
          transactions: response.data.items,
          pagination: {
            page: response.data.page,
            pageSize: response.data.pageSize,
            total: response.data.total,
          },
        });
      }

      set({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch transactions';
      logger.error('Fetch transactions error', error);
      set({ 
        isLoading: false, 
        error: message,
        transactions: [],
      });
      throw error;
    }
  },

  fetchBeneficiaries: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await accountService.getBeneficiaries({ page: 1, pageSize: 100 });
      
      if (response.success && response.data) {
        set({ beneficiaries: response.data.items });
      }

      set({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch beneficiaries';
      logger.error('Fetch beneficiaries error', error);
      set({ 
        isLoading: false, 
        error: message,
        beneficiaries: [],
      });
      throw error;
    }
  },

  addBeneficiary: async (data: any) => {
    set({ isLoading: true, error: null });
    try {
      const response = await accountService.addBeneficiary(data);
      
      if (response.success && response.data) {
        const { beneficiaries } = get();
        set({ beneficiaries: [...beneficiaries, response.data] });
      }

      set({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add beneficiary';
      logger.error('Add beneficiary error', error);
      set({ 
        isLoading: false, 
        error: message,
      });
      throw error;
    }
  },

  removeBeneficiary: async (beneficiaryId: string) => {
    set({ isLoading: true, error: null });
    try {
      await accountService.removeBeneficiary(beneficiaryId);
      
      const { beneficiaries } = get();
      set({ 
        beneficiaries: beneficiaries.filter(b => b.id !== beneficiaryId),
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove beneficiary';
      logger.error('Remove beneficiary error', error);
      set({ 
        isLoading: false, 
        error: message,
      });
      throw error;
    }
  },

  transfer: async (accountId: string, data: any) => {
    set({ isLoading: true, error: null });
    try {
      const response = await accountService.transfer(accountId, data);
      
      if (response.success && response.data) {
        // Add new transaction to list
        const { transactions } = get();
        set({ 
          transactions: [response.data, ...transactions],
          isLoading: false,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to transfer funds';
      logger.error('Transfer error', error);
      set({ 
        isLoading: false, 
        error: message,
      });
      throw error;
    }
  },

  setError: (error: string | null) => set({ error }),

  clearError: () => set({ error: null }),
}));
