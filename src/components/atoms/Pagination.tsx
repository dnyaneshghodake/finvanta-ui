/**
 * Pagination component for CBS Banking Application.
 * @file src/components/atoms/Pagination.tsx
 *
 * CBS data-dense screens (account lists, transaction history,
 * workflow queues) require server-side pagination. This component
 * renders the page controls with CBS styling conventions:
 *   - Monospace page numbers (tabular-nums)
 *   - "Page X of Y" display (CBS standard)
 *   - Previous/Next buttons with keyboard support
 *   - Page size selector (optional)
 *
 * WCAG: nav[aria-label], current page announced, disabled states.
 */

'use client';

import React from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  /** Current page number (1-based). */
  page: number;
  /** Total number of pages. */
  totalPages: number;
  /** Total number of items (for display). */
  totalItems?: number;
  /** Current page size. */
  pageSize?: number;
  /** Available page size options. */
  pageSizeOptions?: number[];
  /** Called when the page changes. */
  onPageChange: (page: number) => void;
  /** Called when the page size changes. */
  onPageSizeChange?: (size: number) => void;
  /** Additional CSS class. */
  className?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 20, 50],
  onPageChange,
  onPageSizeChange,
  className,
}) => {
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav
      aria-label="Pagination"
      className={clsx(
        'flex items-center justify-between gap-4 py-2 text-xs',
        className,
      )}
    >
      {/* Left: item count + page size */}
      <div className="flex items-center gap-3 text-cbs-steel-600">
        {totalItems != null && (
          <span className="cbs-tabular">
            {totalItems.toLocaleString('en-IN')} item{totalItems !== 1 ? 's' : ''}
          </span>
        )}
        {onPageSizeChange && pageSize && (
          <div className="flex items-center gap-1.5">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="cbs-select h-[26px] w-16 text-xs py-0"
              aria-label="Items per page"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: page controls */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          className="cbs-btn cbs-btn-secondary h-[26px] px-1.5"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} strokeWidth={2} />
        </button>

        <span className="cbs-tabular text-cbs-steel-700 px-2" aria-current="page">
          Page <span className="font-semibold text-cbs-ink">{page}</span> of{' '}
          <span className="font-semibold text-cbs-ink">{totalPages}</span>
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          className="cbs-btn cbs-btn-secondary h-[26px] px-1.5"
          aria-label="Next page"
        >
          <ChevronRight size={14} strokeWidth={2} />
        </button>
      </div>
    </nav>
  );
};

Pagination.displayName = 'Pagination';

export { Pagination };
