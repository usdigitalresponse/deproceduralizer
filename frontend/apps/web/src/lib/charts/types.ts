/**
 * Shared TypeScript types for D3 chart components
 */

import type { HierarchyRectangularNode } from 'd3-hierarchy';

// ============================================
// Base Chart Types
// ============================================

export interface ChartDimensions {
  width: number;
  height: number;
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  innerWidth: number;
  innerHeight: number;
}

export interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ============================================
// Hierarchy / Treemap Types
// ============================================

export interface HierarchyDatum {
  id: number;
  name: string;
  value: number;
  children?: HierarchyDatum[];
  // Regulatory-specific fields
  hierarchyLevel?: string;
  maxSeverity?: number;
  flagCount?: number;
  complianceIssueCount?: number;
  citation?: string;
  path?: string;
}

export type TreemapNode = HierarchyRectangularNode<HierarchyDatum>;

export type TreemapSizeMetric = 'flags' | 'documents' | 'compliance';
export type TreemapColorMetric = 'severity' | 'reviewStatus' | 'none';

// ============================================
// Pie / Donut Chart Types
// ============================================

export interface PieChartDatum {
  label: string;
  value: number;
  color?: string;
}

export interface PieSliceData<T extends PieChartDatum> {
  data: T;
  startAngle: number;
  endAngle: number;
  padAngle: number;
  index: number;
  value: number;
}

// ============================================
// Bar Chart Types
// ============================================

export interface BarChartDatum {
  label: string;
  value: number;
  color?: string;
  secondaryLabel?: string;
}

export type BarOrientation = 'horizontal' | 'vertical';

// ============================================
// Heatmap Types
// ============================================

export interface HeatmapCell {
  row: string;
  column: string;
  value: number;
}

export interface HeatmapData {
  rows: string[];
  columns: string[];
  cells: HeatmapCell[];
  maxValue: number;
}

// ============================================
// Tooltip Types
// ============================================

export interface TooltipState<T = unknown> {
  visible: boolean;
  x: number;
  y: number;
  data: T | null;
}

export interface TooltipPosition {
  x: number;
  y: number;
}

// ============================================
// Legend Types
// ============================================

export interface LegendItem {
  label: string;
  color: string;
  value?: number | string;
}

export type LegendOrientation = 'horizontal' | 'vertical';

// ============================================
// Analytics Data Types
// ============================================

export interface SeverityDistribution {
  high: number;
  medium: number;
  low: number;
  notAnalyzed: number;
}

export interface ReviewStatusDistribution {
  unreviewed: number;
  confirmed: number;
  falsePositive: number;
  needsContext: number;
  deferred: number;
  rejected: number;
}

export interface IssueTypeCount {
  type: string;
  count: number;
  avgSeverity?: number;
}

export interface KeywordCount {
  keyword: string;
  count: number;
}

export interface SectionTypeCount {
  sectionType: string;
  count: number;
}

export interface HierarchyLevelStats {
  level: string;
  total: number;
  analyzed: number;
  withFlags: number;
  avgSeverity: number;
}
