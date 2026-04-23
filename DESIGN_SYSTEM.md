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
12px  → tabs, compact body text
13px  → default body text, inputs, buttons, table cells
14px  → login inputs, section descriptions
16px  → section titles, page subtitles
18px  → page headings (h1)
24px  → KPI values (dashboard)
```

Font stack: Inter → IBM Plex Sans → system sans-serif
Mono stack: JetBrains Mono → IBM Plex Mono → system monospace

Amounts and dates always use `font-variant-numeric: tabular-nums`
via the `.cbs-tabular` or `.cbs-amount` utility classes.

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

CBS operators have different workflows requiring different UI density:

| Role | Density | Characteristics |
|------|---------|----------------|
| **TELLER** | Dense | Compact tables, minimal whitespace, keyboard-optimised, high transaction throughput |
| **OFFICER/MAKER** | Standard | Balanced forms + tables, accordion sections, CIF lookup integration |
| **MANAGER/CHECKER** | Summary | KPI cards, approval queues, risk panels, graph-heavy dashboards |
| **AUDITOR** | Read-only | Audit trail emphasis, field-level change history, export-heavy |
| **ADMIN** | Configuration | Wide tables, bulk operations, settings forms |

### Implementation:

- Role gating is handled by `RoleGate` component and route-level `roles` arrays
- Screen layout (8+4 split, full-width table, KPI grid) is chosen per screen type
- The base component dimensions (34px inputs, 36px table rows) are shared across all roles
- Role-specific density is achieved through **layout composition**, not component variants

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

### Rules:

- CRITICAL errors **MUST** block transaction progression
- ERROR states **MUST** include border + background tint (not colour alone)
- WARNING banners **MUST** persist until the condition resolves
- INFO toasts **MUST** auto-dismiss (never accumulate)
- All severity levels use the semantic `--color-status-*` tokens

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
