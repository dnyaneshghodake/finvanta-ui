# Finvanta CBS Design System

> Authoritative reference for the Finvanta UI grid, spacing, typography,
> and component dimensions. All values are implemented in
> `app/globals.css` as CSS custom properties.

---

## 0. Token Architecture

All design tokens follow a strict 3-layer hierarchy:

```
Layer 1: Core Tokens (raw palette values)
  --color-cbs-navy-700: #162a50
  --color-cbs-crimson-600: #9a1d1d

Layer 2: Semantic Tokens (intent/meaning)
  --color-status-error-text: var(--color-cbs-crimson-700)
  --color-status-success-bg: var(--color-cbs-olive-50)

Layer 3: Component Tokens (specific usage)
  --comp-input-height: 34px
  --comp-btn-font-size: 13px
```

**Rules:**
- Components reference `--comp-*` or semantic tokens, never raw palette
- Semantic tokens reference core tokens via `var()`
- Changing a core token cascades through all layers automatically
- Dark mode works by overriding Layer 1 — Layers 2 and 3 adapt

All tokens live in `app/globals.css` inside the `@theme inline` block.
No separate JSON files — CSS custom properties ARE the single source
of truth. This avoids a build step and ensures the running code always
matches the token definitions.

---

## 1. Base Unit

```
Base Unit = 4px
```

All spacing, padding, margins, and gaps MUST be multiples of 4px.
No random values (13px, 22px, 37px). The spacing scale is defined
in `app/globals.css` as `--spacing-cbs-*` tokens.

| Token | Value | Usage |
|-------|-------|-------|
| `--spacing-cbs-1` | 4px | Micro spacing, icon gaps |
| `--spacing-cbs-2` | 8px | Compact spacing, inline gaps |
| `--spacing-cbs-3` | 12px | Field internal padding |
| `--spacing-cbs-4` | 16px | Default spacing, form field gaps |
| `--spacing-cbs-6` | 24px | Section spacing, grid gutters |
| `--spacing-cbs-8` | 32px | Major section separation |
| `--spacing-cbs-12` | 48px | Page-level separation |

---

## 2. Grid System

### 12-Column Grid

```
Columns:        12
Gutter:         16–24px (Tailwind gap-4 to gap-6)
Content Max:    1320px (--layout-content-max-width)
```

Standard layouts:
- **8 + 4 split**: Form (col-span-8) + Risk/Summary panel (col-span-4)
- **6 + 6 split**: Two-column forms
- **12 full**: Tables, dashboards

### Breakpoints

```
≥1440px   → Full layout, sidebar expanded
1280–1439 → Sidebar auto-collapses to 72px rail
1024–1279 → Sidebar collapsed, content fills width
<1024     → Mobile drawer sidebar, single column
```

CBS is desktop-first. Mobile is supported but not the primary target.

---

## 3. App Shell Dimensions

| Element | Value | Token |
|---------|-------|-------|
| Header height | 64px | `--layout-header-height` |
| Sidebar expanded | 272px | `--layout-sidebar-expanded` |
| Sidebar collapsed | 72px | `--layout-sidebar-collapsed` |
| Content max-width | 1320px | `--layout-content-max-width` |
| Content padding | 24px (desktop) | `--layout-content-padding` |

### Why 272px sidebar (not 240px)?

The wider sidebar accommodates:
- Ctrl+K search bar with keyboard shortcut hint
- Environment badge (PROD/UAT/SIT/DEV) in footer
- Longer module labels (e.g., "Reconciliation Dashboard")
- Tier-1 CBS sidebars are typically 260–280px

### Content Width Ownership

The **DashboardShell owns the content width constraint.** The shell
applies `mx-auto max-w-[1320px]` to the `<main>` inner wrapper
(`app/(dashboard)/DashboardShell.tsx`). Page-level components under
`app/(dashboard)/*/page.tsx` MUST NOT apply their own `max-w-*` or
`mx-auto` — nesting the same constraint is a no-op in best case and
creates layout drift when the shell value changes.

**Rule:** page components own vertical rhythm (`space-y-4`,
`space-y-6`) and breakpoint-responsive column layouts only. Width
belongs to the shell.

---

## 4. Component Dimensions

### Inputs (Operator Screens)

```
Height:        34px (.cbs-input)
Padding:       0 10px
Font size:     13px
Border radius: 2px (--radius-cbs)
```

### Inputs (Login Screen)

```
Height:        40px (.cbs-input-login)
Padding:       0 12px
Font size:     14px
```

### Why 34px (not 40px)?

CBS operator screens prioritise data density. A teller processes
200+ transactions/day — every pixel of vertical space matters.
Actual Tier-1 CBS input heights range from 28–32px across major
platforms. Our 34px is already generous by CBS standards. The 40px
height is reserved for the login page where institutional trust
weight matters more than density.

### Buttons

```
Height:        34px (.cbs-btn)
Padding:       0 14px
Font size:     13px
Min width:     (content-driven, no fixed minimum)
Border radius: 2px
```

### Row Actions (Inline Table Buttons)

```
Height:        26px                  (h-[26px])
Padding:       0 8px                 (px-2)
Font size:     12px                  (text-xs)
Icon size:     12px + strokeWidth 1.75
Gap:           4px                   (gap-1)
Min width:     content-driven
Border radius: 2px
```

Used for View / Statement / Transfer / Freeze / KYC icon-only
actions inside `cbs-grid-table` rows. These are **compact derivatives
of `.cbs-btn-secondary`** — not a separate component — so they inherit
every state token (`--state-focus-ring`, `--state-disabled-opacity`)
from the parent button class.

