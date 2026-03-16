'use client';

import { type ReactNode } from 'react';
import { useTagDrawer } from './useTagDrawer';

interface ClickableTagProps {
  field: string;
  value: string;
  contextDocumentId?: number;
  children: ReactNode;
  className?: string;
}

/**
 * Wrapper that makes any tag clickable, opening the TagDrawer on click.
 * Renders as a <button> wrapping children with a hover ring effect.
 */
export function ClickableTag({
  field,
  value,
  contextDocumentId,
  children,
  className = '',
}: ClickableTagProps) {
  const { openTag } = useTagDrawer();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openTag(field, value, contextDocumentId);
      }}
      className={`
        inline-flex items-center
        cursor-pointer
        rounded-[var(--radius-sm)]
        transition-all duration-[var(--duration-fast)]
        hover:ring-2 hover:ring-[var(--color-primary-weak)]
        focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      title={`Explore tag: ${value}`}
    >
      {children}
    </button>
  );
}
