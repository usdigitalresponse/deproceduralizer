'use client';

import { Suspense } from 'react';
import type { StateCode, TierCompletionCounts, ClassificationBreakdown } from '@deproceduralizer/database';
import { TierDistributionChart } from './TierDistributionChart';
import { AnalysisTable } from './AnalysisTable';
import { AnalysisTableFilters } from './AnalysisTableFilters';
import { PipelineFlowVisualizer } from './PipelineFlowVisualizer';

interface AnalysisDashboardProps {
  state: StateCode;
  tierCounts: TierCompletionCounts | null;
  classificationBreakdown: ClassificationBreakdown | null;
  total: number;
}

export function AnalysisDashboard({
  state,
  tierCounts,
  classificationBreakdown,
  total,
}: AnalysisDashboardProps) {
  if (!tierCounts || !classificationBreakdown) {
    return (
      <div className="text-center py-12 text-[var(--color-text-muted)]">
        No pipeline data available
      </div>
    );
  }

  const analyzedCount = total - tierCounts.tier0;
  const analyzedPercentage = total > 0 ? (analyzedCount / total) * 100 : 0;

  return (
    <div className="space-y-6">
      <PipelineFlowVisualizer />

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-4">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">Total Issues</div>
          <div className="text-2xl font-bold text-[var(--color-text)]">
            {total.toLocaleString()}
          </div>
        </div>

        <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-4">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">Analyzed</div>
          <div className="text-2xl font-bold text-[var(--color-primary)]">
            {analyzedCount.toLocaleString()}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">
            {analyzedPercentage.toFixed(1)}% complete
          </div>
        </div>

        <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-4">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">Burdensome</div>
          <div className="text-2xl font-bold text-[var(--color-warning)]">
            {(
              (classificationBreakdown.tier2['burdensome'] || 0) +
              (classificationBreakdown.tier3['burdensome'] || 0) +
              (classificationBreakdown.tier4['burdensome'] || 0)
            ).toLocaleString()}
          </div>
        </div>

        <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-4">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">Justified</div>
          <div className="text-2xl font-bold text-[var(--color-success)]">
            {(
              (classificationBreakdown.tier2['justified'] || 0) +
              (classificationBreakdown.tier3['justified'] || 0) +
              (classificationBreakdown.tier4['justified'] || 0)
            ).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Distribution Chart */}
      <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-6">
        <TierDistributionChart
          tierCounts={tierCounts}
          classificationBreakdown={classificationBreakdown}
          total={total}
        />
      </div>

      {/* Analysis Table Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-[var(--color-text)]">
          Pipeline Records
        </h3>

        <Suspense fallback={<div className="animate-pulse bg-[var(--color-neutral-100)] h-12 rounded-[var(--radius-md)]" />}>
          <AnalysisTableFilters />
        </Suspense>

        <Suspense fallback={<div className="animate-pulse bg-[var(--color-neutral-100)] h-64 rounded-[var(--radius-md)]" />}>
          <AnalysisTable state={state} />
        </Suspense>
      </div>
    </div>
  );
}

export default AnalysisDashboard;
