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
       * Global: 80% statements / branches / functions / lines.
       * Hot-spot directories (security primitives, server-side BFF
       * code, and the PII / formatter / validator utility modules)
       * must hit 95% because regressions there silently break
       * authentication, PII masking, or the Spring wire contract.
       *
       * Vitest supports per-glob overrides in the `thresholds` map
       * alongside the global numbers. Each glob is evaluated
       * independently — a drop under the per-path floor fails the
       * build even when the global floor is met.
       *
       * These floors are enforced by CI (see .github/workflows/ci.yml);
       * locally you can run `npm run test -- --coverage` to check.
       */
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
        'src/security/**': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        'src/lib/server/**': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        'src/utils/formatters.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        'src/utils/validators.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        'src/utils/pii.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
      },
    },
  },
});
