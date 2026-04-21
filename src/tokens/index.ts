/**
 * FINVANTA CBS Design Tokens — Programmatic Access
 * @file src/tokens/index.ts
 *
 * Single source of truth for all design tokens, mirroring the CSS
 * custom properties in `app/globals.css` @theme inline block.
 *
 * Why both CSS and TS?
 *   - CSS tokens: consumed by Tailwind v4 and static stylesheets.
 *   - TS tokens: consumed by React components that need computed
 *     values (e.g. AmountField precision, ThemeProvider overrides,
 *     chart libraries, PDF generation).
 *
 * INVARIANT: values here MUST match globals.css. If you change a
 * token, change it in both files. A future build step can generate
 * one from the other; until then, this is manually synchronised.
 *
 * Per RBI IT Governance 2023 §8: all visual presentation must be
 * deterministic and auditable. Hardcoded hex values in components
 * are a compliance finding — use tokens.
 */

// ── Colors ─────────────────────────────────────────────────────

export const colors = {
  navy: {
    50: '#f2f5fa',
    100: '#d9e1ef',
    200: '#b2c3df',
    300: '#7c95bf',
    400: '#4d6ca0',
    500: '#2d4f85',
    600: '#1f3a6b',
    700: '#162a50',
    800: '#0f1d3a',
    900: '#0a1429',
  },
  steel: {
    50: '#f6f7f9',
    100: '#e6e9ef',
    200: '#c8cfdb',
    300: '#9ba5b7',
    400: '#5e6a82',
    500: '#4f5a70',
    600: '#3a4457',
    700: '#2b3344',
    800: '#1e2432',
    900: '#141823',
  },
  ink: '#141823',
  paper: '#ffffff',
  mist: '#f6f7f9',
  gold: {
    50: '#fdf7e4',
    100: '#f7e9ae',
    600: '#a37300',
    700: '#7a5500',
  },
  olive: {
    50: '#edf7ec',
    100: '#cfe6cd',
    600: '#2f6b32',
    700: '#234f24',
  },
  crimson: {
    50: '#fbecec',
    100: '#f2c2c2',
    600: '#9a1d1d',
    700: '#741313',
  },
  violet: {
    50: '#ece9f7',
    100: '#cfc4ea',
    600: '#432e8a',
    700: '#2f206a',
  },
} as const;

// ── Semantic Status ────────────────────────────────────────────

export const status = {
  success: { bg: colors.olive[50], border: colors.olive[600], text: colors.olive[700] },
  error: { bg: colors.crimson[50], border: colors.crimson[600], text: colors.crimson[700] },
  warning: { bg: colors.gold[50], border: colors.gold[600], text: colors.gold[700] },
  info: { bg: colors.navy[50], border: colors.navy[200], text: colors.navy[700] },
  workflow: { bg: colors.violet[50], border: colors.violet[600], text: colors.violet[700] },
} as const;

// ── Typography ─────────────────────────────────────────────────

export const fonts = {
  sans: '"Inter", "IBM Plex Sans", "Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
  mono: '"JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

// ── Spacing ────────────────────────────────────────────────────

export const spacing = {
  0: '0px',
  px: '1px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
} as const;

// ── Border Radius ──────────────────────────────────────────────

export const radius = {
  sm: '2px',
  md: '4px',
  lg: '6px',
} as const;

// ── Elevation / Shadows ────────────────────────────────────────

export const shadows = {
  none: '0 0 #0000',
  sm: '0 1px 2px rgba(20, 24, 35, 0.06)',
  md: '0 2px 8px rgba(20, 24, 35, 0.10)',
  lg: '0 4px 16px rgba(20, 24, 35, 0.12)',
  xl: '0 4px 24px rgba(20, 24, 35, 0.15)',
} as const;

// ── Z-Index ────────────────────────────────────────────────────

export const zIndex = {
  base: 0,
  sticky: 1,
  dropdown: 30,
  sidebar: 40,
  header: 50,
  overlay: 60,
  modal: 100,
  toast: 110,
  session: 120,
  skipLink: 200,
} as const;

// ── Motion ─────────────────────────────────────────────────────

export const duration = {
  instant: '0ms',
  fast: '80ms',
  normal: '120ms',
  slow: '200ms',
  enter: '200ms',
  exit: '150ms',
} as const;

export const easing = {
  default: 'ease',
  in: 'ease-in',
  out: 'ease-out',
  inOut: 'ease-in-out',
} as const;

// ── CBS Banking Constants ──────────────────────────────────────
// These are not visual tokens but domain constants that multiple
// components need. Centralising them here avoids magic numbers.

export const cbsConstants = {
  /** Default currency for INR-denominated CBS. */
  defaultCurrency: 'INR',
  /** Decimal precision for INR amounts. */
  defaultPrecision: 2,
  /** CBS canonical date format for display. */
  dateFormat: 'DD-MMM-YYYY',
  /** CBS canonical timestamp format. */
  timestampFormat: 'DD-MMM-YYYY HH:mm',
  /** Monospace font feature settings for amount fields. */
  amountFontFeatures: '"tnum", "lnum"',
} as const;

// ── Aggregate Export ───────────────────────────────────────────

export const tokens = {
  colors,
  status,
  fonts,
  spacing,
  radius,
  shadows,
  zIndex,
  duration,
  easing,
  cbsConstants,
} as const;

export type CbsTokens = typeof tokens;
