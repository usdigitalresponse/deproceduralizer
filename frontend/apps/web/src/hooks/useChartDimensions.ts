'use client';

import { useState, useEffect, useCallback, useRef, type RefObject } from 'react';
import type { ChartDimensions, ChartMargin } from '@/lib/charts/types';

const DEFAULT_MARGIN: ChartMargin = {
  top: 20,
  right: 20,
  bottom: 30,
  left: 40,
};

interface UseChartDimensionsOptions {
  /** Aspect ratio (width / height). Default: 16/9 */
  aspectRatio?: number;
  /** Minimum height in pixels. Default: 200 */
  minHeight?: number;
  /** Maximum height in pixels. Default: 600 */
  maxHeight?: number;
  /** Chart margins. Default: { top: 20, right: 20, bottom: 30, left: 40 } */
  margin?: Partial<ChartMargin>;
  /** Debounce resize events by this many ms. Default: 100 */
  debounceMs?: number;
}

/**
 * Hook to provide responsive chart dimensions based on container size.
 * Uses ResizeObserver to track container width and calculates height from aspect ratio.
 *
 * @param containerRef - Ref to the container element
 * @param options - Configuration options
 * @returns ChartDimensions object with width, height, margins, and inner dimensions
 */
export function useChartDimensions(
  containerRef: RefObject<HTMLElement | null>,
  options: UseChartDimensionsOptions = {}
): ChartDimensions {
  const {
    aspectRatio = 16 / 9,
    minHeight = 200,
    maxHeight = 600,
    margin: marginOverride = {},
    debounceMs = 100,
  } = options;

  const margin: ChartMargin = {
    ...DEFAULT_MARGIN,
    ...marginOverride,
  };

  const [dimensions, setDimensions] = useState<ChartDimensions>({
    width: 0,
    height: 0,
    margin,
    innerWidth: 0,
    innerHeight: 0,
  });

  // Debounce timer ref
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateDimensions = useCallback(
    (width: number) => {
      // Calculate height from aspect ratio, clamped to min/max
      const calculatedHeight = width / aspectRatio;
      const height = Math.min(maxHeight, Math.max(minHeight, calculatedHeight));

      // Calculate inner dimensions (usable chart area)
      const innerWidth = Math.max(0, width - margin.left - margin.right);
      const innerHeight = Math.max(0, height - margin.top - margin.bottom);

      setDimensions({
        width,
        height,
        margin,
        innerWidth,
        innerHeight,
      });
    },
    [aspectRatio, minHeight, maxHeight, margin]
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const { width } = entry.contentRect;

      // Debounce the update
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        updateDimensions(width);
      }, debounceMs);
    });

    observer.observe(element);

    // Initial measurement
    updateDimensions(element.clientWidth);

    return () => {
      observer.disconnect();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [containerRef, updateDimensions, debounceMs]);

  return dimensions;
}

/**
 * Hook to get fixed chart dimensions (no responsive behavior).
 * Useful for charts with known, static dimensions.
 */
export function useFixedChartDimensions(
  width: number,
  height: number,
  margin: Partial<ChartMargin> = {}
): ChartDimensions {
  const fullMargin: ChartMargin = {
    ...DEFAULT_MARGIN,
    ...margin,
  };

  return {
    width,
    height,
    margin: fullMargin,
    innerWidth: Math.max(0, width - fullMargin.left - fullMargin.right),
    innerHeight: Math.max(0, height - fullMargin.top - fullMargin.bottom),
  };
}