**Disabled via day-status:** mutating row actions (Transfer, Freeze)
are gated by `isPostingAllowed` from `DayStatusContext`. When posting
is blocked, apply `opacity-40 pointer-events-none` AND
`aria-disabled={!isPostingAllowed}`. The `aria-disabled` is mandatory
for keyboard operators — `pointer-events-none` alone hides the button
from mouse clicks but not from Tab focus.

**Role-gated:** wrap in `<RoleGate roles={[...]}>` — never hide via
conditional rendering without the RoleGate. The component is the
single source of truth for who-can-see-what.

### Tables

```
Header row:    ~36px (padding 8px 10px)
Body row:      ~36px (padding 8px 10px)
Font size:     13px body / 11px headers (uppercase)
Zebra:         Even rows use --color-cbs-mist
Hover:         Background shift only (no animation)
```

**Two table implementations — when to use which:**

| Implementation | Use for | Capabilities |
|----------------|---------|--------------|
| `<table className="cbs-grid-table">` | Simple inquiry/search results, ≤ 200 rows, no client-side sort | Plain HTML semantics, zero-JS overhead, a11y-by-default |
| `<CbsDataGrid columns={...} rows={...} />` | Complex lists with sort/pagination/virtualization, ≥ 200 rows | Typed column defs, `CbsSort`/`CbsPagination`, zebra + hover + loading states |

Wrap either in `<div className="overflow-x-auto">` so narrow viewports
scroll horizontally rather than reflowing the row.

Status cells use `<StatusRibbon status="..." />` — never render status
strings directly. Row actions go in the last column, right-aligned,
wrapped in `<div className="inline-flex items-center gap-1">` (see
"Row Actions" below).

### Modals

```
Small:   400px (.cbs-modal-sm)
Medium:  560px (.cbs-modal-md)
Large:   720px (.cbs-modal-lg)
Padding: 14px body, 10px 14px header/footer
```

### Cards / Surfaces

```
Padding:       14px (.cbs-surface-body)
Border radius: 4px (--radius-cbs-md)
Border:        1px solid --color-cbs-steel-200
Shadow:        none (data surfaces are flat)
```

---

## 5. Typography Scale

```
9px   → calendar day-of-week labels
10px  → environment badge, helper text, timestamps
11px  → field labels (uppercase), table headers, breadcrumbs
12px  → tabs, compact body text, row-action buttons
13px  → default body text, inputs, buttons, table cells
14px  → login inputs, section descriptions
16px  → section titles, page subtitles
18px  → page headings (h1) — see §13b Page Heading Rule
24px  → KPI values (dashboard)
```

**Tailwind class mapping:**
- `text-[10px]` → 10px  (helper text, environment badge)
- `text-[11px]` (or `cbs-field-label`) → 11px  (uppercase labels)
- `text-xs` → 12px  (tabs, compact body, row actions)
- `text-sm` → 14px  (login inputs, surface header label)
- `text-base` → 16px  (default body)
- `text-lg` → 18px  (**h1 page headings — always this, never `text-xl`**)

Font stack: Inter → IBM Plex Sans → system sans-serif
Mono stack: JetBrains Mono → IBM Plex Mono → system monospace

Amounts and dates always use `font-variant-numeric: tabular-nums`
via the `.cbs-tabular` or `.cbs-amount` utility classes.

### Utility Classes

| Class | Purpose |
|-------|---------|
| `cbs-tabular` | Tabular-nums for dates, IDs, phone numbers, CIFs |
| `cbs-amount` | Tabular-nums + right-aligned + mono for currency amounts |
| `cbs-field-label` | 11px uppercase tracking-0.04em — form field labels |
| `cbs-kbd` | Styled `<kbd>` for keyboard shortcut display (see §16c) |
| `cbs-no-print` | Hides element in `@media print` (see §10) |
| `cbs-skeleton-*` | Loading placeholder dimensions (matches real content) |

---

## 6. Icon Sizes

| Token | Size | Usage |
|-------|------|-------|
| `--icon-cbs-sm` | 14px | Inline with text (table cells, breadcrumbs, search) |
| `--icon-cbs-md` | 18px | Sidebar nav, form actions, button icons |
| `--icon-cbs-lg` | 24px | Page headers, empty states, error boundaries |
| `--icon-cbs-touch` | 32px | Minimum clickable area (WCAG 2.5.8) |

Stroke width convention:
- 14px icons: `strokeWidth={1.75}`
- 18px icons: `strokeWidth={1.75}`
- 24px icons: `strokeWidth={1.5}` (thinner at larger size)

---

## 7. Border Radius

```
--radius-cbs:    2px  → inputs, buttons, ribbons (default)
--radius-cbs-md: 4px  → cards, surfaces, modals, fieldsets
--radius-cbs-lg: 6px  → special containers (rare)
```

### Why 2–4px (not 8px)?

Tier-1 CBS platforms use minimal radius (0–4px across major
platforms). Most use completely square (0px) or near-square (2px)
corners for institutional visual weight.

8px radius signals "consumer SaaS app". 2–4px signals
"institutional banking tool". The distinction matters for operator
trust perception.

---

## 8. Colour Palette

| Token | Role |
|-------|------|
| `cbs-navy` | Primary chrome (header, nav, CTAs) |
| `cbs-steel` | Secondary surfaces (table headers, borders) |
| `cbs-ink` | Body copy |
| `cbs-paper` | Canvas background |
| `cbs-mist` | Zebra rows, sub-surfaces |
| `cbs-gold` | Warning, pending approval |
| `cbs-olive` | Success, posted |
| `cbs-crimson` | Error, rejected |
| `cbs-violet` | Maker-checker workflow |

No gradients. No shadows > md on data surfaces. Amounts render
in tabular-nums, right-aligned. Debit amounts in crimson, credit
in olive.

---

