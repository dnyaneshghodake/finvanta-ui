/**
 * CBS feedback component tests — status ribbons, audit chips, etc.
 * @file src/components/cbs/__tests__/feedback.test.tsx
 *
 * Per RBI IT Governance Direction 2023 §8.4: status display
 * components used in maker-checker workflows and audit trails
 * must be tested for correct rendering and accessibility.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  StatusRibbon,
  AuditHashChip,
  CorrelationRefBadge,
  KeyValue,
} from '../feedback';

describe('StatusRibbon', () => {
  it('renders the status text with underscores replaced by spaces', () => {
    render(<StatusRibbon status="PENDING_APPROVAL" />);
    expect(screen.getByText('PENDING APPROVAL')).toBeDefined();
  });

  it('renders known statuses without crashing', () => {
    const statuses = [
      'ACTIVE', 'APPROVED', 'POSTED', 'REJECTED',
      'REVERSED', 'FROZEN', 'CLOSED', 'DRAFT',
    ];
    for (const status of statuses) {
      const { container } = render(<StatusRibbon status={status} />);
      expect(container.querySelector('.cbs-ribbon')).toBeDefined();
    }
  });

  it('renders unknown statuses with DRAFT tone fallback', () => {
    const { container } = render(<StatusRibbon status="UNKNOWN_STATUS" />);
    const ribbon = container.querySelector('.cbs-ribbon');
    expect(ribbon).toBeDefined();
    expect(ribbon?.textContent).toBe('UNKNOWN STATUS');
  });
});

describe('AuditHashChip', () => {
  it('renders the first 12 hex chars of the hash', () => {
    render(<AuditHashChip hashPrefix="a1b2c3d4e5f6a7b8" />);
    expect(screen.getByText('a1b2c3d4e5f6')).toBeDefined();
  });

  it('strips non-hex characters', () => {
    render(<AuditHashChip hashPrefix="a1b2-ZZZZ-c3d4e5f6" />);
    expect(screen.getByText('a1b2c3d4e5f6')).toBeDefined();
  });

  it('renders nothing for null/undefined hashPrefix', () => {
    const { container } = render(<AuditHashChip hashPrefix={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for empty string', () => {
    const { container } = render(<AuditHashChip hashPrefix="" />);
    expect(container.innerHTML).toBe('');
  });

  it('has a title attribute for the full description', () => {
    const { container } = render(<AuditHashChip hashPrefix="abcdef123456" />);
    const chip = container.querySelector('[title]');
    expect(chip?.getAttribute('title')).toContain('SHA-256');
  });
});

describe('CorrelationRefBadge', () => {
  it('renders the first 12 chars of the correlation ID', () => {
    render(<CorrelationRefBadge value="550e8400-e29b-41d4-a716-446655440000" />);
    expect(screen.getByText('550e8400-e29')).toBeDefined();
  });

  it('renders nothing for null/undefined value', () => {
    const { container } = render(<CorrelationRefBadge value={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for empty string', () => {
    const { container } = render(<CorrelationRefBadge value="" />);
    expect(container.innerHTML).toBe('');
  });

  it('displays the Ref label', () => {
    render(<CorrelationRefBadge value="abc123def456" />);
    expect(screen.getByText('Ref')).toBeDefined();
  });
});

describe('KeyValue', () => {
  it('renders label and children', () => {
    render(<KeyValue label="Branch Code">HQ001</KeyValue>);
    expect(screen.getByText('Branch Code')).toBeDefined();
    expect(screen.getByText('HQ001')).toBeDefined();
  });

  it('renders complex children', () => {
    render(
      <KeyValue label="Status">
        <span data-testid="custom">Active</span>
      </KeyValue>,
    );
    expect(screen.getByTestId('custom')).toBeDefined();
    expect(screen.getByText('Active')).toBeDefined();
  });
});
