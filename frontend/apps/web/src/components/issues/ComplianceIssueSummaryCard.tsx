'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Badge, SeverityBadge, ReviewStatusBadge } from '@/components/ui';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
import { highlightRegexPattern } from '@/lib/utils/highlight';
import type { ComplianceIssueWithAnalysisFields } from '@deproceduralizer/database';

interface ComplianceIssueSummaryCardProps {
  issue: ComplianceIssueWithAnalysisFields;
  state: string;
  isFocused?: boolean;
}

export function ComplianceIssueSummaryCard({
  issue,
  state,
  isFocused = false,
}: ComplianceIssueSummaryCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const issueTypeLabel = ISSUE_TYPE_LABELS[issue.issueType] || issue.issueType;

  // Auto-scroll into view when focused
  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isFocused]);

  // Get the highest tier reasoning available
  const tierReasoning =
    issue.tier3Reasoning || issue.tier2Reasoning || issue.tier1Reasoning;

  // First verbatim supporting text entry
  const verbatimText = issue.verbatimSupportingText?.[0];

  return (
    <div
      ref={cardRef}
      id={`compliance-issue-${issue.id}`}
      className={`border rounded-[var(--radius-md)] p-3 transition-all duration-200 ${
        isFocused
          ? 'border-[var(--color-warning)] bg-[var(--color-warning-bg)] ring-2 ring-[var(--color-warning)]/30'
          : 'border-[var(--color-neutral-200)] bg-white hover:border-[var(--color-neutral-300)]'
      }`}
    >
      {/* Header: Issue type + review status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="warning" className="text-xs font-semibold">
            {issueTypeLabel}
          </Badge>
          {issue.severity !== null && (
            <SeverityBadge severity={issue.severity} />
          )}
          {issue.requirementFound === true && (
            <Badge variant="success" className="text-xs">
              Confirmed
            </Badge>
          )}
          {issue.requirementFound === false && (
            <Badge variant="danger" className="text-xs">
              Rejected
            </Badge>
          )}
        </div>
        <ReviewStatusBadge
          status={issue.reviewStatus}
          className="text-xs flex-shrink-0"
        />
      </div>

      {/* Body: Verbatim text excerpt */}
      {verbatimText && (
        <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 mb-2">
          {highlightRegexPattern(verbatimText, issue.regexMatchPattern)}
        </p>
      )}

      {/* Expandable: Tier reasoning */}
      {tierReasoning && (
        <details className="mb-2">
          <summary className="text-xs text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-secondary)]">
            Tier reasoning
          </summary>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-4">
            {tierReasoning}
          </p>
        </details>
      )}

      {/* Footer: Links to pipeline analysis + review */}
      <div className="flex items-center gap-3">
        <Link
          href={
            issue.guidanceDocumentId
              ? `/${state}/pipeline/guidance/${issue.guidanceDocumentId}/${issue.issueType}`
              : `/${state}/pipeline/${issue.documentId}/${issue.issueType}`
          }
          className="text-xs text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline"
        >
          View full analysis &rarr;
        </Link>
        <Link
          href={`/${state}/review/compliance/${issue.id}`}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:underline"
        >
          Review
        </Link>
      </div>
    </div>
  );
}
