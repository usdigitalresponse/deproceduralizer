'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';
import { Tag } from 'lucide-react';

type BookmarkButtonSize = 'sm' | 'md';

interface BookmarkButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  isBookmarked: boolean;
  onToggle: () => void;
  size?: BookmarkButtonSize;
  showLabel?: boolean;
  isLoading?: boolean;
}

const sizeStyles: Record<BookmarkButtonSize, { button: string; icon: string }> = {
  sm: {
    button: 'p-1',
    icon: 'w-4 h-4',
  },
  md: {
    button: 'p-1.5',
    icon: 'w-5 h-5',
  },
};

export const BookmarkButton = forwardRef<HTMLButtonElement, BookmarkButtonProps>(
  ({
    className = '',
    isBookmarked,
    onToggle,
    size = 'sm',
    showLabel = false,
    isLoading = false,
    disabled,
    ...props
  }, ref) => {
    const isDisabled = disabled || isLoading;
    const styles = sizeStyles[size];

    return (
      <button
        ref={ref}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (!isDisabled) {
            onToggle();
          }
        }}
        className={`
          inline-flex items-center justify-center gap-1
          rounded-[var(--radius-sm)]
          transition-colors duration-[var(--duration-fast)]
          outline-none
          ${styles.button}
          ${isBookmarked
            ? 'text-[var(--color-warning)] hover:text-[var(--color-warning-strong)]'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-warning)]'
          }
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          hover:bg-[var(--color-neutral-100)]
          focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-1
          ${className}
        `.trim().replace(/\s+/g, ' ')}
        disabled={isDisabled}
        aria-label={isBookmarked ? 'Unmark' : 'Mark'}
        aria-pressed={isBookmarked}
        title={isBookmarked ? 'Unmark' : 'Mark'}
        {...props}
      >
        {isLoading ? (
          <svg
            className={`animate-spin ${styles.icon}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <Tag
            className={`${styles.icon} transition-transform duration-200 ${isBookmarked ? 'scale-110' : 'scale-100'}`}
            fill={isBookmarked ? 'currentColor' : 'none'}
            strokeWidth={isBookmarked ? 0 : 2}
            style={isBookmarked ? { animation: 'bookmark-pop 300ms ease-out' } : undefined}
          />
        )}
        {showLabel && (
          <span className="text-xs font-medium">
            {isBookmarked ? 'Marked' : 'Mark'}
          </span>
        )}
      </button>
    );
  }
);

BookmarkButton.displayName = 'BookmarkButton';

export default BookmarkButton;
