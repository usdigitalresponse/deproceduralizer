'use client';

import { useMemo } from 'react';
import { BookOpen, Layers, Link2, CheckCircle } from 'lucide-react';
import type { DefinitionsAnalyticsStats } from '@/lib/actions/definitions';
import { Card } from '@/components/ui';
import {
  ClientChart,
  ChartContainer,
  PieChart,
  HorizontalBarChart,
  ChartLegend,
} from '@/components/charts';
import { useChartColors } from '@/hooks/useChartColors';
import type { PieChartDatum, BarChartDatum } from '@/lib/charts/types';

interface DefinitionsTabProps {
  stats: DefinitionsAnalyticsStats | null;
}

// Human-readable labels for scope levels
const SCOPE_LEVEL_LABELS: Record<string, string> = {
  section: 'Section',
  subpart: 'Subpart',
  part: 'Part',
  subchapter: 'Subchapter',
  chapter: 'Chapter',
  subtitle: 'Subtitle',
  title: 'Title',
  unknown: 'Unknown',
};

// Human-readable labels for definition types
const TYPE_LABELS: Record<string, string> = {
  formal: 'Formal Definition',
  abbreviation: 'Abbreviation',
  unknown: 'Unknown',
};

// Human-readable labels for cross-reference targets
const TARGET_LABELS: Record<string, string> = {
  same_corpus: 'Same Corpus (NJ/NY)',
  federal: 'Federal (CFR/USC)',
  external_standard: 'External Standard',
  other: 'Other',
  unknown: 'Unknown',
};

// Human-readable labels for completeness
const COMPLETENESS_LABELS: Record<string, string> = {
  pure_pointer: 'Pure Pointer',
  hybrid: 'Hybrid',
  unknown: 'Unknown',
};

/** Capitalize first letter for unlabeled values */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatScopeLevel(level: string): string {
  return SCOPE_LEVEL_LABELS[level] || capitalize(level);
}

function formatDefinitionType(type: string): string {
  return TYPE_LABELS[type] || capitalize(type);
}

function formatTarget(target: string): string {
  return TARGET_LABELS[target] || capitalize(target.replace(/_/g, ' '));
}

function formatCompleteness(type: string): string {
  return COMPLETENESS_LABELS[type] || capitalize(type.replace(/_/g, ' '));
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  subtitle?: string;
}

function StatCard({ title, value, icon: Icon, subtitle }: StatCardProps) {
  return (
    <Card className="flex items-center gap-4">
      <div className="p-3 rounded-[var(--radius-lg)] bg-[var(--color-neutral-50)] text-[var(--color-primary)]">
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-[var(--color-text-muted)]">{title}</p>
        <p className="text-2xl font-bold text-[var(--color-text)]">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {subtitle && <p className="text-xs text-[var(--color-text-muted)]">{subtitle}</p>}
      </div>
    </Card>
  );
}

function ReviewProgressBar({
  counts,
}: {
  counts: { confirmed: number; corrected: number; falsePositive: number; unreviewed: number };
}) {
  const colors = useChartColors();
  const total = counts.confirmed + counts.corrected + counts.falsePositive + counts.unreviewed;
  if (total === 0) return null;

  const confirmed = (counts.confirmed / total) * 100;
  const corrected = (counts.corrected / total) * 100;
  const falsePositive = (counts.falsePositive / total) * 100;
  const unreviewed = (counts.unreviewed / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-[var(--color-text)]">Review Progress</span>
        <span className="text-[var(--color-text-muted)]">
          {(total - counts.unreviewed).toLocaleString()} / {total.toLocaleString()} reviewed
        </span>
      </div>
      <div className="h-3 bg-[var(--color-neutral-100)] rounded-full overflow-hidden flex">
        <div
          className="h-full"
          style={{ width: `${confirmed}%`, backgroundColor: colors.colors.success }}
          title={`Confirmed: ${counts.confirmed.toLocaleString()}`}
        />
        <div
          className="h-full"
          style={{ width: `${corrected}%`, backgroundColor: colors.colors.info }}
          title={`Corrected: ${counts.corrected.toLocaleString()}`}
        />
        <div
          className="h-full"
          style={{ width: `${falsePositive}%`, backgroundColor: colors.colors.neutral400 }}
          title={`False Positive: ${counts.falsePositive.toLocaleString()}`}
        />
        <div
          className="h-full"
          style={{ width: `${unreviewed}%`, backgroundColor: colors.colors.neutral200 }}
          title={`Unreviewed: ${counts.unreviewed.toLocaleString()}`}
        />
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.colors.success }} />
          Confirmed ({confirmed.toFixed(0)}%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.colors.info }} />
          Corrected ({corrected.toFixed(0)}%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.colors.neutral400 }} />
          False Positive ({falsePositive.toFixed(0)}%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.colors.neutral200 }} />
          Unreviewed ({unreviewed.toFixed(0)}%)
        </span>
      </div>
    </div>
  );
}

