'use client';

import { ReactNode } from 'react';
import { Badge, ReviewStatusBadge, SeverityBadge, Tag, Button } from '@/components/ui';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
import { highlightTerm, highlightContext } from '@/lib/utils/highlight';

interface ComplianceIssueDisplayCardProps {
  /** The compliance issue data to display */
  issue: {
    issueType: string;
    requirementFound: boolean | null;
    requiredByStatute: boolean | null;
    reviewStatus: string | null;
    matchedPattern: string | null;
    matchedContext: string;
    requirementText: string | null;
    isVerbatim: boolean | null;
    severity: number | null;
    impactAssessment: string | null;
    statuteCitation: string | null;
  };
  /** Whether to show the review status badge in the header */
  showReviewStatus?: boolean;
  /** Expanded context configuration */
  expandedContext?: {
    isExpanded: boolean;
    expandedText: string | null;
    canExpand: boolean;
    onToggle: () => void;
  };
  /** Optional content to render at the bottom (e.g., review form) */
  children?: ReactNode;
}

/**
 * Display component for a single compliance issue.
 * Used by ComplianceIssuesList for consistent issue rendering.
 */
export function ComplianceIssueDisplayCard({
  issue,
  showReviewStatus = true,
  expandedContext,
  children,
}: ComplianceIssueDisplayCardProps) {
  const issueTypeLabel = ISSUE_TYPE_LABELS[issue.issueType] || issue.issueType;
  const isExpanded = expandedContext?.isExpanded ?? false;
  const canExpand = expandedContext?.canExpand ?? false;
  const expandedText = expandedContext?.expandedText;

  return (
    <div className="bg-[var(--color-warning-bg)] border-l-4 border-[var(--color-warning)] p-4 rounded-[var(--radius-md)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge variant="warning" className="font-semibold">
            {issueTypeLabel}
          </Badge>
          {issue.requirementFound && (
            <Badge variant="success" className="text-xs">
              LLM Confirmed
            </Badge>
          )}
          {issue.requiredByStatute && (
            <Badge variant="info" className="text-xs">
              From Statute
            </Badge>
          )}
          {issue.severity !== null && (
            <SeverityBadge severity={issue.severity} />
          )}
        </div>
        {showReviewStatus && issue.reviewStatus && (
          <ReviewStatusBadge status={issue.reviewStatus} />
        )}
      </div>

      {/* Pattern matched */}
      {issue.matchedPattern && (
        <div className="mb-3">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            Pattern matched:
          </span>
          <div className="flex flex-wrap gap-1 mt-1">
            <Tag variant="warning" size="sm">
              {issue.matchedPattern}
            </Tag>
          </div>
        </div>
      )}

      {/* Primary: Requirement Text (if available) */}
      {issue.requirementText && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                {issue.isVerbatim ? 'Verbatim Quote' : issue.isVerbatim === false ? 'Extracted Summary' : 'Requirement Text'}
              </span>
              {issue.isVerbatim !== null && (
                <Badge
                  variant={issue.isVerbatim ? 'info' : 'default'}
                  className="text-[10px] py-0 px-1.5"
                >
                  {issue.isVerbatim ? 'Verbatim' : 'Paraphrased'}
                </Badge>
              )}
            </div>
            {(canExpand || isExpanded) && expandedContext?.onToggle && (
              <Button
                variant="ghost"
                size="sm"
                onClick={expandedContext.onToggle}
                className="text-xs py-0.5 px-2 h-auto"
              >
                {isExpanded ? 'Show less' : 'Show more context'}
              </Button>
            )}
          </div>
          <div className={`p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border-l-4 ${
            issue.isVerbatim
              ? 'border-[var(--color-info)]'
              : 'border-[var(--color-warning)]'
          }`}>
            <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap">
              {issue.isVerbatim && '"'}
              {isExpanded && expandedText
                ? highlightContext(expandedText, issue.requirementText, issue.matchedPattern)
                : highlightTerm(issue.requirementText, issue.matchedPattern)}
              {issue.isVerbatim && '"'}
            </p>
          </div>
        </div>
      )}

      {/* Fallback: Matched Context (if no requirementText) */}
      {!issue.requirementText && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
              Matched Context
            </span>
            {(canExpand || isExpanded) && expandedContext?.onToggle && (
              <Button
                variant="ghost"
                size="sm"
                onClick={expandedContext.onToggle}
                className="text-xs py-0.5 px-2 h-auto"
              >
                {isExpanded ? 'Show less' : 'Show more context'}
              </Button>
            )}
          </div>
          <div className="p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border-l-4 border-[var(--color-warning)]">
            <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap">
              {isExpanded && expandedText
                ? highlightContext(expandedText, issue.matchedContext, issue.matchedPattern)
                : highlightTerm(issue.matchedContext, issue.matchedPattern)}
            </p>
          </div>
        </div>
      )}

      {/* Secondary: Original Match Context (collapsible, only if different from requirementText) */}
      {issue.requirementText && issue.matchedContext && issue.requirementText !== issue.matchedContext && (
        <details className="mb-3">
          <summary className="text-xs font-medium text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)] py-1">
            Original Match Context
          </summary>
          <div className="mt-2 p-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] border-l-2 border-[var(--color-neutral-300)]">
            <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap">
              {highlightTerm(issue.matchedContext, issue.matchedPattern)}
            </p>
          </div>
        </details>
      )}

      {/* LLM Analysis section - collapsible */}
      {(issue.impactAssessment || issue.statuteCitation) && (
        <details className="mb-3">
          <summary className="text-xs font-medium text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)] py-1">
            LLM Analysis
          </summary>
          <div className="mt-2 space-y-2 pl-2 border-l-2 border-[var(--color-neutral-200)]">
            {issue.impactAssessment && (
              <div>
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Impact Assessment:</span>
                <p className="mt-1 text-sm text-[var(--color-text)]">{issue.impactAssessment}</p>
              </div>
            )}
            {issue.statuteCitation && (
              <div>
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Statute Citation:</span>
                <p className="mt-1 text-sm font-mono text-[var(--color-text)]">{issue.statuteCitation}</p>
              </div>
            )}
          </div>
        </details>
      )}

      {/* Children slot (typically review form) */}
      {children}
    </div>
  );
}

export default ComplianceIssueDisplayCard;
