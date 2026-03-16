'use client';

import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

export interface InfoTooltipProps {
  /** Tooltip content text */
  content: string;
  /** Additional CSS classes for the wrapper */
  className?: string;
  /** Icon size in pixels (default 14) */
  size?: number;
}

/**
 * Small (i) icon that shows a tooltip on hover/focus.
 * Uses absolute positioning — no external tooltip library needed.
 */
export function InfoTooltip({ content, className = '', size = 14 }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Show below if not enough room above
      setPosition(rect.top < 80 ? 'bottom' : 'top');
    }
  }, [isVisible]);

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex items-center justify-center rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] transition-colors"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        aria-label={content}
      >
        <Info style={{ width: size, height: size }} />
      </button>
      {isVisible && (
        <span
          role="tooltip"
          className={`absolute z-50 left-1/2 -translate-x-1/2 px-2.5 py-1.5 text-xs leading-relaxed whitespace-normal max-w-[220px] w-max pointer-events-none ${
            position === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
          style={{
            color: 'var(--color-text-inverse)',
            backgroundColor: 'var(--color-neutral-800)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
}