export function DefinitionsTab({ stats }: DefinitionsTabProps) {
  const colors = useChartColors();

  // Convert scope level data to pie chart
  const scopeLevelPieData: PieChartDatum[] = useMemo(() => {
    if (!stats) return [];
    return stats.byScopeLevel.map((item) => ({
      label: formatScopeLevel(item.level),
      value: item.count,
      color: colors.categoryScale(item.level),
    }));
  }, [stats, colors]);

  // Convert quality distribution to pie chart
  const qualityPieData: PieChartDatum[] = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'High Quality', value: stats.qualityDistribution.high, color: colors.colors.success },
      { label: 'Medium Quality', value: stats.qualityDistribution.medium, color: colors.colors.warning },
      { label: 'Low Quality', value: stats.qualityDistribution.low, color: colors.colors.danger },
    ].filter((d) => d.value > 0);
  }, [stats, colors]);

  // Convert cross-reference targets to bar chart
  const crossRefTargetData: BarChartDatum[] = useMemo(() => {
    if (!stats) return [];
    return stats.crossRefStats.byTarget.map((item) => ({
      label: formatTarget(item.target),
      value: item.count,
    }));
  }, [stats]);

  // Definition type distribution
  const typeData: BarChartDatum[] = useMemo(() => {
    if (!stats) return [];
    return stats.byType.map((item) => ({
      label: formatDefinitionType(item.type),
      value: item.count,
    }));
  }, [stats]);

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-12 text-[var(--color-text-muted)]">
        No definitions data available
      </div>
    );
  }

  const avgQuality = stats.averageOverlap;
  const qualityLabel = avgQuality >= 1.0 ? 'High' : avgQuality >= 0.3 ? 'Medium' : 'Low';

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Definitions"
          value={stats.total}
          icon={BookOpen}
          subtitle={`${stats.uniqueTerms.toLocaleString()} unique terms`}
        />
        <StatCard
          title="Cross-References"
          value={stats.crossRefStats.total}
          icon={Link2}
          subtitle={`${((stats.crossRefStats.total / stats.total) * 100).toFixed(1)}% of definitions`}
        />
        <StatCard
          title="Avg Quality Score"
          value={avgQuality.toFixed(2)}
          icon={CheckCircle}
          subtitle={`${qualityLabel} quality`}
        />
        <StatCard
          title="Scope Levels"
          value={stats.byScopeLevel.length}
          icon={Layers}
          subtitle="Different scope levels used"
        />
      </div>

      {/* Review Progress */}
      <Card padding="md">
        <ReviewProgressBar counts={stats.reviewStatus} />
      </Card>

      {/* Charts Row 1: Scope Distribution + Quality Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scope Level Distribution */}
        <ChartContainer
          title="Scope Level Distribution"
          description="How definitions are scoped across the hierarchy"
          aspectRatio={1.2}
          minHeight={280}
          maxHeight={350}
        >
          {({ width, height }) => (
            <div className="flex flex-col items-center gap-4">
              <ClientChart minHeight={height - 80}>
                {scopeLevelPieData.length > 0 ? (
                  <PieChart
                    data={scopeLevelPieData}
                    width={Math.min(width - 20, height - 80)}
                    height={Math.min(width - 20, height - 80)}
                    innerRadiusRatio={0.5}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                    No scope level data
                  </div>
                )}
              </ClientChart>
              {scopeLevelPieData.length > 0 && (
                <ChartLegend
                  items={scopeLevelPieData.slice(0, 5).map((d) => ({
                    label: d.label,
                    color: d.color ?? colors.categoryScale(d.label),
                    value: d.value,
                  }))}
                  orientation="horizontal"
                  className="flex-wrap justify-center"
                />
              )}
            </div>
          )}
        </ChartContainer>

        {/* Quality Distribution */}
        <ChartContainer
          title="Definition Quality"
          description="Based on definition overlap scores"
          aspectRatio={1.2}
          minHeight={280}
          maxHeight={350}
        >
          {({ width, height }) => (
            <div className="flex flex-col items-center gap-4">
              <ClientChart minHeight={height - 80}>
                {qualityPieData.length > 0 ? (
                  <PieChart
                    data={qualityPieData}
                    width={Math.min(width - 20, height - 80)}
                    height={Math.min(width - 20, height - 80)}
                    innerRadiusRatio={0.5}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                    No quality data
                  </div>
                )}
              </ClientChart>
              <ChartLegend
                items={qualityPieData.map((d) => ({
                  label: d.label,
                  color: d.color ?? colors.categoryScale(d.label),
                  value: d.value,
                }))}
                orientation="horizontal"
                className="flex-wrap justify-center"
              />
            </div>
          )}
        </ChartContainer>
      </div>

      {/* Charts Row 2: Cross-Reference Analysis */}
      {stats.crossRefStats.total > 0 && (
        <ChartContainer
          title="Cross-Reference Targets"
          description="Where cross-referenced definitions point to"
          aspectRatio={2.5}
          minHeight={200}
          maxHeight={300}
        >
          {({ width, height }) => (
            <ClientChart minHeight={height}>
              {crossRefTargetData.length > 0 ? (
                <HorizontalBarChart
                  data={crossRefTargetData}
                  width={width}
                  height={height}
                  maxBars={6}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                  No cross-reference data
                </div>
              )}
            </ClientChart>
          )}
        </ChartContainer>
      )}

      {/* Definition Type + Completeness */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Definition Types */}
        <Card padding="md">
          <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">Definition Types</h4>
          <div className="space-y-3">
            {typeData.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">{item.label}</span>
                <span className="text-sm font-medium text-[var(--color-text)]">
                  {item.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Cross-Reference Completeness */}
        {stats.crossRefStats.total > 0 && (
          <Card padding="md">
            <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">
              Cross-Reference Completeness
            </h4>
            <div className="space-y-3">
              {stats.crossRefStats.byCompleteness.map((item) => (
                <div key={item.type} className="flex items-center justify-between">
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {formatCompleteness(item.type)}
                  </span>
                  <span className="text-sm font-medium text-[var(--color-text)]">
                    {item.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-3">
              Pure Pointer = only references external definition. Hybrid = has inline definition + reference.
            </p>
          </Card>
        )}
      </div>

      {/* Scope Level Details */}
      {scopeLevelPieData.length > 0 && (
        <Card padding="md">
          <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">All Scope Levels</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {stats.byScopeLevel.map((item) => (
              <div
                key={item.level}
                className="flex items-center gap-2 text-sm p-2 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)]"
              >
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: colors.categoryScale(item.level) }}
                />
                <span className="text-[var(--color-text-secondary)] truncate flex-1">
                  {formatScopeLevel(item.level)}
                </span>
                <span className="text-[var(--color-text-muted)] font-medium">
                  {item.count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
