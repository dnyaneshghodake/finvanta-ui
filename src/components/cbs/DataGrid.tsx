/**
 * CBS DataGrid — Tier-1 data-dense table with sorting, pagination,
 * row selection, column alignment, and responsive scroll.
 * @file src/components/cbs/DataGrid.tsx
 *
 * Tier-1 CBS convention (Tier-1 CBS inquiry grid):
 *   - Sticky header row with sort indicators
 *   - Zebra striping for readability
 *   - Right-aligned amount columns (tabular-nums)
 *   - Row hover highlight
 *   - Optional checkbox selection column
 *   - Pagination bar with page-size selector
 *   - Responsive: horizontal scroll with frozen first column on mobile
 *   - Keyboard: Tab through rows, Enter to select
 *   - Export hook (caller provides the handler)
 *
 * Usage:
 *   <CbsDataGrid
 *     columns={[
 *       { key: 'accountNumber', label: 'Account No', sticky: true },
 *       { key: 'balance', label: 'Balance', align: 'right', format: 'amount' },
 *       { key: 'status', label: 'Status' },
 *     ]}
 *     rows={accounts}
 *     keyField="id"
 *     pagination={{ page: 1, pageSize: 20, total: 150 }}
 *     onPageChange={setPage}
 *     onSort={setSort}
 *     onRowClick={(row) => router.push(`/accounts/${row.id}`)}
 *   />
 */
'use client';

