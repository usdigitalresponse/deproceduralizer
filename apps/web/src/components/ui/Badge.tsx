'use client';

import { HTMLAttributes } from 'react';

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'unreviewed'
  | 'confirmed'
  | 'false_positive'
  | 'needs_context'
  | 'deferred';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)]',
  success: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
  info: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  // Review status variants
  unreviewed: 'bg-[var(--color-neutral-100)] text-[var(--color-text-muted)]',
  confirmed: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  false_positive: 'bg-[var(--color-neutral-200)] text-[var(--color-neutral-600)]',
  needs_context: 'bg-[var(--color-warning-bg)] text-[var(--color-neutral-800)]',
  deferred: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
};

export function Badge({
  variant = 'default',
  className = '',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center
        px-2 py-0.5
        text-xs font-medium
        rounded-[var(--radius-sm)]
        ${variantStyles[variant]}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      {...props}
    >
      {children}
    </span>
  );
}

// Convenience component for severity badges
interface SeverityBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  severity: number;
}

export function SeverityBadge({ severity, className = '', ...props }: SeverityBadgeProps) {
  let variant: BadgeVariant = 'default';
  let label = 'Low';

  if (severity >= 7) {
    variant = 'danger';
    label = 'High';
  } else if (severity >= 4) {
    variant = 'warning';
    label = 'Medium';
  } else if (severity >= 1) {
    variant = 'success';
    label = 'Low';
  }

  return (
    <Badge variant={variant} className={className} {...props}>
      {label} ({severity})
    </Badge>
  );
}

// Convenience component for review status badges
interface ReviewStatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: string | null | undefined;
}

const statusLabels: Record<string, string> = {
  unreviewed: 'Unreviewed',
  confirmed: 'Confirmed',
  false_positive: 'False Positive',
  needs_context: 'Needs Context',
  deferred: 'Deferred',
};

export function ReviewStatusBadge({ status, className = '', ...props }: ReviewStatusBadgeProps) {
  const normalizedStatus = status || 'unreviewed';
  const variant = normalizedStatus as BadgeVariant;
  const label = statusLabels[normalizedStatus] || 'Unknown';

  return (
    <Badge variant={variant} className={className} {...props}>
      {label}
    </Badge>
  );
}

export default Badge;
