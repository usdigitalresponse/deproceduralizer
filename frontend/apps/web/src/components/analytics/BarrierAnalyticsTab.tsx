'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Sparkles, AlertTriangle, BarChart3, CheckCircle, BookOpen, Zap, Layers, ArrowRight } from 'lucide-react';
import type { BarrierReviewStatusCounts, BurdenOverviewStats, BarrierDeveloperStatusCounts, SeverityDistribution, JurisdictionCode } from '@deproceduralizer/database';
import type { BarrierStrategyStats } from '@/lib/actions/barrier-strategies';
import { Card } from '@/components/ui/Card';
import { StatCard, StatGrid } from '@/components/ui';
import { STRATEGIES, getStrategyCount } from '@/lib/constants/barrier';
import { StickyPageSectionTabs } from '@/components/navigation/StickyPageSectionTabs';
import type { SectionConfig } from '@/hooks/useActiveSection';
import {
  ClientChart, ChartContainer, HorizontalBarChart,
  PieChart, HeatmapGrid, BarChart, ChartLegend,
  StackedBarChart,
} from '@/components/charts';
import { useChartColors } from '@/hooks/useChartColors';
import { getCategoryLabel, isStructuralCategory } from '@/lib/constants/barrier';
import { formatLabel } from '@/types/regulation';
import type { BarChartDatum, PieChartDatum, HeatmapData } from '@/lib/charts/types';

export interface BarrierAnalyticsTabProps {
  barrierStats: BarrierReviewStatusCounts | null;
  barrierSeverity: SeverityDistribution | null;
  categories: { category: string; count: number }[] | null;
  parts: { part: string; partName: string | null; count: number }[] | null;
  sectionTypes: { sectionType: string; count: number }[] | null;
  developerStatusCounts: BarrierDeveloperStatusCounts | null;
  burdenStats: BurdenOverviewStats | null;
  complexityDistribution: { complexity: string; count: number }[] | null;
  categorySeverityMatrix: { category: string; severityBucket: string; count: number }[] | null;
  sourceTypeBreakdown: { regulation: number; guidance: number } | null;
  reviewProgressByCategory: { category: string; reviewStatus: string; count: number }[] | null;
  burdenScoreDistribution: { bucket: string; count: number }[] | null;
  strategyStats?: BarrierStrategyStats | null;
  jurisdiction?: JurisdictionCode;
}

const COMPLEXITY_COLORS: Record<string, string> = {
  HIGH: '#b52c2c',
  'MEDIUM-HIGH': '#ea580c',
  MEDIUM: '#b45309',
  LOW: '#1e752e',
};

