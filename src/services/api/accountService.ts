/**
 * Account service for CBS Banking Application
 * @file src/services/api/accountService.ts
 */

import { apiClient } from './apiClient';
import { 
  ApiResponse, 
  PaginatedResponse,
  PaginationParams,
  TransferRequest 
} from '@/types/api';
import { Account, Transaction, Beneficiary } from '@/types/entities';

/**
 * Account API service
 */
class AccountService {
  /**
   * Get all accounts for current user
   */
  async getAccounts(params?: PaginationParams): Promise<ApiResponse<PaginatedResponse<Account>>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Account>>>(
      '/accounts',
      { params }
    );
    return response.data;
  }

  /**
   * Get account details by ID
   */
  async getAccount(accountId: string): Promise<ApiResponse<Account>> {
    const response = await apiClient.get<ApiResponse<Account>>(
      `/accounts/${accountId}`
    );
    return response.data;
  }

  /**
   * Get account balance
   */
  async getBalance(accountId: string): Promise<ApiResponse<{ balance: number; availableBalance: number }>> {
    const response = await apiClient.get<ApiResponse<{ balance: number; availableBalance: number }>>(
      `/accounts/${accountId}/balance`
    );
    return response.data;
  }

  /**
   * Get account statements/transactions
   */
  async getTransactions(
    accountId: string,
    params?: PaginationParams & { 
      startDate?: string;
      endDate?: string;
      transactionType?: string;
      minAmount?: number;
      maxAmount?: number;
    }
  ): Promise<ApiResponse<PaginatedResponse<Transaction>>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Transaction>>>(
      `/accounts/${accountId}/transactions`,
      { params }
    );
    return response.data;
  }

  /**
   * Get transaction details
   */
  async getTransaction(accountId: string, transactionId: string): Promise<ApiResponse<Transaction>> {
    const response = await apiClient.get<ApiResponse<Transaction>>(
      `/accounts/${accountId}/transactions/${transactionId}`
    );
    return response.data;
  }

  /**
   * Create account
   */
  async createAccount(data: {
    accountType: string;
    currency: string;
  }): Promise<ApiResponse<Account>> {
    const response = await apiClient.post<ApiResponse<Account>>(
      '/accounts',
      data
    );
    return response.data;
  }

  /**
   * Close account
   */
  async closeAccount(accountId: string): Promise<ApiResponse<null>> {
    const response = await apiClient.post<ApiResponse<null>>(
      `/accounts/${accountId}/close`
    );
    return response.data;
  }

  /**
   * Transfer funds
   */
  async transfer(accountId: string, data: TransferRequest): Promise<ApiResponse<Transaction>> {
    const response = await apiClient.post<ApiResponse<Transaction>>(
      `/accounts/${accountId}/transfer`,
      data
    );
    return response.data;
  }

  /**
   * Get beneficiaries
   */
  async getBeneficiaries(params?: PaginationParams): Promise<ApiResponse<PaginatedResponse<Beneficiary>>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Beneficiary>>>(
      '/beneficiaries',
      { params }
    );
    return response.data;
  }

  /**
   * Add beneficiary
   */
  async addBeneficiary(data: Omit<Beneficiary, 'id' | 'customerId' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Beneficiary>> {
    const response = await apiClient.post<ApiResponse<Beneficiary>>(
      '/beneficiaries',
      data
    );
    return response.data;
  }

  /**
   * Remove beneficiary
   */
  async removeBeneficiary(beneficiaryId: string): Promise<ApiResponse<null>> {
    const response = await apiClient.delete<ApiResponse<null>>(
      `/beneficiaries/${beneficiaryId}`
    );
    return response.data;
  }

  /**
   * Verify account for transfer
   */
  async verifyAccount(accountNumber: string, ifscCode: string): Promise<ApiResponse<{ accountHolder: string; bankName: string }>> {
    const response = await apiClient.post<ApiResponse<{ accountHolder: string; bankName: string }>>(
      '/accounts/verify',
      { accountNumber, ifscCode }
    );
    return response.data;
  }

  /**
   * Download account statement
   */
  async downloadStatement(
    accountId: string,
    params: {
      startDate: string;
      endDate: string;
      format: 'pdf' | 'csv' | 'excel';
    }
  ): Promise<Blob> {
    const response = await apiClient.get(
      `/accounts/${accountId}/statement`,
      { 
        params,
        responseType: 'blob'
      }
    );
    return response.data;
  }
}

export const accountService = new AccountService();
