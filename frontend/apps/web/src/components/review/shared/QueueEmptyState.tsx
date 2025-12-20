'use client';

import { type LucideIcon, FileSearch } from 'lucide-react';

interface QueueEmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
}

/**
 * Empty state for queues when no items match filters.
 *
 * @example
 * <QueueEmptyState
 *   title="No flags found"
 *   description="Try adjusting your filters or check back later."
 * />
 */
export function QueueEmptyState({
  icon: Icon = FileSearch,
  title = 'No items found',
  description = 'Try adjusting your filters or check back later.',
}: QueueEmptyStateProps) {
  return (
    <div className="text-center py-12 text-[var(--color-text-muted)]">
      <Icon className="w-12 h-12 mx-auto mb-4 opacity-50" />
      <p className="text-lg mb-2">{title}</p>
      <p className="text-sm">{description}</p>
    </div>
  );
}

export default QueueEmptyState;