## 8b. Interaction State Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--state-hover-bg` | `rgba(20,24,35,0.04)` | Row hover, button hover overlay |
| `--state-active-bg` | `rgba(20,24,35,0.08)` | Button :active press |
| `--state-focus-ring` | `0 0 0 2px navy-100` | Focus ring on inputs, selects, textareas |
| `--state-focus-border` | `navy-500` | Border colour on focus |
| `--state-error-focus-ring` | `0 0 0 2px crimson-100` | Focus ring on invalid fields |
| `--state-error-focus-border` | `crimson-600` | Border colour on invalid focus |
| `--state-disabled-opacity` | `0.55` | Disabled buttons, inputs |

All component `:focus`, `:hover`, `[disabled]` states reference these
tokens. No inline `rgba()` or `opacity` values in component classes.

---

## 8c. CSS Architecture Layers

The stylesheet follows a strict 6-layer pipeline:

```
Layer 1: Tokens       → @theme inline block (Core → Semantic → Component → State)
Layer 2: Base         → body, html, :focus-visible, @media queries
Layer 3: Utilities    → Tailwind CSS (atomic) + .cbs-tabular, .cbs-amount, .cbs-no-print
Layer 4: Components   → .cbs-input, .cbs-btn, .cbs-surface, .cbs-grid-table, .cbs-modal
Layer 5: Layout       → React components (Sidebar, Header, DashboardShell) with Tailwind
Layer 6: Screens      → app/(dashboard)/*/page.tsx — composition only, no new CSS
```

**Enforcement rules:**
- No raw hex values in component code — always reference a token
- No inline `style={{}}` in React — always use CSS classes
- No `!important` — specificity is controlled by layer ordering
- Tailwind utilities for one-off layout; `.cbs-*` classes for multi-property components
- ARIA attributes as CSS state selectors (not custom `is-*` classes)

---

## 9. Critical Rules

- ❌ No pixel drift between components on the same row
- ❌ No inconsistent field heights within a form section
- ❌ No mixed padding values on sibling elements
- ❌ No random margins (always use the 4px-based scale)
- ❌ No different button sizes on the same screen
- ❌ No `rounded-full` on any interactive element
- ❌ No gradients on data surfaces
- ❌ No shadows on tables or form fields
- ✅ All amounts right-aligned, tabular-nums, monospace
- ✅ All dates in DD-MMM-YYYY format (e.g., 19-APR-2026)
- ✅ All labels uppercase, 11px, letter-spacing 0.04em
- ✅ Error states: border + background tint (not border-only)

---

## 10. Print

Per RBI IT Governance 2023 §8: posting confirmations, FD
certificates, and audit reports must print cleanly.

- `.cbs-no-print` hides sidebar, header, toasts, buttons
- Tables print at 10px with 2px solid header borders
- Amounts print in black (not colour-coded)
- Page size: A4 landscape with 15mm/10mm margins
- Signature lines for posting confirmations

See `app/globals.css` `@media print` block for full rules.

### Printable Components

| Component | Purpose | Print trigger |
|-----------|---------|---------------|
| `TransactionReceipt` | Counter-operation voucher — shows txn ref, amount, accounts, audit hash | `window.print()` via "Print Receipt" button (hidden in print via `cbs-no-print`) |
| Future: `FDCertificate` | FD booking certificate | TBD |
| Future: `StatementPdf` | Account statement | TBD |

**Contract for new printable components:**
1. Print-visible chrome goes in the root div. Non-print UI (buttons,
   filters) must carry `cbs-no-print`.
2. Amounts must render in `cbs-tabular cbs-amount` so column widths
   don't shift between screen and print.
3. Audit hash + correlation ID must appear in the footer of every
   receipt — these are the only ways IT support can trace a posting
   after the fact (RBI §8.5).
4. A "This is a computer-generated receipt. No signature required."
   footer line is mandatory per RBI digital-voucher guidance.

---

## 11. Token Governance

### Ownership

All token changes must be reviewed by the **Design Authority** (lead
frontend engineer or UX lead). No silent token changes in feature PRs.

### Versioning

Tokens are versioned implicitly via git history. Breaking changes
(any value change to a `--comp-*` or `--state-*` token) require:

1. PR title prefixed with `[DESIGN]`
2. Visual regression check on: Dashboard, Account Opening, Transfer,
   Workflow Queue, and Login screens
3. Dark mode verification (all 5 screens)

### Impact Analysis

Before changing any core token (`--color-cbs-*`):
- Verify all semantic tokens that reference it via `var()`
- Check both light and dark theme overrides
- Run the full Playwright E2E suite (visual assertions)

---

## 12. Accessibility Standards

All token choices are validated against **WCAG 2.1 AA** (minimum)
with AAA targets for critical financial data.

### Implemented in `globals.css`:

| Feature | Implementation | Reference |
|---------|---------------|-----------|
| Focus ring | `:focus-visible` with 2px navy-500 outline | `globals.css:368-371` |
| Reduced motion | `prefers-reduced-motion: reduce` kills all animation | `globals.css:374-383` |
| High contrast | `prefers-contrast: high` doubles border widths | `globals.css:390-420` |
| Forced colors | `forced-colors: active` maps to system colours | `globals.css:426-469` |
| Skip link | `.cbs-skip-link` visible on keyboard Tab | `globals.css:320-351` |
| Screen reader | `.sr-only` clip pattern | `globals.css:354-364` |
| Contrast | steel-400 bumped to 4.8:1 (AA compliant) | `globals.css:38-40` |

### Rules:

- All text/background combinations must pass **4.5:1** contrast (AA)
- Interactive elements must have **3:1** contrast against adjacent colours
- Focus indicators must be visible on both light and dark themes
- Error states must use **border + background tint** (not colour alone)
  for colour-blind operators
- Touch targets must be ≥ 32px (`--icon-cbs-touch`)
- All form fields must have associated `<label>` elements
- ARIA attributes are the CSS state selectors (not custom `is-*` classes)

---

