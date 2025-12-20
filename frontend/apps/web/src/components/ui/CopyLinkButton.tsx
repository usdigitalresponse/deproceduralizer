'use client';

import { useState, useCallback } from 'react';
import { Link2, Check } from 'lucide-react';

interface CopyLinkButtonProps {
  /** The anchor ID (without the #) to append to the current URL */
  anchor: string;
  /** Optional className for additional styling */
  className?: string;
  /** Size of the button */
  size?: 'sm' | 'md';
}

/**
 * A button that copies a deep link (current URL + query params + anchor) to the clipboard.
 * Includes search params to prevent server redirects that would lose the hash.
 * Shows a brief checkmark feedback after copying.
 */
export function CopyLinkButton({ anchor, className = '', size = 'sm' }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Include search params to prevent server redirects that would lose the hash
    const searchParams = window.location.search;
    const url = `${window.location.origin}${window.location.pathname}${searchParams}#${anchor}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  }, [anchor]);

  const sizeStyles = size === 'sm'
    ? 'p-1 h-6 w-6'
    : 'p-1.5 h-8 w-8';

  const iconSize = size === 'sm' ? 14 : 16;

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy link to this item'}
      className={`
        inline-flex items-center justify-center
        rounded-[var(--radius-sm)]
        text-[var(--color-text-muted)]
        hover:text-[var(--color-primary)]
        hover:bg-[var(--color-neutral-100)]
        transition-colors duration-[var(--duration-fast)]
        focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:outline-none
        ${sizeStyles}
        ${copied ? 'text-[var(--color-success)]' : ''}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      {copied ? (
        <Check size={iconSize} strokeWidth={2.5} />
      ) : (
        <Link2 size={iconSize} />
      )}
    </button>
  );
}

export default CopyLinkButton;
