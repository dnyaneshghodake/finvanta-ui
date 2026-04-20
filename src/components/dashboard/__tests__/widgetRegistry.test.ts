/**
 * Widget registry unit tests — role-based dashboard layout.
 * @file src/components/dashboard/__tests__/widgetRegistry.test.ts
 *
 * Validates that dashboard widgets are filtered correctly by role
 * BEFORE any data fetch (skeleton-first pattern). Unauthorized
 * widgets must never be rendered — zero-trust UI.
 */
import { describe, it, expect } from 'vitest';
import { getVisibleWidgets, WIDGET_DEFS } from '../widgetRegistry';
import type { UserRole } from '@/types/entities';

describe('widgetRegistry', () => {
  describe('WIDGET_DEFS', () => {
    it('has QUICK_OPS as the last widget', () => {
      const last = WIDGET_DEFS[WIDGET_DEFS.length - 1];
      expect(last.id).toBe('QUICK_OPS');
    });

    it('QUICK_OPS has no endpoint (client-side only)', () => {
      const quickOps = WIDGET_DEFS.find((w) => w.id === 'QUICK_OPS');
      expect(quickOps?.endpoint).toBe('');
      expect(quickOps?.refreshInterval).toBe(0);
    });

    it('all widgets with endpoints have errorRef codes', () => {
      for (const w of WIDGET_DEFS) {
        if (w.endpoint) {
          expect(w.errorRef).toBeTruthy();
          expect(w.errorRef).toMatch(/^DSH-/);
        }
      }
    });
  });

  describe('getVisibleWidgets', () => {
    it('shows all widgets for ADMIN (sees everything)', () => {
      const widgets = getVisibleWidgets(['ADMIN']);
      // ADMIN should see all role-restricted widgets + QUICK_OPS (empty roles = all)
      expect(widgets.length).toBeGreaterThanOrEqual(WIDGET_DEFS.length - 1);
    });

    it('MAKER sees portfolio, pending approvals, teller txn, quick ops', () => {
      const widgets = getVisibleWidgets(['MAKER']);
      const ids = widgets.map((w) => w.id);
      expect(ids).toContain('PORTFOLIO');
      expect(ids).toContain('PENDING_APPROVALS');
      expect(ids).toContain('TELLER_TXN_SUMMARY');
      expect(ids).toContain('QUICK_OPS');
      // MAKER should NOT see NPA, CASA, approval queue, clearing, risk
      expect(ids).not.toContain('NPA');
      expect(ids).not.toContain('APPROVAL_QUEUE');
    });

    it('CHECKER sees NPA, CASA, approval queue, clearing, risk', () => {
      const widgets = getVisibleWidgets(['CHECKER']);
      const ids = widgets.map((w) => w.id);
      expect(ids).toContain('NPA');
      expect(ids).toContain('CASA');
      expect(ids).toContain('APPROVAL_QUEUE');
      expect(ids).toContain('CLEARING_STATUS');
      expect(ids).toContain('RISK_METRICS');
      // CHECKER should NOT see teller txn summary
      expect(ids).not.toContain('TELLER_TXN_SUMMARY');
    });

    it('AUDITOR sees portfolio, NPA, CASA, quick ops only', () => {
      const widgets = getVisibleWidgets(['AUDITOR']);
      const ids = widgets.map((w) => w.id);
      expect(ids).toContain('PORTFOLIO');
      expect(ids).toContain('NPA');
      expect(ids).toContain('CASA');
      expect(ids).toContain('QUICK_OPS');
      expect(ids).not.toContain('PENDING_APPROVALS');
      expect(ids).not.toContain('TELLER_TXN_SUMMARY');
    });

    it('empty roles array shows only widgets with empty roles (QUICK_OPS)', () => {
      const widgets = getVisibleWidgets([]);
      const ids = widgets.map((w) => w.id);
      expect(ids).toContain('QUICK_OPS');
      // All other widgets require at least one role
      expect(ids).not.toContain('PORTFOLIO');
    });

    it('QUICK_OPS is visible to all roles (empty roles array)', () => {
      const allRoles: UserRole[] = ['MAKER', 'CHECKER', 'ADMIN', 'AUDITOR'];
      for (const role of allRoles) {
        const widgets = getVisibleWidgets([role]);
        const ids = widgets.map((w) => w.id);
        expect(ids).toContain('QUICK_OPS');
      }
    });
  });
});
