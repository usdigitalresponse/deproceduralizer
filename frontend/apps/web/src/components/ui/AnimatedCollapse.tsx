'use client';

import { useRef, useEffect, useState, type ReactNode } from 'react';

export interface AnimatedCollapseProps {
  /** Whether the content is expanded */
  isOpen: boolean;
  /** Content to show/hide */
  children: ReactNode;
  /** Transition duration in ms (default 200) */
  duration?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Smooth expand/collapse animation wrapper.
 *
 * Measures content height via a ref and transitions max-height + opacity.
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 * <button onClick={() => setOpen(!open)}>Toggle</button>
 * <AnimatedCollapse isOpen={open}>
 *   <p>Collapsible content here</p>
 * </AnimatedCollapse>
 * ```
 */
export function AnimatedCollapse({
  isOpen,
  children,
  duration = 200,
  className = '',
}: AnimatedCollapseProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [children, isOpen]);

  // Re-measure on resize to handle dynamic content
  useEffect(() => {
    if (!contentRef.current) return;

    const observer = new ResizeObserver(() => {
      if (contentRef.current) {
        setHeight(contentRef.current.scrollHeight);
      }
    });

    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, []);

  const effectiveDuration = prefersReducedMotion ? 0 : duration;

  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{
        maxHeight: isOpen ? height : 0,
        opacity: isOpen ? 1 : 0,
        transition: effectiveDuration > 0
          ? `max-height ${effectiveDuration}ms ease-out, opacity ${Math.round(effectiveDuration * 0.75)}ms ease-in`
          : 'none',
      }}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
}

export default AnimatedCollapse;
