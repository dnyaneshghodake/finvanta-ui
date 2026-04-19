/**
 * Authentication service.
 *
 * All auth calls go through the Next.js BFF under /api/cbs/auth/**.
 * The BFF holds the JWT in a server-side encrypted session; the
 * browser only ever sees HttpOnly fv_sid + JS-readable fv_csrf
 * cookies. Nothing here touches localStorage.
 *
 * Mutating session endpoints (logout, extend, switch-branch) route
 * through the shared `apiClient` so the request interceptor
 * automatically attaches the `X-CSRF-Token` header (double-submit)
 * that the BFF route handlers enforce via `assertCsrf`. Pre-auth
 * calls (login, mfa/verify, me) use a dedicated axios instance
 * because the CSRF token either does not exist yet or is explicitly
 * rotated by the handler itself.
 */
import axios from "axios";
import { apiClient } from "./apiClient";
import type { LoginRequest, ApiResponse } from "@/types/api";
import type { User } from "@/types/entities";

export interface LoginBffResponse {
  user: User;
  expiresAt: number;
  csrfToken: string;
  /** Epoch ms when MFA was last verified; null if not yet verified. */
  mfaVerifiedAt?: number | null;
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
        username: credentials.username,
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
    // Routed through apiClient so the CSRF interceptor attaches
    // X-CSRF-Token — the BFF logout route now enforces CSRF to
    // prevent cross-origin logout attacks (CWE-352).
    const response = await apiClient.post<ApiResponse<null>>(
      "/auth/logout",
      {},
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

  // NOTE: Self-service password reset is intentionally absent.
  // Tier-1 CBS platforms never expose a public "forgot password"
  // flow to anonymous browsers -- an operator credential reset is an
  // admin-initiated maker-checker action under the User Management
  // module, governed by RBI Master Direction on IT Governance 2023
  // s8. If a reset path is ever reintroduced, it must live behind a
  // dedicated authenticated BFF route, not the catch-all proxy.
}

export const authService = new AuthService();
