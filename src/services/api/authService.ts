/**
 * Authentication service.
 *
 * All auth calls go through the Next.js BFF under /api/cbs/auth/**.
 * The BFF holds the JWT in a server-side encrypted session; the
 * browser only ever sees HttpOnly fv_sid + JS-readable fv_csrf
 * cookies. Nothing here touches localStorage.
 */
import axios from "axios";
import { apiClient } from "./apiClient";
import type {
  LoginRequest,
  ApiResponse,
  PasswordResetRequest,
  PasswordResetConfirm,
  RegisterRequest,
} from "@/types/api";
import type { User } from "@/types/entities";

export interface LoginBffResponse {
  user: User;
  expiresAt: number;
  csrfToken: string;
}

export interface MfaVerifyRequest {
  challengeId: string;
  otp: string;
}

export interface HeartbeatResponse {
  remainingSeconds: number;
  warning: boolean;
  expiresAt: number;
}

class AuthService {
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginBffResponse>> {
    const response = await axios.post<ApiResponse<LoginBffResponse>>(
      "/api/cbs/auth/login",
      {
        username: credentials.email || (credentials as { username?: string }).username,
        password: credentials.password,
        rememberMe: credentials.rememberMe,
      },
      {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
        timeout: 30000,
      },
    );
    return response.data;
  }

  async logout(): Promise<ApiResponse<null>> {
    const response = await axios.post<ApiResponse<null>>(
      "/api/cbs/auth/logout",
      {},
      { withCredentials: true },
    );
    return response.data;
  }

  async getCurrentUser(): Promise<ApiResponse<LoginBffResponse>> {
    const response = await axios.get<ApiResponse<LoginBffResponse>>(
      "/api/cbs/auth/me",
      { withCredentials: true },
    );
    return response.data;
  }

  async verifyMfa(data: MfaVerifyRequest): Promise<ApiResponse<null>> {
    const response = await axios.post<ApiResponse<null>>(
      "/api/cbs/auth/mfa/verify",
      data,
      { withCredentials: true },
    );
    return response.data;
  }

  async heartbeat(): Promise<ApiResponse<HeartbeatResponse>> {
    const response = await axios.get<ApiResponse<HeartbeatResponse>>(
      "/api/cbs/session/heartbeat",
      { withCredentials: true },
    );
    return response.data;
  }

  async extendSession(): Promise<ApiResponse<null>> {
    const response = await axios.post<ApiResponse<null>>(
      "/api/cbs/session/extend",
      {},
      { withCredentials: true },
    );
    return response.data;
  }

  async switchBranch(branchCode: string): Promise<ApiResponse<{ branchCode: string; branchName?: string }>> {
    const response = await axios.post<ApiResponse<{ branchCode: string; branchName?: string }>>(
      "/api/cbs/session/switch-branch",
      { branchCode },
      { withCredentials: true },
    );
    return response.data;
  }

  async register(data: RegisterRequest): Promise<ApiResponse<User>> {
    const response = await apiClient.post<ApiResponse<User>>(
      "/auth/register",
      data,
    );
    return response.data;
  }

  async requestPasswordReset(data: PasswordResetRequest): Promise<ApiResponse<null>> {
    const response = await apiClient.post<ApiResponse<null>>(
      "/auth/request-password-reset",
      data,
    );
    return response.data;
  }

  async resetPassword(data: PasswordResetConfirm): Promise<ApiResponse<null>> {
    const response = await apiClient.post<ApiResponse<null>>(
      "/auth/reset-password",
      data,
    );
    return response.data;
  }
}

export const authService = new AuthService();
