'use client';

import { Card } from '@/components/ui';
import type { TreemapSizeMetricValue, TreemapColorMetricValue } from '@/lib/constants/values';

interface HierarchyTabProps {
  state: string;
  sizeMetric: TreemapSizeMetricValue;
  colorMetric: TreemapColorMetricValue;
  depth: number;
  onParamsChange: (params: Record<string, unknown>) => void;
}

export function HierarchyTab({
  state,
  sizeMetric,
  colorMetric,
  depth,
  onParamsChange,
}: HierarchyTabProps) {
  // TODO: Implement zoomable treemap visualization
  // This will require:
  // 1. New server action to get hierarchy treemap data
  // 2. D3 treemap component with zoom interactions
  // 3. Breadcrumb navigation for drill-down

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card padding="md">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-[var(--color-text-muted)]">Size by:</label>
            <select
              value={sizeMetric}
              onChange={(e) => onParamsChange({ sizeMetric: e.target.value })}
              className="px-3 py-1.5 text-sm border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] bg-white"
            >
              <option value="flags">Flag Count</option>
              <option value="documents">Document Count</option>
              <option value="compliance">Compliance Issues</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-[var(--color-text-muted)]">Color by:</label>
            <select
              value={colorMetric}
              onChange={(e) => onParamsChange({ colorMetric: e.target.value })}
              className="px-3 py-1.5 text-sm border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] bg-white"
            >
              <option value="severity">Max Severity</option>
              <option value="reviewStatus">Review Status</option>
              <option value="none">None</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-[var(--color-text-muted)]">Depth:</label>
            <select
              value={depth}
              onChange={(e) => onParamsChange({ depth: parseInt(e.target.value) })}
              className="px-3 py-1.5 text-sm border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] bg-white"
            >
              <option value="1">Titles Only</option>
              <option value="2">+ Parts</option>
              <option value="3">+ Sections</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Treemap Placeholder */}
      <Card padding="lg" className="min-h-[400px] flex items-center justify-center">
        <div className="text-center text-[var(--color-text-muted)]">
          <p className="text-lg font-medium mb-2">Hierarchy Treemap</p>
          <p className="text-sm">
            Visualize regulatory hierarchy for {state.toUpperCase()} with boxes sized by{' '}
            <strong>{sizeMetric}</strong> and colored by <strong>{colorMetric}</strong>
          </p>
          <p className="text-xs mt-4 text-[var(--color-text-muted)]">
            Coming soon: Zoomable treemap with drill-down navigation
          </p>
        </div>
      </Card>
    </div>
  );
}
