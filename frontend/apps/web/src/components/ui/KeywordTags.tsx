'use client';

import { HTMLAttributes } from 'react';
import { ClickableTag } from '@/components/tags/ClickableTag';

interface KeywordTagsProps extends HTMLAttributes<HTMLDivElement> {
  keywords: string[] | null | undefined;
  /** Maximum number of tags to display before showing "+N" */
  maxDisplay?: number;
  /** Size variant */
  size?: 'sm' | 'md';
  /** When provided, each keyword becomes clickable via ClickableTag */
  tagField?: string;
}

/**
 * Component for displaying an array of keywords as tags.
 * Shows a configurable number of keywords with overflow indicator.
 *
 * @example
 * <KeywordTags keywords={['licensing', 'fees', 'application']} />
 *
 * @example
 * <KeywordTags keywords={keywords} maxDisplay={2} size="sm" />
 */
export function KeywordTags({
  keywords,
  maxDisplay = 3,
  size = 'sm',
  tagField,
  className = '',
  ...props
}: KeywordTagsProps) {
  if (!keywords?.length) return null;

  const displayed = keywords.slice(0, maxDisplay);
  const remaining = keywords.length - maxDisplay;

  const sizeStyles = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm';

  return (
    <div className={`flex flex-wrap gap-1 ${className}`} {...props}>
      {displayed.map((keyword) => {
        const badge = (
          <span
            className={`
              inline-flex items-center
              ${sizeStyles}
              bg-[var(--color-neutral-100)]
              text-[var(--color-text-secondary)]
              rounded-[var(--radius-sm)]
            `.trim().replace(/\s+/g, ' ')}
          >
            {keyword}
          </span>
        );

        return tagField ? (
          <ClickableTag key={keyword} field={tagField} value={keyword}>
            {badge}
          </ClickableTag>
        ) : (
          <span key={keyword}>{badge}</span>
        );
      })}
      {remaining > 0 && (
        <span
          className={`
            inline-flex items-center
            ${sizeStyles}
            text-[var(--color-text-muted)]
          `.trim().replace(/\s+/g, ' ')}
          title={keywords.slice(maxDisplay).join(', ')}
        >
          +{remaining}
        </span>
      )}
    </div>
  );
}

export default KeywordTags;