## 13. Data Visualization Tokens

| Token | Colour | Usage |
|-------|--------|-------|
| `--chart-credit` | olive-600 | Credit flows, deposits, inflows |
| `--chart-debit` | crimson-600 | Debit flows, withdrawals, outflows |
| `--chart-neutral` | steel-400 | Neutral/baseline indicators |
| `--chart-primary` | navy-500 | Primary series, trend lines |
| `--chart-secondary` | navy-300 | Secondary series, comparisons |
| `--chart-warning` | gold-600 | Threshold breaches, SLA warnings |
| `--chart-grid` | steel-200 | Grid lines, axis ticks |
| `--chart-axis` | steel-500 | Axis labels |
| `--chart-label` | steel-600 | Data labels, legends |

### Rules:

- Credit = olive (green family), Debit = crimson (red family) — always
- Never use red/green alone to distinguish data — add pattern/shape
- Chart backgrounds must be `--color-cbs-paper` (not transparent)
- Amounts in chart tooltips must use `tabular-nums` monospace

---

## 13b. Screen Layout Conventions

CBS screens fall into four layout archetypes. Each has a canonical
shape — mixing layouts within a screen type is forbidden.

| Screen Type | Layout | Example |
|-------------|--------|---------|
| **Inquiry** | Dense sortable `<table className="cbs-grid-table">` with inline row actions. **No card grids.** Operators scan 20–50 rows and act from the row. | `/accounts`, `/customers`, `/workflow` |
| **Dashboard** | Role-gated KPI widget grid (12-column, `col-span-*`). Cards are appropriate here. | `/dashboard` |
| **Transaction** | 8+4 split: form (`col-span-8`) + risk/summary panel (`col-span-4`). Never a single-column form > 600px wide. | `/accounts/new`, `/transfers`, `/loans/apply` |
| **Detail** | 12-column full-width with tabbed sub-sections. Read-first; edit actions gated by role + day status. | `/accounts/:id`, `/customers/:id`, `/loans/:id` |

### Why inquiry = table (not card grid)?

Card grids trade density for visual appeal. A teller scanning 30
accounts on a card grid sees ~6 cards on screen; the same operator
scanning a `cbs-grid-table` sees 25+ rows. Every extra page of scroll
costs 3-5 seconds of operator time and increases the chance of
clicking the wrong account. **Density is a compliance feature.**

Inline row actions (see §4 "Row Actions") keep the operator anchored
to the correct row. Card grids force a context switch to a detail
page before any action can be taken.

### Page Heading Rule

Every page uses **exactly one `<h1>` at `text-lg` (18px)** per
DESIGN_SYSTEM §5 — not `text-xl`, not `text-2xl`. The 18px heading
size is the Tier-1 CBS convention: visible without dominating the
content area (operators look at amounts and tables, not titles).

```tsx
<h1 className="text-lg font-semibold text-cbs-ink">
  {Screen Name}
</h1>
```

Sub-headings on the same page use `text-sm font-semibold uppercase
tracking-wider text-cbs-steel-700` inside `.cbs-surface-header`.

---

## 14. Role-Based UI Density

CBS operators have different workflows requiring different UI density.
The canonical roles live in `src/types/entities.ts` as `UserRole` and
are shorthanded in `src/config/routes.ts`:

```
MAKER       = ['MAKER', 'TELLER', 'OFFICER']
CHECKER     = ['CHECKER', 'MANAGER', 'APPROVER']
ADMIN       = ['ADMIN', 'ADMIN_HO', 'BRANCH_ADMIN']
RECONCILER  = ['RECONCILER']
(plus)      AUDITOR
```

| Role family | Density | Characteristics |
|-------------|---------|----------------|
| **TELLER** | Dense | Compact tables, minimal whitespace, keyboard-optimised, high transaction throughput |
| **OFFICER/MAKER** | Standard | Balanced forms + tables, accordion sections, CIF lookup integration |
| **MANAGER/CHECKER/APPROVER** | Summary | KPI cards, approval queues, risk panels, graph-heavy dashboards |
| **AUDITOR** | Read-only | Audit trail emphasis, field-level change history, export-heavy |
| **RECONCILER** | Dense + read-heavy | Inter-branch and nostro/vostro reconciliation, GL inquiry, suspense entries (RBI Master Circular on Reconciliation) |
| **ADMIN/ADMIN_HO/BRANCH_ADMIN** | Configuration | Wide tables, bulk operations, settings forms |

### Implementation:

- Role gating is handled by `RoleGate` component and route-level `roles` arrays in `src/config/routes.ts`
- Screen layout (8+4 split, full-width table, KPI grid) is chosen per screen type (see §13b)
- The base component dimensions (34px inputs, 36px table rows, 26px row actions) are shared across all roles
- Role-specific density is achieved through **layout composition**, not component variants
- Dashboard widgets are blueprinted by role via `getVisibleWidgets(roles)` — see `src/components/dashboard/`

---

## 15. Performance Budget

| Metric | Target | Rationale |
|--------|--------|-----------|
| CSS bundle size | < 80KB (gzipped) | Single `globals.css` + Tailwind tree-shaking |
| First Contentful Paint | < 1.5s | Internal bank network (low latency, high bandwidth) |
| Time to Interactive | < 2.5s | Operator must be able to type within 2.5s of navigation |
| Cumulative Layout Shift | 0 | Financial data must never shift after render |
| Table render (1000 rows) | < 100ms | Virtualized via `CbsDataGrid` |
| Bundle size (JS) | < 300KB (gzipped) | Next.js standalone + tree-shaking |
| Session hydration | < 500ms | `loadSession()` from BFF `/auth/me` |

### Rules:

- No layout shift on financial data (amounts, balances, dates)
- Tables with > 50 rows must use virtualization or pagination
- Images are not used in operational screens (icons only via Lucide)
- No client-side date/number formatting libraries — use native
  `Intl.NumberFormat` and the `formatters.ts` utility functions
