/**
 * CBS Toast Container — renders active toasts from uiStore.
 * @file src/components/cbs/ToastContainer.tsx
 *
 * Must be rendered once in the dashboard layout. Toasts appear
 * top-right below the header chrome, auto-dismiss after duration,
 * and can be manually closed.
 */
'use client';

import { useUIStore } from '@/store/uiStore';
import { X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

const ICON_MAP = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const TONE_MAP = {
  success: 'cbs-toast-success',
  error: 'cbs-toast-error',
  warning: 'cbs-toast-warning',
  info: 'cbs-toast-info',
} as const;

export function CbsToastContainer() {
  const { toasts, removeToast } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div className="cbs-toast-container" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => {
        const Icon = ICON_MAP[toast.type] || Info;
        const tone = TONE_MAP[toast.type] || TONE_MAP.info;
        return (
          <div key={toast.id} className={`cbs-toast ${tone}`}>
            <Icon size={16} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-xs uppercase tracking-wider">{toast.title}</div>
              {toast.message && <div className="text-xs mt-0.5 opacity-90">{toast.message}</div>}
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
