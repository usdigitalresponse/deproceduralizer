'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import type { TooltipState, TooltipPosition } from '@/lib/charts/types';

interface ChartTooltipProps<T> {
  /** Tooltip state containing visibility, position, and data */
  state: TooltipState<T>;
  /** Render function for tooltip content */
  children: (data: T) => ReactNode;
  /** Offset from cursor position. Default: { x: 10, y: 10 } */
  offset?: { x: number; y: number };
  /** Additional class names */
  className?: string;
}

/**
 * Chart tooltip component that follows mouse position.
 * Positioned using fixed positioning to escape any container constraints.
 *
 * @example
 * ```tsx
 * const [tooltip, setTooltip] = useState<TooltipState<DataPoint>>({
 *   visible: false, x: 0, y: 0, data: null
 * });
 *
 * <ChartTooltip state={tooltip}>
 *   {(data) => (
 *     <div>
 *       <strong>{data.label}</strong>: {data.value}
 *     </div>
 *   )}
 * </ChartTooltip>
 * ```
 */
export function ChartTooltip<T>({
  state,
  children,
  offset = { x: 10, y: 10 },
  className = '',
}: ChartTooltipProps<T>) {
  const [adjustedPosition, setAdjustedPosition] = useState<TooltipPosition>({ x: 0, y: 0 });

  useEffect(() => {
    if (!state.visible) return;

    // Adjust position to keep tooltip within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipWidth = 200; // Estimated max width
    const tooltipHeight = 100; // Estimated max height

    let x = state.x + offset.x;
    let y = state.y + offset.y;

    // Flip to left side if would overflow right edge
    if (x + tooltipWidth > viewportWidth - 20) {
      x = state.x - tooltipWidth - offset.x;
    }

    // Flip to above if would overflow bottom edge
    if (y + tooltipHeight > viewportHeight - 20) {
      y = state.y - tooltipHeight - offset.y;
    }

    // Ensure minimum bounds
    x = Math.max(10, x);
    y = Math.max(10, y);

    setAdjustedPosition({ x, y });
  }, [state.visible, state.x, state.y, offset.x, offset.y]);

  if (!state.visible || !state.data) {
    return null;
  }

  return (
    <div
      className={`
        fixed z-[var(--z-tooltip)]
        bg-[var(--color-neutral-900)]
        text-[var(--color-text-inverse)]
        text-sm
        px-3 py-2
        rounded-[var(--radius-md)]
        shadow-[var(--shadow-lg)]
        pointer-events-none
        max-w-[250px]
        ${className}
      `
        .trim()
        .replace(/\s+/g, ' ')}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
      role="tooltip"
    >
      {children(state.data)}
    </div>
  );
}

/**
 * Hook to manage tooltip state for chart interactions.
 *
 * @example
 * ```tsx
 * const { tooltip, showTooltip, hideTooltip, handleMouseMove } = useChartTooltip<DataPoint>();
 *
 * <rect
 *   onMouseEnter={() => showTooltip(dataPoint)}
 *   onMouseMove={handleMouseMove}
 *   onMouseLeave={hideTooltip}
 * />
 * <ChartTooltip state={tooltip}>...</ChartTooltip>
 * ```
 */
export function useChartTooltip<T>() {
  const [tooltip, setTooltip] = useState<TooltipState<T>>({
    visible: false,
    x: 0,
    y: 0,
    data: null,
  });

  const showTooltip = useCallback((data: T, event?: MouseEvent | React.MouseEvent) => {
    const x = event?.clientX ?? 0;
    const y = event?.clientY ?? 0;
    setTooltip({ visible: true, x, y, data });
  }, []);

  const hideTooltip = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  const updatePosition = useCallback((event: MouseEvent | React.MouseEvent) => {
    setTooltip((prev) => ({
      ...prev,
      x: event.clientX,
      y: event.clientY,
    }));
  }, []);

  const handleMouseMove = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      updatePosition(event);
    },
    [updatePosition]
  );

  return {
    tooltip,
    showTooltip,
    hideTooltip,
    updatePosition,
    handleMouseMove,
  };
}