- Skeleton loading states for all async data (`.cbs-skeleton-*`)

---

## 16. Error Severity Hierarchy

CBS errors follow a strict 4-tier severity model. Each tier has
distinct visual treatment and UX behaviour:

| Severity | Tokens | Visual | UX Behaviour |
|----------|--------|--------|-------------|
| **INFO** | `--color-status-info-*` | Navy tint | Non-blocking banner or toast. Auto-dismisses after 5s. |
| **WARNING** | `--color-status-warning-*` | Gold tint | Persistent banner (e.g., day-status, password expiry). Operator can continue. |
| **ERROR** | `--color-status-error-*` | Crimson tint | Field-level: border + background tint + message below field. Form-level: alert block. Blocks submission until resolved. |
| **CRITICAL** | `--color-status-critical-*` | Dark crimson | **Blocking modal.** Operator cannot proceed. Used for: fraud alerts, system failures, "transaction may have been submitted" scenarios. |

### Implementation mapping:

| Severity | Components |
|----------|-----------|
| INFO | `.cbs-alert-info`, `.cbs-toast-info` |
| WARNING | `.cbs-alert-warning`, `.cbs-toast-warning`, `DayStatusBanner`, `PasswordExpiryBanner` |
| ERROR | `.cbs-alert-error`, `.cbs-toast-error`, `[aria-invalid="true"]` field states, `app/not-found.tsx` (404) |
| CRITICAL | `TransactionErrorBoundary` ("transaction may have been submitted"), `SessionTimeoutWarning` (blocking modal), `app/error.tsx` (unhandled runtime error boundary) |

### Next.js Error Boundary Pages

The App Router's built-in error contract is wired up as:

| File | Role | Reference shown to operator |
|------|------|------------------------------|
| `app/error.tsx` | Catch-all runtime error boundary (unhandled exceptions) | `error.digest` — Next.js server-generated ID that IT support can grep in server logs |
| `app/not-found.tsx` | 404 for unknown routes | The URL the operator attempted |

Both pages follow RBI IT Governance 2023 §8:
- No stack traces or file paths exposed in production
- Clear recovery action (retry / dashboard / sign in)
- A branded FV mark so operators know this is Finvanta-owned chrome
- Dev-only error message shown when `NODE_ENV !== 'production'`

**Why `error.digest` (not a client-generated ID)?**
The digest is generated server-side at the moment the error is thrown,
so it lives in the server log at the exact point of failure — the
trace IT support actually needs. A client-side `Date.now()` ID would
be disconnected from any server trace. The digest is also
React-Compiler-compliant (no impure calls during render).

### Granular Error Boundaries

Within the authenticated shell, three React Error Boundaries isolate
failures at progressively finer levels:

| Boundary | Scope | Behaviour on error |
|----------|-------|--------------------|
| `PageErrorBoundary` | Wraps `{children}` in `DashboardShell` — one screen at a time | Shell (sidebar, header, toasts) stays alive; only the content area is replaced with an inline error card. Operator can navigate away without a full reload. |
| `WidgetErrorBoundary` | Wraps each dashboard widget individually | A crash in one widget does not take down the other 8. The failed tile shows an inline error with the `moduleRef` (e.g. `PORTFOLIO`, `NPA`) for IT support. |
| `TransactionErrorBoundary` | Wraps transaction posting flows (transfers, FD booking, loan disbursement) | **CRITICAL**: shows a blocking modal stating "the transaction may or may not have been submitted — do not retry without checking status" per RBI §8.2. |

**Rule:** every new page under `app/(dashboard)/` is automatically
wrapped in `PageErrorBoundary` via the shell. New dashboard widgets
must be wrapped in `WidgetErrorBoundary` with a distinct `moduleRef`.
New transaction-posting flows **MUST** use `TransactionErrorBoundary`
around the mutating API call.

### Rules:

- CRITICAL errors **MUST** block transaction progression
- ERROR states **MUST** include border + background tint (not colour alone)
- WARNING banners **MUST** persist until the condition resolves
- INFO toasts **MUST** auto-dismiss (never accumulate)
- All severity levels use the semantic `--color-status-*` tokens

---

## 14b. Maker-Checker UI Components

Per RBI IT Governance 2023 §8.3 (segregation of duties) every
financial or master-data posting passes through maker → checker
approval. The UI renders this workflow via three dedicated components:

| Component | Purpose |
|-----------|---------|
| `ApprovalTrail` | Vertical timeline of maker submission → checker action(s) with timestamps, user IDs, and action remarks. Used on workflow detail pages and audit views. |
| `AuditTrailViewer` | Expandable per-transaction audit entries with maker/checker user IDs, submitted/approved timestamps, SLA badge, and field-level change diff. |
| `AuditHashChip` | Compact display of the SHA-256 audit hash prefix (first 12 hex chars) on transaction receipts and entry detail pages — the tamper-evidence proof. |
| `WorkflowStatusBadge` | Ribbon-sized status indicator for workflow items (`PENDING_CHECKER`, `APPROVED`, `REJECTED`, `RECALLED`). |
| `TransactionConfirmDialog` | Pre-submit modal showing all posting fields in read-only form; maker clicks Confirm to submit for checker approval. Bakes in correlation-ID and idempotency-key propagation. |
| `SubmitterIdentity` / `CheckerIdentity` | Read-only display of `makerUserId`/`checkerUserId` with timestamp — visible on every posted/approved entry. |

**Rules:**
- Every maker-checker workflow screen MUST render `ApprovalTrail` or
  `AuditTrailViewer` so the full chain is visible to operators
- Financial postings MUST show `AuditHashChip` on the receipt so the
  operator/customer can verify tamper-evidence later
