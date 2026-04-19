'use client';

/**
 * FINVANTA CBS - MFA Step-Up.
 *
 * Second leg of the login handshake. The /api/cbs/auth/login call
 * returned 428 with the challengeId stashed in the HttpOnly fv_mfa
 * bridge cookie. We collect the 6-digit TOTP and POST it to
 * /api/cbs/auth/mfa/verify which completes the Spring handshake and
 * writes the encrypted session cookie. The challengeId itself is
 * never read by JS -- it rides the cookie.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios, { isAxiosError } from 'axios';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types/entities';

const mfaSchema = z.object({
  otp: z
    .string()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
});

type MfaForm = z.infer<typeof mfaSchema>;

interface MfaOk {
  success: true;
  data: { user: User; expiresAt: number; csrfToken: string; businessDate?: string };
  correlationId?: string;
}
interface MfaErr {
  success: false;
  errorCode: string;
  message: string;
  correlationId?: string;
}

/** Discriminated union — axios sees the full shape via validateStatus. */
type MfaResponse = MfaOk | MfaErr;

export default function MfaPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MfaForm>({
    resolver: zodResolver(mfaSchema),
    defaultValues: { otp: '' },
  });

  const onSubmit = async (data: MfaForm) => {
    setError(null);
    setCorrelationId(null);
    try {
      const response = await axios.post<MfaResponse>(
        '/api/cbs/auth/mfa/verify',
        { otp: data.otp },
        { withCredentials: true, validateStatus: () => true },
      );
      setCorrelationId(response.data?.correlationId ?? null);

      if (response.status !== 200 || !response.data?.success) {
        const err = response.data as MfaErr;
        if (err?.errorCode === 'INVALID_MFA_CHALLENGE') {
          router.push('/login?reason=mfa_expired');
          return;
        }
        setError(err?.message || 'OTP verification failed.');
        return;
      }

      useAuthStore.setState({
        user: response.data.data.user,
        csrfToken: response.data.data.csrfToken,
        expiresAt: response.data.data.expiresAt,
        businessDate: response.data.data.businessDate ?? null,
        isAuthenticated: true,
        isHydrated: true,
        isLoading: false,
        error: null,
      });
      router.push('/dashboard');
    } catch (err) {
      if (isAxiosError(err)) {
        setError(err.response?.data?.message || err.message);
        return;
      }
      setError(err instanceof Error ? err.message : 'Unexpected error.');
    }
  };

  return (
    <main id="cbs-main" className="min-h-screen flex items-center justify-center bg-cbs-mist p-6">
      <div className="w-full max-w-md cbs-surface">
        <div className="cbs-surface-header">
          <div className="text-sm font-semibold tracking-wide uppercase text-cbs-steel-700">
            Multi-Factor Authentication
          </div>
          <span className="cbs-ribbon text-cbs-violet-700 bg-cbs-violet-50">
            Step-Up
          </span>
        </div>
        <div className="cbs-surface-body space-y-4">
          <p className="text-sm text-cbs-steel-600">
            Enter the 6-digit time-based one-time password (TOTP) shown in your
            authenticator app. The code refreshes every 30 seconds.
          </p>

          {error && (
            <div
              role="alert"
              className="border border-cbs-crimson-600 bg-cbs-crimson-50 text-cbs-crimson-700 p-3 text-sm"
            >
              <div className="font-semibold">MFA verification failed</div>
              <div>{error}</div>
              {correlationId && (
                <div className="mt-1 text-xs cbs-tabular">Ref: {correlationId}</div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label htmlFor="otp" className="cbs-field-label block mb-1">
                One-Time Password
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="\d{6}"
                className="cbs-input cbs-tabular tracking-[0.5em] text-center text-lg"
                aria-invalid={!!errors.otp}
                aria-describedby={errors.otp ? 'otp-error' : undefined}
                {...register('otp')}
              />
              {errors.otp && (
                <div id="otp-error" className="mt-1 text-xs text-cbs-crimson-700" role="alert">
                  {errors.otp.message}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="cbs-btn cbs-btn-primary w-full text-sm uppercase tracking-wider"
              style={{ height: 36 }}
            >
              {isSubmitting ? 'Verifying\u2009…' : 'Verify & Sign In'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => router.push('/login')}
            className="w-full text-xs text-cbs-steel-600 hover:underline"
          >
            Cancel and return to sign-in
          </button>
        </div>
      </div>
    </main>
  );
}
