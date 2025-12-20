'use client';

import { type LucideIcon, FileSearch } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  /** Icon to display (defaults to FileSearch) */
  icon?: LucideIcon;
  /** Primary message */
  title: string;
  /** Secondary descriptive text */
  description?: string;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Additional class name */
  className?: string;
}

/**
 * Empty state component for when there's no data to display.
 *
 * @example
 * // Basic usage
 * <EmptyState title="No results found" />
 *
 * @example
 * // With description and action
 * <EmptyState
 *   icon={Search}
 *   title="No red flags found"
 *   description="Try adjusting your filters or search terms"
 *   action={{ label: "Clear filters", onClick: handleClear }}
 * />
 *
 * @example
 * // In a queue component
 * {items.length === 0 ? (
 *   <EmptyState
 *     icon={CheckCircle}
 *     title="All caught up!"
 *     description="No items need review"
 *   />
 * ) : (
 *   <ItemList items={items} />
 * )}
 */
export function EmptyState({
  icon: Icon = FileSearch,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center
        py-12 px-4 text-center
        ${className}
      `}
    >
      <Icon
        className="w-12 h-12 text-[var(--color-neutral-300)] mb-4"
        aria-hidden="true"
      />
      <h3 className="text-lg font-medium text-[var(--color-text)] mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--color-text-muted)] max-w-md mb-4">
          {description}
        </p>
      )}
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