- The maker cannot approve their own submission — this is enforced
  server-side but the UI MUST grey out the approve button when
  `checkerUserId === session.user.id && makerUserId === session.user.id`
  to avoid operator confusion

---

## 15a. Status Vocabulary (StatusRibbon)

`<StatusRibbon status="..." />` is the single source of truth for
entity status rendering. It maps status strings to tokenised colour
pairs so the palette stays consistent across modules.

| Status value | Tone | Usage |
|--------------|------|-------|
| `ACTIVE`, `OPEN`, `VERIFIED` | olive (success) | Live accounts, verified KYC |
| `POSTED`, `APPROVED`, `COMPLETED`, `SUCCESS` | olive (success) | Posted transactions, approved workflow items |
| `PENDING`, `PENDING_APPROVAL`, `PENDING_VERIFICATION` | gold (warning) | Maker submitted, awaiting checker |
| `HOLD`, `FROZEN`, `DORMANT` | gold (warning) | Operational holds |
| `REJECTED`, `FAILED`, `ERROR` | crimson (error) | Checker rejection, posting failure |
| `CLOSED`, `INACTIVE`, `DEACTIVATED` | steel (neutral) | Terminal states, archived records |
| `DRAFT`, `NEW` | navy (info) | Unsubmitted records |

**Rule:** never render a status string as plain text. Always use
`<StatusRibbon status={value} />`. Unknown statuses fall back to
steel (neutral) — the component never crashes on a new backend value.

**Mapping custom values:** when a backend returns a domain-specific
status (e.g. `NPA_STAGE_1`, `NPA_STAGE_2`, `NPA_STAGE_3`), map it to
one of the canonical values at the service-adapter layer
(`adaptX()` in `*Service.ts`) — don't add per-module mappings to
`StatusRibbon`.

---

## 15b. Domain Input Primitives

Form fields that represent regulated financial identifiers are NOT
built from `<input>` directly. They use domain primitives from
`src/components/cbs/primitives.tsx` that encapsulate format, validation,
and masking rules:

| Primitive | Domain | Format / Rule |
|-----------|--------|---------------|
| `AmountInr` | INR currency | Indian grouping `1,00,000.00`, tabular-nums, blur-normalised to plain decimal for Zod (`^\d+(\.\d{1,2})?$`) |
| `Pan` | Permanent Account Number | `AAAAA9999A` pattern, auto-uppercase, 10 chars max |
| `Aadhaar` | Aadhaar UID | 12 digits, grouped `XXXX XXXX XXXX`, masked after blur (see §15c) |
| `AccountNo` | Internal account number | `/^[A-Z]{2}-[A-Z0-9]{4,5}-\d{6}$/` (e.g. `SB-HQ001-000001`), uppercase, tabular-nums |
| `Ifsc` | IFSC code | `AAAA0NNNNNN` pattern (4 letters + 0 + 6 alnum), uppercase |
| `ValueDate` | Business date | ISO-8601 input; display DD-MMM-YYYY; validates against `businessDate` from session |

**Rule:** when a form field represents one of these domains, the
primitive **MUST** be used — never a raw `<input>` with manual
validation. The primitives own the format rule; screens own only
the label and role-gating.

**react-hook-form integration:** every primitive forwards refs and
calls `onChange`/`onBlur` with normalised (grouping-free) values so
Zod resolvers see clean strings. Display formatting is applied in
the primitive's local state and never stored in form state.

---

## 15c. PII Masking Conventions

Per RBI Cyber Security Framework 2023 §4.2 and IGA FATCA guidance:
sensitive identifiers must be masked on display by default. The
mask utilities in `src/components/cbs/primitives.tsx` enforce:

| Utility | Input | Masked output | When revealed |
|---------|-------|---------------|---------------|
| `maskPan` | `ABCDE1234F` | `ABCDE****F` (first 5 + last 1) | Never in list views; full value only on CIF detail page with audit log |
| `maskAadhaar` | `123456789012` | `XXXX XXXX 9012` (last 4 visible) | Never outside CIF detail; full value gated behind operator PIN re-auth |
| `maskMobile` | `+919876543210` | `+91******3210` (last 4 visible) | Revealed on customer detail only |
| `maskAccountNo` | `SB-HQ001-000042` | `SB-HQ001-***042` (last 3 visible) | Revealed on account detail; list views show full for internal ops |

**Rules:**
- List/search result views MUST use the masked form
- Transaction receipts use masked account numbers (printed copies)
- Exports (CSV, PDF) MUST use masked values unless the export itself
  is role-gated to AUDITOR/ADMIN_HO
- The unmask action **MUST** log a correlation-id'd audit event
- Never log unmasked PII to console/telemetry — use the masked form

---

## 15d. Navigation & URL Conventions

### Route Registry

All navigation paths live in `src/config/routes.ts` as the registry
`R`. Sidebar, breadcrumbs, contextual buttons, and `router.push()`
calls **MUST** reference the registry — never raw string literals.

```tsx
// ❌ NEVER
<Link href="/accounts/new">New Account</Link>

// ✅ ALWAYS
<Link href={R.accounts.create.path as string}>New Account</Link>

// ✅ Dynamic routes
<Link href={resolvePath(R.accounts.view, acct.id)}>
```

### Contextual Parameters via `buildUrl()`

Cross-module navigation (e.g. "Open Account" button on a CIF page,
"Freeze" button on an account row) **MUST** pass the selected
entity's ID via query param:

```tsx
// ✅ Correct
<Link href={buildUrl(R.accounts.freeze.path as string, {
  accountNumber: acct.accountNumber,
})}>

// ❌ Wrong — loses row context
<Link href={R.accounts.freeze.path as string}>
```

Target pages read parameters via `useSearchParams()`. This is
literally the pattern that fixed bugs #1 and #2 in PR #11 — row
actions without query context land on generic pages with no
entity selected, a compliance-critical UX failure.

