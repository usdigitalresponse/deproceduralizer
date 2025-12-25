'use client';

import { forwardRef, type ReactNode } from 'react';
import { Card } from '@/components/ui';

interface CardWrapperProps {
  id: string;
  isFocused?: boolean;
  isExiting?: boolean;
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
  ({ id, isFocused = false, isExiting = false, children, className = '' }, ref) => {
    return (
      <Card
        ref={ref}
        id={id}
        className={`
          transition-all duration-300 ease-out
          ${isFocused ? 'ring-2 ring-[var(--color-focus)] ring-offset-2' : ''}
          ${isExiting ? 'opacity-0 scale-95 -translate-x-4' : 'opacity-100 scale-100 translate-x-0'}
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