export function BarrierAnalyticsTab({
  barrierStats,
  barrierSeverity,
  categories,
  parts,
  sectionTypes,
  developerStatusCounts,
  burdenStats,
  complexityDistribution,
  categorySeverityMatrix,
  sourceTypeBreakdown,
  reviewProgressByCategory,
  burdenScoreDistribution,
  strategyStats,
  jurisdiction,
}: BarrierAnalyticsTabProps) {
  const { colors, reviewStatusColors, categoryScale } = useChartColors();

  // === Section 1: Overview ===
  const reviewProgress = barrierStats && barrierStats.total > 0
    ? Math.round((barrierStats.confirmed / barrierStats.total) * 100)
    : 0;

  // === Section 2: Category Landscape ===
  const categoryBarData: BarChartDatum[] = useMemo(() => {
    if (!categories) return [];
    return categories
      .map(c => ({
        label: getCategoryLabel(c.category),
        value: c.count,
        color: isStructuralCategory(c.category) ? colors.warning : undefined,
      }))
      .sort((a, b) => b.value - a.value);
  }, [categories, colors]);

  const structuralPieData: PieChartDatum[] = useMemo(() => {
    if (!categories) return [];
    let structural = 0;
    let nonStructural = 0;
    for (const c of categories) {
      if (isStructuralCategory(c.category)) {
        structural += c.count;
      } else {
        nonStructural += c.count;
      }
    }
    return [
      { label: 'Structural', value: structural, color: colors.warning },
      { label: 'Non-Structural', value: nonStructural, color: colors.primary },
    ].filter(d => d.value > 0);
  }, [categories, colors]);

  // === Section 3: Severity & Complexity ===
  const severityPieData: PieChartDatum[] = useMemo(() => {
    if (!barrierSeverity) return [];
    return [
      { label: 'High (7-10)', value: barrierSeverity.high, color: colors.danger },
      { label: 'Medium (4-6)', value: barrierSeverity.medium, color: colors.warning },
      { label: 'Low (1-3)', value: barrierSeverity.low, color: colors.success },
    ].filter(d => d.value > 0);
  }, [barrierSeverity, colors]);

  const complexityPieData: PieChartDatum[] = useMemo(() => {
    if (!complexityDistribution) return [];
    return complexityDistribution
      .map(c => ({
        label: formatLabel(c.complexity),
        value: c.count,
        color: COMPLEXITY_COLORS[c.complexity] ?? categoryScale(c.complexity),
      }))
      .filter(d => d.value > 0);
  }, [complexityDistribution, categoryScale]);

  const heatmapData: HeatmapData = useMemo(() => {
    if (!categorySeverityMatrix || categorySeverityMatrix.length === 0) {
      return { rows: [], columns: [], cells: [], maxValue: 0 };
    }
    const uniqueCategories = [...new Set(categorySeverityMatrix.map(r => r.category))];
    const heatmapColumns = ['High', 'Medium', 'Low'];
    const cells = categorySeverityMatrix.map(r => ({
      row: getCategoryLabel(r.category),
      column: r.severityBucket,
      value: r.count,
    }));
    const maxValue = Math.max(...cells.map(c => c.value), 1);
    return {
      rows: uniqueCategories.map(getCategoryLabel),
      columns: heatmapColumns,
      cells,
      maxValue,
    };
  }, [categorySeverityMatrix]);

  // === Section 4: Parts & Sources ===
  const partsBarData: BarChartDatum[] = useMemo(() => {
    if (!parts) return [];
    return parts
      .map(p => ({
        label: p.partName ? `${p.partName} (${p.part})` : `Part ${p.part}`,
        value: p.count,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);
  }, [parts]);

  const sectionTypeBarData: BarChartDatum[] = useMemo(() => {
    if (!sectionTypes) return [];
    return sectionTypes
      .map(st => ({
        label: formatLabel(st.sectionType),
        value: st.count,
      }))
      .sort((a, b) => b.value - a.value);
  }, [sectionTypes]);

  const sourceTypePieData: PieChartDatum[] = useMemo(() => {
    if (!sourceTypeBreakdown) return [];
    return [
      { label: 'Regulations', value: sourceTypeBreakdown.regulation, color: colors.primary },
      { label: 'Guidance', value: sourceTypeBreakdown.guidance, color: colors.success },
    ].filter(d => d.value > 0);
  }, [sourceTypeBreakdown, colors]);

  // === Section 5: Review & Developer Progress ===
  const reviewStatusPieData: PieChartDatum[] = useMemo(() => {
    if (!barrierStats) return [];
    return [
      { label: 'Unreviewed', value: barrierStats.unreviewed, color: reviewStatusColors.unreviewed },
      { label: 'Confirmed', value: barrierStats.confirmed, color: reviewStatusColors.confirmed },
      { label: 'Rejected (FP)', value: barrierStats.rejected_clear_fp, color: reviewStatusColors.rejected_clear_fp },
      { label: 'Rejected (Not Bad)', value: barrierStats.rejected_not_obvious_bad, color: reviewStatusColors.rejected_not_obvious_bad },
      { label: 'Needs Context', value: barrierStats.needs_context, color: reviewStatusColors.needs_context },
      { label: 'Deferred', value: barrierStats.deferred, color: reviewStatusColors.deferred },
    ].filter(d => d.value > 0);
  }, [barrierStats, reviewStatusColors]);

  const developerStatusPieData: PieChartDatum[] = useMemo(() => {
    if (!developerStatusCounts) return [];
    return [
      { label: 'Unresolved', value: developerStatusCounts.unresolved, color: colors.neutral400 },
      { label: 'Resolved', value: developerStatusCounts.resolved, color: colors.success },
      { label: 'Pending', value: developerStatusCounts.pending, color: colors.warning },
      { label: 'Backlogged', value: developerStatusCounts.backlogged, color: colors.info },
      { label: 'Need More Info', value: developerStatusCounts.need_more_info, color: colors.danger },
    ].filter(d => d.value > 0);
  }, [developerStatusCounts, colors]);

  const reviewByCategoryData = useMemo(() => {
    if (!reviewProgressByCategory) return [];
    const grouped = new Map<string, Map<string, number>>();
    for (const row of reviewProgressByCategory) {
      if (!grouped.has(row.category)) grouped.set(row.category, new Map());
      grouped.get(row.category)!.set(row.reviewStatus, row.count);
    }

    const sorted = [...grouped.entries()]
      .map(([cat, statuses]) => ({
        cat,
        total: [...statuses.values()].reduce((a, b) => a + b, 0),
        statuses,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    return sorted.map(({ cat, statuses }) => ({
      label: getCategoryLabel(cat),
      segments: [
        { label: 'Confirmed', value: statuses.get('confirmed') ?? 0, color: reviewStatusColors.confirmed },
        { label: 'Rejected', value: (statuses.get('rejected_clear_fp') ?? 0) + (statuses.get('rejected_not_obvious_bad') ?? 0), color: reviewStatusColors.rejected_clear_fp },
        { label: 'Needs Context', value: statuses.get('needs_context') ?? 0, color: reviewStatusColors.needs_context },
        { label: 'Deferred', value: statuses.get('deferred') ?? 0, color: reviewStatusColors.deferred },
        { label: 'Unreviewed', value: statuses.get('unreviewed') ?? 0, color: reviewStatusColors.unreviewed },
      ].filter(s => s.value > 0),
    }));
  }, [reviewProgressByCategory, reviewStatusColors]);

  // === Section 6: Burden Hotspots ===
  const burdenHistogramData: BarChartDatum[] = useMemo(() => {
    if (!burdenScoreDistribution) return [];
    return burdenScoreDistribution.map(b => ({
      label: b.bucket,
      value: b.count,
    }));
  }, [burdenScoreDistribution]);

  // === Sections config ===
  const categoryCount = categories?.length;
  const sections: SectionConfig[] = useMemo(() => [
    { id: 'barrier-overview', label: 'Overview' },
    { id: 'barrier-categories', label: 'Categories', count: categoryCount },
    { id: 'barrier-severity', label: 'Severity & Complexity' },
    { id: 'barrier-sources', label: 'Parts & Sources' },
    { id: 'barrier-review', label: 'Review Progress' },
    { id: 'barrier-burden', label: 'Burden Hotspots' },
    ...(strategyStats ? [{ id: 'barrier-strategies', label: 'Strategies' }] : []),
  ], [categoryCount, strategyStats]);

  // Empty state
  if (!barrierStats || barrierStats.total === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-[var(--color-text-muted)]">
        No Barrier data available for this jurisdiction
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-[89px] z-10 bg-white border-b border-[var(--color-neutral-200)] -mx-1 px-1 pb-1 shadow-sm">
        <StickyPageSectionTabs sections={sections} scrollOffset={140} />
      </div>

      {/* Section 1: Overview Stat Cards */}
      <div id="barrier-overview" className="scroll-mt-[140px] space-y-4">
        <StatGrid columns={4}>
          <StatCard
            label="Total Findings"
            value={barrierStats.total.toLocaleString()}
            icon={Sparkles}
            subtitle="Barrier analysis results"
          />
          <StatCard
            label="High Severity"
            value={barrierSeverity?.high.toLocaleString() ?? '—'}
            icon={AlertTriangle}
            variant="danger"
            subtitle="Severity 7-10"
          />
          <StatCard
            label="Review Progress"
            value={`${reviewProgress}%`}
            icon={CheckCircle}
            variant={reviewProgress > 50 ? 'success' : 'warning'}
            subtitle={`${barrierStats.confirmed} / ${barrierStats.total} confirmed`}
          />
          <StatCard
            label="High Burden Docs"
            value={burdenStats?.highBurdenCount ?? 0}
            icon={BarChart3}
            variant="danger"
            subtitle="Burden score > 40"
          />
        </StatGrid>
        {strategyStats && (
          <StatGrid columns={3}>
            <StatCard
              label="Best Stories"
              value={strategyStats.bestStories.toLocaleString()}
              icon={BookOpen}
              variant="info"
              subtitle="High severity, strong narrative"
            />
            <StatCard
              label="Surprises"
              value={strategyStats.surprises.toLocaleString()}
              icon={Zap}
              variant="warning"
              subtitle="Unexpected findings"
            />
            <StatCard
              label="Core Framework"
              value={strategyStats.framework.toLocaleString()}
              icon={Layers}
              variant="success"
              subtitle="Severity 5+, structural patterns"
            />
          </StatGrid>
        )}
      </div>

      {/* Section 2: Category Landscape */}
      <div id="barrier-categories" className="scroll-mt-[140px] grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartContainer
            title="Issues by Category"
            description="18 barrier categories ranked by finding count (structural categories highlighted)"
            aspectRatio={1.5}
            minHeight={Math.max(300, categoryBarData.length * 28)}
            maxHeight={600}
          >
            {({ width, height }) => (
              <ClientChart minHeight={height}>
                {categoryBarData.length > 0 ? (
                  <HorizontalBarChart
                    data={categoryBarData}
                    width={width}
                    height={height}
                    maxBars={18}
                    sortOrder="none"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                    No category data
                  </div>
                )}
              </ClientChart>
            )}
          </ChartContainer>
        </div>

        <ChartContainer
          title="Structural vs Non-Structural"
          description="Proportion of structural burden patterns"
          aspectRatio={1}
          minHeight={250}
          maxHeight={350}
        >
          {({ width, height }) => (
            <div className="flex flex-col items-center gap-4">
              <ClientChart minHeight={height - 80}>
                {structuralPieData.length > 0 ? (
                  <PieChart
                    data={structuralPieData}
                    width={Math.min(width - 20, height - 80)}
                    height={Math.min(width - 20, height - 80)}
                    innerRadiusRatio={0.5}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                    No data
                  </div>
                )}
              </ClientChart>
              {structuralPieData.length > 0 && (
                <ChartLegend
                  items={structuralPieData.map(d => ({
                    label: d.label,
                    color: d.color ?? categoryScale(d.label),
                    value: d.value,
                  }))}
                  orientation="horizontal"
                  className="flex-wrap justify-center"
                />
              )}
            </div>
          )}
        </ChartContainer>
      </div>

      {/* Section 3: Severity & Complexity */}
      <div id="barrier-severity" className="scroll-mt-[140px] space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartContainer
            title="Severity Distribution"
            description="Issues bucketed by severity score"
            aspectRatio={1.2}
            minHeight={250}
            maxHeight={350}
          >
            {({ width, height }) => (
              <div className="flex flex-col items-center gap-4">
                <ClientChart minHeight={height - 80}>
                  {severityPieData.length > 0 ? (
                    <PieChart
                      data={severityPieData}
                      width={Math.min(width - 20, height - 80)}
                      height={Math.min(width - 20, height - 80)}
                      innerRadiusRatio={0.5}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                      No severity data
                    </div>
                  )}
                </ClientChart>
                {severityPieData.length > 0 && (
                  <ChartLegend
                    items={severityPieData.map(d => ({
                      label: d.label,
                      color: d.color ?? categoryScale(d.label),
                      value: d.value,
                    }))}
                    orientation="horizontal"
                    className="flex-wrap justify-center"
                  />
                )}
              </div>
            )}
          </ChartContainer>

          <ChartContainer
            title="Complexity Distribution"
            description="Implementation complexity levels"
            aspectRatio={1.2}
            minHeight={250}
            maxHeight={350}
          >
            {({ width, height }) => (
              <div className="flex flex-col items-center gap-4">
                <ClientChart minHeight={height - 80}>
                  {complexityPieData.length > 0 ? (
                    <PieChart
                      data={complexityPieData}
                      width={Math.min(width - 20, height - 80)}
                      height={Math.min(width - 20, height - 80)}
                      innerRadiusRatio={0.5}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                      No complexity data
                    </div>
                  )}
                </ClientChart>
                {complexityPieData.length > 0 && (
                  <ChartLegend
                    items={complexityPieData.map(d => ({
                      label: d.label,
                      color: d.color ?? categoryScale(d.label),
                      value: d.value,
                    }))}
                    orientation="horizontal"
                    className="flex-wrap justify-center"
                  />
                )}
              </div>
            )}
          </ChartContainer>
        </div>

        {heatmapData.rows.length > 0 && (
          <ChartContainer
            title="Category × Severity Heatmap"
            description="Cross-cut of categories by severity level — darker cells indicate more findings"
            aspectRatio={2}
            minHeight={Math.max(300, heatmapData.rows.length * 28 + 80)}
            maxHeight={700}
          >
            {({ width, height }) => (
              <ClientChart minHeight={height}>
                <HeatmapGrid
                  data={heatmapData}
                  width={width}
                  height={height}
                />
              </ClientChart>
            )}
          </ChartContainer>
        )}
      </div>

      {/* Section 4: Parts & Sources */}
      <div id="barrier-sources" className="scroll-mt-[140px] space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {partsBarData.length > 0 && (
            <ChartContainer
              title="Issues by Part"
              description="Top regulatory parts by issue count"
              aspectRatio={1.5}
              minHeight={Math.max(250, partsBarData.length * 28)}
              maxHeight={500}
            >
              {({ width, height }) => (
                <ClientChart minHeight={height}>
                  <HorizontalBarChart
                    data={partsBarData}
                    width={width}
                    height={height}
                    maxBars={15}
                    sortOrder="none"
                  />
                </ClientChart>
              )}
            </ChartContainer>
          )}

          {sectionTypeBarData.length > 0 && (
            <ChartContainer
              title="Issues by Section Type"
              description="Distribution across section types"
              aspectRatio={1.5}
              minHeight={Math.max(250, sectionTypeBarData.length * 28)}
              maxHeight={500}
            >
              {({ width, height }) => (
                <ClientChart minHeight={height}>
                  <HorizontalBarChart
                    data={sectionTypeBarData}
                    width={width}
                    height={height}
                    maxBars={15}
                    sortOrder="none"
                  />
                </ClientChart>
              )}
            </ChartContainer>
          )}
        </div>

        {sourceTypePieData.length > 0 && (
          <ChartContainer
            title="Source Type"
            description="Regulation vs guidance document split"
            aspectRatio={1.2}
            minHeight={250}
            maxHeight={350}
          >
            {({ width, height }) => (
              <div className="flex flex-col items-center gap-4">
                <ClientChart minHeight={height - 80}>
                  <PieChart
                    data={sourceTypePieData}
                    width={Math.min(width - 20, height - 80)}
                    height={Math.min(width - 20, height - 80)}
                    innerRadiusRatio={0.5}
                  />
                </ClientChart>
                <ChartLegend
                  items={sourceTypePieData.map(d => ({
                    label: d.label,
                    color: d.color ?? categoryScale(d.label),
                    value: d.value,
                  }))}
                  orientation="horizontal"
                  className="flex-wrap justify-center"
                />
              </div>
            )}
          </ChartContainer>
        )}
      </div>

      {/* Section 5: Review & Developer Progress */}
      <div id="barrier-review" className="scroll-mt-[140px] space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartContainer
            title="Review Status"
            description="Distribution of review decisions"
            aspectRatio={1.2}
            minHeight={250}
            maxHeight={350}
          >
            {({ width, height }) => (
              <div className="flex flex-col items-center gap-4">
                <ClientChart minHeight={height - 80}>
                  {reviewStatusPieData.length > 0 ? (
                    <PieChart
                      data={reviewStatusPieData}
                      width={Math.min(width - 20, height - 80)}
                      height={Math.min(width - 20, height - 80)}
                      innerRadiusRatio={0.5}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                      No review data
                    </div>
                  )}
                </ClientChart>
                {reviewStatusPieData.length > 0 && (
                  <ChartLegend
                    items={reviewStatusPieData.map(d => ({
                      label: d.label,
                      color: d.color ?? categoryScale(d.label),
                      value: d.value,
                    }))}
                    orientation="horizontal"
                    className="flex-wrap justify-center"
                  />
                )}
              </div>
            )}
          </ChartContainer>

          <ChartContainer
            title="Developer Status"
            description="Tracking resolution progress on reviewed items"
            aspectRatio={1.2}
            minHeight={250}
            maxHeight={350}
          >
            {({ width, height }) => (
              <div className="flex flex-col items-center gap-4">
                <ClientChart minHeight={height - 80}>
                  {developerStatusPieData.length > 0 ? (
                    <PieChart
                      data={developerStatusPieData}
                      width={Math.min(width - 20, height - 80)}
                      height={Math.min(width - 20, height - 80)}
                      innerRadiusRatio={0.5}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                      No developer status data
                    </div>
                  )}
                </ClientChart>
                {developerStatusPieData.length > 0 && (
                  <ChartLegend
                    items={developerStatusPieData.map(d => ({
                      label: d.label,
                      color: d.color ?? categoryScale(d.label),
                      value: d.value,
                    }))}
                    orientation="horizontal"
                    className="flex-wrap justify-center"
                  />
                )}
              </div>
            )}
          </ChartContainer>
        </div>

        {reviewByCategoryData.length > 0 && (
          <ChartContainer
            title="Review Progress by Category"
            description="Stacked review status breakdown per category"
            aspectRatio={2}
            minHeight={350}
            maxHeight={500}
          >
            {({ width, height }) => (
              <ClientChart minHeight={height}>
                <StackedBarChart
                  data={reviewByCategoryData}
                  width={width}
                  height={height}
                />
              </ClientChart>
            )}
          </ChartContainer>
        )}
      </div>

      {/* Section 6: Burden Hotspots */}
      <div id="barrier-burden" className="scroll-mt-[140px] space-y-6">
        <StatGrid columns={3}>
          <StatCard
            label="Average Burden"
            value={burdenStats?.averageBurden?.toFixed(1) ?? '—'}
            icon={BarChart3}
            variant="info"
            subtitle="Across all analyzed documents"
          />
          <StatCard
            label="Top Structural Category"
            value={burdenStats?.topStructuralCategory ? getCategoryLabel(burdenStats.topStructuralCategory) : 'N/A'}
            icon={Layers}
            variant="warning"
            subtitle="Most frequent structural pattern"
          />
          <StatCard
            label="Documents Analyzed"
            value={burdenStats?.totalAnalyzed ?? 0}
            icon={Sparkles}
            subtitle="With burden scores"
          />
        </StatGrid>

        {burdenHistogramData.length > 0 && (
          <ChartContainer
            title="Burden Score Distribution"
            description="Document count by burden score range"
            aspectRatio={2}
            minHeight={250}
            maxHeight={400}
          >
            {({ width, height }) => (
              <ClientChart minHeight={height}>
                <BarChart
                  data={burdenHistogramData}
                  width={width}
                  height={height}
                  sortOrder="none"
                />
              </ClientChart>
            )}
          </ChartContainer>
        )}
      </div>

      {/* Section 7: Strategy Comparison */}
      {strategyStats && (
        <div id="barrier-strategies" className="scroll-mt-[140px] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text)]">Strategy Comparison</h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Four ways to filter the same {strategyStats.total.toLocaleString()} findings — from narrow to broad
              </p>
            </div>
            {jurisdiction && (
              <Link
                href={`/${jurisdiction.toLowerCase()}/barriers`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:underline"
              >
                Browse strategies <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {STRATEGIES.map(s => {
              const count = getStrategyCount(strategyStats, s.key);
              const pct = strategyStats.total > 0 ? Math.round((count / strategyStats.total) * 100) : 0;
              const barWidth = strategyStats.total > 0 ? Math.max((count / strategyStats.total) * 100, 2) : 0;
              const Icon = s.icon;
              return (
                <Card key={s.key}>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-[var(--color-primary-weaker)]">
                          <Icon className="h-4 w-4 text-[var(--color-primary)]" />
                        </div>
                        <span className="font-medium text-[var(--color-text)]">{s.label}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-bold text-[var(--color-text)]">{count.toLocaleString()}</span>
                        <span className="ml-1.5 text-sm text-[var(--color-text-muted)]">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-[var(--color-neutral-100)] rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">{s.description}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
