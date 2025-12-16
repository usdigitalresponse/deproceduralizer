'use client';

import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { type ReactNode } from 'react';

export type AlertVariant = 'error' | 'warning' | 'success' | 'info';

export interface AlertProps {
  /** Visual variant */
  variant: AlertVariant;
  /** Optional title */
  title?: string;
  /** Alert content */
  children: ReactNode;
  /** Custom icon (overrides default) */
  icon?: ReactNode;
  /** Additional class name */
  className?: string;
}

const variantStyles: Record<AlertVariant, string> = {
  error: 'bg-[var(--color-danger-bg)] border-[var(--color-danger)]/30 text-[var(--color-danger)]',
  warning: 'bg-[var(--color-warning-bg)] border-[var(--color-warning)]/30 text-[var(--color-warning)]',
  success: 'bg-[var(--color-success-bg)] border-[var(--color-success)]/30 text-[var(--color-success)]',
  info: 'bg-[var(--color-primary-bg)] border-[var(--color-primary)]/30 text-[var(--color-primary)]',
};

const defaultIcons: Record<AlertVariant, ReactNode> = {
  error: <XCircle className="w-5 h-5 shrink-0" aria-hidden="true" />,
  warning: <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />,
  success: <CheckCircle className="w-5 h-5 shrink-0" aria-hidden="true" />,
  info: <Info className="w-5 h-5 shrink-0" aria-hidden="true" />,
};

/**
 * Alert component for displaying messages with different severity levels.
 *
 * @example
 * // Error alert
 * <Alert variant="error">
 *   Failed to save changes. Please try again.
 * </Alert>
 *
 * @example
 * // With title
 * <Alert variant="warning" title="Unsaved Changes">
 *   You have unsaved changes that will be lost.
 * </Alert>
 *
 * @example
 * // Success alert
 * <Alert variant="success">
 *   Changes saved successfully!
 * </Alert>
 */
export function Alert({
  variant,
  title,
  children,
  icon,
  className = '',
}: AlertProps) {
  const displayIcon = icon ?? defaultIcons[variant];

  return (
    <div
      role="alert"
      className={`
        p-3 border rounded-[var(--radius-md)] text-sm
        ${variantStyles[variant]}
        ${className}
      `}
    >
      <div className="flex gap-3">
        {displayIcon}
        <div className="flex-1 min-w-0">
          {title && (
            <p className="font-semibold mb-1">{title}</p>
          )}
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}

export default Alert;
