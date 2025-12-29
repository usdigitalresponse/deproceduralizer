'use client';

import { useRef, type ReactNode } from 'react';
import { Card } from '@/components/ui';
import { useChartDimensions } from '@/hooks/useChartDimensions';
import type { ChartDimensions, ChartMargin } from '@/lib/charts/types';

interface ChartContainerProps {
  /** Chart title displayed above the visualization */
  title?: string;
  /** Description text below the title */
  description?: string;
  /** Render function receiving chart dimensions */
  children: (dimensions: ChartDimensions) => ReactNode;
  /** Aspect ratio for responsive height calculation. Default: 16/9 */
  aspectRatio?: number;
  /** Minimum chart height. Default: 200 */
  minHeight?: number;
  /** Maximum chart height. Default: 600 */
  maxHeight?: number;
  /** Chart margins. Default: { top: 20, right: 20, bottom: 30, left: 40 } */
  margin?: Partial<ChartMargin>;
  /** Additional class names for the container */
  className?: string;
  /** Card variant. Default: 'default' */
  variant?: 'default' | 'elevated' | 'bordered';
  /** Card padding. Default: 'md' */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Optional action buttons or controls to display in the header */
  actions?: ReactNode;
}

/**
 * Responsive chart container that provides dimensions to child chart components.
 *
 * Uses ResizeObserver to track container width and calculates height based on
 * aspect ratio. Wraps content in a Card component for consistent styling.
 *
 * @example
 * ```tsx
 * <ChartContainer
 *   title="Severity Distribution"
 *   description="Distribution of flags by severity level"
 *   aspectRatio={1}
 * >
 *   {({ width, height }) => (
 *     <PieChart data={data} width={width} height={height} />
 *   )}
 * </ChartContainer>
 * ```
 */
export function ChartContainer({
  title,
  description,
  children,
  aspectRatio = 16 / 9,
  minHeight = 200,
  maxHeight = 600,
  margin,
  className = '',
  variant = 'default',
  padding = 'md',
  actions,
}: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dimensions = useChartDimensions(containerRef, {
    aspectRatio,
    minHeight,
    maxHeight,
    margin,
  });

  return (
    <Card variant={variant} padding={padding} className={className}>
      {(title || actions) && (
        <div className="flex items-start justify-between mb-4">
          <div>
            {title && (
              <h3 className="text-lg font-semibold text-[var(--color-text)]">{title}</h3>
            )}
            {description && (
              <p className="text-sm text-[var(--color-text-muted)] mt-1">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div ref={containerRef} className="w-full">
        {dimensions.width > 0 && children(dimensions)}
      </div>
    </Card>
  );
}

/**
 * Simple chart wrapper without Card styling.
 * Use when you need just the responsive dimensions behavior.
 */
export function ChartWrapper({
  children,
  aspectRatio = 16 / 9,
  minHeight = 200,
  maxHeight = 600,
  margin,
  className = '',
}: Omit<ChartContainerProps, 'title' | 'description' | 'variant' | 'padding' | 'actions'>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dimensions = useChartDimensions(containerRef, {
    aspectRatio,
    minHeight,
    maxHeight,
    margin,
  });

  return (
    <div ref={containerRef} className={`w-full ${className}`}>
      {dimensions.width > 0 && children(dimensions)}
    </div>
  );
}
