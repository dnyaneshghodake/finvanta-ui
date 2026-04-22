# Changelog

All notable changes to the FINVANTA CBS UI are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Per RBI IT Governance 2023 §8: all UI changes that affect operator
workflow, data presentation, or security controls must be traceable
to a versioned release with an auditable change description.

---

## [0.2.0] — 2025-07-15

### Added

#### L0 — Design Tokens
- **Spacing scale** (4px base, 0–64px) as CSS custom properties and TS module
- **Elevation / shadow scale** (none through xl) — overlays only, no shadows on data surfaces
- **Z-index layering scale** (base through skip-link) — eliminates magic numbers
- **Motion / transition tokens** (instant through slow, enter/exit durations, easing)
- **Semantic status colour aliases** (success/error/warning/info/workflow) — enables per-tenant theming
- **Programmatic token module** (`src/tokens/index.ts`) — TS-consumable mirror of CSS tokens

#### L2 — Atom Components
- **Select** — native `<select>` wrapper with label, error, placeholder, ARIA
- **Textarea** — narration/remarks field with character counter and ARIA
- **Checkbox** — CBS-styled with label, error, disabled states
- **RadioGroup** — fieldset/legend grouping, vertical/horizontal layout
- **Pagination** — "Page X of Y" with page size selector, monospace tabular-nums
- **Modal** — headless primitive with React portal, focus trap, Escape/backdrop dismiss, body scroll lock, compound sub-components (Header/Body/Footer)
- **Skeleton** — typed wrapper for CBS shimmer loading placeholders (text/heading/cell/card/circle variants)
- **Tooltip** — CSS-only positioning (top/bottom/left/right), visible on hover AND keyboard focus (WCAG)
- **MaskedField** — PII display with copy prevention, auto-hide reveal toggle

#### L3 — Composite Components
- **ConfirmationDialog** — destructive action gate with severity levels, focus trap, detail lines
- **FormField** refactored — now accepts any child input (Select, RadioGroup, AmountField), backward-compatible

#### L4 — Banking Domain Components
- **AmountField** — monospace right-aligned, INR lakh/crore grouping, currency prefix, limit display
- **StatusChip** — domain-aware status badge mapping CBS status codes to visual tones

#### Accessibility (§10)
- **`useFocusTrap` hook** — reusable focus trap with initial focus and focus-return
- **`prefers-contrast: high`** media query — boosted borders, thicker focus rings
- **`forced-colors: active`** media query — Windows High Contrast Mode fallbacks
- **SessionTimeoutWarning** refactored to use `useFocusTrap` instead of inline implementation

#### Security (§15)
- **PII masking utilities** (`src/utils/piiMask.ts`) — maskAadhaar, maskPAN, maskAccountNumber, maskPhone, maskEmail, maskGeneric
- **MaskedField component** — copy/cut prevention, user-select: none, auto-hide reveal

#### Multi-Tenant Theming (§13)
- **ThemeProvider** context — light/dark/high-contrast themes via `data-theme` attribute
- **Dark theme CSS** — full palette inversion for night-shift operators, no pure black, semantic tones preserved
- **`useTheme()` hook** — `{ theme, setTheme, toggleTheme }` for any component
- **localStorage persistence** — operator theme preference survives session restart

#### Performance (§14)
- **`lazyModule()` utility** — wraps `next/dynamic` with CBS loading skeleton and error boundary for per-module code splitting

#### L5 — Sidebar (Enterprise Navigation Panel)
- **Collapsed rail identity** — initials avatar with hover tooltip in 72px rail mode (Header is single source of truth for operator context in expanded mode)
- **Environment Badge** — PROD (red), UAT (amber), SIT (violet), DEV (olive) in sidebar footer
- **Active state 3px left border** — CBS convention for active module/item indication
- **`aria-expanded`** on expandable module buttons (WCAG 2.1 AA)
- **`aria-current="page"`** on active navigation links (exact match per ARIA spec)
- **Pinned search + footer** — only nav tree scrolls, search bar and env badge always visible
- **272px width** — matches Finacle sidebar standard
- **Collapsed rail mode (72px)** — icon-only sidebar with hover flyout tooltips for sub-items (Blueprint §9)
- **Navigation search (`Ctrl+K`)** — fuzzy substring search across all screens, role-filtered, combobox ARIA (Blueprint §7)
- **Auto-collapse below 1280px** — `matchMedia` listener auto-collapses on narrow desktops (Blueprint §15)
- **Collapse toggle** — `ChevronsLeft`/`ChevronsRight` button in sidebar footer + Header hamburger on desktop
- **Uppercase initials** — `firstName`/`lastName` initials now consistently uppercased (fixes Devin Review flag)

### Changed
- `SessionTimeoutWarning` now uses z-index token `var(--z-cbs-session)` instead of magic `z-[100]`
- `FormField` decoupled from `Input` — accepts `children` for any input type
- `RoleGate` accepts optional `userRoles` prop for §9-compliant pure rendering (backward-compatible store fallback)
- `Sidebar` width upgraded from 224px to 272px (Tier-1 CBS standard)
- `Sidebar` top offset corrected from 48px to 64px to match Header height
- `uiStore` — added `isSidebarCollapsed`, `toggleSidebarCollapse`, `setSidebarCollapsed` for desktop rail mode

### Fixed
- Session extend `resetTimer()` moved before async call to prevent modal deadlock on transient failure

### Security
- `POST /accounts/:acct/close` added to BFF endpoint allowlist (preparatory for account closure feature)

---

## [0.1.0] — 2025-07-01

### Added
- Initial CBS UI platform with Next.js 16, React 19, Tailwind v4
- Server-side session gate (`layout.tsx` → `DashboardShell.tsx` split)
- BFF proxy with endpoint allowlist (`endpointPolicy.ts`)
- CSRF double-submit protection
- Session timeout with countdown warning
- Backend health polling
- CBS keyboard navigation (F1–F10, Alt+shortcuts)
- Day-status context and operational banners
- Role-based rendering (`RoleGate`, `AdminPageGuard`)
- CBS error boundaries (page/widget/transaction levels)
- Print stylesheet for regulatory documents
- Core atoms: Button, Input, Card, Badge, Spinner, Alert
- Account service with Spring envelope mapping
- Transfer service with idempotency key lifecycle
- Zod response schema validation in API interceptor
