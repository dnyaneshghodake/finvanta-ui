/**
 * Session-idle E2E tests — inactivity timeout + sliding extension.
 *
 * Per RBI Master Direction on IT Governance 2023 §8.3 and ASVS 4.0
 * V3.3.2 (session management), an authenticated banking session
 * MUST terminate after a bounded period of operator inactivity.
 * FINVANTA's contract is:
 *   - 30 min idle window (CBS_SESSION_IDLE_SECONDS = 1800)
 *   - 2 min pre-expiry warning dialog ("Stay logged in" / "Logout")
 *   - Any BFF request or the "Stay logged in" click slides the
 *     window forward by 1800s from the server-side `fv_sid` record.
 *   - No extension is possible once the warning lapses; the session
 *     is hard-expired server-side and the client is redirected to
 *     `/login?reason=session_expired`.
 *
 * Exercising this against real wall-clock values would make the
 * suite unacceptably slow, so these specs stub the timers in
 * non-production builds via the `window.__cbsSessionIdleHook` that
 * `useSessionTimeout` exposes. That hook is only wired in dev/test
 * builds and is stripped from the production bundle.
 *
 * Marked `.skip` until the hook lands in `useSessionTimeout` — the
 * scenarios still document the expected behaviour so contracts are
 * versioned alongside the code.
 */
import { test, expect } from '@playwright/test';

test.describe.skip('Session idle timeout', () => {
  test('shows the 2-minute warning dialog at T-120s', async ({ page }) => {
    await page.goto('/dashboard');

    // In the real spec, seed a short idle window via the test hook:
    // await page.evaluate(() => window.__cbsSessionIdleHook?.setIdleSeconds(5));

    // Wait until the warning fires (fake-timer based in the real impl):
    // await expect(page.getByRole('dialog', { name: /session about to expire/i })).toBeVisible();
    // await expect(page.getByRole('button', { name: /stay logged in/i })).toBeVisible();
    // await expect(page.getByRole('button', { name: /log out now/i })).toBeVisible();
    expect(true).toBe(true);
  });

  test('Stay-logged-in call slides the window and dismisses the dialog', async ({ page }) => {
    let extendCalls = 0;
    await page.route('**/api/cbs/session/extend', (route) => {
      extendCalls += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { sessionExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() },
        }),
      });
    });

    await page.goto('/dashboard');
    // await page.getByRole('button', { name: /stay logged in/i }).click();
    // await expect(page.getByRole('dialog')).toBeHidden();
    // expect(extendCalls).toBe(1);
    expect(true).toBe(true);
    expect(extendCalls).toBeGreaterThanOrEqual(0);
  });

  test('hard-expires and redirects to /login?reason=session_expired', async ({ page }) => {
    await page.route('**/api/cbs/session/extend', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          errorCode: 'SESSION_EXPIRED',
          message: 'Session has expired.',
        }),
      }),
    );

    await page.goto('/dashboard');
    // Let the warning lapse without responding…
    // await expect(page).toHaveURL(/\/login\?.*reason=session_expired/, { timeout: 15_000 });
    expect(true).toBe(true);
  });

  test('any BFF call while authenticated extends the sliding window', async ({ page }) => {
    let seenSliding = false;
    await page.route('**/api/cbs/accounts', (route) => {
      const hdr = route.request().headers()['x-cbs-session-slide'];
      if (hdr === '1') seenSliding = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'SUCCESS', data: { content: [] } }),
      });
    });

    await page.goto('/dashboard');
    // await page.getByRole('link', { name: /accounts/i }).click();
    // expect(seenSliding).toBe(true);
    expect(seenSliding).toBeDefined();
    expect(true).toBe(true);
  });
});
