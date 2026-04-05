'use client';

import { useMemo } from 'react';
import { useQueryStates } from 'nuqs';
import { FileText, Sparkles, ShieldAlert } from 'lucide-react';
import type { DashboardStats, StatuteLinkStats, SeverityDistribution, JenAIReviewStatusCounts } from '@deproceduralizer/database';
import type { ComplianceIssueStatusCounts } from '@/lib/actions/compliance-issues';
import type { ClassificationTotals, TypeClassificationCounts } from '@/lib/actions/analytics-metrics';
import type { MetadataStats } from '@/lib/actions/regulations';
import type { DefinitionsAnalyticsStats } from '@/lib/actions/definitions';
import type { PipelineAnalyticsData } from '@/lib/actions/pipeline-analytics';
import { Card, StatCard, StatGrid, SegmentedControl } from '@/components/ui';
import {
  ClientChart,
  ChartContainer,
  PieChart,
  SeverityDonutChart,
  ChartLegend,
} from '@/components/charts';
import { HorizontalBarChart } from '@/components/charts/BarChart';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
import { useChartColors } from '@/hooks/useChartColors';
import { useChartNavigation } from '@/hooks/useChartNavigation';
import type { JurisdictionCode } from '@/types/state';
import type { OverviewClassificationValue } from '@/lib/constants/values';
import { LEGACY_ISSUE_TYPES } from '@/lib/constants/values';
import { analyticsParsers } from '@/lib/url/parsers';

const OVERVIEW_CLASSIFICATION_OPTIONS = [
  { value: 'burdensome' as const, label: 'Burdensome' },
  { value: 'justified' as const, label: 'Justified' },
  { value: 'all' as const, label: 'All' },
];

interface OverviewTabProps {
  dashboardStats: DashboardStats | null;
  complianceStatus: ComplianceIssueStatusCounts | null;
  complianceTypeCounts: Record<string, number> | null;
  metadataStats: MetadataStats | null;
  definitionsStats: DefinitionsAnalyticsStats | null;
  statuteStats: StatuteLinkStats | null;
  pipelineData: PipelineAnalyticsData | null;
  complianceSeverity: SeverityDistribution | null;
  jenaiSeverity: SeverityDistribution | null;
  jenaiStats: JenAIReviewStatusCounts | null;
  jurisdiction?: JurisdictionCode;
  complianceTypeClassification: TypeClassificationCounts | null;
  classificationTotals: ClassificationTotals | null;
  onNavigateToIssues?: () => void;
  activeSource?: string;
}

function ReviewProgressBar({
  label,
  counts,
}: {
  label: string;
  counts: { confirmed: number; unreviewed: number; total: number };
}) {
  const colors = useChartColors();
  const reviewedPercent = counts.total > 0 ? (counts.confirmed / counts.total) * 100 : 0;
  const unreviewedPercent = counts.total > 0 ? (counts.unreviewed / counts.total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-[var(--color-text)]">{label}</span>
        <span className="text-[var(--color-text-muted)]">
          {counts.confirmed.toLocaleString()} / {counts.total.toLocaleString()} human-reviewed
        </span>
      </div>
      <div className="h-3 bg-[var(--color-neutral-100)] rounded-full overflow-hidden flex">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${reviewedPercent}%`,
            backgroundColor: colors.colors.success,
          }}
        />
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${unreviewedPercent}%`,
            backgroundColor: colors.colors.neutral300,
          }}
        />
      </div>
      <div className="flex gap-4 text-xs text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: colors.colors.success }}
          />
          Human-reviewed ({reviewedPercent.toFixed(0)}%)
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: colors.colors.neutral300 }}
          />
          Unreviewed ({unreviewedPercent.toFixed(0)}%)
        </span>
      </div>
    </div>
  );
}

function CoverageTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-lg)]">
      <div className="text-2xl font-bold text-[var(--color-text)]">{value}</div>
      <div className="text-sm text-[var(--color-text-muted)]">{label}</div>
    </div>
  );
}

