/**
 * Workflow status badge for CBS Banking Application
 * @file src/components/molecules/WorkflowStatusBadge.tsx
 *
 * Displays the current maker-checker workflow status with
 * appropriate color coding and maker/checker attribution.
 */

'use client';

import React from 'react';
import { Badge } from '@/components/atoms/Badge';
import { WorkflowStatus } from '@/types/workflow';

export interface WorkflowStatusBadgeProps {
  status: WorkflowStatus;
  makerName?: string;
  checkerName?: string;
  className?: string;
}

const statusConfig: Record<WorkflowStatus, { variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'; label: string }> = {
  DRAFT: { variant: 'default', label: 'Draft' },
  SUBMITTED: { variant: 'primary', label: 'Submitted' },
  PENDING_VERIFICATION: { variant: 'warning', label: 'Pending Verification' },
  VERIFIED: { variant: 'info', label: 'Verified' },
  PENDING_APPROVAL: { variant: 'warning', label: 'Pending Approval' },
  APPROVED: { variant: 'success', label: 'Approved' },
  REJECTED: { variant: 'danger', label: 'Rejected' },
  CANCELLED: { variant: 'default', label: 'Cancelled' },
};

const WorkflowStatusBadge: React.FC<WorkflowStatusBadgeProps> = ({
  status,
  makerName,
  checkerName,
  className,
}) => {
  const config = statusConfig[status];

  return (
    <div className={className}>
      <Badge variant={config.variant} dot>
        {config.label}
      </Badge>
      {makerName && (
        <p className="text-xs text-gray-500 mt-1">
          Maker: {makerName}
          {checkerName && ` · Checker: ${checkerName}`}
        </p>
      )}
    </div>
  );
};

WorkflowStatusBadge.displayName = 'WorkflowStatusBadge';

export { WorkflowStatusBadge };
