/**
 * CBS KPI card — data-dense statistic display.
 * @file src/components/molecules/StatisticCard.tsx
 */

import React from 'react';

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

const COLOR_MAP = {
  blue: 'bg-cbs-navy-50 text-cbs-navy-700',
  green: 'bg-cbs-olive-50 text-cbs-olive-700',
  red: 'bg-cbs-crimson-50 text-cbs-crimson-700',
  yellow: 'bg-cbs-gold-50 text-cbs-gold-700',
} as const;

const StatisticCard: React.FC<StatisticCardProps> = ({
  label,
  value,
  icon,
  trend,
  className,
  color = 'blue',
}) => {
  return (
    <div className={`cbs-surface p-3 space-y-1.5 ${className || ''}`}>
      <div className="flex items-center justify-between">
        <p className="cbs-field-label">{label}</p>
        {icon && (
          <div className={`p-1.5 rounded-sm ${COLOR_MAP[color]}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-end justify-between">
        <h3 className="text-xl font-bold text-cbs-ink cbs-tabular">{value}</h3>
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-semibold cbs-tabular ${
              trend.direction === 'up' ? 'text-cbs-olive-700' : 'text-cbs-crimson-700'
            }`}
          >
            {trend.direction === 'up' ? '↑' : '↓'}
            {trend.percentage}%
          </div>
        )}
      </div>
    </div>
  );
};

StatisticCard.displayName = 'StatisticCard';

export { StatisticCard };
