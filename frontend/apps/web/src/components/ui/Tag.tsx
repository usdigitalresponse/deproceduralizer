'use client';

import { X } from 'lucide-react';
import { type ReactNode } from 'react';

export type TagVariant = 'default' | 'primary' | 'danger' | 'warning' | 'success';
export type TagSize = 'sm' | 'md';

export interface TagProps {
  /** Tag content */
  children: ReactNode;
  /** Visual variant */
  variant?: TagVariant;
  /** Size variant */
  size?: TagSize;
  /** Show remove button */
  removable?: boolean;
  /** Called when remove button is clicked */
  onRemove?: () => void;
  /** Additional class name */
  className?: string;
}

const variantStyles: Record<TagVariant, string> = {
  default: 'bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)]',
  primary: 'bg-[var(--color-primary-weaker)] text-[var(--color-primary)]',
  danger: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger)]/20',
  warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning)]/20',
  success: 'bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success)]/20',
};

const sizeStyles: Record<TagSize, string> = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-sm px-2 py-1',
};

/**
 * Tag component for displaying labels, matched phrases, keywords, etc.
 *
 * @example
 * // Basic tag
 * <Tag>Label</Tag>
 *
 * @example
 * // Matched phrase (danger variant)
 * <Tag variant="danger" size="sm">shall comply</Tag>
 *
 * @example
 * // Removable tag
 * <Tag removable onRemove={() => handleRemove()}>keyword</Tag>
 */
export function Tag({
  children,
  variant = 'default',
  size = 'sm',
  removable = false,
  onRemove,
  className = '',
}: TagProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1
        rounded-[var(--radius-sm)]
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {children}
      {removable && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="hover:opacity-70 transition-opacity"
          aria-label="Remove"
        >
          <X className="w-3 h-3" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

export default Tag;
