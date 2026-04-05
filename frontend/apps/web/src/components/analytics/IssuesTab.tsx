'use client';

import { useMemo } from 'react';
import { useQueryStates } from 'nuqs';
import type { TypeClassificationCounts, ClassificationTotals, ReviewStatusCounts } from '@/lib/actions/analytics-metrics';
import { Card, SegmentedControl } from '@/components/ui';
import { ClientChart, ChartContainer, HorizontalBarChart } from '@/components/charts';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
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

interface IssuesTabProps {
  complianceByType: Record<string, number>;
  complianceStatus: ReviewStatusCounts | null;
  complianceTypeClassification: TypeClassificationCounts | null;
  classificationTotals: ClassificationTotals | null;
  jurisdiction?: JurisdictionCode;
  activeSource?: string;
}

export function IssuesTab({
  complianceByType,
  complianceStatus,
  complianceTypeClassification,
  classificationTotals,
  jurisdiction,
  activeSource,
}: IssuesTabProps) {
  const navigateToPipeline = useChartNavigation(jurisdiction ? `/${jurisdiction}/pipeline` : '/ny/pipeline');
  const [params, setParams] = useQueryStates(analyticsParsers, { shallow: true });
  const classificationFilter = params.oClassification as OverviewClassificationValue;

  // Summary stats
  const totalIssues = complianceStatus?.total ?? 0;
  const confirmedIssues = complianceStatus?.confirmed ?? 0;
  const falsePositives =
    (complianceStatus?.rejected_clear_fp ?? 0) + (complianceStatus?.rejected_not_obvious_bad ?? 0);
  const pendingReview =
    (complianceStatus?.unreviewed ?? 0) + (complianceStatus?.needs_context ?? 0) + (complianceStatus?.deferred ?? 0);

  // Bar chart data — filtered by classification
  const issueTypeData = useMemo(() => {
    if (complianceTypeClassification && classificationFilter !== 'all') {
      return Object.entries(complianceTypeClassification)
        .filter(([type]) => !LEGACY_ISSUE_TYPES.has(type))
        .map(([type, classMap]) => ({
          label: ISSUE_TYPE_LABELS[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          value: classMap[classificationFilter] ?? 0,
          secondaryLabel: type,
        }))
        .filter(entry => entry.value > 0)
        .sort((a, b) => b.value - a.value);
    }
    return Object.entries(complianceByType)
      .filter(([type]) => !LEGACY_ISSUE_TYPES.has(type))
      .map(([type, count]) => ({
        label: ISSUE_TYPE_LABELS[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        value: count,
        secondaryLabel: type,
      }))
      .sort((a, b) => b.value - a.value);
  }, [complianceByType, complianceTypeClassification, classificationFilter]);

  // Reverse lookup for click navigation
  const labelToKey = new Map(
    Object.keys(complianceByType).map(key => [
      ISSUE_TYPE_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      key,
    ])
  );

  // Breakdown table rows
  const breakdownRows = useMemo(() => {
    if (!complianceTypeClassification) return [];
    return Object.entries(complianceTypeClassification)
      .filter(([type]) => !LEGACY_ISSUE_TYPES.has(type))
      .filter(([, classMap]) => classMap.total > 0)
      .map(([type, classMap]) => ({
        key: type,
        label: ISSUE_TYPE_LABELS[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        burdensome: classMap.burdensome,
        justified: classMap.justified,
        total: classMap.total,
      }))
      .sort((a, b) => b.total - a.total);
  }, [complianceTypeClassification]);

  const breakdownTotals = useMemo(() => {
    return breakdownRows.reduce(
      (acc, row) => ({
        burdensome: acc.burdensome + row.burdensome,
        justified: acc.justified + row.justified,
        total: acc.total + row.total,
      }),
      { burdensome: 0, justified: 0, total: 0 }
    );
  }, [breakdownRows]);

  return (
    <div className="space-y-6">
      {/* Top Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card padding="md" className="text-center">
          <div className="text-3xl font-bold text-[var(--color-text)]">
            {totalIssues.toLocaleString()}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Total Issues</div>
        </Card>
        <Card padding="md" className="text-center">
          <div className="text-3xl font-bold text-[var(--color-danger)]">
            {(classificationTotals?.burdensome ?? breakdownTotals.burdensome).toLocaleString()}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Burdensome</div>
        </Card>
        <Card padding="md" className="text-center">
          <div className="text-3xl font-bold text-[var(--color-success)]">
            {(classificationTotals?.justified ?? breakdownTotals.justified).toLocaleString()}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Justified</div>
        </Card>
        <Card padding="md" className="text-center">
          <div className="text-3xl font-bold text-[var(--color-text)]">
            {pendingReview.toLocaleString()}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Pending Human Review</div>
          <div className="text-xs text-[var(--color-text-muted)]">Unreviewed + needs context + deferred</div>
        </Card>
        <Card padding="md" className="text-center">
          <div className="text-3xl font-bold text-[var(--color-success)]">
            {confirmedIssues.toLocaleString()}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Confirmed by Human Review</div>
        </Card>
        <Card padding="md" className="text-center">
          <div className="text-3xl font-bold text-[var(--color-neutral-500)]">
            {falsePositives.toLocaleString()}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">False Positives (Human Review)</div>
        </Card>
      </div>

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

      {/* Issue Type Distribution Chart */}
      <ChartContainer
        title={classificationFilter === 'all' ? 'Issues by Type' : `Issues by Type (${classificationFilter})`}
        description="Distribution of compliance issues across different types"
        aspectRatio={2}
        minHeight={Math.max(300, issueTypeData.length * 35)}
        maxHeight={800}
      >
        {({ width, height }) => (
          <ClientChart minHeight={height}>
            {issueTypeData.length > 0 ? (
              <HorizontalBarChart
                data={issueTypeData}
                width={width}
                height={height}
                maxBars={20}
                onBarClick={(datum) => navigateToPipeline({
                  issueType: labelToKey.get(datum.label) ?? datum.label,
                  ...(classificationFilter !== 'all' ? { classification: classificationFilter } : {}),
                  ...(activeSource && activeSource !== 'all' ? { source: activeSource } : {}),
                })}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                No compliance issues found
              </div>
            )}
          </ClientChart>
        )}
      </ChartContainer>

      {/* Issue Type Breakdown Table */}
      {breakdownRows.length > 0 && (
        <Card padding="lg">
          <h3 className="text-lg font-semibold text-[var(--color-text)] mb-1">
            Issue Type Breakdown
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            Burdensome vs. justified classification per issue type
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-neutral-200)]">
                  <th className="text-left py-2 pr-4 font-medium text-[var(--color-text-muted)]">Issue Type</th>
                  <th className="text-right py-2 px-4 font-medium text-[var(--color-danger)]">Burdensome</th>
                  <th className="text-right py-2 px-4 font-medium text-[var(--color-success)]">Justified</th>
                  <th className="text-right py-2 pl-4 font-medium text-[var(--color-text-muted)]">Total</th>
                </tr>
              </thead>
              <tbody>
                {breakdownRows.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)] cursor-pointer transition-colors"
                    onClick={() => navigateToPipeline({
                      issueType: row.key,
                      ...(classificationFilter !== 'all' ? { classification: classificationFilter } : {}),
                      ...(activeSource && activeSource !== 'all' ? { source: activeSource } : {}),
                    })}
                  >
                    <td className="py-2 pr-4 text-[var(--color-text)]">{row.label}</td>
                    <td className="py-2 px-4 text-right tabular-nums">
                      {row.burdensome > 0 ? (
                        <span className="text-[var(--color-danger)] font-medium">{row.burdensome.toLocaleString()}</span>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">0</span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums">
                      {row.justified > 0 ? (
                        <span className="text-[var(--color-success)] font-medium">{row.justified.toLocaleString()}</span>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">0</span>
                      )}
                    </td>
                    <td className="py-2 pl-4 text-right tabular-nums font-medium text-[var(--color-text)]">
                      {row.total.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--color-neutral-300)]">
                  <td className="py-2 pr-4 font-semibold text-[var(--color-text)]">Total</td>
                  <td className="py-2 px-4 text-right tabular-nums font-semibold text-[var(--color-danger)]">
                    {breakdownTotals.burdensome.toLocaleString()}
                  </td>
                  <td className="py-2 px-4 text-right tabular-nums font-semibold text-[var(--color-success)]">
                    {breakdownTotals.justified.toLocaleString()}
                  </td>
                  <td className="py-2 pl-4 text-right tabular-nums font-semibold text-[var(--color-text)]">
                    {breakdownTotals.total.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
