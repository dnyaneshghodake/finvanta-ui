/**
 * CBS Breadcrumb — navigation trail.
 * @file src/components/cbs/Breadcrumb.tsx
 *
 * Tier-1 CBS convention: every screen shows the full navigation path
 * so the operator always knows their position in the module hierarchy.
 *
 * Usage:
 *   <Breadcrumb items={[
 *     { label: 'Dashboard', href: '/dashboard' },
 *     { label: 'Accounts', href: '/accounts' },
 *     { label: 'SB-HQ001-000001' },
 *   ]} />
 */
'use client';

import Link from 'next/link';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  if (!items.length) return null;
  return (
    <nav aria-label="Breadcrumb" className={`cbs-breadcrumb ${className}`.trim()}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="inline-flex items-center gap-0">
            {i > 0 && <span className="cbs-breadcrumb-sep" aria-hidden="true" />}
            {isLast || !item.href ? (
              <span className={isLast ? 'cbs-breadcrumb-current' : ''} aria-current={isLast ? 'page' : undefined}>
                {item.label}
              </span>
            ) : (
              <Link href={item.href}>{item.label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
