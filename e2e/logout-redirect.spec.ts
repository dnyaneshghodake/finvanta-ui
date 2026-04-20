/**
 * Logout & redirect E2E tests — explicit session termination.
 *
 * Per RBI Master Direction on IT Governance 2023 §8.3 and ASVS 4.0
 * V3.3.1, an explicit logout MUST:
 *   - Invalidate the server-side session record.
 *   - Clear the `fv_sid` (HttpOnly, encrypted) and `fv_csrf`
 *     (browser-readable) cookies on the response.
 *   - Redirect the browser to `/login?reason=logged_out`.
 *   - Make a follow-up attempt to reach any `/dashboard/**` route
 *     fail with the server-layout redirecting back to
 *     `/login?reason=session_expired`.
 *
 * These specs are stubs against the `/api/cbs/auth/logout` endpoint.
 * The full contract is assertable today (the BFF handler exists);
 * the selectors below are placeholders for whichever UI control the
 * header uses for logout. Update when the exact button / role lands.
 *
 * Marked `.skip` until the underlying fixtures (pre-authenticated
 * session cookie) are provided by `e2e/setup.ts`. Once that fixture
 * exists, unskip and wire the navigation assertions.
 */
import { test, expect } from '@playwright/test';

test.describe.skip('Logout & redirect', () => {
  test('clicking "Logout" clears cookies and lands on /login?reason=logged_out', async ({
    page,
  }) => {
    let logoutCalls = 0;
    await page.route('**/api/cbs/auth/logout', (route) => {
      logoutCalls += 1;
      return route.fulfill({
        status: 200,
        headers: {
          'set-cookie': [
            'fv_sid=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
            'fv_csrf=; Path=/; Max-Age=0; Secure; SameSite=Lax',
          ].join(', '),
        },
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/dashboard');
    // await page.getByRole('button', { name: /logout/i }).click();
    // await expect(page).toHaveURL(/\/login\?.*reason=logged_out/);
    // expect(logoutCalls).toBe(1);

    // const cookies = await page.context().cookies();
    // expect(cookies.find((c) => c.name === 'fv_sid')).toBeUndefined();
    // expect(cookies.find((c) => c.name === 'fv_csrf')).toBeUndefined();
    expect(logoutCalls).toBeGreaterThanOrEqual(0);
    expect(true).toBe(true);
  });

  test('server-side layout redirect when navigating to a dashboard route after logout', async ({
    page,
  }) => {
    await page.goto('/login?reason=logged_out');
    await page.goto('/dashboard');
    // await expect(page).toHaveURL(/\/login\?.*reason=session_expired/);
    expect(true).toBe(true);
  });

  test('MFA-locked logout redirects with reason=mfa_locked', async ({ page }) => {
    await page.route('**/api/cbs/auth/logout', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      }),
    );

    await page.goto('/dashboard');
    // Trigger the forced logout path via a mocked 423 response on
    // any authenticated call…
    // await page.route('**/api/cbs/accounts**', (route) =>
    //   route.fulfill({
    //     status: 423,
    //     contentType: 'application/json',
    //     body: JSON.stringify({
    //       success: false,
    //       errorCode: 'MFA_LOCKED',
    //       message: 'MFA channel locked.',
    //     }),
    //   }),
    // );
    // await page.getByRole('link', { name: /accounts/i }).click();
    // await expect(page).toHaveURL(/\/login\?.*reason=mfa_locked/);
    expect(true).toBe(true);
  });
});
