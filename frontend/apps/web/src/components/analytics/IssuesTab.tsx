'use client';

import { useMemo } from 'react';
import type { ComplianceIssueStatusCounts } from '@/lib/actions/compliance-issues';
import { Card } from '@/components/ui';
import { ClientChart, ChartContainer, HorizontalBarChart, ChartLegend } from '@/components/charts';
import { useChartColors } from '@/hooks/useChartColors';
import type { BarChartDatum } from '@/lib/charts/types';

interface IssuesTabProps {
  complianceByType: Record<string, number>;
  complianceStatus: ComplianceIssueStatusCounts | null;
}

// Human-readable labels for issue types
const ISSUE_TYPE_LABELS: Record<string, string> = {
  wet_signature: 'Wet Signature Required',
  mail_only: 'Mail Only Submission',
  fax: 'Fax Required',
  notarization: 'Notarization Required',
  in_person: 'In-Person Required',
  office_hours: 'Office Hours Only',
  paper_forms: 'Paper Forms',
  physical_presence: 'Physical Presence',
  manual_calculation: 'Manual Calculation',
  certified_mail: 'Certified Mail',
  hand_delivery: 'Hand Delivery',
  original_documents: 'Original Documents',
  carbon_copy: 'Carbon Copy',
  specific_format: 'Specific Format',
  published_tariff: 'Published Tariff',
  posted_notice: 'Posted Notice',
  newspaper_publication: 'Newspaper Publication',
  business_days: 'Business Days Only',
  hardcopy_records: 'Hardcopy Records',
  typewritten: 'Typewritten Required',
};

function formatIssueType(type: string): string {
  return ISSUE_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

export function IssuesTab({
  complianceByType,
  complianceStatus,
}: IssuesTabProps) {
  const colors = useChartColors();

  // Convert compliance by type to bar chart data
  const issueTypeData: BarChartDatum[] = useMemo(() => {
    return Object.entries(complianceByType)
      .map(([type, count]) => ({
        label: formatIssueType(type),
        value: count,
        secondaryLabel: type,
      }))
      .sort((a, b) => b.value - a.value);
  }, [complianceByType]);

  // Calculate status summary
  const totalIssues = complianceStatus?.total ?? 0;
  const confirmedIssues = complianceStatus?.confirmed ?? 0;
  const falsePositives =
    (complianceStatus?.rejected_clear_fp ?? 0) + (complianceStatus?.rejected_not_obvious_bad ?? 0);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card padding="md" className="text-center">
          <div className="text-3xl font-bold text-[var(--color-text)]">
            {totalIssues.toLocaleString()}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Total Compliance Issues</div>
        </Card>
        <Card padding="md" className="text-center">
          <div className="text-3xl font-bold text-[var(--color-success)]">
            {confirmedIssues.toLocaleString()}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Confirmed Issues</div>
        </Card>
        <Card padding="md" className="text-center">
          <div className="text-3xl font-bold text-[var(--color-neutral-500)]">
            {falsePositives.toLocaleString()}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">False Positives</div>
        </Card>
      </div>

      {/* Issue Type Distribution */}
      <ChartContainer
        title="Issues by Type"
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
              />
            ) : (
              <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                No compliance issues found
              </div>
            )}
          </ClientChart>
        )}
      </ChartContainer>

      {/* Issue Type Legend / Details */}
      {issueTypeData.length > 0 && (
        <Card padding="md">
          <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">
            Top Issue Types
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {issueTypeData.slice(0, 12).map((item, index) => (
              <div
                key={item.label}
                className="flex items-center gap-2 text-sm"
              >
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: colors.categoryScale(item.label) }}
                />
                <span className="text-[var(--color-text-secondary)] truncate">
                  {item.label}
                </span>
                <span className="text-[var(--color-text-muted)] font-medium ml-auto">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
