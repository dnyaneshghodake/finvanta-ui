/**
 * StatisticCard component for CBS Banking Application
 * @file src/components/molecules/StatisticCard.tsx
 */

import React from 'react';
import { Card } from '@/components/atoms/Card';
import clsx from 'clsx';

/**
 * StatisticCard component props
 */
export interface StatisticCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    direction: 'up' | 'down';
    percentage: number;
  };
  className?: string;
  color?: 'blue' | 'green' | 'red' | 'yellow';
}

/**
 * StatisticCard component
 */
const StatisticCard: React.FC<StatisticCardProps> = ({
  label,
  value,
  icon,
  trend,
  className,
  color = 'blue',
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };

  return (
    <Card className={clsx('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">{label}</p>
        {icon && (
          <div className={clsx('p-2 rounded-lg', colorClasses[color])}>
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-end justify-between">
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        {trend && (
          <div
            className={clsx(
              'flex items-center gap-1 text-xs font-medium',
              trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
            )}
          >
            {trend.direction === 'up' ? '↑' : '↓'}
            {trend.percentage}%
          </div>
        )}
      </div>
    </Card>
  );
};

StatisticCard.displayName = 'StatisticCard';

export { StatisticCard };
