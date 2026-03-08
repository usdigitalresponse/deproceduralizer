import Link from 'next/link';
import { ArrowRight, ClipboardList, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
import type { GuidanceComplianceAnalysisSummary } from '@/lib/actions/guidance-documents';

interface GuidanceComplianceCardProps {
  summary: GuidanceComplianceAnalysisSummary;
  state: string;
  guidanceDocumentId: number;
}

export function GuidanceComplianceCard({ summary, state, guidanceDocumentId }: GuidanceComplianceCardProps) {
  const { totalIssues, analyzedCount, burdensomeCount, justifiedCount, topIssueTypes } = summary;

  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle>Compliance Analysis</CardTitle>
      </CardHeader>
      <div className="pt-4 space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-neutral-50)]">
              <ClipboardList className="w-4 h-4 text-[var(--color-primary)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Regex Matches</p>
              <p className="text-lg font-semibold text-[var(--color-text)]">{totalIssues}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-info-bg)]">
              <ClipboardList className="w-4 h-4 text-[var(--color-info)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Analyzed</p>
              <p className="text-lg font-semibold text-[var(--color-text)]">{analyzedCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-danger-bg)]">
              <AlertTriangle className="w-4 h-4 text-[var(--color-danger)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Burdensome</p>
              <p className="text-lg font-semibold text-[var(--color-text)]">{burdensomeCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-success-bg)]">
              <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Justified</p>
              <p className="text-lg font-semibold text-[var(--color-text)]">{justifiedCount}</p>
            </div>
          </div>
        </div>

        {/* Top issue types — each links to the pipeline analysis */}
        {topIssueTypes.length > 0 && (
          <div>
            <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2">Pipeline Analysis by Issue Type</p>
            <div className="space-y-1.5">
              {topIssueTypes.slice(0, 5).map(({ issueType, count }) => (
                <Link
                  key={issueType}
                  href={`/${state}/pipeline/guidance/${guidanceDocumentId}/${issueType}`}
                  className="flex items-center justify-between py-1.5 px-2 rounded-[var(--radius-sm)] bg-[var(--color-neutral-50)] hover:bg-[var(--color-neutral-100)] transition-colors group"
                >
                  <span className="text-sm text-[var(--color-link)] group-hover:underline flex items-center gap-1.5">
                    {ISSUE_TYPE_LABELS[issueType] ?? issueType}
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                  <Badge variant="default">{count} matches</Badge>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
