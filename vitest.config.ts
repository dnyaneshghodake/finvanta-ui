/**
 * Vitest configuration for FINVANTA CBS.
 *
 * @file vitest.config.ts
 *
 * Per RBI IT Governance Direction 2023 section 8.4, all financial
 * computation modules, access-control logic, and session-management
 * code MUST have automated regression tests. This config covers:
 *
 *   - Unit tests (src/... /*.test.ts) via Vitest.
 *   - React component tests via @testing-library/react.
 *   - Path aliases matching tsconfig.json.
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/store': path.resolve(__dirname, './src/store'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/constants': path.resolve(__dirname, './src/constants'),
      '@/security': path.resolve(__dirname, './src/security'),
      '@/modules': path.resolve(__dirname, './src/modules'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e/**'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'html'],
      include: [
        'src/utils/**',
        'src/security/**',
        'src/store/**',
        'src/services/api/**',
        'src/hooks/**',
      ],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/**/index.ts',
      ],
      /**
       * Coverage floors (per the Tier-1 CBS hardening audit).
       *
       * Target: 80% global / 95% per-hotspot once the remaining
       * service + hook suites land. Floors here are set to the
       * CURRENT baseline on `enhancements` so the gate fails LOUDLY
       * on any regression while we ratchet up. Each next PR that
       * adds tests should also bump the matching floor.
       *
       * Vitest supports per-glob overrides in the `thresholds` map.
       * Each glob is evaluated independently — a drop under the
       * per-path floor fails the build even when the global floor
       * is met.
       *
       * Enforced by CI in .github/workflows/ci.yml. Locally:
       * `npm run test:coverage`.
       */
      thresholds: {
        // Global baseline — matches current 32% lines / 71% fn /
        // 93% branches on enhancements. Ratchet these up once the
        // service + hook suites are extended.
        statements: 30,
        branches: 80,
        functions: 70,
        lines: 30,
        // Hot-spot directories (security primitives, BFF server
        // code, the PII / formatter / validator modules). 95% is
        // the target; current baseline is captured below with a
        // FIXME so the ratchet path is visible.
        'src/security/**': {
          // FIXME: 92.85% branches today — ratchet to 95% when
          // the remaining roleGuard edge cases are covered.
          statements: 95,
          branches: 90,
          functions: 95,
          lines: 95,
        },
        'src/lib/server/**': {
          // FIXME: most lib/server files have partial coverage;
          // the floors here stay at the current baseline so the
          // hardening PR bootstraps CI without silent regression.
          statements: 20,
          branches: 70,
          functions: 50,
          lines: 20,
        },
        'src/utils/formatters.ts': {
          // FIXME: 92.45% branches — one currency-fallback path
          // is uncovered. Raise to 95% in the follow-up.
          statements: 95,
          branches: 90,
          functions: 95,
          lines: 95,
        },
        'src/utils/validators.ts': {
          // FIXME: validators.ts has 0 tests today. The follow-up
          // PR should add a suite and raise this to 95.
          statements: 0,
          branches: 0,
          functions: 0,
          lines: 0,
        },
        'src/utils/pii.ts': {
          // New in this PR; covered by src/utils/__tests__/pii.test.ts.
          // Lines 130-137 cover the sha256Hex().catch() rescue path
          // which is only taken when crypto.subtle.digest rejects
          // (e.g. a missing WebCrypto implementation). Simulating
          // that requires mocking globalThis.crypto, which is
          // brittle in jsdom; leaving it uncovered for this PR and
          // tracking the follow-up in the PR body.
          statements: 90,
          branches: 90,
          functions: 95,
          lines: 90,
        },
      },
    },
  },
});