export function OverviewTab({
  dashboardStats,
  complianceStatus,
  complianceTypeCounts,
  metadataStats,
  definitionsStats,
  statuteStats,
  pipelineData,
  complianceSeverity,
  jenaiSeverity,
  jenaiStats,
  jurisdiction,
  complianceTypeClassification,
  classificationTotals,
  onNavigateToIssues,
  activeSource,
}: OverviewTabProps) {
  const colors = useChartColors();
  const navigateToPipeline = useChartNavigation(jurisdiction ? `/${jurisdiction}/pipeline` : '/ny/pipeline');
  const [params, setParams] = useQueryStates(analyticsParsers, { shallow: true });
  const classificationFilter = params.oClassification as OverviewClassificationValue;

  if (!dashboardStats) {
    return (
      <div className="text-center py-12 text-[var(--color-text-muted)]">
        No statistics available
      </div>
    );
  }

  // Pipeline funnel: pick best available tier
  const funnel = pipelineData?.funnel;
  const bestTier =
    funnel && funnel.tier3.total > 0 ? funnel.tier3 : funnel?.tier2;
  const tierLabel = funnel && funnel.tier3.total > 0 ? '3' : '2';

  // Review progress
  const complianceReviewed = complianceStatus?.confirmed ?? 0;
  const complianceUnreviewed = complianceStatus?.unreviewed ?? 0;
  const complianceTotal = complianceStatus?.total ?? 0;

  // Classification donut data — use server-computed classificationTotals, fall back to funnel tier data
  const ct = classificationTotals;
  const classificationData = ct
    ? [
        { label: 'Burdensome', value: ct.burdensome, color: colors.colors.danger },
        { label: 'Justified', value: ct.justified, color: colors.colors.success },
        { label: 'Unrelated', value: ct.unrelated, color: colors.colors.neutral300 },
      ]
    : bestTier
    ? [
        { label: 'Burdensome', value: bestTier.burdensome, color: colors.colors.danger },
        { label: 'Justified', value: bestTier.justified, color: colors.colors.success },
        { label: 'Unrelated', value: bestTier.unrelated, color: colors.colors.neutral300 },
      ]
    : [];
  const classificationTotal = ct?.total ?? (bestTier
    ? bestTier.burdensome + bestTier.justified + bestTier.unrelated
    : 0);

  // Dynamic stat card based on classification filter — uses server-computed totals
  const classificationStatLabel = classificationFilter === 'all'
    ? 'Classified Burdensome'
    : `Classified ${classificationFilter.charAt(0).toUpperCase() + classificationFilter.slice(1)}`;
  const classificationStatValue = classificationFilter === 'all'
    ? (ct?.burdensome ?? bestTier?.burdensome ?? 0)
    : (ct?.[classificationFilter] ?? bestTier?.[classificationFilter] ?? 0);
  const classificationStatVariant = classificationFilter === 'justified'
    ? 'default' as const
    : classificationStatValue > 0 ? 'danger' as const : 'default' as const;

  // Top issue types — filtered by classification when data is available
  const issueTypeEntries = useMemo(() => {
    if (complianceTypeClassification && classificationFilter !== 'all') {
      return Object.entries(complianceTypeClassification)
        .filter(([type]) => !LEGACY_ISSUE_TYPES.has(type))
        .map(([type, classMap]) => ({
          label: ISSUE_TYPE_LABELS[type] ?? type,
          value: classMap[classificationFilter] ?? 0,
        }))
        .filter(entry => entry.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
    }
    // Fallback: use total counts
    if (complianceTypeCounts) {
      return Object.entries(complianceTypeCounts)
        .filter(([type]) => !LEGACY_ISSUE_TYPES.has(type))
        .map(([type, count]) => ({
          label: ISSUE_TYPE_LABELS[type] ?? type,
          value: count,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
    }
    return [];
  }, [complianceTypeClassification, complianceTypeCounts, classificationFilter]);

  // Reverse lookup: display label → raw key (for chart click navigation)
  const labelToKey = complianceTypeCounts
    ? new Map(Object.keys(complianceTypeCounts).map(key => [ISSUE_TYPE_LABELS[key] ?? key, key]))
    : new Map<string, string>();

  // Coverage tile helpers
  const summaryPercent =
    metadataStats && metadataStats.total > 0
      ? `${Math.round((metadataStats.withSummary / metadataStats.total) * 100)}%`
      : 'N/A';

  const pipelineCoverage =
    funnel && dashboardStats.complianceIssues.total > 0
      ? `${Math.round((funnel.totalAnalyses / dashboardStats.complianceIssues.total) * 100)}%`
      : 'N/A';

  return (
    <div className="space-y-6">
      {/* Section 1: Executive Stats */}
      <StatGrid columns={3}>
        <StatCard
          label="Regulations Analyzed"
          value={dashboardStats.totalDocuments}
          icon={FileText}
          subtitle={`${metadataStats?.withSummary ?? 0} with AI summaries`}
        />
        <StatCard
          label="JenAI Findings"
          value={jenaiStats?.total ?? 0}
          icon={Sparkles}
          variant={(jenaiStats?.total ?? 0) > 0 ? 'warning' : 'default'}
          subtitle={
            jenaiStats
              ? `${jenaiStats.unreviewed} awaiting review`
              : 'JenAI data not available'
          }
        />
        <StatCard
          label={classificationStatLabel}
          value={classificationStatValue}
          icon={ShieldAlert}
          variant={classificationStatVariant}
          subtitle={
            pipelineData && bestTier
              ? `${complianceUnreviewed} unreviewed of ${complianceTotal} total issues`
              : 'Pipeline data not available'
          }
        />
      </StatGrid>

      {/* Classification Filter */}
      {complianceTypeClassification && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[var(--color-text-muted)]">Show:</span>
          <SegmentedControl
            options={OVERVIEW_CLASSIFICATION_OPTIONS}
            value={classificationFilter}
            onChange={(val) => setParams({ oClassification: val })}
            variant="filled"
            size="sm"
          />
        </div>
      )}

      {/* Section 2: Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Compliance Classification Donut */}
        {classificationData.length > 0 && classificationTotal > 0 ? (
          <ChartContainer
            title="Compliance Classification"
            description="Best available classification per issue"
            aspectRatio={1.2}
            minHeight={250}
            maxHeight={350}
          >
            {({ width, height }) => (
              <div className="flex flex-col items-center gap-4">
                <ClientChart minHeight={height - 60}>
                  <PieChart
                    data={classificationData}
                    width={Math.min(width, height - 60)}
                    height={Math.min(width, height - 60)}
                    innerRadiusRatio={0.6}
                    centerContent={
                      <div className="flex flex-col items-center">
                        <span className="text-2xl font-bold text-[var(--color-text)]">
                          {classificationTotal.toLocaleString()}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)]">Analyzed</span>
                      </div>
                    }
                  />
                </ClientChart>
                <ChartLegend
                  items={classificationData.map((d) => ({
                    label: d.label,
                    color: d.color,
                    value: d.value,
                  }))}
                  orientation="horizontal"
                />
              </div>
            )}
          </ChartContainer>
        ) : (
          <Card padding="lg">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
              Compliance Classification
            </h3>
            <div className="flex items-center justify-center h-48 text-[var(--color-text-muted)]">
              No classification data available
            </div>
          </Card>
        )}

        {/* Right: Top Issue Types */}
        {issueTypeEntries.length > 0 ? (
          <ChartContainer
            title={classificationFilter === 'all' ? 'Top Issue Types' : `Top Issue Types (${classificationFilter})`}
            aspectRatio={4 / 3}
            minHeight={250}
            maxHeight={350}
          >
            {({ width, height }) => (
              <ClientChart minHeight={250}>
                <HorizontalBarChart
                  data={issueTypeEntries}
                  width={width}
                  height={height}
                  maxBars={8}
                  onBarClick={(datum) => navigateToPipeline({
                    issueType: labelToKey.get(datum.label) ?? datum.label,
                    ...(classificationFilter !== 'all' ? { classification: classificationFilter } : {}),
                    ...(activeSource && activeSource !== 'all' ? { source: activeSource } : {}),
                  })}
                />
              </ClientChart>
            )}
          </ChartContainer>
        ) : (
          <Card padding="lg">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
              Top Issue Types
            </h3>
            <div className="flex items-center justify-center h-48 text-[var(--color-text-muted)]">
              No issue type data available
            </div>
          </Card>
        )}
      </div>

      {/* Link to full breakdown in Issues tab */}
      {complianceTypeClassification && onNavigateToIssues && (
        <div className="flex justify-end">
          <button
            onClick={onNavigateToIssues}
            className="text-sm text-[var(--color-primary)] hover:underline cursor-pointer"
          >
            View full issue type breakdown →
          </button>
        </div>
      )}

      {/* Section 3: Human Review Progress */}
      <Card padding="lg">
        <h3 className="text-lg font-semibold text-[var(--color-text)] mb-6">
          Human Review Progress
        </h3>
        <div className="space-y-6">
          <ReviewProgressBar
            label="Compliance Issues"
            counts={{
              confirmed: complianceReviewed,
              unreviewed: complianceUnreviewed,
              total: complianceTotal,
            }}
          />
        </div>
      </Card>

      {/* Section 4: Severity Distribution (2 donuts side-by-side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="lg">
          <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
            Compliance Issue Severity
          </h3>
          {complianceSeverity && complianceSeverity.total > 0 ? (
            <div className="flex flex-col items-center gap-4">
              <ClientChart minHeight={160}>
                <SeverityDonutChart
                  high={complianceSeverity.high}
                  medium={complianceSeverity.medium}
                  low={complianceSeverity.low}
                  width={160}
                  height={160}
                  showTotal
                />
              </ClientChart>
              <ChartLegend
                items={colors
                  .getSeverityPieColors()
                  .slice(0, 3)
                  .map((item, i) => ({
                    ...item,
                    value: [complianceSeverity.high, complianceSeverity.medium, complianceSeverity.low][i],
                  }))}
                orientation="horizontal"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-[var(--color-text-muted)]">
              No compliance severity data
            </div>
          )}
        </Card>

        <Card padding="lg">
          <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
            JenAI Severity
          </h3>
          {jenaiSeverity && jenaiSeverity.total > 0 ? (
            <div className="flex flex-col items-center gap-4">
              <ClientChart minHeight={160}>
                <SeverityDonutChart
                  high={jenaiSeverity.high}
                  medium={jenaiSeverity.medium}
                  low={jenaiSeverity.low}
                  width={160}
                  height={160}
                  showTotal
                />
              </ClientChart>
              <ChartLegend
                items={colors
                  .getSeverityPieColors()
                  .slice(0, 3)
                  .map((item, i) => ({
                    ...item,
                    value: [jenaiSeverity.high, jenaiSeverity.medium, jenaiSeverity.low][i],
                  }))}
                orientation="horizontal"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-[var(--color-text-muted)]">
              No JenAI severity data
            </div>
          )}
        </Card>
      </div>

      {/* Section 5: Data Coverage */}
      <Card padding="lg">
        <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">Data Coverage</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <CoverageTile label="AI Summaries" value={summaryPercent} />
          <CoverageTile label="Pipeline Coverage" value={pipelineCoverage} />
          <CoverageTile
            label="Forms Detected"
            value={metadataStats ? metadataStats.withForm.toLocaleString() : 'N/A'}
          />
          <CoverageTile
            label="External Standards (IBR)"
            value={metadataStats ? metadataStats.withIbr.toLocaleString() : 'N/A'}
          />
          <CoverageTile
            label="Definitions"
            value={
              definitionsStats ? definitionsStats.uniqueTerms.toLocaleString() : 'N/A'
            }
          />
          <CoverageTile
            label="Statute Links"
            value={statuteStats ? statuteStats.totalLinks.toLocaleString() : 'N/A'}
          />
        </div>
      </Card>
    </div>
  );
}
