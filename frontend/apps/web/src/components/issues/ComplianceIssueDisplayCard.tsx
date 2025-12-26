'use client';

import { ReactNode } from 'react';
import { Badge, ReviewStatusBadge, Tag, Button } from '@/components/ui';
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

      {/* Context with highlighted term - either expanded or original */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            {isExpanded ? 'Expanded context:' : 'Context:'}
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

      {/* Requirement text */}
      {issue.requirementText && issue.requirementText !== issue.matchedContext && (
        <div className="mb-3">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            Requirement:
          </span>
          <blockquote className="mt-1 pl-3 border-l-2 border-[var(--color-neutral-300)] text-sm text-[var(--color-text)] italic">
            &ldquo;{issue.requirementText}&rdquo;
          </blockquote>
        </div>
      )}

      {/* Children slot (typically review form) */}
      {children}
    </div>
  );
}

export default ComplianceIssueDisplayCard;
