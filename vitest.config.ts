/**
 * Vitest configuration for FINVANTA CBS.
 * @file vitest.config.ts
 *
 * Per RBI IT Governance Direction 2023 §8.4: all financial computation
 * modules, access-control logic, and session-management code MUST have
 * automated regression tests. This config covers:
 *   - Unit tests (src/**/*.test.ts) via Vitest
 *   - React component tests via @testing-library/react
 *   - Path aliases matching tsconfig.json
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
      thresholds: {
        // CBS audit minimum — increase as coverage grows
        statements: 40,
        branches: 30,
        functions: 40,
        lines: 40,
      },
    },
  },
});
