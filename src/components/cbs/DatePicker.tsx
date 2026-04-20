/**
 * CBS DatePicker — custom calendar dropdown replacing browser-native
 * input type="date".
 * @file src/components/cbs/DatePicker.tsx
 *
 * Tier-1 CBS convention (Tier-1 CBS):
 *   - Display format is always DD-MMM-YYYY (e.g. "19-APR-2026")
 *     regardless of browser locale.
 *   - Calendar grid: 7 columns (SUN–SAT), header in MMM-YYYY mono.
 *   - Sundays always greyed (crimson text).
 *   - 2nd and 4th Saturdays greyed (RBI holiday convention).
 *   - Optional `holidays` prop from Spring calendar API.
 *   - "Today" shortcut + "Clear" in footer.
 *   - Escape closes, click-outside closes.
 *   - Hidden input carries ISO value for react-hook-form compat.
 */
'use client';

import {
  forwardRef,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toCbsDisplay(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

function isRbiSaturdayHoliday(d: Date): boolean {
  if (d.getDay() !== 6) return false;
  const weekNum = Math.ceil(d.getDate() / 7);
  return weekNum === 2 || weekNum === 4;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export interface CbsDatePickerProps {
  label: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  name?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  /** ISO date strings for non-business days (from Spring calendar API). */
  holidays?: string[];
  min?: string;
  max?: string;
  id?: string;
  placeholder?: string;
}

export const CbsDatePicker = forwardRef<HTMLInputElement, CbsDatePickerProps>(
  function CbsDatePicker(
    { label, value, onChange, onBlur, name, error, hint, required, disabled, holidays = [], min, max, id, placeholder = 'DD-MMM-YYYY' },
    ref,
  ) {
    const fieldId = id || `dp-${label.replace(/\s+/g, '-').toLowerCase()}`;
    const containerRef = useRef<HTMLDivElement>(null);
    const hiddenRef = useRef<HTMLInputElement | null>(null);

    const [open, setOpen] = useState(false);
    const [viewYear, setViewYear] = useState(() => {
      if (value) { const d = new Date(value + 'T00:00:00'); return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear(); }
      return new Date().getFullYear();
    });
    const [viewMonth, setViewMonth] = useState(() => {
      if (value) { const d = new Date(value + 'T00:00:00'); return isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth(); }
      return new Date().getMonth();
    });

    const holidaySet = useMemo(() => new Set(holidays), [holidays]);
    const today = useMemo(() => new Date(), []);

    useEffect(() => {
      if (value) {
        const d = new Date(value + 'T00:00:00');
        if (!isNaN(d.getTime())) { setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }
      }
    }, [value]);

    useEffect(() => {
      if (!open) return;
      const handler = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    useEffect(() => {
      if (!open) return;
      const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }, [open]);

    const fireChange = useCallback((iso: string) => {
      const el = hiddenRef.current;
      if (el) {
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        nativeSetter?.call(el, iso);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, []);

    const selectDate = useCallback((d: Date) => { fireChange(toIso(d)); setOpen(false); }, [fireChange]);
    const selectToday = useCallback(() => selectDate(today), [selectDate, today]);
    const clearValue = useCallback(() => { fireChange(''); setOpen(false); }, [fireChange]);

    const prevMonth = useCallback(() => {
      setViewMonth((m) => { if (m === 0) { setViewYear((y) => y - 1); return 11; } return m - 1; });
    }, []);
    const nextMonth = useCallback(() => {
      setViewMonth((m) => { if (m === 11) { setViewYear((y) => y + 1); return 0; } return m + 1; });
    }, []);

    const calendarDays = useMemo(() => {
      const firstOfMonth = new Date(viewYear, viewMonth, 1);
      const startDow = firstOfMonth.getDay();
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      const cells: Array<{
        date: Date; day: number; outside: boolean;
        isWeekend: boolean; isHoliday: boolean; isToday: boolean;
        isSelected: boolean; isDisabled: boolean;
      }> = [];

      const prevDays = new Date(viewYear, viewMonth, 0).getDate();
      for (let i = startDow - 1; i >= 0; i--) {
        const d = new Date(viewYear, viewMonth - 1, prevDays - i);
        cells.push({ date: d, day: d.getDate(), outside: true, isWeekend: false, isHoliday: false, isToday: false, isSelected: false, isDisabled: true });
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(viewYear, viewMonth, day);
        const iso = toIso(d);
        const weekend = d.getDay() === 0 || isRbiSaturdayHoliday(d);
        const holiday = holidaySet.has(iso);
        const outOfRange = (min && iso < min) || (max && iso > max);
        cells.push({
          date: d, day, outside: false, isWeekend: weekend, isHoliday: holiday,
          isToday: sameDay(d, today), isSelected: value === iso, isDisabled: !!outOfRange,
        });
      }

      const remaining = 7 - (cells.length % 7);
      if (remaining < 7) {
        for (let i = 1; i <= remaining; i++) {
          const d = new Date(viewYear, viewMonth + 1, i);
          cells.push({ date: d, day: d.getDate(), outside: true, isWeekend: false, isHoliday: false, isToday: false, isSelected: false, isDisabled: true });
        }
      }
      return cells;
    }, [viewYear, viewMonth, value, holidaySet, today, min, max]);

    const displayValue = value ? toCbsDisplay(value) : '';

    return (
      <div>
        <label htmlFor={fieldId} className="cbs-field-label block mb-1">
          {label}
          {required && <span className="text-cbs-crimson-700 ml-0.5">*</span>}
        </label>

        <div ref={containerRef} className="cbs-datepicker">
          <input
            ref={(el) => {
              hiddenRef.current = el;
              if (typeof ref === 'function') ref(el);
              else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
            }}
            type="hidden"
            name={name}
            id={fieldId}
            value={value || ''}
            onChange={onChange}
            onBlur={onBlur}
          />

          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && setOpen((o) => !o)}
            className={`cbs-input cbs-tabular cbs-datepicker-display w-full ${error ? 'border-cbs-crimson-600' : ''}`}
            data-placeholder={!displayValue ? 'true' : undefined}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-invalid={!!error}
          >
            {displayValue || placeholder}
          </button>

          {open && (
            <div className="cbs-cal-dropdown" role="dialog" aria-label={`${MONTHS[viewMonth]} ${viewYear} calendar`}>
              <div className="cbs-cal-header">
                <button type="button" className="cbs-cal-nav" onClick={prevMonth} aria-label="Previous month">‹</button>
                <span className="cbs-cal-title">{MONTHS[viewMonth]}-{viewYear}</span>
                <button type="button" className="cbs-cal-nav" onClick={nextMonth} aria-label="Next month">›</button>
              </div>

              <div className="cbs-cal-grid">
                {DAYS_OF_WEEK.map((dow) => (
                  <div key={dow} className="cbs-cal-dow">{dow}</div>
                ))}
                {calendarDays.map((cell, i) => (
                  <button
                    key={i}
                    type="button"
                    className="cbs-cal-day"
                    disabled={cell.isDisabled || cell.outside}
                    aria-selected={cell.isSelected}
                    data-today={cell.isToday ? 'true' : undefined}
                    data-weekend={cell.isWeekend ? 'true' : undefined}
                    data-holiday={cell.isHoliday ? 'true' : undefined}
                    data-outside={cell.outside ? 'true' : undefined}
                    title={
                      cell.isHoliday ? 'Holiday' :
                      cell.isWeekend ? (cell.date.getDay() === 0 ? 'Sunday' : '2nd/4th Saturday') :
                      undefined
                    }
                    onClick={() => !cell.outside && !cell.isDisabled && selectDate(cell.date)}
                  >
                    {cell.day}
                  </button>
                ))}
              </div>

              <div className="cbs-cal-footer">
                <button type="button" className="cbs-btn cbs-btn-secondary h-[24px] px-2 text-[10px] uppercase tracking-wider" onClick={selectToday}>
                  Today
                </button>
                {value && (
                  <button type="button" className="cbs-btn cbs-btn-secondary h-[24px] px-2 text-[10px] uppercase tracking-wider" onClick={clearValue}>
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {error ? (
          <div className="mt-1 text-xs text-cbs-crimson-700">{error}</div>
        ) : hint ? (
          <div className="mt-1 text-xs text-cbs-steel-600">{hint}</div>
        ) : null}
      </div>
    );
  },
);
