'use client';

import { forwardRef, type ReactNode } from 'react';
import { Card } from '@/components/ui';

interface CardWrapperProps {
  id: string;
  isFocused?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Shared card wrapper for review/developer cards with focus state handling.
 *
 * @example
 * <CardWrapper id={`flag-${flag.id}`} isFocused={isFocused} ref={ref}>
 *   {children}
 * </CardWrapper>
 */
export const CardWrapper = forwardRef<HTMLDivElement, CardWrapperProps>(
  ({ id, isFocused = false, children, className = '' }, ref) => {
    return (
      <Card
        ref={ref}
        id={id}
        className={`
          transition-shadow duration-[var(--duration-fast)]
          ${isFocused ? 'ring-2 ring-[var(--color-focus)] ring-offset-2' : ''}
          ${className}
        `}
        tabIndex={0}
      >
        {children}
      </Card>
    );
  }
);

CardWrapper.displayName = 'CardWrapper';

export default CardWrapper;