### `returnTo` for Nested Flows

CBS operators traverse `Customer → Account Opening → Account Detail
→ back to Customer`. Without an explicit return path, Cancel/Back
can only go to the module list, losing context.

```tsx
// From CIF page, link to Open Account with returnTo:
<Link href={buildUrl(R.accounts.create.path as string,
  { customerId: String(c.id) },
  resolvePath(R.customers.view, String(c.id)),  // returnTo
)}>
  Open Account
</Link>

// On the Open Account page, Cancel button:
const searchParams = useSearchParams();
const back = getReturnTo(searchParams, R.customers.search.path as string);
<Button onClick={() => router.push(back)}>Cancel</Button>
```

**Security:** `getReturnTo` only accepts relative paths that start
with `/` and not `//` — no open-redirect.

### Breadcrumbs

Every authenticated page **MUST** render `<Breadcrumb items={[...]} />`
as its first visual element after any banner. The first item is always
the module root; the last item has no `href` (it's the current page).

```tsx
<Breadcrumb items={[
  { label: R.dashboard.home.label, href: R.dashboard.home.path as string },
  { label: R.accounts.list.label, href: R.accounts.list.path as string },
  { label: 'Account Detail' },  // no href — current page
]} />
```

---

## 15e. Formatters & Display Conventions

All number, date, and currency rendering goes through
`src/utils/formatters.ts` — never `toLocaleString()` calls scattered
across pages. This ensures consistent formatting and a single place
to change locale/convention.

| Formatter | Input | Output | Usage |
|-----------|-------|--------|-------|
| `formatCurrency(amount, ccy?)` | `50000` | `₹ 50,000.00` (INR grouping) | Every amount display |
| `formatCbsDate(iso)` | `2026-04-19` | `19-APR-2026` | List cells, receipts, breadcrumbs |
| `formatCbsTimestamp(iso)` | `2026-04-19T10:42:00Z` | `19-APR-2026 10:42:00` | Audit timestamps, last-login |
| `formatAccountType(type)` | `SAVINGS` | `Savings Account` | Type labels in account lists |

**Rules:**
- Dates: **always** DD-MMM-YYYY (not DD/MM/YYYY or MM/DD/YYYY) — the
  unambiguous CBS convention per RBI circulars.
- Amounts: **always** include currency symbol + Indian grouping
  (`1,00,000.00` not `100,000.00`).
- Business date vs calendar date: `businessDate` from session is the
  CBS day-state (what the system considers "today" for postings).
  Calendar "today" (`new Date()`) is only for UI freshness indicators.
  **Never** use calendar date for value dates, posting dates, or
  interest calculations.
- Timestamps in audit logs use the operator's local timezone but
  store UTC — the formatter converts for display.

---

## 15f. Toast & Modal Conventions

### Toasts (`CbsToastContainer`)

Toasts are ephemeral status notifications surfaced via `useUIStore().addToast()`:

| Type | Duration | Position | Use |
|------|----------|----------|-----|
| `success` | 3000ms | top-right, stacks 3 max | Posting successful, verification done |
| `info` | 5000ms | top-right | Day-status changes, non-blocking info |
| `warning` | 5000ms | top-right | Non-blocking validation warnings |
| `error` | 3000ms + manual dismiss | top-right | API failures — **include correlation ID** via `CorrelationRefBadge` |

**Rules:**
- Success toasts auto-dismiss — no manual close required
- Error toasts have a close button AND auto-dismiss (never sticky)
- Toasts stack vertically; the 4th queued toast waits for the oldest
  to expire — never pile up more than 3 visible at once
- Toast container sits above the session timeout warning but below
  critical error modals (`z-index` hierarchy: toasts → timeout →
  critical)

### Modals (`CbsModal`)

Modals use three size tokens (`sm` 400px / `md` 560px / `lg` 720px,
see §4). The `ModalRole` type selects between `dialog` (confirmation,
non-critical) and `alertdialog` (blocking decision required).

**Rules:**
- Use `role="alertdialog"` (via `ModalRole='alert'`) for CRITICAL
  decisions that block transaction flow — "Transaction may have been
  submitted", "Unsaved changes will be lost"
- Use `role="dialog"` for confirmations, forms, and inquiry overlays
- Every modal MUST close on `Esc` and focus-trap while open
- Confirmation modals for financial postings use
  `TransactionConfirmDialog` which bakes in maker-checker messaging,
  amount display, and accept/cancel buttons
- Modal backdrop is `rgba(0,0,0,0.4)` and **MUST NOT** close on
  backdrop click when the modal is `alertdialog` — only Esc / explicit
  cancel button (prevents accidental dismissal of CRITICAL decisions)

---

## 16b. Security & Compliance UX Patterns

Security controls surface to operators through UX. These patterns are
part of the design system because they constrain how pages are built.

### Session Handling

| Pattern | Implementation | Reference |
|---------|---------------|-----------|
| **Concurrent session prevention** | Every login generates a `sessionNonce` (RFC 4122 UUID) stored in the encrypted session blob. On login, the BFF sends `X-Invalidate-Previous-Sessions: true` so Spring revokes prior refresh tokens. Subsequent requests propagate the nonce via `X-Session-Nonce` to Spring for audit correlation. | `app/api/cbs/auth/login/route.ts:690-712`, `src/lib/server/proxy.ts:314-316` |
| **Three-layer session enforcement** | Layer 1 (cookie presence) in `proxy.ts`; Layer 2 (full decrypt) in Server Components; Layer 3 (decrypt + CSRF + JWT) in BFF proxy. | `proxy.ts:252-272` |
| **Session-expired redirect** | Clean URL constructed from `req.nextUrl.origin` — never `req.nextUrl.clone()`. Preserving the original query params would leak PII (customerId, amounts, filters) into login URLs, browser history, and server access logs. | `proxy.ts:267-274` |

### Screen-Access Audit (RBI §8.5)

Every route navigation fires `POST /api/cbs/audit/screen-access` via
the `useScreenAudit()` hook mounted once in `DashboardShell`.

| Aspect | Rule |
|--------|------|
| Route matching | Dynamic routes resolved via sentinel split (prefix + suffix) from the registry at `src/config/routes.ts`. Static routes match by exact equality. |
| CSRF | Raw `fetch` (not apiClient, to avoid recursion) but reads `NEXT_PUBLIC_CBS_CSRF_COOKIE` and sets `X-CSRF-Token` so the BFF accepts the POST. |
| Failure mode | Fire-and-forget. Audit never blocks the operator. The server-side correlation ID provides a secondary audit trail if the POST fails. |
| Screen codes | Every route entry in the registry has a `screenCode` (Finacle convention: `MODULE.ACTION`). Logged alongside `operatorId`, `branchCode`, `timestamp`, `pathname` by the backend. |

### Correlation ID Propagation

Every request that enters the Next.js server carries an
`X-Correlation-Id` header from end to end. This is the primary
RBI §8.5 audit trace and appears in:

1. **Root proxy (`proxy.ts`)** — seeds or validates the header
   against `/^[A-Za-z0-9-]{16,64}$/` and sets it on both the request
   and the response.
2. **BFF catch-all (`src/lib/server/proxy.ts`)** — forwards to Spring
   on every proxied call.
3. **Spring** — records it in every audit log entry and echoes it
   back in the response.
4. **apiClient response interceptor** — surfaces it to the UI via
   `setCorrelationId()` for display in error toasts and
   `CorrelationRefBadge`.
5. **Operator-visible** — shown as "Ref: {id}" in error alerts,
   success confirmations, and the `TransactionReceipt` footer.

**Rule:** every error toast or alert that surfaces an API failure
**MUST** render `<CorrelationRefBadge value={correlationId} />` so
the operator has a reference for IT support.

### Financial-Safety Retry Policy

The Axios interceptor only retries 429 (rate-limited) requests when
**one of** these conditions is true:
1. The method is safe (`GET`/`HEAD`/`OPTIONS`), OR
2. The caller explicitly provided `X-Idempotency-Key`.

Retrying a mutating call without an idempotency key can produce
duplicate postings because the BFF generates a new server-side
fallback key per request. Callers performing a financial posting
(transfer, FD booking, loan disbursement) **MUST** mint a stable
idempotency key at the point of the first "Confirm" click and pass
it via headers.

Reference: `src/services/api/apiClient.ts:247-256`

### FATCA/CRS Status Derivation

A customer is marked `usTaxResident: 'YES'` **only when** their
`fatcaCountry === 'US'`. Any other non-Indian country (GB, DE, SG…)
indicates a foreign tax obligation but NOT a US-specific FATCA
obligation.

Reference: `app/(dashboard)/accounts/new/page.tsx:248`

---

## 16c. Keyboard Shortcuts

CBS operators process 200+ transactions per day. Mouse-driven flows
add friction; Tier-1 CBS platforms are keyboard-first. Finvanta
follows the Finacle/T24 convention of single-key F-shortcuts for
frequent actions, registered per-page via `useCbsKeyboard(shortcuts)`
and surfaced in the `KeyboardHelpOverlay` (F1).

### Global Shortcuts (via `useCbsKeyboardNav` in DashboardShell)

| Key | Action |
|-----|--------|
| `F1` | Toggle Keyboard Help overlay |
| `Alt+D` | Go to Dashboard |
| `Alt+A` | Go to Accounts (Inquiry) |
| `Alt+C` | Go to Customers |
| `Alt+T` | Go to Transfers |
| `Ctrl+K` | Focus sidebar search |
| `Esc` | Close topmost modal/toast |

### Per-Page Shortcuts (registered via `useCbsKeyboard`)

| Key | Convention | Example screens |
|-----|-----------|-----------------|
| `F2` | Primary action (new/transfer/post) | Dashboard → Transfer, Transfer page → Confirm |
| `F3` | Focus search input | Any list/inquiry screen |
| `F5` | Refresh current data | Dashboard, Account list, Workflow queue |
| `F9` | Print current screen | Dashboard, Transaction Receipt |
| `Enter` | Trigger primary button in focused row | Customer search, CIF lookup |

### Rules:

- Shortcuts **MUST** be displayed as `<span className="cbs-kbd">F2</span>`
  next to their action (page header, button tooltip, or help overlay)
- The `KeyboardHelpOverlay` (F1) reads from the active keymap — new
  shortcuts become discoverable automatically
- **Never override browser-native shortcuts** (Ctrl+C, Ctrl+V, Tab,
  Enter in inputs) — operators rely on them
- Form fields must support Enter-to-submit when there's exactly one
  submit button and no multi-line textarea in focus

---

## 17. Future Considerations

### Design System Versioning (when micro-frontends are adopted)

When the architecture evolves to multiple independently deployed
frontends, the design system must be versioned explicitly:

```
PATCH → non-breaking (spacing tuning, colour adjustment)
MINOR → additive (new tokens, new components)
MAJOR → breaking (component size changes, layout restructure)
```

Each micro-frontend would declare a compatible version range.
Currently unnecessary — the single Next.js app ships all tokens,
components, and screens in one build.

### Cross-Channel Token Portability (when mobile/reports channels launch)

The CSS custom property architecture is already portable:
- Token values can be extracted to JSON via a build step
- React Native / Flutter can consume the same JSON
- PDF report generators can reference the same colour values

The principle: **one token definition, multiple channel consumers**.
Build the extraction pipeline when the second channel launches, not
before.
