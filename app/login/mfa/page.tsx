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
import { Loader2 } from 'lucide-react';
import type { User } from '@/types/entities';

const mfaSchema = z.object({
  otp: z
    .string()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
});

type MfaForm = z.infer<typeof mfaSchema>;

interface MfaOk {
  success: true;
  data: {
    user: User;
    expiresAt: number;
    csrfToken: string;
    businessDate?: string;
    businessDay?: { businessDate: string; dayStatus: string; isHoliday: boolean; previousBusinessDate?: string; nextBusinessDate?: string } | null;
    operationalConfig?: { baseCurrency: string; decimalPrecision: number; roundingMode: string; fiscalYearStartMonth: number; businessDayPolicy: string } | null;
    transactionLimits?: Array<{ transactionType: string; channel: string | null; perTransactionLimit: number; dailyAggregateLimit: number }> | null;
  };
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

/**
 * Max OTP attempts before forcing re-authentication.
 * Per API_LOGIN_CONTRACT.md §5: server locks at 5 failed OTP attempts
 * (failedLoginAttempts counter, starting from 0 after password phase
 * reset). Client redirects to login at 5 to match server lockout.
 */
const MAX_OTP_ATTEMPTS = 5;

export default function MfaPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [otpAttempts, setOtpAttempts] = useState(0);

  const {
    register,
    handleSubmit,
    setValue,
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

        // Per API_REFERENCE.md §2.2 — terminal MFA error codes that
        // require restarting the login flow from scratch.

        // Challenge expired or tampered — must restart login.
        if (err?.errorCode === 'INVALID_MFA_CHALLENGE') {
          router.push('/login?reason=mfa_expired');
          return;
        }

        // Challenge already consumed (replay detection) — restart login.
        if (err?.errorCode === 'MFA_CHALLENGE_REUSED') {
          router.push('/login?reason=mfa_expired');
          return;
        }

        // Account disabled/locked between password and MFA steps.
        if (err?.errorCode === 'ACCOUNT_INVALID') {
          router.push('/login?reason=account_invalid');
          return;
        }

        // Per API_LOGIN_CONTRACT.md §5: account locks at 5 failed OTP
        // attempts. Spring returns ACCOUNT_LOCKED when the threshold
        // is reached during the MFA phase.
        if (err?.errorCode === 'ACCOUNT_LOCKED') {
          router.push('/login?reason=account_locked');
          return;
        }

        // Track failed OTP attempts per API_LOGIN_CONTRACT.md §5.
        const attempts = otpAttempts + 1;
        setOtpAttempts(attempts);

        if (attempts >= MAX_OTP_ATTEMPTS) {
          setError('Too many invalid attempts. Please sign in again.');
          // Brief delay so the operator sees the message before redirect.
          setTimeout(() => router.push('/login'), 2000);
          return;
        }

        const remaining = MAX_OTP_ATTEMPTS - attempts;
        const msg = err?.message || 'Invalid OTP code.';
        setError(`${msg} ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
        // Clear the OTP input and re-focus for retry.
        setValue('otp', '');
        return;
      }

      // Tier-1 CBS pattern: cross the auth boundary with a full-page
      // navigation, NOT router.push. See app/login/page.tsx for the
      // same fix on the password flow — router.push triggers an RSC
      // payload fetch that races the just-set fv_sid cookie under
      // Turbopack dev, producing "TypeError: Failed to fetch RSC
      // payload" and a fallback redirect to ?reason=session_expired
      // immediately after a SUCCESSFUL MFA verify. window.location
      // forces the browser to re-evaluate cookies before the next
      // request fires. Authoritative auth state is rehydrated by the
      // dashboard via `loadSession()` against the fv_sid cookie.
      window.location.assign('/dashboard');
    } catch (err) {
      if (isAxiosError(err)) {
        setError(err.response?.data?.message || err.message);
        return;
      }
      setError(err instanceof Error ? err.message : 'Unexpected error.');
    }
  };

  return (
    <main id="cbs-main" className="min-h-screen flex flex-col items-center justify-center bg-cbs-mist p-6">
      {/* Minimal branding — confirms the operator is on the FINVANTA platform */}
      <div className="flex items-center gap-2 mb-4">
        <div
          aria-hidden="true"
          className="h-7 w-7 bg-cbs-navy-800 text-white flex items-center justify-center text-[10px] font-bold select-none"
        >
          FV
        </div>
        <span className="text-xs font-semibold text-cbs-steel-600 uppercase tracking-wider">
          FINVANTA CBS
        </span>
      </div>
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

          {/* WCAG 4.1.3 — live region always in DOM so AT announces dynamically */}
          <div aria-live="polite" aria-atomic="true">
            {error && (
              <div role="alert" className="cbs-alert cbs-alert-error">
                <div className="font-semibold text-sm">MFA verification failed</div>
                <div className="mt-1 text-sm">{error}</div>
                {correlationId && (
                  <div className="mt-1 text-xs cbs-tabular">Ref: {correlationId}</div>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label htmlFor="otp" className="cbs-field-label block mb-1">
                One-Time Password
              </label>
              <input
                id="otp"
                type="text"
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="\d{6}"
                className="cbs-input cbs-input-login cbs-tabular tracking-[0.5em] text-center text-lg"
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
              style={{ height: 40 }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  Verifying{'\u2009'}…
                </>
              ) : (
                'Verify & Sign In'
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={() => router.push('/login')}
            className="cbs-btn cbs-btn-secondary w-full text-xs"
          >
            Cancel and return to sign-in
          </button>
        </div>
      </div>
    </main>
  );
}
