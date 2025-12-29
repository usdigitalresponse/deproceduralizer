'use client';

import { useEffect, useState, type ReactNode } from 'react';

interface ClientChartProps {
  /** The chart component to render */
  children: ReactNode;
  /** Fallback content shown during SSR and before hydration */
  fallback?: ReactNode;
  /** Minimum height for the fallback skeleton. Default: 300 */
  minHeight?: number;
  /** Additional class names for the fallback skeleton */
  className?: string;
}

/**
 * SSR-safe wrapper for D3 chart components.
 *
 * D3 requires access to the DOM and window object, which aren't available
 * during server-side rendering. This component ensures charts only render
 * on the client after hydration.
 *
 * @example
 * ```tsx
 * <ClientChart fallback={<ChartSkeleton />}>
 *   <PieChart data={data} width={400} height={400} />
 * </ClientChart>
 * ```
 */
export function ClientChart({
  children,
  fallback,
  minHeight = 300,
  className = '',
}: ClientChartProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      fallback ?? (
        <div
          className={`
            animate-pulse
            bg-[var(--color-neutral-100)]
            rounded-[var(--radius-lg)]
            flex items-center justify-center
            ${className}
          `
            .trim()
            .replace(/\s+/g, ' ')}
          style={{ minHeight }}
          role="status"
          aria-label="Loading chart..."
        >
          <span className="text-[var(--color-text-muted)] text-sm">Loading chart...</span>
        </div>
      )
    );
  }

  return <>{children}</>;
}

/**
 * Skeleton component matching common chart loading state.
 * Use as a fallback prop for ClientChart.
 */
export function ChartSkeleton({
  height = 300,
  className = '',
}: {
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={`
        animate-pulse
        bg-[var(--color-neutral-100)]
        rounded-[var(--radius-lg)]
        flex flex-col items-center justify-center
        gap-2
        ${className}
      `
        .trim()
        .replace(/\s+/g, ' ')}
      style={{ height }}
      role="status"
      aria-label="Loading chart..."
    >
      <div className="w-16 h-16 bg-[var(--color-neutral-200)] rounded-full" />
      <div className="w-24 h-3 bg-[var(--color-neutral-200)] rounded" />
    </div>
  );
}
