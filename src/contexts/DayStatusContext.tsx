'use client';

/**
 * Day-Status Context — controls posting-allowed flag for all children.
 * @file src/contexts/DayStatusContext.tsx
 *
 * Per API_LOGIN_CONTRACT.md §14 Rule 8: dayStatus controls the
 * entire UI. Transaction buttons must be disabled when day is not
 * open. This context propagates the posting-allowed flag to all
 * child components without prop drilling.
 *
 * CBS benchmark: the Tier-1 CBS day-open module disables all posting
 * menus when dayStatus != DAY_OPEN. Tier-1 CBS peers apply the same lockout.
 *
 * Extracted from app/(dashboard)/layout.tsx so components can import
 * `useDayStatus` without coupling to the route-group layout file.
 */

import { createContext, useContext } from 'react';

export interface DayStatusContextValue {
  /** Whether financial postings are allowed. */
  isPostingAllowed: boolean;
  /** Current day status string for display. */
  dayStatus: string | null;
  /** Reason postings are blocked (for tooltip/message). */
  blockReason: string | null;
}

export const DayStatusContext = createContext<DayStatusContextValue>({
  isPostingAllowed: true,
  dayStatus: null,
  blockReason: null,
});

/**
 * Hook to check if financial postings are allowed.
 * Use in transaction buttons: `const { isPostingAllowed } = useDayStatus();`
 */
export function useDayStatus(): DayStatusContextValue {
  return useContext(DayStatusContext);
}
