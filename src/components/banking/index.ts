/**
 * Banking domain components — L4 in the CBS component hierarchy.
 * @file src/components/banking/index.ts
 *
 * These components understand banking semantics (currency, status
 * codes, account types). They sit above the generic atoms (L2) and
 * molecules (L3) and below the application modules (L6).
 *
 * New banking components should be added here. Each must:
 *   - Accept all data via props (zero store access)
 *   - Use tokens from @/tokens for colours/spacing
 *   - Include WCAG aria attributes
 *   - Have a displayName for React DevTools
 */

export { AmountField, type AmountFieldProps } from './AmountField';
export { StatusChip, type StatusChipProps } from './StatusChip';
