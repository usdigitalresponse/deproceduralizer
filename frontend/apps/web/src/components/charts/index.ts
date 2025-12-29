/**
 * Chart Components
 *
 * D3-powered visualization components with React rendering.
 * All components are client-only and should be wrapped in ClientChart
 * when used in pages with SSR.
 */

// Infrastructure
export { ClientChart, ChartSkeleton } from './ClientChart';
export { ChartContainer, ChartWrapper } from './ChartContainer';
export { ChartTooltip, useChartTooltip } from './ChartTooltip';
export { ChartLegend, ChartLegendCompact, ChartLegendGradient } from './ChartLegend';

// Chart Components
export { PieChart, SeverityDonutChart } from './PieChart';
export { BarChart, HorizontalBarChart, StackedBarChart } from './BarChart';

// Re-export types
export type {
  ChartDimensions,
  ChartMargin,
  HierarchyDatum,
  TreemapNode,
  TreemapSizeMetric,
  TreemapColorMetric,
  PieChartDatum,
  PieSliceData,
  BarChartDatum,
  BarOrientation,
  HeatmapCell,
  HeatmapData,
  TooltipState,
  TooltipPosition,
  LegendItem,
  LegendOrientation,
} from '@/lib/charts/types';
