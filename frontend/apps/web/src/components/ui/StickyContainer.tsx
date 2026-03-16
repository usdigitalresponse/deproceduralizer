'use client';

import { useRef, useEffect, useState, type ReactNode } from 'react';

export interface StickyContainerProps {
  /** CSS top offset value (default '0') */
  offset?: string;
  /** Enable backdrop blur (default true) */
  blur?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Content to render inside the sticky container */
  children: ReactNode;
}

/**
 * Wrapper for sticky-positioned elements with optional backdrop blur.
 *
 * Detects when the container is stuck (scrolled past its original position)
 * and adds a subtle bottom border.
 *
 * @example
 * ```tsx
 * <StickyContainer offset="64px">
 *   <FilterBar>...</FilterBar>
 * </StickyContainer>
 * ```
 */
export function StickyContainer({
  offset = '0',
  blur = true,
  className = '',
  children,
}: StickyContainerProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // When the sentinel leaves the viewport, the container is stuck
        setIsStuck(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Sentinel element sits just above the sticky container */}
      <div ref={sentinelRef} className="h-0 w-full" aria-hidden="true" />
      <div
        className={`
          sticky z-20
          ${blur ? 'backdrop-blur-[8px] bg-[var(--color-surface)]/90' : 'bg-[var(--color-surface)]'}
          ${isStuck ? 'border-b border-[var(--color-neutral-200)] shadow-sm' : ''}
          ${className}
        `}
        style={{ top: offset }}
      >
        {children}
      </div>
    </>
  );
}

export default StickyContainer;
