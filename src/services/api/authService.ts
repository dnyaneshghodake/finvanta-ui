/**
 * Authentication service.
 *
 * All auth calls go through the Next.js BFF under /api/cbs/auth/**.
 * The BFF holds the JWT in a server-side encrypted session; the
 * browser only ever sees HttpOnly fv_sid + JS-readable fv_csrf
 * cookies. Nothing here touches localStorage.
 *
 * Mutating session endpoints (extend, switch-branch) route through
 * the shared `apiClient` so the request interceptor automatically
 * attaches the `X-CSRF-Token` header (double-submit) that the BFF
 * route handlers enforce via `assertCsrf`. Pre-auth calls (login,
 * logout, mfa/verify, me) use a dedicated axios instance because
 * the CSRF token either does not exist yet or is explicitly rotated
 * by the handler itself.
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
    // Routed through apiClient so the CSRF interceptor attaches
    // X-CSRF-Token from the fv_csrf cookie -- the BFF route handler
    // rejects any POST without it (403 CSRF_REJECTED).
    const response = await apiClient.post<ApiResponse<null>>(
      "/session/extend",
      {},
    );
    return response.data;
  }

  async switchBranch(
    branchCode: string,
  ): Promise<ApiResponse<{ branchCode: string; branchName?: string }>> {
    // Same rationale as extendSession -- CSRF header must be present.
    const response = await apiClient.post<
      ApiResponse<{ branchCode: string; branchName?: string }>
    >("/session/switch-branch", { branchCode });
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