import { useState, useCallback, useMemo, type ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CbsColumn<T> {
  key: keyof T & string;
  label: string;
  /** Right-align for amounts, center for status chips. */
  align?: 'left' | 'center' | 'right';
  /** If 'amount', applies cbs-amount class. */
  format?: 'amount' | 'date' | 'mono';
  /** Freeze this column on horizontal scroll (first column only). */
  sticky?: boolean;
  /** Allow sorting on this column. Default true. */
  sortable?: boolean;
  /** Min width in px. */
  minWidth?: number;
  /** Custom cell renderer. */
  render?: (value: T[keyof T & string], row: T, rowIndex: number) => ReactNode;
}

export interface CbsPagination {
  page: number;
  pageSize: number;
  total: number;
}

export type SortDir = 'ASC' | 'DESC';

export interface CbsSort {
  column: string;
  direction: SortDir;
}

export interface CbsDataGridProps<T> {
  columns: CbsColumn<T>[];
  rows: T[];
  keyField: keyof T & string;
  /** Current sort state. */
  sort?: CbsSort | null;
  onSort?: (sort: CbsSort) => void;
  /** Pagination state. Omit to hide pagination bar. */
  pagination?: CbsPagination;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  /** Row click handler. */
  onRowClick?: (row: T) => void;
  /** Show checkbox selection column. */
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  /** Loading state — shows skeleton rows. */
  loading?: boolean;
  /** Empty state message. */
  emptyMessage?: string;
  className?: string;
}

const PAGE_SIZES = [10, 25, 50, 100];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CbsDataGrid<T extends Record<string, unknown>>({
  columns,
  rows,
  keyField,
  sort,
  onSort,
  pagination,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  loading = false,
  emptyMessage = 'No records found.',
  className = '',
}: CbsDataGridProps<T>) {
  const [internalSort, setInternalSort] = useState<CbsSort | null>(null);
  const activeSort = sort ?? internalSort;

  const handleSort = useCallback(
    (col: CbsColumn<T>) => {
      if (col.sortable === false) return;
      const next: CbsSort = {
        column: col.key,
        direction:
          activeSort?.column === col.key && activeSort.direction === 'ASC'
            ? 'DESC'
            : 'ASC',
      };
      if (onSort) onSort(next);
      else setInternalSort(next);
    },
    [activeSort, onSort],
  );

  const allSelected = useMemo(
    () => rows.length > 0 && rows.every((r) => selectedKeys?.has(String(r[keyField]))),
    [rows, selectedKeys, keyField],
  );

  const toggleAll = useCallback(() => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(rows.map((r) => String(r[keyField]))));
    }
  }, [allSelected, rows, keyField, onSelectionChange]);

  const toggleRow = useCallback(
    (key: string) => {
      if (!onSelectionChange || !selectedKeys) return;
      const next = new Set(selectedKeys);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      onSelectionChange(next);
    },
    [selectedKeys, onSelectionChange],
  );

  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;

  /* ---- Cell formatting ---- */
  const cellClass = (col: CbsColumn<T>): string => {
    const parts: string[] = [];
    if (col.align === 'right') parts.push('text-right');
    else if (col.align === 'center') parts.push('text-center');
    if (col.format === 'amount') parts.push('cbs-amount');
    if (col.format === 'mono' || col.format === 'date') parts.push('cbs-tabular');
    return parts.join(' ');
  };

  return (
    <div className={`cbs-surface ${className}`.trim()}>
      {/* WCAG 4.1.3 — live region announces row count changes to screen readers
          when data loads, filters change, or pagination navigates. */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {loading
          ? 'Loading data…'
          : rows.length === 0
            ? emptyMessage
            : `Showing ${rows.length} record${rows.length === 1 ? '' : 's'}${pagination ? ` of ${pagination.total}` : ''}`}
      </div>
      <div className="cbs-table-wrap">
        <table className="cbs-grid-table" role="grid">
          <thead>
            <tr>
              {selectable && (
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all rows"
                    className="accent-cbs-navy-600"
                  />
                </th>
              )}
              {columns.map((col) => {
                const isSorted = activeSort?.column === col.key;
                const canSort = col.sortable !== false;
                return (
                  <th
                    key={col.key}
                    style={{ minWidth: col.minWidth }}
                    className={`${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''} ${canSort ? 'cursor-pointer select-none' : ''} ${col.sticky ? 'sticky left-0 z-[2] bg-cbs-steel-50' : ''}`}
                    onClick={() => canSort && handleSort(col)}
                    aria-sort={isSorted ? (activeSort!.direction === 'ASC' ? 'ascending' : 'descending') : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {canSort && (
                        <span className="inline-flex flex-col text-cbs-steel-400">
                          {isSorted ? (
                            activeSort!.direction === 'ASC' ? (
                              <ChevronUp size={12} strokeWidth={2.5} className="text-cbs-navy-700" />
                            ) : (
                              <ChevronDown size={12} strokeWidth={2.5} className="text-cbs-navy-700" />
                            )
                          ) : (
                            <ChevronsUpDown size={12} strokeWidth={1.5} />
                          )}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={`skel-${i}`}>
                    {selectable && <td><div className="cbs-skeleton" style={{ width: 16, height: 16 }} /></td>}
                    {columns.map((col) => (
                      <td key={col.key}><div className="cbs-skeleton cbs-skeleton-cell" /></td>
                    ))}
                  </tr>
                ))
              : rows.length === 0
                ? (
                    <tr>
                      <td colSpan={columns.length + (selectable ? 1 : 0)} className="text-center py-8 text-sm text-cbs-steel-500">
                        {emptyMessage}
                      </td>
                    </tr>
                  )
                : rows.map((row, ri) => {
                    const rowKey = String(row[keyField]);
                    const isSelected = selectedKeys?.has(rowKey);
                    return (
                      <tr
                        key={rowKey}
                        className={`${onRowClick ? 'cursor-pointer' : ''} ${isSelected ? 'bg-cbs-navy-50' : ''}`}
                        onClick={() => onRowClick?.(row)}
                        tabIndex={onRowClick ? 0 : undefined}
                        onKeyDown={(e) => e.key === 'Enter' && onRowClick?.(row)}
                      >
                        {selectable && (
                          <td onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={!!isSelected}
                              onChange={() => toggleRow(rowKey)}
                              aria-label={`Select row ${rowKey}`}
                              className="accent-cbs-navy-600"
                            />
                          </td>
                        )}
                        {columns.map((col) => (
                          <td
                            key={col.key}
                            className={`${cellClass(col)} ${col.sticky ? 'sticky left-0 z-[1] bg-inherit' : ''}`}
                          >
                            {col.render
                              ? col.render(row[col.key], row, ri)
                              : String(row[col.key] ?? '')}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
          </tbody>
        </table>
      </div>

      {/* Pagination bar */}
      {pagination && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-cbs-steel-200 text-xs text-cbs-steel-600">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select
              className="cbs-select h-[26px] w-[60px] text-xs px-1"
              value={pagination.pageSize}
              onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1 cbs-tabular">
            <span>
              {((pagination.page - 1) * pagination.pageSize) + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
            </span>
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange?.(pagination.page - 1)}
              className="cbs-btn h-[26px] px-2 text-xs cbs-btn-secondary disabled:opacity-40"
              aria-label="Previous page"
            >
              ‹
            </button>
            <button
              type="button"
              disabled={pagination.page >= totalPages}
              onClick={() => onPageChange?.(pagination.page + 1)}
              className="cbs-btn h-[26px] px-2 text-xs cbs-btn-secondary disabled:opacity-40"
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
