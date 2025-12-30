'use client';

import type { ComponentType } from 'react';
import { Card } from './Card';

export interface StatCardProps {
  /** Label describing the stat */
  label: string;
  /** The stat value to display */
  value: number | string;
  /** Icon component to render */
  icon: ComponentType<{ className?: string }>;
  /** Color variant for the icon */
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  /** Optional subtitle below the value */
  subtitle?: string;
  /** Additional CSS classes */
  className?: string;
}

const variantStyles = {
  default: {
    icon: 'text-[var(--color-primary)]',
    bg: 'bg-[var(--color-neutral-50)]',
  },
  success: {
    icon: 'text-[var(--color-success)]',
    bg: 'bg-[var(--color-success-bg)]',
  },
  warning: {
    icon: 'text-[var(--color-warning)]',
    bg: 'bg-[var(--color-warning-bg)]',
  },
  danger: {
    icon: 'text-[var(--color-danger)]',
    bg: 'bg-[var(--color-danger-bg)]',
  },
  info: {
    icon: 'text-[var(--color-info)]',
    bg: 'bg-[var(--color-info-bg)]',
  },
};

/**
 * A card displaying a single statistic with an icon.
 *
 * @example
 * ```tsx
 * <StatCard
 *   label="Total Documents"
 *   value={1234}
 *   icon={FileText}
 *   variant="default"
 *   subtitle="10 unreviewed"
 * />
 * ```
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  variant = 'default',
  subtitle,
  className = '',
}: StatCardProps) {
  const styles = variantStyles[variant];
  const formattedValue = typeof value === 'number' ? value.toLocaleString() : value;

  return (
    <Card className={`flex items-center gap-4 ${className}`}>
      <div className={`p-3 rounded-[var(--radius-lg)] ${styles.bg} ${styles.icon}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-[var(--color-text-muted)]">{label}</p>
        <p className="text-2xl font-bold text-[var(--color-text)]">{formattedValue}</p>
        {subtitle && <p className="text-xs text-[var(--color-text-muted)]">{subtitle}</p>}
      </div>
    </Card>
  );
}

export interface StatGridProps {
  /** StatCard components to display */
  children: React.ReactNode;
  /** Number of columns (responsive) */
  columns?: 2 | 3 | 4;
  /** Additional CSS classes */
  className?: string;
}

const columnStyles = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

/**
 * A responsive grid layout for StatCard components.
 *
 * @example
 * ```tsx
 * <StatGrid columns={4}>
 *   <StatCard label="Documents" value={100} icon={FileText} />
 *   <StatCard label="Flags" value={25} icon={Flag} variant="danger" />
 * </StatGrid>
 * ```
 */
export function StatGrid({ children, columns = 4, className = '' }: StatGridProps) {
  return (
    <div className={`grid ${columnStyles[columns]} gap-4 ${className}`}>
      {children}
    </div>
  );
}
