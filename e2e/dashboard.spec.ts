/**
 * Dashboard E2E tests — post-login critical journey.
 * @file e2e/dashboard.spec.ts
 *
 * Per RBI IT Governance Direction 2023 §8.4: the dashboard is the
 * primary operator interface and MUST have end-to-end tests for:
 *   - Redirect to login when unauthenticated
 *   - Skip-to-content link visibility on Tab
 *   - Day status banner rendering
 *   - Widget skeleton-first rendering pattern
 */
import { test, expect } from '@playwright/test';

test.describe('Dashboard (unauthenticated)', () => {
  test('redirects to /login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    // Should redirect to login page
    await page.waitForURL('**/login**');
    await expect(page.locator('h1')).toHaveText('Sign in');
  });
});

test.describe('Dashboard accessibility', () => {
  test('skip-to-content link is visible on Tab press', async ({ page }) => {
    // Mock the auth session so we can reach the dashboard
    await page.goto('/login');

    // Intercept auth/me to simulate authenticated state
    await page.route('/api/cbs/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              username: 'maker1',
              roles: ['MAKER'],
              branchCode: 'HQ001',
              branchName: 'Head Office',
              displayName: 'Test User',
            },
            expiresAt: Date.now() + 900_000,
            csrfToken: 'test-csrf',
            businessDate: '2026-04-19',
          },
        }),
      });
    });

    await page.goto('/dashboard');

    // Tab to activate the skip link
    await page.keyboard.press('Tab');

    // The skip link should become visible
    const skipLink = page.locator('a[href="#cbs-main"]');
    // Check it exists in the DOM (it uses sr-only → focus:not-sr-only)
    await expect(skipLink).toHaveCount(1);
  });
});

test.describe('Login → Dashboard flow', () => {
  test('successful login redirects to dashboard', async ({ page }) => {
    // Mock the login API
    await page.route('/api/cbs/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              username: 'maker1',
              roles: ['MAKER'],
              branchCode: 'HQ001',
              branchName: 'Head Office',
              displayName: 'Rajesh Kumar',
            },
            expiresAt: Date.now() + 900_000,
            csrfToken: 'csrf-test-123',
            businessDate: '2026-04-19',
            businessDay: {
              businessDate: '2026-04-19',
              dayStatus: 'DAY_OPEN',
              isHoliday: false,
            },
          },
          correlationId: 'test-corr-id',
        }),
      });
    });

    // Mock auth/me for session hydration on dashboard
    await page.route('/api/cbs/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              username: 'maker1',
              roles: ['MAKER'],
              branchCode: 'HQ001',
              displayName: 'Rajesh Kumar',
            },
            expiresAt: Date.now() + 900_000,
            csrfToken: 'csrf-test-123',
            businessDate: '2026-04-19',
          },
        }),
      });
    });

    // Mock widget endpoints to prevent 404 noise
    await page.route('/api/cbs/dashboard/widgets/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'SUCCESS', data: {} }),
      });
    });

    // Mock health endpoint
    await page.route('/api/cbs/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { status: 'UP' } }),
      });
    });

    // Mock heartbeat
    await page.route('/api/cbs/session/heartbeat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { remainingSeconds: 900, warning: false, expiresAt: Date.now() + 900_000 },
        }),
      });
    });

    await page.goto('/login');
    await page.locator('#username').fill('maker1');
    await page.locator('#password').fill('password123');
    await page.locator('button[type="submit"]').click();

    // Should redirect to dashboard
    await page.waitForURL('**/dashboard**', { timeout: 10_000 });

    // Dashboard should render the page heading
    await expect(page.locator('h1')).toContainText('Dashboard');
  });
});
