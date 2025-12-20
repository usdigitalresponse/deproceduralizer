'use client';

import { Button } from '@/components/ui';

interface CardActionsProps {
  onViewRegulation: () => void;
  viewLabel?: string;
  submitLabel?: string;
  isPending?: boolean;
}

/**
 * Shared action buttons for review/developer cards.
 *
 * @example
 * <CardActions
 *   onViewRegulation={() => onViewRegulation(regulation.id)}
 *   isPending={isPending}
 * />
 */
export function CardActions({
  onViewRegulation,
  viewLabel = 'View Regulation',
  submitLabel = 'Save',
  isPending = false,
}: CardActionsProps) {
  return (
    <div className="flex items-center justify-between">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onViewRegulation}
      >
        {viewLabel}
      </Button>
      <Button type="submit" variant="primary" size="sm" isLoading={isPending}>
        {isPending ? 'Saving...' : submitLabel}
      </Button>
    </div>
  );
}

export default CardActions;
