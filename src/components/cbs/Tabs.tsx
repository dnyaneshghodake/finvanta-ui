/**
 * CBS Tabs — detail screen tab bar.
 * @file src/components/cbs/Tabs.tsx
 *
 * Tier-1 CBS convention: account/customer/loan detail screens use
 * tabs to separate Overview | Transactions | SI | Linked | Audit.
 * Keyboard: Arrow Left/Right to move between tabs, Enter to select.
 *
 * Usage:
 *   <CbsTabs
 *     tabs={[
 *       { id: 'overview', label: 'Overview' },
 *       { id: 'txns', label: 'Transactions' },
 *       { id: 'audit', label: 'Audit Trail' },
 *     ]}
 *     activeTab="overview"
 *     onTabChange={setActiveTab}
 *   />
 */
'use client';

import { useCallback, useRef, type KeyboardEvent } from 'react';

export interface CbsTabDef {
  id: string;
  label: string;
  disabled?: boolean;
  count?: number;
}

export interface CbsTabsProps {
  tabs: CbsTabDef[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export function CbsTabs({ tabs, activeTab, onTabChange, className = '' }: CbsTabsProps) {
  const barRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      const enabledTabs = tabs.filter((t) => !t.disabled);
      const currentIdx = enabledTabs.findIndex((t) => t.id === activeTab);
      let nextIdx = currentIdx;

      if (e.key === 'ArrowRight') nextIdx = (currentIdx + 1) % enabledTabs.length;
      else if (e.key === 'ArrowLeft') nextIdx = (currentIdx - 1 + enabledTabs.length) % enabledTabs.length;
      else if (e.key === 'Home') nextIdx = 0;
      else if (e.key === 'End') nextIdx = enabledTabs.length - 1;
      else return;

      e.preventDefault();
      onTabChange(enabledTabs[nextIdx].id);

      const btns = barRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      btns?.[nextIdx]?.focus();
    },
    [tabs, activeTab, onTabChange],
  );

  return (
    <div ref={barRef} role="tablist" className={`cbs-tab-bar ${className}`.trim()}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          type="button"
          id={`tab-${tab.id}`}
          aria-selected={activeTab === tab.id}
          aria-controls={`tabpanel-${tab.id}`}
          aria-disabled={tab.disabled}
          tabIndex={activeTab === tab.id ? 0 : -1}
          disabled={tab.disabled}
          className={`cbs-tab ${activeTab === tab.id ? 'cbs-tab-active' : ''} ${tab.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          onClick={() => !tab.disabled && onTabChange(tab.id)}
          onKeyDown={handleKeyDown}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 text-[10px] font-bold bg-cbs-steel-100 text-cbs-steel-700 px-1.5 rounded-sm">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export interface CbsTabPanelProps {
  id: string;
  activeTab: string;
  children: React.ReactNode;
  className?: string;
}

export function CbsTabPanel({ id, activeTab, children, className = '' }: CbsTabPanelProps) {
  if (activeTab !== id) return null;
  return (
    <div
      role="tabpanel"
      id={`tabpanel-${id}`}
      aria-labelledby={`tab-${id}`}
      className={className}
    >
      {children}
    </div>
  );
}
