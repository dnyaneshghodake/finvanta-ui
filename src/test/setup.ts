/**
 * Vitest global test setup.
 * @file src/test/setup.ts
 *
 * Initialises jsdom environment, stubs browser APIs not available
 * in Node, and provides CBS-specific test helpers.
 */
import { afterEach, vi } from 'vitest';

// ── Stub browser APIs ──────────────────────────────────────────────

// matchMedia — used by responsive hooks and Tailwind runtime
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// crypto.randomUUID — used by correlation-id generation
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: () => '00000000-0000-4000-8000-000000000000',
      getRandomValues: <T extends ArrayBufferView>(arr: T): T => {
        const bytes = new Uint8Array(arr.buffer);
        for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
        return arr;
      },
    },
  });
}

// ── Clean up after each test ───────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});
