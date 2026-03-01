'use client';

import type { ComponentType } from 'react';
import { Badge } from './Badge';

export interface SegmentedControlOption<T extends string> {
  /** Unique value for this option */
  value: T;
  /** Display label */
  label: string;
  /** Optional icon component */
  icon?: ComponentType<{ className?: string }>;
  /** Optional badge count */
  badge?: number;
  /** Badge variant when displaying a count */
  badgeVariant?: 'default' | 'danger' | 'warning' | 'info';
}

export interface SegmentedControlProps<T extends string> {
  /** Available options */
  options: SegmentedControlOption<T>[];
  /** Currently selected value */
  value: T;
  /** Callback when selection changes */
  onChange: (value: T) => void;
  /** Visual variant */
  variant?: 'filled' | 'outlined';
  /** Size variant */
  size?: 'sm' | 'md';
  /** Accessibility role */
  role?: 'tablist' | 'radiogroup';
  /** Additional CSS classes */
  className?: string;
}

const sizeStyles = {
  sm: {
    container: 'gap-0.5 p-0.5',
    button: 'px-2.5 py-1 text-xs',
    icon: 'w-3.5 h-3.5',
  },
  md: {
    container: 'gap-1 p-1',
    button: 'px-4 py-2 text-sm',
    icon: 'w-4 h-4',
  },
};

const variantStyles = {
  filled: {
    container: 'bg-[var(--color-neutral-100)] rounded-[var(--radius-lg)]',
    active: 'bg-white text-[var(--color-text)] shadow-sm',
    inactive: 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/50',
    buttonBase: 'rounded-[var(--radius-md)]',
  },
  outlined: {
    container: 'border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] overflow-hidden',
    active: 'bg-[var(--color-primary)] text-white',
    inactive: 'bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-50)]',
    buttonBase: 'border-l border-[var(--color-neutral-200)] first:border-l-0',
  },
};

/**
 * A segmented control for switching between options.
 * Supports both tab-like (filled) and toggle-like (outlined) variants.
 *
 * @example
 * ```tsx
 * // Filled variant (tabs)
 * <SegmentedControl
 *   options={[
 *     { value: 'overview', label: 'Overview', icon: BarChart3 },
 *     { value: 'details', label: 'Details', icon: List },
 *   ]}
 *   value={activeTab}
 *   onChange={setActiveTab}
 *   variant="filled"
 * />
 *
 * // Outlined variant (toggle)
 * <SegmentedControl
 *   options={[
 *     { value: 'table', label: 'Table', icon: Table },
 *     { value: 'cards', label: 'Cards', icon: LayoutGrid },
 *   ]}
 *   value={viewMode}
 *   onChange={setViewMode}
 *   variant="outlined"
 * />
 * ```
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  variant = 'filled',
  size = 'md',
  role = 'tablist',
  className = '',
}: SegmentedControlProps<T>) {
  const sizeStyle = sizeStyles[size];
  const variantStyle = variantStyles[variant];

  // Determine aria attributes based on role
  const isTablist = role === 'tablist';

  return (
    <div
      className={`flex items-center overflow-x-auto ${sizeStyle.container} ${variantStyle.container} w-fit max-w-full ${className}`}
      role={role}
    >
      {options.map((option) => {
        const isActive = value === option.value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`
              flex items-center gap-2 shrink-0 whitespace-nowrap
              ${sizeStyle.button}
              font-medium
              transition-all duration-[var(--duration-fast)]
              ${variantStyle.buttonBase}
              ${isActive ? variantStyle.active : variantStyle.inactive}
            `
              .trim()
              .replace(/\s+/g, ' ')}
            role={isTablist ? 'tab' : 'radio'}
            aria-selected={isTablist ? isActive : undefined}
            aria-checked={!isTablist ? isActive : undefined}
            aria-current={isActive ? 'page' : undefined}
          >
            {Icon && <Icon className={sizeStyle.icon} />}
            <span className={variant === 'outlined' ? 'hidden sm:inline' : undefined}>
              {option.label}
            </span>
            {option.badge !== undefined && option.badge > 0 && (
              <Badge variant={option.badgeVariant || 'default'} className="ml-1">
                {option.badge}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
