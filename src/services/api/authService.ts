/**
 * Authentication service for CBS Banking Application
 * @file src/services/api/authService.ts
 *
 * Login endpoint is at the server root (/login), not under the /api prefix.
 * All other auth endpoints use the standard apiClient baseURL.
 */

import axios from 'axios';
import { apiClient } from './apiClient';
import {
  LoginRequest,
  RegisterRequest,
  PasswordResetRequest,
  PasswordResetConfirm,
  ApiResponse,
} from '@/types/api';
import { User, AuthToken } from '@/types/entities';

/**
 * Base URL for the backend server (without /api prefix).
 * Login sits at the server root: POST http://localhost:8080/login
 */
const SERVER_BASE_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8080';

/**
 * Authentication API service
 */
class AuthService {
  /**
   * Login user with email and password.
   *
   * The Spring Boot login endpoint lives at /login on the server root,
   * NOT under the /api prefix, so we use a standalone axios call.
   */
  async login(credentials: LoginRequest): Promise<ApiResponse<AuthToken>> {
    const response = await axios.post<ApiResponse<AuthToken>>(
      `${SERVER_BASE_URL}/login`,
      credentials,
      {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
        timeout: 30000,
      }
    );
    return response.data;
  }

  /**
   * Register new user
   */
  async register(data: RegisterRequest): Promise<ApiResponse<User>> {
    const response = await apiClient.post<ApiResponse<User>>(
      '/auth/register',
      data
    );
    return response.data;
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<ApiResponse<AuthToken>> {
    const response = await apiClient.post<ApiResponse<AuthToken>>(
      '/auth/refresh',
      { refreshToken }
    );
    return response.data;
  }

  /**
   * Logout user
   */
  async logout(): Promise<ApiResponse<null>> {
    const response = await apiClient.post<ApiResponse<null>>('/auth/logout');
    return response.data;
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(data: PasswordResetRequest): Promise<ApiResponse<null>> {
    const response = await apiClient.post<ApiResponse<null>>(
      '/auth/request-password-reset',
      data
    );
    return response.data;
  }

  /**
   * Reset password with token
   */
  async resetPassword(data: PasswordResetConfirm): Promise<ApiResponse<null>> {
    const response = await apiClient.post<ApiResponse<null>>(
      '/auth/reset-password',
      data
    );
    return response.data;
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<ApiResponse<User>> {
    const response = await apiClient.get<ApiResponse<User>>('/auth/me');
    return response.data;
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<ApiResponse<null>> {
    const response = await apiClient.post<ApiResponse<null>>(
      '/auth/verify-email',
      { token }
    );
    return response.data;
  }

  /**
   * Resend email verification
   */
  async resendEmailVerification(email: string): Promise<ApiResponse<null>> {
    const response = await apiClient.post<ApiResponse<null>>(
      '/auth/resend-verification',
      { email }
    );
    return response.data;
  }

  /**
   * Enable MFA
   */
  async enableMFA(): Promise<ApiResponse<{ qrCode: string; secret: string }>> {
    const response = await apiClient.post<ApiResponse<{ qrCode: string; secret: string }>>(
      '/auth/mfa/enable'
    );
    return response.data;
  }

  /**
   * Verify MFA
   */
  async verifyMFA(code: string): Promise<ApiResponse<null>> {
    const response = await apiClient.post<ApiResponse<null>>(
      '/auth/mfa/verify',
      { code }
    );
    return response.data;
  }
}

export const authService = new AuthService();
