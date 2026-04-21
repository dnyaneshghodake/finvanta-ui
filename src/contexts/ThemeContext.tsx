/**
 * Theme Provider for CBS Banking Application.
 * @file src/contexts/ThemeContext.tsx
 *
 * Multi-tenant theming architecture per §13 of the Tier-1 CBS
 * Frontend Engineering specification. Supports:
 *   - light (default CBS operational theme)
 *   - dark (reduced eye-strain for night-shift operators)
 *   - high-contrast (WCAG AAA / branch kiosk environments)
 *   - per-tenant overrides (bankA, bankB, etc.)
 *
 * Theme switching works by toggling a `data-theme` attribute on
 * the <html> element. CSS custom properties in globals.css respond
 * to this attribute via `:root[data-theme="dark"]` selectors.
 * This approach:
 *   - Causes zero layout shift (only colours change)
 *   - Works with SSR (attribute set before hydration)
 *   - Is compatible with Tailwind v4 @theme
 *   - Requires no runtime CSS-in-JS
 *
 * The provider reads the initial theme from:
 *   1. `localStorage` (operator preference, persisted)
 *   2. `prefers-color-scheme` media query (OS default)
 *   3. Fallback: 'light'
 *
 * Per RBI IT Governance 2023 §8: theme switching must not alter
 * data presentation (amounts, dates, status codes). Only chrome
 * and surface colours change.
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type CbsTheme = 'light' | 'dark' | 'high-contrast';

export interface ThemeContextValue {
  /** Current active theme. */
  theme: CbsTheme;
  /** Switch to a specific theme. */
  setTheme: (theme: CbsTheme) => void;
  /** Cycle to the next theme (light → dark → high-contrast → light). */
  toggleTheme: () => void;
}

const THEME_ORDER: CbsTheme[] = ['light', 'dark', 'high-contrast'];
const STORAGE_KEY = 'cbs-theme';

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

/**
 * Read the initial theme from localStorage or OS preference.
 * Returns 'light' as the safe default for CBS environments.
 */
function getInitialTheme(): CbsTheme {
  if (typeof window === 'undefined') return 'light';

  // 1. Persisted operator preference
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && THEME_ORDER.includes(stored as CbsTheme)) {
    return stored as CbsTheme;
  }

  // 2. OS preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  if (window.matchMedia('(prefers-contrast: high)').matches) {
    return 'high-contrast';
  }

  return 'light';
}

/**
 * Apply the theme to the document element.
 * Sets `data-theme` attribute and `color-scheme` CSS property.
 */
function applyTheme(theme: CbsTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lazy initialiser reads localStorage/OS pref on first render.
  // This avoids the setState-inside-useEffect pattern that triggers
  // the react-hooks/set-state-in-effect lint rule.
  const [theme, setThemeState] = useState<CbsTheme>(getInitialTheme);

  // Sync the data-theme attribute to the DOM (external system).
  // This effect only handles the DOM side-effect; state is already
  // set by the lazy initialiser or by setTheme/toggleTheme.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setTheme = useCallback((newTheme: CbsTheme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newTheme);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const idx = THEME_ORDER.indexOf(current);
      const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
      applyTheme(next);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, next);
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access the current theme and theme-switching functions.
 *
 * Usage:
 *   const { theme, setTheme, toggleTheme } = useTheme();
 */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
