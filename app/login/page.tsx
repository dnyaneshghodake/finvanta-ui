'use client';

/**
 * FINVANTA CBS - Sign In (Tier-1 layout).
 *
 * Calls the BFF `POST /api/cbs/auth/login`. On HTTP 428 the backend has
 * signalled an MFA step-up and the BFF has stashed the challengeId in
 * the HttpOnly fv_mfa cookie; the browser is simply redirected to
 * /login/mfa which will POST the TOTP to complete the step-up and
 * materialise the session.
 *
 * Note: page-level metadata is exported from a separate layout or
 * generateMetadata in the route segment because this file is 'use client'.
 */

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios, { isAxiosError } from 'axios';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types/entities';

const loginSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(80, 'Username is too long'),
  password: z
    .string()
    .min(1, 'Password is required')
    .max(200, 'Password is too long'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface BffLoginOk {
  success: true;
  data: {
    user: User;
    expiresAt: number;
    csrfToken: string;
    businessDate?: string;
  };
  correlationId?: string;
}

interface BffLoginErr {
  success: false;
  errorCode: string;
  message: string;
  data?: {
    channel?: string;
    remainingAttempts?: number;
    lockoutDurationMinutes?: number;
  };
  correlationId?: string;
}

/** Discriminated union — axios sees the full shape via validateStatus. */
type BffLoginResponse = BffLoginOk | BffLoginErr;

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [error, setError] = useState<string | null>(() => {
    const reason = search.get('reason');
    if (reason === 'session_expired') return 'Your session has expired. Please sign in again.';
    if (reason === 'mfa_expired') return 'MFA challenge expired. Please sign in again to receive a new code.';
    if (reason === 'unauthorized') return 'You must sign in to access that page.';
    return null;
  });
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    setCorrelationId(null);
    try {
      const response = await axios.post<BffLoginResponse>(
        '/api/cbs/auth/login',
        { username: data.username, password: data.password },
        { withCredentials: true, validateStatus: () => true },
      );
      setCorrelationId(response.data?.correlationId ?? null);

      if (response.status === 428) {
        router.push('/login/mfa');
        return;
      }

      if (response.status !== 200 || !response.data?.success) {
        const err = response.data as BffLoginErr;
        let msg: string;

        // Map backend error codes to operator-friendly messages per
        // the Tier-1 CBS login contract.
        switch (err?.errorCode) {
          case 'ACCOUNT_LOCKED':
            msg = err.message || 'Account locked.';
            if (err.data?.lockoutDurationMinutes) {
              msg += ` Try again in ${err.data.lockoutDurationMinutes} minutes or contact your branch administrator.`;
            }
            break;
          case 'ACCOUNT_DISABLED':
            msg = 'Your account has been disabled. Contact your branch administrator for reactivation.';
            break;
          case 'PASSWORD_EXPIRED':
            msg = 'Your password has expired. Contact your branch administrator to reset it.';
            break;
          case 'RATE_LIMITED':
            msg = err.message || 'Too many login attempts. Please wait and try again.';
            break;
          default:
            msg = err?.message || 'Unable to sign in. Please check your credentials.';
            break;
        }

        // Surface remaining attempts before account lock (Tier-1 CBS UX).
        if (err?.data?.remainingAttempts !== undefined && err.errorCode !== 'ACCOUNT_LOCKED') {
          msg += ` (${err.data.remainingAttempts} attempt${err.data.remainingAttempts === 1 ? '' : 's'} remaining before account lock)`;
        }
        setError(msg);
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
        const msg = err.response?.data?.message || err.message;
        setError(msg || 'Network error. Please try again.');
        return;
      }
      setError(err instanceof Error ? err.message : 'Unexpected error.');
    }
  };

  return (
    <main id="cbs-main" className="h-screen grid md:grid-cols-2 grid-rows-[1fr_auto] bg-cbs-mist overflow-auto">
      <aside className="hidden md:flex flex-col justify-between bg-cbs-navy-900 text-white p-10">
        <div>
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="h-10 w-10 bg-white text-cbs-navy-900 flex items-center justify-center font-bold tracking-tight select-none"
            >
              FV
            </div>
            <div>
              <div className="text-sm uppercase tracking-widest text-cbs-navy-200">
                FINVANTA
              </div>
              <h2 className="text-xl font-semibold">Core Banking Platform</h2>
            </div>
          </div>
          <div className="mt-10 flex items-start gap-3 max-w-sm">
            <ShieldCheck size={20} strokeWidth={1.5} className="text-cbs-navy-300 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-cbs-navy-100 text-sm leading-relaxed">
              RBI-compliant Tier-1 core banking for CASA, Term Deposits, Loans,
              General Ledger, Clearing, and Maker-Checker workflow. All sign-ins
              are audited on an immutable SHA-256 hash chain.
            </p>
          </div>
        </div>
        <div className="text-xs text-cbs-navy-200 leading-relaxed">
          This system is for authorised users only. Activity is monitored and
          recorded in accordance with RBI IT Governance Direction 2023 and the
          bank&apos;s information security policy. Unauthorised access will be
          prosecuted under the IT Act, 2000.
        </div>
      </aside>

      <section className="flex items-center justify-center p-6 md:p-8 lg:p-12">
        <div className="w-full max-w-lg">
          {/* Mobile-only branding — aside is hidden below md breakpoint */}
          <div className="md:hidden mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div
                aria-hidden="true"
                className="h-8 w-8 bg-cbs-navy-800 text-white flex items-center justify-center text-xs font-bold select-none"
              >
                FV
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-cbs-steel-500">FINVANTA</div>
                <div className="text-sm font-semibold text-cbs-ink">Core Banking Platform</div>
              </div>
            </div>
            <p className="text-[10px] text-cbs-steel-400 leading-relaxed">
              Authorised users only. Activity monitored per RBI IT Governance
              Direction 2023. Unauthorised access prosecuted under IT Act, 2000.
            </p>
          </div>

          <h1 className="text-2xl font-semibold text-cbs-ink">Sign in</h1>
          <p className="mt-1 text-sm text-cbs-steel-600">
            Use your FINVANTA corporate credentials.
          </p>

          {/* WCAG 4.1.3 — live region always in DOM so AT announces dynamically */}
          <div aria-live="polite" aria-atomic="true">
            {error && (
              <div role="alert" className="mt-6 cbs-alert cbs-alert-error">
                <div className="font-semibold text-sm">Sign-in failed</div>
                <div className="mt-1 text-sm">{error}</div>
                {correlationId && (
                  <div className="mt-1 text-xs cbs-tabular">Ref: {correlationId}</div>
                )}
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="mt-6 space-y-5"
            noValidate
          >
            <div>
              <label htmlFor="username" className="cbs-field-label block mb-1">
                User ID
              </label>
              <input
                id="username"
                type="text"
                autoFocus
                autoComplete="username"
                spellCheck={false}
                autoCapitalize="none"
                className="cbs-input cbs-input-login"
                aria-invalid={!!errors.username}
                aria-describedby={errors.username ? 'username-error' : undefined}
                {...register('username')}
              />
              {errors.username && (
                <div id="username-error" className="mt-1 text-xs text-cbs-crimson-700" role="alert">
                  {errors.username.message}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="password" className="cbs-field-label block mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="cbs-input cbs-input-login"
                aria-invalid={!!errors.password}
                aria-describedby={
                  [errors.password ? 'password-error' : '', capsLockOn ? 'caps-lock-warn' : '']
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                onKeyUp={(e) => {
                  if (typeof e.getModifierState === 'function') {
                    setCapsLockOn(e.getModifierState('CapsLock'));
                  }
                }}
                onBlur={() => setCapsLockOn(false)}
                {...register('password')}
              />
              {capsLockOn && (
                <div id="caps-lock-warn" className="mt-1 text-xs text-cbs-gold-700 flex items-center gap-1">
                  <span aria-hidden="true">⇪</span> Caps Lock is ON
                </div>
              )}
              {errors.password && (
                <div id="password-error" className="mt-1 text-xs text-cbs-crimson-700" role="alert">
                  {errors.password.message}
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
                  Signing in{'\u2009'}…
                </>
              ) : (
                'Sign in'
              )}
            </button>

            {/* Tier-1 CBS: password resets are admin-initiated through the
                User Management maker-checker module, never self-service.
                No "Forgot password?" public link. */}
            <div className="flex items-center justify-between text-xs text-cbs-steel-600">
              <span>Password reset: contact branch administrator.</span>
              <span>v{process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'}</span>
            </div>
          </form>

          {/* Environment indicator — prevents accidental prod logins during testing */}
          {process.env.NEXT_PUBLIC_ENVIRONMENT &&
            process.env.NEXT_PUBLIC_ENVIRONMENT !== 'production' && (
              <div className="mt-4 text-center">
                <span className="cbs-ribbon text-cbs-gold-700 bg-cbs-gold-50">
                  {process.env.NEXT_PUBLIC_ENVIRONMENT.toUpperCase()} ENVIRONMENT
                </span>
              </div>
            )}
        </div>
      </section>

      {/* Copyright footer — CBS regulatory requirement.
          col-span-full so it spans both grid columns on md+ screens.
          Sits in the natural document flow (not fixed) to avoid
          overlapping form content on short viewports. */}
      <footer className="col-span-full py-2 text-center text-[10px] text-cbs-steel-400 border-t border-cbs-steel-100">
        © {new Date().getFullYear()} FINVANTA Financial Technologies Pvt. Ltd. All rights reserved.
      </footer>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="h-screen flex items-center justify-center bg-cbs-mist">
          <div className="text-center">
            <div
              aria-hidden="true"
              className="mx-auto h-10 w-10 bg-cbs-navy-800 text-white flex items-center justify-center font-bold select-none mb-3"
            >
              FV
            </div>
            <div className="cbs-skeleton cbs-skeleton-heading mx-auto" style={{ width: 120 }} />
          </div>
        </main>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
